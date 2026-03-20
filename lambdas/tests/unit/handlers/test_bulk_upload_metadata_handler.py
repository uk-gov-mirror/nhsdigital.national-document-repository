from unittest.mock import Mock

from services.bulk_upload_metadata_processor_service import (
    BulkUploadMetadataProcessorService,
)


def test_copy_metadata_to_dated_folder_copies_and_deletes(mocker, monkeypatch):
    monkeypatch.setenv("STAGING_STORE_BUCKET_NAME", "staging-bucket")
    monkeypatch.setenv("METADATA_SQS_QUEUE_URL", "https://example.com/metadata-queue")
    monkeypatch.setenv("EXPEDITE_SQS_QUEUE_URL", "https://example.com/expedite-queue")

    mocker.patch(
        "services.bulk_upload_metadata_processor_service.S3Service",
        autospec=True,
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.SQSService",
        autospec=True,
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadDynamoRepository",
        autospec=True,
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadSqsRepository",
        autospec=True,
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.BulkUploadS3Repository",
        autospec=True,
    )
    mocker.patch(
        "services.bulk_upload_metadata_processor_service.get_virus_scan_service",
        autospec=True,
    )

    mocked_datetime = mocker.patch(
        "services.bulk_upload_metadata_processor_service.datetime",
    )
    mocked_datetime.now.return_value.strftime.return_value = "2026-03-05_12-34"

    formatter_service = Mock()

    service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=formatter_service,
        metadata_heading_remap={},
        input_file_location="some/dir/metadata.csv",
    )

    service.s3_service = Mock()

    service.copy_metadata_to_dated_folder()

    expected_destination_key = "metadata/some/dir_2026-03-05_12-34.csv"

    service.s3_service.copy_across_bucket.assert_called_once_with(
        "staging-bucket",
        "some/dir/metadata.csv",
        "staging-bucket",
        expected_destination_key,
    )
    service.s3_service.delete_object.assert_called_once_with(
        "staging-bucket",
        "some/dir/metadata.csv",
    )
