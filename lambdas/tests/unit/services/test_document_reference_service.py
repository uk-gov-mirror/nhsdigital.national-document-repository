from datetime import datetime
from unittest.mock import MagicMock

import pytest
from enums.supported_document_types import SupportedDocumentTypes
from freezegun import freeze_time
from models.document_reference import DocumentReference
from services.document_reference_service import DocumentReferenceService
from tests.unit.conftest import (
    MOCK_ARF_BUCKET,
    MOCK_ARF_TABLE_NAME,
    MOCK_LG_BUCKET,
    MOCK_LG_TABLE_NAME,
    TEST_CURRENT_GP_ODS,
    TEST_NHS_NUMBER,
)
from tests.unit.helpers.data.test_documents import (
    create_test_lloyd_george_doc_store_refs,
)
from utils.exceptions import FileUploadInProgress, NoAvailableDocument

MOCK_UPDATE_TIME = "2024-01-15 10:30:00"
NEW_ODS_CODE = "Z98765"


@pytest.fixture
def mock_lg_service(set_env, mocker):
    """Fixture to create a DocumentReferenceService for Lloyd George documents."""
    mocker.patch("services.document_service.S3Service")
    mocker.patch("services.document_service.DynamoDBService")
    service = DocumentReferenceService(doc_type=SupportedDocumentTypes.LG)
    yield service


@pytest.fixture
def mock_arf_service(set_env, mocker):
    """Fixture to create a DocumentReferenceService for ARF documents."""
    mocker.patch("services.document_service.S3Service")
    mocker.patch("services.document_service.DynamoDBService")
    service = DocumentReferenceService(doc_type=SupportedDocumentTypes.ARF)
    yield service


@pytest.fixture
def mock_document_references():
    """Create a list of mock document references."""
    docs = []
    for i in range(3):
        doc = MagicMock(spec=DocumentReference)
        doc.id = f"doc-id-{i}"
        doc.nhs_number = TEST_NHS_NUMBER
        doc.current_gp_ods = TEST_CURRENT_GP_ODS
        doc.custodian = TEST_CURRENT_GP_ODS
        doc.uploaded = True
        doc.uploading = False
        docs.append(doc)
    return docs


def test_table_name_returns_lg_table(mock_lg_service):
    """Test that table_name property returns correct table for LG documents."""
    assert mock_lg_service.table_name == MOCK_LG_TABLE_NAME


def test_table_name_returns_arf_table(mock_arf_service):
    """Test that table_name property returns correct table for ARF documents."""
    assert mock_arf_service.table_name == MOCK_ARF_TABLE_NAME


def test_model_class_returns_document_reference(mock_lg_service):
    """Test that the model_class property returns DocumentReference."""
    assert mock_lg_service.model_class == DocumentReference


def test_s3_bucket_returns_lg_bucket(mock_lg_service):
    """Test that s3_bucket property returns the correct bucket for LG documents."""
    assert mock_lg_service.s3_bucket == MOCK_LG_BUCKET


def test_s3_bucket_returns_arf_bucket(mock_arf_service):
    """Test that s3_bucket property returns the correct bucket for ARF documents."""
    assert mock_arf_service.s3_bucket == MOCK_ARF_BUCKET


def test_returns_available_documents_when_uploaded(mock_lg_service, mocker):
    """Test that available documents are returned when they are uploaded."""
    mock_filter = mocker.patch(
        "services.document_reference_service.filter_uploaded_docs_and_recently_uploading_docs"
    )
    mock_filter.return_value = MagicMock()

    mock_docs = create_test_lloyd_george_doc_store_refs(
        override={"uploaded": True, "uploading": False}
    )

    mocker.patch.object(
        mock_lg_service,
        "fetch_documents_from_table_with_nhs_number",
        return_value=mock_docs,
    )

    result = mock_lg_service.get_available_lloyd_george_record_for_patient(
        TEST_NHS_NUMBER
    )

    assert result == mock_docs
    assert len(result) == 3
    mock_lg_service.fetch_documents_from_table_with_nhs_number.assert_called_once_with(
        TEST_NHS_NUMBER, query_filter=mock_filter.return_value
    )


def test_raises_no_available_document_when_no_docs_found(mock_lg_service, mocker):
    """Test that NoAvailableDocument is raised when no documents are found."""
    mock_filter = mocker.patch(
        "services.document_reference_service.filter_uploaded_docs_and_recently_uploading_docs"
    )
    mock_filter.return_value = MagicMock()

    mocker.patch.object(
        mock_lg_service,
        "fetch_documents_from_table_with_nhs_number",
        return_value=[],
    )

    with pytest.raises(NoAvailableDocument):
        mock_lg_service.get_available_lloyd_george_record_for_patient(TEST_NHS_NUMBER)


