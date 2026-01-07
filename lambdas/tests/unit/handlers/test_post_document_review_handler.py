import json

import pytest
from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCodes
from handlers.post_document_review_handler import lambda_handler, validate_event_body
from models.document_review import DocumentReviewUploadEvent
from tests.unit.conftest import (
    MOCK_INTERACTION_ID,
    TEST_CURRENT_GP_ODS,
    TEST_NHS_NUMBER,
    TEST_UUID,
)
from utils.lambda_exceptions import DocumentReviewLambdaException
from utils.lambda_response import ApiGatewayResponse

INVALID_EVENT_MISSING_NHS_NUMBER = {
    "nhsNumber": "",
    "snomedCode": SnomedCodes.LLOYD_GEORGE.value.code,
    "documents": ["testFile.pdf"],
}

INVALID_EVENT_MISSING_SNOMED_CODE = {
    "nhsNumber": TEST_NHS_NUMBER,
    "snomedCode": "",
    "documents": ["testFile.pdf"],
}

INVALID_EVENT_UNSUPPORTED_SNOMED_CODE = {
    "nhsNumber": TEST_NHS_NUMBER,
    "snomedCode": "123456789012",
    "documents": ["testFile.pdf"],
}

INVALID_EVENT_MISSING_DOCUMENTS = {
    "nhsNumber": TEST_NHS_NUMBER,
    "snomedCode": SnomedCodes.LLOYD_GEORGE.value.code,
    "documents": [],
}

INVALID_EVENT_INVALID_FILE_EXTENSION = {
    "nhsNumber": TEST_NHS_NUMBER,
    "snomedCode": SnomedCodes.LLOYD_GEORGE.value.code,
    "documents": ["testFile.job"],
}

TEST_PRESIGNED_URL_1 = "https://s3.amazonaws.com/presigned1?signature=abc123"


@pytest.fixture
def invalid_event():
    event = {
        "httpMethod": "POST",
        "headers": {"Authorization": "test_token"},
        "body": json.dumps(INVALID_EVENT_MISSING_NHS_NUMBER),
    }
    yield event


@pytest.fixture
def valid_event():
    event = {
        "httpMethod": "POST",
        "headers": {"Authorization": "test_token"},
        "body": json.dumps(
            {
                "nhsNumber": TEST_NHS_NUMBER,
                "snomedCode": SnomedCodes.LLOYD_GEORGE.value.code,
                "documents": ["testFile.pdf"],
            }
        ),
    }
    yield event

@pytest.fixture
def invalid_event_missing_body():
    event = {
        "httpMethod": "POST",
        "headers": {"Authorization": "test_token"},
    }
    yield event


@pytest.fixture()
def mocked_request_context_with_ods(mocker):
    mocked_context = mocker.MagicMock()
    mocked_context.authorization = {
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS},
    }
    yield mocker.patch(
        "services.post_document_review_service.extract_ods_code_from_request_context",
        mocked_context,
    )


@pytest.fixture
def mock_service(set_env, mocker):
    mock_service = mocker.patch(
        "handlers.post_document_review_handler.PostDocumentReviewService"
    )
    mocked_instance = mock_service.return_value
    yield mocked_instance


def test_lambda_handler_returns_404_feature_flag_disabled(
    valid_event, context, mock_upload_document_iteration_3_disabled, set_env
):
    body = {
        "message": LambdaError.FeatureFlagDisabled.value["message"],
        "err_code": LambdaError.FeatureFlagDisabled.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }

    expected = ApiGatewayResponse(
        status_code=404, body=json.dumps(body), methods="POST"
    ).create_api_gateway_response()

    actual = lambda_handler(valid_event, context)

    assert actual == expected


