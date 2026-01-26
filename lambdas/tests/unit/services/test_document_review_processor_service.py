import pytest
from botocore.exceptions import ClientError
from enums.document_review_reason import DocumentReviewReason
from enums.document_review_status import DocumentReviewStatus
from models.document_review import (
    DocumentReviewFileDetails,
    DocumentUploadReviewReference,
)
from models.pds_models import PatientDetails
from models.sqs.review_message_body import ReviewMessageBody, ReviewMessageFile
from services.document_review_processor_service import ReviewProcessorService
from utils.exceptions import PdsErrorException, InvalidResourceIdException, PatientNotFoundException


@pytest.fixture
def mock_document_upload_review_service(mocker):
    return mocker.patch(
        "services.document_review_processor_service.DocumentUploadReviewService"
    )


@pytest.fixture
def mock_s3_service(mocker):
    return mocker.patch("services.document_review_processor_service.S3Service")


@pytest.fixture
def service_under_test(set_env, mock_document_upload_review_service, mock_s3_service):
    service = ReviewProcessorService()
    return service


@pytest.fixture
def sample_review_message():
    return ReviewMessageBody(
        upload_id="test-upload-id-123",
        files=[
            ReviewMessageFile(
                file_name="test_document.pdf",
                file_path="staging/9000000009/test_document.pdf",
            )
        ],
        nhs_number="9000000009",
        failure_reason=DocumentReviewReason.UNSUCCESSFUL_UPLOAD,
        uploader_ods="Y12345",
    )


@pytest.fixture
def mock_pds_service(mocker):
    mock_pds = mocker.MagicMock()
    mock_patient_details = PatientDetails(
        nhsNumber="9000000009",
        generalPracticeOds="Y67890",
        superseded=False,
        restricted=False,
    )
    mock_pds.fetch_patient_details.return_value = mock_patient_details
    mocker.patch(
        "services.document_review_processor_service.get_pds_service",
        return_value=mock_pds,
    )
    return mock_pds


def test_service_initializes_with_correct_environment_variables(
    set_env, mock_document_upload_review_service, mock_s3_service
):
    service = ReviewProcessorService()

    assert service.review_table_name == "test_document_review"
    assert service.staging_bucket_name == "test_staging_bulk_store"
    assert service.review_bucket_name == "test_document_review_bucket"
    mock_document_upload_review_service.assert_called_once()
    mock_s3_service.assert_called_once()


def test_process_review_message_success(
    service_under_test, sample_review_message, mocker
):
    mock_move = mocker.patch.object(service_under_test, "_move_files_to_review_bucket")
    mock_delete = mocker.patch.object(service_under_test, "_delete_files_from_staging")

    mock_move.return_value = [
        DocumentReviewFileDetails(
            file_name="test_document.pdf",
            file_location="9000000009/test-upload-id-123/test_document.pdf",
        )
    ]

    service_under_test.process_review_message(sample_review_message)

    mock_move.assert_called_once()
    service_under_test.document_review_service.create_dynamo_entry.assert_called_once()
    mock_delete.assert_called_once_with(sample_review_message)


def test_process_review_message_multiple_files(service_under_test, mocker):
    message = ReviewMessageBody(
        upload_id="test-upload-id-456",
        files=[
            ReviewMessageFile(
                file_name="document_1.pdf",
                file_path="staging/9000000009/document_1.pdf",
            ),
            ReviewMessageFile(
                file_name="document_2.pdf",
                file_path="staging/9000000009/document_2.pdf",
            ),
        ],
        nhs_number="9000000009",
        failure_reason=DocumentReviewReason.UNSUCCESSFUL_UPLOAD,
        uploader_ods="Y12345",
    )

    mock_move = mocker.patch.object(service_under_test, "_move_files_to_review_bucket")
    mock_delete = mocker.patch.object(service_under_test, "_delete_files_from_staging")

    mock_move.return_value = [
        DocumentReviewFileDetails(
            file_name="document_1.pdf",
            file_location="9000000009/test-upload-id-456/document_1.pdf",
        ),
        DocumentReviewFileDetails(
            file_name="document_2.pdf",
            file_location="9000000009/test-upload-id-456/document_2.pdf",
        ),
    ]

    service_under_test.process_review_message(message)

    mock_move.assert_called_once()
    service_under_test.document_review_service.create_dynamo_entry.assert_called_once()
    mock_delete.assert_called_once_with(message)


