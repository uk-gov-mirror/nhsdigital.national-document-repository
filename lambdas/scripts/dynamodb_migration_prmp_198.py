import os
from typing import Callable, Iterable

from scripts.MigrationBase import MigrationBase
from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService
from lambdas.utils.exceptions import MigrationUnrecoverableException, MigrationRetryableException


class AuthorMigration(MigrationBase):
    """
    Migration that ensures the 'Author' field is correctly populated
    based on the latest completed bulk upload report for each NHS number.
    Skips deleted items and ensures no overwrites of existing Author values.
    """

    name = "AuthorMigration"
    description = (
        "Populates the 'Author' field in Lloyd George Reference records "
        "from the most recent completed BulkUploadReport entry for each NHS number."
    )

    def __init__(self, environment: str, table_name: str, run_migration: bool = False):
        super().__init__(environment, table_name, run_migration)
        self.logger = LoggingService(self.name)
        self.dynamo_service = DynamoDBService()
        self.bulk_upload_lookup: dict[str, dict] | None = None

        workspace = os.environ.get("WORKSPACE", self.environment)
        self.bulk_upload_report_table = f"{workspace}_BulkUploadReport"

    def main(
        self, entries: Iterable[dict]
    ) -> list[tuple[str, Callable[[dict], dict | None]]]:
        """
        Main entry point for the migration.
        Returns a list of (label, update function) tuples.
        """
        self.logger.info("Starting Author field migration")
        self.logger.info(f"Target table: {self.target_table}")
        self.logger.info(f"Dry run mode: {self.run_migration}")

        if entries is None:
            self.logger.error("No entries provided — expected a list of table items.")
            raise MigrationRetryableException(
                message="Entries missing for segment worker", segment_id=None
            )

        return [("Author", self.get_update_author_items)]

    def get_update_author_items(self, entry: dict) -> dict | None:
        """
        Determines whether the 'Author' field should be updated.
        Returns a dict with the update or None if no update is needed.
        """
        current_author = entry.get("Author")
        deleted_value = entry.get("Deleted")
        nhs_number = entry.get("NhsNumber")

        if current_author:
            return None

        if deleted_value not in (None, ""):
            self.logger.debug(
                f"[Author] Skipping {nhs_number}: Deleted field not empty ({deleted_value})."
            )
            return None

        if self.bulk_upload_lookup is None:
            self.bulk_upload_lookup = self.build_bulk_upload_lookup()

        bulk_upload_row = self.bulk_upload_lookup.get(nhs_number)
        if not bulk_upload_row:
            self.logger.warning(
                f"No completed bulk upload found for NHS number: {nhs_number}"
            )
            raise MigrationUnrecoverableException(
                message=f"No completed bulk upload found for NHS number: {nhs_number}", item_id=entry.get("ID")
            )

        new_author = bulk_upload_row.get("UploaderOdsCode")
        if not new_author:
            self.logger.warning(
                f"No uploader ODS code found for NHS number: {nhs_number}"
            )
            raise MigrationUnrecoverableException(
                message=f"No uploader ODS code found for NHS number: {nhs_number}", item_id=entry.get("ID")
            )

        return {"Author": new_author}

    def build_bulk_upload_lookup(self) -> dict[str, dict]:
        """
        Creates a lookup of the most recent completed bulk upload reports by NHS number.
        """
        self.logger.info("Building bulk upload lookup from BulkUploadReport table...")
        bulk_reports = self.dynamo_service.scan_whole_table(
            self.bulk_upload_report_table
        )
        lookup: dict[str, dict] = {}

        for row in bulk_reports:
            nhs = row.get("NhsNumber")
            status = row.get("UploadStatus")
            timestamp = row.get("Timestamp")

            if not nhs or status != "complete" or not timestamp:
                continue

            stored = lookup.get(nhs)
            if not stored or int(timestamp) > int(stored.get("Timestamp", 0)):
                lookup[nhs] = row

        self.logger.info(f"Loaded {len(lookup)} completed bulk upload entries.")
        return lookup
