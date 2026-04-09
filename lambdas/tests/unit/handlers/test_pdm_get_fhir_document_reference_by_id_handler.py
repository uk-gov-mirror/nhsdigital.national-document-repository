import json
from copy import deepcopy

import pytest

from enums.lambda_error import LambdaError
from enums.mtls import MtlsCommonNames
from enums.snomed_codes import SnomedCodes
from handlers.get_fhir_document_reference_handler import (
    extract_document_parameters,
    lambda_handler,
)
from models.document_reference import DocumentReference
from tests.unit.conftest import TEST_UUID
from tests.unit.helpers.data.dynamo.dynamo_responses import MOCK_SEARCH_RESPONSE
from utils.lambda_exceptions import GetFhirDocumentReferenceException
from utils.lambda_handler_utils import extract_bearer_token

SNOMED_CODE = SnomedCodes.PATIENT_DATA.value.code

MOCK_MTLS_VALID_EVENT = {
    "httpMethod": "GET",
    "headers": {},
    "pathParameters": {"id": f"{TEST_UUID}"},
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
                "subjectDN": "CN=ndrclient.main.dev.pdm.national.nhs.uk,O=NHS,C=UK",
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
    MOCK_SEARCH_RESPONSE["Items"][0],
)


@pytest.fixture
def mock_config_service(mocker):
    mock_config = mocker.patch(
        "handlers.get_fhir_document_reference_handler.DynamicConfigurationService",
    )
    return mock_config.return_value


@pytest.fixture
def mock_document_service(mocker):
    mock_service = mocker.patch(
        "handlers.get_fhir_document_reference_handler.GetFhirDocumentReferenceService",
    )
    mock_service_instance = mock_service.return_value
    mock_service_instance.handle_get_document_reference_request.return_value = (
        MOCK_DOCUMENT_REFERENCE
    )
    return mock_service_instance


@pytest.fixture
def mock_mtls_common_names(monkeypatch):
    monkeypatch.setattr(
        MtlsCommonNames,
        "_get_mtls_common_names",
        classmethod(lambda cls: {"PDM": ["ndrclient.main.dev.pdm.national.nhs.uk"]}),
    )


@pytest.fixture
def mock_mtls_disallow_all(monkeypatch):
    monkeypatch.setattr(
        MtlsCommonNames,
        "_get_mtls_common_names",
        classmethod(lambda cls: {"PDM": []}),
    )


@pytest.fixture
def unauthorized_cn_event():
    ev = deepcopy(MOCK_MTLS_VALID_EVENT)
    ev["requestContext"]["identity"]["clientCert"][
        "subjectDN"
    ] = "CN=unauthorised.client.nhs.uk,O=NHS,C=UK"
    return ev


@pytest.fixture
def event_missing_client_cert():
    ev = deepcopy(MOCK_MTLS_VALID_EVENT)
    ev["requestContext"]["identity"].pop("clientCert", None)
    return ev


@pytest.fixture
def event_malformed_subject_dn():
    ev = deepcopy(MOCK_MTLS_VALID_EVENT)
    ev["requestContext"]["identity"]["clientCert"]["subjectDN"] = "O=NHS,C=UK"
    return ev


def test_lambda_handler_happy_path_with_mtls_pdm_login(
    set_env,
    mock_mtls_common_names,
    mock_document_service,
    context,
):
    mock_document_service.create_document_reference_fhir_response.return_value = (
        "test_document_reference"
    )

    response = lambda_handler(MOCK_MTLS_VALID_EVENT, context)

    assert response["statusCode"] == 200
    assert response["body"] == "test_document_reference"

    mock_document_service.handle_get_document_reference_request.assert_called_once_with(
        SNOMED_CODE,
        TEST_UUID,
    )
    mock_document_service.create_document_reference_fhir_response.assert_called_once_with(
        MOCK_DOCUMENT_REFERENCE,
    )


def test_extract_bearer_token_when_pdm(context, mock_mtls_common_names):
    token = extract_bearer_token(MOCK_MTLS_VALID_EVENT, context)
    assert token is None


def test_extract_document_parameters_valid_pdm():
    document_id, snomed_code = extract_document_parameters(MOCK_MTLS_VALID_EVENT)
    assert snomed_code is None
    assert document_id == TEST_UUID


def test_lambda_handler_mtls_unauthorised_cn_returns_400(
    set_env,
    mock_mtls_disallow_all,
    mock_document_service,
    unauthorized_cn_event,
    context,
):
    resp = lambda_handler(unauthorized_cn_event, context)
    assert resp["statusCode"] == 400
    mock_document_service.handle_get_document_reference_request.assert_not_called()


def test_lambda_handler_mtls_missing_client_cert_returns_401(
    set_env,
    mock_mtls_disallow_all,
    mock_document_service,
    event_missing_client_cert,
    context,
):
    resp = lambda_handler(event_missing_client_cert, context)
    assert resp["statusCode"] == 401
    mock_document_service.handle_get_document_reference_request.assert_not_called()


def test_lambda_handler_mtls_malformed_subject_dn_returns_401(
    set_env,
    mock_mtls_disallow_all,
    mock_document_service,
    event_malformed_subject_dn,
    context,
):
    resp = lambda_handler(event_malformed_subject_dn, context)
    assert resp["statusCode"] == 401
    mock_document_service.handle_get_document_reference_request.assert_not_called()


def test_lambda_handler_mtls_invalid_path_parameters_returns_400(
    set_env,
    mock_mtls_common_names,
    mock_document_service,
    context,
):
    ev = deepcopy(MOCK_MTLS_VALID_EVENT)
    ev["pathParameters"] = {"id": "invalid_format_no_tilde"}
    resp = lambda_handler(ev, context)
    assert resp["statusCode"] == 400
    mock_document_service.handle_get_document_reference_request.assert_not_called()


@pytest.mark.parametrize(
    "status, lambda_error",
    [
        (404, LambdaError.DocumentReferenceNotFound),
        (403, LambdaError.DocumentReferenceForbidden),
        (400, LambdaError.DocumentReferenceMissingParameters),
        (500, LambdaError.DocumentReferenceGeneralError),
    ],
)
def test_lambda_handler_mtls_service_errors(
    set_env,
    mock_mtls_common_names,
    mock_document_service,
    context,
    status,
    lambda_error,
):
    mock_document_service.handle_get_document_reference_request.side_effect = (
        GetFhirDocumentReferenceException(status, lambda_error)
    )

    resp = lambda_handler(MOCK_MTLS_VALID_EVENT, context)
    assert resp["statusCode"] == status

    body = json.loads(resp["body"])
    assert body["resourceType"] == "OperationOutcome"
    assert (
        body["issue"][0]["details"]["coding"][0]["code"]
        == lambda_error.value.get("fhir_coding").code
    )
    assert (
        body["issue"][0]["details"]["coding"][0]["display"]
        == lambda_error.value.get("fhir_coding").display
    )
