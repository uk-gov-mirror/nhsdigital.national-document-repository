import csv
from io import StringIO
from typing import Iterable

from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


class CsvReportGenerator:
    def generate_s3_inventory_csv(self, bucket: str, objects: Iterable[dict]) -> str:
        """
        Generates a CSV report for current S3 objects only (list_objects_v2).
        """
        logger.info(f"Generating S3 inventory CSV for bucket {bucket}")

        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(
            [
                "bucket",
                "key",
                "last_modified",
                "size",
                "etag",
                "storage_class",
                "tags",
            ],
        )

        for obj in objects:
            tags = obj.get("Tags", [])
            tag_str = ";".join(f"{t['Key']}={t['Value']}" for t in tags)

            writer.writerow(
                [
                    bucket,
                    obj["Key"],
                    obj["LastModified"].isoformat(),
                    obj.get("Size"),
                    obj.get("ETag"),
                    obj.get("StorageClass"),
                    tag_str,
                ],
            )

        logger.info(f"Finished CSV generation for {bucket}")
        return output.getvalue()
