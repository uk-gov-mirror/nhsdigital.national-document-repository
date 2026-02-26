import json

import pytest
from botocore.exceptions import ClientError

from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCode, SnomedCodes
from models.document_reference import DocumentReference
from models.fhir.R4.base_models import CodeableConcept, Identifier, Reference
from models.fhir.R4.fhir_document_reference import (
    SNOMED_URL,
    Attachment,
)
from models.fhir.R4.fhir_document_reference import (
    DocumentReference as FhirDocumentReference,
)
from models.fhir.R4.fhir_document_reference import (
    DocumentReferenceContent,
)
from services.fhir_document_reference_service_base import (
    FhirDocumentReferenceServiceBase,
)
from services.post_fhir_document_reference_service import (
    PostFhirDocumentReferenceService,
)
from tests.unit.conftest import (
    APIM_API_URL,
)
from tests.unit.conftest import (
    EXPECTED_PARSED_PATIENT_BASE_CASE as mock_pds_patient_details,
)
from tests.unit.conftest import (
    MOCK_LG_TABLE_NAME,
    TEST_UUID,
)
from utils.exceptions import FhirDocumentReferenceException
from utils.lambda_exceptions import DocumentRefException
from utils.request_context import request_context


@pytest.fixture
def mock_post_fhir_doc_ref_service(set_env):
    service = PostFhirDocumentReferenceService()
    yield service


@pytest.fixture
def mock_fhir_doc_ref_base_service(mocker, setup_request_context):
    mock_document_service = mocker.patch(
        "services.fhir_document_reference_service_base.DocumentService",
    )
    mock_s3_service = mocker.patch(
        "services.fhir_document_reference_service_base.S3Service",
    )
    mock_dynamo_service = mocker.patch(
        "services.fhir_document_reference_service_base.DynamoDBService",
    )
    mock_doc_type_table_router = mocker.patch(
        "services.fhir_document_reference_service_base.DocTypeTableRouter",
    )
    service = FhirDocumentReferenceServiceBase()
    service.document_service = mock_document_service.return_value
    service.s3_service = mock_s3_service.return_value
    service.dynamo_service = mock_dynamo_service.return_value
    service.doc_router = mock_doc_type_table_router.return_value
    yield service


@pytest.fixture
def setup_request_context():
    request_context.authorization = {
        "ndr_session_id": TEST_UUID,
        "nhs_user_id": "test-user-id",
        "selected_organisation": {"org_ods_code": "test-ods-code"},
    }
    yield
    request_context.authorization = {}


@pytest.fixture
def mock_check_nhs_number_with_pds(mock_post_fhir_doc_ref_service, mocker):
    return mocker.patch.object(
        mock_post_fhir_doc_ref_service,
        "_check_nhs_number_with_pds",
        return_value=mock_pds_patient_details,
    )


@pytest.fixture
def mock_get_dynamo_table_for_doc_type(mock_post_fhir_doc_ref_service, mocker):
    return mocker.patch.object(
        mock_post_fhir_doc_ref_service,
        "_get_dynamo_table_for_doc_type",
        return_value=MOCK_LG_TABLE_NAME,
    )


@pytest.fixture
def mock_handle_document_save(mock_post_fhir_doc_ref_service, mocker):
    return mocker.patch.object(mock_post_fhir_doc_ref_service, "_handle_document_save")


@pytest.fixture
def valid_fhir_doc_json():
    return json.dumps(
        {
            "resourceType": "DocumentReference",
            "docStatus": "final",
            "status": "current",
            "subject": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/nhs-number",
                    "value": "9000000009",
                },
            },
            "type": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": SnomedCodes.LLOYD_GEORGE.value.code,
                        "display": SnomedCodes.LLOYD_GEORGE.value.display_name,
                    },
                ],
            },
            "custodian": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": "A12345",
                },
            },
            "author": [
                {
                    "identifier": {
                        "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                        "value": "A12345",
                    },
                },
            ],
            "content": [
                {
                    "attachment": {
                        "contentType": "application/pdf",
                        "language": "en-GB",
                        "title": "test-file.pdf",
                        "creation": "2023-01-01T12:00:00Z",
                    },
                },
            ],
        },
    )


