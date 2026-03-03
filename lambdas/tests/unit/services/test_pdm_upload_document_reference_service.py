from unittest.mock import MagicMock, Mock, patch

import pytest
from botocore.exceptions import ClientError

from enums.infrastructure import DynamoTables
from enums.virus_scan_result import VirusScanResult
from lambdas.enums.snomed_codes import SnomedCodes
from lambdas.services.document_service import DocumentService
from models.document_reference import DocumentReference
from services.mock_virus_scan_service import MockVirusScanService
from services.upload_document_reference_service import UploadDocumentReferenceService
from tests.unit.conftest import (
    MOCK_LG_BUCKET,
    MOCK_PDM_BUCKET,
    MOCK_PDM_TABLE_NAME,
    MOCK_STAGING_STORE_BUCKET,
    WORKSPACE,
)
from utils.exceptions import DocumentServiceException, FileProcessingException
from utils.lambda_exceptions import InvalidDocTypeException


@pytest.fixture
def mock_document_reference():
    """Create a mock document reference"""
    doc_ref = Mock(spec=DocumentReference)
    doc_ref.id = "test-doc-id"
    doc_ref.nhs_number = "9000000001"
    doc_ref.s3_file_key = "original/test-key"
    doc_ref.s3_bucket_name = "original-bucket"
    doc_ref.file_location = "original-location"
    doc_ref.virus_scanner_result = None
    doc_ref.file_size = 1234567890
    doc_ref.doc_status = "uploading"
    doc_ref.version = "1"
    doc_ref._build_s3_location = Mock(
        return_value="s3://test-lg-bucket/9000000001/test-doc-id",
    )
    return doc_ref


@pytest.fixture
def mock_virus_scan_service(
    mocker,
):
    mock = mocker.patch(
        "services.upload_document_reference_service.get_virus_scan_service",
    )
    yield mock


@pytest.fixture
def service(set_env, mock_virus_scan_service):
    with patch.multiple(
        "services.upload_document_reference_service",
        DocumentService=Mock(),
        DynamoDBService=Mock(),
        S3Service=Mock(),
    ):
        service = UploadDocumentReferenceService()
        service.document_service = Mock()
        service.dynamo_service = Mock()
        service.virus_scan_service = MockVirusScanService()
        service.s3_service = Mock()
        return service


@pytest.fixture
def mock_pdm_document_reference():
    """Create a mock document reference"""
    doc_ref = Mock(spec=DocumentReference)
    doc_ref.id = "test-doc-id"
    doc_ref.nhs_number = "9000000001"
    doc_ref.s3_file_key = (
        f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/9000000001/test-doc-id"
    )
    doc_ref.s3_bucket_name = "test-staging-bucket"
    doc_ref.virus_scanner_result = None
    doc_ref.file_size = 1234567890
    doc_ref.doc_status = "uploading"
    doc_ref._build_s3_location = Mock(
        return_value=f"s3://test-staging-bucket/fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/9000000001/test-doc-id",
    )
    return doc_ref


@pytest.fixture
def dynamo_item_dict():
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
def pdm_document_reference():
    return DocumentReference(
        id="test-doc-id",
        nhs_number="9000000001",
        s3_file_key=f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/9000000001/test-doc-id",
        s3_bucket_name="test-staging-bucket",
        file_size=1234567890,
        doc_status="preliminary",
        status="current",
        file_name=None,
        author=None,
        content_type="application/pdf",
        created="2026-03-03T16:10:10.165878Z",
        document_scan_creation="2026-03-03",
        document_snomed_code_type="16521000000101",
        file_location="s3://test-staging-bucket/9000000001/test-doc-id",
        last_updated=1772554210,
        raw_request=None,
        s3_version_id=None,
        s3_upload_key="9000000001/test-doc-id",
        ttl=None,
        version="1",
    )


@pytest.fixture
def pdm_service(set_env, mock_virus_scan_service):
    service = UploadDocumentReferenceService()
    service.dynamo_service = MagicMock()
    service.virus_scan_service = MockVirusScanService()
    service.s3_service = MagicMock()
    service.table_name = "dev_COREDocumentMetadata"
    service.destination_bucket_name = MOCK_PDM_BUCKET
    service.doc_type = SnomedCodes.PATIENT_DATA.value
    service.document_service = DocumentService()
    service.document_service.dynamo_service = service.dynamo_service
    return service


