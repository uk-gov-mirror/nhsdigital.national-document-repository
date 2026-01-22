import tempfile
from collections import defaultdict

from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


class ReportOrchestrationService:
    def __init__(
        self,
        repository,
        excel_generator,
    ):
        self.repository = repository
        self.excel_generator = excel_generator

    def process_reporting_window(
        self,
        window_start_ts: int,
        window_end_ts: int,
        output_dir: str,
    ):
        records = self.repository.get_records_for_time_window(
            window_start_ts,
            window_end_ts,
        )
        if not records:
            logger.info("No records found for reporting window")
            return

        records_by_ods = self.group_records_by_ods(records)

        for ods_code, ods_records in records_by_ods.items():
            logger.info(
                f"Generating report for ODS ods_code = {ods_code} record_count = {len(ods_records)}"
            )
            self.generate_ods_report(ods_code, ods_records)
        logger.info("Report orchestration completed")

    @staticmethod
    def group_records_by_ods(records: list[dict]) -> dict[str, list[dict]]:
        grouped = defaultdict(list)
        for record in records:
            ods_code = record.get("UploaderOdsCode") or "UNKNOWN"
            grouped[ods_code].append(record)
        return grouped

    def generate_ods_report(
        self,
        ods_code: str,
        records: list[dict],
    ):
        with tempfile.NamedTemporaryFile(
            suffix=f"_{ods_code}.xlsx",
            delete=False,
        ) as tmp:
            self.excel_generator.create_report_orchestration_xlsx(
                ods_code=ods_code,
                records=records,
                output_path=tmp.name,
            )