@pytest.fixture
def valid_fhir_doc_object(valid_fhir_doc_json):
    return FhirDocumentReference.model_validate_json(valid_fhir_doc_json)


@pytest.fixture
def valid_fhir_doc_with_binary(valid_fhir_doc_json):
    doc = json.loads(valid_fhir_doc_json)
    doc["content"][0]["attachment"][
        "data"
    ] = "SGVsbG8gV29ybGQ="  # Base64 encoded "Hello World"
    return json.dumps(doc)


def test_process_fhir_document_reference_with_presigned_url(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    valid_fhir_doc_json,
    mock_check_nhs_number_with_pds,
    mock_get_dynamo_table_for_doc_type,
    mock_handle_document_save,
    mock_uuid,
):
    mock_presigned_url_response = "https://test-bucket.s3.amazonaws.com/"
    mock_handle_document_save.return_value = mock_presigned_url_response

    json_result, document_id = (
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            valid_fhir_doc_json,
        )
    )
    expected_pre_sign_url = mock_presigned_url_response
    expected_document_id = TEST_UUID

    assert isinstance(json_result, str)
    result_json = json.loads(json_result)
    assert result_json["resourceType"] == "DocumentReference"
    assert result_json["content"][0]["attachment"]["url"] == expected_pre_sign_url
    assert document_id == expected_document_id


def test_process_fhir_document_reference_with_binary(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    valid_fhir_doc_with_binary,
    mock_check_nhs_number_with_pds,
    mock_get_dynamo_table_for_doc_type,
    mock_handle_document_save,
    mock_uuid,
):
    """Test a happy path with binary data in the request."""
    mock_handle_document_save.return_value = None
    json_result, document_id = (
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            valid_fhir_doc_with_binary,
        )
    )
    expected_document_id = TEST_UUID

    assert isinstance(json_result, str)
    result_json = json.loads(json_result)
    assert result_json["resourceType"] == "DocumentReference"
    attachment_url = result_json["content"][0]["attachment"]["url"]
    assert f"{APIM_API_URL}/DocumentReference" in attachment_url
    assert document_id == expected_document_id


def test_validation_error(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
):
    """Test handling of an invalid FHIR document."""
    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference("{invalid json}")

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefNoParse


@pytest.mark.parametrize(
    "nhs_number,expected_error_message",
    [
        (
            "9999999993",
            "Failed to parse document upload request data: Invalid NHS number format",
        ),
        (
            "123",
            "Failed to parse document upload request data: Invalid NHS number length",
        ),
    ],
)
def test_doc_ref_no_parse_message_includes_details_format(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    valid_fhir_doc_json,
    nhs_number,
    expected_error_message,
):
    """Test handling of DocRefNoParse with specific NHS number errors."""
    doc = json.loads(valid_fhir_doc_json)
    doc["subject"]["identifier"]["value"] = nhs_number
    invalid_nhs_doc_json = json.dumps(doc)

    with pytest.raises(DocumentRefException) as error:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            invalid_nhs_doc_json,
        )

    assert error.value.status_code == 400
    assert error.value.error == LambdaError.DocRefNoParse

    body_json = error.value.error.create_error_body(details=error.value.details)
    payload = json.loads(body_json)

    assert payload["err_code"] == "DR_4005"
    assert payload["message"] == expected_error_message