def test_handle_upload_document_reference_request_with_empty_object_key(pdm_service):
    """Test handling of an empty object key"""
    result = pdm_service.handle_upload_document_reference_request("", 122)
    assert result is None


def test_handle_upload_document_reference_request_with_none_object_key(pdm_service):
    """Test handling of a None object key"""
    result = pdm_service.handle_upload_document_reference_request(None, 122)
    assert result is None


def test_handle_upload_document_reference_request_success(
    pdm_service,
    dynamo_item_dict,
    mocker,
):
    """Test successful handling of the upload document reference request"""
    object_key = (
        f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/9000000001/test-doc-id"
    )
    object_size = dynamo_item_dict["Item"]["file_size"]

    pdm_service.dynamo_service.get_item.return_value = {
        "Item": dynamo_item_dict["Item"],
    }
    pdm_service.virus_scan_service.scan_file = mocker.MagicMock(
        return_value=VirusScanResult.CLEAN,
    )

    pdm_service.handle_upload_document_reference_request(object_key, object_size)
    pdm_service.s3_service.copy_across_bucket.assert_called_once()
    pdm_service.s3_service.delete_object.assert_called_once()
    pdm_service.virus_scan_service.scan_file.assert_called_once()


def test_handle_upload_document_reference_with_no_object_key(pdm_service):
    object_key = ""
    result = pdm_service.handle_upload_document_reference_request(object_key=object_key)
    assert result is None


def test_fetch_preliminary_document_reference_success(
    pdm_service,
    dynamo_item_dict,
    pdm_document_reference,
    mocker,
):
    """Test successful document reference fetching"""
    spy = mocker.spy(pdm_service.document_service, "get_item")
    document_key = dynamo_item_dict["Item"]["id"]
    pdm_service.dynamo_service.get_item.return_value = {
        "Item": dynamo_item_dict["Item"],
    }

    result = pdm_service._fetch_preliminary_document_reference(
        document_key=document_key,
    )
    assert isinstance(result, DocumentReference)
    assert result.id == pdm_document_reference.id
    spy.assert_called_once_with(
        document_id=document_key,
        table_name=f"dev_{MOCK_PDM_TABLE_NAME}",
        return_deleted=False,
        filters=[{"doc_status": "preliminary"}],
    )


def test_fetch_preliminary_document_reference_no_documents_found(pdm_service):
    """Test handling when no documents are found"""
    document_key = "test-doc-id"
    pdm_service.dynamo_service.get_item.return_value = {}

    result = pdm_service._fetch_preliminary_document_reference(
        document_key=document_key,
    )

    assert result is None


def test_fetch_preliminary_document_reference_exception(pdm_service, dynamo_item_dict):
    """Test handling of exceptions during document fetching"""
    document_key = dynamo_item_dict["Item"]["id"]
    pdm_service.dynamo_service.get_item.side_effect = (
        ClientError({"error": "test error message"}, "test"),
    )

    with pytest.raises(DocumentServiceException):
        pdm_service._fetch_preliminary_document_reference(
            document_key=document_key,
        )


def test__process_preliminary_document_reference_clean_virus_scan(
    pdm_service,
    mock_pdm_document_reference,
    mocker,
):
    """Test processing document reference with a clean virus scan"""
    object_key = "12345/test-doc-id"

    mocker.patch.object(
        pdm_service,
        "_perform_virus_scan",
        return_value=VirusScanResult.CLEAN,
    )
    mock_process_clean = mocker.patch.object(pdm_service, "_process_clean_document")
    mock_finalize_transaction = mocker.patch.object(
        pdm_service,
        "_finalize_and_supersede_with_transaction",
    )
    mock_delete = mocker.patch.object(pdm_service, "delete_file_from_staging_bucket")

    pdm_service._process_preliminary_document_reference(
        mock_pdm_document_reference,
        object_key,
        1222,
    )

    mock_process_clean.assert_called_once()
    mock_finalize_transaction.assert_not_called()
    assert mock_pdm_document_reference.doc_status == "final"
    assert mock_pdm_document_reference.uploaded is True
    assert mock_pdm_document_reference.uploading is False
    mock_delete.assert_called_once()


