import base64
import json

import pytest

from enums.lambda_error import LambdaError
from handlers.search_document_review_handler import (
    lambda_handler,
    parse_querystring_parameters,
)
from models.document_review import DocumentUploadReviewReference
from tests.unit.conftest import MOCK_INTERACTION_ID, TEST_CURRENT_GP_ODS, TEST_UUID
from tests.unit.helpers.data.search_document_review.dynamo_response import (
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE,
)
from utils.exceptions import OdsErrorException
from utils.lambda_exceptions import DocumentReviewLambdaException
from utils.lambda_response import ApiGatewayResponse

TEST_QUERY_LIMIT = "20"
TEST_LAST_EVALUATED_KEY = {"id": TEST_UUID}
TEST_ENCODED_START_KEY = base64.b64encode(
    json.dumps(TEST_LAST_EVALUATED_KEY).encode("ascii"),
).decode("utf-8")

MOCK_EMPTY_QUERYSTRING_PARAMS = {}
MOCK_QUERYSTRING_PARAMS_LIMIT = {"limit": TEST_QUERY_LIMIT}
MOCK_QUERYSTRING_PARAMS_LIMIT_KEY = {
    "limit": TEST_QUERY_LIMIT,
    "nextPageToken": TEST_ENCODED_START_KEY,
}
MOCK_QUERYSTRING_PARAMS_LIMIT_KEY_UPLOAD = {
    "uploader": "Z67890",
    **MOCK_QUERYSTRING_PARAMS_LIMIT_KEY,
}
MOCK_QUERYSTRING_PARAMS_UNWANTED_PARAM = {"unwanted": "this is not added"}
MOCK_QUERYSTRING_PARAMS_KEY = {"nextPageToken": TEST_ENCODED_START_KEY}


@pytest.fixture
def mock_service(mocker):
    mocked_class = mocker.patch(
        "handlers.search_document_review_handler.SearchDocumentReviewService",
    )
    mocked_instance = mocked_class.return_value
    yield mocked_instance


@pytest.fixture
def event_with_limit():
    return {
        "httpMethod": "GET",
        "queryStringParameters": MOCK_QUERYSTRING_PARAMS_LIMIT,
        "headers": {"Authorization": "Bearer test_token"},
    }


@pytest.fixture
def event_with_limit_and_start_key():
    return {
        "httpMethod": "GET",
        "queryStringParameters": MOCK_QUERYSTRING_PARAMS_LIMIT_KEY,
        "headers": {"Authorization": "Bearer test_token"},
    }


@pytest.fixture
def event_with_start_key_no_limit():
    return {
        "httpMethod": "GET",
        "queryStringParameters": MOCK_QUERYSTRING_PARAMS_KEY,
        "headers": {"Authorization": "Bearer test_token"},
    }


@pytest.fixture
def event_with_unwanted_params():
    return {
        "httpMethod": "GET",
        "queryStringParameters": MOCK_QUERYSTRING_PARAMS_UNWANTED_PARAM,
        "headers": {"Authorization": "Bearer test_token"},
    }


@pytest.fixture
def event_with_all_params():
    return {
        "httpMethod": "GET",
        "queryStringParameters": MOCK_QUERYSTRING_PARAMS_LIMIT_KEY_UPLOAD,
        "headers": {"Authorization": "Bearer test_token"},
    }


@pytest.fixture()
def mocked_extract_ods_with_ods_code(mocker):
    mock_extract = mocker.patch(
        "handlers.search_document_review_handler.extract_ods_code_from_request_context",
    )
    mock_extract.return_value = TEST_CURRENT_GP_ODS
    yield mock_extract


@pytest.fixture()
def mocked_extract_ods_code_error(mocker):
    mocked_extract = mocker.patch(
        "handlers.search_document_review_handler.extract_ods_code_from_request_context",
    )
    mocked_extract.side_effect = OdsErrorException()
    yield mocked_extract


