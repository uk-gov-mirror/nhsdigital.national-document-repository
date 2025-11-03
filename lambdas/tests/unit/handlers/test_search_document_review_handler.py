import json

import pytest

from handlers.search_document_review_handler import (
    get_ods_code_from_request_context,
    get_query_limit,
    lambda_handler,
)
from models.document_review import DocumentUploadReviewReference
from tests.unit.conftest import TEST_CURRENT_GP_ODS
from tests.unit.helpers.data.search_document_review.dynamo_response import MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE
from utils.exceptions import OdsErrorException, SearchDocumentReviewReferenceException
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


@pytest.fixture
def event_with_limit():
    return {
        "httpMethod": "GET",
        "queryStringParameters": {
            "limit": TEST_QUERY_LIMIT,
        },
    }

@pytest.fixture
def event_without_limit():
    return {
        "httpMethod": "GET",
    }

@pytest.fixture
def request_context_with_ods():
    request_context.authorization = {
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS}
    }
    return request_context

@pytest.fixture
def request_context_no_ods():
    request_context.authorization = {"selected_organisation": {"org_ods_code": ""}}
    return request_context


def test_get_ods_code_from_request(request_context_with_ods):

    assert get_ods_code_from_request_context() == TEST_CURRENT_GP_ODS


def test_get_ods_code_from_request_throws_exception_no_ods(request_context_no_ods):

    with pytest.raises(OdsErrorException):
        get_ods_code_from_request_context()

def test_handler_returns_400_response_no_ods_code_in_request_context(
        set_env, context, event_without_limit, request_context_no_ods):

    expected = ApiGatewayResponse(
        status_code=400,
        body="No ODS code provided.",
        methods="GET").create_api_gateway_response()

    actual = lambda_handler(event_without_limit, context)

    assert actual == expected


def test_get_query_limit_from_querystring_params(event_with_limit):

    assert get_query_limit(event_with_limit) == TEST_QUERY_LIMIT


def test_get_query_limit_returns_none_no_querystring_params():
    event = {
        "httpMethod": "GET",
    }
    assert get_query_limit(event) is None


def test_get_document_review_document_references_called_with_correct_arguments(
    mock_service, context, set_env, request_context_with_ods, event_with_limit
):

    lambda_handler(event_with_limit, context)

    mock_service.get_review_document_references.assert_called_with(
        ods_code=TEST_CURRENT_GP_ODS, limit=TEST_QUERY_LIMIT
    )


def test_handler_returns_empty_list_of_references_no_dynamo_results_no_limit_in_query_params(
        mock_service, context, set_env, request_context_with_ods, event_without_limit):

    mock_service.get_review_document_references.return_value = ([], None)

    expected = ApiGatewayResponse(
        status_code=200,
        body=json.dumps({
            "documentReviewReferences": [],
            "lastEvaluatedKey": None,
        }),
        methods="GET"
    ).create_api_gateway_response()

    actual = lambda_handler(event_without_limit, context)

    assert actual == expected


def test_handler_returns_list_of_references_last_evaluated_key_more_results_available(
        mock_service, context, set_env, request_context_with_ods, event_with_limit):

    references = [DocumentUploadReviewReference.model_validate(item) for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]]

    mock_service.get_review_document_references.return_value = (references, MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["LastEvaluatedKey"])

    expected = ApiGatewayResponse(
        status_code=200,
        body=json.dumps({
            "documentReviewReferences":  [reference.model_dump_json() for reference in references],
            "lastEvaluatedKey": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["LastEvaluatedKey"],
        }),
        methods="GET"
    ).create_api_gateway_response()

    actual = lambda_handler(event_with_limit, context)

    assert actual == expected


def test_handler_returns_list_of_references_no_limit_passed(
        mock_service, context, set_env, request_context_with_ods, event_without_limit
):
    references = [DocumentUploadReviewReference.model_validate(item) for item in
                  MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]]

    mock_service.get_review_document_references.return_value = (references, None)

    expected = ApiGatewayResponse(
        status_code=200,
        body=json.dumps({
            "documentReviewReferences": [reference.model_dump_json() for reference in references],
            "lastEvaluatedKey": None
        }),
        methods="GET"
    ).create_api_gateway_response()

    actual = lambda_handler(event_without_limit, context)

    assert actual == expected


def test_handler_returns_500_response_error_raised(
        mock_service, context, set_env, request_context_with_ods, event_with_limit):

    mock_service.get_review_document_references.side_effect = SearchDocumentReviewReferenceException()

    expected = ApiGatewayResponse(
        status_code=500,
        body="Error retrieving for document review references.",
        methods="GET"
    ).create_api_gateway_response()
    actual = lambda_handler(event_with_limit, context)

    assert actual == expected


def test_handler_returns_list_of_references_last_results_fetched():
    pass
