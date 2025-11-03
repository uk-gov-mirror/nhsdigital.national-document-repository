from unittest.mock import MagicMock

import pytest
from freezegun import freeze_time
from pydantic import ValidationError

from enums.document_review_status import DocumentReviewStatus
from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCodes
from models.document_review import (
    DocumentReviewFileDetails,
    DocumentUploadReviewReference,
)
from services.get_document_review_service import GetDocumentReviewService
from tests.unit.conftest import (
    MOCK_DOCUMENT_REVIEW_BUCKET,
    TEST_NHS_NUMBER, MOCK_EDGE_TABLE,
)
from utils.exceptions import DynamoServiceException
from utils.lambda_exceptions import GetDocumentReviewException

TEST_DOCUMENT_ID = "test-document-id-123"
TEST_DIFFERENT_NHS_NUMBER = "9000000010"
TEST_ODS_CODE = "Y12345"
TEST_FILE_LOCATION_1 = f"s3://{MOCK_DOCUMENT_REVIEW_BUCKET}/file1.pdf"
TEST_FILE_LOCATION_2 = f"s3://{MOCK_DOCUMENT_REVIEW_BUCKET}/file2.pdf"
TEST_PRESIGNED_URL_1 = "https://s3.amazonaws.com/presigned1?signature=abc123"
TEST_PRESIGNED_URL_2 = "https://s3.amazonaws.com/presigned2?signature=def456"
TEST_CLOUDFRONT_URL = "https://mock-cloudfront-url.com"


@pytest.fixture
def mock_service(set_env, mocker):
    """Fixture to create a GetDocumentReviewService with mocked dependencies."""
    mocker.patch("services.get_document_review_service.S3Service")
    mocker.patch("services.get_document_review_service.DocumentUploadReviewService")

    service = GetDocumentReviewService()
    service.s3_service = MagicMock()
    service.s3_service.presigned_url_expiry = 1800  # 30 minutes
    service.document_review_service = MagicMock()
    service.document_review_service.dynamo_service = MagicMock()
    service.cloudfront_url = TEST_CLOUDFRONT_URL

    yield service


@pytest.fixture
def mock_document_review():
    """Create a mock document review reference."""
    files = [
        DocumentReviewFileDetails(
            file_name="file1.pdf",
            file_location=TEST_FILE_LOCATION_1,
        ),
        DocumentReviewFileDetails(
            file_name="file2.pdf",
            file_location=TEST_FILE_LOCATION_2,
        ),
    ]

    review = DocumentUploadReviewReference(
        id=TEST_DOCUMENT_ID,
        author=TEST_ODS_CODE,
        custodian=TEST_ODS_CODE,
        review_status=DocumentReviewStatus.PENDING_REVIEW,
        review_reason="Uploaded for review",
        upload_date=1699000000,
        files=files,
        nhs_number=TEST_NHS_NUMBER,
        document_snomed_code_type=SnomedCodes.LLOYD_GEORGE.value.code,
    )

    return review


def test_get_document_review_success(mock_service, mock_document_review, mocker):
    """Test successful retrieval of a document review with pre-signed URLs."""
    mock_service.document_review_service.get_item.return_value = mock_document_review

    mock_service.s3_service.create_download_presigned_url.side_effect = [
        TEST_PRESIGNED_URL_1,
        TEST_PRESIGNED_URL_2,
    ]

    mocker.patch(
        "services.get_document_review_service.format_cloudfront_url",
        side_effect=lambda presigned_id, url: f"{url}/{presigned_id}",
    )

    result = mock_service.get_document_review(
        patient_id=TEST_NHS_NUMBER, document_id=TEST_DOCUMENT_ID
    )
    assert result is not None
    assert result["ID"] == TEST_DOCUMENT_ID
    assert result["UploadDate"] == 1699000000
    assert result["DocumentSnomedCodeType"] == SnomedCodes.LLOYD_GEORGE.value.code
    assert len(result["Files"]) == 2

    assert "Author" not in result
    assert "Custodian" not in result
    assert "ReviewStatus" not in result
    assert "NhsNumber" not in result

    assert result["Files"][0]["FileName"] == "file1.pdf"
    assert result["Files"][0]["PresignedUrl"].startswith(TEST_CLOUDFRONT_URL)
    assert result["Files"][1]["FileName"] == "file2.pdf"
    assert result["Files"][1]["PresignedUrl"].startswith(TEST_CLOUDFRONT_URL)

    mock_service.document_review_service.get_item.assert_called_once_with(TEST_DOCUMENT_ID)

    assert mock_service.s3_service.create_download_presigned_url.call_count == 2
    mock_service.s3_service.create_download_presigned_url.assert_any_call(
        s3_bucket_name=MOCK_DOCUMENT_REVIEW_BUCKET,
        file_key="file1.pdf",
    )
    mock_service.s3_service.create_download_presigned_url.assert_any_call(
        s3_bucket_name=MOCK_DOCUMENT_REVIEW_BUCKET,
        file_key="file2.pdf",
    )

    assert mock_service.document_review_service.dynamo_service.create_item.call_count == 2


def test_get_document_review_not_found(mock_service):
    """Test when a document review is not found in DynamoDB."""
    mock_service.document_review_service.get_item.return_value = None

    result = mock_service.get_document_review(
        patient_id=TEST_NHS_NUMBER, document_id=TEST_DOCUMENT_ID
    )

    assert result is None
    mock_service.document_review_service.get_item.assert_called_once_with(
        TEST_DOCUMENT_ID
    )


