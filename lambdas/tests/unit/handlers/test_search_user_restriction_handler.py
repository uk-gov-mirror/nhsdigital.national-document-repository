import base64
import json

import pytest

from enums.lambda_error import LambdaError
from handlers.user_restrictions.search_user_restriction_handler import (
    lambda_handler,
    parse_querystring_parameters,
)
from tests.unit.conftest import (
    MOCK_INTERACTION_ID,
    TEST_CURRENT_GP_ODS,
    TEST_NHS_NUMBER,
    TEST_UUID,
)
from utils.exceptions import (
    OdsErrorException,
    UserRestrictionException,
    UserRestrictionValidationException,
)
from utils.lambda_response import ApiGatewayResponse

TEST_SMARTCARD_ID = "123456789012"

TEST_LAST_EVALUATED_KEY = {"ID": TEST_UUID}
TEST_ENCODED_START_KEY = base64.b64encode(
    json.dumps(TEST_LAST_EVALUATED_KEY).encode("utf-8"),
).decode("utf-8")

MOCK_RESTRICTION = {
    "id": TEST_UUID,
    "restrictedSmartcard": TEST_SMARTCARD_ID,
    "nhsNumber": TEST_NHS_NUMBER,
    "custodian": TEST_CURRENT_GP_ODS,
    "isActive": True,
}


@pytest.fixture
def mock_service(mocker):
    mocked_class = mocker.patch(
        "handlers.user_restrictions.search_user_restriction_handler.SearchUserRestrictionService",
    )
    mocked_instance = mocked_class.return_value
    mocked_instance.process_request.return_value = ([MOCK_RESTRICTION], None)
    yield mocked_instance


@pytest.fixture
def mocked_extract_ods(mocker):
    mock = mocker.patch(
        "handlers.user_restrictions.search_user_restriction_handler.extract_ods_code_from_request_context",
    )
    mock.return_value = TEST_CURRENT_GP_ODS
    yield mock


@pytest.fixture
def mocked_extract_ods_error(mocker):
    mock = mocker.patch(
        "handlers.user_restrictions.search_user_restriction_handler.extract_ods_code_from_request_context",
    )
    mock.side_effect = OdsErrorException()
    yield mock


@pytest.fixture
def event_with_smart_card(event):
    updated = event.copy()
    updated["queryStringParameters"] = {"smartcardId": TEST_SMARTCARD_ID}
    return updated


@pytest.fixture
def event_with_nhs_number(event):
    updated = event.copy()
    updated["queryStringParameters"] = {"nhsNumber": TEST_NHS_NUMBER}
    return updated


@pytest.fixture
def event_with_limit_and_token(event):
    updated = event.copy()
    updated["queryStringParameters"] = {
        "limit": "5",
        "nextPageToken": TEST_ENCODED_START_KEY,
    }
    return updated


@pytest.fixture
def event_with_unknown_params(event):
    updated = event.copy()
    updated["queryStringParameters"] = {"unknown_param": "value"}
    return updated


def test_parse_querystring_parameters_returns_empty_dict_for_none(event):
    assert parse_querystring_parameters(event) == {}


def test_parse_querystring_parameters_extracts_smartcard_id(event_with_smart_card):
    result = parse_querystring_parameters(event_with_smart_card)
    assert result == {"smartcardId": TEST_SMARTCARD_ID}


def test_parse_querystring_parameters_extracts_nhs_number(event_with_nhs_number):
    result = parse_querystring_parameters(event_with_nhs_number)
    assert result == {"nhsNumber": TEST_NHS_NUMBER}


def test_parse_querystring_parameters_extracts_limit_and_token(
    event_with_limit_and_token,
):
    result = parse_querystring_parameters(event_with_limit_and_token)
    assert result == {
        "limit": "5",
        "nextPageToken": TEST_ENCODED_START_KEY,
    }


def test_parse_querystring_parameters_ignores_unknown_params(
    event_with_unknown_params,
):
    result = parse_querystring_parameters(event_with_unknown_params)
    assert result == {}


