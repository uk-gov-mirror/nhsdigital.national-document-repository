from datetime import datetime, timezone

from services.reporting.csv_report_generator_service import CsvReportGenerator


def test_generate_s3_inventory_csv():
    generator = CsvReportGenerator()

    objects = [
        {
            "Key": "file1.txt",
            "LastModified": datetime(2024, 1, 1, tzinfo=timezone.utc),
            "Size": 123,
            "ETag": "etag1",
            "StorageClass": "STANDARD",
            "Tags": [{"Key": "autodelete", "Value": "true"}],
        },
    ]

    csv_output = generator.generate_s3_inventory_csv("bucket-a", objects)

    assert "bucket-a" in csv_output
    assert "file1.txt" in csv_output
    assert "autodelete=true" in csv_output