def test__process_preliminary_document_reference_infected_virus_scan(
    pdm_service,
    mock_pdm_document_reference,
    mocker,
):
    """Test processing document reference with an infected virus scan"""
    object_key = "staging/test-doc-id"

    mocker.patch.object(
        pdm_service,
        "_perform_virus_scan",
        return_value=VirusScanResult.INFECTED,
    )
    mock_delete = mocker.patch.object(pdm_service, "delete_file_from_staging_bucket")

    mock_process_clean = mocker.patch.object(pdm_service, "_process_clean_document")
    mock_update_dynamo = mocker.patch.object(pdm_service, "_update_dynamo_table")
    pdm_service._process_preliminary_document_reference(
        mock_pdm_document_reference,
        object_key,
        1222,
    )

    mock_process_clean.assert_not_called()
    mock_update_dynamo.assert_called_once()
    mock_delete.assert_called_once()


def test_perform_virus_scan_returns_clean_hardcoded(
    pdm_service,
    mock_pdm_document_reference,
):
    """Test virus scan returns hardcoded CLEAN result"""
    object_key = "staging/test-doc-id"
    result = pdm_service._perform_virus_scan(mock_pdm_document_reference, object_key)
    assert result == VirusScanResult.CLEAN


def test_perform_virus_scan_exception_returns_infected(
    pdm_service,
    mock_document_reference,
    mocker,
):
    """Test virus scan exception handling returns INFECTED for safety"""
    mock_virus_service = mocker.patch.object(pdm_service, "virus_scan_service")
    mock_virus_service.scan_file.side_effect = Exception("Scan error")
    object_key = "staging/test-doc-id"

    result = pdm_service._perform_virus_scan(mock_document_reference, object_key)

    assert result == VirusScanResult.ERROR


def test_process_clean_document_success(pdm_service, mock_document_reference, mocker):
    """Test successful processing of a clean document"""
    object_key = "staging/test-doc-id"

    mock_copy = mocker.patch.object(pdm_service, "copy_files_from_staging_bucket")

    pdm_service._process_clean_document(
        mock_document_reference,
        object_key,
    )

    mock_copy.assert_called_once_with(mock_document_reference, object_key)


def test_process_clean_document_exception_restores_original_values(
    pdm_service,
    mock_document_reference,
    mocker,
):
    """Test that original values are restored when processing fails"""
    object_key = "staging/test-doc-id"
    original_s3_key = "original/test-key"
    original_bucket = "original-bucket"
    original_location = "original-location"

    mocker.patch.object(
        pdm_service,
        "copy_files_from_staging_bucket",
        side_effect=Exception("Copy failed"),
    )
    with pytest.raises(FileProcessingException):
        pdm_service._process_clean_document(
            mock_document_reference,
            object_key,
        )

    assert mock_document_reference.s3_file_key == original_s3_key
    assert mock_document_reference.s3_bucket_name == original_bucket
    assert mock_document_reference.file_location == original_location
    assert mock_document_reference.doc_status == "cancelled"


def test_copy_files_from_staging_bucket_success(
    pdm_service,
    mock_pdm_document_reference,
):
    """Test successful file copying from staging bucket"""
    source_file_key = (
        f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/9000000001/test-doc-id"
    )
    expected_dest_key = "9000000001/test-doc-id"

    pdm_service.copy_files_from_staging_bucket(
        mock_pdm_document_reference,
        source_file_key,
    )

    pdm_service.s3_service.copy_across_bucket.assert_called_once_with(
        source_bucket=MOCK_STAGING_STORE_BUCKET,
        source_file_key=source_file_key,
        dest_bucket=MOCK_PDM_BUCKET,
        dest_file_key=expected_dest_key,
    )

    assert mock_pdm_document_reference.s3_file_key == expected_dest_key
    assert mock_pdm_document_reference.s3_bucket_name == MOCK_PDM_BUCKET


def test_copy_files_from_staging_bucket_client_error(
    pdm_service,
    mock_document_reference,
):
    """Test handling of ClientError during file copying"""
    source_file_key = "staging/test-doc-id"
    client_error = ClientError(
        error_response={
            "Error": {"Code": "NoSuchBucket", "Message": "Bucket does not exist"},
        },
        operation_name="CopyObject",
    )
    pdm_service.s3_service.copy_across_bucket.side_effect = client_error

    with pytest.raises(FileProcessingException):
        pdm_service.copy_files_from_staging_bucket(
            mock_document_reference,
            source_file_key,
        )


