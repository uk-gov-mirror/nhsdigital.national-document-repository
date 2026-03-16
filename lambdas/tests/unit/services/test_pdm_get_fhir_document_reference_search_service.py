import pytest
from freezegun import freeze_time

from enums.mtls import MtlsCommonNames
from enums.snomed_codes import SnomedCodes
from models.document_reference import DocumentReference
from services.document_reference_search_service import DocumentReferenceSearchService
from tests.unit.conftest import APIM_API_URL, MOCK_LG_TABLE_NAME
from tests.unit.helpers.data.dynamo.dynamo_responses import MOCK_SEARCH_RESPONSE
from utils.lambda_header_utils import validate_common_name_in_mtls

MOCK_DOCUMENT_REFERENCE = [
    DocumentReference.model_validate(MOCK_SEARCH_RESPONSE["Items"][0]),
]

MOCK_FILE_SIZE = 24000

EXPECTED_RESPONSE = {
    "created": "2024-01-01T12:00:00.000Z",
    "fileName": "document.csv",
    "virusScannerResult": "Clean",
    "id": "3d8683b9-1665-40d2-8499-6e8302d507ff",
    "fileSize": MOCK_FILE_SIZE,
    "version": "1",
}


@pytest.fixture
def mock_document_service(mocker, set_env):
    service = DocumentReferenceSearchService()
    mock_s3_service = mocker.patch.object(service, "s3_service")
    mocker.patch.object(mock_s3_service, "get_file_size", return_value=MOCK_FILE_SIZE)
    mocker.patch.object(service, "dynamo_service")
    mocker.patch.object(service, "fetch_documents_from_table_with_nhs_number")
    mocker.patch.object(service, "is_upload_in_process", return_value=False)
    return service


@pytest.fixture
def mock_filter_builder(mocker):
    mock_filter = mocker.MagicMock()
    mocker.patch(
        "services.document_reference_search_service.DynamoQueryFilterBuilder",
        return_value=mock_filter,
    )
    return mock_filter


@pytest.fixture
def mock_mtls_common_names(monkeypatch):
    monkeypatch.setattr(
        MtlsCommonNames,
        "_get_mtls_common_names",
        classmethod(lambda cls: {"PDM": ["ndrclient.main.int.pdm.national.nhs.uk"]}),
    )


@pytest.mark.parametrize(
    "common_name, expected",
    [
        (
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
            "dev_COREDocumentMetadata",
        ),
        ({}, MOCK_LG_TABLE_NAME),
    ],
)
def test_get_pdm_table(
    set_env,
    mock_document_service,
    common_name,
    expected,
    mock_mtls_common_names,
):
    cn = validate_common_name_in_mtls(common_name)
    tables = mock_document_service._get_table_name(cn)
    assert tables == expected


def test_create_document_reference_fhir_response(mock_document_service, mocker):
    mock_document_reference = mocker.MagicMock()
    mock_document_reference.nhs_number = "9000000009"
    mock_document_reference.file_name = "test_document.pdf"
    mock_document_reference.created = "2023-05-01T12:00:00Z"
    mock_document_reference.document_scan_creation = "2023-05-01"
    mock_document_reference.id = "Y05868-1634567890"
    mock_document_reference.current_gp_ods = "Y12345"
    mock_document_reference.document_snomed_code_type = "717391000000106"

    mock_attachment = mocker.patch(
        "services.document_reference_search_service.Attachment",
    )
    mock_attachment_instance = mocker.MagicMock()
    mock_attachment.return_value = mock_attachment_instance

    mock_doc_ref_info = mocker.patch(
        "services.document_reference_search_service.DocumentReferenceInfo",
    )
    mock_doc_ref_info_instance = mocker.MagicMock()
    mock_doc_ref_info.return_value = mock_doc_ref_info_instance

    mock_fhir_doc_ref = mocker.MagicMock()
    mock_doc_ref_info_instance.create_fhir_document_reference_object.return_value = (
        mock_fhir_doc_ref
    )

    expected_fhir_response = {
        "id": "717391000000106~Y05868-1634567890",
        "resourceType": "DocumentReference",
        "status": "current",
        "docStatus": "final",
        "subject": {
            "identifier": {
                "system": "https://fhir.nhs.uk/Id/nhs-number",
                "value": "9000000009",
            },
        },
        "content": [
            {
                "attachment": {
                    "contentType": "application/pdf",
                    "language": "en-GB",
                    "title": "test_document.pdf",
                    "creation": "2023-05-01",
                    "url": f"{APIM_API_URL}/DocumentReference/123",
                },
            },
        ],
        "author": [
            {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": "Y05868",
                },
            },
        ],
        "custodian": {
            "identifier": {
                "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                "value": "Y05868",
            },
        },
    }
    mock_fhir_doc_ref.model_dump.return_value = expected_fhir_response

    result = mock_document_service.create_document_reference_fhir_response(
        mock_document_reference,
    )

    mock_attachment.assert_called_once_with(
        title=mock_document_reference.file_name,
        creation=mock_document_reference.document_scan_creation,
        url=f"{APIM_API_URL}/DocumentReference/{SnomedCodes.PATIENT_DATA.value.code}~{mock_document_reference.id}",
    )

    mock_doc_ref_info.assert_called_once_with(
        nhs_number=mock_document_reference.nhs_number,
        attachment=mock_attachment_instance,
        custodian=mock_document_reference.current_gp_ods,
        snomed_code_doc_type=SnomedCodes.PATIENT_DATA.value,
    )

    mock_doc_ref_info_instance.create_fhir_document_reference_object.assert_called_once()
    mock_fhir_doc_ref.model_dump.assert_called_once_with(exclude_none=True)

    assert result == expected_fhir_response


