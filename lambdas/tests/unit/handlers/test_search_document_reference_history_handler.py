import json

import pytest

from handlers.search_document_reference_history_handler import lambda_handler
from tests.unit.conftest import TEST_NHS_NUMBER, TEST_UUID
from utils.exceptions import (
    InvalidDocumentReferenceException,
    OdsErrorException,
    UserIsNotCustodianException,
)


@pytest.fixture
def mock_get_fhir_doc_ref_history_service(mocker):
    yield mocker.patch(
        "handlers.search_document_reference_history_handler.GetFhirDocumentReferenceHistoryService",
    ).return_value


@pytest.fixture
def valid_get_event():
    return {
        "httpMethod": "GET",
        "queryStringParameters": {"patientId": TEST_NHS_NUMBER},
        "pathParameters": {"id": TEST_UUID},
    }


@pytest.fixture
def invalid_get_event():
    return {
        "httpMethod": "GET",
        "queryStringParameters": {"patientId": TEST_NHS_NUMBER},
    }


def test_search_doc_ref_history_handler_returns_200_with_valid_response(
    set_env,
    context,
    valid_get_event,
    mock_get_fhir_doc_ref_history_service,
):
    expected_body = {"test": "response"}
    mock_get_fhir_doc_ref_history_service.get_document_reference_history.return_value = (
        expected_body
    )

    response = lambda_handler(valid_get_event, context)

    assert response["body"] == json.dumps(expected_body)
    assert response["statusCode"] == 200


def test_search_doc_ref_history_handler_returns_400_with_missing_id(
    set_env,
    context,
    invalid_get_event,
):

    response = lambda_handler(invalid_get_event, context)

    assert response["statusCode"] == 400
    assert (json.loads(response["body"]))["message"] == "Missing request parameters"


def test_doc_ref_not_found_returns_404(
    set_env,
    context,
    valid_get_event,
    mock_get_fhir_doc_ref_history_service,
):
    mock_get_fhir_doc_ref_history_service.get_document_reference_history.side_effect = (
        InvalidDocumentReferenceException
    )

    response = lambda_handler(valid_get_event, context)

    assert response["statusCode"] == 404
    assert (json.loads(response["body"]))["message"] == "Document reference not found"


def test_user_is_not_custodian_returns_404(
    set_env,
    context,
    valid_get_event,
    mock_get_fhir_doc_ref_history_service,
):
    mock_get_fhir_doc_ref_history_service.get_document_reference_history.side_effect = (
        UserIsNotCustodianException
    )

    response = lambda_handler(valid_get_event, context)

    assert response["statusCode"] == 404
    assert (json.loads(response["body"]))["message"] == "Document reference not found"


def test_missing_ods_code_returns_400(
    set_env,
    context,
    valid_get_event,
    mock_get_fhir_doc_ref_history_service,
):
    mock_get_fhir_doc_ref_history_service.get_document_reference_history.side_effect = (
        OdsErrorException
    )

    response = lambda_handler(valid_get_event, context)

    assert response["statusCode"] == 400
    assert (json.loads(response["body"]))[
        "message"
    ] == "Missing ODS code in request context"