@pytest.mark.parametrize(
    "modify_doc, expected_error",
    [
        # Missing NHS number (wrong system)
        (
            lambda doc: {
                **doc,
                "type": {"coding": [{"system": "wrong-system", "code": "9000000009"}]},
            },
            LambdaError.DocRefInvalidType,
        ),
        # Invalid document type
        (
            lambda doc: {
                **doc,
                "type": {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "invalid-code",
                            "display": "Invalid",
                        },
                    ],
                },
            },
            LambdaError.DocRefInvalidType,
        ),
        # Missing document type
        (lambda doc: {**doc, "type": {"coding": []}}, LambdaError.DocRefInvalidType),
    ],
)
def test_document_validation_errors(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    valid_fhir_doc_json,
    modify_doc,
    expected_error,
):
    """Test validation error scenarios."""
    doc = json.loads(valid_fhir_doc_json)
    modified_doc = FhirDocumentReference(**modify_doc(doc))

    with pytest.raises(DocumentRefException) as e:
        mock_post_fhir_doc_ref_service._determine_document_type(modified_doc, None)

    assert e.value.status_code == 400
    assert e.value.error == expected_error


def test_raise_dynamo_error(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    valid_fhir_doc_json,
):
    """Test handling of DynamoDB error."""
    mock_fhir_doc_ref_base_service.dynamo_service.create_item.side_effect = ClientError(
        {"Error": {"Code": "InternalServerError", "Message": "Test error"}},
        "CreateItem",
    )

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            valid_fhir_doc_json,
        )

    assert excinfo.value.status_code == 500
    assert excinfo.value.error == LambdaError.DocRefUploadInternalError


def test_save_document_reference_to_dynamo_error(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
    valid_fhir_doc_object,
):
    """Test _save_document_reference_to_dynamo method with DynamoDB error."""

    mock_fhir_doc_ref_base_service.dynamo_service.create_item.side_effect = ClientError(
        {"Error": {"Code": "InternalServerError", "Message": "Test error"}},
        "CreateItem",
    )
    mock_fhir_doc_ref_base_service._create_s3_presigned_url = mocker.MagicMock()

    document_ref = DocumentReference(
        id="test-id",
        nhs_number="9000000009",
        current_gp_ods="A12345",
        custodian="A12345",
        s3_bucket_name="test-bucket",
        content_type="application/pdf",
        file_name="test-file.pdf",
        document_snomed_code_type="test-code",
    )

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service._handle_document_save(
            document_ref,
            valid_fhir_doc_object,
            "test_table",
        )

    assert excinfo.value.status_code == 500
    assert excinfo.value.error == LambdaError.DocRefUploadInternalError

    mock_fhir_doc_ref_base_service.dynamo_service.create_item.assert_called_once()


def test_process_fhir_document_reference_with_pds_error(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    valid_fhir_doc_json,
    mock_check_nhs_number_with_pds,
):
    """Test process_fhir_document_reference with a real PDS error (PatientNotFoundException)."""

    mock_check_nhs_number_with_pds.side_effect = FhirDocumentReferenceException(
        "Patient not found",
    )

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            valid_fhir_doc_json,
        )

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefPatientSearchInvalid


def test_s3_presigned_url_error(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    valid_fhir_doc_json,
):
    """Test handling of S3 presigned URL error."""
    mock_fhir_doc_ref_base_service.s3_service.create_put_presigned_url.side_effect = (
        ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "Test error"}},
            "CreatePresignedUrl",
        )
    )

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            valid_fhir_doc_json,
        )

    assert excinfo.value.status_code == 500
    assert excinfo.value.error == LambdaError.InternalServerError


def test_s3_upload_error(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    valid_fhir_doc_with_binary,
):
    """Test handling of S3 upload error."""
    mock_fhir_doc_ref_base_service.s3_service.upload_file_obj.side_effect = ClientError(
        {"Error": {"Code": "InternalServerError", "Message": "Test error"}},
        "PutObject",
    )

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            valid_fhir_doc_with_binary,
        )

    assert excinfo.value.status_code == 500
    assert excinfo.value.error == LambdaError.DocRefNoParse


