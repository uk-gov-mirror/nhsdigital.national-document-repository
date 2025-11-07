from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from enums.document_review_status import DocumentReviewStatus
from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCodes
from freezegun import freeze_time
from models.document_review import (
    DocumentReviewFileDetails,
    DocumentUploadReviewReference,
    PutDocumentReviewRequest,
)
from services.put_document_review_service import PutDocumentReviewService
from tests.unit.conftest import MOCK_DOCUMENT_REVIEW_BUCKET, TEST_NHS_NUMBER
from utils.lambda_exceptions import PutDocumentReviewException

TEST_DOCUMENT_ID = "test-document-id-123"
TEST_DIFFERENT_NHS_NUMBER = "9000000010"
TEST_ODS_CODE = "Y12345"
TEST_REVIEWER_ODS_CODE = "Y67890"
TEST_FILE_LOCATION = f"s3://{MOCK_DOCUMENT_REVIEW_BUCKET}/file1.pdf"
TEST_DOCUMENT_REFERENCE_ID = "doc-ref-12345"
TEST_UPLOAD_DATE = 1699000000
TEST_REVIEW_DATE = 1699100000


@pytest.fixture
def mock_service(set_env, mocker):
    """Fixture to create a PutDocumentReviewService with mocked dependencies."""
    mocker.patch("services.put_document_review_service.DocumentUploadReviewService")

    service = PutDocumentReviewService()
    service.document_review_service = MagicMock()

    yield service


@pytest.fixture
def mock_document_review():
    """Create a mock document review reference with PENDING_REVIEW status."""
    files = [
        DocumentReviewFileDetails(
            file_name="file1.pdf",
            file_location=TEST_FILE_LOCATION,
        ),
    ]

    review = DocumentUploadReviewReference(
        id=TEST_DOCUMENT_ID,
        author=TEST_ODS_CODE,
        custodian=TEST_ODS_CODE,
        review_status=DocumentReviewStatus.PENDING_REVIEW,
        review_reason="Uploaded for review",
        upload_date=TEST_UPLOAD_DATE,
        files=files,
        nhs_number=TEST_NHS_NUMBER,
        document_snomed_code_type=SnomedCodes.LLOYD_GEORGE.value.code,
    )

    return review


@freeze_time("2024-01-01 12:00:00")
def test_update_document_review_approved_with_document_reference_id(
    mock_service, mock_document_review
):
    """Test successful update of document review with APPROVED status and document reference ID."""
    mock_service.document_review_service.get_item.return_value = mock_document_review
    mock_service.document_review_service.update_document.return_value = None

    update_data = PutDocumentReviewRequest(
        review_status=DocumentReviewStatus.APPROVED,
        document_reference_id=TEST_DOCUMENT_REFERENCE_ID,
    )

    mock_service.update_document_review(
        patient_id=TEST_NHS_NUMBER,
        document_id=TEST_DOCUMENT_ID,
        update_data=update_data,
        reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
    )

    mock_service.document_review_service.get_item.assert_called_once_with(
        document_id=TEST_DOCUMENT_ID
    )

    assert mock_service.document_review_service.update_document.call_count == 1
    call_args = mock_service.document_review_service.update_document.call_args

    updated_document = call_args[1]["document"]
    assert updated_document.review_status == DocumentReviewStatus.APPROVED
    assert updated_document.reviewer == TEST_REVIEWER_ODS_CODE
    assert updated_document.document_reference_id == TEST_DOCUMENT_REFERENCE_ID
    assert updated_document.review_date == int(
        datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc).timestamp()
    )

    update_fields = call_args[1]["update_fields_name"]
    assert "review_status" in update_fields
    assert "review_date" in update_fields
    assert "reviewer" in update_fields
    assert "document_reference_id" in update_fields


