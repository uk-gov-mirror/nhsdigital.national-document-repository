import pytest
from botocore.exceptions import ClientError
from models.document_review import DocumentUploadReviewReference
from services.search_document_review_service import SearchDocumentReviewService
from tests.unit.conftest import MOCK_DOCUMENT_REVIEW_TABLE, TEST_CURRENT_GP_ODS
from tests.unit.helpers.data.dynamo.dynamo_responses import (
    MOCK_EMPTY_RESPONSE,
    MOCK_SEARCH_RESPONSE,
)
from tests.unit.helpers.data.search_document_review.dynamo_response import (
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE,
)
from utils.exceptions import SearchDocumentReviewReferenceException

TEST_QUERY_LIMIT = 20


@pytest.fixture
def search_document_review_service(mocker, set_env):
    service = SearchDocumentReviewService()
    mocker.patch.object(service, "dynamo_service")
    yield service


def test_service_queries_document_review_table_with_correct_args(
    search_document_review_service,
):

    search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS, TEST_QUERY_LIMIT
    )

    search_document_review_service.dynamo_service.query_table.assert_called_with(
        table_name=MOCK_DOCUMENT_REVIEW_TABLE,
        search_key="Custodian",
        search_condition=TEST_CURRENT_GP_ODS,
        index_name="CustodianIndex",
        limit=TEST_QUERY_LIMIT,
    )


def test_get_review_document_references_returns_document_references(
    search_document_review_service,
):
    search_document_review_service.dynamo_service.query_table.return_value = (
        MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE
    )

    actual = search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS, TEST_QUERY_LIMIT
    )

    expected = (
        [
            DocumentUploadReviewReference.model_validate(item)
            for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
        ],
        MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["LastEvaluatedKey"],
    )

    assert actual == expected


def test_get_review_document_references_handles_empty_result(
    search_document_review_service,
):
    search_document_review_service.dynamo_service.query_table.return_value = (
        MOCK_EMPTY_RESPONSE
    )

    actual = search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS, TEST_QUERY_LIMIT
    )

    assert actual == ([], None)


def test_get_review_document_references_handles_no_limit_passed(
    search_document_review_service,
):
    search_document_review_service.dynamo_service.query_table.return_value = (
        MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    )

    expected = (
        [
            DocumentUploadReviewReference.model_validate(item)
            for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
        ],
        None,
    )

    actual = search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS
    )

    assert actual == expected


def test_get_review_document_references_throws_exception_client_error(
    search_document_review_service,
):
    search_document_review_service.dynamo_service.query_table.side_effect = ClientError(
        {"error": "test error message"}, "test"
    )

    with pytest.raises(SearchDocumentReviewReferenceException):
        search_document_review_service.get_review_document_references(
            TEST_CURRENT_GP_ODS, TEST_QUERY_LIMIT
        )


def test_validate_search_response_items_returns_document_upload_review_references(
    search_document_review_service,
):
    search_document_review_service.dynamo_service.query_table.return_value = (
        MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE
    )

    expected = [
        DocumentUploadReviewReference.model_validate(item)
        for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    ]
    actual = search_document_review_service.validate_search_response_items(
        MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    )

    assert actual == expected


def test_get_review_document_references_throws_exception_on_validation_error(
    search_document_review_service,
):
    search_document_review_service.dynamo_service.query_table.return_value = (
        MOCK_SEARCH_RESPONSE
    )

    with pytest.raises(SearchDocumentReviewReferenceException):
        search_document_review_service.validate_search_response_items(
            MOCK_SEARCH_RESPONSE
        )
