import pytest
from handlers.bulk_upload_handler import lambda_handler
from tests.unit.helpers.data.bulk_upload.test_data import (
    TEST_EVENT_WITH_NO_SQS_MESSAGES,
    TEST_EVENT_WITH_ONE_SQS_MESSAGE,
    TEST_EVENT_WITH_SQS_MESSAGES,
)
from utils.exceptions import BulkUploadException
from utils.lambda_response import ApiGatewayResponse


@pytest.fixture
def mock_bulk_upload_service_class(mocker):
    mock_class = mocker.patch("handlers.bulk_upload_handler.BulkUploadService")
    return mock_class


@pytest.fixture
def mock_bulk_upload_service_instance(mock_bulk_upload_service_class):
    return mock_bulk_upload_service_class.return_value


def test_lambda_handler_processes_single_message_successfully(
    mock_bulk_upload_service_instance,
    context,
    set_env,
    mock_validation_strict_and_bulk_upload_send_to_review_disabled,
):
    response = lambda_handler(TEST_EVENT_WITH_ONE_SQS_MESSAGE, context)

    expected = ApiGatewayResponse(
        200, "Finished processing all 1 messages", "GET"
    ).create_api_gateway_response()
    assert response == expected
    mock_bulk_upload_service_instance.process_message_queue.assert_called_once_with(
        TEST_EVENT_WITH_ONE_SQS_MESSAGE["Records"]
    )


def test_lambda_handler_processes_multiple_messages_successfully(
    mock_bulk_upload_service_instance,
    context,
    set_env,
    mock_validation_strict_and_bulk_upload_send_to_review_disabled,
):
    response = lambda_handler(TEST_EVENT_WITH_SQS_MESSAGES, context)

    expected = ApiGatewayResponse(
        200, "Finished processing all 3 messages", "GET"
    ).create_api_gateway_response()
    assert response == expected
    mock_bulk_upload_service_instance.process_message_queue.assert_called_once_with(
        TEST_EVENT_WITH_SQS_MESSAGES["Records"]
    )


def test_lambda_handler_handles_bulk_upload_exception(
    mock_bulk_upload_service_instance,
    context,
    set_env,
    mock_validation_strict_and_bulk_upload_send_to_review_disabled,
):
    mock_bulk_upload_service_instance.process_message_queue.side_effect = BulkUploadException()

    response = lambda_handler(TEST_EVENT_WITH_SQS_MESSAGES, context)

    expected = ApiGatewayResponse(
        500, "Bulk upload failed with error: ", "GET"
    ).create_api_gateway_response()
    assert response == expected
    mock_bulk_upload_service_instance.process_message_queue.assert_called_once()


def test_lambda_handler_handles_empty_records_list(
    mock_bulk_upload_service_instance,
    context,
    set_env,
    mock_validation_strict_and_bulk_upload_send_to_review_disabled,
):
    response = lambda_handler(TEST_EVENT_WITH_NO_SQS_MESSAGES, context)

    expected = ApiGatewayResponse(
        400,
        "No sqs messages found in event: {'Records': []}. Will ignore this event",
        "GET",
    ).create_api_gateway_response()
    assert response == expected
    mock_bulk_upload_service_instance.process_message_queue.assert_not_called()


def test_lambda_handler_instantiates_service_with_both_flags_disabled(
    mock_bulk_upload_service_class,
    context,
    set_env,
    mock_validation_strict_and_bulk_upload_send_to_review_disabled,
):
    lambda_handler(TEST_EVENT_WITH_ONE_SQS_MESSAGE, context)

    mock_bulk_upload_service_class.assert_called_once_with(
        strict_mode=False, bypass_pds=False, send_to_review_enabled=False
    )


def test_lambda_handler_instantiates_service_with_both_flags_enabled(
    mock_bulk_upload_service_class,
    context,
    set_env,
    mock_validation_strict_and_bulk_upload_send_to_review_enabled,
):
    lambda_handler(TEST_EVENT_WITH_ONE_SQS_MESSAGE, context)

    mock_bulk_upload_service_class.assert_called_once_with(
        strict_mode=True, bypass_pds=False, send_to_review_enabled=True
    )


def test_lambda_handler_instantiates_service_with_validation_strict_enabled_only(
    mock_bulk_upload_service_class,
    context,
    set_env,
    mock_validation_strict_enabled_send_to_review_disabled,
):
    lambda_handler(TEST_EVENT_WITH_ONE_SQS_MESSAGE, context)

    mock_bulk_upload_service_class.assert_called_once_with(
        strict_mode=True, bypass_pds=False, send_to_review_enabled=False
    )


def test_lambda_handler_instantiates_service_with_send_to_review_enabled_only(
    mock_bulk_upload_service_class,
    context,
    set_env,
    mock_validation_strict_disabled_send_to_review_enabled,
):
    lambda_handler(TEST_EVENT_WITH_ONE_SQS_MESSAGE, context)

    mock_bulk_upload_service_class.assert_called_once_with(
        strict_mode=False, bypass_pds=False, send_to_review_enabled=True
    )


def test_lambda_handler_instantiates_service_with_bypass_pds_enabled(
    mock_bulk_upload_service_class,
    context,
    set_env,
    mock_validation_strict_and_bulk_upload_send_to_review_disabled,
    monkeypatch,
):
    monkeypatch.setenv("BYPASS_PDS", "true")

    lambda_handler(TEST_EVENT_WITH_ONE_SQS_MESSAGE, context)

    mock_bulk_upload_service_class.assert_called_once_with(
        strict_mode=False, bypass_pds=True, send_to_review_enabled=False
    )

