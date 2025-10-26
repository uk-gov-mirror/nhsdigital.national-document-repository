from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError
from enums.review_status import ReviewStatus
from models.document_review import DocumentsUploadReview
from models.sqs.review_message_body import ReviewMessageBody
from services.review_processor_service import ReviewProcessorService
from utils.exceptions import S3FileNotFoundException


@pytest.fixture
def mock_dynamo_service(mocker):
    """Mock the DynamoDBService."""
    return mocker.patch("services.review_processor_service.DynamoDBService")


@pytest.fixture
def mock_s3_service(mocker):
    """Mock the S3Service."""
    return mocker.patch("services.review_processor_service.S3Service")


@pytest.fixture
def set_review_env(monkeypatch):
    """Set up environment variables required for the service."""
    monkeypatch.setenv("DOCUMENT_REVIEW_DYNAMODB_NAME", "test_review_table")
    monkeypatch.setenv("STAGING_STORE_BUCKET_NAME", "test_staging_bucket")
    monkeypatch.setenv("PENDING_REVIEW_BUCKET_NAME", "test_review_bucket")


@pytest.fixture
def service_under_test(set_review_env, mock_dynamo_service, mock_s3_service):
    """Create a ReviewProcessorService instance with mocked dependencies."""
    service = ReviewProcessorService()
    return service


@pytest.fixture
def sample_review_message():
    """Create a sample review message."""
    return ReviewMessageBody(
        file_name="test_document.pdf",
        file_path="staging/9000000009/test_document.pdf",
        nhs_number="9000000009",
        failure_reason="Failed virus scan",
        upload_date="2024-01-15T10:30:00Z",
        uploader_ods="Y12345",
        current_gp="Y12345",
    )


# Test service initialization


def test_service_initializes_with_correct_environment_variables(
    set_review_env, mock_dynamo_service, mock_s3_service
):
    """Test service initializes correctly with environment variables."""
    service = ReviewProcessorService()

    assert service.review_table_name == "test_review_table"
    assert service.staging_bucket_name == "test_staging_bucket"
    assert service.review_bucket_name == "test_review_bucket"
    mock_dynamo_service.assert_called_once()
    mock_s3_service.assert_called_once()


# Tests for process_review_message method


def test_process_review_message_success(
    service_under_test, sample_review_message, mocker
):
    """Test successful processing of a review message."""
    # Mock all the internal methods
    mock_verify = mocker.patch.object(
        service_under_test, "_verify_file_exists_in_staging"
    )
    mock_create = mocker.patch.object(service_under_test, "_create_review_record")
    mock_move = mocker.patch.object(
        service_under_test, "_move_file_to_review_bucket"
    )
    mock_update = mocker.patch.object(
        service_under_test, "_update_review_record_with_file_location"
    )

    # Configure return values
    mock_review = MagicMock()
    mock_review.id = "test-review-id"
    mock_create.return_value = mock_review
    mock_move.return_value = "9000000009/test-review-id/test_document.pdf"

    # Execute
    service_under_test.process_review_message(sample_review_message)

    # Verify calls
    mock_verify.assert_called_once_with(sample_review_message.file_path)
    mock_create.assert_called_once_with(sample_review_message)
    mock_move.assert_called_once_with(sample_review_message, "test-review-id")
    mock_update.assert_called_once_with(
        "test-review-id", "9000000009/test-review-id/test_document.pdf"
    )


def test_process_review_message_file_not_found(
    service_under_test, sample_review_message, mocker
):
    """Test processing fails when file doesn't exist in staging."""
    mocker.patch.object(
        service_under_test,
        "_verify_file_exists_in_staging",
        side_effect=S3FileNotFoundException("File not found"),
    )

    with pytest.raises(S3FileNotFoundException, match="File not found"):
        service_under_test.process_review_message(sample_review_message)


def test_process_review_message_dynamo_error(
    service_under_test, sample_review_message, mocker
):
    """Test processing fails when DynamoDB create fails."""
    mocker.patch.object(service_under_test, "_verify_file_exists_in_staging")
    mocker.patch.object(
        service_under_test,
        "_create_review_record",
        side_effect=ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "DynamoDB error"}},
            "PutItem",
        ),
    )

    with pytest.raises(ClientError):
        service_under_test.process_review_message(sample_review_message)


def test_process_review_message_s3_copy_error(
    service_under_test, sample_review_message, mocker
):
    """Test processing fails when S3 copy operation fails."""
    mocker.patch.object(service_under_test, "_verify_file_exists_in_staging")
    mock_review = MagicMock()
    mock_review.id = "test-review-id"
    mocker.patch.object(
        service_under_test, "_create_review_record", return_value=mock_review
    )
    mocker.patch.object(
        service_under_test,
        "_move_file_to_review_bucket",
        side_effect=ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "Source file not found"}},
            "CopyObject",
        ),
    )

    with pytest.raises(ClientError):
        service_under_test.process_review_message(sample_review_message)


