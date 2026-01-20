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
    PatchDocumentReviewRequest,
)
from models.pds_models import PatientDetails
from services.update_document_review_service import UpdateDocumentReviewService
from tests.unit.conftest import MOCK_DOCUMENT_REVIEW_BUCKET, TEST_NHS_NUMBER
from utils.lambda_exceptions import UpdateDocumentReviewException
from utils.ods_utils import PCSE_ODS_CODE

TEST_DOCUMENT_ID = "test-document-id-123"
TEST_DIFFERENT_NHS_NUMBER = "9000000017"
TEST_REASSIGNED_NHS_NUMBER = "9000000025"
TEST_ODS_CODE = "Y12345"
TEST_REVIEWER_ODS_CODE = "Y12345"
TEST_NEW_ODS_CODE = "Z99999"
TEST_FILE_LOCATION = f"s3://{MOCK_DOCUMENT_REVIEW_BUCKET}/file1.pdf"
TEST_DOCUMENT_REFERENCE_ID = "doc-ref-12345"
TEST_UPLOAD_DATE = 1699000000
TEST_REVIEW_DATE = 1699100000
TEST_FROZEN_TIME = "2024-01-15 12:00:00"
TEST_FROZEN_TIME_TIMESTAMP = 1705320000
TEST_VERSION = 1


@pytest.fixture
def mock_service(set_env, mocker):
    mocker.patch("services.update_document_review_service.DocumentUploadReviewService")
    mocker.patch("services.update_document_review_service.S3Service")

    service = UpdateDocumentReviewService()
    service.document_review_service = MagicMock()

    yield service


@pytest.fixture
def mock_document_review():
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
        review_reason=DocumentReviewReason.DUPLICATE_RECORD,
        upload_date=TEST_UPLOAD_DATE,
        files=files,
        nhs_number=TEST_NHS_NUMBER,
        document_snomed_code_type=SnomedCodes.LLOYD_GEORGE.value.code,
    )

    return review


@pytest.fixture
def mock_pds_service(mocker):
    mock_pds = MagicMock()

    mock_patient_details = PatientDetails(
        nhsNumber=TEST_REASSIGNED_NHS_NUMBER,
        generalPracticeOds=TEST_NEW_ODS_CODE,
        superseded=False,
        restricted=False,
    )
    mock_pds.fetch_patient_details.return_value = mock_patient_details

    mocker.patch(
        "services.update_document_review_service.get_pds_service", return_value=mock_pds
    )
    return mock_pds


@freeze_time(TEST_FROZEN_TIME)
def test_update_document_review_successfully_approves_document(
    mock_service, mock_document_review
):
    mock_document_review.review_status = DocumentReviewStatus.PENDING_REVIEW
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.APPROVED,
        document_reference_id=TEST_DOCUMENT_REFERENCE_ID,
    )
    mock_service.document_review_service.get_document_review_by_id.return_value = (
        mock_document_review
    )

    mock_service.update_document_review(
        patient_id=TEST_NHS_NUMBER,
        document_id=TEST_DOCUMENT_ID,
        document_version=TEST_VERSION,
        update_data=update_data,
        reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
    )

    mock_service.document_review_service.get_document_review_by_id.assert_called_once_with(
        document_id=TEST_DOCUMENT_ID, document_version=TEST_VERSION
    )
    mock_service.document_review_service.update_pending_review_status.assert_called_once()

    call_args = (
        mock_service.document_review_service.update_pending_review_status.call_args
    )
    updated_doc = call_args.kwargs["review_update"]
    assert updated_doc.review_status == DocumentReviewStatus.APPROVED
    assert updated_doc.document_reference_id == TEST_DOCUMENT_REFERENCE_ID
    assert updated_doc.reviewer == TEST_REVIEWER_ODS_CODE
    assert updated_doc.review_date == TEST_FROZEN_TIME_TIMESTAMP
    assert "review_status" in call_args.kwargs["field_names"]
    assert "document_reference_id" in call_args.kwargs["field_names"]
    assert "reviewer" in call_args.kwargs["field_names"]
    assert "review_date" in call_args.kwargs["field_names"]