def test_process_review_message_s3_copy_error(
    service_under_test, sample_review_message, mocker
):
    mocker.patch.object(
        service_under_test,
        "_move_files_to_review_bucket",
        side_effect=ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "Source file not found"}},
            "CopyObject",
        ),
    )

    with pytest.raises(ClientError):
        service_under_test.process_review_message(sample_review_message)


def test_process_review_message_dynamo_error_not_precondition(
    service_under_test, sample_review_message, mocker
):
    mocker.patch.object(
        service_under_test,
        "_move_files_to_review_bucket",
        return_value=[
            DocumentReviewFileDetails(
                file_name="document_1.pdf",
                file_location="9000000009/test-upload-id-456/document_1.pdf",
            )
        ],
    )
    service_under_test.document_review_service.create_dynamo_entry.side_effect = (
        ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "DynamoDB error"}},
            "PutItem",
        )
    )

    with pytest.raises(ClientError):
        service_under_test.process_review_message(sample_review_message)


def test_process_review_message_continues_dynamo_conditional_check_failure(
    service_under_test, sample_review_message, mocker
):
    mocker.patch.object(
        service_under_test,
        "_move_files_to_review_bucket",
        return_value=[
            DocumentReviewFileDetails(
                file_name="document_1.pdf",
                file_location="9000000009/test-upload-id-456/document_1.pdf",
            )
        ],
    )
    mocker.patch.object(service_under_test, "_delete_files_from_staging")
    service_under_test.document_review_service.create_dynamo_entry.side_effect = (
        ClientError(
            {
                "Error": {
                    "Code": "ConditionalCheckFailedException",
                    "Message": "DynamoDB error",
                }
            },
            "PutItem",
        )
    )

    service_under_test.process_review_message(sample_review_message)

    service_under_test._delete_files_from_staging.assert_called()


def test_build_review_record_success(service_under_test, sample_review_message):
    files = [
        DocumentReviewFileDetails(
            file_name="test_document.pdf",
            file_location="9000000009/test-review-id/test_document.pdf",
        )
    ]

    result = service_under_test._build_review_record(
        sample_review_message, "test-review-id", files, "Y12345"
    )

    assert isinstance(result, DocumentUploadReviewReference)
    assert result.id == "test-review-id"
    assert result.nhs_number == "9000000009"
    assert result.review_status == DocumentReviewStatus.PENDING_REVIEW
    assert result.review_reason == "Unsuccessful upload"
    assert result.author == "Y12345"
    assert result.custodian == "Y12345"
    assert len(result.files) == 1
    assert result.files[0].file_name == "test_document.pdf"
    assert (
        result.files[0].file_location == "9000000009/test-review-id/test_document.pdf"
    )


def test_build_review_record_with_multiple_files(service_under_test):
    message = ReviewMessageBody(
        upload_id="test-upload-id-789",
        files=[
            ReviewMessageFile(
                file_name="document_1.pdf",
                file_path="staging/9000000009/document_1.pdf",
            ),
            ReviewMessageFile(
                file_name="document_2.pdf",
                file_path="staging/9000000009/document_2.pdf",
            ),
        ],
        nhs_number="9000000009",
        failure_reason=DocumentReviewReason.UNSUCCESSFUL_UPLOAD,
        uploader_ods="Y12345",
    )

    files = [
        DocumentReviewFileDetails(
            file_name="document_1.pdf",
            file_location="9000000009/test-review-id/document_1.pdf",
        ),
        DocumentReviewFileDetails(
            file_name="document_2.pdf",
            file_location="9000000009/test-review-id/document_2.pdf",
        ),
    ]

    result = service_under_test._build_review_record(
        message, "test-review-id", files, "Y12345"
    )

    assert len(result.files) == 2
    assert result.files[0].file_name == "document_1.pdf"
    assert result.files[1].file_name == "document_2.pdf"


