import json

import pytest
from handlers.review_processor_handler import lambda_handler
from models.sqs.review_message_body import ReviewMessageBody
from utils.lambda_response import ApiGatewayResponse


@pytest.fixture
def mock_review_service(mocker):
    """Mock the ReviewProcessorService."""
    mocked_class = mocker.patch(
        "handlers.review_processor_handler.ReviewProcessorService"
    )
    mocked_instance = mocked_class.return_value
    return mocked_instance





@pytest.fixture
def sample_review_message_body():
    """Create a sample review message body."""
    return ReviewMessageBody(
        file_name="test_document.pdf",
        file_path="staging/9000000009/test_document.pdf",
        nhs_number="9000000009",
        failure_reason="Failed virus scan",
        upload_date="2024-01-15T10:30:00Z",
        uploader_ods="Y12345",
        current_gp="Y12345",
    )


@pytest.fixture
def sample_sqs_message(sample_review_message_body):
    """Create a sample SQS message."""
    return {
        "body": sample_review_message_body.model_dump_json(),
        "eventSource": "aws:sqs",
        "messageId": "test-message-id-1",
    }


@pytest.fixture
def sample_sqs_event(sample_sqs_message):
    """Create a sample SQS event with one message."""
    return {"Records": [sample_sqs_message]}


@pytest.fixture
def sample_sqs_event_multiple_messages(sample_review_message_body):
    """Create a sample SQS event with multiple messages."""
    message_1 = ReviewMessageBody(
        file_name="document_1.pdf",
        file_path="staging/9000000009/document_1.pdf",
        nhs_number="9000000009",
        failure_reason="Failed virus scan",
        upload_date="2024-01-15T10:30:00Z",
        uploader_ods="Y12345",
        current_gp="Y12345",
    )

    message_2 = ReviewMessageBody(
        file_name="document_2.pdf",
        file_path="staging/9000000010/document_2.pdf",
        nhs_number="9000000010",
        failure_reason="Invalid file format",
        upload_date="2024-01-15T10:35:00Z",
        uploader_ods="Y12345",
        current_gp="Y12345",
    )

    message_3 = ReviewMessageBody(
        file_name="document_3.pdf",
        file_path="staging/9000000011/document_3.pdf",
        nhs_number="9000000011",
        failure_reason="Missing metadata",
        upload_date="2024-01-15T10:40:00Z",
        uploader_ods="Y67890",
        current_gp="Y67890",
    )

    return {
        "Records": [
            {
                "body": message_1.model_dump_json(),
                "eventSource": "aws:sqs",
                "messageId": "test-message-id-1",
            },
            {
                "body": message_2.model_dump_json(),
                "eventSource": "aws:sqs",
                "messageId": "test-message-id-2",
            },
            {
                "body": message_3.model_dump_json(),
                "eventSource": "aws:sqs",
                "messageId": "test-message-id-3",
            },
        ]
    }


@pytest.fixture
def empty_sqs_event():
    """Create an empty SQS event."""
    return {"Records": []}


@pytest.fixture
def set_review_env(monkeypatch):
    """Set up environment variables required for the handler."""
    monkeypatch.setenv("DOCUMENT_REVIEW_DYNAMODB_NAME", "test_review_table")
    monkeypatch.setenv("STAGING_STORE_BUCKET_NAME", "test_staging_bucket")
    monkeypatch.setenv("PENDING_REVIEW_BUCKET_NAME", "test_review_bucket")


def test_lambda_handler_processes_single_message_successfully(
    set_review_env,
    context,
    sample_sqs_event,
    mock_review_service,
):
    """Test handler successfully processes a single SQS message."""
    expected_response = ApiGatewayResponse(
        status_code=200,
        body="Processed 1 messages",
        methods="GET",
    ).create_api_gateway_response()

    actual_response = lambda_handler(sample_sqs_event, context)

    assert actual_response == expected_response
    mock_review_service.process_review_message.assert_called_once()


def test_lambda_handler_processes_multiple_messages_successfully(
    set_review_env,
    context,
    sample_sqs_event_multiple_messages,
    mock_review_service,
):
    """Test handler successfully processes multiple SQS messages."""
    expected_response = ApiGatewayResponse(
        status_code=200,
        body="Processed 3 messages",
        methods="GET",
    ).create_api_gateway_response()

    actual_response = lambda_handler(sample_sqs_event_multiple_messages, context)

    assert actual_response == expected_response
    assert mock_review_service.process_review_message.call_count == 3


