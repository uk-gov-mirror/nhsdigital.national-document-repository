import pytest
from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCode, SnomedCodes
from services.get_fhir_document_reference_service import GetFhirDocumentReferenceService
from tests.unit.conftest import MOCK_PDM_TABLE_NAME, MOCK_LG_TABLE_NAME
from tests.unit.helpers.data.test_documents import create_test_doc_store_refs
from utils.lambda_exceptions import (
    GetFhirDocumentReferenceException,
    InvalidDocTypeException,
)


@pytest.fixture
def patched_service(mocker, set_env, context):
    mocker.patch("services.base.s3_service.IAMService")
    mocker.patch("services.get_fhir_document_reference_service.S3Service")
    mocker.patch("services.get_fhir_document_reference_service.SSMService")
    mocker.patch("services.get_fhir_document_reference_service.DocumentService")
    service = GetFhirDocumentReferenceService()

    yield service


def test_get_document_reference_service(patched_service):
    documents = create_test_doc_store_refs()
    patched_service.document_service.fetch_documents_from_table.return_value = documents

    actual = patched_service.get_document_references(
        "3d8683b9-1665-40d2-8499-6e8302d507ff", MOCK_PDM_TABLE_NAME
    )
    assert actual == documents[0]


def test_handle_get_document_reference_request(patched_service, mocker, set_env):
    documents = create_test_doc_store_refs()

    expected = documents[0]
    mock_document_ref = documents[0]
    mocker.patch.object(
        patched_service, "get_document_references", return_value=mock_document_ref
    )

    actual = patched_service.handle_get_document_reference_request(
        SnomedCodes.PATIENT_DATA.value.code, "test-id"
    )

    assert expected == actual


def test_get_dynamo_table_for_patient_data_doc_type(patched_service):
    """Test _get_dynamo_table_for_doc_type method with a non-Lloyd George document type."""

    patient_data_code = SnomedCodes.PATIENT_DATA.value

    result = patched_service._get_dynamo_table_for_doc_type(patient_data_code)
    assert result == MOCK_PDM_TABLE_NAME


# Not PDM however the code that this relates to was introduced because of PDM
def test_get_dynamo_table_for_unsupported_doc_type(patched_service):
    """Test _get_dynamo_table_for_doc_type method with a non-Lloyd George document type."""

    non_lg_code = SnomedCode(code="non-lg-code", display_name="Non Lloyd George")

    with pytest.raises(InvalidDocTypeException) as excinfo:
        patched_service._get_dynamo_table_for_doc_type(non_lg_code)

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocTypeDB


# Not PDM however the code that this relates to was introduced because of PDM
def test_get_dynamo_table_for_lloyd_george_doc_type(patched_service):
    """Test _get_dynamo_table_for_doc_type method with Lloyd George document type."""
    lg_code = SnomedCodes.LLOYD_GEORGE.value

    result = patched_service._get_dynamo_table_for_doc_type(lg_code)

    assert result == MOCK_LG_TABLE_NAME


def test_get_document_references_empty_result(patched_service):
    # Test when no documents are found
    patched_service.document_service.fetch_documents_from_table.return_value = []

    with pytest.raises(GetFhirDocumentReferenceException) as exc_info:
        patched_service.get_document_references("test-id", MOCK_PDM_TABLE_NAME)

    assert exc_info.value.error == LambdaError.DocumentReferenceNotFound
    assert exc_info.value.status_code == 404