def test_handler_returns_200_with_restrictions_list(
    event,
    set_env,
    mock_service,
    mocked_extract_ods,
    context,
):
    expected_body = json.dumps({"restrictions": [MOCK_RESTRICTION], "count": 1})
    expected = ApiGatewayResponse(
        status_code=200,
        body=expected_body,
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected
    mock_service.process_request.assert_called_once_with(
        ods_code=TEST_CURRENT_GP_ODS,
        smartcard_id=None,
        nhs_number=None,
        next_page_token=None,
        limit=10,
    )


def test_handler_includes_next_token_when_present(
    event,
    set_env,
    mock_service,
    mocked_extract_ods,
    context,
):
    mock_service.process_request.return_value = (
        [MOCK_RESTRICTION],
        TEST_ENCODED_START_KEY,
    )

    actual = lambda_handler(event, context)

    body = json.loads(actual["body"])
    assert body["nextPageToken"] == TEST_ENCODED_START_KEY


def test_handler_returns_200_with_empty_list_when_no_results(
    event,
    set_env,
    mock_service,
    mocked_extract_ods,
    context,
):
    mock_service.process_request.return_value = ([], None)

    actual = lambda_handler(event, context)

    assert actual["statusCode"] == 200
    body = json.loads(actual["body"])
    assert body["restrictions"] == []
    assert body["count"] == 0


def test_handler_calls_service_with_smartcard_id(
    event_with_smart_card,
    set_env,
    mock_service,
    mocked_extract_ods,
    context,
):
    lambda_handler(event_with_smart_card, context)

    mock_service.process_request.assert_called_once_with(
        ods_code=TEST_CURRENT_GP_ODS,
        smartcard_id=TEST_SMARTCARD_ID,
        nhs_number=None,
        next_page_token=None,
        limit=10,
    )


def test_handler_calls_service_with_nhs_number(
    event_with_nhs_number,
    set_env,
    mock_service,
    mocked_extract_ods,
    context,
):
    lambda_handler(event_with_nhs_number, context)

    mock_service.process_request.assert_called_once_with(
        ods_code=TEST_CURRENT_GP_ODS,
        smartcard_id=None,
        nhs_number=TEST_NHS_NUMBER,
        next_page_token=None,
        limit=10,
    )


def test_handler_passes_limit_and_token_to_service(
    event_with_limit_and_token,
    set_env,
    mock_service,
    mocked_extract_ods,
    context,
):
    lambda_handler(event_with_limit_and_token, context)

    mock_service.process_request.assert_called_once_with(
        ods_code=TEST_CURRENT_GP_ODS,
        smartcard_id=None,
        nhs_number=None,
        next_page_token=TEST_ENCODED_START_KEY,
        limit="5",
    )


def test_handler_returns_401_when_no_ods_code_in_request_context(
    event,
    set_env,
    mock_service,
    mocked_extract_ods_error,
    context,
):
    expected_body = json.dumps(
        {
            "message": LambdaError.UserRestrictionMissingContext.value["message"],
            "err_code": LambdaError.UserRestrictionMissingContext.value["err_code"],
            "interaction_id": MOCK_INTERACTION_ID,
        },
    )
    expected = ApiGatewayResponse(
        status_code=401,
        body=expected_body,
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_handler_returns_400_when_service_raises_invalid_query_string(
    event,
    set_env,
    mock_service,
    mocked_extract_ods,
    context,
):
    mock_service.process_request.side_effect = UserRestrictionException("bad param")

    expected_body = json.dumps(
        {
            "message": f'{LambdaError.UserRestrictionInvalidEvent.value["message"]}: bad param',
            "err_code": LambdaError.UserRestrictionInvalidEvent.value["err_code"],
            "interaction_id": MOCK_INTERACTION_ID,
        },
    )
    expected = ApiGatewayResponse(
        status_code=400,
        body=expected_body,
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)
    assert actual == expected


def test_handler_returns_500_when_service_raises_db_error(
    event,
    mock_service,
    mocked_extract_ods,
    context,
    set_env,
):
    mock_service.process_request.side_effect = UserRestrictionValidationException(
        "DynamoDB error",
    )

    expected_body = json.dumps(
        {
            "message": LambdaError.UserRestrictionModelValidationError.value["message"],
            "err_code": LambdaError.UserRestrictionModelValidationError.value[
                "err_code"
            ],
            "interaction_id": MOCK_INTERACTION_ID,
        },
    )
    expected = ApiGatewayResponse(
        status_code=500,
        body=expected_body,
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)
    assert actual == expected
