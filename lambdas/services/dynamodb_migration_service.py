import importlib
import logging

import boto3

from scripts.MigrationBase import MigrationBase
from services.base.dynamo_service import DynamoDBService

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class DynamoDBMigrationService:
    """
    Unified service that:
      - Handles DynamoDB segmented scans.
      - Dynamically loads and executes migration logic.
      - Updates records via DynamoDBService.
    """

    def __init__(self, segment: int, total_segments: int, table_name: str,
                 environment: str, run_migration: bool, migration_script: str):
        self.segment = segment
        self.total_segments = total_segments
        self.table_name = table_name
        self.environment = environment
        self.run_migration = run_migration
        self.migration_script = migration_script

        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(self.table_name)
        self.dynamo_service = DynamoDBService()

        self.scanned_count = 0
        self.updated_count = 0
        self.skipped_count = 0
        self.error_count = 0

        logger.info(
            f"Initialized DynamoDBMigrationService for table '{self.table_name}' "
            f"(segment {self.segment}/{self.total_segments})"
        )


    def load_migration_instance(self):
        logger.info(f"Importing migration script: {self.migration_script}")
        migration_module = importlib.import_module(self.migration_script)

        migration_class = None
        for attr_name in dir(migration_module):
            attr = getattr(migration_module, attr_name)
            if isinstance(attr, type) and issubclass(attr, MigrationBase) and attr is not MigrationBase:
                migration_class = attr
                break

        if not migration_class:
            raise ValueError(f"No subclass of MigrationBase found in {self.migration_script}")

        migration_instance = migration_class(
            environment=self.environment,
            table_name=self.table_name,
            run_migration=self.run_migration
        )

        return migration_instance

    def scan_segment(self, last_evaluated_key=None):
        scan_kwargs = {
            "Segment": self.segment,
            "TotalSegments": self.total_segments
        }

        if last_evaluated_key:
            scan_kwargs["ExclusiveStartKey"] = last_evaluated_key

        response = self.table.scan(**scan_kwargs)
        items = response.get("Items", [])
        self.scanned_count += len(items)
        return response, items

    def process_items(self, migration_instance, items):
        if not items:
            logger.info(f"No items found for segment {self.segment}")
            return

        update_definitions = migration_instance.main(entries=items)

        for label, update_fn in update_definitions:
            logger.info(f"Executing migration step '{label}'")
            try:
                migration_instance.process_entries(
                    label=label,
                    entries=items,
                    update_fn=update_fn,
                )
                self.updated_count += len(items)
            except Exception as step_error:
                self.error_count += 1
                logger.error(f"Error in step '{label}' for segment {self.segment}: {step_error}", exc_info=True)


    def iterate_segment_items(self,migration_instance):
       last_evaluated_key = None

       while last_evaluated_key is not False:
           response, items = self.scan_segment(last_evaluated_key)
           self.process_items(migration_instance, items)

           last_evaluated_key = response.get("LastEvaluatedKey", False)


    def execute_migration(self):
        logger.info(f"Starting migration for segment {self.segment}/{self.total_segments}")
        migration_instance = self.load_migration_instance()
        self.iterate_segment_items(migration_instance)

        status = "SUCCEEDED" if self.error_count == 0 else "COMPLETED_WITH_ERRORS"

        result = {
            "segmentId": self.segment,
            "totalSegments": self.total_segments,
            "scannedCount": self.scanned_count,
            "updatedCount": self.updated_count,
            "skippedCount": self.skipped_count,
            "errorCount": self.error_count,
            "status": status,
        }

        logger.info(f"Segment {self.segment}/{self.total_segments} completed with status: {status}")
        return result
