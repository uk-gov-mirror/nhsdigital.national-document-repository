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

    validated, rejected, reasons = service.validate_and_normalize_metadata(
        records, {}, {}
    )

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

    validated, rejected, reasons = service.validate_and_normalize_metadata(
        records, {}, {}
    )

    assert len(validated) == 0
    assert len(rejected) == 1
    assert "Missing or empty required fields" in reasons[0]["REASON"]


def test_validate_fixed_values_no_fixed_values(service):
    is_valid, errors = service.validate_fixed_values({}, {})
    assert is_valid is True
    assert errors == []


def test_validate_fixed_values_valid_fixed_values(service):
    fixed_values = {"SECTION": "AR", "SCAN-DATE": "01/01/1970"}
    remappings = {"NHS-NO": "PatientID"}

    is_valid, errors = service.validate_fixed_values(fixed_values, remappings)

    assert is_valid is True
    assert errors == []


def test_validate_fixed_values_using_remapped_field_name(service):
    fixed_values = {"PatientID": "1234567890"}
    remappings = {"NHS-NO": "PatientID"}

    with pytest.raises(BulkUploadMetadataException) as exc_info:
        service.validate_fixed_values(fixed_values, remappings)

    errors = exc_info.value.args[0]
    assert len(errors) == 1
    assert "PatientID" in errors[0]
    assert "remapped value" in errors[0]


def test_validate_fixed_values_conflicting_with_remapped_fields(service):
    fixed_values = {"SCAN-DATE": "01/01/2023", "SECTION": "AR"}
    remappings = {"SCAN-DATE": "ScanDate"}

    with pytest.raises(BulkUploadMetadataException) as exc_info:
        service.validate_fixed_values(fixed_values, remappings)

    errors = exc_info.value.args[0]
    assert len(errors) == 1
    assert "SCAN-DATE" in errors[0]
    assert "cannot be applied to remapped fields" in errors[0]


def test_validate_fixed_values_invalid_alias(service):
    fixed_values = {"INVALID_FIELD": "some_value"}
    remappings = {}

    with pytest.raises(BulkUploadMetadataException) as exc_info:
        service.validate_fixed_values(fixed_values, remappings)

    errors = exc_info.value.args[0]
    assert len(errors) == 1
    assert "INVALID_FIELD" in errors[0]
    assert "not a valid metadata field alias" in errors[0]


def test_validate_fixed_values_multiple_errors(service):
    fixed_values = {
        "PatientID": "1234567890",  # Remapped value
        "SCAN-DATE": "01/01/2023",  # Conflicts with remapping
        "INVALID": "value",  # Invalid alias
    }
    remappings = {"SCAN-DATE": "PatientID"}

    with pytest.raises(BulkUploadMetadataException) as exc_info:
        service.validate_fixed_values(fixed_values, remappings)

    errors = exc_info.value.args[0]
    assert len(errors) == 3
    assert any("PatientID" in err and "remapped value" in err for err in errors)
    assert any("SCAN-DATE" in err and "remapped fields" in err for err in errors)
    assert any("INVALID" in err and "not a valid" in err for err in errors)


def test_validate_fixed_values_protected_field_filepath(service):
    fixed_values = {"FILEPATH": "/fixed/path.pdf"}
    remappings = {}

    with pytest.raises(BulkUploadMetadataException) as exc_info:
        service.validate_fixed_values(fixed_values, remappings)

    errors = exc_info.value.args[0]
    assert len(errors) == 1
    assert "FILEPATH" in errors[0]
    assert "Protected fields" in errors[0]
    assert "critical identifiers" in errors[0]


def test_validate_fixed_values_protected_field_nhs_no(service):
    fixed_values = {"NHS-NO": "1234567890"}
    remappings = {}

    with pytest.raises(BulkUploadMetadataException) as exc_info:
        service.validate_fixed_values(fixed_values, remappings)

    errors = exc_info.value.args[0]
    assert len(errors) == 1
    assert "NHS-NO" in errors[0]
    assert "Protected fields" in errors[0]


