import copy
import os
import tempfile
import urllib
import urllib.parse
from collections import defaultdict
from unittest.mock import call

import pytest
from botocore.exceptions import ClientError
from freezegun import freeze_time

from enums.upload_status import UploadStatus
from enums.virus_scan_result import VirusScanResult
from models.staging_metadata import (
    METADATA_FILENAME,
    BulkUploadQueueMetadata,
    MetadataFile,
    StagingSqsMetadata,
)
from services.bulk_upload_metadata_preprocessor_service import (
    MetadataPreprocessorService,
)
from services.bulk_upload_metadata_processor_service import (
    BulkUploadMetadataProcessorService,
)
from tests.unit.conftest import MOCK_LG_METADATA_SQS_QUEUE
from tests.unit.helpers.data.bulk_upload.test_data import (
    EXPECTED_PARSED_METADATA,
    EXPECTED_PARSED_METADATA_2,
    EXPECTED_SQS_MSG_FOR_PATIENT_123456789,
    EXPECTED_SQS_MSG_FOR_PATIENT_1234567890,
    MOCK_METADATA,
)
from utils.exceptions import (
    BulkUploadMetadataException,
    InvalidFileNameException,
    LGInvalidFilesException,
    OdsErrorException,
    VirusScanFailedException,
)

METADATA_FILE_DIR = "tests/unit/helpers/data/bulk_upload"
MOCK_METADATA_CSV = f"{METADATA_FILE_DIR}/metadata.csv"
MOCK_DUPLICATE_ODS_METADATA_CSV = (
    f"{METADATA_FILE_DIR}/metadata_with_duplicates_different_ods.csv"
)
MOCK_INVALID_METADATA_CSV_FILES = [
    f"{METADATA_FILE_DIR}/metadata_invalid.csv",
    f"{METADATA_FILE_DIR}/metadata_invalid_empty_nhs_number.csv",
    f"{METADATA_FILE_DIR}/metadata_invalid_unexpected_comma.csv",
]
MOCK_TEMP_FOLDER = "tests/unit/helpers/data/bulk_upload"

SERVICE_PATH = "services.bulk_upload_metadata_processor_service"
TEST_MOCK_METADATA_CSV = "path/to/metadata.csv"


class MockMetadataPreprocessorService(MetadataPreprocessorService):
    def validate_record_filename(self, original_filename: str, *args, **kwargs) -> str:
        return original_filename


@pytest.fixture(autouse=True)
@freeze_time("2025-01-01T12:00:00")
def test_service(mocker, set_env, mock_tempfile):
    mocker.patch("services.bulk_upload_metadata_processor_service.S3Service")
    mocker.patch("services.bulk_upload_metadata_processor_service.SQSService")
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadDynamoRepository",
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadS3Repository",
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadSqsRepository",
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.get_virus_scan_service",
    )

    service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=MockMetadataPreprocessorService(
            practice_directory=TEST_MOCK_METADATA_CSV,
        ),
        metadata_heading_remap={},
        input_file_location=TEST_MOCK_METADATA_CSV,
    )

    mocker.patch.object(service, "s3_service")
    return service


@pytest.fixture
@freeze_time("2025-01-01T12:00:00")
def test_service_with_review_enabled(mocker, set_env, mock_tempfile):
    mocker.patch("services.bulk_upload_metadata_processor_service.S3Service")
    mocker.patch("services.bulk_upload_metadata_processor_service.SQSService")
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadDynamoRepository",
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadS3Repository",
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadSqsRepository",
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.get_virus_scan_service",
    )

    service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=MockMetadataPreprocessorService(
            practice_directory=TEST_MOCK_METADATA_CSV,
        ),
        metadata_heading_remap={},
        input_file_location=TEST_MOCK_METADATA_CSV,
    )

    mocker.patch.object(service, "s3_service")
    return service


@pytest.fixture
def metadata_filename():
    return METADATA_FILENAME


@pytest.fixture
def mock_download_metadata_from_s3(mocker):
    yield mocker.patch.object(
        BulkUploadMetadataProcessorService,
        "download_metadata_from_s3",
    )


@pytest.fixture
def mock_s3_service(test_service):
    return test_service.s3_service


@pytest.fixture
def mock_tempfile(mocker):
    mocker.patch.object(tempfile, "mkdtemp", return_value=MOCK_TEMP_FOLDER)
    mocker.patch("shutil.rmtree")
    yield


@pytest.fixture
def mock_sqs_service(test_service):
    return test_service.sqs_service


@pytest.fixture
def base_metadata_file():
    row = {
        "FILEPATH": "valid/path/to/file.pdf",
        "STORED-FILE-NAME": "valid/path/to/file.pdf",
        "GP-PRACTICE-CODE": "Y12345",
        "NHS-NO": "1234567890",
        "PAGE COUNT": "1",
        "SECTION": "LG",
        "SUB-SECTION": "",
        "SCAN-DATE": "02/01/2023",
        "SCAN-ID": "SID456",
        "USER-ID": "UID456",
        "UPLOAD": "02/01/2023",
    }
    return MetadataFile.model_validate(row)


def test_process_metadata_send_metadata_to_sqs_queue(
    mocker,
    test_service,
    mock_download_metadata_from_s3,
):
    fake_csv_path = "fake/path/metadata.csv"

    mock_download_metadata_from_s3.return_value = fake_csv_path

    mocker.patch.object(
        test_service.s3_service,
        "copy_across_bucket",
        return_value=None,
    )
    mocker.patch.object(test_service.s3_service, "delete_object", return_value=None)

    fake_metadata = [
        {"nhs_number": "1234567890", "some_data": "value1"},
        {"nhs_number": "123456789", "some_data": "value2"},
        {"nhs_number": "0000000000", "some_data": "value3"},
    ]
    mocker.patch.object(
        test_service,
        "csv_to_sqs_metadata",
        return_value=fake_metadata,
    )

    mocked_send_metadata = mocker.patch.object(
        test_service,
        "send_metadata_to_fifo_sqs",
    )

    test_service.process_metadata()

    assert mocked_send_metadata.call_count == 1
    mocked_send_metadata.assert_called_once_with(fake_metadata)


def test_process_metadata_catch_and_log_error_when_fail_to_get_metadata_csv_from_s3(
    set_env,
    caplog,
    mock_s3_service,
    mock_sqs_service,
    test_service,
):
    mock_s3_service.download_file.side_effect = ClientError(
        {"Error": {"Code": "403", "Message": "Forbidden"}},
        "S3:HeadObject",
    )
    expected_err_msg = (
        f"Could not retrieve the following metadata file: {TEST_MOCK_METADATA_CSV}"
    )

    with pytest.raises(BulkUploadMetadataException) as e:
        test_service.process_metadata()

    assert expected_err_msg in str(e.value)

    mock_sqs_service.send_message_with_nhs_number_attr_fifo.assert_not_called()


