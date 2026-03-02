import json

import pytest

from enums.infrastructure import DynamoTables
from enums.lambda_error import LambdaError
from enums.mtls import MtlsCommonNames
from enums.snomed_codes import SnomedCode, SnomedCodes
from models.fhir.R4.base_models import Identifier, Reference
from models.fhir.R4.fhir_document_reference import (
    Attachment,
)
from models.fhir.R4.fhir_document_reference import (
    DocumentReference as FhirDocumentReference,
)
from models.fhir.R4.fhir_document_reference import (
    DocumentReferenceContent,
)
from services.fhir_document_reference_service_base import (
    FhirDocumentReferenceServiceBase,
)
from services.post_fhir_document_reference_service import (
    PostFhirDocumentReferenceService,
)
from tests.unit.conftest import (
    APIM_API_URL,
)
from tests.unit.conftest import (
    EXPECTED_PARSED_PATIENT_BASE_CASE as mock_pds_patient_details,
)
from tests.unit.conftest import (
    TEST_UUID,
)
from utils.lambda_exceptions import DocumentRefException
from utils.request_context import request_context


@pytest.fixture
def mock_pds_service_fetch(mocker):
    mock_service_object = mocker.MagicMock()
    mocker.patch(
        "services.post_fhir_document_reference_service.get_pds_service",
        return_value=mock_service_object,
    )
    mock_service_object.fetch_patient_details.return_value = mock_pds_patient_details


@pytest.fixture
def mock_post_fhir_doc_ref_service(set_env):
    service = PostFhirDocumentReferenceService()
    yield service


@pytest.fixture
def mock_fhir_doc_ref_base_service(mocker, setup_request_context):
    mock_document_service = mocker.patch(
        "services.fhir_document_reference_service_base.DocumentService",
    )
    mock_s3_service = mocker.patch(
        "services.fhir_document_reference_service_base.S3Service",
    )
    mock_dynamo_service = mocker.patch(
        "services.fhir_document_reference_service_base.DynamoDBService",
    )
    service = FhirDocumentReferenceServiceBase()
    service.document_service = mock_document_service.return_value
    service.s3_service = mock_s3_service.return_value
    service.dynamo_service = mock_dynamo_service.return_value
    yield service


@pytest.fixture
def mock_mtls_common_names(monkeypatch):
    monkeypatch.setattr(
        MtlsCommonNames,
        "_get_mtls_common_names",
        classmethod(
            lambda cls: {
                "PDM": [
                    "ndrclient.main.int.pdm.national.nhs.uk",
                    "client.dev.ndr.national.nhs.uk",
                ],
            },
        ),
    )


@pytest.fixture
def setup_request_context():
    request_context.authorization = {
        "ndr_session_id": TEST_UUID,
        "nhs_user_id": "test-user-id",
        "selected_organisation": {"org_ods_code": "test-ods-code"},
    }
    yield
    request_context.authorization = {}


@pytest.fixture
def valid_non_mtls_request_context():
    return {
        "accountId": "123456789012",
        "apiId": "abc123",
        "domainName": "api.example.com",
        "identity": {
            "sourceIp": "1.2.3.4",
            "userAgent": "curl/7.64.1",
        },
    }


@pytest.fixture
def valid_fhir_doc_json():
    return json.dumps(
        {
            "resourceType": "DocumentReference",
            "docStatus": "final",
            "status": "current",
            "subject": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/nhs-number",
                    "value": "9000000009",
                },
            },
            "type": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": SnomedCodes.LLOYD_GEORGE.value.code,
                        "display": SnomedCodes.LLOYD_GEORGE.value.display_name,
                    },
                ],
            },
            "custodian": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": "A12345",
                },
            },
            "author": [
                {
                    "identifier": {
                        "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                        "value": "A12345",
                    },
                },
            ],
            "content": [
                {
                    "attachment": {
                        "contentType": "application/pdf",
                        "language": "en-GB",
                        "title": "test-file.pdf",
                        "creation": "2023-01-01T12:00:00Z",
                    },
                },
            ],
        },
    )


