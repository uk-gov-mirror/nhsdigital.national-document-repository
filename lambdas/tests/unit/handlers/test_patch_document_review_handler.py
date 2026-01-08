import json

import pytest
from enums.document_review_status import DocumentReviewStatus
from enums.lambda_error import LambdaError
from handlers.patch_document_review_handler import lambda_handler
from tests.unit.conftest import TEST_CURRENT_GP_ODS
from utils.exceptions import OdsErrorException
from utils.lambda_exceptions import UpdateDocumentReviewException
from utils.lambda_response import ApiGatewayResponse

TEST_PATIENT_ID = "9000000009"
TEST_DOCUMENT_ID = "test-document-id-123"
TEST_VERSION = 1
TEST_DOCUMENT_REFERENCE_ID = "doc-ref-12345"
TEST_REVIEWER_ODS_CODE = "Y12345"


@pytest.fixture
def valid_put_document_review_event_approved():
    return {
        "httpMethod": "PATCH",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {"id": TEST_DOCUMENT_ID, "version": str(TEST_VERSION)},
        "body": json.dumps(
            {
                "reviewStatus": "APPROVED",
                "documentReferenceId": TEST_DOCUMENT_REFERENCE_ID,
            }
        ),
    }


@pytest.fixture
def valid_put_document_review_event_rejected():
    return {
        "httpMethod": "PATCH",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {"id": TEST_DOCUMENT_ID, "version": str(TEST_VERSION)},
        "body": json.dumps({"reviewStatus": "REJECTED"}),
    }


@pytest.fixture
def missing_patient_id_event():
    return {
        "httpMethod": "PATCH",
        "queryStringParameters": {},
        "pathParameters": {"id": TEST_DOCUMENT_ID, "version": str(TEST_VERSION)},
        "body": json.dumps(
            {
                "reviewStatus": "APPROVED",
                "documentReferenceId": TEST_DOCUMENT_REFERENCE_ID,
            }
        ),
    }


@pytest.fixture
def missing_document_id_event():
    return {
        "httpMethod": "PATCH",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {},
        "body": json.dumps(
            {
                "reviewStatus": "APPROVED",
                "documentReferenceId": TEST_DOCUMENT_REFERENCE_ID,
            }
        ),
    }


@pytest.fixture
def invalid_body_event():
    return {
        "httpMethod": "PATCH",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {"id": TEST_DOCUMENT_ID, "version": str(TEST_VERSION)},
        "body": "invalid-json",
    }


@pytest.fixture
def approved_without_document_reference_id_event():
    return {
        "httpMethod": "PATCH",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {"id": TEST_DOCUMENT_ID, "version": str(TEST_VERSION)},
        "body": json.dumps({"reviewStatus": "APPROVED"}),
    }


@pytest.fixture
def invalid_version_event():
    return {
        "httpMethod": "PATCH",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {"id": TEST_DOCUMENT_ID, "version": "not-a-number"},
        "body": json.dumps(
            {
                "reviewStatus": "APPROVED",
                "documentReferenceId": TEST_DOCUMENT_REFERENCE_ID,
            }
        ),
    }


@pytest.fixture
def missing_version_event():
    return {
        "httpMethod": "PATCH",
        "queryStringParameters": {"patientId": TEST_PATIENT_ID},
        "pathParameters": {"id": TEST_DOCUMENT_ID},
        "body": json.dumps(
            {
                "reviewStatus": "APPROVED",
                "documentReferenceId": TEST_DOCUMENT_REFERENCE_ID,
            }
        ),
    }


@pytest.fixture
def mocked_service(set_env, mocker):
    mocked_class = mocker.patch(
        "handlers.patch_document_review_handler.UpdateDocumentReviewService"
    )
    mocked_service = mocked_class.return_value
    yield mocked_service


@pytest.fixture
def mock_authorization(mocker):
    return mocker.patch(
        "handlers.patch_document_review_handler.extract_ods_code_from_request_context"
    )


@pytest.fixture
def mock_missing_authorization(mocker):
    mock_auth =  mocker.patch(
        "handlers.patch_document_review_handler.extract_ods_code_from_request_context"
    )
    mock_auth.side_effect = OdsErrorException()
    yield mock_auth

def test_lambda_handler_returns_200_when_document_review_approved(
    mocked_service,
    valid_put_document_review_event_approved,
    context,
    set_env,
    mock_authorization,
    mock_upload_document_iteration_3_enabled,
):
    mocked_service.update_document_review.return_value = None
    mock_authorization.return_value = TEST_CURRENT_GP_ODS

    expected = ApiGatewayResponse(200, "", "PATCH").create_api_gateway_response()

    actual = lambda_handler(valid_put_document_review_event_approved, context)

    assert expected == actual
    mocked_service.update_document_review.assert_called_once()
    call_args = mocked_service.update_document_review.call_args
    assert call_args[1]["patient_id"] == TEST_PATIENT_ID
    assert call_args[1]["document_id"] == TEST_DOCUMENT_ID
    assert call_args[1]["document_version"] == TEST_VERSION
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
    mock_upload_document_iteration_3_enabled,
):
    mocked_service.update_document_review.return_value = None
    mock_authorization.return_value = TEST_CURRENT_GP_ODS

    expected = ApiGatewayResponse(200, "", "PATCH").create_api_gateway_response()

    actual = lambda_handler(valid_put_document_review_event_rejected, context)

    assert expected == actual
    mocked_service.update_document_review.assert_called_once()
    call_args = mocked_service.update_document_review.call_args
    assert call_args[1]["patient_id"] == TEST_PATIENT_ID
    assert call_args[1]["document_id"] == TEST_DOCUMENT_ID
    assert call_args[1]["document_version"] == TEST_VERSION
    assert call_args[1]["reviewer_ods_code"] == TEST_REVIEWER_ODS_CODE
    assert call_args[1]["update_data"].review_status == DocumentReviewStatus.REJECTED
    assert call_args[1]["update_data"].document_reference_id is None