def test_process_metadata_raise_validation_error_when_metadata_csv_is_invalid(
    mock_sqs_service,
    mock_download_metadata_from_s3,
    test_service,
    mocker,
):
    mock_download_metadata_from_s3.return_value = "fake/path.csv"
    mocker.patch.object(
        test_service,
        "csv_to_sqs_metadata",
        side_effect=BulkUploadMetadataException("validation error"),
    )

    with pytest.raises(BulkUploadMetadataException) as exc_info:
        test_service.process_metadata()

    assert "validation error" in str(exc_info.value)
    mock_sqs_service.send_message_with_nhs_number_attr_fifo.assert_not_called()


def test_process_metadata_raise_validation_error_when_gp_practice_code_is_missing(
    mock_sqs_service,
    mock_download_metadata_from_s3,
    test_service,
    mocker,
):
    mock_download_metadata_from_s3.return_value = "fake/path.csv"

    expected_error_log = (
        "Failed to parse metadata.csv: 1 validation error for MetadataFile\n"
        + "GP-PRACTICE-CODE\n  missing GP-PRACTICE-CODE for patient 1234567890"
    )

    mocker.patch.object(
        test_service,
        "csv_to_sqs_metadata",
        side_effect=BulkUploadMetadataException(expected_error_log),
    )

    with pytest.raises(BulkUploadMetadataException) as e:
        test_service.process_metadata()

    assert expected_error_log in str(e.value)
    mock_sqs_service.send_message_with_nhs_number_attr_fifo.assert_not_called()


def test_process_metadata_raise_client_error_when_failed_to_send_message_to_sqs(
    test_service,
    mocker,
):
    mocker.patch.object(
        test_service,
        "download_metadata_from_s3",
        return_value="fake/path.csv",
    )

    dummy_staging_metadata = mocker.Mock()
    dummy_staging_metadata.nhs_number = "1234567890"
    mocker.patch.object(
        test_service,
        "csv_to_sqs_metadata",
        return_value=[dummy_staging_metadata],
    )

    mock_client_error = ClientError(
        {
            "Error": {
                "Code": "AWS.SimpleQueueService.NonExistentQueue",
                "Message": "The specified queue does not exist",
            },
        },
        "SendMessage",
    )

    mocker.patch.object(
        test_service,
        "send_metadata_to_fifo_sqs",
        side_effect=BulkUploadMetadataException(str(mock_client_error)),
    )

    expected_err_msg = (
        "An error occurred (AWS.SimpleQueueService.NonExistentQueue) when calling the SendMessage operation:"
        " The specified queue does not exist"
    )

    with pytest.raises(BulkUploadMetadataException) as e:
        test_service.process_metadata()

    assert expected_err_msg in str(e.value)


def test_download_metadata_from_s3(mock_s3_service, test_service):
    result = test_service.download_metadata_from_s3()

    expected_file_key = test_service.file_key
    expected_download_path = os.path.join(
        test_service.temp_download_dir,
        expected_file_key.split("/")[-1],
    )

    mock_s3_service.download_file.assert_called_once_with(
        s3_bucket_name=test_service.staging_bucket_name,
        file_key=expected_file_key,
        download_path=expected_download_path,
    )

    assert result == expected_download_path


def test_download_metadata_from_s3_raise_error_when_failed_to_download(
    set_env,
    mock_s3_service,
    mock_tempfile,
    test_service,
):
    mock_s3_service.download_file.side_effect = ClientError(
        {"Error": {"Code": "500", "Message": "file not exist in bucket"}},
        "s3_get_object",
    )
    with pytest.raises(
        BulkUploadMetadataException,
        match=f"Could not retrieve the following metadata file: {TEST_MOCK_METADATA_CSV}",
    ):
        test_service.download_metadata_from_s3()


def test_duplicates_csv_to_sqs_metadata(mocker, test_service):
    header = "FILEPATH,PAGE COUNT,GP-PRACTICE-CODE,NHS-NO,SECTION,SUB-SECTION,SCAN-DATE,SCAN-ID,USER-ID,UPLOAD"
    line1 = (
        '/1234567890/1of2_Lloyd_George_Record_[Joe Bloggs]_[1234567890]_[25-12-2019].pdf,"","Y12345",'
        '"1234567890","LG","","03/09/2022","NEC","NEC","04/10/2023"'
    )
    line2 = (
        '/1234567890/2of2_Lloyd_George_Record_[Joe Bloggs]_[1234567890]_[25-12-2019].pdf,"","Y12345",'
        '"1234567890","LG","","03/09/2022","NEC","NEC","04/10/2023"'
    )
    line3 = (
        '/1234567890/1of2_Lloyd_George_Record_[Joe Bloggs]_[1234567890]_[25-12-2019].pdf,"","Y6789",'
        '"1234567890","LG","","03/09/2022","NEC","NEC","04/10/2023"'
    )
    line4 = (
        '/1234567890/2of2_Lloyd_George_Record_[Joe Bloggs]_[1234567890]_[25-12-2019].pdf,"","Y6789",'
        '"1234567890","LG","","03/09/2022","NEC","NEC","04/10/2023"'
    )
    line5 = (
        '1of1_Lloyd_George_Record_[Joe Bloggs_invalid]_[123456789]_[25-12-2019].txt,"","Y12345",'
        '"123456789","LG","","04/09/2022","NEC","NEC","04/10/2023"'
    )
    line6 = (
        '1of1_Lloyd_George_Record_[Joe Bloggs_invalid]_[123456789]_[25-12-2019].txt,"","Y6789",'
        '"123456789","LG","","04/09/2022","NEC","NEC","04/10/2023"'
    )
    line7 = (
        '1of1_Lloyd_George_Record_[Jane Smith]_[1234567892]_[25-12-2019].txt,"","Y12345","","LG","","04/09/2022",'
        '"NEC","NEC","04/10/2023"'
    )
    line8 = (
        '1of1_Lloyd_George_Record_[Jane Smith]_[1234567892]_[25-12-2019].txt,"","Y6789","","LG","","04/09/2022",'
        '"NEC","NEC","04/10/2023"'
    )

    fake_csv_data = "\n".join(
        [header, line1, line2, line3, line4, line5, line6, line7, line8],
    )

    mocker.patch("builtins.open", mocker.mock_open(read_data=fake_csv_data))
    mocker.patch("os.path.isfile", return_value=True)

    mocker.patch.object(
        test_service.metadata_mapping_validator_service,
        "validate_and_normalize_metadata",
        side_effect=lambda records, fixed_values, remappings: (records, [], []),
    )

    actual = test_service.csv_to_sqs_metadata("fake/path.csv")

    expected = copy.deepcopy(EXPECTED_PARSED_METADATA_2)
    for metadata in expected:
        for file in metadata.files:
            file.file_path = f"{TEST_MOCK_METADATA_CSV.rsplit('/', 1)[0]}/{file.stored_file_name.lstrip('/')}"

    assert actual == expected


