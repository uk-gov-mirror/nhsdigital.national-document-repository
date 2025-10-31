import pytest

from tests.unit.conftest import TEST_CURRENT_GP_ODS
from utils.exceptions import OdsErrorException
from utils.request_context import request_context
from handlers.search_document_review_handler import get_ods_code_from_request, lambda_handler, get_query_limit


TEST_QUERY_LIMIT = 20

@pytest.fixture
def mock_service(mocker):
    mocked_class = mocker.patch("handlers.search_document_review_handler.SearchDocumentReviewService")
    mocked_instance = mocked_class.return_value
    mocker.patch.object(mocked_instance, "dynamo_service")
    yield mocked_instance


def test_get_ods_code_from_request():
    request_context.authorization = {
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS}
    }

    assert get_ods_code_from_request() == TEST_CURRENT_GP_ODS

def test_get_ods_code_from_request_throws_exception_no_ods():
    request_context.authorization = {
        "selected_organisation": {"org_ods_code": ""}
    }

    with pytest.raises(OdsErrorException):
        get_ods_code_from_request()

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


def test_dynamo_queried_with_ods_code(mock_service, context, set_env):
    event = {
        "httpMethod": "GET",
        "queryStringParameters": {
            "limit": TEST_QUERY_LIMIT,
        },
    }

    request_context.authorization = {
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS}
    }

    lambda_handler(event, context)

    mock_service.get_review_document_references.assert_called_with(ods_code=TEST_CURRENT_GP_ODS, limit=TEST_QUERY_LIMIT)

# def test_dynamo_query_called_with_limit_from_query_string_params(context):
#     event = {
#         "httpMethod": "GET",
#         "queryStringParameters": {
#             "limit": 50,
#         },
#     }
#
#     lambda_handler(event, context)
#
#     mock_service.dynamo_service.query_table.assert_called_with({})