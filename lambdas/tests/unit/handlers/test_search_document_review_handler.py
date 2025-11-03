import pytest
from handlers.search_document_review_handler import (
    get_ods_code_from_request,
    get_query_limit,
    lambda_handler,
)
from tests.unit.conftest import TEST_CURRENT_GP_ODS
from utils.exceptions import OdsErrorException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

TEST_QUERY_LIMIT = 20


@pytest.fixture
def mock_service(mocker):
    mocked_class = mocker.patch(
        "handlers.search_document_review_handler.SearchDocumentReviewService"
    )
    mocked_instance = mocked_class.return_value
    mocker.patch.object(mocked_instance, "dynamo_service")
    yield mocked_instance


def test_get_ods_code_from_request():
    request_context.authorization = {
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS}
    }

    assert get_ods_code_from_request() == TEST_CURRENT_GP_ODS


def test_get_ods_code_from_request_throws_exception_no_ods():
    request_context.authorization = {"selected_organisation": {"org_ods_code": ""}}

    with pytest.raises(OdsErrorException):
        get_ods_code_from_request()

def test_handler_returns_400_response_no_ods_code_in_request_context(set_env, context):
    request_context.authorization = {"selected_organisation": {"org_ods_code": ""}}

    event = {
        "httpMethod": "GET",
    }

    expected = ApiGatewayResponse(
        status_code=400,
        body="No ODS code provided.",
        methods="GET").create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_get_query_limit_from_querystring_params():
    event = {
        "httpMethod": "GET",
        "queryStringParameters": {
            "limit": TEST_QUERY_LIMIT,
        },
    }
    assert get_query_limit(event) == TEST_QUERY_LIMIT


def test_get_query_limit_returns_none_no_querystring_params():
    event = {
        "httpMethod": "GET",
    }
    assert get_query_limit(event) is None


def test_get_document_review_document_references_called_with_correct_arguments(
    mock_service, context, set_env
):
    request_context.authorization = {
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS}
    }

    event = {
        "httpMethod": "GET",
        "queryStringParameters": {
            "limit": TEST_QUERY_LIMIT,
        },
        "headers": {"Authorization": "test_token"},
    }

    lambda_handler(event, context)

    mock_service.get_review_document_references.assert_called_with(
        ods_code=TEST_CURRENT_GP_ODS, limit=TEST_QUERY_LIMIT
    )


def test_dynamo_query_called_with_limit_from_query_string_params(
    context, mock_service, set_env
):
    event = {
        "httpMethod": "GET",
        "queryStringParameters": {
            "limit": TEST_QUERY_LIMIT,
        },
    }

    lambda_handler(event, context)

    mock_service.dynamo_service.query_table.assert_called_with()



def test_handler_returns_empty_list_of_references_no_dynamo_results():
    pass

def test_handler_returns_500_response_error_raised():
    pass

def test_handler_returns_list_of_references_last_evaluated_key_more_results_available():
    pass

def test_handler_returns_list_of_references_last_results_fetched():
    pass
