import pytest

from tests.unit.conftest import TEST_CURRENT_GP_ODS, MOCK_DOCUMENT_REVIEW_TABLE
from utils.exceptions import OdsErrorException
from utils.request_context import request_context
from handlers.search_document_review_handler import get_ods_code_from_request, lambda_handler


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


def test_dynamo_queried_with_ods_code(mock_service):
    request_context.authorization = {
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS}
    }

    event = {"httpMethod": "GET"}

    mock_service.dynamo_service.query_table.assert_called_with(
        table_name=MOCK_DOCUMENT_REVIEW_TABLE,
        seach_key="custodian",
        search_condition=TEST_CURRENT_GP_ODS,
    )

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