def test_validate_fixed_values_multiple_protected_fields(service):
    fixed_values = {"FILEPATH": "/path.pdf", "NHS-NO": "1234567890", "SECTION": "AR"}
    remappings = {}

    with pytest.raises(BulkUploadMetadataException) as exc_info:
        service.validate_fixed_values(fixed_values, remappings)

    errors = exc_info.value.args[0]
    assert len(errors) == 1
    assert "FILEPATH" in errors[0] and "NHS-NO" in errors[0]
    assert "Protected fields" in errors[0]


def test_check_for_protected_fields_no_protected_fields(service):
    fixed_values = {"SECTION": "AR", "SCAN-DATE": "01/01/2023"}

    errors = service.check_for_protected_fields(fixed_values)

    assert errors == []


def test_check_for_protected_fields_single_protected_field(service):
    fixed_values = {"FILEPATH": "/path.pdf"}

    errors = service.check_for_protected_fields(fixed_values)

    assert len(errors) == 1
    assert "FILEPATH" in errors[0]


def test_check_for_protected_fields_multiple_protected_fields(service):
    fixed_values = {"FILEPATH": "/path.pdf", "NHS-NO": "1234567890"}

    errors = service.check_for_protected_fields(fixed_values)

    assert len(errors) == 1
    assert "FILEPATH" in errors[0] and "NHS-NO" in errors[0]


def test_check_for_remapped_field_names_no_remapped_values(service):
    fixed_values = {"SECTION": "AR"}
    remappings = {"NHS-NO": "PatientID"}

    errors = service.check_for_remapped_field_names(fixed_values, remappings)

    assert errors == []


def test_check_for_remapped_field_names_with_remapped_value(service):
    fixed_values = {"PatientID": "1234567890"}
    remappings = {"NHS-NO": "PatientID"}

    errors = service.check_for_remapped_field_names(fixed_values, remappings)

    assert len(errors) == 1
    assert "PatientID" in errors[0]
    assert "remapped value" in errors[0]


def test_check_for_remapping_conflicts_no_conflicts(service):
    fixed_values = {"SECTION": "AR", "SCAN-DATE": "01/01/2023"}
    remappings = {"NHS-NO": "PatientID"}

    errors = service.check_for_remapping_conflicts(fixed_values, remappings)

    assert errors == []


def test_check_for_remapping_conflicts_with_conflict(service):
    fixed_values = {"SCAN-DATE": "01/01/2023", "SECTION": "AR"}
    remappings = {"SCAN-DATE": "PatientID"}

    errors = service.check_for_remapping_conflicts(fixed_values, remappings)

    assert len(errors) == 1
    assert "SCAN-DATE" in errors[0]
    assert "remapped fields" in errors[0]


def test_check_for_remapping_conflicts_multiple_conflicts(service):
    fixed_values = {"NHS-NO": "1234567890", "SCAN-DATE": "01/01/2023"}
    remappings = {"NHS-NO": "PatientID", "SCAN-DATE": "ScanDate"}

    errors = service.check_for_remapping_conflicts(fixed_values, remappings)

    assert len(errors) == 1
    assert "NHS-NO" in errors[0] and "SCAN-DATE" in errors[0]


def test_check_for_valid_aliases_all_valid(service):
    fixed_values = {"SECTION": "AR", "SCAN-DATE": "01/01/2023"}
    remappings = {}

    errors = service.check_for_valid_aliases(fixed_values, remappings)

    assert errors == []


def test_check_for_valid_aliases_invalid_alias(service):
    fixed_values = {"INVALID_FIELD": "value"}
    remappings = {}

    errors = service.check_for_valid_aliases(fixed_values, remappings)

    assert len(errors) == 1
    assert "INVALID_FIELD" in errors[0]
    assert "not a valid metadata field alias" in errors[0]


def test_check_for_valid_aliases_skips_remapped_values(service):
    # PatientID is a remapped value, so it should be skipped in this check
    fixed_values = {"PatientID": "1234567890"}
    remappings = {"NHS-NO": "PatientID"}

    errors = service.check_for_valid_aliases(fixed_values, remappings)

    assert errors == []  # Should be empty because remapped values are skipped
