import json

import pytest
from botocore.exceptions import ClientError
from enums.infrastructure import DynamoTables
from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCode, SnomedCodes
from models.document_reference import DocumentReference
from models.fhir.R4.base_models import Coding, Identifier, Reference
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
from services.put_fhir_document_reference_service import (
    FhirDocumentReferenceServiceBase,
)
from tests.unit.conftest import (
    APIM_API_URL,
)
from tests.unit.conftest import (
    EXPECTED_PARSED_PATIENT_BASE_CASE as mock_pds_patient_details,
)
from tests.unit.helpers.data.bulk_upload.test_data import TEST_DOCUMENT_REFERENCE
from tests.unit.helpers.data.test_documents import (
    create_test_lloyd_george_doc_store_refs,
    create_valid_fhir_doc_json,
)
from utils.exceptions import FhirDocumentReferenceException, PatientNotFoundException
from utils.lambda_exceptions import DocumentRefException


@pytest.fixture
def mock_service(mocker):
    mocker.patch("services.fhir_document_reference_service_base.S3Service")
    mocker.patch("services.fhir_document_reference_service_base.DynamoDBService")

    service = FhirDocumentReferenceServiceBase()

    yield service


@pytest.fixture
def mock_dynamo_service(mocker, mock_service):
    mocker.patch.object(mock_service.dynamo_service, "query_table_by_index")
    mocker.patch.object(mock_service.dynamo_service, "update_item")
    yield mock_service.dynamo_service


@pytest.fixture
def mock_s3_service(mocker, mock_service):
    mocker.patch.object(mock_service.s3_service, "create_object_tag")
    yield mock_service.s3_service


@pytest.fixture
def valid_nhs_number():
    return "9000000009"


@pytest.fixture
def valid_fhir_doc_json(valid_nhs_number):
    return create_valid_fhir_doc_json(valid_nhs_number)


@pytest.fixture
def valid_fhir_doc_object(valid_fhir_doc_json):
    return FhirDocumentReference.model_validate_json(valid_fhir_doc_json)


@pytest.fixture
def mock_document_reference(mocker):
    mocker.patch("services.fhir_document_reference_service_base.DocumentReference")
    yield mocker.Mock(spec=DocumentReference)


@pytest.fixture
def mock_create_s3_presigned_url(mocker, mock_service):
    mocker.patch.object(
        mock_service,
        "_create_s3_presigned_url",
        return_value="https://test-presigned-url.com",
    )
    yield mock_service._create_s3_presigned_url


@pytest.fixture
def mock_save_document_reference_to_dynamo(mocker, mock_service):
    mocker.patch.object(mock_service, "_save_document_reference_to_dynamo")
    yield mock_service._save_document_reference_to_dynamo


@pytest.fixture
def mock_store_binary_in_s3(mocker, mock_service):
    mocker.patch.object(mock_service, "_store_binary_in_s3")
    yield mock_service._store_binary_in_s3


@pytest.mark.parametrize(
    "modify_doc",
    [
        # Missing NHS number (wrong system)
        lambda doc: {
            **doc,
            "type": {"coding": [{"system": "wrong-system", "code": "9000000009"}]},
        },
        # Invalid document type
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
        # Missing document type
        lambda doc: {**doc, "type": {"coding": []}},
    ],
)
def test_document_validation_errors(mock_service, valid_fhir_doc_json, modify_doc):
    """Test validation error scenarios."""
    doc = json.loads(valid_fhir_doc_json)
    modified_doc = FhirDocumentReference(**modify_doc(doc))

    with pytest.raises(FhirDocumentReferenceException):
        mock_service._determine_document_type(modified_doc)


def test_dynamo_error(mock_service, mocker):
    """Test handling of DynamoDB error."""
    mock_service.dynamo_service.create_item.side_effect = ClientError(
        {"Error": {"Code": "InternalServerError", "Message": "Test error"}},
        "CreateItem",
    )

    mock_document = mocker.MagicMock()

    with pytest.raises(FhirDocumentReferenceException):
        mock_service._save_document_reference_to_dynamo("", mock_document)


