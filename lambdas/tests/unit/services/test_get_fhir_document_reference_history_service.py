import pytest

from lambdas.utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from services.get_fhir_document_reference_history_service import (
    GetFhirDocumentReferenceHistoryService,
)
from tests.unit.conftest import (
    TEST_CURRENT_GP_ODS,
    TEST_FILE_KEY,
    TEST_NHS_NUMBER,
    TEST_UUID,
)
from tests.unit.helpers.data.bulk_upload.test_data import TEST_DOCUMENT_REFERENCE
from utils.common_query_filters import FinalStatusFilter, patient_nhs_number_filter
from utils.exceptions import (
    InvalidDocumentReferenceException,
)


@pytest.fixture
def mock_get_fhir_doc_reference_history_service(mocker, set_env):
    mock_dynamo_service = mocker.patch(
        "services.get_fhir_document_reference_history_service.DynamoDBService",
    )
    service = GetFhirDocumentReferenceHistoryService()
    service.dynamo_service = mock_dynamo_service
    yield service


@pytest.fixture
def mock_query_table(mock_get_fhir_doc_reference_history_service):
    yield mock_get_fhir_doc_reference_history_service.dynamo_service.query_table


@pytest.fixture
def mock_item():
    return [
        {
            "CurrentGpOds": TEST_CURRENT_GP_ODS,
            "S3FileKey": TEST_FILE_KEY,
            "NhsNumber": TEST_NHS_NUMBER,
        },
    ]


@pytest.fixture
def mock_bundle_entry():
    return {
        "resource": {
            "id": "16521000000101~1234-4567-8912-HSDF-TEST",
            "resourceType": "DocumentReference",
            "docStatus": "preliminary",
            "status": "current",
            "type": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "16521000000101",
                        "display": "Lloyd George record folder",
                    },
                ],
            },
            "subject": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/nhs-number",
                    "value": "9000000009",
                },
            },
            "date": "2024-01-01T12:00:00.000000Z",
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
            "content": [
                {
                    "attachment": {
                        "contentType": "application/pdf",
                        "language": "en-GB",
                        "title": "1of3_Lloyd_George_Record_[Jane Smith]_[9000000009]_[22-10-2010].pdf",
                        "creation": "2022-09-03",
                    },
                },
            ],
            "meta": {
                "versionId": "1",
            },
        },
    }


def test_get_s3_file_key_correct_arguments(
    mock_get_fhir_doc_reference_history_service,
    mock_item,
    mock_query_table,
):
    expected_search_key = "ID"
    expected_search_condition = TEST_UUID
    expected_query_filter = FinalStatusFilter & patient_nhs_number_filter(
        DynamoQueryFilterBuilder(),
        TEST_NHS_NUMBER,
    )

    mock_query_table.return_value = mock_item

    result = mock_get_fhir_doc_reference_history_service.get_s3_file_key(
        TEST_UUID,
        expected_query_filter,
    )
    assert result == TEST_FILE_KEY

    mock_get_fhir_doc_reference_history_service.dynamo_service.query_table.assert_called_once_with(
        table_name=mock_get_fhir_doc_reference_history_service.lg_table,
        search_key=expected_search_key,
        search_condition=expected_search_condition,
        query_filter=expected_query_filter,
    )


def test_get_s3_file_key_invalid_item_raises_exception(
    mock_get_fhir_doc_reference_history_service,
    mock_query_table,
):
    mock_query_table.return_value = []
    combined_filter = DynamoQueryFilterBuilder()

    with pytest.raises(InvalidDocumentReferenceException) as exc_info:
        mock_get_fhir_doc_reference_history_service.get_s3_file_key(
            TEST_UUID,
            combined_filter,
        )
    assert (
        str(exc_info.value)
        == "No document reference with final status found for the provided document ID"
    )


def test_create_bundle_entry_from_doc_ref(
    mock_get_fhir_doc_reference_history_service,
    mock_bundle_entry,
):
    doc_ref = TEST_DOCUMENT_REFERENCE
    bundle_entry = (
        mock_get_fhir_doc_reference_history_service.create_bundle_entry_from_doc_ref(
            doc_ref,
        )
    )

    assert (
        bundle_entry.model_dump(exclude_unset=True, exclude_none=True)
        == mock_bundle_entry
    )


def test_get_fhir_document_reference_history_bundle(
    mock_get_fhir_doc_reference_history_service,
    mock_bundle_entry,
    mock_query_table,
):
    modified_doc_ref = TEST_DOCUMENT_REFERENCE
    modified_doc_ref.file_size = 12345
    items = [modified_doc_ref.model_dump(by_alias=True, exclude_none=True)]
    mock_query_table.return_value = items

    bundle = mock_get_fhir_doc_reference_history_service.get_document_reference_history(
        TEST_UUID,
        TEST_NHS_NUMBER,
    )
    bundle["timestamp"] = "2026-02-26T00:00:00Z"

    expected_bundle = {
        "resourceType": "Bundle",
        "type": "history",
        "timestamp": "2026-02-26T00:00:00Z",
        "total": 1,
        "entry": [mock_bundle_entry],
    }

    assert bundle == expected_bundle
