import json

import pytest
from enums.feature_flags import FeatureFlags
from enums.lambda_error import LambdaError
from handlers.review_document_status_check_handler import lambda_handler
from models.document_review import DocumentUploadReviewReference
from services.feature_flags_service import FeatureFlagService
from tests.unit.conftest import MOCK_INTERACTION_ID, TEST_CURRENT_GP_ODS, TEST_UUID
from tests.unit.helpers.data.search_document_review.dynamo_response import (
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE,
)
from utils.exceptions import OdsErrorException
from utils.lambda_exceptions import DocumentReviewLambdaException
from utils.lambda_response import ApiGatewayResponse

MOCK_DOCUMENT_REVIEW_REFERENCE = DocumentUploadReviewReference.model_validate(
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0]
)


@pytest.fixture
def event_valid_event():
    return {
        "httpMethod": "GET",
        "headers": {"Authorization": "test_token"},
        "pathParameters": {"id": TEST_UUID, "version": "1"},
    }


@pytest.fixture
def mock_service(set_env, mocker):
    mocked_class = mocker.patch(
        "handlers.review_document_status_check_handler.ReviewDocumentStatusCheckService"
    )
    mocked_instance = mocked_class.return_value
    yield mocked_instance


@pytest.fixture
def mock_upload_document_iteration_3_enabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_feature_flag = mock_function.return_value = {
        FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED: True
    }
    yield mock_feature_flag


@pytest.fixture
def mock_extract_ods(mocker):
    return mocker.patch(
        "handlers.review_document_status_check_handler.extract_ods_code_from_request_context"
    )


@pytest.fixture
def mock_upload_document_iteration_3_disabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_feature_flag = mock_function.return_value = {
        FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED: False
    }
    yield mock_feature_flag


def test_lambda_handler_returns_404_feature_flag_disabled(
    event_valid_event,
    context,
    mock_service,
    mock_extract_ods,
    mock_upload_document_iteration_3_disabled,
):
    mock_extract_ods.return_value = TEST_CURRENT_GP_ODS

    body = {
        "message": LambdaError.FeatureFlagDisabled.value["message"],
        "err_code": LambdaError.FeatureFlagDisabled.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }

    expected = ApiGatewayResponse(
        status_code=404,
        body=json.dumps(body),
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event_valid_event, context)
    assert actual == expected


def test_lambda_handler_calls_service_with_correct_arguments(
    event_valid_event,
    context,
    mock_service,
    mock_upload_document_iteration_3_enabled,
    mock_extract_ods,
):
    mock_extract_ods.return_value = TEST_CURRENT_GP_ODS
    lambda_handler(event_valid_event, context)

    mock_service.get_document_review_status.assert_called_with(
        ods_code=TEST_CURRENT_GP_ODS, document_id=TEST_UUID, document_version=1
    )


def test_lambda_handler_returns_200_response_with_status_in_body(
    event_valid_event,
    context,
    mock_service,
    mock_upload_document_iteration_3_enabled,
    mock_extract_ods,
):

    mock_service.get_document_review_status.return_value = {
        "id": MOCK_DOCUMENT_REVIEW_REFERENCE.id,
        "version": MOCK_DOCUMENT_REVIEW_REFERENCE.version,
        "reviewStatus": MOCK_DOCUMENT_REVIEW_REFERENCE.review_status,
    }

    expected = ApiGatewayResponse(
        status_code=200,
        body=json.dumps(
            {
                "id": MOCK_DOCUMENT_REVIEW_REFERENCE.id,
                "version": MOCK_DOCUMENT_REVIEW_REFERENCE.version,
                "reviewStatus": MOCK_DOCUMENT_REVIEW_REFERENCE.review_status,
            }
        ),
        methods="GET",
    ).create_api_gateway_response()
    actual = lambda_handler(event_valid_event, context)

    assert actual == expected