def test_save_document_reference_to_dynamo_error(mock_service):
    """Test _save_document_reference_to_dynamo method with DynamoDB error."""

    mock_service.dynamo_service.create_item.side_effect = ClientError(
        {"Error": {"Code": "InternalServerError", "Message": "Test error"}},
        "CreateItem",
    )
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

    with pytest.raises(FhirDocumentReferenceException):
        mock_service._save_document_reference_to_dynamo("test-table", document_ref)

    mock_service.dynamo_service.create_item.assert_called_once()


def test_check_nhs_number_with_pds_raise_error(mock_service, mocker):
    """Test handling of PDS error."""
    mock_service_object = mocker.MagicMock()
    mocker.patch(
        "services.fhir_document_reference_service_base.get_pds_service",
        return_value=mock_service_object,
    )
    mock_service_object.fetch_patient_details.side_effect = PatientNotFoundException(
        "test test",
    )
    with pytest.raises(FhirDocumentReferenceException):
        mock_service._check_nhs_number_with_pds("9000000009")


def test_check_nhs_number_with_pds_success(mock_service, mocker):
    """Test successful NHS number validation with PDS."""
    mock_service_object = mocker.MagicMock()
    mocker.patch(
        "services.fhir_document_reference_service_base.get_pds_service",
        return_value=mock_service_object,
    )
    mock_service_object.fetch_patient_details.return_value = mock_pds_patient_details

    # This should not raise an exception
    result = mock_service._check_nhs_number_with_pds("9000000009")

    # Verify the method was called correctly
    mock_service_object.fetch_patient_details.assert_called_once_with("9000000009")
    assert result == mock_pds_patient_details


def test_create_document_reference_with_author(mock_service, mocker):
    """Test _create_document_reference method with author information included."""
    mock_service.staging_bucket_name = "example_staging_bucket_name"

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

    result = mock_service._create_document_reference(
        nhs_number="9000000009",
        doc_type=doc_type,
        fhir_doc=fhir_doc,
        current_gp_ods="C13579",
        version="2",
        s3_file_key="mock_s3_file_key",
    )

    assert result.nhs_number == "9000000009"
    assert result.document_snomed_code_type == "test-code"
    assert result.custodian == "A12345"
    assert result.current_gp_ods == "C13579"
    assert result.author == "B67890"  # Verify author is set
    assert result.version == "2"


def test_create_document_reference_without_custodian(mock_service, mocker):
    """Test _create_document_reference method without custodian information."""
    mock_service.staging_bucket_name = "example_staging_bucket_name"

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
    current_gp_ods = "C13579"

    result = mock_service._create_document_reference(
        nhs_number="9000000009",
        doc_type=doc_type,
        fhir_doc=fhir_doc,
        current_gp_ods=current_gp_ods,
        version="2",
        s3_file_key="mock_s3_file_key",
    )

    assert (
        result.custodian == current_gp_ods
    )  # Custodian should default to current_gp_ods


def test_determine_document_type_with_missing_type(mock_service, mocker):
    """Test _determine_document_type method when type is missing entirely."""
    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.type = None

    with pytest.raises(FhirDocumentReferenceException):
        mock_service._determine_document_type(fhir_doc)


def test_determine_document_type_with_missing_coding(mock_service, mocker):
    """Test _determine_document_type method when coding is missing."""
    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.type = mocker.MagicMock()
    fhir_doc.type.coding = None

    with pytest.raises(FhirDocumentReferenceException):
        mock_service._determine_document_type(fhir_doc)


def test_save_document_reference_to_dynamo_success(mock_service):
    """Test successful save to DynamoDB."""
    document_ref = DocumentReference(
        id="test-id",
        nhs_number="9000000009",
        current_gp_ods="A12345",
        custodian="A12345",
        s3_bucket_name="test-bucket",
        content_type="application/pdf",
        file_name="test-file.pdf",
        document_snomed_code_type="test-code",
        version="2",
    )

    mock_service._save_document_reference_to_dynamo("test-table", document_ref)

    mock_service.dynamo_service.create_item.assert_called()


def test_process_fhir_document_reference_with_invalid_base64_data(mock_service):
    """Test process_fhir_document_reference with invalid base64 data."""
    with pytest.raises(FhirDocumentReferenceException):
        mock_service._store_binary_in_s3(
            TEST_DOCUMENT_REFERENCE,
            b"invalid-base64-data!!!",
        )


