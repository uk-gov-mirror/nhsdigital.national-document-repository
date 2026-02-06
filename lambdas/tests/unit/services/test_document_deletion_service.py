from unittest.mock import call

import pytest
from enums.document_retention import DocumentRetentionDays
from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCodes
from enums.supported_document_types import SupportedDocumentTypes
from models.document_reference import DocumentReference
from services.document_deletion_service import DocumentDeletionService
from tests.unit.conftest import (
    MOCK_BUCKET,
    MOCK_CLIENT_ERROR,
    MOCK_LG_TABLE_NAME,
    NRL_SQS_URL,
    TEST_FILE_KEY,
    TEST_NHS_NUMBER,
)
from tests.unit.helpers.data.dynamo.dynamo_stream import MOCK_OLD_IMAGE_MODEL
from tests.unit.helpers.data.test_documents import (
    create_test_doc_store_refs,
    create_test_lloyd_george_doc_store_refs,
)
from utils.common_query_filters import NotDeleted
from utils.exceptions import DocumentServiceException
from utils.lambda_exceptions import DocumentDeletionServiceException

from lambdas.tests.unit.helpers.data.test_stitch_trace import get_list_test_stitch_trace

TEST_DOC_STORE_REFERENCES = create_test_doc_store_refs()
TEST_LG_DOC_STORE_REFERENCES = create_test_lloyd_george_doc_store_refs()
TEST_STITCH_TRACE_REFERENCES = get_list_test_stitch_trace()
TEST_NHS_NUMBER_WITH_NO_RECORD = "1234567890"
TEST_NHS_NUMBER_WITH_ONLY_LG_RECORD = "234567890"


def mocked_document_query(
    nhs_number: str, doc_type: SupportedDocumentTypes, filter_expression
):
    if nhs_number == TEST_NHS_NUMBER and doc_type == SupportedDocumentTypes.LG:
        return TEST_LG_DOC_STORE_REFERENCES
    elif nhs_number == TEST_NHS_NUMBER and doc_type == SupportedDocumentTypes.ARF:
        return TEST_DOC_STORE_REFERENCES
    elif (
        nhs_number == TEST_NHS_NUMBER_WITH_ONLY_LG_RECORD
        and doc_type == SupportedDocumentTypes.LG
    ):
        return TEST_LG_DOC_STORE_REFERENCES
    return []


@pytest.fixture
def mock_deletion_service(set_env, mocker):
    mocker.patch("services.document_deletion_service.DocumentService")
    mocker.patch("services.document_deletion_service.LloydGeorgeStitchJobService")
    mocker.patch("services.document_deletion_service.SQSService")
    yield DocumentDeletionService()


@pytest.fixture
def mock_delete_specific_doc_type(mocker):
    def mocked_method(nhs_number: str, doc_type: SupportedDocumentTypes):
        filter_expression = None
        return mocked_document_query(nhs_number, doc_type, filter_expression)

    yield mocker.patch.object(
        DocumentDeletionService,
        "delete_specific_doc_type",
        side_effect=mocked_method,
    )


@pytest.fixture
def mock_document_query(mocker):
    yield mocker.patch(
        "services.document_service.DocumentService.fetch_available_document_references_by_type",
        side_effect=mocked_document_query,
    )


@pytest.fixture
def mock_delete_document_object(mocker, mock_deletion_service):
    yield mocker.patch.object(
        mock_deletion_service.document_service,
        "delete_document_object",
    )


@pytest.fixture
def mock_delete_unstitched_document_reference(mocker, mock_deletion_service):
    yield mocker.patch.object(
        mock_deletion_service, "delete_unstitched_document_reference"
    )


@pytest.fixture
def mock_fetch_documents_with_nhs_number(mocker, mock_deletion_service):
    yield mocker.patch.object(
        mock_deletion_service.document_service,
        "fetch_documents_from_table_with_nhs_number",
    )


@pytest.fixture
def mock_get_documents_references_in_storage(mocker, mock_deletion_service):
    yield mocker.patch.object(
        mock_deletion_service, "get_documents_references_in_storage"
    )


@pytest.fixture
def mock_delete_documents_references_in_stitch_table(mocker, mock_deletion_service):
    return mocker.patch.object(
        mock_deletion_service, "delete_documents_references_in_stitch_table"
    )


