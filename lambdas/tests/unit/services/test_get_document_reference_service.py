import pytest
from services.get_document_reference_service import GetDocumentReferenceService
from utils.lambda_exceptions import GetDocumentRefException


@pytest.fixture
def mock_service(mocker):
    mocker.patch("services.get_document_reference_service.GetFhirDocumentReferenceService")
    mocker.patch("services.get_document_reference_service.S3Service")
    service = GetDocumentReferenceService()

    yield service

def test_valid_input_returns_presigned_url(mock_service):
    pass

def test_mismatched_nhs_number_errors(mock_service):
    pass

def test_s3_service_returns_none_errors(mock_service):
    pass

def test_incorrect_doctype_error_errors(mock_service):
    pass

def test_document_reference_not_found_error_errors(mock_service):
    pass