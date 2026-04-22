import json

import pytest

from enums.lambda_error import LambdaError
from lambdas.handlers.user_restrictions.create_user_restriction_handler import (
    lambda_handler,
    parse_body,
)
from tests.unit.conftest import (
    MOCK_CREATOR_ID,
    MOCK_INTERACTION_ID,
    MOCK_SMART_CARD_ID,
    TEST_CURRENT_GP_ODS,
    TEST_NHS_NUMBER,
    TEST_UUID,
)
from utils.exceptions import (
    HealthcareWorkerAPIException,
    HealthcareWorkerPractitionerModelException,
    UserRestrictionAlreadyExistsException,
)
from utils.lambda_exceptions import LambdaException
from utils.lambda_response import ApiGatewayResponse


@pytest.fixture
def mock_service(set_env, mocker):
    mock = mocker.patch(
        "lambdas.handlers.user_restrictions.create_user_restriction_handler.CreateUserRestrictionService",
    )
    yield mock.return_value


def test_lambda_handler_returns_201_on_success(
    valid_create_restriction_event,
    context,
    mock_service,
    mock_request_context,
    mock_pds_service_with_matching_ods,
):
    mock_service.create_restriction.return_value = TEST_UUID

    expected = ApiGatewayResponse(
        201,
        json.dumps({"id": TEST_UUID}),
        "POST",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_create_restriction_event, context)

    assert actual == expected


def test_lambda_handler_calls_service_with_correct_args(
    valid_create_restriction_event,
    context,
    mock_service,
    mock_request_context,
    mock_pds_service_with_matching_ods,
):
    mock_service.create_restriction.return_value = TEST_UUID

    lambda_handler(valid_create_restriction_event, context)

    mock_service.create_restriction.assert_called_once_with(
        restricted_smartcard_id=MOCK_SMART_CARD_ID,
        nhs_number=TEST_NHS_NUMBER,
        custodian=TEST_CURRENT_GP_ODS,
        creator=MOCK_CREATOR_ID,
    )