def test_lambda_handler_returns_400_no_id_in_event_path_parameter(
    event,
    mock_service,
    context,
    mock_upload_document_iteration_3_enabled,
    mock_extract_ods,
):

    body = {
        "message": LambdaError.DocumentReferenceMissingParameters.value["message"],
        "err_code": LambdaError.DocumentReferenceMissingParameters.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }

    expected = ApiGatewayResponse(
        status_code=400,
        body=json.dumps(body),
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event, context)
    assert actual == expected


def test_lambda_handler_returns_403_document_review_forbidden_raised(
    event_valid_event,
    context,
    mock_service,
    mock_upload_document_iteration_3_enabled,
    mock_extract_ods,
):
    mock_service.get_document_review_status.side_effect = DocumentReviewLambdaException(
        403, LambdaError.DocumentReviewUploadForbidden
    )

    body = json.dumps(
        {
            "message": LambdaError.DocumentReviewUploadForbidden.value["message"],
            "err_code": LambdaError.DocumentReviewUploadForbidden.value["err_code"],
            "interaction_id": MOCK_INTERACTION_ID,
        }
    )

    expected = ApiGatewayResponse(
        status_code=403,
        body=body,
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event_valid_event, context)
    assert actual == expected


def test_lambda_handler_returns_401_missing_ods_code_in_request_context(
    event_valid_event,
    context,
    mock_service,
    mock_upload_document_iteration_3_enabled,
    mock_extract_ods,
):
    mock_extract_ods.side_effect = OdsErrorException()

    body = json.dumps(
        {
            "message": LambdaError.DocumentReviewMissingODS.value["message"],
            "err_code": LambdaError.DocumentReviewMissingODS.value["err_code"],
            "interaction_id": MOCK_INTERACTION_ID,
        }
    )

    expected = ApiGatewayResponse(
        status_code=401,
        body=body,
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event_valid_event, context)
    assert actual == expected


def test_lambda_returns_500_on_model_validation_failure(
    event_valid_event,
    context,
    mock_service,
    mock_upload_document_iteration_3_enabled,
    mock_extract_ods,
):
    mock_service.get_document_review_status.side_effect = DocumentReviewLambdaException(
        500, LambdaError.DocumentReviewValidation
    )
    body = json.dumps(
        {
            "message": LambdaError.DocumentReviewValidation.value["message"],
            "err_code": LambdaError.DocumentReviewValidation.value["err_code"],
            "interaction_id": MOCK_INTERACTION_ID,
        }
    )

    expected = ApiGatewayResponse(
        status_code=500,
        body=body,
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event_valid_event, context)
    assert actual == expected


def test_lambda_handler_returns_500_on_dynamodb_client_error(
    event_valid_event,
    context,
    mock_service,
    mock_upload_document_iteration_3_enabled,
    mock_extract_ods,
):
    mock_service.get_document_review_status.side_effect = DocumentReviewLambdaException(
        500, LambdaError.DocumentReviewDB
    )

    body = json.dumps(
        {
            "message": LambdaError.DocumentReviewDB.value["message"],
            "err_code": LambdaError.DocumentReviewDB.value["err_code"],
            "interaction_id": MOCK_INTERACTION_ID,
        }
    )

    expected = ApiGatewayResponse(
        status_code=500,
        body=body,
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event_valid_event, context)
    assert actual == expected


def test_lambda_handler_returns_404_no_document_review_reference_found(
    event_valid_event,
    context,
    mock_service,
    mock_upload_document_iteration_3_enabled,
    mock_extract_ods,
):
    mock_service.get_document_review_status.side_effect = DocumentReviewLambdaException(
        404, LambdaError.DocumentReviewNotFound
    )

    body = json.dumps(
        {
            "message": LambdaError.DocumentReviewNotFound.value["message"],
            "err_code": LambdaError.DocumentReviewNotFound.value["err_code"],
            "interaction_id": MOCK_INTERACTION_ID,
        }
    )

    expected = ApiGatewayResponse(
        status_code=404,
        body=body,
        methods="GET",
    ).create_api_gateway_response()

    actual = lambda_handler(event_valid_event, context)
    assert actual == expected
