import pytest
from botocore.exceptions import ClientError
from enums.document_review_status import DocumentReviewStatus
from enums.virus_scan_result import VirusScanResult
from models.document_reference import S3_PREFIX
from models.document_review import (
    DocumentReviewFileDetails,
    DocumentUploadReviewReference,
)
from services.staged_document_review_processing_service import (
    StagedDocumentReviewProcessingService,
)
from tests.unit.conftest import (
    MOCK_DOCUMENT_REVIEW_BUCKET,
    MOCK_STAGING_STORE_BUCKET,
    TEST_NHS_NUMBER,
)


@pytest.fixture
def mock_service(set_env, mocker):
    mocker.patch(
        "services.staged_document_review_processing_service.DocumentUploadReviewService"
    )
    mocker.patch(
        "services.staged_document_review_processing_service.get_virus_scan_service"
    )
    mocker.patch("services.staged_document_review_processing_service.S3Service")
    service = StagedDocumentReviewProcessingService()
    yield service


@pytest.fixture
def mock_review_document_service(mocker, mock_service):
    mocker.patch.object(
        mock_service.review_document_service, "fetch_documents_from_table"
    )
    mocker.patch.object(
        mock_service.review_document_service, "update_document_review_status"
    )
    mocker.patch.object(
        mock_service.review_document_service, "build_review_dynamo_filter"
    )
    yield mock_service.review_document_service


@pytest.fixture
def mock_virus_scan_service(mocker, mock_service):
    mocker.patch.object(mock_service.virus_scan_service, "scan_file")
    yield mock_service.virus_scan_service


@pytest.fixture
def mock_s3_service(mocker, mock_service):
    mocker.patch.object(mock_service.s3_service, "copy_across_bucket")
    mocker.patch.object(mock_service.s3_service, "delete_object")
    yield mock_service.s3_service


@pytest.fixture
def sample_document_reference():
    return DocumentUploadReviewReference(
        id="test-upload-id",
        author="Y12345",
        custodian="Y12345",
        review_status=DocumentReviewStatus.REVIEW_PENDING_UPLOAD,
        review_reason="Test reason",
        upload_date=1704110400,
        files=[
            DocumentReviewFileDetails(
                file_name="test-document.pdf",
                file_location=f"s3://{MOCK_STAGING_STORE_BUCKET}/test-upload-id/test-document.pdf",
            )
        ],
        nhs_number=TEST_NHS_NUMBER,
    )


def test_handle_upload_document_reference_request_with_clean_virus_scan(
    mock_service,
    mock_review_document_service,
    mock_virus_scan_service,
    mock_s3_service,
    sample_document_reference,
):
    object_key = "test-upload-id/test-document.pdf"
    mock_review_document_service.fetch_documents_from_table.return_value = [
        sample_document_reference
    ]
    mock_virus_scan_service.scan_file.return_value = VirusScanResult.CLEAN.value
    mock_review_document_service.build_review_dynamo_filter.return_value = {}

    mock_service.handle_upload_document_reference_request(object_key)

    mock_virus_scan_service.scan_file.assert_called_once_with(
        object_key, nhs_number=TEST_NHS_NUMBER
    )
    mock_s3_service.copy_across_bucket.assert_called_once()
    mock_s3_service.delete_object.assert_called_once_with(
        MOCK_STAGING_STORE_BUCKET, object_key
    )
    mock_review_document_service.update_document_review_status.assert_called_once()
    assert (
        sample_document_reference.review_status == DocumentReviewStatus.PENDING_REVIEW
    )


def test_handle_upload_document_reference_request_with_infected_file(
    mock_service,
    mock_review_document_service,
    mock_virus_scan_service,
    mock_s3_service,
    sample_document_reference,
):
    object_key = "test-upload-id/test-document.pdf"
    mock_review_document_service.fetch_documents_from_table.return_value = [
        sample_document_reference
    ]
    mock_virus_scan_service.scan_file.return_value = VirusScanResult.INFECTED.value

    mock_service.handle_upload_document_reference_request(object_key)

    mock_virus_scan_service.scan_file.assert_called_once()
    mock_s3_service.copy_across_bucket.assert_not_called()
    mock_s3_service.delete_object.assert_not_called()
    mock_review_document_service.update_document_review_status.assert_called_once()
    assert (
        sample_document_reference.review_status
        == DocumentReviewStatus.VIRUS_SCAN_FAILED
    )


def test_handle_upload_document_reference_request_with_empty_object_key(
    mock_service,
    mock_review_document_service,
):
    mock_service.handle_upload_document_reference_request("")

    mock_review_document_service.fetch_documents_from_table.assert_not_called()