def test_get_document_review_nhs_number_mismatch(mock_service, mock_document_review):
    """Test when document review exists but the NHS number doesn't match."""
    mock_service.document_review_service.get_item.return_value = mock_document_review

    result = mock_service.get_document_review(
        patient_id=TEST_DIFFERENT_NHS_NUMBER, document_id=TEST_DOCUMENT_ID
    )

    assert result is None
    mock_service.document_review_service.get_item.assert_called_once_with(
        TEST_DOCUMENT_ID
    )

    mock_service.s3_service.create_download_presigned_url.assert_not_called()


def test_get_document_review_dynamo_service_exception(mock_service):
    """Test handling of DynamoServiceException."""
    mock_service.document_review_service.get_item.side_effect = DynamoServiceException(
        "DynamoDB error"
    )

    with pytest.raises(GetDocumentReviewException) as exc_info:
        mock_service.get_document_review(
            patient_id=TEST_NHS_NUMBER, document_id=TEST_DOCUMENT_ID
        )

    assert exc_info.value.status_code == 500
    assert exc_info.value.error == LambdaError.DocRefClient


def test_get_document_review_unexpected_exception(mock_service):
    """Test handling of unexpected exceptions."""
    mock_service.document_review_service.get_item.side_effect = Exception(
        "Unexpected error"
    )

    with pytest.raises(GetDocumentReviewException) as exc_info:
        mock_service.get_document_review(
            patient_id=TEST_NHS_NUMBER, document_id=TEST_DOCUMENT_ID
        )

    assert exc_info.value.status_code == 500
    assert exc_info.value.error == LambdaError.DocRefClient


@freeze_time("2023-11-03T12:00:00Z")
def test_create_cloudfront_presigned_url(mock_service, mock_uuid, mocker):
    """Test creating a CloudFront presigned URL."""
    mock_service.s3_service.create_download_presigned_url.return_value = (
        TEST_PRESIGNED_URL_1
    )

    mock_format_url = mocker.patch(
        "services.get_document_review_service.format_cloudfront_url",
        return_value=f"{TEST_CLOUDFRONT_URL}/review/{mock_uuid}",
    )


    result = mock_service.create_cloudfront_presigned_url(TEST_FILE_LOCATION_1)

    assert result == f"{TEST_CLOUDFRONT_URL}/review/{mock_uuid}"

    mock_service.s3_service.create_download_presigned_url.assert_called_once_with(
        s3_bucket_name=MOCK_DOCUMENT_REVIEW_BUCKET,
        file_key="file1.pdf",
    )

    mock_service.document_review_service.dynamo_service.create_item.assert_called_once()
    call_args = (
        mock_service.document_review_service.dynamo_service.create_item.call_args
    )
    assert call_args[0][0] == MOCK_EDGE_TABLE
    assert call_args[0][1]["ID"] == f"review/{mock_uuid}"
    assert call_args[0][1]["presignedUrl"] == TEST_PRESIGNED_URL_1
    assert "TTL" in call_args[0][1]

    mock_format_url.assert_called_once_with(f"review/{mock_uuid}", TEST_CLOUDFRONT_URL)


@freeze_time("2023-11-03T12:00:00Z")
def test_create_cloudfront_presigned_url_with_nested_path(mock_service, mock_uuid, mocker):
    """Test creating a CloudFront presigned URL with a nested S3 path."""
    file_location = f"s3://{MOCK_DOCUMENT_REVIEW_BUCKET}/nested/path/to/file.pdf"
    mock_service.s3_service.create_download_presigned_url.return_value = TEST_PRESIGNED_URL_1

    mocker.patch(
        "services.get_document_review_service.format_cloudfront_url",
        return_value=f"{TEST_CLOUDFRONT_URL}/review/{mock_uuid}",
    )

    result = mock_service.create_cloudfront_presigned_url(file_location)

    assert result == f"{TEST_CLOUDFRONT_URL}/review/{mock_uuid}"

    mock_service.s3_service.create_download_presigned_url.assert_called_once_with(
        s3_bucket_name=MOCK_DOCUMENT_REVIEW_BUCKET,
        file_key="nested/path/to/file.pdf",
    )


@freeze_time("2023-11-03T12:00:00Z")
def test_create_cloudfront_presigned_url_calculates_correct_ttl(mock_service, mock_uuid, mocker):
    """Test that TTL is calculated correctly based on presigned URL expiry."""
    mock_service.s3_service.create_download_presigned_url.return_value = (
        TEST_PRESIGNED_URL_1
    )
    mock_service.s3_service.presigned_url_expiry = 3600  # 1 hour
    mocker.patch("services.get_document_review_service.uuid.uuid4", return_value=mock_uuid)

    mocker.patch(
        "services.get_document_review_service.format_cloudfront_url",
        return_value=f"{TEST_CLOUDFRONT_URL}/review/{mock_uuid}",
    )

    mock_service.create_cloudfront_presigned_url(TEST_FILE_LOCATION_1)

    call_args = (
        mock_service.document_review_service.dynamo_service.create_item.call_args
    )
    expected_ttl = 1699012800 + 3600  # frozen time timestamp + 1 hour
    assert call_args[0][1]["TTL"] == expected_ttl