def test_handle_delete_for_all_doc_type(
    mock_delete_specific_doc_type,
    mock_deletion_service,
    mock_delete_documents_references_in_stitch_table,
    mock_delete_unstitched_document_reference,
):
    expected = TEST_LG_DOC_STORE_REFERENCES

    actual = mock_deletion_service.handle_reference_delete(
        TEST_NHS_NUMBER, [SupportedDocumentTypes.LG]
    )

    assert expected == actual

    assert mock_delete_specific_doc_type.call_count == 1
    mock_delete_specific_doc_type.assert_any_call(
        TEST_NHS_NUMBER, SupportedDocumentTypes.LG
    )

    mock_delete_unstitched_document_reference.assert_called()


def test_handle_delete_for_doc_id(
    mock_delete_specific_doc_type,
    mock_deletion_service,
    mock_delete_documents_references_in_stitch_table,
    mock_delete_unstitched_document_reference,
    mocker,
):
    expected_document_id = "mock_document_id"

    mocked_document_reference = DocumentReference(
        id=expected_document_id,
        file_location="https://example.com/mocked_file_location",
        file_name="mock_file_name",
        nhs_number=TEST_NHS_NUMBER,
    )

    mocked_document_service = mock_deletion_service.document_service
    mocked_document_service.fetch_documents_from_table.return_value = [
        mocked_document_reference
    ]

    actual = mock_deletion_service.handle_reference_delete(
        TEST_NHS_NUMBER, [], expected_document_id
    )

    assert [expected_document_id] == actual

    mock_delete_unstitched_document_reference.assert_not_called()
    mock_delete_specific_doc_type.assert_not_called()
    mock_delete_documents_references_in_stitch_table.assert_not_called()

    mocked_document_service.fetch_documents_from_table.assert_called_with(
        search_condition=expected_document_id,
        search_key="ID",
        model_class=DocumentReference,
    )

    mocked_document_service.delete_document_references.assert_called_with(
        table_name=mocked_document_service.table_name,
        document_references=[mocked_document_reference],
        document_ttl_days=DocumentRetentionDays.SOFT_DELETE,
    )


def test_handle_delete_all_doc_type_when_only_lg_records_available(
    mock_delete_specific_doc_type,
    mock_deletion_service,
    mock_delete_documents_references_in_stitch_table,
    mock_delete_unstitched_document_reference,
):
    nhs_number = TEST_NHS_NUMBER_WITH_ONLY_LG_RECORD

    expected = TEST_LG_DOC_STORE_REFERENCES
    actual = mock_deletion_service.handle_reference_delete(
        nhs_number, [SupportedDocumentTypes.LG]
    )

    assert expected == actual

    assert mock_delete_specific_doc_type.call_count == 1
    mock_delete_specific_doc_type.assert_any_call(nhs_number, SupportedDocumentTypes.LG)

    mock_delete_unstitched_document_reference.assert_called()


@pytest.mark.parametrize(
    ["doc_type", "expected"],
    [
        (SupportedDocumentTypes.LG, TEST_LG_DOC_STORE_REFERENCES),
    ],
)
def test_handle_delete_for_one_doc_type(
    doc_type,
    expected,
    mock_delete_specific_doc_type,
    mock_deletion_service,
    mock_delete_documents_references_in_stitch_table,
):
    actual = mock_deletion_service.handle_reference_delete(TEST_NHS_NUMBER, [doc_type])

    assert actual == expected

    assert mock_delete_specific_doc_type.call_count == 1
    mock_delete_specific_doc_type.assert_called_with(TEST_NHS_NUMBER, doc_type)


def test_handle_delete_when_no_record_for_patient_return_empty_list(
    mock_delete_specific_doc_type,
    mock_deletion_service,
    mock_delete_documents_references_in_stitch_table,
):
    expected = []
    actual = mock_deletion_service.handle_reference_delete(
        TEST_NHS_NUMBER_WITH_NO_RECORD,
        [SupportedDocumentTypes.LG],
    )

    assert actual == expected


