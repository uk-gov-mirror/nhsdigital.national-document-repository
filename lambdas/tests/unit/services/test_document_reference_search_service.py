import json
from unittest.mock import MagicMock, call

import pytest
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
from enums.dynamo_filter import AttributeOperator
from enums.lambda_error import LambdaError
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.snomed_codes import SnomedCodes
from freezegun import freeze_time
from models.document_reference import DocumentReference
from pydantic import ValidationError
from services.document_reference_search_service import DocumentReferenceSearchService
from tests.unit.conftest import (
    APIM_API_URL,
    MOCK_LG_TABLE_NAME,
    TEST_CURRENT_GP_ODS,
    TEST_FILE_SIZE,
    TEST_NHS_NUMBER,
)
from tests.unit.helpers.data.dynamo.dynamo_responses import MOCK_SEARCH_RESPONSE
from utils.common_query_filters import NotDeleted, UploadCompleted
from utils.exceptions import DynamoServiceException
from utils.lambda_exceptions import DocumentRefSearchException

MOCK_DOCUMENT_REFERENCE = [
    DocumentReference.model_validate(MOCK_SEARCH_RESPONSE["Items"][0]),
]

EXPECTED_RESPONSE = {
    "created": "2024-01-01T12:00:00.000Z",
    "author": TEST_CURRENT_GP_ODS,
    "fileName": "document.csv",
    "virusScannerResult": "Clean",
    "id": "3d8683b9-1665-40d2-8499-6e8302d507ff",
    "fileSize": TEST_FILE_SIZE,
    "version": "1",
    "contentType": "application/pdf",
    "documentSnomedCodeType": SnomedCodes.LLOYD_GEORGE.value.code,
}

MOCK_NEXT_PAGE_TOKEN = "thisisaencodedtoken"


@pytest.fixture
def mock_document_service(mocker, set_env):
    service = DocumentReferenceSearchService()
    mock_s3_service = mocker.patch.object(service, "s3_service")
    mocker.patch.object(mock_s3_service, "get_file_size", return_value=TEST_FILE_SIZE)
    mocker.patch.object(service, "dynamo_service")
    mocker.patch.object(service, "fetch_documents_from_table_with_nhs_number")
    mocker.patch.object(service, "is_upload_in_process", return_value=False)
    mocker.patch.object(service, "query_table_with_paginator")
    return service


@pytest.fixture
def mock_filter_builder(mocker):
    mock_filter = mocker.MagicMock()
    mocker.patch(
        "services.document_reference_search_service.DynamoQueryFilterBuilder",
        return_value=mock_filter,
    )
    return mock_filter


def test_search_tables_for_documents_raise_validation_error(
    mock_document_service,
    validation_error,
):
    mock_document_service.fetch_documents_from_table_with_nhs_number.side_effect = (
        validation_error
    )
    with pytest.raises(ValidationError):
        mock_document_service._search_tables_for_documents(
            "1234567890",
            "table1",
            return_fhir=True,
        )


def test_get_document_references_raise_client_error(mock_document_service):
    mock_document_service.fetch_documents_from_table_with_nhs_number.side_effect = (
        ClientError(
            {
                "Error": {
                    "Code": "test",
                    "Message": "test",
                },
            },
            "test",
        )
    )
    with pytest.raises(ClientError):
        mock_document_service._search_tables_for_documents(
            "1234567890",
            "table1",
            return_fhir=True,
        )


def test_get_document_references_raise_dynamodb_error(mock_document_service):
    mock_document_service.fetch_documents_from_table_with_nhs_number.side_effect = (
        DynamoServiceException()
    )
    with pytest.raises(DynamoServiceException):
        mock_document_service._search_tables_for_documents(
            "1234567890",
            "table1",
            return_fhir=True,
            check_upload_completed=False,
        )


def test_get_document_references_dynamo_return_empty_response_with_fhir(
    mock_document_service,
):
    mock_document_service.fetch_documents_from_table_with_nhs_number.return_value = []

    actual = mock_document_service._search_tables_for_documents(
        "1234567890",
        "table1",
        return_fhir=True,
    )
    assert actual["resourceType"] == "Bundle"
    assert actual["entry"] == []
    assert actual["total"] == 0