def test_determine_document_type_returns_lloyd_george_type(
    mock_service,
    valid_fhir_doc_object,
):
    """Test that determine_document_type returns the lloyd george type for
    a lloyd george document"""
    result = mock_service._determine_document_type(valid_fhir_doc_object)

    assert result == SnomedCodes.LLOYD_GEORGE.value


def test_determine_document_type_non_snomed_coding(
    mock_service,
    valid_fhir_doc_object: FhirDocumentReference,
):
    """Test that determine_document_type returns the lloyd george type for
    a lloyd george document"""
    valid_fhir_doc_object.type.coding.append(
        Coding(system="mocked_system", code="mocked_code", display="mocked_display"),
    )

    valid_fhir_doc_object.type.coding.reverse()

    result = mock_service._determine_document_type(valid_fhir_doc_object)

    assert result == SnomedCodes.LLOYD_GEORGE.value


def test_determine_document_type_non_george_lloyd_code(
    mock_service,
    valid_fhir_doc_object: FhirDocumentReference,
):
    """Test that determine_document_type returns the lloyd george type for
    a lloyd george document"""
    valid_fhir_doc_object.type.coding.append(
        Coding(system=SNOMED_URL, code="mocked_code", display="mocked_display"),
    )

    valid_fhir_doc_object.type.coding.reverse()

    result = mock_service._determine_document_type(valid_fhir_doc_object)

    assert result == SnomedCodes.LLOYD_GEORGE.value


def test_get_document_reference_no_documents_found(mocker, mock_service):
    """Test that get_document_reference raises an error when there are no document results"""
    mock_service.fetch_documents_from_table = mocker.patch(
        "services.fhir_document_reference_service_base.DocumentService.fetch_documents_from_table",
        return_value=[],
    )

    with pytest.raises(FhirDocumentReferenceException):
        mock_service._get_document_reference("", "")


def test_get_document_reference_returns_document_reference(mocker, mock_service):
    """Test that get_document_reference returns the first document reference from the results"""
    documents = create_test_lloyd_george_doc_store_refs()

    mock_service.document_service.fetch_documents_from_table = mocker.patch(
        "services.fhir_document_reference_service_base.DocumentService.fetch_documents_from_table",
        return_value=documents,
    )

    result = mock_service._get_document_reference("", "")

    assert result == documents[0]


def test_create_s3_presigned_url_error(mock_service):
    """Test that create_s3_presigned_url raises a FhirDocumentReferenceException on AWS S3 ClientError"""
    mock_service.s3_service.create_put_presigned_url.side_effect = ClientError(
        {"Error": {}},
        "",
    )
    document = create_test_lloyd_george_doc_store_refs()[0]

    with pytest.raises(FhirDocumentReferenceException):
        mock_service._create_s3_presigned_url(document)


def test_create_s3_presigned_url_returns_url(mock_service):
    """Test that create_s3_presigned_url returns a url"""
    mock_presigned_url_response = "https://test-bucket.s3.amazonaws.com/"
    mock_service.s3_service.create_put_presigned_url.return_value = (
        mock_presigned_url_response
    )
    document = create_test_lloyd_george_doc_store_refs()[0]

    result = mock_service._create_s3_presigned_url(document)

    assert result == mock_presigned_url_response


def test_store_binary_in_s3_success(mock_service, mocker):
    """Test successful binary storage in S3."""
    binary_data = b"SGVsbG8gV29ybGQ="  # Base64 encoded "Hello World"

    mock_service.s3_service.upload_file_obj.return_value = None

    mock_service._store_binary_in_s3(TEST_DOCUMENT_REFERENCE, binary_data)

    mock_service.s3_service.upload_file_obj.assert_called_once_with(
        file_obj=mocker.ANY,
        s3_bucket_name=TEST_DOCUMENT_REFERENCE.s3_bucket_name,
        file_key=TEST_DOCUMENT_REFERENCE.s3_file_key,
    )


def test_store_binary_in_s3_with_client_error(mock_service):
    """Test _store_binary_in_s3 method with S3 ClientError."""
    binary_data = b"SGVsbG8gV29ybGQ="

    mock_service.s3_service.upload_file_obj.side_effect = ClientError(
        {
            "Error": {
                "Code": "NoSuchBucket",
                "Message": "The specified bucket does not exist",
            },
        },
        "PutObject",
    )

    with pytest.raises(FhirDocumentReferenceException):
        mock_service._store_binary_in_s3(TEST_DOCUMENT_REFERENCE, binary_data)