def test_send_metadata_to_sqs(set_env, mocker, mock_sqs_service, test_service):
    expected_calls = [
        call(
            queue_url=MOCK_LG_METADATA_SQS_QUEUE,
            message_body=EXPECTED_SQS_MSG_FOR_PATIENT_1234567890,
            nhs_number="1234567890",
            group_id="bulk_upload_1234567890",
        ),
        call(
            queue_url=MOCK_LG_METADATA_SQS_QUEUE,
            message_body=EXPECTED_SQS_MSG_FOR_PATIENT_123456789,
            nhs_number="123456789",
            group_id="bulk_upload_123456789",
        ),
    ]

    test_service.send_metadata_to_fifo_sqs(MOCK_METADATA)

    mock_sqs_service.send_message_with_nhs_number_attr_fifo.assert_has_calls(
        expected_calls,
    )
    assert mock_sqs_service.send_message_with_nhs_number_attr_fifo.call_count == 2


def test_send_metadata_to_sqs_raise_error_when_fail_to_send_message(
    set_env,
    mock_sqs_service,
    test_service,
):
    mock_sqs_service.send_message_with_nhs_number_attr_fifo.side_effect = ClientError(
        {
            "Error": {
                "Code": "AWS.SimpleQueueService.NonExistentQueue",
                "Message": "The specified queue does not exist",
            },
        },
        "SendMessage",
    )

    with pytest.raises(ClientError):
        test_service.send_metadata_to_fifo_sqs(EXPECTED_PARSED_METADATA)


def test_clear_temp_storage(set_env, mocker, mock_tempfile, test_service):
    mocked_rm = mocker.patch("shutil.rmtree")

    test_service.clear_temp_storage()

    mocked_rm.assert_called_once_with(test_service.temp_download_dir)


def test_process_metadata_row_success(mocker, test_service):
    patients = defaultdict(list)
    failed_files = defaultdict(list)
    row = {
        "FILEPATH": "some/path/file.pdf",
        "GP-PRACTICE-CODE": "Y12345",
        "NHS-NO": "1234567890",
        "PAGE COUNT": "5",
        "SECTION": "LG",
        "SUB-SECTION": "",
        "SCAN-DATE": "01/01/2023",
        "SCAN-ID": "SID123",
        "USER-ID": "UID123",
        "UPLOAD": "01/01/2023",
    }

    metadata = MetadataFile.model_validate(row)

    mocker.patch(
        "services.bulk_upload_metadata_processor_service.MetadataFile.model_validate",
        return_value=metadata,
    )
    mocker.patch.object(
        test_service.metadata_formatter_service,
        "validate_record_filename",
        return_value="corrected.pdf",
    )
    test_service.process_metadata_row(row, patients, failed_files)

    key = ("1234567890", "Y12345")
    assert key in patients

    expected_sqs_metadata = BulkUploadQueueMetadata.model_validate(
        {
            "file_path": "path/to/some/path/file.pdf",
            "nhs_number": "1234567890",
            "gp_practice_code": "Y12345",
            "scan_date": "01/01/2023",
            "stored_file_name": "corrected.pdf",
        },
    )

    assert patients[key] == [expected_sqs_metadata]
    assert len(failed_files) == 0


def test_process_metadata_row_adds_to_existing_entry(mocker):
    key = ("1234567890", "Y12345")
    mock_metadata_existing = BulkUploadQueueMetadata.model_validate(
        {
            "file_path": "some/path/file1.pdf",
            "nhs_number": "1234567890",
            "gp_practice_code": "Y12345",
            "scan_date": "01/01/2023",
            "stored_file_name": "some/path/file1.pdf",
        },
    )
    patients = {key: [mock_metadata_existing]}
    failed_files = defaultdict(list)

    row = {
        "FILEPATH": "/some/path/file2.pdf",
        "GP-PRACTICE-CODE": "Y12345",
        "NHS-NO": "1234567890",
        "PAGE COUNT": "1",
        "SECTION": "LG",
        "SUB-SECTION": "",
        "SCAN-DATE": "02/01/2023",
        "SCAN-ID": "SID456",
        "USER-ID": "UID456",
        "UPLOAD": "02/01/2023",
    }

    metadata = MetadataFile.model_validate(row)

    mocker.patch(
        f"{SERVICE_PATH}.MetadataFile.model_validate",
        return_value=metadata,
    )

    preprocessor = mocker.Mock(
        practice_directory="test_practice_directory/metadata.csv",
    )
    preprocessor.validate_record_filename.return_value = "/some/path/file2.pdf"

    service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=preprocessor,
        metadata_heading_remap={},
        input_file_location="test_practice_directory/metadata.csv",
    )

    service.process_metadata_row(row, patients, failed_files)

    assert len(patients[key]) == 2
    assert patients[key][0] == mock_metadata_existing
    assert isinstance(patients[key][1], BulkUploadQueueMetadata)
    assert patients[key][1].file_path == "test_practice_directory/some/path/file2.pdf"
    assert patients[key][1].stored_file_name == "/some/path/file2.pdf"


def test_extract_patient_info(test_service, base_metadata_file):
    nhs_number, ods_code = test_service.extract_patient_info(base_metadata_file)

    assert nhs_number == "1234567890"
    assert ods_code == "Y12345"


def test_handle_invalid_filename_writes_failed_entry_to_dynamo(
    mocker,
    test_service,
    base_metadata_file,
):
    nhs_number = "1234567890"
    ods_code = "Y12345"
    failed_files = defaultdict(list)
    error = InvalidFileNameException("Invalid filename format")

    test_service.s3_repo.file_exists_on_staging_bucket.return_value = True

    mock_staging_metadata = mocker.patch(
        "services.bulk_upload_metadata_processor_service.StagingSqsMetadata",
    )

    mock_write = mocker.patch.object(
        test_service.dynamo_repository,
        "write_report_upload_to_dynamo",
    )

    test_service.handle_invalid_filename(
        base_metadata_file,
        error,
        nhs_number,
        ods_code,
        failed_files,
    )

    expected_file = test_service.convert_to_sqs_metadata(
        base_metadata_file,
        base_metadata_file.file_path,
    )
    expected_file.file_path = (
        f"{TEST_MOCK_METADATA_CSV.rsplit('/', 1)[0]}/{base_metadata_file.file_path}"
    )

    mock_staging_metadata.assert_called_once_with(
        nhs_number=nhs_number,
        files=[expected_file],
    )

    mock_write.assert_called_once_with(
        mock_staging_metadata.return_value,
        UploadStatus.FAILED,
        str(error),
        sent_to_review=True,
    )

    assert (nhs_number, ods_code) in failed_files
    assert failed_files[(nhs_number, ods_code)] == [expected_file]


