from datetime import datetime, timezone

from openpyxl.workbook import Workbook
from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


class ExcelReportGenerator:
    def create_report_orchestration_xlsx(
        self,
        ods_code: str,
        records: list[dict],
        output_path: str,
    ) -> str:
        logger.info(
            f"Creating Excel report for ODS code {ods_code} and records {len(records)}",
        )

        wb = Workbook()
        ws = wb.active
        ws.title = "Daily Upload Report"

        # Report metadata
        ws.append([f"ODS Code: {ods_code}"])
        ws.append([f"Generated at (UTC): {datetime.now(timezone.utc).isoformat()}"])
        ws.append([])

        ws.append(
            [
                "NHS Number",
                "Date",
                "Uploader ODS",
                "PDS ODS",
                "Upload Status",
                "Reason",
                "File Path",
            ],
        )

        for record in records:
            ws.append(
                [
                    record.get("NhsNumber"),
                    record.get("Date"),
                    record.get("UploaderOdsCode"),
                    record.get("PdsOdsCode"),
                    record.get("UploadStatus"),
                    record.get("Reason"),
                    record.get("FilePath"),
                ],
            )

        wb.save(output_path)
        logger.info(f"Excel report written successfully for ods code {ods_code}")
        return output_path