@pytest.mark.parametrize(
    ["doc_type", "table_name", "doc_ref"],
    [
        (SupportedDocumentTypes.LG, MOCK_LG_TABLE_NAME, TEST_LG_DOC_STORE_REFERENCES),
    ],
)
def test_delete_specific_doc_type(
    doc_type,
    table_name,
    doc_ref,
    mock_document_query,
    mock_deletion_service,
    mock_get_documents_references_in_storage,
):
    mock_get_documents_references_in_storage.return_value = doc_ref

    expected = doc_ref
    actual = mock_deletion_service.delete_specific_doc_type(TEST_NHS_NUMBER, doc_type)

    assert actual == expected

    mock_deletion_service.document_service.delete_document_references.assert_called_once_with(
        table_name=table_name,
        document_references=doc_ref,
        document_ttl_days=DocumentRetentionDays.SOFT_DELETE,
    )


@pytest.mark.parametrize(
    "doc_type",
    [SupportedDocumentTypes.LG],
)
def test_delete_specific_doc_type_when_no_record_for_given_patient(
    doc_type,
    mock_document_query,
    mock_deletion_service,
    mock_get_documents_references_in_storage,
):
    expected = []
    mock_get_documents_references_in_storage.return_value = []

    mock_deletion_service.document_service.delete_document_references.return_value = []
    actual = mock_deletion_service.delete_specific_doc_type(
        TEST_NHS_NUMBER_WITH_NO_RECORD, doc_type
    )

    assert actual == expected

    mock_deletion_service.document_service.delete_document_references.assert_not_called()


def test_delete_documents_references_in_stitch_table(mock_deletion_service):
    mock_deletion_service.stitch_service.query_stitch_trace_with_nhs_number.return_value = (
        TEST_STITCH_TRACE_REFERENCES
    )

    mock_deletion_service.delete_documents_references_in_stitch_table(TEST_NHS_NUMBER)

    mock_deletion_service.stitch_service.query_stitch_trace_with_nhs_number.assert_called_once_with(
        TEST_NHS_NUMBER
    )
    expected_calls = [
        call(
            table_name=mock_deletion_service.stitch_service.stitch_trace_table,
            key_pair={"ID": record.id},
            updated_fields={"Deleted": True},
        )
        for record in TEST_STITCH_TRACE_REFERENCES
    ]
    mock_deletion_service.document_service.dynamo_service.update_item.assert_has_calls(
        expected_calls
    )


def test_send_sqs_message_to_remove_pointer(mocker, mock_deletion_service):
    mocker.patch("uuid.uuid4", return_value="test_uuid")

    snomed = SnomedCodes.LLOYD_GEORGE.value
    expected_message_body = (
        '{{"nhs_number":"{}",'
        '"snomed_code_doc_type":{},'
        '"snomed_code_category":{},'
        '"action":"delete"}}'
    ).format(
        TEST_NHS_NUMBER,
        snomed.model_dump_json(),
        SnomedCodes.CARE_PLAN.value.model_dump_json(),
    )

    mock_deletion_service.send_sqs_message_to_remove_pointer(TEST_NHS_NUMBER, snomed)

    assert mock_deletion_service.sqs_service.send_message_fifo.call_count == 1

    mock_deletion_service.sqs_service.send_message_fifo.assert_called_with(
        group_id="NRL_delete_test_uuid",
        message_body=expected_message_body,
        queue_url=NRL_SQS_URL,
    )


def test_delete_unstitched_document_reference_called_for_LG(
    mock_deletion_service, mock_delete_unstitched_document_reference
):
    mock_deletion_service.handle_reference_delete(
        TEST_NHS_NUMBER, [SupportedDocumentTypes.LG]
    )
    mock_delete_unstitched_document_reference.assert_called()


def test_delete_unstitched_document_reference_updates_correct_dynamo_table(
    mock_deletion_service, mock_fetch_documents_with_nhs_number
):
    mock_fetch_documents_with_nhs_number.return_value = TEST_LG_DOC_STORE_REFERENCES

    mock_deletion_service.delete_unstitched_document_reference(TEST_NHS_NUMBER)
    mock_deletion_service.document_service.fetch_documents_from_table_with_nhs_number.assert_called_once_with(
        nhs_number=TEST_NHS_NUMBER,
        table="test_unstitched_lg_table",
        query_filter=NotDeleted,
    )

    mock_deletion_service.document_service.delete_document_references.assert_called_with(
        table_name="test_unstitched_lg_table",
        document_references=TEST_LG_DOC_STORE_REFERENCES,
        document_ttl_days=DocumentRetentionDays.SOFT_DELETE,
    )


