import io
import json

import pytest
from models.staging_metadata import MetadataFile
from pydantic import BaseModel
from services.metadata_mapping_validator_service import MetadataMappingValidationService
from utils.exceptions import BulkUploadMetadataException


@pytest.fixture
def mock_s3_service(mocker):
    """Create a fake S3 service with configurable return values."""
    mock_s3 = mocker.MagicMock()
    mock_s3.list_all_objects.return_value = [
        {"Key": "metadata_aliases/general/general_aliases_v2.json"},
        {"Key": "metadata_aliases/general/extra_alias.json"},
    ]

    json_content = {
        "file_path": "FILE",
        "gp_practice_code": "ODS",
        "nhs_number": "NHS",
        "page_count": "PAGE_COUNT",
        "section": "SECTION",
        "sub_section": "SUB_SECTION",
        "scan_date": "SCAN_DATE",
        "scan_id": "SCAN_ID",
        "user_id": "USER_ID",
        "upload": "UPLOADED",
        "owner": "Test Owner",
    }

    mock_s3.stream_s3_object_to_memory.side_effect = lambda bucket, key: io.StringIO(
        json.dumps(json_content)
    )

    return mock_s3


@pytest.fixture
def service(mock_s3_service, mocker):
    """Create service with injected mocked S3."""
    service = MetadataMappingValidationService(
        config_bucket="fake-bucket", alias_prefix="metadata_aliases/general/"
    )
    service.s3_service = mock_s3_service
    return service


def test_list_alias_configs_from_s3_reads_valid_json(service):
    alias_maps = service.list_alias_configs_from_s3()
    assert "general_aliases_v2" in alias_maps
    assert alias_maps["general_aliases_v2"]["file_path"] == "FILE"


def test_list_alias_configs_from_s3_raises_on_failure(mocker):
    service = MetadataMappingValidationService(
        config_bucket="fake-bucket", alias_prefix="metadata_aliases/general/"
    )
    mocker.patch.object(
        service.s3_service, "list_all_objects", side_effect=Exception("S3 broken")
    )

    with pytest.raises(
        BulkUploadMetadataException, match="Failed to load alias configs from S3"
    ):
        service.list_alias_configs_from_s3()


def test_evaluate_alias_matches_computes_correct_score(service):
    alias_maps = {
        "test_alias": {
            "file_path": "FILE",
            "gp_practice_code": "ODS",
            "nhs_number": "NHS",
        }
    }
    header_set = {"file", "ods", "nhs", "extra_header"}
    results = service.evaluate_alias_matches(alias_maps, header_set)

    assert "test_alias" in results
    assert results["test_alias"]["match_count"] == 3
    assert results["test_alias"]["total_fields"] == 3
    assert results["test_alias"]["score"] == 1.0


def test_evaluate_alias_matches_handles_partial_match(service):
    alias_maps = {
        "partial_alias": {
            "file_path": "FILE",
            "gp_practice_code": "ODS",
            "nhs_number": "NHS",
        }
    }
    header_set = {"file", "ods"}  # missing one
    results = service.evaluate_alias_matches(alias_maps, header_set)

    info = results["partial_alias"]
    assert info["match_count"] == 2
    assert info["total_fields"] == 3
    assert info["score"] == pytest.approx(2 / 3, 0.001)


def test_select_best_match_returns_highest_score(service):
    match_results = {
        "alias_a": {"score": 0.7},
        "alias_b": {"score": 0.9},
        "alias_c": {"score": 0.5},
    }
    best_match, best_info = service.select_best_match(match_results)
    assert best_match == "alias_b"
    assert best_info["score"] == 0.9


def test_select_best_match_returns_none_for_empty(service):
    best_match, best_info = service.select_best_match({})
    assert best_match is None
    assert best_info is None


def test_log_best_match_includes_owner(service, caplog):
    alias_maps = {"alias_a": {"owner": "Test Owner"}}
    info = {
        "match_count": 5,
        "total_fields": 6,
        "matched_fields": ["file_path", "nhs_number"],
        "missing_fields": ["upload"],
    }

    service.log_best_match("alias_a", info, alias_maps)

    logs = [r.message for r in caplog.records]
    assert any("Alias file 'alias_a' owned by 'Test Owner'" in msg for msg in logs)
    assert any("matched 5 of 6 fields" in msg for msg in logs)


def test_detect_best_alias_config_success(service):
    headers = ["FILE", "ODS", "NHS", "PAGE_COUNT", "UPLOAD"]
    best_match = service.detect_best_alias_config(headers)
    assert best_match == "general_aliases_v2"


def test_detect_best_alias_config_raises_when_no_aliases(mocker):
    service = MetadataMappingValidationService(
        config_bucket="fake-bucket", alias_prefix="metadata_aliases/general/"
    )
    mocker.patch.object(service, "list_alias_configs_from_s3", return_value={})
    with pytest.raises(
        BulkUploadMetadataException, match="No alias configurations found in S3"
    ):
        service.detect_best_alias_config(["FILE"])