def test_raises_file_upload_in_progress_when_document_uploading(
    mock_lg_service, mocker
):
    """Test that FileUploadInProgress is raised when a document is being uploaded."""
    mock_filter = mocker.patch(
        "services.document_reference_service.filter_uploaded_docs_and_recently_uploading_docs"
    )
    mock_filter.return_value = MagicMock()

    mock_docs = create_test_lloyd_george_doc_store_refs(
        override={"uploaded": False, "uploading": True}
    )

    mocker.patch.object(
        mock_lg_service,
        "fetch_documents_from_table_with_nhs_number",
        return_value=mock_docs,
    )

    with pytest.raises(FileUploadInProgress) as exc_info:
        mock_lg_service.get_available_lloyd_george_record_for_patient(TEST_NHS_NUMBER)

    assert "in the process of being uploaded" in str(exc_info.value).lower()


def test_returns_documents_when_uploaded_and_not_uploading(mock_lg_service, mocker):
    """Test that documents are returned when uploaded is True and uploading is False."""
    mock_filter = mocker.patch(
        "services.document_reference_service.filter_uploaded_docs_and_recently_uploading_docs"
    )
    mock_filter.return_value = MagicMock()

    mock_docs = create_test_lloyd_george_doc_store_refs(
        override={"uploaded": True, "uploading": False}
    )

    mocker.patch.object(
        mock_lg_service,
        "fetch_documents_from_table_with_nhs_number",
        return_value=mock_docs,
    )

    result = mock_lg_service.get_available_lloyd_george_record_for_patient(
        TEST_NHS_NUMBER
    )

    assert len(result) == 3
    for doc in result:
        assert doc.uploaded is True
        assert doc.uploading is False


@freeze_time(MOCK_UPDATE_TIME)
def test_updates_all_documents_with_different_ods_code(
    mock_lg_service, mock_document_references, mocker
):
    """Test that all documents are updated when ODS code differs."""
    mock_update = mocker.patch.object(mock_lg_service, "update_document")

    mock_lg_service.update_patient_ods_code(mock_document_references, NEW_ODS_CODE)

    # Verify all documents were updated
    assert mock_update.call_count == 3

    # Verify each document's fields were changed
    for doc in mock_document_references:
        assert doc.current_gp_ods == NEW_ODS_CODE
        assert doc.custodian == NEW_ODS_CODE
        assert doc.last_updated == int(
            datetime.fromisoformat(MOCK_UPDATE_TIME).timestamp()
        )

    # Verify update_document was called with the correct parameters
    for doc in mock_document_references:
        mock_update.assert_any_call(
            document=doc,
            update_fields_name={"current_gp_ods", "custodian", "last_updated"},
        )


def test_returns_early_when_no_documents_provided(mock_lg_service, mocker):
    """Test that method returns early when an empty list is provided."""
    mock_update = mocker.patch.object(mock_lg_service, "update_document")

    mock_lg_service.update_patient_ods_code([], NEW_ODS_CODE)

    mock_update.assert_not_called()


@freeze_time(MOCK_UPDATE_TIME)
def test_does_not_update_when_ods_codes_already_match(
    mock_lg_service, mock_document_references, mocker
):
    """Test that documents are not updated when ODS codes already match."""
    mock_update = mocker.patch.object(mock_lg_service, "update_document")

    # Set all documents to already have the new ODS code
    for doc in mock_document_references:
        doc.current_gp_ods = NEW_ODS_CODE
        doc.custodian = NEW_ODS_CODE

    mock_lg_service.update_patient_ods_code(mock_document_references, NEW_ODS_CODE)

    # Verify update_document was not called
    mock_update.assert_not_called()


@freeze_time(MOCK_UPDATE_TIME)
def test_updates_when_only_current_gp_ods_differs(
    mock_lg_service, mock_document_references, mocker
):
    """Test that documents are updated when only current_gp_ods differs."""
    mock_update = mocker.patch.object(mock_lg_service, "update_document")

    # Set custodian to match but current_gp_ods to differ
    for doc in mock_document_references:
        doc.current_gp_ods = TEST_CURRENT_GP_ODS
        doc.custodian = NEW_ODS_CODE

    mock_lg_service.update_patient_ods_code(mock_document_references, NEW_ODS_CODE)

    # Verify all documents were updated
    assert mock_update.call_count == 3

    # Verify both fields are now updated
    for doc in mock_document_references:
        assert doc.current_gp_ods == NEW_ODS_CODE
        assert doc.custodian == NEW_ODS_CODE