def test_handle_invalid_filename_sets_sent_to_review_true_when_review_enabled(
    mocker,
    test_service_with_review_enabled,
    base_metadata_file,
):
    nhs_number = "1234567890"
    ods_code = "Y12345"
    failed_files = defaultdict(list)
    error = InvalidFileNameException("Invalid filename format")

    test_service_with_review_enabled.s3_repo.file_exists_on_staging_bucket.return_value = (
        True
    )
    mock_write = mocker.patch.object(
        test_service_with_review_enabled.dynamo_repository,
        "write_report_upload_to_dynamo",
    )
    mocker.patch("services.bulk_upload_metadata_processor_service.StagingSqsMetadata")

    test_service_with_review_enabled.handle_invalid_filename(
        base_metadata_file,
        error,
        nhs_number,
        ods_code,
        failed_files,
    )

    mock_write.assert_called_once_with(
        mocker.ANY,
        UploadStatus.FAILED,
        str(error),
        sent_to_review=True,
    )
    assert (nhs_number, ods_code) in failed_files


def test_handle_invalid_filename_does_not_send_to_review_when_file_missing(
    mocker,
    test_service_with_review_enabled,
    base_metadata_file,
):
    nhs_number = "1234567890"
    ods_code = "Y12345"
    failed_files = defaultdict(list)
    error = InvalidFileNameException("Invalid filename format")

    test_service_with_review_enabled.s3_repo.file_exists_on_staging_bucket.return_value = (
        False
    )
    mock_write = mocker.patch.object(
        test_service_with_review_enabled.dynamo_repository,
        "write_report_upload_to_dynamo",
    )
    mocker.patch("services.bulk_upload_metadata_processor_service.StagingSqsMetadata")

    test_service_with_review_enabled.handle_invalid_filename(
        base_metadata_file,
        error,
        nhs_number,
        ods_code,
        failed_files,
    )

    mock_write.assert_called_once_with(
        mocker.ANY,
        UploadStatus.FAILED,
        str(error),
        sent_to_review=False,
    )
    assert (nhs_number, ods_code) not in failed_files


def test_handle_invalid_filename_preserves_original_nhs_number_in_report(
    mocker,
    test_service,
    base_metadata_file,
):
    non_numeric_nhs = "ABC1234567"
    ods_code = "Y12345"
    failed_files = defaultdict(list)
    error = InvalidFileNameException("Invalid filename format")

    base_metadata_file.nhs_number = non_numeric_nhs
    mock_write = mocker.patch.object(
        test_service.dynamo_repository,
        "write_report_upload_to_dynamo",
    )

    test_service.handle_invalid_filename(
        base_metadata_file,
        error,
        non_numeric_nhs,
        ods_code,
        failed_files,
    )

    staging_metadata, *_ = mock_write.call_args[0]
    assert staging_metadata.nhs_number == non_numeric_nhs


def test_csv_to_sqs_metadata_sends_failed_files_to_review_queue_when_enabled(
    mocker,
    test_service_with_review_enabled,
    mock_csv_content,
):
    mocker.patch("builtins.open", mocker.mock_open(read_data=mock_csv_content))

    mocker.patch.object(
        test_service_with_review_enabled.metadata_mapping_validator_service,
        "validate_and_normalize_metadata",
        side_effect=lambda records, fixed_values, remappings: (records, [], []),
    )

    mocker.patch.object(
        test_service_with_review_enabled,
        "validate_and_correct_filename",
        side_effect=InvalidFileNameException("invalid"),
    )
    test_service_with_review_enabled.s3_repo.file_exists_on_staging_bucket.return_value = (
        True
    )

    result = test_service_with_review_enabled.csv_to_sqs_metadata(MOCK_METADATA_CSV)

    assert (
        test_service_with_review_enabled.sqs_repository.send_message_to_review_queue.called
    )
    assert len(result) == 0


def test_csv_to_sqs_metadata_does_not_send_to_review_when_no_failures(
    mocker,
    test_service,
    mock_csv_content,
):
    mocker.patch("builtins.open", mocker.mock_open(read_data=mock_csv_content))

    mock_send_to_review = mocker.patch.object(
        test_service.sqs_repository,
        "send_message_to_review_queue",
    )

    mocker.patch.object(
        test_service.metadata_mapping_validator_service,
        "validate_and_normalize_metadata",
        side_effect=lambda records, fixed_values, remappings: (records, [], []),
    )

    mocker.patch(
        "services.bulk_upload_metadata_processor_service.validate_file_name",
        return_value=True,
    )

    result = test_service.csv_to_sqs_metadata(MOCK_METADATA_CSV)

    assert not mock_send_to_review.called
    assert len(result) > 0


def test_csv_to_sqs_metadata_groups_multiple_failed_files_by_nhs_number(
    mocker,
    test_service,
):
    pass


def test_convert_to_sqs_metadata(base_metadata_file):
    stored_file_name = "corrected_file.pdf"

    result = BulkUploadMetadataProcessorService.convert_to_sqs_metadata(
        file=base_metadata_file,
        stored_file_name=stored_file_name,
    )

    assert isinstance(result, BulkUploadQueueMetadata)
    assert result.file_path == base_metadata_file.file_path
    assert result.gp_practice_code == base_metadata_file.gp_practice_code
    assert result.scan_date == base_metadata_file.scan_date
    assert result.stored_file_name == stored_file_name


def test_validate_and_correct_filename_returns_happy_path(
    mocker,
    test_service,
    base_metadata_file,
):
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.validate_file_name",
        return_value=True,
    )

    result = test_service.validate_and_correct_filename(base_metadata_file)

    assert result == base_metadata_file.file_path


def test_validate_and_correct_filename_sad_path(
    mocker,
    test_service,
    base_metadata_file,
):
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.validate_file_name",
        side_effect=LGInvalidFilesException("invalid filename"),
    )
    mocked_validate_record_filename = mocker.patch.object(
        test_service.metadata_formatter_service,
        "validate_record_filename",
        return_value="corrected/path/file_corrected.pdf",
    )

    result = test_service.validate_and_correct_filename(base_metadata_file)

    mocked_validate_record_filename.assert_called_once_with(
        base_metadata_file.file_path,
        base_metadata_file.nhs_number,
    )
    assert result == "corrected/path/file_corrected.pdf"


