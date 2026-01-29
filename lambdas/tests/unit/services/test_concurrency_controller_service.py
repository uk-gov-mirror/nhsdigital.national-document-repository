import pytest
from botocore.exceptions import ClientError
from services.concurrency_controller_service import ConcurrencyControllerService
from unittest.mock import MagicMock


@pytest.fixture
def mock_lambda_client(mocker):
    return mocker.patch("services.concurrency_controller_service.boto3.client")


@pytest.fixture
def mock_logger(mocker):
    return mocker.patch("services.concurrency_controller_service.logger")


@pytest.fixture
def service(mock_lambda_client):
    return ConcurrencyControllerService()


def test_update_function_concurrency_success(service, mock_lambda_client, mock_logger):
    target_function = "test-lambda-function"
    reserved_concurrency = 10
    
    mock_client_instance = MagicMock()
    mock_lambda_client.return_value = mock_client_instance
    
    mock_client_instance.put_function_concurrency.return_value = {
        "ReservedConcurrentExecutions": reserved_concurrency
    }
    
    service.lambda_client = mock_client_instance
    
    result = service.update_function_concurrency(target_function, reserved_concurrency)
    
    mock_client_instance.put_function_concurrency.assert_called_once_with(
        FunctionName=target_function,
        ReservedConcurrentExecutions=reserved_concurrency
    )
    
    assert result == reserved_concurrency
    
    mock_logger.info.assert_any_call(
        f"Updating reserved concurrency for function '{target_function}' to {reserved_concurrency}"
    )
    mock_logger.info.assert_any_call(
        f"Successfully updated concurrency for '{target_function}'. "
        f"Reserved concurrency set to: {reserved_concurrency}"
    )


def test_update_function_concurrency_function_not_found(service, mock_lambda_client, mock_logger):
    target_function = "non-existent-function"
    reserved_concurrency = 5
    
    mock_client_instance = MagicMock()
    mock_lambda_client.return_value = mock_client_instance
    
    error_response = {
        'Error': {
            'Code': 'ResourceNotFoundException',
            'Message': 'Function not found'
        },
        'ResponseMetadata': {'HTTPStatusCode': 404}
    }
    
    mock_client_instance.put_function_concurrency.side_effect = ClientError(
        error_response, 'PutFunctionConcurrency'
    )
    
    service.lambda_client = mock_client_instance
    
    with pytest.raises(ClientError):
        service.update_function_concurrency(target_function, reserved_concurrency)
    
    mock_logger.error.assert_called_once_with(
        f"Lambda function '{target_function}' not found"
    )


def test_update_function_concurrency_invalid_parameter(service, mock_lambda_client, mock_logger):
    target_function = "test-lambda-function"
    reserved_concurrency = -1  # Invalid value
    
    mock_client_instance = MagicMock()
    mock_lambda_client.return_value = mock_client_instance
    
    error_response = {
        'Error': {
            'Code': 'InvalidParameterValueException',
            'Message': 'Reserved concurrency value must be non-negative'
        },
        'ResponseMetadata': {'HTTPStatusCode': 400}
    }
    
    mock_client_instance.put_function_concurrency.side_effect = ClientError(
        error_response, 'PutFunctionConcurrency'
    )
    
    service.lambda_client = mock_client_instance
    
    with pytest.raises(ClientError):
        service.update_function_concurrency(target_function, reserved_concurrency)
    
    mock_logger.error.assert_called_once_with(
        f"Failed to update concurrency: An error occurred (InvalidParameterValueException) when calling the "
        f"PutFunctionConcurrency operation: Reserved concurrency value must be non-negative"
    )


def test_update_function_concurrency_with_zero_value(service, mock_lambda_client, mock_logger):
    target_function = "test-lambda-function"
    reserved_concurrency = 0
    
    mock_client_instance = MagicMock()
    mock_lambda_client.return_value = mock_client_instance
    
    mock_client_instance.put_function_concurrency.return_value = {
        "ReservedConcurrentExecutions": reserved_concurrency
    }
    
    service.lambda_client = mock_client_instance
    
    result = service.update_function_concurrency(target_function, reserved_concurrency)
    
    assert result == 0


def test_update_function_concurrency_with_large_value(service, mock_lambda_client, mock_logger):
    target_function = "test-lambda-function"
    reserved_concurrency = 1000
    
    mock_client_instance = MagicMock()
    mock_lambda_client.return_value = mock_client_instance
    
    mock_client_instance.put_function_concurrency.return_value = {
        "ReservedConcurrentExecutions": reserved_concurrency
    }
    
    service.lambda_client = mock_client_instance
    
    result = service.update_function_concurrency(target_function, reserved_concurrency)
    
    assert result == 1000


def test_init_creates_lambda_client(mock_lambda_client):
    service = ConcurrencyControllerService()
    
    mock_lambda_client.assert_called_once_with("lambda")
    assert service.lambda_client is not None


def test_update_function_concurrency_missing_response_field(service, mock_lambda_client, mock_logger):
    target_function = "test-lambda-function"
    reserved_concurrency = 10
    
    mock_client_instance = MagicMock()
    mock_lambda_client.return_value = mock_client_instance
    
    # Response missing ReservedConcurrentExecutions field
    mock_client_instance.put_function_concurrency.return_value = {}
    
    service.lambda_client = mock_client_instance
    
    with pytest.raises(ValueError) as exc_info:
        service.update_function_concurrency(target_function, reserved_concurrency)
    
    assert str(exc_info.value) == "Failed to confirm concurrency update from AWS response"
    mock_logger.error.assert_called_with("Response did not contain ReservedConcurrentExecutions")


def test_update_function_concurrency_value_mismatch(service, mock_lambda_client, mock_logger):
    target_function = "test-lambda-function"
    reserved_concurrency = 10
    
    mock_client_instance = MagicMock()
    mock_lambda_client.return_value = mock_client_instance
    
    # AWS returned different value than requested
    mock_client_instance.put_function_concurrency.return_value = {
        "ReservedConcurrentExecutions": 5
    }
    
    service.lambda_client = mock_client_instance
    
    with pytest.raises(ValueError) as exc_info:
        service.update_function_concurrency(target_function, reserved_concurrency)
    
    assert str(exc_info.value) == "Concurrency update verification failed"
    mock_logger.error.assert_called_with(
        f"Concurrency mismatch: requested {reserved_concurrency}, AWS returned 5"
    )