@pytest.fixture
def valid_fhir_doc_json_only_required():
    return json.dumps(
        {
            "resourceType": "DocumentReference",
            "docStatus": "final",
            "status": "current",
            "subject": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/nhs-number",
                    "value": "9000000009",
                },
            },
            "custodian": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": "A12345",
                },
            },
            "content": [
                {
                    "attachment": {
                        "contentType": "application/pdf",
                        "language": "en-GB",
                        "title": "test-file.pdf",
                        "creation": "2023-01-01T12:00:00Z",
                    },
                },
            ],
        },
    )


@pytest.fixture
def valid_mtls_header():
    return {
        "Accept": "text/json",
        "Host": "example.com",
    }


@pytest.fixture
def valid_mtls_request_context():
    return {
        "accountId": "123456789012",
        "apiId": "abc123",
        "domainName": "api.example.com",
        "identity": {
            "sourceIp": "1.2.3.4",
            "userAgent": "curl/7.64.1",
            "clientCert": {
                "clientCertPem": "-----BEGIN CERTIFICATE-----...",
                "subjectDN": "CN=client.dev.ndr.national.nhs.uk,O=NHS,C=UK",
                "issuerDN": "CN=NHS Root CA,O=NHS,C=UK",
                "serialNumber": "12:34:56",
                "validity": {
                    "notBefore": "May 10 00:00:00 2024 GMT",
                    "notAfter": "May 10 00:00:00 2025 GMT",
                },
            },
        },
    }


@pytest.fixture
def valid_mtls_fhir_doc_json():
    return json.dumps(
        {
            "resourceType": "DocumentReference",
            "docStatus": "final",
            "status": "current",
            "subject": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/nhs-number",
                    "value": "9000000009",
                },
            },
            "type": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": SnomedCodes.PATIENT_DATA.value.code,
                        "display": SnomedCodes.PATIENT_DATA.value.display_name,
                    },
                ],
            },
            "custodian": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": "A12345",
                },
            },
            "author": [
                {
                    "identifier": {
                        "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                        "value": "A12345",
                    },
                },
            ],
            "content": [
                {
                    "attachment": {
                        "contentType": "application/pdf",
                        "language": "en-GB",
                        "title": "test-file.pdf",
                        "creation": "2023-01-01T12:00:00Z",
                    },
                },
            ],
        },
    )


@pytest.fixture
def invalid_fhir_doc_json_missing_content():
    return json.dumps(
        {
            "resourceType": "DocumentReference",
            "docStatus": "final",
            "status": "current",
            "subject": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/nhs-number",
                    "value": "9000000009",
                },
            },
            "type": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": SnomedCodes.PATIENT_DATA.value.code,
                        "display": SnomedCodes.PATIENT_DATA.value.display_name,
                    },
                ],
            },
            "custodian": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": "A12345",
                },
            },
            "author": [
                {
                    "identifier": {
                        "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                        "value": "A12345",
                    },
                },
            ],
        },
    )


@pytest.fixture
def invalid_fhir_doc_json_missing_content_attachment():
    return json.dumps(
        {
            "resourceType": "DocumentReference",
            "docStatus": "final",
            "status": "current",
            "subject": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/nhs-number",
                    "value": "9000000009",
                },
            },
            "type": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": SnomedCodes.PATIENT_DATA.value.code,
                        "display": SnomedCodes.PATIENT_DATA.value.display_name,
                    },
                ],
            },
            "custodian": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": "A12345",
                },
            },
            "author": [
                {
                    "identifier": {
                        "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                        "value": "A12345",
                    },
                },
            ],
            "content": [{}],
        },
    )


@pytest.fixture
def valid_fhir_doc_object(valid_fhir_doc_json):
    return FhirDocumentReference.model_validate_json(valid_fhir_doc_json)


@pytest.fixture
def valid_fhir_doc_with_binary(valid_fhir_doc_json):
    doc = json.loads(valid_fhir_doc_json)
    doc["content"][0]["attachment"][
        "data"
    ] = "SGVsbG8gV29ybGQ="  # Base64 encoded "Hello World"
    return json.dumps(doc)


@pytest.fixture
def valid_mtls_fhir_doc_object(valid_mtls_fhir_doc_json):
    return FhirDocumentReference.model_validate_json(valid_mtls_fhir_doc_json)


