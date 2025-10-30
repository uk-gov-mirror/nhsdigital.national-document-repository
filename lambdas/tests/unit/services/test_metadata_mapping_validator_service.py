import io
import json

import pytest
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
        alias_bucket="fake-bucket", alias_prefix="metadata_aliases/general/"
    )
    service.s3_service = mock_s3_service
    return service


def test_list_alias_configs_from_s3_reads_valid_json(service):
    alias_maps = service.list_alias_configs_from_s3()
    assert "general_aliases_v2" in alias_maps
    assert alias_maps["general_aliases_v2"]["file_path"] == "FILE"


def test_list_alias_configs_from_s3_raises_on_failure(mocker):
    service = MetadataMappingValidationService(
        alias_bucket="fake-bucket", alias_prefix="metadata_aliases/general/"
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
        alias_bucket="fake-bucket", alias_prefix="metadata_aliases/general/"
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
