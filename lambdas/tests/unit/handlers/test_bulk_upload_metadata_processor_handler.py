import pytest
from handlers.bulk_upload_metadata_processor_handler import lambda_handler
from services.bulk_upload_metadata_processor_service import (
    BulkUploadMetadataProcessorService,
)


@pytest.fixture
def mock_metadata_service(mocker):
    mocked_instance = mocker.patch(
        "handlers.bulk_upload_metadata_processor_handler.BulkUploadMetadataProcessorService",
        spec=BulkUploadMetadataProcessorService,
    ).return_value
    return mocked_instance


def eventbridge_event_with_s3_key(key: str):
    return {
        "source": "aws.s3",
        "detail": {
            "object": {
                "key": key,
            },
        },
    }


def test_metadata_processor_lambda_handler_valid_event(
    set_env,
    context,
    mock_metadata_service,
):
    lambda_handler({"inputFileLocation": "test"}, context)

    mock_metadata_service.process_metadata.assert_called_once()


def test_metadata_processor_lambda_handler_empty_event(
    set_env,
    context,
    mock_metadata_service,
):
    lambda_handler({}, context)

    mock_metadata_service.process_metadata.assert_not_called()


def test_metadata_processor_lambda_handler_s3_event_triggers_expedite(
    set_env,
    context,
    mock_metadata_service,
):
    event = {
        "source": "aws.s3",
        "detail": {
            "object": {
                "key": "expedite/folder/file.pdf",
            }
        },
    }

    lambda_handler(event, context)

    mock_metadata_service.handle_expedite_event.assert_called_once_with(event)
    mock_metadata_service.process_metadata.assert_not_called()


def test_s3_event_with_non_expedite_key_is_rejected(
    set_env,
    context,
    mock_metadata_service,
    caplog,
):
    key_string = "uploads/1of1_Lloyd_George_Record_[John Michael SMITH]_[1234567890]_[15-05-1990].pdf"
    event = eventbridge_event_with_s3_key(key_string)

    with caplog.at_level("INFO"):
        lambda_handler(event, context)

    mock_metadata_service.handle_expedite_event.assert_called_once_with(event)
    mock_metadata_service.process_metadata.assert_not_called()


def test_s3_event_with_expedite_key_processes(
    set_env,
    context,
    mock_metadata_service,
):
    event = eventbridge_event_with_s3_key(
        "expedite%2F1of1_Lloyd_George_Record_[John Michael SMITH]_[1234567890]_[15-05-1990].pdf"
    )

    lambda_handler(event, context)

    mock_metadata_service.process_metadata.assert_not_called()
    mock_metadata_service.handle_expedite_event.assert_called_once_with(event)