@pytest.fixture
def valid_mtls_fhir_doc_with_binary(valid_mtls_fhir_doc_json):
    doc = json.loads(valid_mtls_fhir_doc_json)
    doc["content"][0]["attachment"][
        "data"
    ] = "SGVsbG8gV29ybGQ="  # Base64 encoded "Hello World"
    return json.dumps(doc)


@pytest.fixture
def valid_fhir_doc_object_without_optional(valid_fhir_doc_json_only_required):
    return FhirDocumentReference.model_validate_json(valid_fhir_doc_json_only_required)


def test_get_dynamo_table_for_patient_data_doc_type(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
):
    """Test _get_dynamo_table_for_doc_type method with a non-Lloyd George document type."""

    patient_data_code = SnomedCodes.PATIENT_DATA.value

    result = mock_post_fhir_doc_ref_service._get_dynamo_table_for_doc_type(
        patient_data_code,
    )
    assert result == str(DynamoTables.CORE)


def test_get_dynamo_table_for_unsupported_doc_type(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
):
    """Test _get_dynamo_table_for_doc_type method with a non-Lloyd George document type."""

    non_lg_code = SnomedCode(code="non-lg-code", display_name="Non Lloyd George")

    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service._get_dynamo_table_for_doc_type(non_lg_code)

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocTypeDB


def test_get_dynamo_table_for_lloyd_george_doc_type(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
):
    """Test _get_dynamo_table_for_doc_type method with Lloyd George document type."""
    lg_code = SnomedCodes.LLOYD_GEORGE.value

    result = mock_post_fhir_doc_ref_service._get_dynamo_table_for_doc_type(lg_code)

    assert result == str(DynamoTables.LLOYD_GEORGE)


def test_process_mtls_fhir_document_reference_with_binary(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mock_mtls_common_names,
    valid_mtls_fhir_doc_with_binary,
    valid_mtls_request_context,
    mock_uuid,
):
    """Test a happy path with binary data in the request."""
    json_result, document_id = (
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            valid_mtls_fhir_doc_with_binary,
            valid_mtls_request_context,
        )
    )
    expected_document_id = f"{SnomedCodes.PATIENT_DATA.value.code}~{TEST_UUID}"

    assert isinstance(json_result, str)
    result_json = json.loads(json_result)
    assert result_json["resourceType"] == "DocumentReference"
    attachment_url = result_json["content"][0]["attachment"]["url"]
    assert f"{APIM_API_URL}/DocumentReference" in attachment_url
    assert document_id == expected_document_id


def test_determine_document_type_with_correct_common_name(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _determine_document_type method when type is missing entirely."""
    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.type = None

    result = mock_post_fhir_doc_ref_service._determine_document_type(
        fhir_doc,
        MtlsCommonNames.PDM,
    )
    assert result == SnomedCodes.PATIENT_DATA.value


def test_s3_file_key_for_pdm(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _create_document_reference method without custodian information."""

    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.content = [
        DocumentReferenceContent(
            attachment=Attachment(
                contentType="application/pdf",
                title="test-file.pdf",
                creation="2023-01-01T12:00:00Z",
            ),
        ),
    ]
    fhir_doc.author = [
        Reference(
            identifier=Identifier(
                system="https://fhir.nhs.uk/Id/ods-organization-code",
                value="B67890",
            ),
        ),
    ]
    fhir_doc.custodian = None

    doc_type = SnomedCodes.PATIENT_DATA.value
    current_gp_ods = "C13579"

    result = mock_post_fhir_doc_ref_service._create_document_reference(
        nhs_number="9000000009",
        author="B67890",
        doc_type=doc_type,
        fhir_doc=fhir_doc,
        current_gp_ods=current_gp_ods,
        raw_fhir_doc=json.dumps({"foo": "bar"}),
    )

    assert (
        f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/9000000009"
        in result.s3_upload_key
    )
    assert f"9000000009/{result.id}" in result.s3_file_key
    assert result.sub_folder == f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}"


