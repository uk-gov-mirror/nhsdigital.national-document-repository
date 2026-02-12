import copy
import json

import pytest
from enums.document_review_reason import DocumentReviewReason
from models.staging_metadata import BulkUploadQueueMetadata, StagingSqsMetadata
from repositories.bulk_upload.bulk_upload_sqs_repository import BulkUploadSqsRepository
from tests.unit.conftest import MOCK_LG_METADATA_SQS_QUEUE, PDF_STITCHING_SQS_URL
from tests.unit.helpers.data.bulk_upload.test_data import (
    TEST_NHS_NUMBER_FOR_BULK_UPLOAD,
    TEST_PDF_STITCHING_SQS_MESSAGE,
    TEST_SQS_MESSAGE,
    TEST_STAGING_METADATA,
)
from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


@pytest.fixture
def repo_under_test(mocker, set_env):
    repo = BulkUploadSqsRepository()
    mocker.patch.object(repo, "sqs_repository")
    yield repo


@pytest.fixture
def sample_staging_metadata():
    """Create sample staging metadata for tests"""
    return StagingSqsMetadata(
        nhs_number="9000000009",
        files=[
            BulkUploadQueueMetadata(
                file_path="staging/9000000009/test1.pdf",
                stored_file_name="lg_test1.pdf",
                gp_practice_code="Y12345",
                scan_date="2024-01-01",
            ),
            BulkUploadQueueMetadata(
                file_path="staging/9000000009/test2.pdf",
                stored_file_name="lg_test2.pdf",
                gp_practice_code="Y12345",
                scan_date="2024-01-01",
            ),
        ],
        retries=0,
    )


def test_put_staging_metadata_back_to_queue_and_increases_retries(
    set_env,
    mock_uuid,
    repo_under_test,
):
    TEST_STAGING_METADATA.retries = 2
    metadata_copy = copy.deepcopy(TEST_STAGING_METADATA)
    metadata_copy.retries = 3

    repo_under_test.put_staging_metadata_back_to_queue(TEST_STAGING_METADATA)

    repo_under_test.sqs_repository.send_message_with_nhs_number_attr_fifo.assert_called_with(
        group_id=f"back_to_queue_bulk_upload_{mock_uuid}",
        queue_url=MOCK_LG_METADATA_SQS_QUEUE,
        message_body=metadata_copy.model_dump_json(by_alias=True),
        nhs_number=TEST_STAGING_METADATA.nhs_number,
    )


def test_put_sqs_message_back_to_queue(set_env, repo_under_test, mock_uuid):
    repo_under_test.put_sqs_message_back_to_queue(TEST_SQS_MESSAGE)

    repo_under_test.sqs_repository.send_message_with_nhs_number_attr_fifo.assert_called_with(
        queue_url=MOCK_LG_METADATA_SQS_QUEUE,
        message_body=TEST_SQS_MESSAGE["body"],
        nhs_number=TEST_NHS_NUMBER_FOR_BULK_UPLOAD,
        group_id=f"back_to_queue_bulk_upload_{mock_uuid}",
    )


def test_send_message_to_pdf_stitching_queue(set_env, repo_under_test):
    repo_under_test.send_message_to_pdf_stitching_queue(
        PDF_STITCHING_SQS_URL,
        TEST_PDF_STITCHING_SQS_MESSAGE,
    )
    message_body = TEST_PDF_STITCHING_SQS_MESSAGE
    repo_under_test.sqs_repository.send_message_standard.assert_called_with(
        queue_url=PDF_STITCHING_SQS_URL,
        message_body=message_body.model_dump_json(),
    )


def test_sends_message_to_review_queue_with_correct_structure_and_fields(
    set_env,
    repo_under_test,
    mock_uuid,
):
    repo_under_test.send_message_to_review_queue(
        staging_metadata=TEST_STAGING_METADATA,
        failure_reason=DocumentReviewReason.UNSUCCESSFUL_UPLOAD,
        uploader_ods="Y12345",
    )

    expected_message_body = {
        "upload_id": mock_uuid,
        "files": [
            {
                "file_name": "1of3_Lloyd_George_Record_[Jane Smith]_[9000000009]_[22-10-2010].pdf",
                "file_path": "9000000009/1of3_Lloyd_George_Record_[Jane Smith]_[9000000009]_[22-10-2010].pdf",
            },
            {
                "file_name": "2of3_Lloyd_George_Record_[Jane Smith]_[9000000009]_[22-10-2010].pdf",
                "file_path": "9000000009/2of3_Lloyd_George_Record_[Jane Smith]_[9000000009]_[22-10-2010].pdf",
            },
            {
                "file_name": "3of3_Lloyd_George_Record_[Jane Smith]_[9000000009]_[22-10-2010].pdf",
                "file_path": "9000000009/3of3_Lloyd_George_Record_[Jane Smith]_[9000000009]_[22-10-2010].pdf",
            },
        ],
        "nhs_number": "9000000009",
        "failure_reason": "Unsuccessful upload",
        "uploader_ods": "Y12345",
    }

    repo_under_test.sqs_repository.send_message_standard.assert_called_once_with(
        queue_url=repo_under_test.review_queue_url,
        message_body=json.dumps(expected_message_body, separators=(",", ":")),
    )