def test_handle_upload_document_reference_request_with_other_status(
    mock_service,
    mock_review_document_service,
    mock_virus_scan_service,
    mock_s3_service,
    sample_document_reference,
):
    object_key = "test-upload-id/test-document.pdf"
    sample_document_reference.review_status = DocumentReviewStatus.PENDING_REVIEW
    mock_review_document_service.fetch_documents_from_table.return_value = [
        sample_document_reference
    ]

    mock_service.handle_upload_document_reference_request(object_key)

    mock_virus_scan_service.scan_file.assert_not_called()
    mock_s3_service.copy_across_bucket.assert_not_called()
    mock_s3_service.delete_object.assert_called_once_with(
        MOCK_STAGING_STORE_BUCKET, object_key
    )


def test_handle_upload_document_reference_request_with_document_service_exception(
    mock_service,
    mock_review_document_service,
):
    object_key = "test-upload-id/test-document.pdf"
    mock_review_document_service.fetch_documents_from_table.return_value = []
    try:
        mock_service.handle_upload_document_reference_request(object_key)
    except Exception:
        assert False, "Exception should not be raised"

    mock_review_document_service.fetch_documents_from_table.assert_called_once()


@pytest.mark.parametrize(
    "error_code,should_raise,status_code",
    [
        ("RequestTimeout", True, 400),
        ("InvalidParameter", False, 400),
        ("AccessDenied", False, 400),
        ("SomeError", False, 412),
    ],
)
def test_handle_upload_document_reference_request_with_client_errors(
    error_code,
    should_raise,
    status_code,
    mock_service,
    mock_review_document_service,
    mock_virus_scan_service,
    sample_document_reference,
):
    object_key = "test-upload-id/test-document.pdf"
    mock_review_document_service.fetch_documents_from_table.return_value = [
        sample_document_reference
    ]
    mock_virus_scan_service.scan_file.return_value = VirusScanResult.CLEAN.value
    mock_review_document_service.build_review_dynamo_filter.return_value = {}

    error = ClientError(
        {
            "Error": {"Code": error_code, "Message": "Test error"},
            "ResponseMetadata": {"HTTPStatusCode": status_code},
        },
        "test_operation",
    )
    mock_service.s3_service.copy_across_bucket.side_effect = error

    if should_raise:
        with pytest.raises(ClientError):
            mock_service.handle_upload_document_reference_request(object_key)
    else:
        mock_service.handle_upload_document_reference_request(object_key)


def test_handle_upload_document_reference_request_with_unexpected_error(
    mock_service,
    mock_review_document_service,
    sample_document_reference,
):
    object_key = "test-upload-id/test-document.pdf"
    mock_review_document_service.fetch_documents_from_table.return_value = [
        sample_document_reference
    ]
    mock_review_document_service.fetch_documents_from_table.side_effect = Exception(
        "Unexpected error"
    )

    with pytest.raises(Exception):
        mock_service.handle_upload_document_reference_request(object_key)


def test_fetch_document_reference_by_id(
    mock_service,
    mock_review_document_service,
    sample_document_reference,
):
    document_key = "test-upload-id"
    mock_review_document_service.fetch_documents_from_table.return_value = [
        sample_document_reference
    ]

    result = mock_service._fetch_document_reference_by_id(document_key)

    assert result == sample_document_reference
    mock_review_document_service.fetch_documents_from_table.assert_called_once_with(
        search_key="ID", search_condition=document_key
    )


def test_handle_upload_document_reference_request_with_mismatched_object_key_and_file_location(
    mock_service,
    mock_review_document_service,
    mock_virus_scan_service,
    sample_document_reference,
):
    object_key = "test-upload-id/test-document.pdf"
    sample_document_reference.files[0].file_location = "s3://other-bucket/other-key.pdf"
    mock_review_document_service.fetch_documents_from_table.return_value = [
        sample_document_reference
    ]
    mock_virus_scan_service.scan_file.return_value = VirusScanResult.CLEAN.value
    mock_service.handle_upload_document_reference_request(object_key)

    mock_virus_scan_service.scan_file.assert_not_called()
    mock_service.s3_service.copy_across_bucket.assert_not_called()
    mock_service.s3_service.delete_object.assert_called()


@pytest.mark.parametrize(
    "status,expected",
    [
        (DocumentReviewStatus.REVIEW_PENDING_UPLOAD, True),
        (DocumentReviewStatus.PENDING_REVIEW, False),
        (DocumentReviewStatus.APPROVED, False),
        (DocumentReviewStatus.REJECTED, False),
        (DocumentReviewStatus.VIRUS_SCAN_FAILED, False),
    ],
)
def test_is_review_pending_upload(
    status,
    expected,
    mock_service,
    sample_document_reference,
):
    sample_document_reference.review_status = status

    result = mock_service._is_review_pending_upload(sample_document_reference)

    assert result == expected