@freeze_time(MOCK_UPDATE_TIME)
def test_updates_when_only_custodian_differs(
    mock_lg_service, mock_document_references, mocker
):
    """Test that documents are updated when only custodian differs."""
    mock_update = mocker.patch.object(mock_lg_service, "update_document")

    # Set current_gp_ods to match but custodian to differ
    for doc in mock_document_references:
        doc.current_gp_ods = NEW_ODS_CODE
        doc.custodian = TEST_CURRENT_GP_ODS

    mock_lg_service.update_patient_ods_code(mock_document_references, NEW_ODS_CODE)

    # Verify all documents were updated
    assert mock_update.call_count == 3

    # Verify both fields are now updated
    for doc in mock_document_references:
        assert doc.current_gp_ods == NEW_ODS_CODE
        assert doc.custodian == NEW_ODS_CODE


@freeze_time(MOCK_UPDATE_TIME)
def test_updates_single_document(mock_lg_service, mocker):
    """Test updating a single document."""
    mock_update = mocker.patch.object(mock_lg_service, "update_document")

    single_doc = MagicMock(spec=DocumentReference)
    single_doc.id = "single-doc-id"
    single_doc.current_gp_ods = TEST_CURRENT_GP_ODS
    single_doc.custodian = TEST_CURRENT_GP_ODS

    mock_lg_service.update_patient_ods_code([single_doc], NEW_ODS_CODE)

    assert single_doc.current_gp_ods == NEW_ODS_CODE
    assert single_doc.custodian == NEW_ODS_CODE
    assert single_doc.last_updated == int(
        datetime.fromisoformat(MOCK_UPDATE_TIME).timestamp()
    )

    mock_update.assert_called_once_with(
        document=single_doc,
        update_fields_name={"current_gp_ods", "custodian", "last_updated"},
    )


@freeze_time(MOCK_UPDATE_TIME)
def test_updates_mixed_documents_some_matching(
    mock_lg_service, mock_document_references, mocker
):
    """Test updating documents where some already have correct ODS code."""
    mock_update = mocker.patch.object(mock_lg_service, "update_document")

    # Set the first document to already have new ODS code
    mock_document_references[0].current_gp_ods = NEW_ODS_CODE
    mock_document_references[0].custodian = NEW_ODS_CODE

    mock_lg_service.update_patient_ods_code(mock_document_references, NEW_ODS_CODE)

    # Verify only 2 documents were updated (not the first one)
    assert mock_update.call_count == 2

    # Verify the correct documents were updated
    mock_update.assert_any_call(
        document=mock_document_references[1],
        update_fields_name={"current_gp_ods", "custodian", "last_updated"},
    )
    mock_update.assert_any_call(
        document=mock_document_references[2],
        update_fields_name={"current_gp_ods", "custodian", "last_updated"},
    )


def test_logs_update_message(mock_lg_service, mock_document_references, mocker):
    """Test that logging is performed during an update."""
    mocker.patch.object(mock_lg_service, "update_document")
    mock_logger = mocker.patch("services.document_reference_service.logger")

    mock_lg_service.update_patient_ods_code(mock_document_references, NEW_ODS_CODE)

    # Verify logging was called for each document that needed updating
    assert mock_logger.info.call_count == 3
    mock_logger.info.assert_any_call("Updating patient document reference...")


def test_initialisation_with_default_lg_type(set_env, mocker):
    """Test that the service initialises with LG type by default."""
    mocker.patch("services.document_service.S3Service")
    mocker.patch("services.document_service.DynamoDBService")

    service = DocumentReferenceService()

    assert service.doc_type == SupportedDocumentTypes.LG
    assert service.table_name == MOCK_LG_TABLE_NAME
    assert service.s3_bucket == MOCK_LG_BUCKET


def test_initialisation_with_arf_type(set_env, mocker):
    """Test that the service initialises correctly with an ARF type."""
    mocker.patch("services.document_service.S3Service")
    mocker.patch("services.document_service.DynamoDBService")

    service = DocumentReferenceService(doc_type=SupportedDocumentTypes.ARF)

    assert service.doc_type == SupportedDocumentTypes.ARF
    assert service.table_name == MOCK_ARF_TABLE_NAME
    assert service.s3_bucket == MOCK_ARF_BUCKET