def test_create_pdm_document_reference_with_raw_request(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _create_document_reference method with raw_request included (pdm)."""

    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.content = [
        DocumentReferenceContent(
            attachment=Attachment(
                contentType="application/pdf",
                title="test-file.pdf",
                creation="2023-01-01T12:00:00Z",
            ),
        ),
    ]
    fhir_doc.custodian = Reference(
        identifier=Identifier(
            system="https://fhir.nhs.uk/Id/ods-organization-code",
            value="A12345",
        ),
    )
    fhir_doc.author = [
        Reference(
            identifier=Identifier(
                system="https://fhir.nhs.uk/Id/ods-organization-code",
                value="B67890",
            ),
        ),
    ]

    doc_type = SnomedCodes.PATIENT_DATA.value

    result = mock_post_fhir_doc_ref_service._create_document_reference(
        nhs_number="9000000009",
        author="B67890",
        doc_type=doc_type,
        fhir_doc=fhir_doc,
        current_gp_ods="C13579",
        raw_fhir_doc=json.dumps({"foo": "bar"}),
    )

    assert result.raw_request == json.dumps({"foo": "bar"})
    assert result.nhs_number == "9000000009"
    assert result.document_snomed_code_type == SnomedCodes.PATIENT_DATA.value.code
    assert result.custodian == "A12345"
    assert result.current_gp_ods == "C13579"
    assert result.author == "B67890"  # Verify author is set


def test_create_pdm_document_reference_strips_data_from_raw_request(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _create_document_reference strips attachment.data from raw_request."""

    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.content = [
        DocumentReferenceContent(
            attachment=Attachment(
                contentType="application/pdf",
                title="test-file.pdf",
                creation="2023-01-01T12:00:00Z",
            ),
        ),
    ]
    fhir_doc.custodian = Reference(
        identifier=Identifier(
            system="https://fhir.nhs.uk/Id/ods-organization-code",
            value="A12345",
        ),
    )
    fhir_doc.author = [
        Reference(
            identifier=Identifier(
                system="https://fhir.nhs.uk/Id/ods-organization-code",
                value="B67890",
            ),
        ),
    ]

    raw_fhir_doc_with_data = json.dumps(
        {
            "resourceType": "DocumentReference",
            "content": [
                {
                    "attachment": {
                        "contentType": "application/pdf",
                        "title": "test-file.pdf",
                        "data": "dGVzdCBiYXNlNjQgZGF0YQ==",
                    },
                },
            ],
        },
    )

    doc_type = SnomedCodes.PATIENT_DATA.value

    result = mock_post_fhir_doc_ref_service._create_document_reference(
        nhs_number="9000000009",
        author="B67890",
        doc_type=doc_type,
        fhir_doc=fhir_doc,
        current_gp_ods="C13579",
        raw_fhir_doc=raw_fhir_doc_with_data,
    )

    raw_request_parsed = json.loads(result.raw_request)
    assert "data" not in raw_request_parsed["content"][0]["attachment"]
    assert (
        raw_request_parsed["content"][0]["attachment"]["contentType"]
        == "application/pdf"
    )
    assert raw_request_parsed["content"][0]["attachment"]["title"] == "test-file.pdf"
    assert raw_request_parsed["resourceType"] == "DocumentReference"


def test_create_lg_document_reference_with_raw_request(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _create_document_reference method with raw_request included (LG, should be empty)."""

    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.content = [
        DocumentReferenceContent(
            attachment=Attachment(
                contentType="application/pdf",
                title="test-file.pdf",
                creation="2023-01-01T12:00:00Z",
            ),
        ),
    ]
    fhir_doc.custodian = Reference(
        identifier=Identifier(
            system="https://fhir.nhs.uk/Id/ods-organization-code",
            value="A12345",
        ),
    )
    fhir_doc.author = [
        Reference(
            identifier=Identifier(
                system="https://fhir.nhs.uk/Id/ods-organization-code",
                value="B67890",
            ),
        ),
    ]

    doc_type = SnomedCodes.LLOYD_GEORGE.value

    result = mock_post_fhir_doc_ref_service._create_document_reference(
        nhs_number="9000000009",
        author="B67890",
        doc_type=doc_type,
        fhir_doc=fhir_doc,
        current_gp_ods="C13579",
        raw_fhir_doc=json.dumps({"foo": "bar"}),
    )

    assert result.raw_request is None
    assert result.nhs_number == "9000000009"
    assert result.document_snomed_code_type == SnomedCodes.LLOYD_GEORGE.value.code
    assert result.custodian == "A12345"
    assert result.current_gp_ods == "C13579"
    assert result.author == "B67890"  # Verify author is set


def test_create_pdm_document_reference_without_author_or_type(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _create_document_reference method without author or type."""

    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.content = [
        DocumentReferenceContent(
            attachment=Attachment(
                contentType="application/pdf",
                title="test-file.pdf",
                creation="2023-01-01T12:00:00Z",
            ),
        ),
    ]
    fhir_doc.custodian = Reference(
        identifier=Identifier(
            system="https://fhir.nhs.uk/Id/ods-organization-code",
            value="A12345",
        ),
    )
    fhir_doc.author = []
    fhir_doc.type = []

    doc_type = SnomedCodes.PATIENT_DATA.value
    result = mock_post_fhir_doc_ref_service._create_document_reference(
        nhs_number="9000000009",
        author=None,
        doc_type=doc_type,
        fhir_doc=fhir_doc,
        current_gp_ods="C13579",
        raw_fhir_doc=json.dumps({"foo": "bar"}),
    )

    assert result.raw_request == json.dumps({"foo": "bar"})
    assert result.nhs_number == "9000000009"
    assert result.document_snomed_code_type == SnomedCodes.PATIENT_DATA.value.code
    assert result.custodian == "A12345"
    assert result.current_gp_ods == "C13579"
    assert result.author is None


def test_create_pdm_document_reference_without_title(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mocker,
):
    """Test _create_document_reference method without title"""

    fhir_doc = mocker.MagicMock(spec=FhirDocumentReference)
    fhir_doc.content = [
        DocumentReferenceContent(
            attachment=Attachment(
                contentType="application/pdf",
                creation="2023-01-01T12:00:00Z",
            ),
        ),
    ]
    fhir_doc.custodian = Reference(
        identifier=Identifier(
            system="https://fhir.nhs.uk/Id/ods-organization-code",
            value="A12345",
        ),
    )
    fhir_doc.author = [
        Reference(
            identifier=Identifier(
                system="https://fhir.nhs.uk/Id/ods-organization-code",
                value="B67890",
            ),
        ),
    ]

    doc_type = SnomedCodes.PATIENT_DATA.value
    result = mock_post_fhir_doc_ref_service._create_document_reference(
        nhs_number="9000000009",
        author="B67890",
        doc_type=doc_type,
        fhir_doc=fhir_doc,
        current_gp_ods="C13579",
        raw_fhir_doc=json.dumps({"foo": "bar"}),
    )

    assert result.raw_request == json.dumps({"foo": "bar"})
    assert result.nhs_number == "9000000009"
    assert result.document_snomed_code_type == SnomedCodes.PATIENT_DATA.value.code
    assert result.custodian == "A12345"
    assert result.current_gp_ods == "C13579"
    assert result.file_name is None


def test_process_fhir_document_reference_without_content_raises_error(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mock_mtls_common_names,
    invalid_fhir_doc_json_missing_content,
    valid_mtls_request_context,
):
    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            invalid_fhir_doc_json_missing_content,
            valid_mtls_request_context,
        )

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefNoParse
    assert excinfo.value.message == "Failed to parse document upload request data"


def test_process_fhir_document_reference_without_content_attachment_raises_error(
    mock_fhir_doc_ref_base_service,
    mock_post_fhir_doc_ref_service,
    mock_mtls_common_names,
    invalid_fhir_doc_json_missing_content_attachment,
    valid_mtls_request_context,
):
    with pytest.raises(DocumentRefException) as excinfo:
        mock_post_fhir_doc_ref_service.process_fhir_document_reference(
            invalid_fhir_doc_json_missing_content_attachment,
            valid_mtls_request_context,
        )

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocRefNoParse
    assert excinfo.value.message == "Failed to parse document upload request data"
