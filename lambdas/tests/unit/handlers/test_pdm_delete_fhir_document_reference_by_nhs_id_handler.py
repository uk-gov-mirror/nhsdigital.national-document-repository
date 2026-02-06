import json

import pytest
from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCodes
from handlers.delete_fhir_document_reference_handler import (
    lambda_handler,
)
from models.document_reference import DocumentReference
from tests.unit.conftest import TEST_NHS_NUMBER
from tests.unit.helpers.data.dynamo.dynamo_responses import MOCK_SEARCH_RESPONSE
from utils.lambda_exceptions import (
    DocumentRefException,
)

SNOMED_CODE = SnomedCodes.PATIENT_DATA.value.code

MOCK_MTLS_VALID_EVENT = {
    "httpMethod": "DELETE",
    "headers": {},
    "queryStringParameters": {
        "subject:identifier": f"https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}"
    },
    "body": None,
    "requestContext": {
        "accountId": "123456789012",
        "apiId": "abc123",
        "domainName": "api.example.com",
        "identity": {
            "sourceIp": "1.2.3.4",
            "userAgent": "curl/7.64.1",
            "clientCert": {
                "clientCertPem": "-----BEGIN CERTIFICATE-----...",
                "subjectDN": "CN=ndrclient.main.int.pdm.national.nhs.uk,O=NHS,C=UK",
                "issuerDN": "CN=NHS Root CA,O=NHS,C=UK",
                "serialNumber": "12:34:56",
                "validity": {
                    "notBefore": "May 10 00:00:00 2024 GMT",
                    "notAfter": "May 10 00:00:00 2025 GMT",
                },
            },
        },
    },
}

MOCK_DOCUMENT_REFERENCE = DocumentReference.model_validate(
    MOCK_SEARCH_RESPONSE["Items"][0]
)


@pytest.fixture
def mock_service(mocker):
    mock_service = mocker.patch(
        "handlers.delete_fhir_document_reference_handler.DeleteFhirDocumentReferenceService"
    )
    mock_service_instance = mock_service.return_value
    return mock_service_instance


@pytest.mark.parametrize(
    "returned_service_value, expected_status",
    [([], 404), (MOCK_DOCUMENT_REFERENCE, 204)],
)
def test_lambda_handler_document_reference_not_found(
    set_env, mock_service, context, returned_service_value, expected_status
):
    mock_response = returned_service_value

    mock_service.process_fhir_document_reference.return_value = mock_response
    response = lambda_handler(MOCK_MTLS_VALID_EVENT, context)
    assert response["statusCode"] == expected_status
    assert response["headers"]["Access-Control-Allow-Methods"] == "DELETE"
    if expected_status != 204:
        assert "body" in response
        body = json.loads(response["body"])
        assert body["resourceType"] == "OperationOutcome"
        assert body["issue"][0]["details"]["coding"][0]["code"] == "not-found"
        assert body["issue"][0]["diagnostics"] == "No Documents found for deletion."
    else:
        assert "body" not in response


def test_lambda_handler_validation_error(set_env, mock_service, context):
    mock_service.process_fhir_document_reference.side_effect = DocumentRefException(
        400, LambdaError.DocRefNoParse
    )

    response = lambda_handler(MOCK_MTLS_VALID_EVENT, context)
    assert response["statusCode"] == 400
    assert "body" in response
    body = json.loads(response["body"])
    assert body["resourceType"] == "OperationOutcome"
    assert body["issue"][0]["details"]["coding"][0]["code"] == "VALIDATION_ERROR"
    assert (
        body["issue"][0]["diagnostics"]
        == "Failed to parse document upload request data"
    )


def test_lambda_handler_internal_server_error(set_env, mock_service, context):
    mock_service.process_fhir_document_reference.side_effect = DocumentRefException(
        500, LambdaError.InternalServerError
    )

    response = lambda_handler(MOCK_MTLS_VALID_EVENT, context)
    assert response["statusCode"] == 500
    assert "body" in response
    body = json.loads(response["body"])
    assert body["resourceType"] == "OperationOutcome"
    assert body["issue"][0]["details"]["coding"][0]["code"] == "exception"
    assert body["issue"][0]["diagnostics"] == "An internal server error occurred"
