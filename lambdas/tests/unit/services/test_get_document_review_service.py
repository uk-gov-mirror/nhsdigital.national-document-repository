from copy import deepcopy
from unittest.mock import MagicMock

import pytest
from enums.document_review_reason import DocumentReviewReason
from enums.document_review_status import DocumentReviewStatus
from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCodes
from freezegun import freeze_time
from models.document_review import (
    DocumentReviewFileDetails,
    DocumentUploadReviewReference,
)
from models.staging_metadata import NHS_NUMBER_PLACEHOLDER
from services.get_document_review_service import GetDocumentReviewService
from tests.unit.conftest import (
    MOCK_DOCUMENT_REVIEW_BUCKET,
    MOCK_EDGE_REFERENCE_TABLE,
    TEST_NHS_NUMBER,
)
from utils.exceptions import DynamoServiceException, OdsErrorException
from utils.lambda_exceptions import DocumentReviewLambdaException

TEST_DOCUMENT_ID = "test-document-id-123"
TEST_DOCUMENT_VERSION = 1
TEST_DIFFERENT_NHS_NUMBER = "9000000010"
TEST_ODS_CODE = "Y12345"
TEST_FILE_LOCATION_1 = f"s3://{MOCK_DOCUMENT_REVIEW_BUCKET}/file1.pdf"
TEST_FILE_LOCATION_2 = f"s3://{MOCK_DOCUMENT_REVIEW_BUCKET}/file2.pdf"
TEST_PRESIGNED_URL_1 = "https://s3.amazonaws.com/presigned1?signature=abc123"
TEST_PRESIGNED_URL_2 = "https://s3.amazonaws.com/presigned2?signature=def456"
TEST_CLOUDFRONT_URL = "https://mock-cloudfront-url.com"


@pytest.fixture
def mock_extract_ods(mocker):
    return mocker.patch(
        "services.get_document_review_service.extract_ods_code_from_request_context"
    )


@pytest.fixture
def mock_service(set_env, mocker):
    mocker.patch("services.get_document_review_service.S3Service")
    mocker.patch("services.get_document_review_service.DocumentUploadReviewService")

    service = GetDocumentReviewService()
    service.s3_service = MagicMock()
    service.s3_service.presigned_url_expiry = 1800  # 30 minutes
    service.document_review_service = MagicMock()
    service.document_review_service.dynamo_service = MagicMock()
    service.cloudfront_table_name = MOCK_EDGE_REFERENCE_TABLE
    service.cloudfront_url = TEST_CLOUDFRONT_URL

    yield service


@pytest.fixture
def mock_document_review():
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
        review_reason=DocumentReviewReason.UNSUCCESSFUL_UPLOAD,
        upload_date=1699000000,
        files=files,
        nhs_number=TEST_NHS_NUMBER,
        document_snomed_code_type=SnomedCodes.LLOYD_GEORGE.value.code,
    )

    return review


def test_get_document_review_success(
    mock_service, mock_document_review, mocker, mock_extract_ods
):
    mock_extract_ods.return_value = TEST_ODS_CODE

    mock_service.document_review_service.get_document_review_by_id.return_value = (
        mock_document_review
    )

    mock_service.s3_service.create_download_presigned_url.side_effect = [
        TEST_PRESIGNED_URL_1,
        TEST_PRESIGNED_URL_2,
    ]

    mocker.patch(
        "services.get_document_review_service.format_cloudfront_url",
        side_effect=lambda presigned_id, url: f"{url}/{presigned_id}",
    )

    result = mock_service.get_document_review(
        patient_id=TEST_NHS_NUMBER,
        document_id=TEST_DOCUMENT_ID,
        document_version=TEST_DOCUMENT_VERSION,
    )
    assert result is not None
    assert result["id"] == TEST_DOCUMENT_ID
    assert result["version"] == TEST_DOCUMENT_VERSION
    assert result["uploadDate"] == 1699000000
    assert result["documentSnomedCodeType"] == SnomedCodes.LLOYD_GEORGE.value.code
    assert len(result["files"]) == 2

    assert "author" not in result
    assert "custodian" not in result
    assert "reviewStatus" not in result
    assert "nhsNumber" not in result

    assert result["files"][0]["fileName"] == "file1.pdf"
    assert result["files"][0]["presignedUrl"].startswith(TEST_CLOUDFRONT_URL)
    assert result["files"][1]["fileName"] == "file2.pdf"
    assert result["files"][1]["presignedUrl"].startswith(TEST_CLOUDFRONT_URL)

    mock_service.document_review_service.get_document_review_by_id.assert_called_once_with(
        document_id=TEST_DOCUMENT_ID, document_version=TEST_DOCUMENT_VERSION
    )

    assert mock_service.s3_service.create_download_presigned_url.call_count == 2
    mock_service.s3_service.create_download_presigned_url.assert_any_call(
        s3_bucket_name=MOCK_DOCUMENT_REVIEW_BUCKET,
        file_key="file1.pdf",
    )
    mock_service.s3_service.create_download_presigned_url.assert_any_call(
        s3_bucket_name=MOCK_DOCUMENT_REVIEW_BUCKET,
        file_key="file2.pdf",
    )

    assert (
        mock_service.document_review_service.dynamo_service.create_item.call_count == 2
    )


def test_get_document_review_not_found(mock_service, mock_extract_ods):
    mock_extract_ods.return_value = TEST_ODS_CODE
    mock_service.document_review_service.get_document_review_by_id.return_value = None

    result = mock_service.get_document_review(
        patient_id=TEST_NHS_NUMBER,
        document_id=TEST_DOCUMENT_ID,
        document_version=TEST_DOCUMENT_VERSION,
    )

    assert result is None
    mock_service.document_review_service.get_document_review_by_id.assert_called_once_with(
        document_id=TEST_DOCUMENT_ID, document_version=TEST_DOCUMENT_VERSION
    )


