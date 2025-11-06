import json

import pytest
from enums.document_review_status import DocumentReviewStatus
from enums.lambda_error import LambdaError
from handlers.put_document_review_handler import lambda_handler
from utils.lambda_exceptions import PutDocumentReviewException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

TEST_PATIENT_ID = "9000000009"
TEST_DOCUMENT_ID = "test-document-id-123"
TEST_DOCUMENT_REFERENCE_ID = "doc-ref-12345"
TEST_REVIEWER_ODS_CODE = "Y12345"


@pytest.fixture
def valid_put_document_review_event_approved():
    """Event for approving a document review."""
    return {
        "httpMethod": "PUT",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {"id": TEST_DOCUMENT_ID},
        "body": json.dumps(
            {
                "ReviewStatus": "APPROVED",
                "DocumentReferenceId": TEST_DOCUMENT_REFERENCE_ID,
            }
        ),
    }


@pytest.fixture
def valid_put_document_review_event_rejected():
    """Event for rejecting a document review."""
    return {
        "httpMethod": "PUT",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {"id": TEST_DOCUMENT_ID},
        "body": json.dumps({"ReviewStatus": "REJECTED"}),
    }


@pytest.fixture
def missing_patient_id_event():
    """Event missing patient_id in query parameters."""
    return {
        "httpMethod": "PUT",
        "queryStringParameters": {},
        "pathParameters": {"id": TEST_DOCUMENT_ID},
        "body": json.dumps(
            {
                "ReviewStatus": "APPROVED",
                "DocumentReferenceId": TEST_DOCUMENT_REFERENCE_ID,
            }
        ),
    }


@pytest.fixture
def missing_document_id_event():
    """Event missing id in path parameters."""
    return {
        "httpMethod": "PUT",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {},
        "body": json.dumps(
            {
                "ReviewStatus": "APPROVED",
                "DocumentReferenceId": TEST_DOCUMENT_REFERENCE_ID,
            }
        ),
    }


@pytest.fixture
def invalid_patientId_event():
    """Event with invalid patient ID format."""
    return {
        "httpMethod": "PUT",
        "queryStringParameters": {"patientId": "invalid-nhs-number"},
        "pathParameters": {"id": TEST_DOCUMENT_ID},
        "body": json.dumps(
            {
                "ReviewStatus": "APPROVED",
                "DocumentReferenceId": TEST_DOCUMENT_REFERENCE_ID,
            }
        ),
    }


@pytest.fixture
def invalid_body_event():
    """Event with invalid JSON body."""
    return {
        "httpMethod": "PUT",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {"id": TEST_DOCUMENT_ID},
        "body": "invalid-json",
    }


@pytest.fixture
def approved_without_document_reference_id_event():
    """Event with APPROVED status but missing document_reference_id."""
    return {
        "httpMethod": "PUT",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {"id": TEST_DOCUMENT_ID},
        "body": json.dumps({"ReviewStatus": "APPROVED"}),
    }


@pytest.fixture
def mocked_service(set_env, mocker):
    """Mock the PutDocumentReviewService."""
    mocked_class = mocker.patch(
        "handlers.put_document_review_handler.PutDocumentReviewService"
    )
    mocked_service = mocked_class.return_value
    yield mocked_service


@pytest.fixture
def mock_authorization(mocker):
    mocked_context = mocker.MagicMock()
    mocked_context.authorization = {
        "selected_organisation": {"org_ods_code": TEST_REVIEWER_ODS_CODE},
    }
    yield mocker.patch(
        "handlers.put_document_review_handler.request_context", mocked_context
    )


@pytest.fixture
def mock_missing_authorization(mocker):
    mocked_context = mocker.MagicMock()
    mocked_context.authorization = {
        "selected_organisation": {"org_ods_code": None},
    }
    yield mocker.patch(
        "handlers.put_document_review_handler.request_context", mocked_context
    )


def test_lambda_handler_returns_200_when_document_review_approved(
    mocked_service,
    valid_put_document_review_event_approved,
    context,
    set_env,
    mock_authorization,
):
    """Test successful document review approval."""
    mocked_service.update_document_review.return_value = None

    expected = ApiGatewayResponse(200, "", "PUT").create_api_gateway_response()

    actual = lambda_handler(valid_put_document_review_event_approved, context)

    assert expected == actual
    mocked_service.update_document_review.assert_called_once()
    call_args = mocked_service.update_document_review.call_args
    assert call_args[1]["patient_id"] == TEST_PATIENT_ID
    assert call_args[1]["document_id"] == TEST_DOCUMENT_ID
    assert call_args[1]["reviewer_ods_code"] == TEST_REVIEWER_ODS_CODE
    assert call_args[1]["update_data"].review_status == DocumentReviewStatus.APPROVED
    assert (
        call_args[1]["update_data"].document_reference_id == TEST_DOCUMENT_REFERENCE_ID
    )