def test_delete_file_from_staging_bucket_success(pdm_service):
    """Test successful file deletion from staging bucket"""
    source_file_key = "staging/test-doc-id"

    pdm_service.delete_file_from_staging_bucket(source_file_key)

    pdm_service.s3_service.delete_object.assert_called_once_with(
        MOCK_STAGING_STORE_BUCKET,
        source_file_key,
    )


def test_delete_pdm_file_from_staging_bucket_success(pdm_service):
    """Test successful file deletion from staging bucket"""
    source_file_key = (
        f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/staging/test-doc-id"
    )

    pdm_service.delete_file_from_staging_bucket(source_file_key)

    pdm_service.s3_service.delete_object.assert_called_once_with(
        MOCK_STAGING_STORE_BUCKET,
        source_file_key,
    )


def test_delete_file_from_staging_bucket_client_error(pdm_service):
    """Test handling of ClientError during file deletion"""
    source_file_key = "staging/test-doc-id"
    client_error = ClientError(
        error_response={
            "Error": {"Code": "NoSuchKey", "Message": "Key does not exist"},
        },
        operation_name="DeleteObject",
    )
    pdm_service.s3_service.delete_object.side_effect = client_error

    # Should not raise exception, just log the error
    try:
        pdm_service.delete_file_from_staging_bucket(source_file_key)
    except Exception as e:
        assert False, f"Unexpected exception: {e}"


def test_update_dynamo_table_clean_scan_result(
    pdm_service,
    mock_pdm_document_reference,
    mocker,
):
    spy = mocker.spy(pdm_service.document_service, "update_document")
    """Test updating DynamoDB table with a clean scan result"""
    pdm_service._update_dynamo_table(mock_pdm_document_reference)
    spy.assert_called_once_with(
        table_name=f"{WORKSPACE}_{MOCK_PDM_TABLE_NAME}",
        key_pair={"ID": "test-doc-id"},
        document=mock_pdm_document_reference,
        update_fields_name={
            "virus_scanner_result",
            "doc_status",
            "file_location",
            "file_size",
            "uploaded",
            "uploading",
            "s3_file_key",
        },
    )


def test_update_dynamo_table_infected_scan_result(
    pdm_service,
    mock_document_reference,
    mocker,
):
    """Test updating DynamoDB table with an infected scan result"""
    spy = mocker.spy(pdm_service.document_service, "update_document")
    pdm_service._update_dynamo_table(mock_document_reference)

    spy.assert_called_once()


def test_update_dynamo_table_client_error(pdm_service, pdm_document_reference, mocker):
    """Test handling of ClientError during DynamoDB update"""
    client_error = ClientError(
        error_response={
            "Error": {
                "Code": "ResourceNotFoundException",
                "Message": "Table not found",
            },
        },
        operation_name="UpdateItem",
    )
    pdm_service.document_service = MagicMock()
    pdm_service.document_service.update_document.side_effect = client_error

    with pytest.raises(DocumentServiceException):
        pdm_service._update_dynamo_table(pdm_document_reference)


def test_handle_upload_document_reference_request_no_document_found(pdm_service):
    """Test handling when no preliminary document is found in database"""
    object_key = "staging/test-doc-id"
    object_size = 1234

    pdm_service.dynamo_service.get_item.return_value = {}

    result = pdm_service.handle_upload_document_reference_request(
        object_key,
        object_size,
    )

    assert result is None


def test_process_preliminary_document_reference_exception_during_processing(
    pdm_service,
    mock_document_reference,
    mocker,
):
    """Test that exceptions during processing are properly raised"""
    object_key = "staging/test-doc-id"

    mocker.patch.object(
        pdm_service,
        "_perform_virus_scan",
        return_value=VirusScanResult.CLEAN,
    )
    mocker.patch.object(
        pdm_service,
        "_process_clean_document",
        side_effect=Exception("Processing failed"),
    )

    with pytest.raises(Exception) as exc_info:
        pdm_service._process_preliminary_document_reference(
            mock_document_reference,
            object_key,
            1222,
        )

    assert "Processing failed" in str(exc_info.value)