def test_get_document_references_dynamo_return_empty_response(mock_document_service):
    mock_document_service.fetch_documents_from_table_with_nhs_number.return_value = []

    actual = mock_document_service._search_tables_for_documents(
        "1234567890",
        "table1",
        return_fhir=False,
    )
    assert actual is None


def test_get_document_references_dynamo_return_successful_response_single_table(
    mock_document_service,
    monkeypatch,
):
    monkeypatch.setenv("DYNAMODB_TABLE_LIST", json.dumps(["test_table"]))

    mock_document_service.fetch_documents_from_table_with_nhs_number.return_value = (
        MOCK_DOCUMENT_REFERENCE
    )
    expected_results = MOCK_DOCUMENT_REFERENCE
    actual = mock_document_service.fetch_documents_from_table_with_nhs_number(
        "111111111",
        "test_table",
        NotDeleted,
    )

    assert actual == expected_results


def test_build_document_model_response(mock_document_service, monkeypatch):
    expected_results = [EXPECTED_RESPONSE]
    actual = mock_document_service._process_documents(MOCK_DOCUMENT_REFERENCE, False)

    assert actual == expected_results


def test_get_document_references_raise_error_when_upload_is_in_process(
    mock_document_service,
):
    mock_document_service.is_upload_in_process.return_value = True

    with pytest.raises(DocumentRefSearchException):
        mock_document_service._validate_upload_status(MOCK_DOCUMENT_REFERENCE)


def test_get_document_references_success(mock_document_service, mocker):
    mock_get_table_names = mocker.MagicMock(return_value="table1")
    mock_document_service._get_table_name = mock_get_table_names
    mock_search_document = mocker.MagicMock(return_value=[{"id": "123"}])
    mock_document_service._search_tables_for_documents = mock_search_document

    result = mock_document_service.get_document_references(
        "1234567890",
        return_fhir=False,
    )

    assert result == [{"id": "123"}]
    mock_get_table_names.assert_called_once()
    mock_search_document.assert_called_once_with(
        "1234567890",
        "table1",
        False,
        None,
        True,
    )


def test_get_document_references_exception(mock_document_service, mocker):
    mock_document_service._get_table_name = mocker.MagicMock(
        side_effect=DynamoServiceException,
    )

    with pytest.raises(DocumentRefSearchException) as exc_info:
        mock_document_service.get_document_references("1234567890")

    assert exc_info.value.status_code == 500
    assert exc_info.value.error == LambdaError.DocRefClient


def test_search_tables_for_documents_non_fhir(mock_document_service, mocker):
    mock_fetch_document_method = mocker.MagicMock(return_value=MOCK_DOCUMENT_REFERENCE)
    mock_document_service.fetch_documents_from_table_with_nhs_number = (
        mock_fetch_document_method
    )

    mock_document_id = {"id": "123"}
    mock_process_document_non_fhir = mocker.MagicMock(return_value=[mock_document_id])

    mock_document_service._process_documents = mock_process_document_non_fhir
    result_non_fhir = mock_document_service._search_tables_for_documents(
        "1234567890",
        "table1",
        return_fhir=False,
        check_upload_completed=True,
    )

    assert result_non_fhir == [mock_document_id]

    mock_process_document_non_fhir.assert_has_calls(
        [
            call(MOCK_DOCUMENT_REFERENCE, return_fhir=False),
        ],
    )
    assert mock_fetch_document_method.call_count == 1

    mock_fetch_document_method.assert_has_calls(
        [
            call("1234567890", "table1", query_filter=UploadCompleted),
        ],
    )


