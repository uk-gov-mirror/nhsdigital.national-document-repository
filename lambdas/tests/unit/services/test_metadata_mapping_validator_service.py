import json
from pathlib import Path
from pydantic import ValidationError
import pytest

from services.metadata_mapping_validator_service import MetadataMappingValidationService
from utils.exceptions import BulkUploadMetadataException
from models.staging_metadata import MetadataFile


@pytest.fixture
def alias_dir(tmp_path):
    """Creates a temporary alias folder with fake JSON mappings."""
    config_dir = tmp_path / "aliases"
    config_dir.mkdir()

    valid_alias = {
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
    }

    invalid_json_path = config_dir / "invalid.json"
    invalid_json_path.write_text("{bad json")

    valid_json_path = config_dir / "general.json"
    valid_json_path.write_text(json.dumps(valid_alias))

    return config_dir


@pytest.fixture
def service(alias_dir):
    return MetadataMappingValidationService(alias_folder=str(alias_dir))


def test_detect_best_alias_config_selects_best_match(service):
    headers = ["FILE", "ODS", "NHS"]
    best = service.detect_best_alias_config(headers)
    assert best == "general"


def test_detect_best_alias_config_skips_invalid_json(service, caplog):
    headers = ["FILE", "ODS", "NHS"]
    _ = service.detect_best_alias_config(headers)
    assert any("Skipping invalid JSON" in rec.message for rec in caplog.records)


def test_detect_best_alias_config_raises_when_no_match(tmp_path):
    empty_dir = tmp_path / "empty"
    empty_dir.mkdir()

    service = MetadataMappingValidationService(alias_folder=str(empty_dir))
    with pytest.raises(BulkUploadMetadataException, match="No alias configuration matches"):
        service.detect_best_alias_config(["random", "headers"])



def test_build_model_for_alias_creates_dynamic_model(service):
    model_class = service.build_model_for_alias("general")

    instance = model_class(
        file_path="/some/file.pdf",
        gp_practice_code="Y12345",
        nhs_number="1234567890",
        page_count="1",
        section="LG",
        sub_section="",
        scan_date="01/01/2023",
        scan_id="SID",
        user_id="UID",
        upload="01/01/2023",
    )

    assert instance.file_path == "/some/file.pdf"
    assert instance.gp_practice_code == "Y12345"
    assert instance.nhs_number == "1234567890"
    assert isinstance(instance, model_class)


def test_build_model_for_alias_raises_if_file_not_found(service):
    with pytest.raises(FileNotFoundError):
        service.build_model_for_alias("does_not_exist")



def test_validate_and_normalize_metadata_rejects_empty_required_fields(service):
    records = [
        {"FILEPATH": "", "GP-PRACTICE-CODE": "Y123", "NHS-NO": ""},
    ]

    validated, rejected, reasons = service.validate_and_normalize_metadata(records, "general")

    assert len(validated) == 0
    assert len(rejected) == 1
    reason_text = reasons[0]["REASON"]
    assert (
        "Missing or empty required fields" in reason_text
        or "Field required" in reason_text
    )

def test_validate_and_normalize_metadata_with_invalid_record(service):
    records = [
        {
            "FILE": "/file1.pdf",
            "ODS": "Y123",
            "SCAN_DATE": "01/01/2023",
            "UPLOADED": "01/01/2023",
            "PAGE_COUNT": "1",
            "SECTION": "LG",
            "SUB_SECTION": "",
            "SCAN_ID": "SID1",
            "USER_ID": "UID1",
        },
        {
            "FILE": "/file2.pdf",
            "ODS": "Y123",
            "NHS": "1234567890",
            "SCAN_DATE": "01/01/2023",
            "UPLOADED": "01/01/2023",
            "PAGE_COUNT": "1",
            "SECTION": "LG",
            "SUB_SECTION": "",
            "SCAN_ID": "SID2",
            "USER_ID": "UID2",
        },
    ]

    validated, rejected, reasons = service.validate_and_normalize_metadata(records, "general")

    assert len(validated) == 1
    assert len(rejected) == 1
    reason = reasons[0]["REASON"]
    assert "NHS" in reason or "field required" in reason


def test_validate_and_normalize_metadata_calls_build_model(mocker, service):
    mock_model = mocker.MagicMock()
    mocker.patch.object(service, "build_model_for_alias", return_value=mock_model)

    service.validate_and_normalize_metadata([{"x": "y"}], "mock")

    service.build_model_for_alias.assert_called_once_with("mock")
