from datetime import datetime
from typing import Callable, Iterable

from enums.metadata_field_names import DocumentReferenceMetadataFields
from scripts.MigrationBase import MigrationBase
from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService

Fields = DocumentReferenceMetadataFields


class BatchUpdate(MigrationBase):
    """
    Migration that ensures the following fields exist and are correctly set:
    - uploaded (bool)
    - uploading (bool)
    - lastUpdated (int timestamp)
    """

    name = "BatchUpdate"
    description = (
        "Adds or corrects missing fields: uploaded, uploading, and lastUpdated."
    )

    def __init__(self, environment: str, table_name: str, run_migration: bool = False):
        super().__init__(environment, table_name, run_migration)
        self.logger = LoggingService(self.name)
        self.dynamo_service = DynamoDBService()

    def main(
        self, entries: Iterable[dict]
    ) -> list[tuple[str, Callable[[dict], dict | None]]]:
        """
        Main entry point for the migration.
        Returns a list of (label, update function) tuples.
        Accepts a list of entries for Lambda-based execution, or scans the table if `entries` is None.
        """
        self.logger.info("Starting batch update migration")
        self.logger.info(f"Target table: {self.target_table}")
        self.logger.info(f"Dry run mode: {not self.run_migration}")

        if entries is None:
            self.logger.error("No entries provided after scanning entire table.")
            raise ValueError("Entries must be provided to main().")

        return [("AddMissingFields", self.get_updated_items)]

    def get_updated_items(self, entry: dict) -> dict | None:
        """
        Aggregates updates for a single item.
        Returns a dict of fields to update, or None if no update is needed.
        """
        doc_ref_id = entry.get(Fields.ID.value)
        created = entry.get(Fields.CREATED.value)
        timestamp_now = int(datetime.now().timestamp())

        fields_to_check = [
            Fields.UPLOADED.value,
            Fields.UPLOADING.value,
            Fields.LAST_UPDATED.value,
        ]

        need_update = any(entry.get(field) is None for field in fields_to_check)
        if not need_update:
            return None

        uploaded = True
        uploading = False
        try:
            last_updated = (
                int(datetime.fromisoformat(created).timestamp())
                if created
                else timestamp_now
            )
        except Exception as e:
            self.logger.warning(
                f"[{doc_ref_id}] Could not parse created timestamp '{created}': {e}. "
                f"Falling back to current timestamp."
            )
            last_updated = timestamp_now

        update_fields = {
            Fields.UPLOADED.value: uploaded,
            Fields.UPLOADING.value: uploading,
            Fields.LAST_UPDATED.value: last_updated,
        }

        self.logger.info(f"[{doc_ref_id}] Fields to update: {update_fields}")
        return update_fields
