import base64

import pytest
from botocore.exceptions import ClientError

from enums.lambda_error import LambdaError
from models.document_review import DocumentUploadReviewReference
from services.search_document_review_service import SearchDocumentReviewService
from tests.unit.conftest import (
    MOCK_DOCUMENT_REVIEW_TABLE,
    TEST_CURRENT_GP_ODS,
    TEST_UUID,
)
from tests.unit.helpers.data.dynamo.dynamo_responses import (
    MOCK_EMPTY_RESPONSE,
    MOCK_SEARCH_RESPONSE,
)
from tests.unit.helpers.data.search_document_review.dynamo_response import (
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE,
)
from utils.lambda_exceptions import SearchDocumentReviewReferenceException

TEST_QUERY_LIMIT = 20
TEST_ENCODED_START_KEY =  base64.b64encode(TEST_UUID.encode("ascii")).decode(
                            "utf-8"
                        )

@pytest.fixture
def search_document_review_service(mocker, set_env):
    service = SearchDocumentReviewService()
    mocker.patch.object(service, "dynamo_service")
    yield service




def test_handle_gateway_api_request_happy_path(search_document_review_service, mocker):
    mocker.patch.object(search_document_review_service, "decode_start_key").return_value = TEST_UUID
    mocker.patch.object(search_document_review_service, "get_review_document_references").return_value = (
        [
            DocumentUploadReviewReference.model_validate(item)
            for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
        ],
        MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["LastEvaluatedKey"],
    )

    search_document_review_service.process_request(encoded_start_key=TEST_ENCODED_START_KEY, ods_code=TEST_CURRENT_GP_ODS, limit=TEST_QUERY_LIMIT)

    search_document_review_service.decode_start_key.assert_called()
    search_document_review_service.get_review_document_references.assert_called_with(ods_code=TEST_CURRENT_GP_ODS, start_key=TEST_UUID)




def test_service_queries_document_review_table_with_correct_args(
    search_document_review_service,
):

    search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS, TEST_QUERY_LIMIT, TEST_UUID
    )

    search_document_review_service.dynamo_service.query_table.assert_called_with(
        table_name=MOCK_DOCUMENT_REVIEW_TABLE,
        search_key="Custodian",
        search_condition=TEST_CURRENT_GP_ODS,
        index_name="CustodianIndex",
        limit=TEST_QUERY_LIMIT,
        start_key=TEST_UUID,
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

    with pytest.raises(SearchDocumentReviewReferenceException) as e:
        search_document_review_service.get_review_document_references(
            TEST_CURRENT_GP_ODS, TEST_QUERY_LIMIT
        )
        assert e.value.status_code == 500
        assert e.value.error == LambdaError.SearchDocumentReviewDB

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

    with pytest.raises(SearchDocumentReviewReferenceException) as e:
        search_document_review_service.validate_search_response_items(
            MOCK_SEARCH_RESPONSE
        )
        assert e.value.status_code == 500
        assert e.value.error == LambdaError.SearchDocumentReviewValidation

def test_decode_start_key(search_document_review_service):
    encoded_start_key = base64.b64encode(TEST_UUID.encode("ascii")).decode(
        "utf-8"
    )

    actual = search_document_review_service.decode_start_key(encoded_start_key)
    assert actual == TEST_UUID


def test_encode_start_key(search_document_review_service):
    actual = search_document_review_service.encode_start_key(TEST_UUID)
    assert actual == TEST_ENCODED_START_KEY