def test_store_binary_in_s3_with_large_binary_data(mock_service):
    """Test _store_binary_in_s3 method with large binary data."""
    # Create a large binary data (8MB)
    binary_data = b"A" * (8 * 1024 * 1024)

    mock_service._store_binary_in_s3(TEST_DOCUMENT_REFERENCE, binary_data)

    mock_service.s3_service.upload_file_obj.assert_called_once()


def test_store_binary_in_s3_on_memory_error(mock_service):
    """Test that store_binary_in_s3 raises FhirDocumentReferenceException when MemoryError is raised"""
    mock_service.s3_service.upload_file_obj.side_effect = MemoryError()
    document = create_test_lloyd_george_doc_store_refs()[0]

    with pytest.raises(FhirDocumentReferenceException):
        mock_service._store_binary_in_s3(document, bytes())


def test_store_binary_in_s3_on_oserror(mock_service):
    """Test that store_binary_in_s3 raises FhirDocumentReferenceException when OSError is raised"""
    mock_service.s3_service.upload_file_obj.side_effect = OSError()
    document = create_test_lloyd_george_doc_store_refs()[0]

    with pytest.raises(FhirDocumentReferenceException):
        mock_service._store_binary_in_s3(document, bytes())


def test_store_binary_in_s3_on_ioerror(mock_service):
    """Test that store_binary_in_s3 raises FhirDocumentReferenceException when IOError is raised"""
    mock_service.s3_service.upload_file_obj.side_effect = IOError()
    document = create_test_lloyd_george_doc_store_refs()[0]

    with pytest.raises(FhirDocumentReferenceException):
        mock_service._store_binary_in_s3(document, bytes())


def test_get_dynamo_table_for_patient_data_doc_type(set_env, mock_service):
    """Test _get_dynamo_table_for_doc_type method with a non-Lloyd George document type."""

    patient_data_code = SnomedCodes.PATIENT_DATA.value

    result = mock_service._get_dynamo_table_for_doc_type(patient_data_code)
    assert result == str(DynamoTables.CORE)


def test_get_dynamo_table_for_unsupported_doc_type(set_env, mock_service):
    """Test _get_dynamo_table_for_doc_type method with a non-Lloyd George document type."""

    non_lg_code = SnomedCode(code="non-lg-code", display_name="Non Lloyd George")

    with pytest.raises(DocumentRefException) as excinfo:
        mock_service._get_dynamo_table_for_doc_type(non_lg_code)

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocTypeDB


def test_get_dynamo_table_for_lloyd_george_doc_type(set_env, mock_service):
    """Test _get_dynamo_table_for_doc_type method with Lloyd George document type."""
    lg_code = SnomedCodes.LLOYD_GEORGE.value

    result = mock_service._get_dynamo_table_for_doc_type(lg_code)

    assert result == str(DynamoTables.LLOYD_GEORGE)


def test_create_fhir_response_with_presigned_url(mock_service, mocker):
    """Test _create_fhir_response method with a presigned URL."""

    mocker.patch.object(
        SnomedCodes,
        "find_by_code",
        return_value=SnomedCodes.LLOYD_GEORGE.value,
    )

    document_ref = DocumentReference(
        id="test-id",
        nhs_number="9000000009",
        current_gp_ods="A12345",
        custodian="A12345",
        s3_bucket_name="test-bucket",
        content_type="application/pdf",
        file_name="test-file.pdf",
        document_snomed_code_type=SnomedCodes.LLOYD_GEORGE.value.code,
        document_scan_creation="2023-01-01T12:00:00Z",
    )
    presigned_url = "https://test-presigned-url.com"

    result = mock_service._create_fhir_response(document_ref, presigned_url)

    result_json = json.loads(result)
    assert result_json["resourceType"] == "DocumentReference"
    assert result_json["content"][0]["attachment"]["url"] == presigned_url


