import base64
import json

import pytest
from handlers.search_document_review_handler import (
    get_ods_code_from_request_context,
    lambda_handler,
    parse_querystring_parameters,
)
from models.document_review import DocumentUploadReviewReference
from tests.unit.conftest import TEST_CURRENT_GP_ODS, TEST_UUID
from tests.unit.helpers.data.search_document_review.dynamo_response import (
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE,
)
from utils.exceptions import OdsErrorException, SearchDocumentReviewReferenceException
from utils.lambda_response import ApiGatewayResponse

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
        "headers": {"Authorization": "Bearer test_token"},
    }


@pytest.fixture
def event_with_limit_and_start_key():
    return {
        "httpMethod": "GET",
        "queryStringParameters": {
            "limit": TEST_QUERY_LIMIT,
            "startKey": base64.b64encode(TEST_UUID.encode("ascii")).decode("utf-8"),
        },
        "headers": {"Authorization": "Bearer test_token"},
    }


@pytest.fixture
def event_with_start_key_no_limit():
    return {
        "httpMethod": "GET",
        "queryStringParameters": {
            "startKey": base64.b64encode(TEST_UUID.encode("ascii")).decode("utf-8"),
        },
        "headers": {"Authorization": "Bearer test_token"},
    }


@pytest.fixture()
def mocked_request_context_with_ods(mocker):
    mocked_context = mocker.MagicMock()
    mocked_context.authorization = {
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS},
    }
    yield mocker.patch(
        "handlers.search_document_review_handler.request_context", mocked_context
    )


@pytest.fixture()
def mocked_request_context_without_ods(mocker):
    mocked_context = mocker.MagicMock()
    mocked_context.authorization = {
        "selected_organisation": {"org_ods_code": ""},
    }
    yield mocker.patch(
        "handlers.search_document_review_handler.request_context", mocked_context
    )


def test_get_ods_code_from_request(mocked_request_context_with_ods):

    assert get_ods_code_from_request_context() == TEST_CURRENT_GP_ODS


def test_get_ods_code_from_request_throws_exception_no_ods(
    mocked_request_context_without_ods,
):

    with pytest.raises(OdsErrorException):
        get_ods_code_from_request_context()


def test_handler_returns_400_response_no_ods_code_in_request_context(
    set_env, context, event, mock_service, mocked_request_context_without_ods
):

    expected = ApiGatewayResponse(
        status_code=400, body="No ODS code provided.", methods="GET"
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_parse_querystring_parameters(
    event_with_limit_and_start_key,
    event,
    event_with_limit,
    event_with_start_key_no_limit,
):

    assert parse_querystring_parameters(event_with_limit_and_start_key) == (
        TEST_QUERY_LIMIT,
        TEST_UUID,
    )
    assert parse_querystring_parameters(event) == (None, None)
    assert parse_querystring_parameters(event_with_limit) == (TEST_QUERY_LIMIT, None)
    assert parse_querystring_parameters(event_with_start_key_no_limit) == (
        None,
        TEST_UUID,
    )


def test_get_document_review_document_references_called_with_correct_arguments(
    mock_service, context, set_env, event_with_limit, mocked_request_context_with_ods
):

    lambda_handler(event_with_limit, context)

    mock_service.get_review_document_references.assert_called_with(
        ods_code=TEST_CURRENT_GP_ODS, limit=TEST_QUERY_LIMIT, start_key=None
    )


def test_handler_returns_empty_list_of_references_no_dynamo_results_no_limit_in_query_params(
    mock_service, context, set_env, mocked_request_context_with_ods, event
):

    mock_service.get_review_document_references.return_value = ([], None)

    expected = ApiGatewayResponse(
        status_code=200,
        body=json.dumps(
            {
                "documentReviewReferences": [],
                "lastEvaluatedKey": None,
                "count": 0,
            }
        ),
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_handler_returns_list_of_references_last_evaluated_key_more_results_available(
    mock_service, context, set_env, mocked_request_context_with_ods, event_with_limit
):

    references = [
        DocumentUploadReviewReference.model_validate(item)
        for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    ]

    mock_service.get_review_document_references.return_value = (
        references,
        MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["LastEvaluatedKey"],
    )

    expected = ApiGatewayResponse(
        status_code=200,
        body=json.dumps(
            {
                "documentReviewReferences": [
                    reference.model_dump_json(
                        exclude_none=True, include={"id", "nhs_number", "review_reason"}
                    )
                    for reference in references
                ],
                "lastEvaluatedKey": base64.b64encode(
                    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["LastEvaluatedKey"].encode(
                        "ascii"
                    )
                ).decode("utf-8"),
                "count": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Count"],
            }
        ),
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event_with_limit, context)

    assert actual == expected


def test_handler_returns_list_of_references_no_limit_passed(
    mock_service, context, set_env, mocked_request_context_with_ods, event
):
    references = [
        DocumentUploadReviewReference.model_validate(item)
        for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    ]

    mock_service.get_review_document_references.return_value = (references, None)

    expected = ApiGatewayResponse(
        status_code=200,
        body=json.dumps(
            {
                "documentReviewReferences": [
                    reference.model_dump_json(
                        exclude_none=True, include={"id", "nhs_number", "review_reason"}
                    )
                    for reference in references
                ],
                "lastEvaluatedKey": None,
                "count": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Count"],
            }
        ),
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_handler_returns_500_response_error_raised(
    mock_service, context, set_env, mocked_request_context_with_ods, event_with_limit
):

    mock_service.get_review_document_references.side_effect = (
        SearchDocumentReviewReferenceException()
    )

    expected = ApiGatewayResponse(
        status_code=500,
        body="Error retrieving for document review references.",
        methods="GET",
    ).create_api_gateway_response()
    actual = lambda_handler(event_with_limit, context)

    assert actual == expected


def test_handler_returns_list_of_references_last_results_fetched():
    pass
