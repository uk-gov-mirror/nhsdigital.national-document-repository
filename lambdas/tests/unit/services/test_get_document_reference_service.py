import pytest
from services.get_document_reference_service import GetDocumentReferenceService
from utils.lambda_exceptions import GetDocumentRefException
from tests.unit.helpers.data.test_documents import create_test_doc_store_refs
from enums.lambda_error import LambdaError


@pytest.fixture
def mock_service(mocker):
    mocker.patch("services.get_document_reference_service.GetFhirDocumentReferenceService")
    mocker.patch("services.get_document_reference_service.S3Service")
    service = GetDocumentReferenceService()

    yield service

@pytest.fixture
def mock_nhs_number():
    yield "9000000009"

@pytest.fixture
def mock_presigned_s3_url():
    yield "https://example.com"

@pytest.fixture
def mock_snomed_code():
    yield "LG"

@pytest.fixture
def mock_s3_bucket_name():
    yield "mock_bucket_name"

@pytest.fixture
def mock_s3_file_key():
    yield "mock_file_key.pdf"

@pytest.fixture
def mock_document_reference(
    mock_s3_bucket_name,
    mock_s3_file_key,
    mock_nhs_number
):
    doc_ref = create_test_doc_store_refs()[0]

    doc_ref.nhs_number = mock_nhs_number
    doc_ref.s3_bucket_name = mock_s3_bucket_name
    doc_ref.s3_file_key = mock_s3_file_key

    yield doc_ref


def test_valid_input_returns_presigned_url(
    mock_service,
    mock_nhs_number,
    mock_presigned_s3_url,
    mock_snomed_code,
    mock_s3_bucket_name,
    mock_s3_file_key,
    mock_document_reference
    ):
    mock_service.fhir_doc_service.handle_get_document_reference_request.return_value = mock_document_reference
    mock_service.s3_service.create_download_presigned_url.return_value = mock_presigned_s3_url

    result = mock_service.get_document_url_by_id(
        mock_document_reference.id,
        mock_snomed_code,
        mock_nhs_number
        )
    
    mock_service.fhir_doc_service.handle_get_document_reference_request.assert_called_once_with(
        mock_snomed_code,
        mock_document_reference.id
    )
    mock_service.s3_service.create_download_presigned_url.assert_called_once_with(
        mock_s3_bucket_name,
        mock_s3_file_key
    )

    assert result == mock_presigned_s3_url



def test_mismatched_nhs_number_errors(
        mock_service,
        mock_document_reference,
        mock_snomed_code
        ):
    mock_service.fhir_doc_service.handle_get_document_reference_request.return_value = mock_document_reference

    with pytest.raises(GetDocumentRefException) as excinfo:
        mock_service.get_document_url_by_id(
            mock_document_reference.id,
            mock_snomed_code,
            "incorrect_nhs_number")
        
    assert excinfo.value.status_code == 404 #is 404 correct?
    assert excinfo.value.error == LambdaError.NHSNumberMismatch

def test_s3_service_returns_none_errors(
        mock_service,
        mock_document_reference,
        mock_snomed_code,
        mock_nhs_number
        ):
    mock_service.fhir_doc_service.handle_get_document_reference_request.return_value = mock_document_reference
    mock_service.s3_service.create_download_presigned_url.return_value = None

    with pytest.raises(GetDocumentRefException) as excinfo:
        mock_service.get_document_url_by_id(
            mock_document_reference.id,
            mock_snomed_code,
            mock_nhs_number
        )

    assert excinfo.value.status_code == 500
    assert excinfo.value.error == LambdaError.InternalServerError