import json
from copy import deepcopy
from enum import Enum

import pytest

from enums.snomed_codes import SnomedCodes
from handlers.document_reference_search_handler import (
    extract_querystring_params,
    lambda_handler,
)
from tests.unit.conftest import TEST_NHS_NUMBER
from tests.unit.helpers.data.dynamo.dynamo_responses import EXPECTED_RESPONSE
from utils.lambda_exceptions import DocumentRefSearchException
from utils.lambda_response import ApiGatewayResponse


class MockError(Enum):
    Error = {
        "message": "Client error",
        "err_code": "AB_XXXX",
        "interaction_id": "88888888-4444-4444-4444-121212121212",
    }


@pytest.fixture
def mocked_service(set_env, mocker):
    mocked_class = mocker.patch(
        "handlers.document_reference_search_handler.DocumentReferenceSearchService",
    )
    mocked_service = mocked_class.return_value
    yield mocked_service


def test_lambda_handler_returns_200(
    mocked_service,
    valid_id_event_without_auth_header,
    context,
):
    mocked_service.get_paginated_references_by_nhs_number.return_value = {
        "references": EXPECTED_RESPONSE * 2,
        "next_page_token": None,
    }

    expected = ApiGatewayResponse(
        200,
        json.dumps({"references": EXPECTED_RESPONSE * 2, "nextPageToken": None}),
        "GET",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_id_event_without_auth_header, context)

    assert expected == actual


def test_lambda_handler_raises_exception_returns_500(
    mocked_service,
    valid_id_event_without_auth_header,
    context,
):
    mocked_service.get_paginated_references_by_nhs_number.side_effect = (
        DocumentRefSearchException(500, MockError.Error)
    )
    expected = ApiGatewayResponse(
        500,
        json.dumps(MockError.Error.value),
        "GET",
    ).create_api_gateway_response()
    actual = lambda_handler(valid_id_event_without_auth_header, context)
    assert expected == actual


def test_lambda_handler_when_id_not_valid_returns_400(
    set_env,
    invalid_id_event,
    context,
):
    expected_body = json.dumps(
        {
            "message": "Invalid patient number 900000000900",
            "err_code": "PN_4001",
            "interaction_id": "88888888-4444-4444-4444-121212121212",
        },
    )
    expected = ApiGatewayResponse(
        400,
        expected_body,
        "GET",
    ).create_api_gateway_response()
    actual = lambda_handler(invalid_id_event, context)
    assert expected == actual


def test_lambda_handler_when_id_not_supplied_returns_400(
    set_env,
    missing_id_event,
    context,
):
    expected_body = json.dumps(
        {
            "message": "An error occurred due to missing key",
            "err_code": "PN_4002",
            "interaction_id": "88888888-4444-4444-4444-121212121212",
        },
    )
    expected = ApiGatewayResponse(
        400,
        expected_body,
        "GET",
    ).create_api_gateway_response()
    actual = lambda_handler(missing_id_event, context)
    assert expected == actual


def test_lambda_handler_when_dynamo_tables_env_variable_not_supplied_then_return_500_response(
    valid_id_event_without_auth_header,
    context,
):
    expected_body = json.dumps(
        {
            "message": "An error occurred due to missing environment variable: 'LLOYD_GEORGE_DYNAMODB_NAME'",
            "err_code": "ENV_5001",
            "interaction_id": "88888888-4444-4444-4444-121212121212",
        },
    )
    expected = ApiGatewayResponse(
        500,
        expected_body,
        "GET",
    ).create_api_gateway_response()
    actual = lambda_handler(valid_id_event_without_auth_header, context)
    assert expected == actual


def test_lambda_handler_applies_doc_status_filter(
    set_env,
    valid_id_event_without_auth_header,
    context,
    mocked_service,
):
    mocked_service.get_paginated_references_by_nhs_number.return_value = {
        "references": EXPECTED_RESPONSE,
        "next_page_token": None,
    }

    expected = ApiGatewayResponse(
        200,
        json.dumps(
            {
                "references": EXPECTED_RESPONSE,
                "nextPageToken": None,
            },
        ),
        "GET",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_id_event_without_auth_header, context)

    assert expected == actual

    mocked_service.get_paginated_references_by_nhs_number.assert_called_once_with(
        nhs_number=TEST_NHS_NUMBER,
        limit=None,
        next_page_token=None,
        filter={"doc_status": "final"},
    )


def test_lambda_handler_with_doc_type_applies_doc_type_filter(
    set_env,
    valid_id_event_without_auth_header,
    context,
    mocked_service,
):
    mocked_service.get_paginated_references_by_nhs_number.return_value = {
        "references": EXPECTED_RESPONSE,
        "next_page_token": None,
    }

    expected = ApiGatewayResponse(
        200,
        json.dumps({"references": EXPECTED_RESPONSE, "nextPageToken": None}),
        "GET",
    ).create_api_gateway_response()

    doc_type = SnomedCodes.LLOYD_GEORGE.value.code
    valid_id_event_without_auth_header["queryStringParameters"]["docType"] = doc_type

    actual = lambda_handler(valid_id_event_without_auth_header, context)

    assert expected == actual

    mocked_service.get_paginated_references_by_nhs_number.assert_called_once_with(
        nhs_number=TEST_NHS_NUMBER,
        limit=None,
        next_page_token=None,
        # check_upload_completed=True,
        filter={"document_snomed_code": doc_type, "doc_status": "final"},
    )


def test_extract_querystring_params_next_page_token_present(
    valid_id_event_without_auth_header,
):
    event = deepcopy(valid_id_event_without_auth_header)
    event["queryStringParameters"].update({"nextPageToken": "abc"})

    expected = (TEST_NHS_NUMBER, "abc", None)

    actual = extract_querystring_params(event)

    assert expected == actual


def test_extract_querystring_params_no_next_page_token(
    valid_id_event_without_auth_header,
):
    expected = (TEST_NHS_NUMBER, None, None)
    actual = extract_querystring_params(valid_id_event_without_auth_header)
    assert expected == actual


def test_extract_querystring_params_limit_passed(valid_id_event_without_auth_header):
    event = deepcopy(valid_id_event_without_auth_header)
    event["queryStringParameters"].update({"limit": "10"})

    expected = (TEST_NHS_NUMBER, None, "10")
    actual = extract_querystring_params(event)

    assert expected == actual


def test_handler_uses_pagination_expected_params_passed(
    valid_id_event_without_auth_header,
    mocked_service,
    context,
):

    limit_event = deepcopy(valid_id_event_without_auth_header)
    limit_event["queryStringParameters"].update({"limit": "10"})

    token_event = deepcopy(valid_id_event_without_auth_header)
    token_event["queryStringParameters"].update({"nextPageToken": "abc"})

    events = [limit_event, token_event]

    for event in events:
        lambda_handler(event, context)
        mocked_service.get_paginated_references_by_nhs_number.assert_called()


def test_lambda_handler_with_invalid_doc_type_returns_400(
    set_env,
    valid_id_event_without_auth_header,
    context,
    mocked_service,
):

    invalid_doc_type = "invalid_doc_type"
    valid_id_event_without_auth_header["queryStringParameters"][
        "docType"
    ] = invalid_doc_type

    expected_body = json.dumps(
        {
            "message": "Invalid document type requested",
            "err_code": "VDT_4002",
            "interaction_id": "88888888-4444-4444-4444-121212121212",
        },
    )
    expected = ApiGatewayResponse(
        400,
        expected_body,
        "GET",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_id_event_without_auth_header, context)

    assert expected == actual