def test_lambda_handler_returns_400_when_body_missing(
    context,
    set_env,
    mock_request_context,
):
    event = {
        "httpMethod": "POST",
        "headers": {},
        "queryStringParameters": {"patientId": TEST_NHS_NUMBER},
    }

    body = {
        "message": LambdaError.UserRestrictionInvalidEvent.value["message"],
        "err_code": LambdaError.UserRestrictionInvalidEvent.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }
    expected = ApiGatewayResponse(
        status_code=400,
        body=json.dumps(body),
        methods="POST",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_lambda_handler_returns_400_when_smart_card_id_missing(
    context,
    set_env,
    mock_request_context,
):
    event = {
        "httpMethod": "POST",
        "headers": {},
        "queryStringParameters": {"patientId": TEST_NHS_NUMBER},
        "body": json.dumps({"nhsNumber": TEST_NHS_NUMBER}),
    }

    body = {
        "message": LambdaError.UserRestrictionInvalidEvent.value["message"],
        "err_code": LambdaError.UserRestrictionInvalidEvent.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }
    expected = ApiGatewayResponse(
        status_code=400,
        body=json.dumps(body),
        methods="POST",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_lambda_handler_returns_400_when_nhs_number_missing(
    context,
    set_env,
    mock_request_context,
):
    event = {
        "httpMethod": "POST",
        "headers": {},
        "queryStringParameters": {"patientId": TEST_NHS_NUMBER},
        "body": json.dumps({"smartcardId": MOCK_SMART_CARD_ID}),
    }

    body = {
        "message": LambdaError.UserRestrictionInvalidEvent.value["message"],
        "err_code": LambdaError.UserRestrictionInvalidEvent.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }
    expected = ApiGatewayResponse(
        status_code=400,
        body=json.dumps(body),
        methods="POST",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_lambda_handler_returns_400_when_creator_missing(
    valid_create_restriction_event,
    context,
    set_env,
    mocker,
):
    mock_ctx = mocker.patch("utils.ods_utils.request_context")
    mock_ctx.authorization = {
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS},
    }

    body = {
        "message": LambdaError.UserRestrictionMissingContext.value["message"],
        "err_code": LambdaError.UserRestrictionMissingContext.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }
    expected = ApiGatewayResponse(
        status_code=400,
        body=json.dumps(body),
        methods="POST",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_create_restriction_event, context)

    assert actual == expected


def test_lambda_handler_returns_400_when_ods_code_missing(
    valid_create_restriction_event,
    context,
    set_env,
    mocker,
):
    mock_ctx = mocker.patch("utils.ods_utils.request_context")
    mock_ctx.authorization = {"nhs_user_id": MOCK_CREATOR_ID}

    body = {
        "message": LambdaError.UserRestrictionMissingContext.value["message"],
        "err_code": LambdaError.UserRestrictionMissingContext.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }
    expected = ApiGatewayResponse(
        status_code=400,
        body=json.dumps(body),
        methods="POST",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_create_restriction_event, context)

    assert actual == expected


def test_lambda_handler_returns_409_when_restriction_already_exists(
    valid_create_restriction_event,
    context,
    mock_service,
    mock_request_context,
    mock_pds_service_with_matching_ods,
):
    mock_service.create_restriction.side_effect = UserRestrictionAlreadyExistsException(
        "A restriction already exists for this user and patient",
    )

    body = {
        "message": LambdaError.UserRestrictionAlreadyExists.value["message"],
        "err_code": LambdaError.UserRestrictionAlreadyExists.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }
    expected = ApiGatewayResponse(
        status_code=409,
        body=json.dumps(body),
        methods="POST",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_create_restriction_event, context)

    assert actual == expected


def test_lambda_handler_returns_correct_status_on_healthcare_worker_api_exception(
    valid_create_restriction_event,
    context,
    mock_service,
    mock_request_context,
    mock_pds_service_with_matching_ods,
):
    mock_service.create_restriction.side_effect = HealthcareWorkerAPIException(
        status_code=404,
    )

    body = {
        "message": "Healthcare Worker API unable to find practitioner with status code: 404",
        "err_code": LambdaError.GetUserInfoError.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }
    expected = ApiGatewayResponse(
        status_code=404,
        body=json.dumps(body),
        methods="POST",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_create_restriction_event, context)

    assert actual == expected


def test_lambda_handler_returns_400_when_patient_id_does_not_match_nhs_number(
    context,
    set_env,
    mock_request_context,
):
    event = {
        "httpMethod": "POST",
        "headers": {"Authorization": "test_token"},
        "queryStringParameters": {"patientId": "9000000017"},
        "body": json.dumps(
            {"smartcardId": MOCK_SMART_CARD_ID, "nhsNumber": TEST_NHS_NUMBER},
        ),
    }

    body = {
        "message": LambdaError.PatientIdMismatch.value["message"],
        "err_code": LambdaError.PatientIdMismatch.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }
    expected = ApiGatewayResponse(
        status_code=400,
        body=json.dumps(body),
        methods="POST",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_lambda_handler_returns_500_on_practitioner_model_exception(
    valid_create_restriction_event,
    context,
    mock_service,
    mock_request_context,
    mock_pds_service_with_matching_ods,
):
    mock_service.create_restriction.side_effect = (
        HealthcareWorkerPractitionerModelException()
    )

    body = {
        "message": "Malformed user restriction model error: Failed to validate against practitioner model.",
        "err_code": LambdaError.UserRestrictionModelValidationError.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }
    expected = ApiGatewayResponse(
        status_code=500,
        body=json.dumps(body),
        methods="POST",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_create_restriction_event, context)

    assert actual == expected


# --- parse_body unit tests ---


def test_parse_body_returns_fields_on_valid_input():
    body = json.dumps(
        {"smartcardId": MOCK_SMART_CARD_ID, "nhsNumber": TEST_NHS_NUMBER},
    )

    result = parse_body(body)

    assert result == (MOCK_SMART_CARD_ID, TEST_NHS_NUMBER)


def test_parse_body_raises_when_body_is_none():
    with pytest.raises(LambdaException) as exc_info:
        parse_body(None)
    assert (
        exc_info.value.err_code
        == LambdaError.UserRestrictionInvalidEvent.value["err_code"]
    )
    assert (
        exc_info.value.message
        == LambdaError.UserRestrictionInvalidEvent.value["message"]
    )


def test_parse_body_raises_when_smart_card_id_missing():
    with pytest.raises(LambdaException) as exc_info:
        parse_body(json.dumps({"nhsNumber": TEST_NHS_NUMBER}))
    assert (
        exc_info.value.err_code
        == LambdaError.UserRestrictionInvalidEvent.value["err_code"]
    )


def test_parse_body_raises_when_nhs_number_missing():
    with pytest.raises(LambdaException) as exc_info:
        parse_body(json.dumps({"smartcardId": MOCK_SMART_CARD_ID}))
    assert (
        exc_info.value.err_code
        == LambdaError.UserRestrictionInvalidEvent.value["err_code"]
    )
