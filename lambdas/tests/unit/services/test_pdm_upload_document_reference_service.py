from unittest.mock import Mock, patch

import pytest
from botocore.exceptions import ClientError
from enums.virus_scan_result import VirusScanResult
from lambdas.enums.snomed_codes import SnomedCodes
from models.document_reference import DocumentReference
from services.mock_virus_scan_service import MockVirusScanService
from services.upload_document_reference_service import UploadDocumentReferenceService
from tests.unit.conftest import (
    MOCK_LG_BUCKET,
    MOCK_LG_TABLE_NAME,
    MOCK_STAGING_STORE_BUCKET,
    MOCK_PDM_TABLE_NAME,
    MOCK_PDM_BUCKET,
)
from utils.common_query_filters import (
    FinalOrPreliminaryAndNotSuperseded,
    PreliminaryStatus,
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
        return_value="s3://test-lg-bucket/9000000001/test-doc-id"
    )
    return doc_ref


@pytest.fixture
def mock_virus_scan_service(
    mocker,
):
    mock = mocker.patch(
        "services.upload_document_reference_service.get_virus_scan_service"
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
        return_value=f"s3://test-staging-bucket/fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/9000000001/test-doc-id"
    )
    return doc_ref


@pytest.fixture
def pdm_service(set_env, mock_virus_scan_service):
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
        service.table_name = MOCK_PDM_TABLE_NAME
        service.destination_bucket_name = MOCK_PDM_BUCKET
        service.doc_type = SnomedCodes.PATIENT_DATA.value
        return service


def test_handle_upload_document_reference_request_with_empty_object_key(pdm_service):
    """Test handling of an empty object key"""
    pdm_service.handle_upload_document_reference_request("", 122)

    pdm_service.document_service.fetch_documents_from_table.assert_not_called()


def test_handle_upload_document_reference_request_with_none_object_key(pdm_service):
    """Test handling of a None object key"""
    pdm_service.handle_upload_document_reference_request(None, 122)

    pdm_service.document_service.fetch_documents_from_table.assert_not_called()


def test_handle_upload_document_reference_request_success(
    service, mock_pdm_document_reference, mocker
):
    """Test successful handling of the upload document reference request"""
    object_key = (
        f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/9000000001/test-doc-id"
    )
    object_size = 1111

    service.document_service.fetch_documents_from_table.side_effect = [
        [mock_pdm_document_reference],
    ]
    service.virus_scan_service.scan_file = mocker.MagicMock(
        return_value=VirusScanResult.CLEAN
    )

    service.handle_upload_document_reference_request(object_key, object_size)

    service.document_service.fetch_documents_from_table.assert_called_once()
    service.s3_service.copy_across_bucket.assert_called_once()
    service.s3_service.delete_object.assert_called_once()
    service.virus_scan_service.scan_file.assert_called_once()


def test_handle_upload_document_reference_request_with_exception(pdm_service):
    """Test handling of exceptions during processing"""
    object_key = "staging/test-doc-id"

    pdm_service.document_service.fetch_documents_from_table.side_effect = Exception(
        "Test error"
    )

    pdm_service.handle_upload_document_reference_request(object_key)


def test_fetch_preliminary_document_reference_success(
    pdm_service, mock_pdm_document_reference
):
    """Test successful document reference fetching"""
    document_key = "test-doc-id"
    pdm_service.document_service.fetch_documents_from_table.return_value = [
        mock_pdm_document_reference
    ]

    result = pdm_service._fetch_preliminary_document_reference(document_key)

    assert result == mock_pdm_document_reference
    pdm_service.document_service.fetch_documents_from_table.assert_called_once_with(
        table_name=MOCK_PDM_TABLE_NAME,
        search_condition=document_key,
        search_key="ID",
        query_filter=PreliminaryStatus,
    )