def test_lambda_handler_returns_200_feature_flag_enabled(
    valid_event,
    context,
    mock_upload_document_iteration_3_enabled,
    set_env,
    mocked_request_context_with_ods,
    mock_service,
):
    expected_body = {
        "id": TEST_UUID,
        "uploadDate": 1704110400,
        "files": [
            {
                "fileName": json.loads(valid_event["body"])["documents"][0],
                "presignedUrl": TEST_PRESIGNED_URL_1,
            }
        ],
        "documentSnomedCodeType": SnomedCodes.LLOYD_GEORGE.value.code,
    }

    mock_service.process_event.return_value = expected_body

    expected = ApiGatewayResponse(
        status_code=200, body=json.dumps(expected_body), methods="POST"
    ).create_api_gateway_response()

    actual = lambda_handler(valid_event, context)

    assert actual == expected


def test_lambda_handler_returns_400_invalid_event(
    invalid_event, context, mock_upload_document_iteration_3_enabled, set_env
):
    body = {
        "message": LambdaError.DocumentReviewUploadInvalidRequest.value["message"],
        "err_code": LambdaError.DocumentReviewUploadInvalidRequest.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }

    expected = ApiGatewayResponse(
        status_code=400, body=json.dumps(body), methods="POST"
    ).create_api_gateway_response()

    actual = lambda_handler(invalid_event, context)

    assert actual == expected


def test_lambda_handler_returns_400_no_body_in_event(
    invalid_event_missing_body, context, mock_upload_document_iteration_3_enabled, set_env
):
    body = {
        "message": LambdaError.DocumentReviewUploadInvalidRequest.value["message"],
        "err_code": LambdaError.DocumentReviewUploadInvalidRequest.value["err_code"],
        "interaction_id": MOCK_INTERACTION_ID,
    }

    expected = ApiGatewayResponse(
        status_code=400, body=json.dumps(body), methods="POST"
    ).create_api_gateway_response()

    actual = lambda_handler(invalid_event_missing_body, context)

    assert actual == expected


def test_lambda_handler_calls_validate_event_body_with_event_body(
    mocker, valid_event, context, mock_upload_document_iteration_3_enabled, set_env
):
    mock_validate = mocker.patch(
        "handlers.post_document_review_handler.validate_event_body"
    )

    lambda_handler(valid_event, context)

    mock_validate.assert_called_with(valid_event["body"])


def test_validate_event_body_invalid_event_throws_error(invalid_event):

    with pytest.raises(DocumentReviewLambdaException) as e:
        validate_event_body(json.loads(invalid_event["body"]))
    assert e.value.status_code == 400
    assert e.value.err_code == "UDR_4003"


def test_validate_event_body_valid_event_returns_document_review_upload_event_model(
    valid_event,
):
    expected = DocumentReviewUploadEvent(
        nhs_number=TEST_NHS_NUMBER,
        snomed_code=SnomedCodes.LLOYD_GEORGE.value.code,
        documents=["testFile.pdf"],
    )

    actual = validate_event_body(valid_event["body"])
    assert actual == expected


def test_validate_event_body_throws_error_unsupported_snomed_code(invalid_event):
    invalid_event["body"] = json.dumps(INVALID_EVENT_UNSUPPORTED_SNOMED_CODE)
    with pytest.raises(DocumentReviewLambdaException) as e:
        validate_event_body(invalid_event["body"])
    assert e.value.status_code == 400
    assert e.value.err_code == "UDR_4003"


def test_validate_event_body_throws_error_unsupported_file_type(invalid_event):
    invalid_event["body"] = json.dumps(INVALID_EVENT_INVALID_FILE_EXTENSION)
    with pytest.raises(DocumentReviewLambdaException) as e:
        validate_event_body(invalid_event["body"])
    assert e.value.status_code == 400
    assert e.value.err_code == "DRV_4006"


def test_lambda_handler_calls_service_with_validated_event(
    mock_service, context, mock_upload_document_iteration_3_enabled, valid_event
):

    lambda_handler(valid_event, context)

    validated_event_body = DocumentReviewUploadEvent(
        nhs_number=TEST_NHS_NUMBER,
        snomed_code=SnomedCodes.LLOYD_GEORGE.value.code,
        documents=["testFile.pdf"],
    )

    mock_service.process_event.assert_called_with(event=validated_event_body)
