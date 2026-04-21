import json

import pytest

from enums.lambda_error import LambdaError
from handlers.get_document_review_handler import lambda_handler
from utils.lambda_exceptions import DocumentReviewLambdaException
from utils.lambda_response import ApiGatewayResponse

MOCK_DOCUMENT_REVIEW_RESPONSE = {
    "ID": "test-document-id",
    "UploadDate": 1699000000,
    "Files": [
        {
            "FileName": "test-file-1.pdf",
            "PresignedUrl": "https://mock-cloudfront-url.com/presigned1",
        },
        {
            "FileName": "test-file-2.pdf",
            "PresignedUrl": "https://mock-cloudfront-url.com/presigned2",
        },
    ],
    "DocumentSnomedCodeType": "734163000",
}


@pytest.fixture
def valid_get_document_review_event():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {"patientId": "9000000009"},
        "pathParameters": {"id": "test-document-id", "version": "1"},
    }
    return api_gateway_proxy_event


@pytest.fixture
def missing_patient_id_event():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {},
        "pathParameters": {"id": "test-document-id"},
    }
    return api_gateway_proxy_event


@pytest.fixture
def missing_document_id_event():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {"patientId": "9000000009"},
        "pathParameters": {"version": "1"},
    }
    return api_gateway_proxy_event


@pytest.fixture
def invalid_patient_id_event():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {"patientId": "900000000900"},
        "pathParameters": {"id": "test-document-id", "version": "1"},
    }
    return api_gateway_proxy_event


@pytest.fixture
def missing_document_version_event():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {"patientId": "9000000009"},
        "pathParameters": {"id": "test-document-id"},
    }
    return api_gateway_proxy_event


@pytest.fixture
def mocked_service(set_env, mocker):
    mocked_class = mocker.patch(
        "handlers.get_document_review_handler.GetDocumentReviewService",
    )
    mocked_service = mocked_class.return_value
    yield mocked_service


def test_lambda_handler_returns_200_with_document_review(
    mocked_service,
    valid_get_document_review_event,
    context,
    set_env,
):
    mocked_service.get_document_review.return_value = MOCK_DOCUMENT_REVIEW_RESPONSE

    expected = ApiGatewayResponse(
        200,
        json.dumps(MOCK_DOCUMENT_REVIEW_RESPONSE),
        "GET",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_get_document_review_event, context)

    assert expected == actual
    mocked_service.get_document_review.assert_called_once_with(
        patient_id="9000000009",
        document_id="test-document-id",
        document_version=1,
    )


def test_lambda_handler_returns_404_when_document_review_not_found(
    mocked_service,
    valid_get_document_review_event,
    context,
):
    mocked_service.get_document_review.return_value = None

    expected_body = json.dumps(
        {
            "message": "Document reference not found",
            "err_code": "NRL_DR_4041",
            "interaction_id": "88888888-4444-4444-4444-121212121212",
        },
    )
    expected = ApiGatewayResponse(
        404,
        expected_body,
        "GET",
    ).create_api_gateway_response()

    actual = lambda_handler(valid_get_document_review_event, context)

    assert expected == actual


def test_lambda_handler_raises_exception_returns_500(
    mocked_service,
    valid_get_document_review_event,
    context,
):
    mocked_service.get_document_review.side_effect = DocumentReviewLambdaException(
        500,
        LambdaError.MockError,
    )
    actual = lambda_handler(valid_get_document_review_event, context)

    expected = ApiGatewayResponse(
        500,
        LambdaError.MockError.create_error_body(),
        "GET",
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_when_patient_id_not_valid_returns_400(
    set_env,
    invalid_patient_id_event,
    context,
):
    expected_body = json.dumps(
        {
            "message": "Invalid patient number 900000000900",
            "err_code": "PN_4001",
            "interaction_id": "88888888-4444-4444-4444-121212121212",
        },
    )
    expected = ApiGatewayResponse(
        400,
        expected_body,
        "GET",
    ).create_api_gateway_response()
    actual = lambda_handler(invalid_patient_id_event, context)
    assert expected == actual


def test_lambda_handler_when_document_id_not_supplied_returns_400(
    set_env,
    missing_document_id_event,
    context,
):
    actual = lambda_handler(missing_document_id_event, context)

    expected = ApiGatewayResponse(
        400,
        LambdaError.DocumentReferenceMissingParameters.create_error_body(),
        "GET",
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_when_document_version_not_supplied_returns_400(
    set_env,
    missing_document_version_event,
    context,
):
    actual = lambda_handler(missing_document_version_event, context)

    expected = ApiGatewayResponse(
        400,
        LambdaError.DocumentReferenceMissingParameters.create_error_body(),
        "GET",
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_missing_environment_variables_returns_500(
    set_env,
    monkeypatch,
    valid_get_document_review_event,
    context,
):
    monkeypatch.delenv("DOCUMENT_REVIEW_DYNAMODB_NAME")

    expected_body = json.dumps(
        {
            "message": "An error occurred due to missing environment variable: 'DOCUMENT_REVIEW_DYNAMODB_NAME'",
            "err_code": "ENV_5001",
            "interaction_id": "88888888-4444-4444-4444-121212121212",
        },
    )
    expected = ApiGatewayResponse(
        500,
        expected_body,
        "GET",
    ).create_api_gateway_response()
    actual = lambda_handler(valid_get_document_review_event, context)
    assert expected == actual