def test_fetch_preliminary_document_reference_no_documents_found(pdm_service):
    """Test handling when no documents are found"""
    document_key = "test-doc-id"
    pdm_service.document_service.fetch_documents_from_table.return_value = []

    result = pdm_service._fetch_preliminary_document_reference(document_key)

    assert result is None


def test_fetch_preliminary_document_reference_multiple_documents_warning(
    pdm_service, mock_document_reference
):
    """Test handling when multiple documents are found"""
    document_key = "test-doc-id"
    mock_doc_2 = Mock(spec=DocumentReference)
    pdm_service.document_service.fetch_documents_from_table.return_value = [
        mock_document_reference,
        mock_doc_2,
    ]

    result = pdm_service._fetch_preliminary_document_reference(document_key)

    assert result == mock_document_reference


def test_fetch_preliminary_document_reference_exception(pdm_service):
    """Test handling of exceptions during document fetching"""
    document_key = "test-doc-id"
    pdm_service.document_service.fetch_documents_from_table.side_effect = (
        ClientError({"error": "test error message"}, "test"),
    )

    with pytest.raises(DocumentServiceException):
        pdm_service._fetch_preliminary_document_reference(document_key)


def test__process_preliminary_document_reference_clean_virus_scan(
    pdm_service, mock_pdm_document_reference, mocker
):
    """Test processing document reference with a clean virus scan"""
    object_key = "staging/test-doc-id"

    mocker.patch.object(
        pdm_service, "_perform_virus_scan", return_value=VirusScanResult.CLEAN
    )
    mock_process_clean = mocker.patch.object(pdm_service, "_process_clean_document")
    mock_finalize_transaction = mocker.patch.object(
        pdm_service, "_finalize_and_supersede_with_transaction"
    )

    pdm_service._process_preliminary_document_reference(
        mock_pdm_document_reference, object_key, 1222
    )

    mock_process_clean.assert_called_once()
    mock_finalize_transaction.assert_not_called()
    assert mock_pdm_document_reference.doc_status == "final"
    assert mock_pdm_document_reference.uploaded is True
    assert mock_pdm_document_reference.uploading is False


def test__process_preliminary_document_reference_infected_virus_scan(
    pdm_service, mock_document_reference, mocker
):
    """Test processing document reference with an infected virus scan"""
    object_key = "staging/test-doc-id"

    mocker.patch.object(
        pdm_service, "_perform_virus_scan", return_value=VirusScanResult.INFECTED
    )
    mock_process_clean = mocker.patch.object(pdm_service, "_process_clean_document")
    mock_update_dynamo = mocker.patch.object(pdm_service, "_update_dynamo_table")
    pdm_service._process_preliminary_document_reference(
        mock_document_reference, object_key, 1222
    )

    mock_process_clean.assert_not_called()
    mock_update_dynamo.assert_called_once()


def test_perform_virus_scan_returns_clean_hardcoded(
    pdm_service, mock_document_reference
):
    """Test virus scan returns hardcoded CLEAN result"""
    object_key = "staging/test-doc-id"
    result = pdm_service._perform_virus_scan(mock_document_reference, object_key)
    assert result == VirusScanResult.CLEAN


