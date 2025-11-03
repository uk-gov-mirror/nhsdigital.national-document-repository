import pytest
import uuid
from services.get_document_reference_service import GetDocumentReferenceService
from utils.lambda_exceptions import GetDocumentRefException
from tests.unit.helpers.data.test_documents import create_test_doc_store_refs
from enums.lambda_error import LambdaError
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from enums.dynamo_filter import AttributeOperator
from utils.common_query_filters import NotDeleted


@pytest.fixture
def mock_service(mocker):
    mocker.patch("services.get_document_reference_service.GetFhirDocumentReferenceService")
    mocker.patch("services.get_document_reference_service.S3Service")
    mocker.patch("services.get_document_reference_service.DocumentService")
    mocker.patch("services.get_document_reference_service.DynamoDBService")
    service = GetDocumentReferenceService()

    yield service

@pytest.fixture
def mock_nhs_number():
    yield "9000000009"

@pytest.fixture
def mock_presigned_s3_url():
    yield "https://example.com"

@pytest.fixture
def mock_s3_bucket_name():
    yield "mock_bucket_name"

@pytest.fixture
def mock_s3_file_key():
    yield "mock_file_key"

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
        mocker,
        mock_service,
        mock_nhs_number,
        mock_presigned_s3_url,
        mock_s3_bucket_name,
        mock_s3_file_key,
        mock_document_reference
    ):
    mocked_uuid = mocker.patch("services.get_document_reference_service.uuid")
    expected_uuid = uuid.uuid4()
    mocked_uuid.uuid4.return_value = expected_uuid

    filter_builder = DynamoQueryFilterBuilder()
    filter_builder.add_condition("DocStatus", AttributeOperator.EQUAL, "final")
    filter_builder.add_condition("NhsNumber", AttributeOperator.EQUAL, mock_nhs_number)
    mock_filter = filter_builder.build()
    mock_filter = mock_filter & NotDeleted
    
    mock_cloudfront_url = "cloudfront.com"

    mock_service.document_service.fetch_documents_from_table.return_value = [mock_document_reference]
    mock_service.s3_service.create_download_presigned_url.return_value = mock_presigned_s3_url
    
    mock_service.cloudfront_url = mock_cloudfront_url

    expected_result = "https://" + mock_cloudfront_url + "/" + str(expected_uuid)

    result = mock_service.get_document_url_by_id(
        mock_document_reference.id,
        mock_nhs_number
        )
    
    mock_service.document_service.fetch_documents_from_table.assert_called_once_with(
        table=mock_service.lg_table,
        search_condition=mock_document_reference.id,
        search_key="ID",
        query_filter=mock_filter
    )
    mock_service.s3_service.create_download_presigned_url.assert_called_once_with(
        s3_bucket_name=mock_s3_bucket_name,
        file_key=mock_s3_file_key
    )

    assert result == expected_result

def test_s3_service_returns_none_errors(
        mock_service,
        mock_document_reference,
        mock_nhs_number
        ):
    mock_service.document_service.fetch_documents_from_table.return_value = [mock_document_reference]
    mock_service.s3_service.create_download_presigned_url.return_value = None

    with pytest.raises(GetDocumentRefException) as excinfo:
        mock_service.get_document_url_by_id(
            mock_document_reference.id,
            mock_nhs_number
        )

    assert excinfo.value.status_code == 500
    assert excinfo.value.error == LambdaError.InternalServerError

def test_no_document_reference_found_errors(
        mock_service,
        mock_document_reference,
        mock_nhs_number
):
    mock_service.document_service.fetch_documents_from_table.return_value = []

    with pytest.raises(GetDocumentRefException) as excinfo:
        mock_service.get_document_url_by_id(mock_document_reference.id, mock_nhs_number)

    assert excinfo.value.status_code == 404
    assert excinfo.value.error == LambdaError.DocumentReferenceNotFound