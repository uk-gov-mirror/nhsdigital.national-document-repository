import tempfile
from collections import defaultdict
from typing import Dict, List

from pydantic import ValidationError

from models.report.bulk_upload_report import BulkUploadReport
from repositories.reporting.reporting_dynamo_repository import ReportingDynamoRepository
from services.reporting.excel_report_generator_service import ExcelReportGenerator
from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


class ReportOrchestrationService:
    def __init__(self):
        self.repository = ReportingDynamoRepository()
        self.excel_generator = ExcelReportGenerator()

    def process_reporting_window(
        self,
        window_start_ts: int,
        window_end_ts: int,
    ) -> Dict[str, str]:
        filtered_records = self.repository.get_records_for_time_window(
            window_start_ts,
            window_end_ts,
        )

        if not filtered_records:
            logger.info("No records found for reporting window")
            return {}

        filtered_records = [
            record
            for record in filtered_records
            if "expedite" not in (record.get("FilePath") or "").lower()
        ]

        if not filtered_records:
            logger.info(
                "No records found for reporting window after excluding expedite files",
            )
            return {}

        records: List[BulkUploadReport] = []
        for record in filtered_records:
            try:
                records.append(BulkUploadReport.model_validate(record))
            except ValidationError as e:
                logger.error(f"Skipping invalid record in reporting orchestration: {e}")

        if not records:
            logger.info("No valid records after validation")
            return {}

        records_by_ods = self.group_records_by_ods(records)
        generated_files: Dict[str, str] = {}

        for ods_code, ods_records in records_by_ods.items():
            logger.info(
                f"Generating report for ODS={ods_code}, records={len(ods_records)}",
            )
            file_path = self.generate_ods_report(ods_code, ods_records)
            generated_files[ods_code] = file_path

        logger.info(f"Generated {len(generated_files)} report(s)")
        return generated_files

    @staticmethod
    def group_records_by_ods(
        records: List[BulkUploadReport],
    ) -> dict[str, List[BulkUploadReport]]:
        grouped = defaultdict(list)
        for record in records:
            ods_code = record.uploader_ods_code or "UNKNOWN"
            grouped[ods_code].append(record)
        return grouped

    def generate_ods_report(
        self,
        ods_code: str,
        records: List[BulkUploadReport],
    ) -> str:
        with tempfile.NamedTemporaryFile(
            suffix=f"_{ods_code}.xlsx",
            delete=False,
        ) as tmp:
            self.excel_generator.create_report_orchestration_xlsx(
                ods_code=ods_code,
                records=records,
                output_path=tmp.name,
            )
            return tmp.name
