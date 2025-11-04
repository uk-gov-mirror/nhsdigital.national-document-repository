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


def s3_event_with_key(key: str):
    return {
        "Records": [
            {
                "eventSource": "s3.amazonaws.com",
                "s3": {"object": {"key": key}},
            }
        ]
    }


def test_metadata_processor_lambda_handler_valid_event(
    set_env, context, mock_metadata_service
):
    lambda_handler({"practiceDirectory": "test"}, context)

    mock_metadata_service.process_metadata.assert_called_once()


def test_metadata_processor_lambda_handler_empty_event(
    set_env, context, mock_metadata_service
):
    lambda_handler({}, context)

    mock_metadata_service.process_metadata.assert_not_called()


def test_s3_event_with_expedite_key_processes(
    set_env, context, mock_metadata_service, caplog
):
    event = s3_event_with_key(
        "expedite%2F1of1_Lloyd_George_Record_[John Michael SMITH]_[1234567890]_[15-05-1990].pdf"
    )
    lambda_handler(event, context)

    assert any("Triggered by S3 listener" in r.message for r in caplog.records)
    assert any(
        "Processing file from expedite folder" in r.message for r in caplog.records
    )


def test_s3_event_with_non_expedite_key_is_rejected(
    set_env, context, mock_metadata_service, caplog
):
    event = s3_event_with_key(
        "uploads/1of1_Lloyd_George_Record_[John Michael SMITH]_[1234567890]_[15-05-1990].pdf"
    )
    lambda_handler(event, context)

    assert any(
        "Unrecognized S3 listener event, cancelling." in r.message
        for r in caplog.records
    )
    mock_metadata_service.process_metadata.assert_not_called()
