from datetime import datetime, timezone

from services.reporting.report_s3_content_service import ReportS3ContentService


def test_process_s3_content(mocker):
    service = ReportS3ContentService()

    service.bulk_staging_store = "bucket-a"
    service.statistic_reports_bucket = "reports-bucket"

    service.s3_service = mocker.Mock()
    service.csv_generator = mocker.Mock()

    fake_objects = [
        {
            "Key": "file1.txt",
            "LastModified": datetime.now(tz=timezone.utc),
            "Size": 123,
            "ETag": "etag1",
            "StorageClass": "STANDARD",
        },
    ]

    service.s3_service.list_all_objects.return_value = fake_objects
    service.s3_service.get_object_tags_versioned.return_value = [
        {"Key": "autodelete", "Value": "true"},
    ]
    service.csv_generator.generate_s3_inventory_csv.return_value = "csv-data"

    service.process_s3_content()

    service.s3_service.list_all_objects.assert_called_once_with("bucket-a")

    service.s3_service.get_object_tags_versioned.assert_called_once_with(
        "bucket-a",
        "file1.txt",
        None,
    )

    service.csv_generator.generate_s3_inventory_csv.assert_called_once_with(
        "bucket-a",
        fake_objects,
    )

    service.s3_service.upload_file_obj.assert_called_once()