@freeze_time("2025-02-03T10:00:00")
def test_create_expedite_sqs_metadata_builds_expected_structure(test_service):
    ods_code = "A12345"
    key = f"expedite/{ods_code}/1of1_1234567890_record.pdf"

    result = test_service.create_expedite_sqs_metadata(key)

    assert result.nhs_number == "1234567890"
    assert len(result.files) == 1
    item = result.files[0]
    assert item.file_path == key
    assert item.stored_file_name == key
    assert item.gp_practice_code == ods_code
    assert item.scan_date == "2025-02-03"


@freeze_time("2025-02-03T10:00:00")
def test_handle_expedite_event_happy_path_sends_sqs(test_service, mocker):
    ods = "A12345"
    key = f"expedite/{ods}/1of1_1234567890_record.pdf"
    event = {"detail": {"object": {"key": key}}}

    mocker.patch.object(BulkUploadMetadataProcessorService, "enforce_virus_scanner")
    mocker.patch.object(BulkUploadMetadataProcessorService, "check_file_status")
    mocked_send = mocker.patch.object(
        BulkUploadMetadataProcessorService,
        "send_metadata_to_expedite_sqs",
    )

    test_service.handle_expedite_event(event)

    mocked_send.assert_called_once()
    args, _ = mocked_send.call_args
    assert len(args) == 1
    sqs_payload = args[0]
    assert sqs_payload.nhs_number == "1234567890"
    assert len(sqs_payload.files) == 1
    file_item = sqs_payload.files[0]
    assert file_item.file_path == key
    assert file_item.stored_file_name == key
    assert file_item.gp_practice_code == ods
    assert file_item.scan_date == "2025-02-03"


def test_handle_expedite_event_invalid_directory_raises(test_service, mocker):
    mocked_send = mocker.patch.object(
        BulkUploadMetadataProcessorService,
        "send_metadata_to_fifo_sqs",
    )
    bad_key = "notexpedite/A12345/1234567890_record.pdf"
    event = {"detail": {"object": {"key": bad_key}}}

    with pytest.raises(BulkUploadMetadataException) as exc:
        test_service.handle_expedite_event(event)

    assert "Unexpected directory or file location" in str(exc.value)
    mocked_send.assert_not_called()


def test_handle_expedite_event_missing_key_raises(test_service, mocker):
    mocked_send = mocker.patch.object(
        BulkUploadMetadataProcessorService,
        "send_metadata_to_fifo_sqs",
    )
    event = {"detail": {}}

    with pytest.raises(BulkUploadMetadataException) as exc:
        test_service.handle_expedite_event(event)

    assert "Failed due to missing key" in str(exc.value)
    mocked_send.assert_not_called()


def test_handle_expedite_event_rejects_non_1of1(test_service, mocker):
    mocker.patch.object(BulkUploadMetadataProcessorService, "enforce_virus_scanner")
    mocker.patch.object(BulkUploadMetadataProcessorService, "check_file_status")
    mocked_send = mocker.patch.object(
        BulkUploadMetadataProcessorService,
        "send_metadata_to_expedite_sqs",
    )
    key = "expedite/A12345/2of3_1234567890_record.pdf"
    event = {"detail": {"object": {"key": key}}}

    with pytest.raises(BulkUploadMetadataException) as exc:
        test_service.handle_expedite_event(event)

    assert "not being a 1of1" in str(exc.value)
    mocked_send.assert_not_called()


@pytest.fixture
def mock_csv_content():
    header = "FILEPATH,PAGE COUNT,GP-PRACTICE-CODE,NHS-NO,SECTION,SUB-SECTION,SCAN-DATE,SCAN-ID,USER-ID,UPLOAD"
    rows = [
        "/path/1.pdf,1,Y12345,1234567890,LG,,01/01/2023,SID,UID,01/01/2023",
        "/path/2.pdf,1,Y12345,123456789,LG,,02/01/2023,SID,UID,02/01/2023",
    ]
    return "\n".join([header, *rows])


def test_csv_to_sqs_metadata_happy_path(mocker, test_service, mock_csv_content):
    mocker.patch("builtins.open", mocker.mock_open(read_data=mock_csv_content))

    mocker.patch.object(
        test_service.metadata_mapping_validator_service,
        "validate_and_normalize_metadata",
        side_effect=lambda records, fixed_values, remappings: (records, [], []),
    )

    mock_process_metadata_row = mocker.patch.object(
        test_service,
        "process_metadata_row",
    )

    result = test_service.csv_to_sqs_metadata("fake/path.csv")

    test_service.metadata_mapping_validator_service.validate_and_normalize_metadata.assert_called_once()
    assert mock_process_metadata_row.call_count == 2
    assert all(isinstance(item, StagingSqsMetadata) for item in result)


def test_csv_to_sqs_metadata_raises_BulkUploadMetadataException_if_no_headers(
    mocker,
    test_service,
):
    mocker.patch("builtins.open", mocker.mock_open(read_data=""))

    with pytest.raises(BulkUploadMetadataException, match="empty or missing headers"):
        test_service.csv_to_sqs_metadata("fake/path.csv")


def test_csv_to_sqs_metadata_raises_BulkUploadMetadataException_if_all_rows_rejected(
    mocker,
    test_service,
    mock_csv_content,
):
    mocker.patch("builtins.open", mocker.mock_open(read_data=mock_csv_content))

    mocker.patch.object(
        test_service.metadata_mapping_validator_service,
        "validate_and_normalize_metadata",
        return_value=(
            [],
            [{"bad": "row"}],
            [{"FILEPATH": "fake.pdf", "REASON": "invalid"}],
        ),
    )

    with pytest.raises(
        BulkUploadMetadataException,
        match="No valid metadata rows found",
    ):
        test_service.csv_to_sqs_metadata("fake/path.csv")


def test_csv_to_sqs_metadata_groups_patients_correctly(mocker, test_service):
    header = "FILEPATH,GP-PRACTICE-CODE,NHS-NO,SCAN-DATE"
    data = "\n".join(
        [
            header,
            "/file1.pdf,Y123,1111111111,01/01/2023",
            "/file2.pdf,Y123,1111111111,01/02/2023",
            "/file3.pdf,Y999,2222222222,01/03/2023",
        ],
    )
    mocker.patch("builtins.open", mocker.mock_open(read_data=data))

    mocker.patch.object(
        test_service.metadata_mapping_validator_service,
        "validate_and_normalize_metadata",
        side_effect=lambda records, fixed_values, remappings: (records, [], []),
    )

    mocker.patch.object(
        test_service,
        "process_metadata_row",
        wraps=test_service.process_metadata_row,
    )

    result = test_service.csv_to_sqs_metadata("fake/path.csv")

    assert isinstance(result, list)
    assert all(isinstance(x, StagingSqsMetadata) for x in result)
    nhs_numbers = {x.nhs_number for x in result}
    assert nhs_numbers == {"1111111111", "2222222222"}