def test_delete_unstitched_reference_does_not_update_empty_dynamo_result(
    mock_deletion_service, mock_fetch_documents_with_nhs_number
):
    mock_fetch_documents_with_nhs_number.return_value = []

    mock_deletion_service.delete_unstitched_document_reference(TEST_NHS_NUMBER)

    mock_deletion_service.document_service.delete_document_references.assert_not_called()


def test_delete_unstitched_reference_handles_fetch_documents_client_error(
    mock_deletion_service,
):
    mock_deletion_service.document_service.fetch_documents_from_table_with_nhs_number.side_effect = (
        MOCK_CLIENT_ERROR
    )

    with pytest.raises(DocumentDeletionServiceException) as e:
        mock_deletion_service.delete_unstitched_document_reference(TEST_NHS_NUMBER)

    assert e.value.error == LambdaError.DocDelClient


def test_delete_unstitched_reference_handles_delete_document_reference__client_error(
    mock_deletion_service,
):
    mock_deletion_service.document_service.delete_document_references.side_effect = (
        MOCK_CLIENT_ERROR
    )

    with pytest.raises(DocumentDeletionServiceException) as e:
        mock_deletion_service.delete_unstitched_document_reference(TEST_NHS_NUMBER)

    assert e.value.error == LambdaError.DocDelClient


def test_handle_object_delete_successfully_deletes_s3_object(
    mock_deletion_service, mock_delete_document_object, caplog
):
    test_reference = MOCK_OLD_IMAGE_MODEL

    expected_log_message = "Successfully deleted Document Reference S3 Object"

    mock_deletion_service.handle_object_delete(test_reference)

    mock_delete_document_object.assert_called_once_with(
        bucket=MOCK_BUCKET, key=TEST_FILE_KEY
    )
    assert expected_log_message in caplog.records[-1].msg


def test_handle_object_delete_invalid_filepath_raises_exception(
    mock_deletion_service, mock_delete_document_object
):
    test_reference = MOCK_OLD_IMAGE_MODEL
    test_reference.file_location = ""

    with pytest.raises(DocumentDeletionServiceException):
        mock_deletion_service.handle_object_delete(test_reference)
        mock_delete_document_object.assert_not_called()


def test_handle_object_delete_DocumentService_exception_raises_exception(
    mock_deletion_service, mock_delete_document_object, caplog, mocker
):
    test_reference = MOCK_OLD_IMAGE_MODEL
    test_reference.file_location = f"s3://{MOCK_BUCKET}/{TEST_FILE_KEY}"
    mock_delete_document_object.side_effect = DocumentServiceException()

    with pytest.raises(DocumentDeletionServiceException) as excinfo:
        mock_deletion_service.handle_object_delete(test_reference)

    mock_delete_document_object.assert_called_once_with(
        bucket=MOCK_BUCKET, key=TEST_FILE_KEY
    )

    assert excinfo.value.error == LambdaError.DocDelObjectFailure
    assert excinfo.value.status_code == 400


def test_handle_reference_delete_single_document_not_found_raises_exception(
    mock_deletion_service, mocker
):
    mocker.patch.object(
        mock_deletion_service.document_service,
        "fetch_document_from_table",
        return_value=[],
    )

    with pytest.raises(DocumentDeletionServiceException) as excinfo:
        mock_deletion_service.handle_reference_delete(
            "mock_nhs_number", [], "mock_document_id"
        )

    assert excinfo.value.error == LambdaError.DocDelNull
    assert excinfo.value.status_code == 404


def test_handle_reference_delete_single_document_not_found_returns_empty_list_for_fhir(
    mock_deletion_service, mocker
):
    mocker.patch.object(
        mock_deletion_service.document_service,
        "fetch_document_from_table",
        return_value=[],
    )

    result = mock_deletion_service.handle_reference_delete(
        "mock_nhs_number", [], "mock_document_id", fhir=True
    )

    assert result == []


def test_delete_specific_doc_type_client_error_raises_exception(
    mock_deletion_service, mocker
):
    mocker.patch.object(
        mock_deletion_service.document_service,
        "delete_document_references",
        side_effect=MOCK_CLIENT_ERROR,
    )

    with pytest.raises(DocumentDeletionServiceException) as excinfo:
        mock_deletion_service.delete_specific_doc_type(
            "mock_nhs_number", SupportedDocumentTypes.LG
        )

    assert excinfo.value.error == LambdaError.DocDelClient
    assert excinfo.value.status_code == 500