def test_handler_returns_401_response_no_ods_code_in_request_context(
    set_env,
    context,
    event,
    mock_service,
    mocked_extract_ods_code_error,
):
    body = json.dumps(
        {
            "message": LambdaError.DocumentReviewMissingODS.value["message"],
            "err_code": LambdaError.DocumentReviewMissingODS.value["err_code"],
            "interaction_id": MOCK_INTERACTION_ID,
        },
    )

    expected = ApiGatewayResponse(
        status_code=401,
        body=body,
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_parse_querystring_parameters(
    event_with_limit_and_start_key,
    event,
    event_with_limit,
    event_with_start_key_no_limit,
    event_with_unwanted_params,
    event_with_all_params,
):
    assert (
        parse_querystring_parameters(event_with_limit_and_start_key)
        == MOCK_QUERYSTRING_PARAMS_LIMIT_KEY
    )
    assert parse_querystring_parameters(event) == {}
    assert (
        parse_querystring_parameters(event_with_limit) == MOCK_QUERYSTRING_PARAMS_LIMIT
    )
    assert (
        parse_querystring_parameters(event_with_start_key_no_limit)
        == MOCK_QUERYSTRING_PARAMS_KEY
    )
    assert parse_querystring_parameters(event_with_unwanted_params) == {}
    assert (
        parse_querystring_parameters(event_with_all_params)
        == MOCK_QUERYSTRING_PARAMS_LIMIT_KEY_UPLOAD
    )


def test_process_request_called_with_correct_arguments(
    mock_service,
    context,
    set_env,
    event_with_all_params,
    mocked_extract_ods_with_ods_code,
):

    lambda_handler(event_with_all_params, context)

    params = MOCK_QUERYSTRING_PARAMS_LIMIT_KEY_UPLOAD

    mock_service.process_request.assert_called_with(
        params=params,
        ods_code=TEST_CURRENT_GP_ODS,
    )


def test_handler_returns_empty_list_of_references_no_dynamo_results_no_limit_in_query_params(
    mock_service,
    context,
    set_env,
    mocked_extract_ods_with_ods_code,
    event,
):

    mock_service.process_request.return_value = ([], None)

    expected = ApiGatewayResponse(
        status_code=200,
        body=json.dumps(
            {
                "documentReviewReferences": [],
                "count": 0,
            },
        ),
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_handler_returns_list_of_references_last_evaluated_key_more_results_available(
    mock_service,
    context,
    set_env,
    mocked_extract_ods_with_ods_code,
    event_with_limit,
):

    references = [
        DocumentUploadReviewReference.model_validate(item).model_dump_camel_case(
            exclude_none=True,
            include={"id", "nhs_number", "review_reason", "document_snomed_code_type"},
            mode="json",
        )
        for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    ]

    mock_service.process_request.return_value = (
        references,
        TEST_ENCODED_START_KEY,
    )

    expected = ApiGatewayResponse(
        status_code=200,
        body=json.dumps(
            {
                "documentReviewReferences": references,
                "count": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Count"],
                "nextPageToken": TEST_ENCODED_START_KEY,
            },
        ),
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event_with_limit, context)

    assert actual == expected


def test_handler_returns_list_of_references_no_limit_passed(
    mock_service,
    context,
    set_env,
    mocked_extract_ods_with_ods_code,
    event,
):
    references = [
        DocumentUploadReviewReference.model_validate(item).model_dump_camel_case(
            exclude_none=True,
            include={"id", "nhs_number", "review_reason", "document_snomed_code_type"},
            mode="json",
        )
        for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    ]

    mock_service.process_request.return_value = (references, None)

    expected = ApiGatewayResponse(
        status_code=200,
        body=json.dumps(
            {
                "documentReviewReferences": references,
                "count": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Count"],
            },
        ),
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)

    assert actual == expected


def test_handler_returns_500_response_error_raised(
    mock_service,
    context,
    set_env,
    mocked_extract_ods_with_ods_code,
    event_with_limit,
):

    mock_service.process_request.side_effect = DocumentReviewLambdaException(
        500,
        LambdaError.DocumentReviewValidation,
    )

    body = json.dumps(
        {
            "message": LambdaError.DocumentReviewValidation.value["message"],
            "err_code": LambdaError.DocumentReviewValidation.value["err_code"],
            "interaction_id": MOCK_INTERACTION_ID,
        },
    )

    expected = ApiGatewayResponse(
        status_code=500,
        body=body,
        methods="GET",
    ).create_api_gateway_response()
    actual = lambda_handler(event_with_limit, context)

    assert actual == expected