def test_clear_temp_storage_handles_missing_directory(mocker, test_service):
    mock_rm = mocker.patch("shutil.rmtree", side_effect=FileNotFoundError)

    test_service.clear_temp_storage()

    mock_rm.assert_called_once_with(test_service.temp_download_dir)


@pytest.fixture
@freeze_time("2025-01-01T12:00:00")
def mock_service_remapping_mandatory_fields(mocker, set_env, mock_tempfile):
    # Patch out external dependencies so __init__ doesn't touch real AWS/services
    mocker.patch("services.bulk_upload_metadata_processor_service.S3Service")
    mocker.patch("services.bulk_upload_metadata_processor_service.SQSService")
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadDynamoRepository",
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadS3Repository",
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.get_virus_scan_service",
    )

    service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=MockMetadataPreprocessorService(
            practice_directory="test_practice_directory/metadata.csv",
        ),
        metadata_heading_remap={
            "NHS-NO": "NhsNumber",
            "GP-PRACTICE-CODE": "ODS Code",
            "SCAN-DATE": "Scan Date",
            "SCAN-ID": "Scan ID",
            "USER-ID": "User ID",
            "UPLOAD": "Upload Date",
        },
        input_file_location="test_practice_directory/metadata.csv",
    )

    mocker.patch.object(
        service,
        "download_metadata_from_s3",
        return_value="fake/path.csv",
    )
    mocker.patch.object(
        service,
        "process_metadata_row",
        wraps=service.process_metadata_row,
    )
    mocker.patch.object(service, "s3_service")

    return service


@pytest.fixture
def mock_remap_csv_content():
    header = "FILEPATH,ODS Code,NhsNumber,Scan Date,Scan ID,User ID,Upload Date"
    rows = [
        "/path/1.pdf,Y12345,123456789,02/01/2023,SID,UID,02/01/2023",
    ]
    return "\n".join([header, *rows])


def test_remapping_mandatory_fields(
    mocker,
    mock_service_remapping_mandatory_fields,
    mock_remap_csv_content,
):
    mocker.patch("builtins.open", mocker.mock_open(read_data=mock_remap_csv_content))

    result = mock_service_remapping_mandatory_fields.csv_to_sqs_metadata(
        "fake/path.csv",
    )
    expected = [
        StagingSqsMetadata(
            nhs_number="123456789",
            files=[
                BulkUploadQueueMetadata(
                    file_path="test_practice_directory/path/1.pdf",
                    gp_practice_code="Y12345",
                    scan_date="02/01/2023",
                    stored_file_name="/path/1.pdf",
                ),
            ],
            retries=0,
        ),
    ]
    assert result == expected


@pytest.fixture
@freeze_time("2025-01-01T12:00:00")
def mock_service_no_remapping(mocker, set_env, mock_tempfile):
    # Patch out external dependencies so __init__ doesn't touch real AWS/services
    mocker.patch("services.bulk_upload_metadata_processor_service.S3Service")
    mocker.patch("services.bulk_upload_metadata_processor_service.SQSService")
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadDynamoRepository",
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadS3Repository",
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.get_virus_scan_service",
    )

    service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=MockMetadataPreprocessorService(
            practice_directory="test_practice_directory/metadata.csv",
        ),
        metadata_heading_remap={},
        input_file_location="test_practice_directory/metadata.csv",
    )

    mocker.patch.object(
        service,
        "download_metadata_from_s3",
        return_value="fake/path.csv",
    )
    mocker.patch.object(
        service,
        "process_metadata_row",
        wraps=service.process_metadata_row,
    )
    mocker.patch.object(service, "s3_service")
    return service


@pytest.fixture
def mock_noremap_csv_content():
    header = "FILEPATH,GP-PRACTICE-CODE,NHS-NO,SCAN-DATE,SCAN-ID,USER-ID,UPLOAD"
    rows = [
        "/path/1.pdf,Y12345,123456789,02/01/2023,SID,UID,02/01/2023",
    ]
    return "\n".join([header, *rows])


def test_no_remapping_logic(
    mocker,
    mock_service_no_remapping,
    mock_noremap_csv_content,
):
    mocker.patch("builtins.open", mocker.mock_open(read_data=mock_noremap_csv_content))

    result = mock_service_no_remapping.csv_to_sqs_metadata("fake/path.csv")

    assert result == [
        StagingSqsMetadata(
            nhs_number="123456789",
            files=[
                BulkUploadQueueMetadata(
                    file_path="test_practice_directory/path/1.pdf",
                    gp_practice_code="Y12345",
                    scan_date="02/01/2023",
                    stored_file_name="/path/1.pdf",
                ),
            ],
            retries=0,
        ),
    ]


@freeze_time("2025-02-03T10:00:00")
def test_validate_expedite_file_happy_path_returns_expected_tuple(test_service):
    ods_code = "A12345"
    key = f"expedite/{ods_code}/1of1_1234567890_record.pdf"

    nhs_number, file_name, extracted_ods, scan_date = (
        test_service.validate_expedite_file(key)
    )

    assert nhs_number == "1234567890"
    assert file_name == key
    assert extracted_ods == ods_code
    assert scan_date == "2025-02-03"


@pytest.mark.parametrize(
    "key",
    [
        "expedite/A12345/2of3_1234567890_record.pdf",
        "expedite/A12345/10of50_1234567890_record.pdf",
        "expedite/A12345/1of10_1234567890_record.pdf",
    ],
)
def test_validate_expedite_file_rejects_non_1of1(test_service, key):
    with pytest.raises(InvalidFileNameException) as exc:
        test_service.validate_expedite_file(key)

    assert "not being a 1of1" in str(exc.value)


def test_handle_expedite_event_calls_enforce_for_expedite_key(mocker, test_service):
    encoded_key = urllib.parse.quote_plus(
        "expedite/folder/G12345/1of1_1234567890_some_file.pdf",
    )
    event = {"detail": {"object": {"key": encoded_key}}}

    mocker.patch.object(
        BulkUploadMetadataProcessorService,
        "create_expedite_sqs_metadata",
    )
    mocked_enforce = mocker.patch.object(test_service, "enforce_virus_scanner")
    mocked_check_status = mocker.patch.object(test_service, "check_file_status")

    test_service.handle_expedite_event(event)

    decoded_key = "expedite/folder/G12345/1of1_1234567890_some_file.pdf"
    mocked_enforce.assert_called_once_with(decoded_key)
    mocked_check_status.assert_called_once_with(decoded_key)


def test_handle_expedite_event_raises_on_unexpected_directory(mocker, test_service):
    mocked_enforce = mocker.patch.object(test_service, "enforce_virus_scanner")
    event = {"detail": {"object": {"key": "uploads/something.pdf"}}}

    with pytest.raises(BulkUploadMetadataException) as excinfo:
        test_service.handle_expedite_event(event)

    assert "Unexpected directory or file location received from EventBridge" in str(
        excinfo.value,
    )

    mocked_enforce.assert_not_called()


