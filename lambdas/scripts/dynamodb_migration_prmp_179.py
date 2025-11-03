from typing import Callable, Iterable

from lambdas.utils.exceptions import MigrationUnrecoverableException, MigrationRetryableException
from scripts.MigrationBase import MigrationBase
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service
from utils.audit_logging_setup import LoggingService


class S3MetadataMigration(MigrationBase):
    """
    Migration that ensures the following S3-related fields are correctly set:
    - FileSize (from S3 object ContentLength)
    - S3FileKey (from FileLocation)
    - S3VersionID (from S3 object VersionId)
    """

    name = "S3MetadataMigration"
    description = (
        "Ensures FileSize, S3FileKey, and S3VersionID fields are populated "
        "based on the S3 object metadata referenced in FileLocation."
    )

    def __init__(self, environment: str, table_name: str, run_migration: bool = False):
        super().__init__(environment, table_name, run_migration)
        self.logger = LoggingService(self.name)
        self.dynamo_service = DynamoDBService()
        self.s3_service = S3Service()

    def main(
        self, entries: Iterable[dict]
    ) -> list[tuple[str, Callable[[dict], dict | None]]]:
        """
        Main entry point for the migration.
        Returns a list of (label, update function) tuples.
        Accepts a list of entries for Lambda-based execution,
        or scans the table if `entries` is None.
        """

        self.logger.info("Starting S3 metadata migration")
        self.logger.info(f"Target table: {self.target_table}")
        self.logger.info(f"Dry run mode: {not self.run_migration}")

        if entries is None:
            self.logger.error("No entry provided.")
            raise MigrationRetryableException(
                message="Entries missing for segment worker", segment_id=None
            )

        return [("S3Metadata", self.get_updated_items)]

    def get_updated_items(self, entry: dict) -> dict | None:
        """
        Aggregates updates from all S3 update methods for a single entry.
        Returns a dict of fields to update, or None if no update is needed.
        """
        update_items = {}

        if s3_metadata_items := self.get_update_s3_metadata_items(entry):
            update_items.update(s3_metadata_items)

        return update_items if update_items else None

    def get_update_s3_metadata_items(self, entry: dict) -> dict | None:
        """
        Ensures that FileSize, S3FileKey, and S3VersionID fields
        are populated based on S3 object metadata.
        """
        file_location = entry.get("FileLocation")
        if not file_location:
            self.logger.warning(f"Missing FileLocation for entry: {entry.get('ID')}")
            raise MigrationUnrecoverableException(message="Missing FileLocation", item_id=entry.get("ID"))

        parsed = self.parse_s3_path(file_location)
        if not parsed:
            self.logger.warning(f"Invalid S3 path format: {file_location}")
            raise MigrationUnrecoverableException(message="Invalid S3 path format", item_id=entry.get("ID"))

        s3_bucket, s3_key = parsed
        metadata = self.get_s3_metadata(s3_bucket, s3_key)
        if not metadata:
            self.logger.warning(f"Could not retrieve S3 metadata for key: {s3_key}")
            raise MigrationUnrecoverableException(message="Could not retrieve S3 metadata", item_id=entry.get("ID"))

        content_length, version_id = metadata
        updated_fields = {}

        if entry.get("FileSize") is None and content_length is not None:
            updated_fields["FileSize"] = content_length

        if entry.get("S3FileKey") is None:
            updated_fields["S3FileKey"] = s3_key

        if entry.get("S3VersionID") is None and version_id is not None:
            updated_fields["S3VersionID"] = version_id

        return updated_fields if updated_fields else None

    @staticmethod
    def parse_s3_path(s3_path: str) -> tuple[str, str] | None:
        """Parses an S3 URI (s3://bucket/key) into (bucket, key)."""
        if not s3_path or not s3_path.startswith("s3://"):
            return None

        parts = s3_path.removeprefix("s3://").split("/", 1)
        if len(parts) != 2 or not parts[0] or not parts[1]:
            return None

        return parts[0], parts[1]

    def get_s3_metadata(self, bucket: str, key: str) -> tuple[int, str] | None:
        """Fetches object size and version from S3."""
        try:
            s3_head = self.s3_service.get_head_object(bucket, key)
            if s3_head:
                return s3_head.get("ContentLength"), s3_head.get("VersionId")
        except Exception as e:
            self.logger.error(f"Failed to retrieve S3 metadata for {key}: {e}")
            raise MigrationUnrecoverableException(message="Failed to retrieve S3 metadata", item_id=key)
        return None