def test_move_files_success(service_under_test, sample_review_message, mocker):
    mocker.patch("uuid.uuid4", return_value="123412342")

    files = service_under_test._move_files_to_review_bucket(
        sample_review_message, "test-review-id-123"
    )

    expected_key = "test-review-id-123/123412342"

    assert len(files) == 1
    assert files[0].file_name == "test_document.pdf"
    assert files[0].file_location == expected_key

    service_under_test.s3_service.copy_across_bucket.assert_called_once_with(
        source_bucket="test_staging_bulk_store",
        source_file_key="staging/9000000009/test_document.pdf",
        dest_bucket="test_document_review_bucket",
        dest_file_key=expected_key,
        if_none_match=True,
    )


def test_move_multiple_files_success(service_under_test, mocker):
    message = ReviewMessageBody(
        upload_id="test-upload-id-999",
        files=[
            ReviewMessageFile(
                file_name="document_1.pdf",
                file_path="staging/9000000009/document_1.pdf",
            ),
            ReviewMessageFile(
                file_name="document_2.pdf",
                file_path="staging/9000000009/document_2.pdf",
            ),
        ],
        nhs_number="9000000009",
        failure_reason=DocumentReviewReason.UNSUCCESSFUL_UPLOAD,
        uploader_ods="Y12345",
    )
    mocker.patch("uuid.uuid4", side_effect=["123412342", "56785678"])

    files = service_under_test._move_files_to_review_bucket(message, "test-review-id")

    assert len(files) == 2
    assert files[0].file_name == "document_1.pdf"
    assert files[0].file_location == "test-review-id/123412342"
    assert files[1].file_name == "document_2.pdf"
    assert files[1].file_location == "test-review-id/56785678"

    assert service_under_test.s3_service.copy_across_bucket.call_count == 2


def test_move_files_copy_error(service_under_test, sample_review_message):
    service_under_test.s3_service.copy_across_bucket.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "Source not found"}},
        "CopyObject",
    )

    with pytest.raises(ClientError):
        service_under_test._move_files_to_review_bucket(
            sample_review_message, "test-review-id"
        )


def test_move_files_to_review_bucket_continues_file_already_exists_in_review_bucket(
    service_under_test, sample_review_message
):
    service_under_test.s3_service.copy_across_bucket.side_effect = ClientError(
        {
            "Error": {
                "Code": "PreconditionFailed",
                "Message": "At least one of the pre-conditions you specified did not hold",
            }
        },
        "CopyObject",
    )

    service_under_test.process_review_message(sample_review_message)
    service_under_test.document_review_service.create_dynamo_entry.assert_called()


def test_delete_from_staging_success(service_under_test, sample_review_message):
    service_under_test._delete_files_from_staging(sample_review_message)

    service_under_test.s3_service.delete_object.assert_called_once_with(
        s3_bucket_name="test_staging_bulk_store",
        file_key="staging/9000000009/test_document.pdf",
    )