@pytest.mark.parametrize(
    "rejection_status",
    [
        DocumentReviewStatus.REJECTED,
        DocumentReviewStatus.REJECTED_DUPLICATE,
    ],
)
@freeze_time(TEST_FROZEN_TIME)
def test_update_document_review_successfully_rejects_document(
    mock_service, mock_document_review, rejection_status
):
    update_data = PatchDocumentReviewRequest(
        review_status=rejection_status,
    )
    mock_service.document_review_service.get_document_review_by_id.return_value = (
        mock_document_review
    )

    mock_service.update_document_review(
        patient_id=TEST_NHS_NUMBER,
        document_id=TEST_DOCUMENT_ID,
        document_version=TEST_VERSION,
        update_data=update_data,
        reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
    )

    mock_service.document_review_service.get_document_review_by_id.assert_called_once_with(
        document_id=TEST_DOCUMENT_ID, document_version=TEST_VERSION
    )
    mock_service.document_review_service.update_pending_review_status.assert_called_once()

    call_args = (
        mock_service.document_review_service.update_pending_review_status.call_args
    )
    updated_doc = call_args.kwargs["review_update"]
    assert updated_doc.review_status == rejection_status
    assert updated_doc.reviewer == TEST_REVIEWER_ODS_CODE
    assert updated_doc.review_date == TEST_FROZEN_TIME_TIMESTAMP
    assert "document_reference_id" not in call_args.kwargs["field_names"]
    assert "reviewer" in call_args.kwargs["field_names"]
    assert "review_date" in call_args.kwargs["field_names"]


@freeze_time(TEST_FROZEN_TIME)
def test_update_document_review_successfully_reassigns_document_to_new_patient(
    mock_service, mock_document_review, mock_pds_service
):
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.REASSIGNED,
        nhs_number=TEST_REASSIGNED_NHS_NUMBER,
    )
    mock_service.document_review_service.get_document_review_by_id.return_value = (
        mock_document_review
    )

    mock_service.update_document_review(
        patient_id=TEST_NHS_NUMBER,
        document_id=TEST_DOCUMENT_ID,
        document_version=TEST_VERSION,
        update_data=update_data,
        reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
    )

    mock_service.document_review_service.update_document_review_with_transaction.assert_called_once()
    call_args = (
        mock_service.document_review_service.update_document_review_with_transaction.call_args
    )

    new_review = call_args.kwargs["new_review_item"]
    existing_review = call_args.kwargs["existing_review_item"]

    assert new_review.nhs_number == TEST_REASSIGNED_NHS_NUMBER
    assert new_review.review_status == DocumentReviewStatus.PENDING_REVIEW
    assert new_review.version == 2
    assert new_review.custodian == TEST_NEW_ODS_CODE

    assert existing_review.review_status == DocumentReviewStatus.REASSIGNED
    assert existing_review.reviewer == TEST_REVIEWER_ODS_CODE
    assert existing_review.review_date == TEST_FROZEN_TIME_TIMESTAMP
    assert existing_review.version == 1
    assert existing_review.custodian == TEST_ODS_CODE
    assert existing_review.nhs_number == TEST_NHS_NUMBER


