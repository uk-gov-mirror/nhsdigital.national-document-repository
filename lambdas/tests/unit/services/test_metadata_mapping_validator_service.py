import pytest
from models.staging_metadata import MetadataFile
from pydantic import BaseModel
from services.metadata_mapping_validator_service import MetadataMappingValidatorService
from utils.exceptions import BulkUploadMetadataException


@pytest.fixture
def service():
    """Create service with injected mocked S3."""
    service = MetadataMappingValidatorService()
    return service


def test_build_model_for_alias_calls_expected_methods(mocker, service):
    mock_validate = mocker.patch.object(service, "validate_alias_map")
    mock_create = mocker.patch.object(
        service, "create_metadata_model", return_value=BaseModel
    )

    result = service.build_model_for_alias("general")
    assert result == BaseModel
    mock_validate.assert_called_once()
    mock_create.assert_called_once()


def test_validate_alias_map_raises_when_keys_missing(service):
    alias_map = {"file_path": "FILE"}
    with pytest.raises(BulkUploadMetadataException, match="missing mappings"):
        service.validate_alias_map(alias_map)


def test_create_dynamic_model_builds_pydantic_model(service):
    alias_map = {k: k.upper() for k in MetadataFile.model_fields.keys()}
    model = service.create_metadata_model(alias_map)
    assert issubclass(model, BaseModel)
    assert "file_path" in model.model_fields


def test_validate_and_normalize_metadata_mixed_results(mocker, service):
    class FakeModel(BaseModel):
        file_path: str
        scan_date: str
        gp_practice_code: str
        nhs_number: str

    mocker.patch.object(service, "build_model_for_alias", return_value=FakeModel)

    records = [
        {
            "file_path": "valid.pdf",
            "scan_date": "01/01/1970",
            "gp_practice_code": "A12345",
            "nhs_number": "1234567890",
        },
        {
            "file_path": "",
            "scan_date": "01/01/1970",
            "gp_practice_code": "A12345",
            "nhs_number": "1234567890",
        },
        {"file_path": "", "gp_practice_code": "A12345", "nhs_number": "1234567890"},
    ]

    validated, rejected, reasons = service.validate_and_normalize_metadata(records, {})

    assert len(validated) == 1
    assert len(rejected) == 2
    assert "Missing or empty required fields" in reasons[0]["REASON"]


def test_validate_and_normalize_metadata_missing_type(mocker, service):
    class FakeModel(BaseModel):
        file_path: str
        scan_date: str
        gp_practice_code: str

    mocker.patch.object(service, "build_model_for_alias", return_value=FakeModel)

    records = [
        {
            "file_path": "valid.pdf",
            "scan_date": "01/01/1970",
            "gp_practice_code": "A12345",
        },
    ]

    validated, rejected, reasons = service.validate_and_normalize_metadata(records, {})

    assert len(validated) == 0
    assert len(rejected) == 1
    assert "Missing or empty required fields" in reasons[0]["REASON"]