def test_handle_expedite_event_raises_on_missing_key(mocker, test_service):
    mocked_enforce = mocker.patch.object(test_service, "enforce_virus_scanner")
    event = {"detail": {"object": {}}}

    with pytest.raises(BulkUploadMetadataException) as excinfo:
        test_service.handle_expedite_event(event)

    assert "Failed due to missing key" in str(excinfo.value)

    mocked_enforce.assert_not_called()


def test_get_formatter_service_returns_general_for_general_value():
    from enums.lloyd_george_pre_process_format import LloydGeorgePreProcessFormat
    from services.bulk_upload.metadata_general_preprocessor import (
        MetadataGeneralPreprocessor,
    )
    from services.bulk_upload_metadata_processor_service import get_formatter_service

    cls = get_formatter_service(LloydGeorgePreProcessFormat.GENERAL.value)
    assert cls is MetadataGeneralPreprocessor


def test_get_formatter_service_returns_usb_for_usb_value():
    from enums.lloyd_george_pre_process_format import LloydGeorgePreProcessFormat
    from services.bulk_upload.metadata_usb_preprocessor import (
        MetadataUsbPreprocessorService,
    )
    from services.bulk_upload_metadata_processor_service import get_formatter_service

    cls = get_formatter_service(LloydGeorgePreProcessFormat.USB.value)
    assert cls is MetadataUsbPreprocessorService


def test_get_formatter_service_defaults_to_general_on_invalid_value():
    from services.bulk_upload.metadata_general_preprocessor import (
        MetadataGeneralPreprocessor,
    )
    from services.bulk_upload_metadata_processor_service import get_formatter_service

    cls = get_formatter_service("this-is-not-valid")
    assert cls is MetadataGeneralPreprocessor


def test_enforce_virus_scanner_happy_path_does_not_trigger_scan(mocker, test_service):
    file_key = "expedite/folder/file.pdf"

    mock_check = mocker.patch.object(
        test_service.s3_repo,
        "check_file_tag_status_on_staging_bucket",
        return_value=VirusScanResult.CLEAN,
    )
    mock_scan = mocker.patch.object(test_service.virus_scan_service, "scan_file")

    test_service.enforce_virus_scanner(file_key)

    mock_check.assert_called_once_with(file_key)
    mock_scan.assert_not_called()


def test_enforce_virus_scanner_triggers_scan_when_no_result(mocker, test_service):
    file_key = "expedite/folder/file.pdf"

    mocker.patch.object(
        test_service.s3_repo,
        "check_file_tag_status_on_staging_bucket",
        return_value="",
    )
    mock_scan = mocker.patch.object(test_service.virus_scan_service, "scan_file")

    test_service.enforce_virus_scanner(file_key)

    mock_scan.assert_called_once_with(file_ref=file_key)


def test_enforce_virus_scanner_raises_bulk_exception_on_s3_access_error(
    mocker,
    test_service,
):
    file_key = "expedite/folder/file.pdf"
    client_error = ClientError(
        {"Error": {"Code": "403", "Message": "NoSuchKey: object not found"}},
        "GetObject",
    )

    mocker.patch.object(
        test_service.s3_repo,
        "check_file_tag_status_on_staging_bucket",
        side_effect=client_error,
    )
    mock_scan = mocker.patch.object(test_service.virus_scan_service, "scan_file")

    with pytest.raises(BulkUploadMetadataException) as excinfo:
        test_service.enforce_virus_scanner(file_key)

    assert f"Failed to access S3 file {file_key} during tag check." in str(
        excinfo.value,
    )
    mock_scan.assert_not_called()


def test_enforce_virus_scanner_re_raises_unexpected_client_error(mocker, test_service):
    file_key = "expedite/folder/file.pdf"
    client_error = ClientError(
        {"Error": {"Code": "500", "Message": "InternalError"}},
        "GetObject",
    )

    mocker.patch.object(
        test_service.s3_repo,
        "check_file_tag_status_on_staging_bucket",
        side_effect=client_error,
    )
    mock_scan = mocker.patch.object(test_service.virus_scan_service, "scan_file")

    with pytest.raises(ClientError):
        test_service.enforce_virus_scanner(file_key)

    mock_scan.assert_not_called()


def test_check_file_status_clean_does_nothing(mocker, test_service, caplog):
    file_key = "expedite/folder/file.pdf"
    mock_check = mocker.patch.object(
        test_service.s3_repo,
        "check_file_tag_status_on_staging_bucket",
        return_value=VirusScanResult.CLEAN,
    )

    with caplog.at_level("INFO"):
        test_service.check_file_status(file_key)

    mock_check.assert_called_once_with(file_key)
    assert not any(
        "Found an issue with the file" in record.msg for record in caplog.records
    )


def test_check_file_status_logs_issue_when_not_clean(mocker, test_service, caplog):
    file_key = "expedite/folder/file.pdf"
    mocker.patch.object(
        test_service.s3_repo,
        "check_file_tag_status_on_staging_bucket",
        return_value=VirusScanResult.INFECTED,
    )

    with caplog.at_level("INFO"):
        with pytest.raises(VirusScanFailedException):
            test_service.check_file_status(file_key)

    assert any(
        f"Found an issue with the file {file_key}." in record.msg
        for record in caplog.records
    )


def test_apply_fixed_values_no_fixed_values(test_service, base_metadata_file):
    result = test_service.apply_fixed_values(base_metadata_file)

    assert result == base_metadata_file


def test_apply_fixed_values_single_field(mocker, base_metadata_file):
    service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=MockMetadataPreprocessorService(
            practice_directory="test_practice_directory",
        ),
        metadata_heading_remap={},
        fixed_values={"SECTION": "AR"},
    )
    mocker.patch.object(service, "s3_service")

    result = service.apply_fixed_values(base_metadata_file)

    assert result.section == "AR"
    assert result.nhs_number == base_metadata_file.nhs_number
    assert result.gp_practice_code == base_metadata_file.gp_practice_code


def test_apply_fixed_values_multiple_fields(mocker, base_metadata_file):
    service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=MockMetadataPreprocessorService(
            practice_directory="test_practice_directory",
        ),
        metadata_heading_remap={},
        fixed_values={
            "SECTION": "AR",
            "SUB-SECTION": "Mental Health",
            "SCAN-ID": "FIXED_SCAN_ID",
        },
    )
    mocker.patch.object(service, "s3_service")

    result = service.apply_fixed_values(base_metadata_file)

    assert result.section == "AR"
    assert result.sub_section == "Mental Health"
    assert result.scan_id == "FIXED_SCAN_ID"
    assert result.nhs_number == base_metadata_file.nhs_number


