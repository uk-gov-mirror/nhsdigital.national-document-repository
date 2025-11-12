import pytest
from models.staging_metadata import MetadataFile
from pydantic import BaseModel
from services.metadata_mapping_validator_service import MetadataMappingValidatorService


@pytest.fixture
def service():
    """Create service with injected mocked S3."""
    service = MetadataMappingValidatorService()
    return service


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

    mocker.patch.object(service, "create_metadata_model", return_value=FakeModel)

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

    mocker.patch.object(service, "create_metadata_model", return_value=FakeModel)

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
