import pytest
from enums.mtls import MtlsCommonNames
from enums.snomed_codes import SnomedCodes
from handlers.get_fhir_document_reference_handler import (
    extract_document_parameters,
    lambda_handler,
)
from models.document_reference import DocumentReference
from tests.unit.conftest import TEST_UUID
from tests.unit.helpers.data.dynamo.dynamo_responses import MOCK_SEARCH_RESPONSE
from utils.lambda_handler_utils import extract_bearer_token

SNOMED_CODE = SnomedCodes.PATIENT_DATA.value.code

MOCK_MTLS_VALID_EVENT = {
    "httpMethod": "GET",
    "headers": {},
    "pathParameters": {"id": TEST_UUID},
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
    MOCK_SEARCH_RESPONSE["Items"][0],
)


@pytest.fixture
def mock_config_service(mocker):
    mock_config = mocker.patch(
        "handlers.get_fhir_document_reference_handler.DynamicConfigurationService",
    )
    mock_config_instance = mock_config.return_value
    return mock_config_instance


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
        classmethod(lambda cls: {"PDM": ["ndrclient.main.int.pdm.national.nhs.uk"]}),
    )


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
    # Verify correct method calls
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
    document_id = extract_document_parameters(MOCK_MTLS_VALID_EVENT)
    assert document_id == TEST_UUID