def test_lambda_handler_returns_200_when_document_review_rejected(
    mocked_service,
    valid_put_document_review_event_rejected,
    context,
    set_env,
    mock_authorization,
):
    """Test successful document review rejection."""
    mocked_service.update_document_review.return_value = None

    expected = ApiGatewayResponse(200, "", "PUT").create_api_gateway_response()

    actual = lambda_handler(valid_put_document_review_event_rejected, context)

    assert expected == actual
    mocked_service.update_document_review.assert_called_once()
    call_args = mocked_service.update_document_review.call_args
    assert call_args[1]["patient_id"] == TEST_PATIENT_ID
    assert call_args[1]["document_id"] == TEST_DOCUMENT_ID
    assert call_args[1]["reviewer_ods_code"] == TEST_REVIEWER_ODS_CODE
    assert call_args[1]["update_data"].review_status == DocumentReviewStatus.REJECTED
    assert call_args[1]["update_data"].document_reference_id is None


def test_lambda_handler_returns_400_when_patient_id_missing(
    set_env, missing_patient_id_event, context, mock_authorization
):
    """Test that 400 is returned when patient_id is missing from query parameters."""
    actual = lambda_handler(missing_patient_id_event, context)

    expected = ApiGatewayResponse(
        400, LambdaError.PatientIdNoKey.create_error_body(), "PUT"
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_returns_400_when_document_id_missing(
    set_env, missing_document_id_event, context, mock_authorization
):
    """Test that 400 is returned when document id is missing from path parameters."""
    actual = lambda_handler(missing_document_id_event, context)

    expected = ApiGatewayResponse(
        400, LambdaError.DocumentReferenceMissingParameters.create_error_body(), "PUT"
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_returns_400_when_body_invalid_json(
    set_env, invalid_body_event, context, mock_authorization
):
    """Test that 400 is returned when request body is invalid JSON."""
    actual = lambda_handler(invalid_body_event, context)

    # Should return a validation error for invalid JSON
    assert actual["statusCode"] == 400


def test_lambda_handler_returns_400_when_approved_without_document_reference_id(
    set_env, approved_without_document_reference_id_event, context, mock_authorization
):
    """Test that 400 is returned when APPROVED status is provided without document_reference_id."""
    actual = lambda_handler(approved_without_document_reference_id_event, context)

    assert actual["statusCode"] == 400


def test_lambda_handler_returns_401_when_ods_code_missing(
    set_env,
    valid_put_document_review_event_approved,
    context,
    mock_missing_authorization,
):
    """Test that 401 is returned when ODS code is missing from authorisation."""
    request_context.authorization = {"selected_organisation": {"org_ods_code": None}}

    actual = lambda_handler(valid_put_document_review_event_approved, context)

    expected = ApiGatewayResponse(
        401, LambdaError.DocumentReferenceUnauthorised.create_error_body(), "PUT"
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_returns_500_when_service_raises_exception(
    mocked_service,
    valid_put_document_review_event_approved,
    context,
    set_env,
    mock_authorization,
):
    """Test that 500 is returned when the service raises PutDocumentReviewException."""
    mocked_service.update_document_review.side_effect = PutDocumentReviewException(
        500, LambdaError.DocumentReferenceGeneralError
    )

    actual = lambda_handler(valid_put_document_review_event_approved, context)

    expected = ApiGatewayResponse(
        500, LambdaError.DocumentReferenceGeneralError.create_error_body(), "PUT"
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_returns_404_when_document_not_found(
    mocked_service,
    valid_put_document_review_event_approved,
    context,
    set_env,
    mock_authorization,
):
    """Test that 404 is returned when document is not found."""
    mocked_service.update_document_review.side_effect = PutDocumentReviewException(
        404, LambdaError.DocumentReferenceMissingParameters
    )

    actual = lambda_handler(valid_put_document_review_event_approved, context)

    expected = ApiGatewayResponse(
        404, LambdaError.DocumentReferenceMissingParameters.create_error_body(), "PUT"
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_returns_500_when_environment_variable_missing(
    set_env,
    monkeypatch,
    valid_put_document_review_event_approved,
    context,
    mock_authorization,
):
    """Test that 500 is returned when the required environment variable is missing."""
    monkeypatch.delenv("DOCUMENT_REVIEW_DYNAMODB_NAME")

    expected_body = json.dumps(
        {
            "message": "An error occurred due to missing environment variable: 'DOCUMENT_REVIEW_DYNAMODB_NAME'",
            "err_code": "ENV_5001",
            "interaction_id": "88888888-4444-4444-4444-121212121212",
        }
    )
    expected = ApiGatewayResponse(
        500, expected_body, "PUT"
    ).create_api_gateway_response()
    actual = lambda_handler(valid_put_document_review_event_approved, context)
    assert expected == actual


def test_lambda_handler_calls_service_with_correct_parameters(
    mocked_service,
    valid_put_document_review_event_approved,
    context,
    set_env,
    mock_authorization,
):
    """Test that the service is called with correct parameters."""
    mocked_service.update_document_review.return_value = None

    lambda_handler(valid_put_document_review_event_approved, context)

    assert mocked_service.update_document_review.call_count == 1

    call_args = mocked_service.update_document_review.call_args
    assert call_args[1]["patient_id"] == TEST_PATIENT_ID
    assert call_args[1]["document_id"] == TEST_DOCUMENT_ID
    assert call_args[1]["reviewer_ods_code"] == TEST_REVIEWER_ODS_CODE

    update_data = call_args[1]["update_data"]
    assert update_data.review_status == DocumentReviewStatus.APPROVED
    assert update_data.document_reference_id == TEST_DOCUMENT_REFERENCE_ID
