import pytest
from enums.lambda_error import LambdaError
from tests.unit.conftest import TEST_UUID

from enums.snomed_codes import SnomedCodes
from utils.lambda_handler_utils import extract_bearer_token
from utils.lambda_exceptions import (
    GetFhirDocumentReferenceException,
    DocumentRefSearchException,
    DocumentRefException,
)

LG_SNOMED_CODE = SnomedCodes.LLOYD_GEORGE.value.code
PDM_SNOMED_CODE = SnomedCodes.PATIENT_DATA.value.code

MOCK_CIS2_VALID_EVENT = {
    "httpMethod": "GET",
    "headers": {
        "Authorization": f"Bearer {TEST_UUID}",
        "cis2-urid": TEST_UUID,
    },
    "pathParameters": {"id": f"{LG_SNOMED_CODE}~{TEST_UUID}"},
    "body": None,
    "requestContext": {},
}

MOCK_MTLS_VALID_EVENT = {
    "httpMethod": "GET",
    "headers": {},
    "pathParameters": {"id": f"{PDM_SNOMED_CODE}~{TEST_UUID}"},
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


@pytest.mark.parametrize(
    "function_name, mock_event",
    [
        ("GetDocumentReference", MOCK_CIS2_VALID_EVENT),
        ("SearchDocumentReferencesFHIR", MOCK_CIS2_VALID_EVENT),
        ("foobar", MOCK_CIS2_VALID_EVENT),
    ],
)
def test_extract_bearer_token_happy_paths(context, function_name, mock_event):
    context.function_name = function_name
    token = extract_bearer_token(mock_event, context)
    assert token == f"Bearer {TEST_UUID}"


def test_extract_bearer_token_when_pdm(context):
    token = extract_bearer_token(MOCK_MTLS_VALID_EVENT, context)
    assert token is None


@pytest.mark.parametrize(
    "function_name, error_type, headers",
    [
        (
            "GetDocumentReference",
            GetFhirDocumentReferenceException,
            {"headers": {}},
        ),
        (
            "SearchDocumentReferencesFHIR",
            DocumentRefSearchException,
            {"headers": {}},
        ),
        ("foobar", DocumentRefException, {"headers": {}}),
        (
            "GetDocumentReference",
            GetFhirDocumentReferenceException,
            {"headers": {"Authorization": "foo bar"}},
        ),
        (
            "SearchDocumentReferencesFHIR",
            DocumentRefSearchException,
            {"headers": {"Authorization": "foo bar"}},
        ),
        (
            "foobar",
            DocumentRefException,
            {"headers": {"Authorization": "foo bar"}},
        ),
    ],
)
def test_extract_problem_bearer_token(context, function_name, error_type, headers):
    context.function_name = function_name
    event_without_auth = headers
    with pytest.raises(error_type) as e:
        extract_bearer_token(event_without_auth, context)
    assert e.value.status_code == 401
    assert e.value.error == LambdaError.DocumentReferenceUnauthorised
