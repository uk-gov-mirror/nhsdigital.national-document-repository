import json
from unittest.mock import patch

import pytest

from enums.lambda_error import LambdaError
from handlers.post_fhir_document_reference_handler import lambda_handler
from tests.unit.conftest import APIM_API_URL
from utils.lambda_exceptions import DocumentRefException


@pytest.fixture
def valid_mtls_event():
    return {
        "body": json.dumps(
            {
                "resourceType": "DocumentReference",
                "subject": {
                    "identifier": {
                        "system": "https://fhir.nhs.uk/Id/nhs-number",
                        "value": "9000000009",
                    },
                },
            },
        ),
        "headers": json.dumps(
            {
                "Accept": "text/json",
                "Host": "example.com",
            },
        ),
        "requestContext": json.dumps(
            {
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
        ),
    }


@pytest.fixture
def mock_service(mocker):
    mock_service = mocker.patch(
        "handlers.post_fhir_document_reference_handler.PostFhirDocumentReferenceService",
    )
    mock_service_instance = mock_service.return_value
    return mock_service_instance


def test_mtls_lambda_handler_success(valid_mtls_event, context, mock_service):
    """Test successful lambda execution."""
    mock_response = {"resourceType": "DocumentReference", "id": "test-id"}
    mock_document_id = "717391000000106~pdm-doc-456"

    mock_service.process_fhir_document_reference.return_value = (
        json.dumps(mock_response),
        mock_document_id,
    )

    result = lambda_handler(valid_mtls_event, context)

    assert result["statusCode"] == 201
    assert json.loads(result["body"]) == mock_response
    assert "Location" in result["headers"]
    assert (
        result["headers"]["Location"]
        == f"{APIM_API_URL}/DocumentReference/{mock_document_id}"
    )

    mock_service.process_fhir_document_reference.assert_called_once_with(
        valid_mtls_event["body"],
        valid_mtls_event["requestContext"],
    )


def test_lambda_handler_missing_body(context):
    event = {"requestContext": {}}

    response = lambda_handler(event, context)

    assert response["statusCode"] >= 400  # Lambda error
    assert "resourceType" in json.loads(response["body"])  # FHIR error structure


@patch("handlers.post_fhir_document_reference_handler.PostFhirDocumentReferenceService")
def test_lambda_handler_document_ref_exception(mock_service, event, context):
    mock_instance = mock_service.return_value

    mock_exception = DocumentRefException(
        status_code=400,
        error=LambdaError.DocRefNoParse,
        details="Invalid doc reference",
    )

    # Raises exception when processing
    mock_instance.process_fhir_document_reference.side_effect = mock_exception

    response = lambda_handler(event, context)

    assert response["statusCode"] == 400
    # Ensure body contains structured FHIR error
    body = json.loads(response["body"])
    assert "resourceType" in body
    assert body["resourceType"] == "OperationOutcome"


@patch("handlers.post_fhir_document_reference_handler.PostFhirDocumentReferenceService")
def test_lambda_handler_location_header_format(mock_service, event, context):
    mock_instance = mock_service.return_value
    mock_instance.process_fhir_document_reference.return_value = (
        {"id": "XYZ-987"},
        "XYZ-987",
    )

    response = lambda_handler(event, context)
    print(response)

    assert (
        response["headers"]["Location"] == f"{APIM_API_URL}/DocumentReference/XYZ-987"
    )
    assert response["statusCode"] == 201
