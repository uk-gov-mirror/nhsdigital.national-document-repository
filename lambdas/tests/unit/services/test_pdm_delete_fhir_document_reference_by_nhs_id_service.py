import uuid
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from enums.document_retention import DocumentRetentionDays
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.mtls import MtlsCommonNames
from enums.snomed_codes import SnomedCodes
from models.document_reference import DocumentReference
from services.delete_fhir_document_reference_service import (
    DeleteFhirDocumentReferenceService,
)
from tests.unit.conftest import TEST_NHS_NUMBER
from tests.unit.helpers.data.dynamo.dynamo_responses import MOCK_SEARCH_RESPONSE
from utils.lambda_exceptions import (
    DocumentRefException,
)

MOCK_DOCUMENT_REFERENCE = DocumentReference.model_validate(
    MOCK_SEARCH_RESPONSE["Items"][0],
)

TEST_DOCUMENT_ID = "3d8683b9-1665-40d2-8499-6e8302d507ff"

MOCK_MTLS_VALID_EVENT_BY_NHS_ID = {
    "httpMethod": "DELETE",
    "headers": {},
    "queryStringParameters": {
        "subject:identifier": f"https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}",
        "_id": TEST_DOCUMENT_ID,
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

MOCK_MTLS_VALID_EVENT_WITH_INVALID_PATH_PARAM = {
    "httpMethod": "DELETE",
    "headers": {},
    "pathParameters": {"foo": f"{TEST_NHS_NUMBER}"},
    "body": None,
}

MOCK_MTLS_VALID_EVENT_WITH_VALID_PATH_PARAM_NO_QUERY_PARAM = {
    "httpMethod": "DELETE",
    "headers": {},
    "pathParameters": {"id": f"{TEST_DOCUMENT_ID}"},
    "body": None,
}

MOCK_MTLS_VALID_EVENT_WITH_INVALID_QUERY_PARAM = {
    "httpMethod": "DELETE",
    "headers": {},
    "queryStringParameters": {
        "foo": f"https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}",
    },
    "body": None,
}

MOCK_MTLS_VALID_EVENT_WITH_INVALID_QUERY_PARAM_AND_VALID_QUERY_PARAMS = {
    "httpMethod": "DELETE",
    "headers": {},
    "queryStringParameters": {
        "foo": f"https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}",
        "subject:identifier": f"https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}",
        "_id": TEST_DOCUMENT_ID,
    },
    "body": None,
}

MOCK_MTLS_INVALID_EVENT = {
    "httpMethod": "DELETE",
    "headers": {},
    "body": None,
}

MOCK_MTLS_INVALID_EVENT_PATH_AND_QUERY = {
    "httpMethod": "DELETE",
    "headers": {},
    "queryStringParameters": {
        "subject:identifier": f"https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}",
    },
    "pathParameters": {"id": f"{TEST_DOCUMENT_ID}"},
    "body": None,
}


@pytest.fixture
def service():
    return DeleteFhirDocumentReferenceService()


def test_valid_uuid(service):
    assert service.is_uuid(str(uuid.uuid4())) is True


def test_invalid_uuid(service):
    assert service.is_uuid("not-a-uuid") is False


def test_none(service):
    assert service.is_uuid(None) is False


def test_extract_path_parameter_no_path_param_exists_for_id(service):
    identifier = service.extract_document_path_parameters(
        MOCK_MTLS_VALID_EVENT_BY_NHS_ID,
    )
    assert identifier is None


def test_extract_path_parameter_no_path_param_exists_for_id_but_pathParameters_exist(
    service,
):
    identifier = service.extract_document_path_parameters(
        MOCK_MTLS_VALID_EVENT_WITH_INVALID_PATH_PARAM,
    )
    assert identifier is None


def test_extract_path_parameter_path_param_exists_for_id(service):
    identifier = service.extract_document_path_parameters(
        MOCK_MTLS_VALID_EVENT_WITH_VALID_PATH_PARAM_NO_QUERY_PARAM,
    )
    assert identifier is TEST_DOCUMENT_ID


def test_extract_query_parameter_for_id_and_nhsnumber(service):
    identifiers = service.extract_document_query_parameters(
        MOCK_MTLS_VALID_EVENT_BY_NHS_ID["queryStringParameters"],
    )
    assert identifiers[0] == TEST_NHS_NUMBER
    assert identifiers[1] == TEST_DOCUMENT_ID


def test_extract_query_parameter_with_invalid_query_parameter(service):
    identifiers = service.extract_document_query_parameters(
        MOCK_MTLS_VALID_EVENT_WITH_INVALID_QUERY_PARAM["queryStringParameters"],
    )
    assert identifiers == (None, None)


def test_extract_query_parameter_when_non_existent(service):
    identifiers = service.extract_document_query_parameters(
        MOCK_MTLS_VALID_EVENT_WITH_VALID_PATH_PARAM_NO_QUERY_PARAM,
    )
    assert identifiers == (None, None)


def test_extract_query_parameter_with_too_many(service):
    identifiers = service.extract_document_query_parameters(
        MOCK_MTLS_VALID_EVENT_WITH_INVALID_QUERY_PARAM_AND_VALID_QUERY_PARAMS,
    )
    assert identifiers == (None, None)


def test_extract_parameters_when_query_but_no_path(service):
    identifiers = service.extract_parameters(MOCK_MTLS_VALID_EVENT_BY_NHS_ID)
    assert identifiers[0] == TEST_DOCUMENT_ID
    assert identifiers[1] == TEST_NHS_NUMBER


def test_extract_parameters_when_no_query_and_no_path(service):
    with pytest.raises(DocumentRefException) as exc_info:
        service.extract_parameters(MOCK_MTLS_INVALID_EVENT)

    assert exc_info.value.status_code == 400


def test_doc_type_by_common_name_pdm(service):
    doc_type = service._determine_document_type_based_on_common_name(
        MtlsCommonNames.PDM,
    )
    assert doc_type.code == SnomedCodes.PATIENT_DATA.value.code


def test_doc_type_by_common_name_None(service):
    doc_type = service._determine_document_type_based_on_common_name(None)
    assert doc_type.code == SnomedCodes.LLOYD_GEORGE.value.code


def test_delete_fhir_document_references_by_nhs_id_and_doc_id_happy_path(service):
    doc_type = MagicMock()
    doc_type.value = "test-doc-type"

    mock_document = MOCK_DOCUMENT_REFERENCE
    dynamo_table = "mock-table"

    service._get_dynamo_table_for_doc_type = MagicMock(return_value=dynamo_table)

    service.delete_document_reference = MagicMock()

    with patch(
        "services.delete_fhir_document_reference_service.DocumentService",
    ) as mock_document_service_cls:

        mock_document_service = MagicMock()
        mock_document_service.get_item_agnostic.return_value = mock_document
        mock_document_service_cls.return_value = mock_document_service

        result = service.delete_fhir_document_reference_by_doc_id(
            doc_id=TEST_DOCUMENT_ID,
            doc_type=doc_type,
        )

    assert result == mock_document

    service._get_dynamo_table_for_doc_type.assert_called_once_with(doc_type)

    mock_document_service.get_item_agnostic.assert_called_once_with(
        partition_key={DocumentReferenceMetadataFields.ID.value: TEST_DOCUMENT_ID},
        table_name=dynamo_table,
    )

    mock_document_service.delete_document_reference.assert_called_once_with(
        table_name=dynamo_table,
        document_reference=mock_document,
        document_ttl_days=DocumentRetentionDays.SOFT_DELETE,
        key_pair={
            DocumentReferenceMetadataFields.ID.value: TEST_DOCUMENT_ID,
        },
    )


def test_delete_fhir_document_references_by_nhs_id_no_documents(service):
    service._get_dynamo_table_for_doc_type = MagicMock(return_value="mock-table")

    service.delete_document_reference = MagicMock()

    with patch(
        "services.delete_fhir_document_reference_service.DocumentService",
    ) as mock_document_service_cls:

        mock_document_service = MagicMock()
        mock_document_service.get_item_agnostic.return_value = []
        mock_document_service_cls.return_value = mock_document_service

        result = service.delete_fhir_document_reference_by_doc_id(
            doc_id=TEST_DOCUMENT_ID,
            doc_type=MagicMock(),
        )

    assert result is None
    service.delete_document_reference.assert_not_called()


def test_delete_fhir_document_references_by_nhs_id_propagates_client_error(service):
    service._get_dynamo_table_for_doc_type = MagicMock(return_value="mock-table")

    with patch(
        "services.delete_fhir_document_reference_service.DocumentService",
    ) as mock_document_service_cls:

        mock_document_service = MagicMock()
        mock_document_service.get_item_agnostic.side_effect = ClientError(
            error_response={},
            operation_name="Query",
        )
        mock_document_service_cls.return_value = mock_document_service

        with pytest.raises(ClientError):
            service.delete_fhir_document_reference_by_nhs_id_and_doc_id(
                nhs_number="9000000009",
                doc_id=TEST_DOCUMENT_ID,
                doc_type=MagicMock(),
            )


def test_process_returns_none_when_only_one_identifier(service):
    event = {"requestContext": {}}

    with patch(
        "services.delete_fhir_document_reference_service.validate_common_name_in_mtls",
        return_value="CN",
    ), patch.object(
        service,
        "extract_parameters",
        return_value=[TEST_DOCUMENT_ID],
    ), patch.object(
        service,
        "_determine_document_type_based_on_common_name",
        return_value=SnomedCodes.PATIENT_DATA.value,
    ), patch.object(
        service,
        "is_uuid",
        return_value=False,
    ):

        result = service.process_fhir_document_reference(event)

    assert result == []


def test_process_returns_none_when_identifiers_are_none(service):
    event = {"requestContext": {}}

    with patch(
        "services.delete_fhir_document_reference_service.validate_common_name_in_mtls",
        return_value="CN",
    ), patch.object(
        service,
        "extract_parameters",
        return_value=[None, None],
    ), patch.object(
        service,
        "_determine_document_type_based_on_common_name",
        return_value=SnomedCodes.PATIENT_DATA.value,
    ), patch.object(
        service,
        "is_uuid",
        return_value=False,
    ):

        with pytest.raises(DocumentRefException) as exc_info:
            service.process_fhir_document_reference(event)

    assert exc_info.value.status_code == 400