def test_perform_virus_scan(
    mock_service,
    mock_virus_scan_service,
    sample_document_reference,
):
    object_key = "test-upload-id/test-document.pdf"
    mock_virus_scan_service.scan_file.return_value = VirusScanResult.CLEAN.value

    result = mock_service._perform_virus_scan(sample_document_reference, object_key)

    assert result == VirusScanResult.CLEAN.value
    mock_virus_scan_service.scan_file.assert_called_once_with(
        object_key, nhs_number=TEST_NHS_NUMBER
    )


def test_process_review_document_reference(
    mock_service,
    mock_review_document_service,
    mock_s3_service,
    sample_document_reference,
):
    object_key = "test-upload-id/test-document.pdf"
    mock_review_document_service.build_review_dynamo_filter.return_value = {}

    mock_service._process_review_document_reference(
        sample_document_reference, object_key
    )

    mock_s3_service.copy_across_bucket.assert_called_once()
    mock_review_document_service.update_document_review_status.assert_called_once()
    mock_s3_service.delete_object.assert_called_once_with(
        MOCK_STAGING_STORE_BUCKET, object_key
    )


def test_copy_files_from_staging_bucket(
    mock_service,
    mock_s3_service,
    sample_document_reference,
):
    source_file_key = "test-upload-id/test-document.pdf"
    expected_dest_key = (
        f"{sample_document_reference.id}/{sample_document_reference.files[0].file_name}"
    )
    expected_file_location = (
        f"{S3_PREFIX}{MOCK_DOCUMENT_REVIEW_BUCKET}/{expected_dest_key}"
    )

    mock_service.copy_files_from_staging_bucket(
        sample_document_reference, source_file_key
    )

    mock_s3_service.copy_across_bucket.assert_called_once_with(
        source_bucket=MOCK_STAGING_STORE_BUCKET,
        source_file_key=source_file_key,
        dest_bucket=MOCK_DOCUMENT_REVIEW_BUCKET,
        dest_file_key=expected_dest_key,
        if_none_match=True,
    )
    assert sample_document_reference.files[0].file_location == expected_file_location


def test_copy_files_from_staging_bucket_with_error(
    mock_service,
    mock_s3_service,
    sample_document_reference,
):
    source_file_key = "test-upload-id/test-document.pdf"
    error = ClientError(
        {
            "Error": {"Code": "AccessDenied", "Message": "Access denied"},
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        "copy_object",
    )
    mock_s3_service.copy_across_bucket.side_effect = error

    with pytest.raises(ClientError):
        mock_service.copy_files_from_staging_bucket(
            sample_document_reference, source_file_key
        )


def test_copy_files_from_staging_bucket_with_412_error(
    mock_service,
    mock_s3_service,
    sample_document_reference,
):
    source_file_key = "test-upload-id/test-document.pdf"
    error = ClientError(
        {
            "Error": {"Code": "PreconditionFailed", "Message": "Precondition failed"},
            "ResponseMetadata": {"HTTPStatusCode": 412},
        },
        "copy_object",
    )
    mock_s3_service.copy_across_bucket.side_effect = error
    try:
        mock_service.copy_files_from_staging_bucket(
            sample_document_reference, source_file_key
        )
    except ClientError:
        assert False, "Exception should not be raised"

    mock_s3_service.copy_across_bucket.assert_called_once_with(
        source_bucket=MOCK_STAGING_STORE_BUCKET,
        source_file_key=source_file_key,
        dest_bucket=MOCK_DOCUMENT_REVIEW_BUCKET,
        dest_file_key=f"{sample_document_reference.id}/{sample_document_reference.files[0].file_name}",
        if_none_match=True,
    )


def test_delete_file_from_staging_bucket(
    mock_service,
    mock_s3_service,
):
    source_file_key = "test-upload-id/test-document.pdf"

    mock_service.delete_file_from_staging_bucket(source_file_key)

    mock_s3_service.delete_object.assert_called_once_with(
        MOCK_STAGING_STORE_BUCKET, source_file_key
    )


def test_delete_file_from_staging_bucket_with_error(
    mock_service,
    mock_s3_service,
):
    source_file_key = "test-upload-id/test-document.pdf"
    error = ClientError(
        {"Error": {"Code": "AccessDenied", "Message": "Access denied"}}, "delete_object"
    )
    mock_s3_service.delete_object.side_effect = error

    with pytest.raises(ClientError):
        mock_service.delete_file_from_staging_bucket(source_file_key)
