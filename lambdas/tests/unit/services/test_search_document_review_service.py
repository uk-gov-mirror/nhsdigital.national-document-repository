import base64
import json

import pytest
from enums.lambda_error import LambdaError
from models.document_review import DocumentUploadReviewReference
from pydantic import ValidationError
from services.search_document_review_service import SearchDocumentReviewService
from tests.unit.conftest import TEST_CURRENT_GP_ODS, TEST_UUID
from tests.unit.helpers.data.search_document_review.dynamo_response import (
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE,
)
from utils.lambda_exceptions import DocumentReviewLambdaException

TEST_QUERY_LIMIT = "20"
TEST_LAST_EVALUATED_KEY = {"id": TEST_UUID, "UploadDate": 0}
TEST_ENCODED_START_KEY = base64.b64encode(
    json.dumps(TEST_LAST_EVALUATED_KEY).encode("ascii")
).decode("utf-8")

MOCK_QUERYSTRING_PARAMS_LIMIT_KEY = {
    "limit": TEST_QUERY_LIMIT,
    "nextPageToken": TEST_ENCODED_START_KEY,
}
MOCK_QUERYSTRING_PARAMS_LIMIT_KEY_UPLOADER = {
    "uploader": "Z67890",
    **MOCK_QUERYSTRING_PARAMS_LIMIT_KEY,
}

MOCK_QUERYSTRING_PARAMS_INVALID_LIMIT = {
    "limit": "not an integer",
}


@pytest.fixture
def search_document_review_service(set_env, mocker):
    service = SearchDocumentReviewService()
    mocker.patch.object(service, "document_service")
    yield service


def test_handle_gateway_api_request_happy_path(search_document_review_service, mocker):
    expected_refs = [
        DocumentUploadReviewReference.model_validate(item)
        for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    ]
    mocker.patch.object(
        search_document_review_service, "get_review_document_references"
    ).return_value = (
        expected_refs,
        TEST_ENCODED_START_KEY,
    )

    expected = (
        [
            {
                "id": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0]["ID"],
                "version": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0]["Version"],
                "reviewReason": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0][
                    "ReviewReason"
                ],
                "nhsNumber": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0][
                    "NhsNumber"
                ],
                "documentSnomedCodeType": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][
                    0
                ]["DocumentSnomedCodeType"],
                "author": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0]["Author"],
                "uploadDate": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0][
                    "UploadDate"
                ],
            },
            {
                "id": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][1]["ID"],
                "version": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][1]["Version"],
                "reviewReason": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][1][
                    "ReviewReason"
                ],
                "nhsNumber": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][1][
                    "NhsNumber"
                ],
                "documentSnomedCodeType": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][
                    1
                ]["DocumentSnomedCodeType"],
                "author": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][1]["Author"],
                "uploadDate": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][1][
                    "UploadDate"
                ],
            },
            {
                "id": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][2]["ID"],
                "version": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][2]["Version"],
                "reviewReason": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][2][
                    "ReviewReason"
                ],
                "nhsNumber": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][2][
                    "NhsNumber"
                ],
                "documentSnomedCodeType": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][
                    2
                ]["DocumentSnomedCodeType"],
                "author": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][2]["Author"],
                "uploadDate": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][2][
                    "UploadDate"
                ],
            },
        ],
        TEST_ENCODED_START_KEY,
    )

    actual = search_document_review_service.process_request(
        params=MOCK_QUERYSTRING_PARAMS_LIMIT_KEY_UPLOADER,
        ods_code=TEST_CURRENT_GP_ODS,
    )

    search_document_review_service.get_review_document_references.assert_called_with(
        ods_code=TEST_CURRENT_GP_ODS,
        start_key=TEST_ENCODED_START_KEY,
        limit=int(TEST_QUERY_LIMIT),
        uploader="Z67890",
        nhs_number=None,
    )

    assert actual == expected


def test_process_request_handles_invalid_limit_querystring(
    search_document_review_service, mocker
):
    with pytest.raises(DocumentReviewLambdaException) as e:
        search_document_review_service.process_request(
            params=MOCK_QUERYSTRING_PARAMS_INVALID_LIMIT, ods_code=TEST_CURRENT_GP_ODS
        )
    assert e.value.status_code == 400
    assert e.value.err_code == "SDR_4002"
    assert e.value.message == "Invalid query string passed"


def test_process_request_handles_validation_error(
    search_document_review_service, mocker
):
    mocker.patch.object(
        search_document_review_service, "get_review_document_references"
    ).side_effect = ValidationError("", [])

    with pytest.raises(DocumentReviewLambdaException) as e:
        search_document_review_service.process_request(
            ods_code=TEST_CURRENT_GP_ODS,
            params=MOCK_QUERYSTRING_PARAMS_LIMIT_KEY_UPLOADER,
        )
    assert e.value.status_code == 500
    assert e.value.err_code == "DRV_5002"
    assert e.value.message == "Review document model error"


def test_service_queries_document_review_table_with_correct_args(
    search_document_review_service,
):
    search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS, int(TEST_QUERY_LIMIT), TEST_ENCODED_START_KEY, None, None
    )

    search_document_review_service.document_service.query_docs_pending_review_with_paginator.assert_called_with(
        ods_code=TEST_CURRENT_GP_ODS,
        limit=int(TEST_QUERY_LIMIT),
        start_key=TEST_ENCODED_START_KEY,
        nhs_number=None,
        uploader=None,
    )


def test_get_review_document_references_returns_document_references(
    search_document_review_service,
):
    expected_references = [
        DocumentUploadReviewReference.model_validate(item)
        for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    ]
    search_document_review_service.document_service.query_docs_pending_review_with_paginator.return_value = (
        expected_references,
        TEST_ENCODED_START_KEY,
    )

    actual = search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS, int(TEST_QUERY_LIMIT)
    )

    expected = (
        expected_references,
        TEST_ENCODED_START_KEY,
    )

    assert actual == expected


def test_get_review_document_references_handles_empty_result(
    search_document_review_service,
):
    search_document_review_service.document_service.query_docs_pending_review_with_paginator.return_value = (
        [],
        None,
    )

    actual = search_document_review_service.get_review_document_references(
        TEST_CURRENT_GP_ODS, int(TEST_QUERY_LIMIT)
    )

    assert actual == ([], None)


def test_get_review_document_references_handles_no_limit_passed(
    search_document_review_service,
):
    expected_references = [
        DocumentUploadReviewReference.model_validate(item)
        for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
    ]
    search_document_review_service.document_service.query_docs_pending_review_with_paginator.return_value = (
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
    (
        search_document_review_service.document_service.query_docs_pending_review_with_paginator
    ).side_effect = DocumentReviewLambdaException(500, LambdaError.DocumentReviewDB)

    with pytest.raises(DocumentReviewLambdaException) as e:
        search_document_review_service.get_review_document_references(
            TEST_CURRENT_GP_ODS, TEST_QUERY_LIMIT
        )
        assert e.value.status_code == 500
        assert e.value.error == LambdaError.DocumentReviewDB