def test_apply_fixed_values_overwrites_existing_value(mocker, base_metadata_file):
    original_section = base_metadata_file.section
    assert original_section == "LG"

    service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=MockMetadataPreprocessorService(
            practice_directory="test_practice_directory",
        ),
        metadata_heading_remap={},
        fixed_values={"SECTION": "AR"},
    )
    mocker.patch.object(service, "s3_service")

    result = service.apply_fixed_values(base_metadata_file)

    assert result.section == "AR"
    assert result.section != original_section


def test_apply_fixed_values_logs_applied_values(mocker, base_metadata_file, caplog):
    service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=MockMetadataPreprocessorService(
            practice_directory="test_practice_directory",
        ),
        metadata_heading_remap={},
        fixed_values={"SECTION": "AR", "SCAN-ID": "TEST_ID"},
    )
    mocker.patch.object(service, "s3_service")

    service.apply_fixed_values(base_metadata_file)

    log_messages = [record.message for record in caplog.records]
    assert any(
        "Applied fixed value for field 'SECTION': 'AR'" in msg for msg in log_messages
    )
    assert any(
        "Applied fixed value for field 'SCAN-ID': 'TEST_ID'" in msg
        for msg in log_messages
    )


def test_apply_fixed_values_returns_valid_metadata_file(mocker, base_metadata_file):
    service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=MockMetadataPreprocessorService(
            practice_directory="test_practice_directory",
        ),
        metadata_heading_remap={},
        fixed_values={"SECTION": "AR"},
    )
    mocker.patch.object(service, "s3_service")

    result = service.apply_fixed_values(base_metadata_file)

    assert isinstance(result, MetadataFile)
    # Ensure it can be validated again
    validated = MetadataFile.model_validate(result.model_dump(by_alias=True))
    assert validated.section == "AR"


@pytest.mark.parametrize(
    "key",
    [
        "expedite/folder/G12345/1of1_file.pdf",
        "ABC/XPTO/expedite/folder/G12345/1of1_file.pdf",
    ],
)
def test_validate_ods_code_format_in_expedite_folder_accepts_valid_ods_code(
    test_service,
    key,
):
    test_service.validate_ods_code_format_in_expedite_folder(key)


@pytest.mark.parametrize(
    "key, expected_ods_code",
    [
        ("expedite/folder/g12345/1of1_file.pdf", "g12345"),
        ("expedite/folder/G1234/1of1_file.pdf", "G1234"),
        ("expedite/folder/G123456/1of1_file.pdf", "G123456"),
    ],
)
def test_validate_ods_code_format_in_expedite_folder_rejects_invalid_ods_code(
    test_service,
    key,
    expected_ods_code,
):
    with pytest.raises(OdsErrorException) as exc:
        test_service.validate_ods_code_format_in_expedite_folder(key)

    assert expected_ods_code in str(exc.value)
    assert "Invalid ODS code folder" in str(exc.value)


def test_handle_expedite_event_logs_marker_and_raises_for_invalid_ods_folder(
    test_service,
    mocker,
    caplog,
):
    key = "expedite/folder/invalid/1of1_1234567890_record.pdf"
    event = {"detail": {"object": {"key": key}}}

    mocked_enforce = mocker.patch.object(test_service, "enforce_virus_scanner")
    mocked_check = mocker.patch.object(test_service, "check_file_status")
    mocked_send = mocker.patch.object(test_service, "send_metadata_to_expedite_sqs")

    with pytest.raises(BulkUploadMetadataException) as exc:
        test_service.handle_expedite_event(event)

    assert "Expedite upload validation failed" in str(exc.value)
    assert "Invalid ODS code folder" in str(exc.value)
    assert any(
        "EXPEDITE_UPLOAD_VALIDATION_FAILED" in record.message
        for record in caplog.records
    )
    mocked_enforce.assert_not_called()
    mocked_check.assert_not_called()
    mocked_send.assert_not_called()


def test_handle_expedite_event_logs_marker_and_raises_for_non_1of1_file(
    test_service,
    mocker,
    caplog,
):
    key = "expedite/folder/G12345/2of3_1234567890_record.pdf"
    event = {"detail": {"object": {"key": key}}}

    mocker.patch.object(test_service, "enforce_virus_scanner")
    mocker.patch.object(test_service, "check_file_status")
    mocked_send = mocker.patch.object(test_service, "send_metadata_to_expedite_sqs")

    with pytest.raises(BulkUploadMetadataException) as exc:
        test_service.handle_expedite_event(event)

    assert "Expedite upload validation failed" in str(exc.value)
    assert "not being a 1of1" in str(exc.value)
    assert any(
        "EXPEDITE_UPLOAD_VALIDATION_FAILED" in record.message
        for record in caplog.records
    )
    mocked_send.assert_not_called()


def test_handle_expedite_event_logs_marker_and_raises_for_invalid_nhs_number(
    test_service,
    mocker,
    caplog,
):
    key = "expedite/folder/G12345/1of1_no_nhs_here.pdf"
    event = {"detail": {"object": {"key": key}}}

    mocker.patch.object(test_service, "enforce_virus_scanner")
    mocker.patch.object(test_service, "check_file_status")
    mocked_send = mocker.patch.object(test_service, "send_metadata_to_expedite_sqs")

    with pytest.raises(BulkUploadMetadataException) as exc:
        test_service.handle_expedite_event(event)

    assert "Expedite upload validation failed" in str(exc.value)
    assert "Invalid NHS number" in str(exc.value)
    assert any(
        "EXPEDITE_UPLOAD_VALIDATION_FAILED" in record.message
        for record in caplog.records
    )
    mocked_send.assert_not_called()


def test_handle_expedite_event_logs_marker_and_raises_for_invalid_filename_validation(
    test_service,
    mocker,
    caplog,
):
    key = "expedite/folder/G12345/1of1_1234567890_record.pdf"
    event = {"detail": {"object": {"key": key}}}

    mocker.patch.object(test_service, "enforce_virus_scanner")
    mocker.patch.object(test_service, "check_file_status")
    mocker.patch.object(
        test_service.metadata_formatter_service,
        "validate_record_filename",
        side_effect=InvalidFileNameException("invalid filename"),
    )
    mocked_send = mocker.patch.object(test_service, "send_metadata_to_expedite_sqs")

    with pytest.raises(BulkUploadMetadataException) as exc:
        test_service.handle_expedite_event(event)

    assert "Expedite upload validation failed" in str(exc.value)
    assert "invalid filename" in str(exc.value)
    assert any(
        "EXPEDITE_UPLOAD_VALIDATION_FAILED" in record.message
        for record in caplog.records
    )
    mocked_send.assert_not_called()