def test_lambda_handler_calls_service_with_correct_message(
    set_review_env,
    context,
    sample_sqs_event,
    mock_review_service,
):
    """Test handler calls service with the correctly parsed message."""
    lambda_handler(sample_sqs_event, context)

    # Verify the service was called once
    mock_review_service.process_review_message.assert_called_once()
    
    # Get the actual call argument
    call_args = mock_review_service.process_review_message.call_args[0][0]
    
    # Verify it's a ReviewMessageBody with correct data (check type name since isinstance fails with mock)
    assert type(call_args).__name__ == "ReviewMessageBody"
    assert call_args.file_name == "test_document.pdf"
    assert call_args.nhs_number == "9000000009"
    assert call_args.file_path == "staging/9000000009/test_document.pdf"


def test_lambda_handler_handles_empty_records_list(
    set_review_env, context, empty_sqs_event, mock_review_service
):
    """Test handler handles empty records list via @validate_sqs_event decorator."""
    # The @validate_sqs_event decorator returns 400 for empty records
    actual_response = lambda_handler(empty_sqs_event, context)

    assert actual_response["statusCode"] == 400
    assert "SQS_4001" in actual_response["body"]  # Error code for failed SQS parsing
    mock_review_service.process_review_message.assert_not_called()


def test_lambda_handler_handles_service_error(
    set_review_env,
    context,
    sample_sqs_event,
    mock_review_service,
):
    """Test handler catches exception when service fails (via @handle_lambda_exceptions decorator)."""
    mock_review_service.process_review_message.side_effect = Exception(
        "Service processing failed"
    )

    # The @handle_lambda_exceptions decorator catches exceptions
    response = lambda_handler(sample_sqs_event, context)
    
    # Should return 500 error response
    assert response["statusCode"] == 500
    assert "UE_500" in response["body"]  # Unhandled exception error code


def test_lambda_handler_handles_invalid_message_format(
    set_review_env, context, mock_review_service
):
    """Test handler handles validation errors for invalid message format."""
    invalid_event = {
        "Records": [
            {
                "body": json.dumps(
                    {
                        "file_name": "test.pdf",
                        # Missing required fields
                    }
                ),
                "eventSource": "aws:sqs",
            }
        ]
    }

    # The @handle_lambda_exceptions decorator catches the ValidationError
    response = lambda_handler(invalid_event, context)
    
    assert response["statusCode"] == 500
    assert "UE_500" in response["body"]  # Unhandled exception error code


def test_lambda_handler_handles_partial_failure(
    set_review_env,
    context,
    sample_sqs_event_multiple_messages,
    mock_review_service,
):
    """Test handler processes messages and handles first failure."""
    # First message succeeds, second fails
    mock_review_service.process_review_message.side_effect = [
        None,  # First message succeeds
        Exception("Processing failed on second message"),  # Second fails
    ]

    # The @handle_lambda_exceptions decorator catches the exception
    response = lambda_handler(sample_sqs_event_multiple_messages, context)

    # Should return error response
    assert response["statusCode"] == 500
    
    # Verify service was called twice before failing
    assert mock_review_service.process_review_message.call_count == 2


def test_lambda_handler_parses_json_body_correctly(
    set_review_env,
    context,
    mock_review_service,
):
    """Test handler correctly parses JSON from message body."""
    event = {
        "Records": [
            {
                "body": json.dumps(
                    {
                        "file_name": "test.pdf",
                        "file_path": "staging/test.pdf",
                        "nhs_number": "9000000009",
                        "failure_reason": "Test failure",
                        "upload_date": "2024-01-15T10:30:00Z",
                        "uploader_ods": "Y12345",
                        "current_gp": "Y12345",
                    }
                ),
                "eventSource": "aws:sqs",
            }
        ]
    }

    lambda_handler(event, context)

    # Verify service was called with parsed ReviewMessageBody
    mock_review_service.process_review_message.assert_called_once()
    call_args = mock_review_service.process_review_message.call_args[0][0]
    assert type(call_args).__name__ == "ReviewMessageBody"
    assert call_args.file_name == "test.pdf"


def test_lambda_handler_logs_correct_counts(
    set_review_env,
    context,
    sample_sqs_event_multiple_messages,
    mock_review_service,
):
    """Test handler response contains correct processed count."""
    response = lambda_handler(sample_sqs_event_multiple_messages, context)

    # Extract response body
    response_body = response["body"]

    assert "Processed 3 messages" in response_body


def test_lambda_handler_tracks_failed_count(
    set_review_env,
    context,
    sample_sqs_event,
    mock_review_service,
):
    """Test handler tracks failed message count."""
    mock_review_service.process_review_message.side_effect = Exception("Test error")

    # The @handle_lambda_exceptions decorator catches the exception
    response = lambda_handler(sample_sqs_event, context)
    
    # Should return error
    assert response["statusCode"] == 500

    # Verify service was still called
    mock_review_service.process_review_message.assert_called_once()
