import pytest
import json
import os
from unittest.mock import patch
from handlers.get_document_reference_handler import lambda_handler
from utils.lambda_exceptions import GetDocumentRefException
from enums.feature_flags import FeatureFlags
from utils.lambda_response import ApiGatewayResponse
from utils.lambda_exceptions import FeatureFlagsException
from enums.lambda_error import LambdaError
from utils.error_response import ErrorResponse


@pytest.fixture
def mocked_env_vars():
    env_vars = {
        "LLOYD_GEORGE_DYNAMODB_NAME": "mock_dynamodb_name",
        "PRESIGNED_ASSUME_ROLE": "mock_presigned_role",
        "APPCONFIG_APPLICATION": "mock_value",
        "APPCONFIG_ENVIRONMENT": "mock_value",
        "APPCONFIG_CONFIGURATION": "mock_value",
    }

    with patch.dict(os.environ, env_vars):
        yield env_vars

@pytest.fixture
def mock_feature_flag_service(mocker):
    yield mocker.patch("handlers.get_document_reference_handler.FeatureFlagService").return_value

@pytest.fixture
def mock_get_document_service(mocker):
    yield mocker.patch(
        "handlers.get_document_reference_handler.GetDocumentReferenceService"
        ).return_value
    
@pytest.fixture
def mock_valid_nhs_number():
    yield "4407064188"

@pytest.fixture
def feature_flag():
    yield FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED

@pytest.fixture
def mock_interaction_id():
    yield "88888888-4444-4444-4444-121212121212"

@pytest.fixture
def mocked_bad_env_vars():
    env_vars = {
        #"LLOYD_GEORGE_DYNAMODB_NAME": "mock_dynamodb_name",
        "PRESIGNED_ASSUME_ROLE": "mock_presigned_role",
        "APPCONFIG_APPLICATION": "mock_value",
        "APPCONFIG_ENVIRONMENT": "mock_value",
        "APPCONFIG_CONFIGURATION": "mock_value",
    }

    with patch.dict(os.environ, env_vars):
        yield "LLOYD_GEORGE_DYNAMODB_NAME"



def test_handler_valid_request_returns_200(
        valid_id_event_with_auth_header,
        mock_feature_flag_service,
        mock_get_document_service,
        mock_valid_nhs_number,
        context,
        mocked_env_vars,
        feature_flag
        ):
    mock_document_id = "1"
    valid_id_event_with_auth_header["pathParameters"] = {"id": mock_document_id}
    valid_id_event_with_auth_header["queryStringParameters"]["patientId"] = mock_valid_nhs_number
    mock_presigned_s3_url = "https://mock.url/"

    expected_result = ApiGatewayResponse(
        status_code=200, body=mock_presigned_s3_url, methods="GET"
    ).create_api_gateway_response()

    mock_get_document_service.get_document_url_by_id.return_value = mock_presigned_s3_url

    result = lambda_handler(valid_id_event_with_auth_header, context)

    assert result == expected_result
    assert result["body"] == mock_presigned_s3_url

    mock_feature_flag_service.validate_feature_flag.assert_called_once_with(
        FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED
        )
    mock_get_document_service.get_document_url_by_id.assert_called_once_with(
        mock_document_id,
        mock_valid_nhs_number)

def test_missing_nhs_number_errors(
        valid_id_event_with_auth_header,
        mock_feature_flag_service,
        context,
        mocked_env_vars,
        feature_flag,
    ):
    valid_id_event_with_auth_header["pathParameters"] = {"id": "1"}
    valid_id_event_with_auth_header["queryStringParameters"].pop("patientId")

    expected_result = ApiGatewayResponse(
        status_code=400,
        body=LambdaError.PatientIdNoKey.create_error_body(),
        methods="GET",
    ).create_api_gateway_response()

    result = lambda_handler(valid_id_event_with_auth_header, context)

    assert result == expected_result

def test_missing_document_id_errors(
        valid_id_event_with_auth_header,
        mock_feature_flag_service,
        mock_valid_nhs_number,
        context,
        mocked_env_vars,
        feature_flag,
        mock_interaction_id
    ):
    valid_id_event_with_auth_header["pathParameters"] = {}
    valid_id_event_with_auth_header["queryStringParameters"]["patientId"] = mock_valid_nhs_number

    expected_error = GetDocumentRefException(400, LambdaError.DocumentReferenceMissingParameters)

    expected_result = ApiGatewayResponse(
        status_code=400,
        body=ErrorResponse(
            err_code=expected_error.err_code,
            message=expected_error.message,
            interaction_id=mock_interaction_id
        ).create(),
        methods="GET"
    ).create_api_gateway_response()

    mock_feature_flag_service.get_feature_flags_by_flag.return_value = {feature_flag: True}

    result = lambda_handler(valid_id_event_with_auth_header, context)

    assert result == expected_result

def test_env_vars_not_set_errors(
        valid_id_event_with_auth_header,
        context,
        mocked_bad_env_vars
    ):
    expected_result = ApiGatewayResponse(
        status_code=500,
        body=LambdaError.EnvMissing.create_error_body({"name": mocked_bad_env_vars}),
        methods="GET"
    ).create_api_gateway_response()

    result = lambda_handler(valid_id_event_with_auth_header, context)

    assert result == expected_result