@freeze_time(TEST_FROZEN_TIME)
def test_update_document_review_successfully_reassigns_document_when_patient_unknown(
    mock_service, mock_document_review, mock_pds_service
):
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.REASSIGNED_PATIENT_UNKNOWN,
        nhs_number=TEST_REASSIGNED_NHS_NUMBER,
    )
    mock_service.document_review_service.get_document_review_by_id.return_value = (
        mock_document_review
    )

    mock_service.update_document_review(
        patient_id=TEST_NHS_NUMBER,
        document_id=TEST_DOCUMENT_ID,
        document_version=TEST_VERSION,
        update_data=update_data,
        reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
    )

    mock_service.document_review_service.update_document_review_with_transaction.assert_called_once()
    call_args = (
        mock_service.document_review_service.update_document_review_with_transaction.call_args
    )

    new_review = call_args.kwargs["new_review_item"]
    existing_review = call_args.kwargs["existing_review_item"]

    assert new_review.nhs_number == "0000000000"
    assert new_review.review_status == DocumentReviewStatus.PENDING_REVIEW
    assert new_review.version == 2
    assert new_review.custodian == PCSE_ODS_CODE

    assert (
        existing_review.review_status == DocumentReviewStatus.REASSIGNED_PATIENT_UNKNOWN
    )
    assert existing_review.reviewer == TEST_REVIEWER_ODS_CODE
    assert existing_review.review_date == TEST_FROZEN_TIME_TIMESTAMP
    assert existing_review.version == 1
    assert existing_review.custodian == TEST_ODS_CODE
    assert existing_review.nhs_number == TEST_NHS_NUMBER


def test_update_document_review_raises_exception_when_document_not_found(mock_service):
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.APPROVED,
        document_reference_id=TEST_DOCUMENT_REFERENCE_ID,
    )
    mock_service.document_review_service.get_document_review_by_id.return_value = None

    with pytest.raises(UpdateDocumentReviewException) as exc_info:
        mock_service.update_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            document_version=TEST_VERSION,
            update_data=update_data,
            reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.error == LambdaError.DocumentReviewNotFound
    mock_service.document_review_service.get_document_review_by_id.assert_called_once_with(
        document_id=TEST_DOCUMENT_ID, document_version=TEST_VERSION
    )
    mock_service.document_review_service.update_pending_review_status.assert_not_called()


def test_fetch_document_returns_document_when_exists(
    mock_service, mock_document_review
):
    mock_service.document_review_service.get_document_review_by_id.return_value = (
        mock_document_review
    )

    result = mock_service._fetch_document(TEST_DOCUMENT_ID, TEST_VERSION)

    assert result == mock_document_review
    mock_service.document_review_service.get_document_review_by_id.assert_called_once_with(
        document_id=TEST_DOCUMENT_ID, document_version=TEST_VERSION
    )


def test_fetch_document_raises_404_when_document_not_found(mock_service):
    mock_service.document_review_service.get_document_review_by_id.return_value = None

    with pytest.raises(UpdateDocumentReviewException) as exc_info:
        mock_service._fetch_document(TEST_DOCUMENT_ID, TEST_VERSION)

    assert exc_info.value.status_code == 404
    assert exc_info.value.error == LambdaError.DocumentReviewNotFound
    mock_service.document_review_service.get_document_review_by_id.assert_called_once_with(
        document_id=TEST_DOCUMENT_ID, document_version=TEST_VERSION
    )


def test_validate_patient_id_match_succeeds_when_nhs_numbers_match(
    mock_service, mock_document_review
):
    mock_service._validate_patient_id_match(mock_document_review, TEST_NHS_NUMBER)


