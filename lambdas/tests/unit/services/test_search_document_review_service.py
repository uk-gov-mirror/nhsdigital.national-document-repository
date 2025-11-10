import base64
import json

import pytest
from enums.lambda_error import LambdaError
from models.document_review import DocumentUploadReviewReference
from services.search_document_review_service import SearchDocumentReviewService
from tests.unit.conftest import TEST_CURRENT_GP_ODS, TEST_UUID
from tests.unit.helpers.data.search_document_review.dynamo_response import (
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE,
)
from utils.lambda_exceptions import DocumentReviewException

TEST_QUERY_LIMIT = 20
TEST_LAST_EVALUATED_KEY = {"id": TEST_UUID}
TEST_ENCODED_START_KEY = base64.b64encode(
    json.dumps(TEST_LAST_EVALUATED_KEY).encode("ascii")
).decode("utf-8")

MOCK_QUERYSTRING_PARAMS_LIMIT_KEY = {
    "limit": TEST_QUERY_LIMIT,
    "startKey": TEST_ENCODED_START_KEY,
}
MOCK_QUERYSTRING_PARAMS_LIMIT_KEY_UPLOAD = {
    "uploader": "Z67890",
    **MOCK_QUERYSTRING_PARAMS_LIMIT_KEY,
}


@pytest.fixture
def search_document_review_service(set_env, mocker):
    service = SearchDocumentReviewService()
    mocker.patch.object(service, "document_service")
    yield service


def test_handle_gateway_api_request_happy_path(search_document_review_service, mocker):
    mocker.patch.object(
        search_document_review_service, "decode_start_key"
    ).return_value = TEST_LAST_EVALUATED_KEY

    expected_refs = [
        DocumentUploadReviewReference.model_validate(item)
        for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    ]
    mocker.patch.object(
        search_document_review_service, "get_review_document_references"
    ).return_value = (
        expected_refs,
        TEST_LAST_EVALUATED_KEY,
    )

    expected = (
        [
            {
                "id": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0]["ID"],
                "review_reason": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0][
                    "ReviewReason"
                ],
                "nhs_number": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0][
                    "NhsNumber"
                ],
            },
            {
                "id": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][1]["ID"],
                "review_reason": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][1][
                    "ReviewReason"
                ],
                "nhs_number": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][1][
                    "NhsNumber"
                ],
            },
            {
                "id": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][2]["ID"],
                "review_reason": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][2][
                    "ReviewReason"
                ],
                "nhs_number": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][2][
                    "NhsNumber"
                ],
            },
        ],
        TEST_ENCODED_START_KEY,
    )

    actual = search_document_review_service.process_request(
        params=MOCK_QUERYSTRING_PARAMS_LIMIT_KEY_UPLOAD,
        ods_code=TEST_CURRENT_GP_ODS,
    )

    search_document_review_service.decode_start_key.assert_called_with(
        TEST_ENCODED_START_KEY
    )
    search_document_review_service.get_review_document_references.assert_called_with(
        ods_code=TEST_CURRENT_GP_ODS,
        start_key=TEST_LAST_EVALUATED_KEY,
        limit=TEST_QUERY_LIMIT,
        uploader="Z67890",
        nhs_number=None,
    )

    assert actual == expected


def test_service_queries_document_review_table_with_correct_args(
    search_document_review_service,
):

    search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS, TEST_QUERY_LIMIT, TEST_LAST_EVALUATED_KEY
    )

    search_document_review_service.document_service.query_docs_pending_review_by_custodian.assert_called_with(
        ods_code=TEST_CURRENT_GP_ODS,
        limit=TEST_QUERY_LIMIT,
        start_key=TEST_LAST_EVALUATED_KEY,
    )


def test_get_review_document_references_returns_document_references(
    search_document_review_service,
):
    expected_references = [
        DocumentUploadReviewReference.model_validate(item)
        for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    ]
    search_document_review_service.document_service.query_docs_pending_review_by_custodian.return_value = (
        expected_references,
        TEST_LAST_EVALUATED_KEY,
    )

    actual = search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS, TEST_QUERY_LIMIT
    )

    expected = (
        expected_references,
        TEST_LAST_EVALUATED_KEY,
    )

    assert actual == expected


def test_get_review_document_references_handles_empty_result(
    search_document_review_service,
):
    search_document_review_service.document_service.query_docs_pending_review_by_custodian.return_value = (
        [],
        None,
    )

    actual = search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS, TEST_QUERY_LIMIT
    )

    assert actual == ([], None)


def test_get_review_document_references_handles_no_limit_passed(
    search_document_review_service,
):
    expected_references = [
        DocumentUploadReviewReference.model_validate(item)
        for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    ]
    search_document_review_service.document_service.query_docs_pending_review_by_custodian.return_value = (
        expected_references,
        None,
    )

    expected = (
        expected_references,
        None,
    )

    actual = search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS
    )

    assert actual == expected


def test_get_review_document_references_throws_exception_client_error(
    search_document_review_service,
):
    search_document_review_service.document_service.query_docs_pending_review_by_custodian.side_effect = DocumentReviewException(
        500, LambdaError.DocumentReviewDB
    )

    with pytest.raises(DocumentReviewException) as e:
        search_document_review_service.get_review_document_references(
            TEST_CURRENT_GP_ODS, TEST_QUERY_LIMIT
        )
        assert e.value.status_code == 500
        assert e.value.error == LambdaError.DocumentReviewDB


def test_decode_start_key(search_document_review_service):
    encoded_start_key = TEST_ENCODED_START_KEY

    actual = search_document_review_service.decode_start_key(encoded_start_key)
    assert actual == TEST_LAST_EVALUATED_KEY


def test_encode_start_key(search_document_review_service):
    actual = search_document_review_service.encode_start_key(TEST_LAST_EVALUATED_KEY)
    assert actual == TEST_ENCODED_START_KEY
