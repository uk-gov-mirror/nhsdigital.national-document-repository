import json
import pytest
from botocore.exceptions import ClientError
from handlers.concurrency_controller_handler import lambda_handler, validate_event
from unittest.mock import MagicMock


@pytest.fixture
def mock_concurrency_controller_service(mocker):
    mocked_class = mocker.patch(
        "handlers.concurrency_controller_handler.ConcurrencyControllerService"
    )
    mocked_instance = mocked_class.return_value
    yield mocked_instance


@pytest.fixture
def mock_logger(mocker):
    return mocker.patch("handlers.concurrency_controller_handler.logger")


@pytest.fixture
def valid_event():
    return {
        "targetFunction": "test-lambda-function",
        "reservedConcurrency": 10
    }


@pytest.fixture
def event_with_zero_concurrency():
    return {
        "targetFunction": "test-lambda-function",
        "reservedConcurrency": 0
    }


def test_lambda_handler_success(valid_event, context, mock_concurrency_controller_service):
    mock_concurrency_controller_service.update_function_concurrency.return_value = 10
    
    result = lambda_handler(valid_event, context)
    
    mock_concurrency_controller_service.update_function_concurrency.assert_called_once_with(
        "test-lambda-function", 10
    )
    
    assert result["statusCode"] == 200
    assert result["body"]["message"] == "Concurrency updated successfully"
    assert result["body"]["function"] == "test-lambda-function"
    assert result["body"]["reservedConcurrency"] == 10


def test_lambda_handler_with_zero_concurrency(
    event_with_zero_concurrency, context, mock_concurrency_controller_service
):
    mock_concurrency_controller_service.update_function_concurrency.return_value = 0
    
    result = lambda_handler(event_with_zero_concurrency, context)
    
    mock_concurrency_controller_service.update_function_concurrency.assert_called_once_with(
        "test-lambda-function", 0
    )
    
    assert result["statusCode"] == 200
    assert result["body"]["message"] == "Concurrency updated successfully"
    assert result["body"]["function"] == "test-lambda-function"
    assert result["body"]["reservedConcurrency"] == 0


def test_lambda_handler_with_large_concurrency(context, mock_concurrency_controller_service):
    event = {
        "targetFunction": "test-lambda-function",
        "reservedConcurrency": 1000
    }
    
    mock_concurrency_controller_service.update_function_concurrency.return_value = 1000
    
    result = lambda_handler(event, context)
    
    mock_concurrency_controller_service.update_function_concurrency.assert_called_once_with(
        "test-lambda-function", 1000
    )
    
    assert result["statusCode"] == 200
    assert result["body"]["message"] == "Concurrency updated successfully"
    assert result["body"]["function"] == "test-lambda-function"
    assert result["body"]["reservedConcurrency"] == 1000


def test_validate_event_success(valid_event):
    target_function, reserved_concurrency = validate_event(valid_event)
    
    assert target_function == "test-lambda-function"
    assert reserved_concurrency == 10


def test_validate_event_missing_target_function(mock_logger):
    event = {
        "reservedConcurrency": 10
    }
    
    with pytest.raises(ValueError) as exc_info:
        validate_event(event)
    
    assert str(exc_info.value) == "targetFunction is required"
    mock_logger.error.assert_called_once_with("Missing required parameter: targetFunction")


def test_validate_event_missing_reserved_concurrency(mock_logger):
    event = {
        "targetFunction": "test-lambda-function"
    }
    
    with pytest.raises(ValueError) as exc_info:
        validate_event(event)
    
    assert str(exc_info.value) == "reservedConcurrency is required"
    mock_logger.error.assert_called_once_with("Missing required parameter: reservedConcurrency")


def test_validate_event_both_parameters_missing(mock_logger):
    event = {}
    
    with pytest.raises(ValueError) as exc_info:
        validate_event(event)
    
    # Should fail on first missing parameter
    assert str(exc_info.value) == "targetFunction is required"


def test_validate_event_empty_target_function(mock_logger):
    event = {
        "targetFunction": "",
        "reservedConcurrency": 10
    }
    
    with pytest.raises(ValueError) as exc_info:
        validate_event(event)
    
    assert str(exc_info.value) == "targetFunction is required"
    mock_logger.error.assert_called_once_with("Missing required parameter: targetFunction")


def test_validate_event_reserved_concurrency_zero_is_valid():
    event = {
        "targetFunction": "test-lambda-function",
        "reservedConcurrency": 0
    }
    
    target_function, reserved_concurrency = validate_event(event)
    
    assert target_function == "test-lambda-function"
    assert reserved_concurrency == 0


def test_validate_event_with_additional_fields():
    event = {
        "targetFunction": "test-lambda-function",
        "reservedConcurrency": 10,
        "extraField": "should-be-ignored"
    }
    
    target_function, reserved_concurrency = validate_event(event)
    
    assert target_function == "test-lambda-function"
    assert reserved_concurrency == 10


def test_lambda_handler_service_raises_resource_not_found(
    valid_event, context, mock_concurrency_controller_service
):
    error_response = {
        'Error': {
            'Code': 'ResourceNotFoundException',
            'Message': 'Function not found'
        }
    }
    
    mock_concurrency_controller_service.update_function_concurrency.side_effect = ClientError(
        error_response, 'PutFunctionConcurrency'
    )
    
    result = lambda_handler(valid_event, context)
    
    # The decorators convert exceptions to API Gateway error responses
    assert result['statusCode'] == 500
    body = json.loads(result['body'])
    assert body['message'] == 'Failed to utilise AWS client/resource'
    assert body['err_code'] == 'GWY_5001'


def test_lambda_handler_service_raises_invalid_parameter(
    context, mock_concurrency_controller_service
):
    event = {
        "targetFunction": "test-lambda-function",
        "reservedConcurrency": -1
    }
    
    error_response = {
        'Error': {
            'Code': 'InvalidParameterValueException',
            'Message': 'Reserved concurrency value must be non-negative'
        }
    }
    
    mock_concurrency_controller_service.update_function_concurrency.side_effect = ClientError(
        error_response, 'PutFunctionConcurrency'
    )
    
    result = lambda_handler(event, context)
    
    # The decorators convert exceptions to API Gateway error responses
    assert result['statusCode'] == 500
    body = json.loads(result['body'])
    assert body['message'] == 'Failed to utilise AWS client/resource'
    assert body['err_code'] == 'GWY_5001'