def test_get_document_review_nhs_number_mismatch(
    mock_service, mock_document_review, mock_extract_ods
):
    mock_extract_ods.return_value = TEST_ODS_CODE

    mock_service.document_review_service.get_document_review_by_id.return_value = (
        mock_document_review
    )

    result = mock_service.get_document_review(
        patient_id=TEST_DIFFERENT_NHS_NUMBER,
        document_id=TEST_DOCUMENT_ID,
        document_version=TEST_DOCUMENT_VERSION,
    )

    assert result is None
    mock_service.document_review_service.get_document_review_by_id.assert_called_once_with(
        document_id=TEST_DOCUMENT_ID, document_version=TEST_DOCUMENT_VERSION
    )

    mock_service.s3_service.create_download_presigned_url.assert_not_called()


def test_get_document_review_handles_placeholder_nhs_number(
    mock_service, mock_extract_ods, mock_document_review
):
    mock_extract_ods.return_value = TEST_ODS_CODE
    unknown_patient_review = deepcopy(mock_document_review)
    unknown_patient_review.nhs_number = NHS_NUMBER_PLACEHOLDER

    mock_service.document_review_service.get_document_review_by_id.return_value = (
        unknown_patient_review
    )

    mock_service.get_document_review(
        patient_id=NHS_NUMBER_PLACEHOLDER,
        document_id=TEST_DOCUMENT_ID,
        document_version=TEST_DOCUMENT_VERSION,
    )
    mock_service.document_review_service.get_document_review_by_id.assert_called_once_with(
        document_id=TEST_DOCUMENT_ID, document_version=TEST_DOCUMENT_VERSION
    )

    mock_service.s3_service.create_download_presigned_url.assert_called()


def test_get_document_review_dynamo_service_exception(mock_service, mock_extract_ods):
    mock_extract_ods.return_value = TEST_ODS_CODE
    mock_service.document_review_service.get_document_review_by_id.side_effect = (
        DynamoServiceException("DynamoDB error")
    )

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.get_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            document_version=TEST_DOCUMENT_VERSION,
        )

    assert e.value.status_code == 500
    assert e.value.error == LambdaError.DocRefClient


def test_get_document_review_unexpected_exception(mock_service, mock_extract_ods):
    mock_extract_ods.return_value = TEST_ODS_CODE
    mock_service.document_review_service.get_document_review_by_id.side_effect = (
        Exception("Unexpected error")
    )

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.get_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            document_version=TEST_DOCUMENT_VERSION,
        )

    assert e.value.status_code == 500
    assert e.value.error == LambdaError.DocRefClient


def test_get_document_review_throws_error_not_pending_review(
    mock_service, mock_extract_ods, mock_document_review
):
    mock_document_review.review_status = DocumentReviewStatus.REASSIGNED
    mock_service.document_review_service.get_document_review_by_id.return_value = (
        mock_document_review
    )

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.get_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            document_version=TEST_DOCUMENT_VERSION,
        )

    assert e.value.status_code == 400
    assert e.value.error == LambdaError.DocumentReviewNotPendingReview


def test_get_document_review_throws_error_user_not_custodian(
    mock_service, mock_extract_ods, mock_document_review
):
    mock_service.document_review_service.get_document_review_by_id.return_value = (
        mock_document_review
    )
    mock_extract_ods.return_value = "Z67890"

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.get_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            document_version=TEST_DOCUMENT_VERSION,
        )

    assert e.value.status_code == 403
    assert e.value.error == LambdaError.DocumentReviewUploadForbidden


def test_error_thrown_no_ods_in_request_context(mock_service, mock_extract_ods):
    mock_extract_ods.side_effect = OdsErrorException()

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.get_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            document_version=TEST_DOCUMENT_VERSION,
        )

    assert e.value.status_code == 403
    assert e.value.error == LambdaError.DocumentReviewMissingODS


@freeze_time("2023-11-03T12:00:00Z")
def test_create_cloudfront_presigned_url(mock_service, mock_uuid, mocker):
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
    assert call_args[0][0] == MOCK_EDGE_REFERENCE_TABLE
    assert call_args[0][1]["ID"] == f"review/{mock_uuid}"
    assert call_args[0][1]["presignedUrl"] == TEST_PRESIGNED_URL_1
    assert "TTL" in call_args[0][1]

    mock_format_url.assert_called_once_with(f"review/{mock_uuid}", TEST_CLOUDFRONT_URL)


@freeze_time("2023-11-03T12:00:00Z")
def test_create_cloudfront_presigned_url_with_nested_path(
    mock_service, mock_uuid, mocker
):
    file_location = f"s3://{MOCK_DOCUMENT_REVIEW_BUCKET}/nested/path/to/file.pdf"
    mock_service.s3_service.create_download_presigned_url.return_value = (
        TEST_PRESIGNED_URL_1
    )

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
def test_create_cloudfront_presigned_url_calculates_correct_ttl(
    mock_service, mock_uuid, mocker
):
    mock_service.s3_service.create_download_presigned_url.return_value = (
        TEST_PRESIGNED_URL_1
    )
    mock_service.s3_service.presigned_url_expiry = 3600  # 1 hour
    mocker.patch(
        "services.get_document_review_service.uuid.uuid4", return_value=mock_uuid
    )

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
