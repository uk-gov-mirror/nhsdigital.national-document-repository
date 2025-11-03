import io
import json

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
    mock_create = mocker.patch.object(service, "create_dynamic_model", return_value=BaseModel)

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
    model = service.create_dynamic_model(alias_map)
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

    validated, rejected, reasons = service.validate_and_normalize_metadata(records, "general")

    assert len(validated) == 1
    assert len(rejected) == 1
    assert "Missing or empty required fields" in reasons[0]["REASON"]


def test_get_empty_required_fields_detects(service):
    data = {"file_path": "", "gp_practice_code": None, "nhs_number": "123"}
    required = ["file_path", "gp_practice_code", "nhs_number"]
    result = service.get_empty_required_fields(data, required)
    assert set(result) == {"file_path", "gp_practice_code"}