@freeze_time("2024-01-01 12:00:00")
def test_update_document_review_rejected_without_document_reference_id(
    mock_service, mock_document_review
):
    """Test a successful update of document review with REJECTED status (no document reference ID needed)."""
    mock_service.document_review_service.get_item.return_value = mock_document_review
    mock_service.document_review_service.update_document.return_value = None

    update_data = PutDocumentReviewRequest(
        review_status=DocumentReviewStatus.REJECTED,
    )

    mock_service.update_document_review(
        patient_id=TEST_NHS_NUMBER,
        document_id=TEST_DOCUMENT_ID,
        update_data=update_data,
        reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
    )

    assert mock_service.document_review_service.update_document.call_count == 1
    call_args = mock_service.document_review_service.update_document.call_args

    updated_document = call_args[1]["document"]
    assert updated_document.review_status == DocumentReviewStatus.REJECTED
    assert updated_document.reviewer == TEST_REVIEWER_ODS_CODE
    assert updated_document.review_date == int(
        datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc).timestamp()
    )

    update_fields = call_args[1]["update_fields_name"]
    assert "review_status" in update_fields
    assert "review_date" in update_fields
    assert "reviewer" in update_fields
    assert "document_reference_id" not in update_fields


def test_update_document_review_document_not_found(mock_service):
    """Test that PutDocumentReviewException is raised when a document is not found."""
    mock_service.document_review_service.get_item.return_value = None

    update_data = PutDocumentReviewRequest(
        review_status=DocumentReviewStatus.APPROVED,
        document_reference_id=TEST_DOCUMENT_REFERENCE_ID,
    )

    with pytest.raises(PutDocumentReviewException) as exc_info:
        mock_service.update_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            update_data=update_data,
            reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.error == LambdaError.DocumentReferenceMissingParameters

    mock_service.document_review_service.update_document.assert_not_called()


def test_update_document_review_nhs_number_mismatch(mock_service, mock_document_review):
    """Test that PutDocumentReviewException is raised when the NHS number doesn't match."""
    mock_service.document_review_service.get_item.return_value = mock_document_review

    update_data = PutDocumentReviewRequest(
        review_status=DocumentReviewStatus.APPROVED,
        document_reference_id=TEST_DOCUMENT_REFERENCE_ID,
    )

    with pytest.raises(PutDocumentReviewException) as exc_info:
        mock_service.update_document_review(
            patient_id=TEST_DIFFERENT_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            update_data=update_data,
            reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.error == LambdaError.DocumentReferenceMissingParameters

    mock_service.document_review_service.update_document.assert_not_called()


def test_update_document_review_invalid_status_already_reviewed(
    mock_service, mock_document_review
):
    """Test that PutDocumentReviewException is raised when document is already reviewed (APPROVED)."""
    mock_document_review.review_status = DocumentReviewStatus.APPROVED
    mock_service.document_review_service.get_item.return_value = mock_document_review

    update_data = PutDocumentReviewRequest(
        review_status=DocumentReviewStatus.REJECTED,
    )

    with pytest.raises(PutDocumentReviewException) as exc_info:
        mock_service.update_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            update_data=update_data,
            reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.error == LambdaError.DocumentReferenceMissingParameters

    mock_service.document_review_service.update_document.assert_not_called()


def test_update_document_review_invalid_status_rejected(
    mock_service, mock_document_review
):
    """Test that PutDocumentReviewException is raised when a document is already reviewed (REJECTED)."""
    mock_document_review.review_status = DocumentReviewStatus.REJECTED
    mock_service.document_review_service.get_item.return_value = mock_document_review

    update_data = PutDocumentReviewRequest(
        review_status=DocumentReviewStatus.APPROVED,
        document_reference_id=TEST_DOCUMENT_REFERENCE_ID,
    )

    with pytest.raises(PutDocumentReviewException) as exc_info:
        mock_service.update_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            update_data=update_data,
            reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.error == LambdaError.DocumentReferenceMissingParameters

    mock_service.document_review_service.update_document.assert_not_called()


def test_update_document_review_update_fails_with_exception(
    mock_service, mock_document_review
):
    """Test that PutDocumentReviewException is raised when update_document fails."""
    mock_service.document_review_service.get_item.return_value = mock_document_review
    mock_service.document_review_service.update_document.side_effect = Exception(
        "DynamoDB update failed"
    )

    update_data = PutDocumentReviewRequest(
        review_status=DocumentReviewStatus.APPROVED,
        document_reference_id=TEST_DOCUMENT_REFERENCE_ID,
    )

    with pytest.raises(PutDocumentReviewException) as exc_info:
        mock_service.update_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            update_data=update_data,
            reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
        )

    assert exc_info.value.status_code == 500
    assert exc_info.value.error == LambdaError.DocumentReferenceGeneralError
