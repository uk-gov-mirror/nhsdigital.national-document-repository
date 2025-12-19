from unittest.mock import call

import pytest
from handlers.document_reference_virus_scan_handler import lambda_handler


@pytest.fixture
def mocked_dr_service(set_env, mocker):
    mocked_class = mocker.patch(
        "handlers.document_reference_virus_scan_handler.UploadDocumentReferenceService"
    )
    mocked_service = mocked_class.return_value
    yield mocked_service


@pytest.fixture
def mocked_review_service(set_env, mocker):
    mocked_class = mocker.patch(
        "handlers.document_reference_virus_scan_handler.StagedDocumentReviewProcessingService"
    )
    mocked_service = mocked_class.return_value
    yield mocked_service


def test_lambda_handler_returns_200(mocked_dr_service, context):
    object_key = "user_upload/test_file.pdf"
    file_size = 104857
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key, "size": file_size},
                }
            }
        ]
    }

    lambda_handler(event, context)

    mocked_dr_service.handle_upload_document_reference_request.assert_called_once_with(
        object_key, file_size
    )


def test_lambda_handler_returns_200_multiple_objects(
    mocked_dr_service, mocked_review_service, context
):
    object_key_1 = "user_upload/test_file.pdf"
    object_key_2 = "user_upload/test_file2.pdf"

    file_size = 104857
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key_1, "size": file_size},
                }
            },
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key_2, "size": file_size},
                }
            },
        ]
    }

    lambda_handler(event, context)

    mocked_dr_service.handle_upload_document_reference_request.assert_has_calls(
        [call(object_key_1, file_size), call(object_key_2, file_size)]
    )
    mocked_review_service.handle_upload_document_reference_request.assert_not_called()


def test_lambda_handler_service_raises_exception(mocked_dr_service, context):
    object_key = "user_upload/test_file.pdf"
    file_size = 104857
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key, "size": file_size},
                }
            }
        ]
    }

    mocked_dr_service.handle_upload_document_reference_request.side_effect = Exception(
        "Service error"
    )

    with pytest.raises(Exception):
        lambda_handler(event, context)


def test_lambda_handler_continues_processing_after_single_record_failure(
    mocked_dr_service, context
):
    object_key_1 = "user_upload/test_file.pdf"
    object_key_2 = "user_upload/test_file2.pdf"
    file_size = 104857

    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key_1, "size": file_size},
                }
            },
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key_2, "size": file_size},
                }
            },
        ]
    }

    mocked_dr_service.handle_upload_document_reference_request.side_effect = [
        Exception("Error processing first file"),
        None,
    ]

    with pytest.raises(Exception):
        lambda_handler(event, context)

    assert mocked_dr_service.handle_upload_document_reference_request.call_count == 1


def test_lambda_handler_with_review_path_object(
    mocked_dr_service, context, mocked_review_service
):
    object_key = "review/test_file.pdf"
    file_size = 104857
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key, "size": file_size},
                }
            }
        ]
    }

    lambda_handler(event, context)

    mocked_review_service.handle_upload_document_reference_request.assert_called_once_with(
        object_key, file_size
    )
    mocked_dr_service.handle_upload_document_reference_request.assert_not_called()


def test_lambda_handler_with_multiple_review_objects(
    mocked_dr_service, context, mocked_review_service
):
    object_key_1 = "review/test_file.pdf"
    object_key_2 = "review/test_file2.pdf"
    file_size = 104857

    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key_1, "size": file_size},
                }
            },
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key_2, "size": file_size},
                }
            },
        ]
    }

    lambda_handler(event, context)

    mocked_review_service.handle_upload_document_reference_request.assert_has_calls(
        [call(object_key_1, file_size), call(object_key_2, file_size)]
    )
    mocked_dr_service.handle_upload_document_reference_request.assert_not_called()


def test_lambda_handler_with_mixed_user_upload_and_review_paths(
    mocked_dr_service, context, mocked_review_service
):
    object_key_1 = "user_upload/test_file.pdf"
    object_key_2 = "review/test_file2.pdf"
    file_size = 104857

    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key_1, "size": file_size},
                }
            },
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key_2, "size": file_size},
                }
            },
        ]
    }

    lambda_handler(event, context)

    mocked_dr_service.handle_upload_document_reference_request.assert_has_calls(
        [call(object_key_1, file_size)]
    )
    mocked_review_service.handle_upload_document_reference_request.assert_has_calls(
        [call(object_key_2, file_size)]
    )


def test_lambda_handler_review_path_with_service_exception(
    mocked_dr_service, mocked_review_service, context
):
    object_key = "review/test_file.pdf"
    file_size = 104857
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "staging-bulk-store"},
                    "object": {"key": object_key, "size": file_size},
                }
            }
        ]
    }

    mocked_review_service.handle_upload_document_reference_request.side_effect = (
        Exception("Service error processing review file")
    )

    with pytest.raises(Exception):
        lambda_handler(event, context)