def test_detect_best_alias_config_raises_when_no_match(service, mocker):
    mocker.patch.object(service, "evaluate_alias_matches", return_value={})
    with pytest.raises(
        BulkUploadMetadataException, match="No alias configuration matches"
    ):
        service.detect_best_alias_config(["random_header"])


def test_list_alias_configs_from_s3_raises_if_no_bucket():
    service = MetadataMappingValidationService(config_bucket=None, alias_prefix="metadata_aliases/general/")  # type: ignore[arg-type]
    with pytest.raises(
        BulkUploadMetadataException,
        match="Alias config bucket not configured for validator.",
    ):
        service.list_alias_configs_from_s3()


def test_list_alias_configs_from_s3_skips_non_json_and_irrelevant_keys(
    service, mock_s3_service
):
    mock_s3_service.list_all_objects.return_value = [
        {"Key": "metadata_aliases/general/general_aliases_v2.txt"},
        {"Key": "other_prefix/general_aliases_v2.json"},
        {"Key": "metadata_aliases/general/valid.json"},
    ]

    valid_alias = {"file_path": "FILE"}
    mock_s3_service.stream_s3_object_to_memory.side_effect = lambda b, k: io.StringIO(
        json.dumps(valid_alias)
    )

    alias_maps = service.list_alias_configs_from_s3()
    assert "valid" in alias_maps
    assert "general_aliases_v2" not in alias_maps


def test_evaluate_alias_matches_skips_empty_alias(service):
    alias_maps = {"empty_alias": {}}
    results = service.evaluate_alias_matches(alias_maps, {"file", "ods"})
    assert results == {}


def test_build_model_for_alias_calls_expected_methods(mocker, service):
    mock_load = mocker.patch.object(
        service, "load_alias_map", return_value={"file_path": "FILE"}
    )
    mock_validate = mocker.patch.object(service, "validate_alias_map")
    mock_create = mocker.patch.object(
        service, "create_dynamic_model", return_value=BaseModel
    )

    result = service.build_model_for_alias("general")
    assert result == BaseModel
    mock_load.assert_called_once_with("general")
    mock_validate.assert_called_once()
    mock_create.assert_called_once()


def test_load_alias_map_reads_json_successfully(service, mock_s3_service):
    mock_s3_service.stream_s3_object_to_memory.side_effect = lambda b, k: io.StringIO(
        json.dumps({"file_path": "FILE"})
    )
    alias_map = service.load_alias_map("general")
    assert alias_map["file_path"] == "FILE"


def test_load_alias_map_raises_on_s3_error(service, mock_s3_service):
    mock_s3_service.stream_s3_object_to_memory.side_effect = Exception("S3 failure")
    with pytest.raises(BulkUploadMetadataException, match="Could not load alias file"):
        service.load_alias_map("general")


def test_load_alias_map_raises_on_empty_map(service, mock_s3_service):
    mock_s3_service.stream_s3_object_to_memory.side_effect = lambda b, k: io.StringIO(
        "{}"
    )
    with pytest.raises(BulkUploadMetadataException, match="is empty or invalid"):
        service.load_alias_map("general")


def test_validate_alias_map_raises_when_keys_missing(service):
    alias_map = {"file_path": "FILE"}
    with pytest.raises(BulkUploadMetadataException, match="missing mappings"):
        service.validate_alias_map(alias_map, "general")


def test_create_dynamic_model_builds_pydantic_model(service):
    alias_map = {k: k.upper() for k in MetadataFile.model_fields.keys()}
    model = service.create_dynamic_model(alias_map, "general")
    assert issubclass(model, BaseModel)
    assert "file_path" in model.model_fields


def test_validate_and_normalize_metadata_mixed_results(mocker, service):
    class FakeModel(BaseModel):
        file_path: str

    mocker.patch.object(service, "build_model_for_alias", return_value=FakeModel)

    # Patch required fields list to only include 'file_path'
    mocker.patch.object(
        service,
        "get_empty_required_fields",
        wraps=lambda data, req: [k for k, v in data.items() if not v],
    )

    records = [
        {"file_path": "valid.pdf"},
        {"file_path": ""},
    ]

    validated, rejected, reasons = service.validate_and_normalize_metadata(
        records, "general"
    )

    assert len(validated) == 1
    assert len(rejected) == 1
    assert "Missing or empty required fields" in reasons[0]["REASON"]


def test_get_empty_required_fields_detects(service):
    data = {"file_path": "", "gp_practice_code": None, "nhs_number": "123"}
    required = ["file_path", "gp_practice_code", "nhs_number"]
    result = service.get_empty_required_fields(data, required)
    assert set(result) == {"file_path", "gp_practice_code"}