def test_extract_nhs_number_from_fhir_with_invalid_system(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
    valid_fhir_doc_object,
):
    """Test _extract_nhs_number_from_fhir method with an invalid NHS number system."""

    valid_fhir_doc_object.subject = Reference(
        identifier=Identifier(system="invalid-system", value="9000000009"),
    )

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            valid_fhir_doc_object.model_dump_json(),
        )

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefNoParse


def test_extract_nhs_number_from_fhir_with_missing_identifier(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
    valid_fhir_doc_object,
):
    """Test _extract_nhs_number_from_fhir method when identifier is missing."""
    valid_fhir_doc_object.subject = Reference(identifier=None)

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            valid_fhir_doc_object.model_dump_json(),
        )

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefNoParse


def test_create_document_reference_with_author(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _create_document_reference method with author information included."""

    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.content = [
        DocumentReferenceContent(
            attachment=Attachment(
                contentType="application/pdf",
                title="test-file.pdf",
                creation="2023-01-01T12:00:00Z",
            ),
        ),
    ]
    fhir_doc.custodian = Reference(
        identifier=Identifier(
            system="https://fhir.nhs.uk/Id/ods-organization-code",
            value="A12345",
        ),
    )
    fhir_doc.author = [
        Reference(
            identifier=Identifier(
                system="https://fhir.nhs.uk/Id/ods-organization-code",
                value="B67890",
            ),
        ),
    ]

    doc_type = SnomedCode(code="test-code", display_name="Test Type")

    result = mock_post_fhir_doc_ref_service._create_document_reference(
        nhs_number="9000000009",
        author="B67890",
        doc_type=doc_type,
        fhir_doc=fhir_doc,
        current_gp_ods="C13579",
        raw_fhir_doc=json.dumps({"foo": "bar"}),
    )

    assert result.nhs_number == "9000000009"
    assert result.document_snomed_code_type == "test-code"
    assert result.custodian == "A12345"
    assert result.current_gp_ods == "C13579"
    assert result.author == "B67890"  # Verify author is set


def test_create_document_reference_without_custodian(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _create_document_reference method without custodian information."""

    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.content = [
        DocumentReferenceContent(
            attachment=Attachment(
                contentType="application/pdf",
                title="test-file.pdf",
                creation="2023-01-01T12:00:00Z",
            ),
        ),
    ]
    fhir_doc.author = [
        Reference(
            identifier=Identifier(
                system="https://fhir.nhs.uk/Id/ods-organization-code",
                value="B67890",
            ),
        ),
    ]
    fhir_doc.custodian = None

    doc_type = SnomedCode(code="test-code", display_name="Test Type")
    current_gp_ods = "REST"

    result = mock_post_fhir_doc_ref_service._create_document_reference(
        nhs_number="9000000009",
        author="B67890",
        doc_type=doc_type,
        fhir_doc=fhir_doc,
        current_gp_ods=current_gp_ods,
        raw_fhir_doc=json.dumps({"foo": "bar"}),
    )

    assert result.custodian == current_gp_ods


@pytest.mark.parametrize(
    "fhir_author,expected_author",
    [
        (
            [
                Reference(
                    identifier=Identifier(
                        system="https://fhir.nhs.uk/Id/ods-organization-code",
                        value="A12345",
                    ),
                ),
            ],
            "A12345",
        ),
        (
            [],
            None,
        ),
        (
            None,
            None,
        ),
    ],
)
def test_extract_author_from_fhir(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
    fhir_author,
    expected_author,
):
    """Test _extract_author_from_fhir method when author."""
    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.author = fhir_author
    author = mock_post_fhir_doc_ref_service._extract_author_from_fhir(fhir_doc)
    assert author == expected_author


@pytest.mark.parametrize(
    "fhir_author",
    [
        (
            [
                Reference(
                    identifier=Identifier(
                        system="https://fhir.nhs.uk/Id/ods-organization-code",
                    ),
                ),
            ]
        ),
        ([Reference(identifier=None)]),
    ],
)
def test_extract_author_from_fhir_raises_error(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
    fhir_author,
):
    """Test _extract_author_from_fhir method with malformed json returns Validation errors."""
    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.author = fhir_author
    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service._extract_author_from_fhir(fhir_doc)

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefNoParse


def test_determine_document_type_with_missing_type(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _determine_document_type method when type is missing entirely."""
    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.type = None

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service._determine_document_type(fhir_doc, None)

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefInvalidType


def test_determine_document_type_with_unknown_config(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _determine_document_type method when type is missing entirely."""
    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    mock_coding = [
        {
            "system": SNOMED_URL,
            "code": "1234567890",
            "display": "unknown code",
        },
    ]
    fhir_doc.type = CodeableConcept(coding=mock_coding)

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service._determine_document_type(fhir_doc, None)

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefInvalidType


def test_determine_document_type_with_missing_coding(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _determine_document_type method when coding is missing."""
    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.type = mocker.MagicMock()
    fhir_doc.type.coding = None

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service._determine_document_type(fhir_doc, None)

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefInvalidType


def test_process_fhir_document_reference_with_malformed_json(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
):
    """Test process_fhir_document_reference with malformed JSON."""
    malformed_json = '{"resourceType": "DocumentReference", "invalid": }'

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(malformed_json)

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefNoParse


def test_process_fhir_document_reference_with_empty_string(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
):
    """Test process_fhir_document_reference with an empty string."""
    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference("")

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefNoParse


def test_process_fhir_document_reference_with_none(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
):
    """Test process_fhir_document_reference with None input."""
    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(None)

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefNoParse


def test_create_lg_document_reference_without_content_raises_error(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _create_document_reference method without content attachment raises error."""

    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.content = None

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(fhir_doc)

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefNoParse
    assert excinfo.value.message == "Failed to parse document upload request data"


def test_s3_file_key_for_lg(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _create_document_reference method without custodian information."""

    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.content = [
        DocumentReferenceContent(
            attachment=Attachment(
                contentType="application/pdf",
                title="test-file.pdf",
                creation="2023-01-01T12:00:00Z",
            ),
        ),
    ]
    fhir_doc.author = [
        Reference(
            identifier=Identifier(
                system="https://fhir.nhs.uk/Id/ods-organization-code",
                value="B67890",
            ),
        ),
    ]
    fhir_doc.custodian = None

    doc_type = SnomedCodes.LLOYD_GEORGE.value
    current_gp_ods = "C13579"

    result = mock_post_fhir_doc_ref_service._create_document_reference(
        nhs_number="9000000009",
        author="B67890",
        doc_type=doc_type,
        fhir_doc=fhir_doc,
        current_gp_ods=current_gp_ods,
        raw_fhir_doc=json.dumps({"foo": "bar"}),
    )

    assert "user_upload/9000000009" in result.s3_upload_key
    assert f"9000000009/{result.id}" in result.s3_file_key
    assert result.sub_folder == "user_upload"


def test_create_lg_document_reference_without_title_raises_error(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _create_document_reference method without title information raises error."""

    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.content = [
        DocumentReferenceContent(
            attachment=Attachment(
                contentType="application/pdf",
                creation="2023-01-01T12:00:00Z",
            ),
        ),
    ]
    fhir_doc.author = [
        Reference(
            identifier=Identifier(
                system="https://fhir.nhs.uk/Id/ods-organization-code",
                value="B67890",
            ),
        ),
    ]
    fhir_doc.custodian = None

    doc_type = SnomedCodes.LLOYD_GEORGE.value
    current_gp_ods = "C13579"

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service._create_document_reference(
            nhs_number="9000000009",
            author="B67890",
            doc_type=doc_type,
            fhir_doc=fhir_doc,
            current_gp_ods=current_gp_ods,
            raw_fhir_doc=json.dumps({"foo": "bar"}),
        )

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefNoParse
    assert excinfo.value.message == "Failed to parse document upload request data"
