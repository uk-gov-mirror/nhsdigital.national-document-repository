import json

import pytest

from enums.lambda_error import LambdaError
from handlers.user_restrictions.update_status_user_restriction_handler import (
    lambda_handler,
)
from tests.unit.conftest import (
    MOCK_INTERACTION_ID,
    TEST_CURRENT_GP_ODS,
    TEST_NHS_NUMBER,
    TEST_UUID,
)
from tests.unit.handlers.user_restrictions.conftest import MOCK_SMARTCARD_ID
from utils.exceptions import (
    UserRestrictionConditionCheckFailedException,
)
from utils.lambda_response import ApiGatewayResponse


@pytest.fixture
def valid_event(event):
    event["httpMethod"] = "PATCH"
    event["pathParameters"] = {
        "id": TEST_UUID,
    }
    event["queryStringParameters"] = {
        "patientId": TEST_NHS_NUMBER,
    }
    return event


@pytest.fixture
def invalid_event_missing_patient_id(event):
    event["httpMethod"] = "PATCH"
    event["pathParameters"] = {
        "id": TEST_UUID,
    }
    return event


@pytest.fixture
def mock_request_context(mocker):
    mock_context = mocker.patch("utils.ods_utils.request_context")
    mock_context.authorization = {
        "nhs_user_id": MOCK_SMARTCARD_ID,
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS},
    }
    yield mock_context


@pytest.fixture
def mock_service(mocker):
    mocked_class = mocker.patch(
        "handlers.user_restrictions.update_status_user_restriction_handler.UpdateStatusUserRestrictionService",
    )
    mocked_instance = mocked_class.return_value
    yield mocked_instance


def test_lambda_handler_returns_400_missing_patient_id(
    invalid_event_missing_patient_id,
    context,
    set_env,
    mock_user_restriction_enabled,
):

    expected = ApiGatewayResponse(
        400,
        LambdaError.PatientIdNoKey.create_error_body(),
        "PATCH",
    ).create_api_gateway_response()

    actual = lambda_handler(invalid_event_missing_patient_id, context)
    assert actual == expected


def test_lambda_handler_returns_404_feature_flag_disabled(
    valid_event,
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
        methods="PATCH",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_event, context)
    assert actual == expected


def test_lambda_handler_returns_200_restriction_already_inactive(
    context,
    mock_user_restriction_enabled,
    set_env,
    mock_service,
    valid_event,
    mock_request_context,
):
    mock_service.handle_delete_restriction.side_effect = (
        UserRestrictionConditionCheckFailedException
    )

    body = {
        "message": LambdaError.UserRestrictionDynamoDBConditionError.value["message"],
        "err_code": LambdaError.UserRestrictionDynamoDBConditionError.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }

    expected = ApiGatewayResponse(
        status_code=400,
        body=json.dumps(body),
        methods="PATCH",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_event, context)
    assert actual == expected


def test_lambda_handler_happy_path(
    context,
    mock_user_restriction_enabled,
    mock_service,
    valid_event,
    mock_request_context,
    set_env,
):

    expected = ApiGatewayResponse(
        status_code=204,
        methods="PATCH",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_event, context)

    mock_service.handle_delete_restriction.assert_called_with(
        restriction_id=TEST_UUID,
        removed_by=MOCK_SMARTCARD_ID,
        nhs_number=TEST_NHS_NUMBER,
    )

    assert actual == expected