def test_search_tables_for_documents_fhir(mock_document_service, mocker):
    mock_fetch_document_method = mocker.MagicMock(return_value=MOCK_DOCUMENT_REFERENCE)
    mock_document_service.fetch_documents_from_table_with_nhs_number = (
        mock_fetch_document_method
    )

    mock_fhir_doc = {"resourceType": "DocumentReference", "id": "123"}
    mock_process_document_fhir = mocker.MagicMock(return_value=[mock_fhir_doc])

    mock_document_service._process_documents = mock_process_document_fhir
    result_fhir = mock_document_service._search_tables_for_documents(
        "1234567890",
        "table1",
        return_fhir=True,
        check_upload_completed=True,
    )

    assert result_fhir["resourceType"] == "Bundle"
    assert result_fhir["type"] == "searchset"
    assert result_fhir["total"] == 1
    assert len(result_fhir["entry"]) == 1
    assert result_fhir["entry"][0]["resource"] == mock_fhir_doc

    mock_fetch_document_method.assert_has_calls(
        [
            call("1234567890", "table1", query_filter=UploadCompleted),
        ],
    )
    mock_process_document_fhir.assert_has_calls(
        [
            call(MOCK_DOCUMENT_REFERENCE, return_fhir=True),
        ],
    )


def test_validate_upload_status_raises_exception(mock_document_service):
    mock_document_service.is_upload_in_process = MagicMock(return_value=True)

    with pytest.raises(DocumentRefSearchException) as exc_info:
        mock_document_service._validate_upload_status(MOCK_DOCUMENT_REFERENCE)

    assert exc_info.value.status_code == 423
    assert exc_info.value.error == LambdaError.UploadInProgressError


def test_process_documents_return_fhir(mock_document_service):
    mock_document_service.create_document_reference_fhir_response = MagicMock(
        return_value={"fhir": "response"},
    )

    result = mock_document_service._process_documents(
        MOCK_DOCUMENT_REFERENCE,
        return_fhir=True,
    )

    assert result == [{"fhir": "response"}]
    mock_document_service.create_document_reference_fhir_response.assert_called_once()


