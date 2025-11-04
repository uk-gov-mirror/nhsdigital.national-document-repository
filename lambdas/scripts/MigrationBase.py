from abc import ABC, abstractmethod
from typing import Iterable, Callable
import boto3
import json
import os

from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService
from lambdas.utils.exceptions import MigrationUnrecoverableException, MigrationRetryableException


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
        segment: int
    ):
        """
        Processes a batch of DynamoDB entries for a given migration step.

        :param label: Descriptive name of the step (for logging)
        :param entries: List of DynamoDB items to process
        :param update_fn: Function that returns a dict of updated fields or None
        """
        self.logger.info(f"Running '{label}' migration step on {len(entries := list(entries))} items")
        successful_item_run = 0
        failed_items = []

        for index, entry in enumerate(entries, start=1):
            item_id = entry.get("ID")
            self.logger.info(f"[{label}] Processing item {index} (ID: {item_id})")

            try:
                updated_fields = update_fn(entry)
                if not updated_fields:
                    self.logger.debug(f"[{label}] Item {item_id} does not require update, skipping.")
                    continue

                if self.run_migration:
                    try:
                        self.dynamo_service.update_item(
                            table_name=self.target_table,
                            key_pair={"ID": item_id},
                            updated_fields=updated_fields,
                        )
                        self.logger.info(f"[{label}] Updated item {item_id}: {updated_fields}")
                        successful_item_run += 1
                    except Exception as e:
                        self.logger.error(f"[{label}] Failed to update item {item_id}: {str(e)}")
                else:
                    self.logger.info(f"[Dry Run] Would update item {item_id} with {updated_fields}")
                    successful_item_run += 1

            except MigrationUnrecoverableException as e:
                self.logger.error(f"[{label}] Unrecoverable error for item {item_id} - segment {segment}: {e.message}")
                failed_items.append({"item_id": item_id, "error": e.message})
                continue

            except Exception as e:
                self.logger.error(f"[{label}] Error processing item {item_id}: {str(e)}")
                raise

        if failed_items:
            self.logger.error(f"'{label}' migration step completed with {len(failed_items)} errors.")
            error_report_key = f"migration_errors/{label}_errors.json"
            self.s3_client.put_object(
                Bucket=self.failed_items_bucket,
                Key=error_report_key,
                Body=json.dumps(failed_items).encode("utf-8"),
                ContentType='application/json'
            )
            self.logger.error(f"Error report saved to s3://{self.failed_items_bucket}/{error_report_key}")      

        self.logger.info(f"'{label}' migration step completed.\n")
        return {
            "successful_item_run": successful_item_run,
            "failed_items_count": len(failed_items)
        }