def test_validate_patient_id_match_raises_exception_when_nhs_numbers_dont_match(
    mock_service, mock_document_review
):
    with pytest.raises(UpdateDocumentReviewException) as exc_info:
        mock_service._validate_patient_id_match(
            mock_document_review, TEST_DIFFERENT_NHS_NUMBER
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.error == LambdaError.UpdateDocNHSNumberMismatch


@pytest.mark.parametrize(
    "valid_status",
    [
        DocumentReviewStatus.PENDING_REVIEW,
    ],
)
def test_validate_review_status_passes_when_status_is_valid(
    mock_service, mock_document_review, valid_status
):
    mock_document_review.review_status = valid_status

    mock_service._validate_review_status(mock_document_review)


@pytest.mark.parametrize(
    "invalid_status",
    [
        DocumentReviewStatus.APPROVED,
        DocumentReviewStatus.REJECTED,
        DocumentReviewStatus.REJECTED_DUPLICATE,
        DocumentReviewStatus.REASSIGNED,
        DocumentReviewStatus.REASSIGNED_PATIENT_UNKNOWN,
    ],
)
def test_validate_review_status_raises_exception_when_status_is_not_valid_for_update(
    mock_service, mock_document_review, invalid_status
):
    mock_document_review.review_status = invalid_status

    with pytest.raises(UpdateDocumentReviewException) as exc_info:
        mock_service._validate_review_status(mock_document_review)

    assert exc_info.value.status_code == 400
    assert exc_info.value.error == LambdaError.DocumentReviewStatusUpdateUnavailable


def test_validate_user_match_custodian_succeeds_when_ods_codes_match(
    mock_service, mock_document_review
):
    mock_service._validate_user_match_custodian(
        mock_document_review, TEST_REVIEWER_ODS_CODE
    )


def test_validate_user_match_custodian_raises_exception_when_ods_codes_dont_match(
    mock_service, mock_document_review
):
    with pytest.raises(UpdateDocumentReviewException) as exc_info:
        mock_service._validate_user_match_custodian(
            mock_document_review, "DIFFERENT_ODS"
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.error == LambdaError.DocumentReferenceUnauthorised


def test_validate_document_for_update_calls_all_validation_methods(
    mock_service, mock_document_review, mocker
):
    mock_validate_patient = mocker.patch.object(
        mock_service, "_validate_patient_id_match"
    )
    mock_validate_status = mocker.patch.object(mock_service, "_validate_review_status")
    mock_validate_custodian = mocker.patch.object(
        mock_service, "_validate_user_match_custodian"
    )

    mock_service._validate_document_for_update(
        mock_document_review, TEST_NHS_NUMBER, TEST_REVIEWER_ODS_CODE
    )

    mock_validate_patient.assert_called_once_with(mock_document_review, TEST_NHS_NUMBER)
    mock_validate_status.assert_called_once_with(mock_document_review)
    mock_validate_custodian.assert_called_once_with(
        mock_document_review, TEST_REVIEWER_ODS_CODE
    )


def test_create_reassigned_document_sets_new_nhs_number_for_normal_reassignment(
    mock_service, mock_document_review, mock_pds_service
):
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.REASSIGNED,
        nhs_number=TEST_REASSIGNED_NHS_NUMBER,
    )

    result = mock_service._create_reassigned_document(mock_document_review, update_data)

    assert result.nhs_number == TEST_REASSIGNED_NHS_NUMBER
    assert result.review_status == DocumentReviewStatus.PENDING_REVIEW
    assert result.version == 2
    assert result.custodian == TEST_NEW_ODS_CODE
    assert result.review_date is None
    assert result.reviewer is None
    mock_pds_service.fetch_patient_details.assert_called_once_with(
        TEST_REASSIGNED_NHS_NUMBER
    )


def test_create_reassigned_document_sets_unknown_nhs_number_for_unknown_patient(
    mock_service, mock_document_review, mock_pds_service
):
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.REASSIGNED_PATIENT_UNKNOWN,
        nhs_number=TEST_REASSIGNED_NHS_NUMBER,
    )

    result = mock_service._create_reassigned_document(mock_document_review, update_data)

    assert result.nhs_number == "0000000000"
    assert result.review_status == DocumentReviewStatus.PENDING_REVIEW
    assert result.version == 2
    assert result.custodian == PCSE_ODS_CODE
    assert result.review_date is None
    assert result.reviewer is None
    mock_pds_service.fetch_patient_details.assert_not_called()


def test_create_reassigned_document_increments_version(
    mock_service, mock_document_review, mock_pds_service
):
    mock_document_review.version = 3
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.REASSIGNED,
        nhs_number=TEST_REASSIGNED_NHS_NUMBER,
    )

    result = mock_service._create_reassigned_document(mock_document_review, update_data)

    assert result.version == 4


def test_create_reassigned_document_preserves_document_id(
    mock_service, mock_document_review, mock_pds_service
):
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.REASSIGNED,
        nhs_number=TEST_REASSIGNED_NHS_NUMBER,
    )

    result = mock_service._create_reassigned_document(mock_document_review, update_data)

    assert result.id == TEST_DOCUMENT_ID