def test_create_document_reference_fhir_response(mock_document_service, mocker):
    mock_document_reference = mocker.MagicMock()
    mock_document_reference.nhs_number = "9000000009"
    mock_document_reference.file_name = "test_document.pdf"
    mock_document_reference.created = "2023-05-01T12:00:00Z"
    mock_document_reference.document_scan_creation = "2023-05-01"
    mock_document_reference.id = "Y05868-1634567890"
    mock_document_reference.current_gp_ods = "Y12345"
    mock_document_reference.document_snomed_code_type = "16521000000101"

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
        "id": "16521000000101~Y05868-1634567890",
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
        url=f"{APIM_API_URL}/DocumentReference/{SnomedCodes.LLOYD_GEORGE.value.code}~{mock_document_reference.id}",
    )

    mock_doc_ref_info.assert_called_once_with(
        nhs_number=mock_document_reference.nhs_number,
        attachment=mock_attachment_instance,
        custodian=mock_document_reference.current_gp_ods,
        snomed_code_doc_type=SnomedCodes.LLOYD_GEORGE.value,
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
    mock_document_reference.document_snomed_code_type = "16521000000101"
    mock_document_reference.version = "1"

    expected_fhir_response = {
        "id": "16521000000101~Y05868-1634567890",
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
                    "url": f"{APIM_API_URL}/DocumentReference/16521000000101~Y05868-1634567890",
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
                    "code": "16521000000101",
                    "display": "Lloyd George record folder",
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


def test_build_filter_expression_custodian(mock_document_service):
    filter_values = {"custodian": "12345"}
    expected_filter = Attr("CurrentGpOds").eq("12345") & (
        Attr("Deleted").eq("") | Attr("Deleted").not_exists()
    )

    actual_filter = mock_document_service._build_filter_expression(filter_values)

    assert expected_filter == actual_filter


def test_build_filter_expression_custodian_mocked(
    mock_document_service,
    mock_filter_builder,
):
    filter_values = {"custodian": "12345"}

    mock_document_service._build_filter_expression(filter_values)

    mock_filter_builder.add_condition.assert_any_call(
        attribute=DocumentReferenceMetadataFields.CURRENT_GP_ODS.value,
        attr_operator=AttributeOperator.EQUAL,
        filter_value="12345",
    )


def test_build_filter_expression_defaults(mock_document_service):
    filter_values = {}
    expected_filter = Attr("Deleted").eq("") | Attr("Deleted").not_exists()

    actual_filter = mock_document_service._build_filter_expression(filter_values)

    assert actual_filter == expected_filter


def test_get_paginated_references_by_nhs_number_returns_references_and_token(
    mock_document_service,
):
    mock_document_service.query_table_with_paginator.return_value = (
        MOCK_DOCUMENT_REFERENCE,
        MOCK_NEXT_PAGE_TOKEN,
    )
    expected = {
        "references": [EXPECTED_RESPONSE],
        "next_page_token": MOCK_NEXT_PAGE_TOKEN,
    }

    actual = mock_document_service.get_paginated_references_by_nhs_number(
        nhs_number=TEST_NHS_NUMBER,
    )

    mock_document_service.query_table_with_paginator.assert_called_with(
        table_name=MOCK_LG_TABLE_NAME,
        index_name="NhsNumberIndex",
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
        limit=None,
        start_key=None,
        filter_expression="#Deleted_attr = :Deleted_condition_val OR attribute_not_exists(#Deleted_attr)",
        expression_attribute_names={"#Deleted_attr": "Deleted"},
        expression_attribute_values={":Deleted_condition_val": ""},
    )

    assert actual == expected


def test_get_paginated_references_by_nhs_number_handles_filters(mock_document_service):
    mock_document_service.query_table_with_paginator.return_value = (
        MOCK_DOCUMENT_REFERENCE,
        MOCK_NEXT_PAGE_TOKEN,
    )

    mock_document_service.get_paginated_references_by_nhs_number(
        nhs_number=TEST_NHS_NUMBER,
        filter={"doc_status": "final"},
    )

    mock_document_service.query_table_with_paginator.assert_called_with(
        table_name=MOCK_LG_TABLE_NAME,
        index_name="NhsNumberIndex",
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
        limit=None,
        start_key=None,
        filter_expression=(
            "(#Deleted_attr = :Deleted_condition_val OR attribute_not_exists(#Deleted_attr)) "
            "AND #DocStatus_attr = :DocStatus_condition_val"
        ),
        expression_attribute_names={
            "#Deleted_attr": "Deleted",
            "#DocStatus_attr": "DocStatus",
        },
        expression_attribute_values={
            ":Deleted_condition_val": "",
            ":DocStatus_condition_val": "final",
        },
    )


def test_build_pagination_filter_no_addition_filter_passed_returns_not_deleted_filter(
    mock_document_service,
):
    expected_filter_expression = (
        "#Deleted_attr = :Deleted_condition_val OR attribute_not_exists(#Deleted_attr)"
    )
    expected_condition_attribute_names = {"#Deleted_attr": "Deleted"}
    expected_condition_attribute_values = {":Deleted_condition_val": ""}

    (
        actual_filter_expression,
        actual_condition_attribute_names,
        actual_condition_attribute_values,
    ) = mock_document_service._build_pagination_filter(None)

    assert expected_filter_expression == actual_filter_expression
    assert expected_condition_attribute_names == actual_condition_attribute_names
    assert expected_condition_attribute_values == actual_condition_attribute_values


def test_build_pagination_filter_handles_additional_filters(mock_document_service):
    expected_filter_expression = (
        "(#Deleted_attr = :Deleted_condition_val OR attribute_not_exists(#Deleted_attr)) "
        "AND #DocStatus_attr = :DocStatus_condition_val"
    )
    expected_condition_attribute_names = {
        "#Deleted_attr": "Deleted",
        "#DocStatus_attr": "DocStatus",
    }
    expected_condition_attribute_values = {
        ":Deleted_condition_val": "",
        ":DocStatus_condition_val": "final",
    }

    (
        actual_filter_expression,
        actual_condition_attribute_names,
        actual_condition_attribute_values,
    ) = mock_document_service._build_pagination_filter({"doc_status": "final"})

    assert actual_filter_expression == expected_filter_expression
    assert actual_condition_attribute_names == expected_condition_attribute_names
    assert actual_condition_attribute_values == expected_condition_attribute_values


def test_build_filter_expression_document_snomed_code(mock_document_service):
    filter_values = {"document_snomed_code": "16521000000101"}
    expected_filter = Attr("DocumentSnomedCodeType").eq("16521000000101") & (
        Attr("Deleted").eq("") | Attr("Deleted").not_exists()
    )

    actual_filter = mock_document_service._build_filter_expression(filter_values)

    assert expected_filter == actual_filter