# Tests for _verify_file_exists_in_staging method


def test_verify_file_exists_success(service_under_test):
    """Test successful file verification."""
    service_under_test.s3_service.file_exist_on_s3.return_value = True

    # Should not raise exception
    service_under_test._verify_file_exists_in_staging("staging/test.pdf")

    service_under_test.s3_service.file_exist_on_s3.assert_called_once_with(
        s3_bucket_name="test_staging_bucket", file_key="staging/test.pdf"
    )


def test_verify_file_does_not_exist(service_under_test):
    """Test file verification fails when file doesn't exist."""
    service_under_test.s3_service.file_exist_on_s3.return_value = False

    with pytest.raises(
        S3FileNotFoundException, match="File not found in staging bucket"
    ):
        service_under_test._verify_file_exists_in_staging("staging/missing.pdf")


def test_verify_file_s3_error(service_under_test):
    """Test file verification handles S3 errors."""
    service_under_test.s3_service.file_exist_on_s3.side_effect = ClientError(
        {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
        "HeadObject",
    )

    with pytest.raises(ClientError):
        service_under_test._verify_file_exists_in_staging("staging/test.pdf")


# Tests for _create_review_record method


def test_create_review_record_success(
    service_under_test, sample_review_message, mocker
):
    """Test successful creation of review record."""
    # Mock the DynamoDB create_item to succeed
    service_under_test.dynamo_service.create_item.return_value = None

    result = service_under_test._create_review_record(sample_review_message)

    # Verify the result
    assert isinstance(result, DocumentsUploadReview)
    assert result.nhs_number == "9000000009"
    assert result.review_status == ReviewStatus.PENDING_REVIEW
    assert result.review_reason == "Failed virus scan"
    assert result.author == "Y12345"
    assert result.custodian == "Y12345"
    assert len(result.files) == 1
    assert result.files[0].file_name == "test_document.pdf"
    assert result.files[0].file_location == "staging/9000000009/test_document.pdf"

    # Verify upload_date is converted to timestamp
    expected_timestamp = int(
        datetime.fromisoformat("2024-01-15T10:30:00Z")
        .replace(tzinfo=timezone.utc)
        .timestamp()
    )
    assert result.upload_date == expected_timestamp

    # Verify DynamoDB was called
    service_under_test.dynamo_service.create_item.assert_called_once()
    call_args = service_under_test.dynamo_service.create_item.call_args
    assert call_args[1]["table_name"] == "test_review_table"


def test_create_review_record_with_different_data(service_under_test, mocker):
    """Test creation with different message data."""
    message = ReviewMessageBody(
        file_name="another_doc.pdf",
        file_path="staging/9000000010/another_doc.pdf",
        nhs_number="9000000010",
        failure_reason="Missing metadata",
        upload_date="2024-02-20T14:45:30Z",
        uploader_ods="Y67890",
        current_gp="Y67890",
    )

    service_under_test.dynamo_service.create_item.return_value = None

    result = service_under_test._create_review_record(message)

    assert result.nhs_number == "9000000010"
    assert result.review_reason == "Missing metadata"
    assert result.author == "Y67890"
    assert result.custodian == "Y67890"


def test_create_review_record_dynamo_error(
    service_under_test, sample_review_message
):
    """Test create record handles DynamoDB errors."""
    service_under_test.dynamo_service.create_item.side_effect = ClientError(
        {"Error": {"Code": "ValidationException", "Message": "Invalid item"}},
        "PutItem",
    )

    with pytest.raises(ClientError):
        service_under_test._create_review_record(sample_review_message)


# Tests for _move_file_to_review_bucket method


def test_move_file_success(service_under_test, sample_review_message, mocker):
    """Test successful file move from staging to review bucket."""
    mocker.patch.object(service_under_test, "_delete_from_staging")

    new_file_key = service_under_test._move_file_to_review_bucket(
        sample_review_message, "test-review-id-123"
    )

    # Verify new file key format
    expected_key = "9000000009/test-review-id-123/test_document.pdf"
    assert new_file_key == expected_key

    # Verify S3 copy was called
    service_under_test.s3_service.copy_across_bucket.assert_called_once_with(
        source_bucket="test_staging_bucket",
        source_file_key="staging/9000000009/test_document.pdf",
        dest_bucket="test_review_bucket",
        dest_file_key=expected_key,
    )

    # Verify delete was called
    service_under_test._delete_from_staging.assert_called_once_with(
        "staging/9000000009/test_document.pdf"
    )


def test_move_file_copy_error(service_under_test, sample_review_message, mocker):
    """Test file move handles S3 copy errors."""
    service_under_test.s3_service.copy_across_bucket.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "Source not found"}},
        "CopyObject",
    )

    with pytest.raises(ClientError):
        service_under_test._move_file_to_review_bucket(
            sample_review_message, "test-review-id"
        )