def test_create_fhir_response_without_presigned_url(set_env, mock_service, mocker):
    """Test _create_fhir_response method without a presigned URL (for binary uploads)."""

    mocker.patch.object(
        SnomedCodes,
        "find_by_code",
        return_value=SnomedCodes.LLOYD_GEORGE.value,
    )
    custom_endpoint = f"{APIM_API_URL}/DocumentReference"

    document_ref = DocumentReference(
        id="test-id",
        nhs_number="9000000009",
        current_gp_ods="A12345",
        custodian="A12345",
        s3_bucket_name="test-bucket",
        content_type="application/pdf",
        file_name="test-file.pdf",
        document_snomed_code_type=SnomedCodes.LLOYD_GEORGE.value.code,
        document_scan_creation="2023-01-01T12:00:00Z",
    )

    result = mock_service._create_fhir_response(document_ref, None)

    result_json = json.loads(result)
    assert result_json["resourceType"] == "DocumentReference"
    expected_url = f"{custom_endpoint}/{document_ref.id}"
    assert result_json["content"][0]["attachment"]["url"] == expected_url


def test_handle_document_save_returns_presigned_url(
    set_env,
    mock_service,
    mock_create_s3_presigned_url,
    mock_save_document_reference_to_dynamo,
    valid_fhir_doc_object,
    mock_document_reference,
):
    """Test _handle_document_save method returns presigned URL for Lloyd George document."""

    result = mock_service._handle_document_save(
        mock_document_reference,
        valid_fhir_doc_object,
        "test_table",
    )

    assert result == "https://test-presigned-url.com"


def test_handle_document_save_stores_binary_in_s3(
    set_env,
    mock_service,
    mock_store_binary_in_s3,
    mock_save_document_reference_to_dynamo,
    valid_fhir_doc_object,
    mock_document_reference,
):
    valid_fhir_doc_object.content[0].attachment.data = "SGVsbG8gV29ybGQ="
    result = mock_service._handle_document_save(
        mock_document_reference,
        valid_fhir_doc_object,
        "test_table",
    )
    assert result is None
    mock_service._store_binary_in_s3.assert_called_once()


def test_handle_document_save_store_binary_in_s3_failure(
    mock_service,
    mocker,
    mock_document_reference,
    valid_fhir_doc_object,
    mock_save_document_reference_to_dynamo,
):
    valid_fhir_doc_object.content[0].attachment.data = "SGVsbG8gV29ybGQ="
    mocker.patch.object(
        mock_service,
        "_store_binary_in_s3",
        side_effect=FhirDocumentReferenceException("Failed to store binary in S3"),
    )

    with pytest.raises(DocumentRefException) as excinfo:
        mock_service._handle_document_save(
            mock_document_reference,
            valid_fhir_doc_object,
            "test_table",
        )

    assert excinfo.value.status_code == 500
    assert excinfo.value.error == LambdaError.DocRefNoParse
    mock_service._store_binary_in_s3.assert_called_once()
    mock_save_document_reference_to_dynamo.assert_not_called()


def test_handle_document_save_create_s3_failure(
    set_env,
    mock_service,
    mocker,
    mock_save_document_reference_to_dynamo,
    valid_fhir_doc_object,
    mock_document_reference,
):
    """Test _handle_document_save method raises FhirDocumentReferenceException when S3 presigned URL creation fails."""

    mocker.patch.object(
        mock_service,
        "_create_s3_presigned_url",
        side_effect=FhirDocumentReferenceException("Failed to create presigned URL"),
    )

    with pytest.raises(DocumentRefException) as excinfo:
        mock_service._handle_document_save(
            mock_document_reference,
            valid_fhir_doc_object,
            "test_table",
        )

    assert excinfo.value.status_code == 500
    assert excinfo.value.error == LambdaError.InternalServerError
    mock_service._create_s3_presigned_url.assert_called_once()
    mock_save_document_reference_to_dynamo.assert_not_called()


def test_save_document_reference_to_dynamo_failure(
    mock_service,
    mocker,
    valid_fhir_doc_object,
    mock_create_s3_presigned_url,
    mock_document_reference,
):
    """Test _handle_document_save method raises FhirDocumentReferenceException when saving to DynamoDB fails."""

    mocker.patch.object(
        mock_service,
        "_save_document_reference_to_dynamo",
        side_effect=FhirDocumentReferenceException("Failed to save to DynamoDB"),
    )

    with pytest.raises(DocumentRefException) as excinfo:
        mock_service._handle_document_save(
            mock_document_reference,
            valid_fhir_doc_object,
            "test_table",
        )

    assert excinfo.value.status_code == 500
    assert excinfo.value.error == LambdaError.DocRefUploadInternalError
    mock_service._save_document_reference_to_dynamo.assert_called_once()