def test_get_infrastructure_for_document_key_pdm(service):
    assert service.table_name == ""
    assert service.destination_bucket_name == MOCK_LG_BUCKET
    service._get_infrastructure_for_document_key(
        object_parts=["fhir_upload", SnomedCodes.PATIENT_DATA.value.code, "1234"],
    )
    assert service.table_name == str(DynamoTables.CORE)
    assert service.destination_bucket_name == MOCK_PDM_BUCKET


def test_get_infrastructure_for_document_key_non_pdm(service):
    assert service.table_name == ""
    infra = service._get_infrastructure_for_document_key(object_parts=["1234", "123"])
    assert service.table_name == str(DynamoTables.LLOYD_GEORGE)
    assert infra is None


def test_get_infra_invalid_doc_type(monkeypatch, service):
    # Create a fake doc_type object
    fake_doc_type = Mock()
    fake_doc_type.code = "999999"
    fake_doc_type.display_name = "Fake Doc"

    # Mock SnomedCodes.find_by_code so doc_type is NOT None
    monkeypatch.setattr(
        "services.upload_document_reference_service.SnomedCodes.find_by_code",
        lambda code: fake_doc_type,
    )

    # Mock routers
    mock_table_router = Mock()
    mock_table_router.resolve.side_effect = KeyError("nope")

    mock_bucket_router = Mock()

    # Force KeyError inside the try block
    mock_table_router.resolve.side_effect = KeyError("not found")
    service.table_router = mock_table_router
    service.bucket_router = mock_bucket_router
    # Call function and assert the exception is raised
    with pytest.raises(InvalidDocTypeException):
        service._get_infrastructure_for_document_key(["fhir_upload", "999999"])


@pytest.mark.parametrize(
    "object_key,expected_table,expected_s3_bucket,expected_doctype",
    [
        (
            "staging/documents/test-doc-123",
            "dev_LloydGeorgeReferenceMetadata",
            MOCK_LG_BUCKET,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
        (
            "folder/subfolder/another-doc",
            "dev_LloydGeorgeReferenceMetadata",
            MOCK_LG_BUCKET,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
        (
            "simple-doc",
            "dev_LloydGeorgeReferenceMetadata",
            MOCK_LG_BUCKET,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
        (
            f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/staging/test-doc-123",
            "dev_COREDocumentMetadata",
            MOCK_PDM_BUCKET,
            SnomedCodes.PATIENT_DATA.value,
        ),
        (
            f"{SnomedCodes.LLOYD_GEORGE.value.code}/staging/test-doc-123",
            "dev_LloydGeorgeReferenceMetadata",
            MOCK_LG_BUCKET,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
        (
            f"fhir_upload/{SnomedCodes.LLOYD_GEORGE.value.code}/staging/test-doc-123",
            "dev_LloydGeorgeReferenceMetadata",
            MOCK_LG_BUCKET,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
    ],
)
def test_document_type_extraction_from_object_key(
    service,
    object_key,
    expected_table,
    expected_s3_bucket,
    expected_doctype,
):
    """Test extraction of a document key from various object key formats"""
    service.handle_upload_document_reference_request(object_key)
    assert service.table_name == expected_table
    assert service.destination_bucket_name == expected_s3_bucket
    assert service.doc_type.code == expected_doctype.code


def test_copy_files_from_staging_bucket_to_pdm_success(
    pdm_service,
    dynamo_item_dict,
    pdm_document_reference,
    mocker,
):
    """Test successful file copying from staging bucket"""
    source_file_key = dynamo_item_dict["Item"]["s3_file_key"]
    expected_dest_key = (
        f"{pdm_document_reference.nhs_number}/{pdm_document_reference.id}"
    )
    pdm_service.copy_files_from_staging_bucket(
        pdm_document_reference,
        source_file_key,
    )
    pdm_service.s3_service.copy_across_bucket.assert_called_once_with(
        source_bucket=MOCK_STAGING_STORE_BUCKET,
        source_file_key=source_file_key,
        dest_bucket=MOCK_PDM_BUCKET,
        dest_file_key=expected_dest_key,
    )

    assert pdm_document_reference.s3_file_key == expected_dest_key
    assert pdm_document_reference.s3_bucket_name == MOCK_PDM_BUCKET