def test_delete_from_staging_handles_errors(service_under_test, sample_review_message):
    service_under_test.s3_service.delete_object.side_effect = ClientError(
        {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
        "DeleteObject",
    )

    # Should not raise exception - errors are caught and logged
    service_under_test._delete_files_from_staging(sample_review_message)

    service_under_test.s3_service.delete_object.assert_called_once()


def test_full_workflow_with_valid_message(service_under_test, sample_review_message):
    service_under_test.document_review_service.create_dynamo_entry.return_value = None
    service_under_test.s3_service.copy_across_bucket.return_value = None
    service_under_test.s3_service.delete_object.return_value = None

    service_under_test.process_review_message(sample_review_message)

    service_under_test.document_review_service.create_dynamo_entry.assert_called_once()
    service_under_test.s3_service.copy_across_bucket.assert_called_once()
    service_under_test.s3_service.delete_object.assert_called_once()


def test_workflow_handles_multiple_different_patients(service_under_test):
    service_under_test.document_review_service.create_dynamo_entry.return_value = None
    service_under_test.s3_service.copy_across_bucket.return_value = None
    service_under_test.s3_service.delete_object.return_value = None

    messages = [
        ReviewMessageBody(
            upload_id=f"test-upload-id-{i}",
            files=[
                ReviewMessageFile(
                    file_name=f"doc_{i}.pdf",
                    file_path=f"staging/900000000{i}/doc_{i}.pdf",
                )
            ],
            nhs_number=f"900000000{i}",
            failure_reason=DocumentReviewReason.UNSUCCESSFUL_UPLOAD,
            uploader_ods="Y12345",
        )
        for i in range(1, 4)
    ]

    for message in messages:
        service_under_test.process_review_message(message)

    assert (
        service_under_test.document_review_service.create_dynamo_entry.call_count == 3
    )
    assert service_under_test.s3_service.copy_across_bucket.call_count == 3

def test_get_patient_custodian_returns_gp_ods_from_pds(
    service_under_test, sample_review_message, mock_pds_service
):
    result = service_under_test._get_patient_custodian(sample_review_message)

    assert result == "Y67890"
    mock_pds_service.fetch_patient_details.assert_called_once_with("9000000009")


def test_get_patient_custodian_returns_uploader_ods_when_nhs_number_is_none(
    service_under_test, mock_pds_service
):
    message = ReviewMessageBody(
        upload_id="test-upload-id",
        files=[
            ReviewMessageFile(
                file_name="test.pdf", file_path="staging/test/test.pdf"
            )
        ],
        nhs_number="",
        failure_reason=DocumentReviewReason.UNSUCCESSFUL_UPLOAD,
        uploader_ods="Y12345",
    )

    result = service_under_test._get_patient_custodian(message)

    assert result == "Y12345"
    mock_pds_service.fetch_patient_details.assert_not_called()


def test_get_patient_custodian_returns_uploader_ods_when_nhs_number_is_placeholder(
    service_under_test, mock_pds_service
):
    message = ReviewMessageBody(
        upload_id="test-upload-id",
        files=[
            ReviewMessageFile(
                file_name="test.pdf", file_path="staging/test/test.pdf"
            )
        ],
        nhs_number="0000000000",
        failure_reason=DocumentReviewReason.UNSUCCESSFUL_UPLOAD,
        uploader_ods="Y12345",
    )

    result = service_under_test._get_patient_custodian(message)

    assert result == "Y12345"
    mock_pds_service.fetch_patient_details.assert_not_called()


def test_get_patient_custodian_returns_uploader_ods_on_pds_error(
    service_under_test, sample_review_message, mock_pds_service
):

    mock_pds_service.fetch_patient_details.side_effect = PdsErrorException("PDS error")

    result = service_under_test._get_patient_custodian(sample_review_message)

    assert result == "Y12345"
    assert sample_review_message.nhs_number == "9000000009"


def test_get_patient_custodian_returns_uploader_ods_on_invalid_resource_id(
    service_under_test, sample_review_message, mock_pds_service
):

    mock_pds_service.fetch_patient_details.side_effect = InvalidResourceIdException(
        "Invalid NHS number"
    )

    result = service_under_test._get_patient_custodian(sample_review_message)

    assert result == "Y12345"
    assert sample_review_message.nhs_number == "0000000000"


def test_get_patient_custodian_handles_patient_not_found_sets_placeholder(
    service_under_test, sample_review_message, mock_pds_service
):
    mock_pds_service.fetch_patient_details.side_effect = PatientNotFoundException(
        "Patient not found"
    )

    result = service_under_test._get_patient_custodian(sample_review_message)

    assert result == "Y12345"
    assert sample_review_message.nhs_number == "0000000000"