@freeze_time(TEST_FROZEN_TIME)
def test_process_review_status_update_calls_approved_service_for_approval(
    mock_service, mock_document_review
):
    mock_document_review.review_status = DocumentReviewStatus.PENDING_REVIEW
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.APPROVED,
        document_reference_id=TEST_DOCUMENT_REFERENCE_ID,
    )

    mock_service._process_review_status_update(
        mock_document_review, update_data, TEST_DOCUMENT_ID, TEST_REVIEWER_ODS_CODE
    )

    mock_service.document_review_service.update_pending_review_status.assert_called_once()
    call_args = (
        mock_service.document_review_service.update_pending_review_status.call_args
    )
    assert (
        call_args.kwargs["review_update"].document_reference_id
        == TEST_DOCUMENT_REFERENCE_ID
    )
    assert call_args.kwargs["field_names"] == {
        "review_status",
        "document_reference_id",
        "reviewer",
        "review_date",
    }


@freeze_time(TEST_FROZEN_TIME)
@pytest.mark.parametrize(
    "rejection_status",
    [DocumentReviewStatus.REJECTED, DocumentReviewStatus.REJECTED_DUPLICATE],
)
def test_process_review_status_update_calls_pending_service_for_rejection(
    mock_service, mock_document_review, rejection_status
):
    update_data = PatchDocumentReviewRequest(review_status=rejection_status)

    mock_service._process_review_status_update(
        mock_document_review, update_data, TEST_DOCUMENT_ID, TEST_REVIEWER_ODS_CODE
    )

    mock_service.document_review_service.update_pending_review_status.assert_called_once()
    call_args = (
        mock_service.document_review_service.update_pending_review_status.call_args
    )
    assert call_args.kwargs["review_update"].review_status == rejection_status
    assert call_args.kwargs["field_names"] == {
        "review_status",
        "review_date",
        "reviewer",
    }


@freeze_time(TEST_FROZEN_TIME)
@pytest.mark.parametrize(
    "reassign_status",
    [DocumentReviewStatus.REASSIGNED, DocumentReviewStatus.REASSIGNED_PATIENT_UNKNOWN],
)
def test_process_review_status_update_calls_handle_reassignment_for_reassignment(
    mock_service, mock_document_review, reassign_status, mocker
):
    update_data = PatchDocumentReviewRequest(
        review_status=reassign_status,
        nhs_number=TEST_REASSIGNED_NHS_NUMBER,
    )
    mock_handle = mocker.patch.object(mock_service, "_handle_reassignment_status")

    mock_service._process_review_status_update(
        mock_document_review, update_data, TEST_DOCUMENT_ID, TEST_REVIEWER_ODS_CODE
    )

    mock_handle.assert_called_once_with(
        mock_document_review, update_data, TEST_DOCUMENT_ID
    )



@freeze_time(TEST_FROZEN_TIME)
def test_process_review_status_update_calls_soft_delete_for_approval(
    mock_service, mock_document_review, mocker
):
    mock_document_review.review_status = DocumentReviewStatus.PENDING_REVIEW
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.APPROVED,
        document_reference_id=TEST_DOCUMENT_REFERENCE_ID,
    )
    mock_soft_delete = mocker.patch.object(mock_service, "_handle_soft_delete")

    mock_service._process_review_status_update(
        mock_document_review, update_data, TEST_DOCUMENT_ID, TEST_REVIEWER_ODS_CODE
    )

    mock_soft_delete.assert_called_once_with(mock_document_review)


@freeze_time(TEST_FROZEN_TIME)
@pytest.mark.parametrize(
    "rejection_status",
    [DocumentReviewStatus.REJECTED, DocumentReviewStatus.REJECTED_DUPLICATE],
)
def test_process_review_status_update_calls_soft_delete_for_rejection(
    mock_service, mock_document_review, rejection_status, mocker
):
    update_data = PatchDocumentReviewRequest(review_status=rejection_status)
    mock_soft_delete = mocker.patch.object(mock_service, "_handle_soft_delete")

    mock_service._process_review_status_update(
        mock_document_review, update_data, TEST_DOCUMENT_ID, TEST_REVIEWER_ODS_CODE
    )

    mock_soft_delete.assert_called_once_with(mock_document_review)