def test_move_file_delete_error(service_under_test, sample_review_message, mocker):
    """Test file move handles delete errors."""
    mocker.patch.object(
        service_under_test,
        "_delete_from_staging",
        side_effect=ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "DeleteObject",
        ),
    )

    with pytest.raises(ClientError):
        service_under_test._move_file_to_review_bucket(
            sample_review_message, "test-review-id"
        )


# Tests for _delete_from_staging method


def test_delete_from_staging_success(service_under_test):
    """Test successful deletion from staging bucket."""
    service_under_test._delete_from_staging("staging/test.pdf")

    service_under_test.s3_service.delete_object.assert_called_once_with(
        s3_bucket_name="test_staging_bucket", file_key="staging/test.pdf"
    )


def test_delete_from_staging_error(service_under_test):
    """Test delete from staging handles S3 errors."""
    service_under_test.s3_service.delete_object.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "Key does not exist"}},
        "DeleteObject",
    )

    with pytest.raises(ClientError):
        service_under_test._delete_from_staging("staging/test.pdf")


# Tests for _update_review_record_with_file_location method


def test_update_review_record_success(service_under_test):
    """Test successful update of review record with file location."""
    service_under_test._update_review_record_with_file_location(
        "test-review-id", "9000000009/test-review-id/test.pdf"
    )

    service_under_test.dynamo_service.update_item.assert_called_once_with(
        table_name="test_review_table",
        key_pair={"ID": "test-review-id"},
        updated_fields={"ReviewBucketPath": "9000000009/test-review-id/test.pdf"},
    )


def test_update_review_record_dynamo_error(service_under_test, mocker):
    """Test update review record handles DynamoDB errors gracefully."""
    service_under_test.dynamo_service.update_item.side_effect = ClientError(
        {"Error": {"Code": "ConditionalCheckFailedException", "Message": "Failed"}},
        "UpdateItem",
    )

    # Mock logger to verify warning is logged
    mock_logger = mocker.patch("services.review_processor_service.logger")

    # Should not raise - method logs error and warning instead
    service_under_test._update_review_record_with_file_location(
        "test-review-id", "path/to/file.pdf"
    )

    # Verify error and warning were logged
    assert mock_logger.error.called
    assert mock_logger.warning.called


# Integration scenario tests


def test_full_workflow_with_valid_message(
    service_under_test, sample_review_message, mocker
):
    """Test complete workflow from message to final update."""
    # Set up mocks
    service_under_test.s3_service.file_exist_on_s3.return_value = True
    service_under_test.dynamo_service.create_item.return_value = None
    service_under_test.s3_service.copy_across_bucket.return_value = None
    service_under_test.s3_service.delete_object.return_value = None
    service_under_test.dynamo_service.update_item.return_value = None

    # Execute full workflow
    service_under_test.process_review_message(sample_review_message)

    # Verify all steps were executed
    service_under_test.s3_service.file_exist_on_s3.assert_called_once()
    service_under_test.dynamo_service.create_item.assert_called_once()
    service_under_test.s3_service.copy_across_bucket.assert_called_once()
    service_under_test.s3_service.delete_object.assert_called_once()
    service_under_test.dynamo_service.update_item.assert_called_once()


def test_workflow_stops_at_verification_failure(
    service_under_test, sample_review_message
):
    """Test workflow stops if file verification fails."""
    service_under_test.s3_service.file_exist_on_s3.return_value = False

    with pytest.raises(S3FileNotFoundException):
        service_under_test.process_review_message(sample_review_message)

    # Verify subsequent operations were not called
    service_under_test.dynamo_service.create_item.assert_not_called()
    service_under_test.s3_service.copy_across_bucket.assert_not_called()


def test_workflow_handles_multiple_different_patients(service_under_test, mocker):
    """Test processing messages for different patients."""
    service_under_test.s3_service.file_exist_on_s3.return_value = True
    service_under_test.dynamo_service.create_item.return_value = None
    service_under_test.s3_service.copy_across_bucket.return_value = None
    service_under_test.s3_service.delete_object.return_value = None
    service_under_test.dynamo_service.update_item.return_value = None

    messages = [
        ReviewMessageBody(
            file_name=f"doc_{i}.pdf",
            file_path=f"staging/900000000{i}/doc_{i}.pdf",
            nhs_number=f"900000000{i}",
            failure_reason="Test failure",
            upload_date="2024-01-15T10:30:00Z",
            uploader_ods="Y12345",
            current_gp="Y12345",
        )
        for i in range(1, 4)
    ]

    for message in messages:
        service_under_test.process_review_message(message)

    # Verify service was called for each message
    assert service_under_test.dynamo_service.create_item.call_count == 3
    assert service_under_test.s3_service.copy_across_bucket.call_count == 3