def test_lambda_handler_returns_400_when_patient_id_missing(
    set_env,
    missing_patient_id_event,
    context,
    mock_authorization,
    mock_upload_document_iteration_3_enabled,
):
    mock_authorization.return_value = TEST_CURRENT_GP_ODS

    actual = lambda_handler(missing_patient_id_event, context)

    expected = ApiGatewayResponse(
        400, LambdaError.PatientIdNoKey.create_error_body(), "PATCH"
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_returns_400_when_document_id_missing(
    set_env,
    missing_document_id_event,
    context,
    mock_authorization,
    mock_upload_document_iteration_3_enabled,
):
    actual = lambda_handler(missing_document_id_event, context)

    expected = ApiGatewayResponse(
        400, LambdaError.DocumentReferenceMissingParameters.create_error_body(), "PATCH"
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_returns_400_when_body_invalid_json(
    set_env,
    invalid_body_event,
    context,
    mock_authorization,
    mock_upload_document_iteration_3_enabled,
):
    actual = lambda_handler(invalid_body_event, context)

    expected = ApiGatewayResponse(
        400, LambdaError.DocumentReviewInvalidBody.create_error_body(), "PATCH"
    ).create_api_gateway_response()
    assert expected == actual
    assert actual["statusCode"] == 400


def test_lambda_handler_returns_400_when_approved_without_document_reference_id(
    set_env,
    approved_without_document_reference_id_event,
    context,
    mock_authorization,
    mock_upload_document_iteration_3_enabled,
):
    actual = lambda_handler(approved_without_document_reference_id_event, context)

    expected = ApiGatewayResponse(
        400, LambdaError.DocumentReviewInvalidBody.create_error_body(), "PATCH"
    ).create_api_gateway_response()
    assert actual["statusCode"] == 400
    assert expected == actual


def test_lambda_handler_returns_401_when_ods_code_missing(
    set_env,
    valid_put_document_review_event_approved,
    context,
    mock_missing_authorization,
    mock_upload_document_iteration_3_enabled,
):
    actual = lambda_handler(valid_put_document_review_event_approved, context)

    expected = ApiGatewayResponse(
        401, LambdaError.DocumentReferenceUnauthorised.create_error_body(), "PATCH"
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_returns_500_when_service_raises_exception(
    mocked_service,
    valid_put_document_review_event_approved,
    context,
    set_env,
    mock_authorization,
    mock_upload_document_iteration_3_enabled,
):
    mocked_service.update_document_review.side_effect = UpdateDocumentReviewException(
        500, LambdaError.DocumentReferenceGeneralError
    )

    actual = lambda_handler(valid_put_document_review_event_approved, context)

    expected = ApiGatewayResponse(
        500, LambdaError.DocumentReferenceGeneralError.create_error_body(), "PATCH"
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_returns_404_when_document_not_found(
    mocked_service,
    valid_put_document_review_event_approved,
    context,
    set_env,
    mock_authorization,
    mock_upload_document_iteration_3_enabled,
):
    mocked_service.update_document_review.side_effect = UpdateDocumentReviewException(
        404, LambdaError.DocumentReferenceMissingParameters
    )

    actual = lambda_handler(valid_put_document_review_event_approved, context)

    expected = ApiGatewayResponse(
        404, LambdaError.DocumentReferenceMissingParameters.create_error_body(), "PATCH"
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_returns_500_when_environment_variable_missing(
    set_env,
    monkeypatch,
    valid_put_document_review_event_approved,
    context,
    mock_authorization,
    mock_upload_document_iteration_3_enabled,
):
    monkeypatch.delenv("DOCUMENT_REVIEW_DYNAMODB_NAME")

    expected_body = json.dumps(
        {
            "message": "An error occurred due to missing environment variable: 'DOCUMENT_REVIEW_DYNAMODB_NAME'",
            "err_code": "ENV_5001",
            "interaction_id": "88888888-4444-4444-4444-121212121212",
        }
    )
    expected = ApiGatewayResponse(
        500, expected_body, "PATCH"
    ).create_api_gateway_response()
    actual = lambda_handler(valid_put_document_review_event_approved, context)
    assert expected == actual


def test_lambda_handler_returns_400_when_version_invalid(
    set_env,
    invalid_version_event,
    context,
    mock_authorization,
    mock_upload_document_iteration_3_enabled,
):
    actual = lambda_handler(invalid_version_event, context)

    expected = ApiGatewayResponse(
        400, LambdaError.DocumentReferenceMissingParameters.create_error_body(), "PATCH"
    ).create_api_gateway_response()
    assert expected == actual


def test_lambda_handler_returns_400_when_version_missing(
    set_env,
    missing_version_event,
    context,
    mock_authorization,
    mock_upload_document_iteration_3_enabled,
):
    actual = lambda_handler(missing_version_event, context)

    expected = ApiGatewayResponse(
        400, LambdaError.DocumentReferenceMissingParameters.create_error_body(), "PATCH"
    ).create_api_gateway_response()
    assert expected == actual
