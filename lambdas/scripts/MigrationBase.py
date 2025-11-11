from abc import ABC, abstractmethod
from typing import Iterable, Callable
import boto3
import json
import os

from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import MigrationUnrecoverableException


class MigrationBase(ABC):
    name: str = "UnnamedMigration"
    description: str = "No description provided"
    target_table: str

    def __init__(self, environment: str, table_name: str, run_migration: bool = False):
        self.environment = environment
        self.table_name = table_name
        self.run_migration = run_migration
        self.target_table = f"{self.table_name}"
        self.s3_client = boto3.client("s3")
        self.failed_items_bucket = os.environ.get("MIGRATION_FAILED_ITEMS_STORE_BUCKET_NAME")
        if not self.failed_items_bucket:
            raise ValueError("MIGRATION_FAILED_ITEMS_STORE_BUCKET_NAME environment variable is required")

        self.logger = LoggingService(self.__class__.__name__)
        self.dynamo_service = DynamoDBService()

    @abstractmethod
    def main(self, entries: Iterable[dict]) -> list[tuple[str, Callable[[dict], dict | None]]]:
        pass

    def process_entries(
        self,
        label: str,
        entries: Iterable[dict],
        update_fn: Callable[[dict], dict | None],
        segment: int,
        execution_id: str
    ):
        """
        Processes a batch of DynamoDB entries for a given migration step.
        """
        self.logger.info(f"Running '{label}' migration step on {len(entries := list(entries))} items")
        successful_item_runs = 0
        skipped_items = 0
        failed_items = []

        for index, entry in enumerate(entries, start=1):
            result = self._process_single_entry(label, entry, update_fn, segment)
            if result == "skipped":
                skipped_items += 1
            elif result == "success":
                successful_item_runs += 1
            elif isinstance(result, dict):  # failed item
                failed_items.append(result)

        if failed_items:
            self._handle_failed_items(label, segment, execution_id, failed_items)

        self.logger.info(f"'{label}' migration step completed.\n")
        return {
            "successful_item_runs": successful_item_runs,
            "failed_items_count": len(failed_items),
            "skipped_items_count": skipped_items
        }

    def _process_single_entry(self, label, entry, update_fn, segment):
        item_id = entry.get("ID")
        self.logger.info(f"[{label}] Processing item (ID: {item_id})")
        try:
            updated_fields = update_fn(entry)
            if not updated_fields:
                self.logger.info(f"[{label}] Item {item_id} does not require update, skipping.")
                return "skipped"

            self.logger.info(f"[{label}] Item {item_id} update fields: {updated_fields}")

            if self.run_migration:
                self.dynamo_service.update_item(
                    table_name=self.target_table,
                    key_pair={"ID": item_id},
                    updated_fields=updated_fields,
                )
                self.logger.info(f"[{label}] Updated item {item_id}: {updated_fields}")
                return "success"
            else:
                self.logger.info(f"[Dry Run] Would update item {item_id} with {updated_fields}")
                return "success"

        except MigrationUnrecoverableException as e:
            self.logger.error(f"[{label}] Unrecoverable error for item {item_id} - segment {segment}: {e.message}")
            return {"item_id": item_id, "error": e.message}

        except Exception as e:
            self.logger.error(f"[{label}] Error processing item {item_id}: {str(e)}")
            raise

    def _handle_failed_items(self, label, segment, execution_id, failed_items):
        self.logger.error(f"'{label}' migration segment: {segment} completed with {len(failed_items)} errors.")
        error_report_key = f"{execution_id}/{segment}/{label}_errors.json"
        try:
            self.s3_client.put_object(
                Bucket=self.failed_items_bucket,
                Key=error_report_key,
                Body=json.dumps(failed_items).encode("utf-8"),
                ContentType='application/json'
            )
            self.logger.error(f"Error report saved to s3://{self.failed_items_bucket}/{error_report_key}")
        except Exception as s3_error:
            self.logger.error(f"Failed to save error report to S3: {str(s3_error)}")
            self.logger.error({"Unlogged failed items": failed_items})
            raise
