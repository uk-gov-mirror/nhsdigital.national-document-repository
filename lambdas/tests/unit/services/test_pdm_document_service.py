from unittest.mock import MagicMock

import pytest

from enums.snomed_codes import SnomedCodes
from models.document_reference import DocumentReference
from services.document_service import DocumentService


@pytest.fixture
def preliminary_dynamo_item_dict():
    return {
        "Item": {
            "id": "test-doc-id",
            "nhs_number": "9000000001",
            "s3_file_key": f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/9000000001/test-doc-id",
            "s3_bucket_name": "test-staging-bucket",
            "file_size": 1234567890,
            "doc_status": "preliminary",
            "status": "current",
            "file_name": None,
        },
    }


@pytest.fixture
def service():
    service = DocumentService()
    service.filter_item = MagicMock(return_value=True)
    service.dynamo_service = MagicMock()
    return service


@pytest.mark.parametrize(
    "db_filters,expected_result",
    [
        (
            [],
            True,
        ),
        (
            [{"doc_status": "preliminary"}],
            True,
        ),
        (
            [{"doc_status": "preliminary"}, {"status": "current"}],
            True,
        ),
        (
            [{"doc_status": "final"}],
            False,
        ),
        (
            [{"doc_status": "final"}, {"status": "foobar"}],
            False,
        ),
        (
            [{"doc_status": "preliminary"}, {"status": "foobar"}],
            False,
        ),
    ],
)
def test_filter_returns_true(db_filters, expected_result, preliminary_dynamo_item_dict):
    service = DocumentService()
    result = service.filter_item(preliminary_dynamo_item_dict, filters=db_filters)
    assert result is expected_result


def test_get_item_returns_none_when_no_item(service):
    service.dynamo_service.get_item.return_value = {}

    result = service._get_item(
        table_name="dev_COREDocumentMetadata",
        key={"ID": "123"},
        model_class=DocumentReference,
    )

    assert result is None
    service.dynamo_service.get_item.assert_called_once()


def test_get_item_returns_successful_document_reference(
    service,
    preliminary_dynamo_item_dict,
):
    service.dynamo_service.get_item.return_value = preliminary_dynamo_item_dict

    result = service._get_item(
        table_name="dev_COREDocumentMetadata",
        key={"ID": "test-doc-id"},
        model_class=DocumentReference,
    )

    assert isinstance(result, DocumentReference)
    assert result.id == "test-doc-id"


def test_get_item_does_not_return_successful_deleted_document_reference(
    service,
    preliminary_dynamo_item_dict,
):
    preliminary_dynamo_item_dict["Item"]["Deleted"] = "foobar"
    service.dynamo_service.get_item.return_value = preliminary_dynamo_item_dict

    result = service._get_item(
        table_name="dev_COREDocumentMetadata",
        key={"ID": "test-doc-id"},
        model_class=DocumentReference,
    )

    assert result is None
    service.dynamo_service.get_item.assert_called_once()


def test_get_item_returns_successful_deleted_document_reference(
    service,
    preliminary_dynamo_item_dict,
):
    preliminary_dynamo_item_dict["Item"]["Deleted"] = "foobar"
    service.dynamo_service.get_item.return_value = preliminary_dynamo_item_dict

    result = service._get_item(
        table_name="dev_COREDocumentMetadata",
        key={"ID": "test-doc-id"},
        model_class=DocumentReference,
        return_deleted=True,
    )

    assert isinstance(result, DocumentReference)
    assert result.id == "test-doc-id"


def test_get_item_returns_none_when_filters_do_not_match(
    service,
    preliminary_dynamo_item_dict,
):
    service.filter_item.return_value = False
    service.dynamo_service.get_item.return_value = preliminary_dynamo_item_dict

    result = service._get_item(
        table_name="dev_COREDocumentMetadata",
        key={"ID": "test-doc-id"},
        model_class=DocumentReference,
    )

    assert result is None
    service.dynamo_service.get_item.assert_called_once()


def test_get_item_validation_error_returns_none(service):
    # invalid doc (id must be string)
    service.dynamo_service.get_item.return_value = {"Item": {"ID": None}}

    result = service._get_item(
        table_name="table",
        key={"ID": "123"},
        model_class=DocumentReference,
    )

    assert result is None
