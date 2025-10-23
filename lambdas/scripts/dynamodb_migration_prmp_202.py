import argparse
from typing import Iterable, Callable

from enums.snomed_codes import SnomedCodes
from models.document_reference import DocumentReference
from scripts.MigrationBase import MigrationBase
from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService


class VersionMigration(MigrationBase):
    """
        Migration that ensures the following fields are correctly set:
        - Custodian matches CurrentGpOds
        - Status is 'current'
        - DocumentSnomedCodeType is the expected Lloyd George SNOMED code
        - DocStatus inferred from the document reference
        - Version set to '1'
        """

    name = "VersionMigration"
    description = (
        "Ensures Custodian, Status, DocumentSnomedCodeType, DocStatus, and Version fields "
        "are correctly populated."
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
        self.logger.info("Starting version migration")
        self.logger.info(f"Target table: {self.target_table}")
        self.logger.info(f"Dry run mode: {not self.run_migration}")

        if entries is None:
            self.logger.error("No entries provided after scanning entire table.")
            raise ValueError("Entries must be provided to main().")

        return [
            ("LGTableValues", self.get_updated_items)
        ]

    def get_updated_items(self, entry: dict) -> dict | None:
        """
        Aggregates updates from all update methods for a single entry.
        Returns a dict of fields to update, or None if no update is needed.
        """
        update_items = {}

        if custodian_update_items := self.get_update_custodian_items(entry):
            update_items.update(custodian_update_items)

        if status_update_items := self.get_update_status_items(entry):
            update_items.update(status_update_items)

        if snomed_code_update_items := self.get_update_document_snomed_code_type_items(entry):
            update_items.update(snomed_code_update_items)

        if doc_status_update_items := self.get_update_doc_status_items(entry):
            update_items.update(doc_status_update_items)

        if version_update_items := self.get_update_version_items(entry):
            update_items.update(version_update_items)

        return update_items if update_items else None

    def get_update_custodian_items(self, entry: dict) -> dict | None:
        """
        Updates the 'Custodian' field if it does not match 'CurrentGpOds'.
        Returns a dict with the update or None.
        """
        current_gp_ods = entry.get("CurrentGpOds")
        custodian = entry.get("Custodian")

        if current_gp_ods is None:
            self.logger.warning(f"[Custodian] CurrentGpOds is missing for item {entry.get('ID')}")
            return None
        if current_gp_ods is None or current_gp_ods != custodian:
            return {"Custodian": current_gp_ods}

        return None

    @staticmethod
    def get_update_status_items(entry: dict) -> dict | None:
        """
        Ensures the 'Status' field is set to 'current'.
        Returns a dict with the update or None.
        """
        if entry.get("Status") != "current":
            return {"Status": "current"}
        return None

    @staticmethod
    def get_update_document_snomed_code_type_items(entry: dict) -> dict | None:
        """
        Ensures the 'DocumentSnomedCodeType' field matches the expected SNOMED code.
        Returns a dict with the update or None.
        """
        expected_code = SnomedCodes.LLOYD_GEORGE.value.code
        if entry.get("DocumentSnomedCodeType") != expected_code:
            return {"DocumentSnomedCodeType": expected_code}
        return None

    @staticmethod
    def get_update_version_items(entry: dict) -> dict | None:
        """
        Ensures the 'Version' field matches the expected Version code.
        Returns a dict with the update or None.
        """
        expected_version = "1"
        version_field = "Version"
        if entry.get(version_field) != expected_version:
            return {version_field: expected_version}
        return None

    def get_update_doc_status_items(self, entry: dict) -> dict | None:
        """
        Infers and updates the 'DocStatus' field if missing.
        Returns a dict with the update or None.
        """
        try:
            document = DocumentReference(**entry)
        except Exception as e:
            self.logger.warning(f"[DocStatus] Skipping invalid item {entry.get('ID')}: {e}")
            return None

        inferred_status = document.infer_doc_status()

        if entry.get("uploaded") and entry.get("uploading"):
            self.logger.warning(f"{entry.get('ID')}: Document has a status of uploading and uploaded.")

        if entry.get("DocStatus", "") == inferred_status:
            return None

        self.logger.warning(f"{entry.get('ID')}: {inferred_status}")

        if inferred_status:
            return {"DocStatus": inferred_status}

        self.logger.warning(f"[DocStatus] Cannot determine status for item {entry.get('ID')}")
        return None

