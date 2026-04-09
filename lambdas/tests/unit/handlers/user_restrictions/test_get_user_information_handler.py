import json

import pytest

from enums.lambda_error import LambdaError
from handlers.user_restrictions.get_user_information_handler import lambda_handler
from services.mock_data.user_restrictions.build_mock_data import (
    build_mock_response_and_practitioner,
)
from tests.unit.conftest import MOCK_INTERACTION_ID
from tests.unit.services.user_restriction.conftest import MOCK_IDENTIFIER
from utils.exceptions import (
    HealthcareWorkerAPIException,
    HealthcareWorkerPractitionerModelException,
)
from utils.lambda_response import ApiGatewayResponse


@pytest.fixture
def mock_healthcare_worker_api_service(mocker):
    mocked_class = mocker.patch(
        "handlers.user_restrictions.get_user_information_handler.get_healthcare_worker_api_service",
    )
    mocked_instance = mocked_class.return_value
    yield mocked_instance


@pytest.fixture
def mock_valid_event(event):
    event["queryStringParameters"] = {
        "identifier": MOCK_IDENTIFIER,
    }
    yield event


@pytest.fixture
def mock_invalid_event_missing_identifier(event):
    event["queryStringParameters"] = {
        "no_identifier": "abcdef",
    }
    yield event


@pytest.fixture
def mock_invalid_event_empty_querystring(event):
    event["queryStringParameters"] = {}
    yield event


def test_lambda_handler_returns_404_feature_flag_disabled(
    event,
    context,
    mock_user_restriction_disabled,
    set_env,
):
    body = {
        "message": LambdaError.FeatureFlagDisabled.value["message"],
        "err_code": LambdaError.FeatureFlagDisabled.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }

    expected = ApiGatewayResponse(
        status_code=404,
        body=json.dumps(body),
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)
    assert actual == expected


def test_lambda_handler_happy_path(
    mock_healthcare_worker_api_service,
    monkeypatch,
    context,
    mock_valid_event,
    set_env,
    mock_user_restriction_enabled,
):
    _, _, mock_practitioner = build_mock_response_and_practitioner(MOCK_IDENTIFIER)
    mock_healthcare_worker_api_service.get_practitioner.return_value = mock_practitioner

    expected = ApiGatewayResponse(
        200,
        json.dumps(mock_practitioner.model_dump_camel_case()),
        "GET",
    ).create_api_gateway_response()

    actual = lambda_handler(mock_valid_event, context)

    mock_healthcare_worker_api_service.get_practitioner.assert_called_with(
        identifier=MOCK_IDENTIFIER,
    )
    assert actual == expected


def test_lambda_handler_returns_400_invalid_event(
    mock_healthcare_worker_api_service,
    context,
    event,
    mock_invalid_event_missing_identifier,
    mock_invalid_event_empty_querystring,
    set_env,
    mock_user_restriction_enabled,
):

    invalid_events = [
        event,
        mock_invalid_event_missing_identifier,
        mock_invalid_event_empty_querystring,
    ]
    expected_body = LambdaError.UserRestrictionInvalidEvent.create_error_body()

    expected = ApiGatewayResponse(
        400,
        expected_body,
        "GET",
    ).create_api_gateway_response()

    for invalid_event in invalid_events:
        actual = lambda_handler(invalid_event, context)

        assert expected == actual


@pytest.mark.parametrize("status_code", [400, 404, 500, 403, 401])
def test_lambda_handler_handles_non_200_response_from_get_practitioner(
    mock_healthcare_worker_api_service,
    mock_valid_event,
    context,
    status_code,
    set_env,
    mock_user_restriction_enabled,
):
    api_error = HealthcareWorkerAPIException(status_code=status_code)

    mock_healthcare_worker_api_service.get_practitioner.side_effect = api_error

    actual = lambda_handler(mock_valid_event, context)

    expected_body = LambdaError.GetUserInfoError.create_error_body(
        {"message": api_error.message, "code": status_code},
    )
    expected = ApiGatewayResponse(
        status_code,
        expected_body,
        "GET",
    ).create_api_gateway_response()

    assert actual == expected


def test_lambda_handler_handles_validation_error_from_get_practitioner(
    mock_healthcare_worker_api_service,
    mock_valid_event,
    context,
    set_env,
    mock_user_restriction_enabled,
):
    mock_healthcare_worker_api_service.get_practitioner.side_effect = (
        HealthcareWorkerPractitionerModelException
    )

    expected = ApiGatewayResponse(
        500,
        LambdaError.UserRestrictionModelValidationError.create_error_body(
            details="Failed to validate against practitioner model.",
        ),
        "GET",
    ).create_api_gateway_response()

    actual = lambda_handler(mock_valid_event, context)

    assert actual == expected