def test_handle_soft_delete_calls_delete_document_review_files(
    mock_service, mock_document_review
):
    mock_service._handle_soft_delete(mock_document_review)

    mock_service.document_review_service.delete_document_review_files.assert_called_once_with(
        mock_document_review
    )


@freeze_time(TEST_FROZEN_TIME)
def test_handle_reassignment_status_creates_new_document_and_updates_with_transaction(
    mock_service, mock_document_review, mock_pds_service
):
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.REASSIGNED,
        nhs_number=TEST_REASSIGNED_NHS_NUMBER,
    )

    mock_service._handle_reassignment_status(
        mock_document_review, update_data, TEST_DOCUMENT_ID
    )

    mock_service.document_review_service.update_document_review_with_transaction.assert_called_once()
    call_args = (
        mock_service.document_review_service.update_document_review_with_transaction.call_args
    )

    new_review = call_args.kwargs["new_review_item"]
    existing_review = call_args.kwargs["existing_review_item"]

    assert new_review.nhs_number == TEST_REASSIGNED_NHS_NUMBER
    assert new_review.version == 2
    assert existing_review == mock_document_review
    assert existing_review.version == 1


@pytest.mark.parametrize(
    "invalid_target_status",
    [
        DocumentReviewStatus.PENDING_REVIEW,
        DocumentReviewStatus.REJECTED,
        DocumentReviewStatus.REJECTED_DUPLICATE,
        DocumentReviewStatus.REASSIGNED,
        DocumentReviewStatus.REASSIGNED_PATIENT_UNKNOWN,
    ],
)
def test_update_document_review_raises_exception_when_updating_approved_to_invalid_status(
    mock_service, mock_document_review, invalid_target_status
):
    mock_document_review.review_status = DocumentReviewStatus.APPROVED
    update_data = PatchDocumentReviewRequest(
        review_status=invalid_target_status,
        nhs_number=(
            TEST_REASSIGNED_NHS_NUMBER
            if "REASSIGNED" in invalid_target_status.value
            else None
        ),
    )
    mock_service.document_review_service.get_document_review_by_id.return_value = (
        mock_document_review
    )

    with pytest.raises(UpdateDocumentReviewException) as exc_info:
        mock_service.update_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            document_version=TEST_VERSION,
            update_data=update_data,
            reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.error == LambdaError.DocumentReviewStatusUpdateUnavailable


@pytest.mark.parametrize(
    "from_status",
    [
        DocumentReviewStatus.APPROVED,
        DocumentReviewStatus.REJECTED,
        DocumentReviewStatus.REJECTED_DUPLICATE,
        DocumentReviewStatus.REASSIGNED,
        DocumentReviewStatus.REASSIGNED_PATIENT_UNKNOWN,
    ],
)
def test_update_document_review_raises_exception_when_approving_from_non_approved_pending_status(
    mock_service, mock_document_review, from_status
):
    mock_document_review.review_status = from_status
    update_data = PatchDocumentReviewRequest(
        review_status=DocumentReviewStatus.APPROVED,
        document_reference_id=TEST_DOCUMENT_REFERENCE_ID,
    )
    mock_service.document_review_service.get_document_review_by_id.return_value = (
        mock_document_review
    )

    with pytest.raises(UpdateDocumentReviewException) as exc_info:
        mock_service.update_document_review(
            patient_id=TEST_NHS_NUMBER,
            document_id=TEST_DOCUMENT_ID,
            document_version=TEST_VERSION,
            update_data=update_data,
            reviewer_ods_code=TEST_REVIEWER_ODS_CODE,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.error == LambdaError.DocumentReviewStatusUpdateUnavailable