@freeze_time("2023-05-01T12:00:00Z")
def test_create_document_reference_fhir_response_integration(
    mock_document_service,
    mocker,
):
    mock_document_reference = mocker.MagicMock()
    mock_document_reference.nhs_number = "9000000009"
    mock_document_reference.file_name = "test_document.pdf"
    mock_document_reference.created = "2023-05-01T12:00:00"
    mock_document_reference.document_scan_creation = "2023-05-01"
    mock_document_reference.id = "Y05868-1634567890"
    mock_document_reference.current_gp_ods = "Y12345"
    mock_document_reference.author = "Y12345"
    mock_document_reference.doc_status = "final"
    mock_document_reference.custodian = "Y12345"
    mock_document_reference.document_snomed_code_type = "717391000000106"
    mock_document_reference.version = "1"

    expected_fhir_response = {
        "id": "717391000000106~Y05868-1634567890",
        "resourceType": "DocumentReference",
        "status": "current",
        "docStatus": "final",
        "subject": {
            "identifier": {
                "system": "https://fhir.nhs.uk/Id/nhs-number",
                "value": "9000000009",
            },
        },
        "date": "2023-05-01T12:00:00",
        "content": [
            {
                "attachment": {
                    "contentType": "application/pdf",
                    "language": "en-GB",
                    "title": "test_document.pdf",
                    "creation": "2023-05-01",
                    "url": f"{APIM_API_URL}/DocumentReference/717391000000106~Y05868-1634567890",
                },
            },
        ],
        "author": [
            {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": "Y12345",
                },
            },
        ],
        "custodian": {
            "identifier": {
                "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                "value": "Y12345",
            },
        },
        "type": {
            "coding": [
                {
                    "system": "http://snomed.info/sct",
                    "code": "717391000000106",
                    "display": "Confidential patient data",
                },
            ],
        },
        "meta": {"versionId": "1"},
    }

    result = mock_document_service.create_document_reference_fhir_response(
        mock_document_reference,
    )

    assert isinstance(result, dict)
    assert result == expected_fhir_response


@freeze_time("2023-05-01T12:00:00Z")
def test_create_document_reference_fhir_response_no_title(
    mock_document_service,
    mocker,
):
    mock_document_reference = mocker.MagicMock()
    mock_document_reference.nhs_number = "9000000009"
    mock_document_reference.file_name = None
    mock_document_reference.created = "2023-05-01T12:00:00"
    mock_document_reference.document_scan_creation = "2023-05-01"
    mock_document_reference.id = "Y05868-1634567890"
    mock_document_reference.current_gp_ods = "Y12345"
    mock_document_reference.author = "Y12345"
    mock_document_reference.doc_status = "final"
    mock_document_reference.custodian = "Y12345"
    mock_document_reference.document_snomed_code_type = "717391000000106"
    mock_document_reference.version = "1"

    expected_fhir_response = {
        "id": "717391000000106~Y05868-1634567890",
        "resourceType": "DocumentReference",
        "status": "current",
        "docStatus": "final",
        "subject": {
            "identifier": {
                "system": "https://fhir.nhs.uk/Id/nhs-number",
                "value": "9000000009",
            },
        },
        "date": "2023-05-01T12:00:00",
        "content": [
            {
                "attachment": {
                    "contentType": "application/pdf",
                    "language": "en-GB",
                    "creation": "2023-05-01",
                    "url": f"{APIM_API_URL}/DocumentReference/717391000000106~Y05868-1634567890",
                },
            },
        ],
        "author": [
            {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": "Y12345",
                },
            },
        ],
        "custodian": {
            "identifier": {
                "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                "value": "Y12345",
            },
        },
        "type": {
            "coding": [
                {
                    "system": "http://snomed.info/sct",
                    "code": "717391000000106",
                    "display": "Confidential patient data",
                },
            ],
        },
        "meta": {"versionId": "1"},
    }

    result = mock_document_service.create_document_reference_fhir_response(
        mock_document_reference,
    )

    assert isinstance(result, dict)
    assert result == expected_fhir_response
