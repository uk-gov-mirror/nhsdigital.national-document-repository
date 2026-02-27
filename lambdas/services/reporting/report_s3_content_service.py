import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO

from services.base.s3_service import S3Service
from services.reporting.csv_report_generator_service import CsvReportGenerator
from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


class ReportS3ContentService:
    def __init__(self):
        self.bulk_staging_store = os.getenv("BULK_STAGING_BUCKET_NAME")
        self.statistic_reports_bucket = os.getenv("STATISTICAL_REPORTS_BUCKET")
        self.s3_service = S3Service()
        self.csv_generator = CsvReportGenerator()

    def _fetch_tags(self, bucket: str, obj: dict) -> dict:
        tags = self.s3_service.get_object_tags_versioned(bucket, obj["Key"], None)
        obj["Tags"] = tags
        return obj

    def process_s3_content(self):
        for bucket in [self.bulk_staging_store]:
            logger.info(f"Listing current objects for bucket {bucket}")

            objects = self.s3_service.list_all_objects(bucket)

            with ThreadPoolExecutor(max_workers=20) as executor:
                futures = [
                    executor.submit(self._fetch_tags, bucket, obj) for obj in objects
                ]
                for future in as_completed(futures):
                    future.result()

            logger.info(f"Generating CSV for bucket {bucket}")
            csv_content = self.csv_generator.generate_s3_inventory_csv(bucket, objects)

            logger.info(f"Uploading report for bucket {bucket}")
            self.s3_service.upload_file_obj(
                BytesIO(csv_content.encode("utf-8")),
                self.statistic_reports_bucket,
                f"s3-content-report/{bucket}-inventory.csv",
            )

            logger.info(f"Completed report for {bucket}")