def test_perform_virus_scan_exception_returns_infected(
    pdm_service, mock_document_reference, mocker
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
    mock_delete = mocker.patch.object(pdm_service, "delete_file_from_staging_bucket")

    pdm_service._process_clean_document(
        mock_document_reference,
        object_key,
    )

    mock_copy.assert_called_once_with(mock_document_reference, object_key)
    mock_delete.assert_called_once_with(object_key)


def test_process_clean_document_exception_restores_original_values(
    pdm_service, mock_document_reference, mocker
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
    pdm_service, mock_pdm_document_reference
):
    """Test successful file copying from staging bucket"""
    source_file_key = (
        f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/9000000001/test-doc-id"
    )
    expected_dest_key = "9000000001/test-doc-id"

    pdm_service.copy_files_from_staging_bucket(
        mock_pdm_document_reference, source_file_key
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
    pdm_service, mock_document_reference
):
    """Test handling of ClientError during file copying"""
    source_file_key = "staging/test-doc-id"
    client_error = ClientError(
        error_response={
            "Error": {"Code": "NoSuchBucket", "Message": "Bucket does not exist"}
        },
        operation_name="CopyObject",
    )
    pdm_service.s3_service.copy_across_bucket.side_effect = client_error

    with pytest.raises(FileProcessingException):
        pdm_service.copy_files_from_staging_bucket(
            mock_document_reference, source_file_key
        )


def test_delete_file_from_staging_bucket_success(pdm_service):
    """Test successful file deletion from staging bucket"""
    source_file_key = "staging/test-doc-id"

    pdm_service.delete_file_from_staging_bucket(source_file_key)

    pdm_service.s3_service.delete_object.assert_called_once_with(
        MOCK_STAGING_STORE_BUCKET, source_file_key
    )


def test_delete_pdm_file_from_staging_bucket_success(pdm_service):
    """Test successful file deletion from staging bucket"""
    source_file_key = (
        f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/staging/test-doc-id"
    )

    pdm_service.delete_file_from_staging_bucket(source_file_key)

    pdm_service.s3_service.delete_object.assert_called_once_with(
        MOCK_STAGING_STORE_BUCKET, source_file_key
    )


def test_delete_file_from_staging_bucket_client_error(pdm_service):
    """Test handling of ClientError during file deletion"""
    source_file_key = "staging/test-doc-id"
    client_error = ClientError(
        error_response={
            "Error": {"Code": "NoSuchKey", "Message": "Key does not exist"}
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
    pdm_service, mock_pdm_document_reference
):
    """Test updating DynamoDB table with a clean scan result"""
    pdm_service._update_dynamo_table(mock_pdm_document_reference)

    pdm_service.document_service.update_document.assert_called_once_with(
        table_name=MOCK_PDM_TABLE_NAME,
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


def test_update_dynamo_table_infected_scan_result(pdm_service, mock_document_reference):
    """Test updating DynamoDB table with an infected scan result"""
    pdm_service._update_dynamo_table(mock_document_reference)

    pdm_service.document_service.update_document.assert_called_once()


def test_update_dynamo_table_client_error(pdm_service, mock_document_reference):
    """Test handling of ClientError during DynamoDB update"""
    client_error = ClientError(
        error_response={
            "Error": {"Code": "ResourceNotFoundException", "Message": "Table not found"}
        },
        operation_name="UpdateItem",
    )
    pdm_service.document_service.update_document.side_effect = client_error

    with pytest.raises(DocumentServiceException):
        pdm_service._update_dynamo_table(mock_document_reference)


def test_handle_upload_document_reference_request_no_document_found(pdm_service):
    """Test handling when no preliminary document is found in database"""
    object_key = "staging/test-doc-id"
    object_size = 1234

    pdm_service.document_service.fetch_documents_from_table.return_value = []

    pdm_service.handle_upload_document_reference_request(object_key, object_size)

    # Should fetch but not proceed with processing
    pdm_service.document_service.fetch_documents_from_table.assert_called_once()
    pdm_service.s3_service.copy_across_bucket.assert_not_called()
    pdm_service.document_service.update_document.assert_not_called()


def test_process_preliminary_document_reference_exception_during_processing(
    pdm_service, mock_document_reference, mocker
):
    """Test that exceptions during processing are properly raised"""
    object_key = "staging/test-doc-id"

    mocker.patch.object(
        pdm_service, "_perform_virus_scan", return_value=VirusScanResult.CLEAN
    )
    mocker.patch.object(
        pdm_service,
        "_process_clean_document",
        side_effect=Exception("Processing failed"),
    )

    with pytest.raises(Exception) as exc_info:
        pdm_service._process_preliminary_document_reference(
            mock_document_reference, object_key, 1222
        )

    assert "Processing failed" in str(exc_info.value)


def test_get_infrastructure_for_document_key_pdm(service):
    assert service.table_name == MOCK_LG_TABLE_NAME
    assert service.destination_bucket_name == MOCK_LG_BUCKET
    service._get_infrastructure_for_document_key(
        object_parts=["fhir_upload", SnomedCodes.PATIENT_DATA.value.code, "1234"]
    )
    assert service.table_name == MOCK_PDM_TABLE_NAME
    assert service.destination_bucket_name == MOCK_PDM_BUCKET


def test_get_infrastructure_for_document_key_non_pdm(service):
    infra = service._get_infrastructure_for_document_key(object_parts=["1234", "123"])
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
            MOCK_LG_TABLE_NAME,
            MOCK_LG_BUCKET,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
        (
            "folder/subfolder/another-doc",
            MOCK_LG_TABLE_NAME,
            MOCK_LG_BUCKET,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
        (
            "simple-doc",
            MOCK_LG_TABLE_NAME,
            MOCK_LG_BUCKET,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
        (
            f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/staging/test-doc-123",
            MOCK_PDM_TABLE_NAME,
            MOCK_PDM_BUCKET,
            SnomedCodes.PATIENT_DATA.value,
        ),
        (
            f"{SnomedCodes.LLOYD_GEORGE.value.code}/staging/test-doc-123",
            MOCK_LG_TABLE_NAME,
            MOCK_LG_BUCKET,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
        (
            f"fhir_upload/{SnomedCodes.LLOYD_GEORGE.value.code}/staging/test-doc-123",
            MOCK_LG_TABLE_NAME,
            MOCK_LG_BUCKET,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
    ],
)
def test_document_type_extraction_from_object_key(
    service, object_key, expected_table, expected_s3_bucket, expected_doctype
):
    """Test extraction of a document key from various object key formats"""
    service.handle_upload_document_reference_request(object_key)
    assert service.table_name == expected_table
    assert service.destination_bucket_name == expected_s3_bucket
    assert service.doc_type.code == expected_doctype.code


def test_handle_upload_pdm_document_reference_request_success(
    service, mock_document_reference, mocker
):
    """Test successful handling of the upload document reference request"""
    pdm_snomed = SnomedCodes.PATIENT_DATA.value
    object_key = f"fhir_upload/{pdm_snomed.code}/staging/test-doc-id"
    object_size = 1111
    service.document_service.fetch_documents_from_table.return_value = [
        mock_document_reference
    ]
    service.virus_scan_service.scan_file = mocker.MagicMock(
        return_value=VirusScanResult.CLEAN
    )

    service.handle_upload_document_reference_request(object_key, object_size)

    service.document_service.fetch_documents_from_table.assert_called_once()
    service.document_service.update_document.assert_called_once()
    service.s3_service.copy_across_bucket.assert_called_once()
    service.s3_service.delete_object.assert_called_once()
    service.virus_scan_service.scan_file.assert_called_once()


def test_copy_files_from_staging_bucket_to_pdm_success(
    pdm_service, mock_pdm_document_reference
):
    """Test successful file copying from staging bucket"""
    source_file_key = (
        f"fhir_upload/{SnomedCodes.PATIENT_DATA.value.code}/staging/test-doc-id"
    )
    expected_dest_key = (
        f"{mock_pdm_document_reference.nhs_number}/{mock_pdm_document_reference.id}"
    )
    pdm_service.copy_files_from_staging_bucket(
        mock_pdm_document_reference, source_file_key
    )
    pdm_service.s3_service.copy_across_bucket.assert_called_once_with(
        source_bucket=MOCK_STAGING_STORE_BUCKET,
        source_file_key=source_file_key,
        dest_bucket=MOCK_PDM_BUCKET,
        dest_file_key=expected_dest_key,
    )

    assert mock_pdm_document_reference.s3_file_key == expected_dest_key
    assert mock_pdm_document_reference.s3_bucket_name == MOCK_PDM_BUCKET
