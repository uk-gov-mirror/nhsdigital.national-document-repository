from datetime import datetime, timezone

from openpyxl.workbook import Workbook

from models.report.bulk_upload_report import BulkUploadReport
from models.report.bulk_upload_report_output import OdsReport
from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


class ExcelReportGenerator:
    def create_report_orchestration_xlsx(
        self,
        ods_code: str,
        records: list[BulkUploadReport],
        output_path: str,
    ) -> str:
        logger.info(
            f"Creating Excel report for ODS code {ods_code} and records {len(records)}",
        )

        generated_at = datetime.now(timezone.utc)
        ods_report = self._build_ods_report(ods_code, records, generated_at)

        wb = Workbook()
        self._create_detail_sheet(wb, ods_code, records, generated_at)
        self._create_summary_sheet(wb, ods_report)

        wb.save(output_path)

        logger.info(f"Excel report written successfully for ods code {ods_code}")
        return output_path

    @staticmethod
    def _build_ods_report(
        ods_code: str,
        records: list[BulkUploadReport],
        generated_at: datetime,
    ) -> OdsReport:
        return OdsReport(
            generated_at=generated_at.strftime("%Y%m%d"),
            uploader_ods_code=ods_code,
            report_items=records,
        )

    def _create_detail_sheet(
        self,
        workbook: Workbook,
        ods_code: str,
        records: list[BulkUploadReport],
        generated_at: datetime,
    ) -> None:
        ws = workbook.active
        ws.title = "Daily Upload Report"

        self._append_detail_sheet_metadata(ws, ods_code, generated_at)
        self._append_detail_sheet_headers(ws)
        self._append_detail_sheet_rows(ws, records)

    @staticmethod
    def _append_detail_sheet_metadata(
        worksheet,
        ods_code: str,
        generated_at: datetime,
    ) -> None:
        worksheet.append([f"ODS Code: {ods_code}"])
        worksheet.append([f"Generated at (UTC): {generated_at.isoformat()}"])
        worksheet.append([])

    @staticmethod
    def _append_detail_sheet_headers(worksheet) -> None:
        worksheet.append(
            [
                "NHS Number",
                "Date",
                "Uploader ODS",
                "PDS ODS",
                "Upload Status",
                "Reason",
                "Sent to Review",
                "File Path",
            ],
        )

    @staticmethod
    def _append_detail_sheet_rows(
        worksheet,
        records: list[BulkUploadReport],
    ) -> None:
        for record in records:
            worksheet.append(
                [
                    record.nhs_number,
                    record.date,
                    record.uploader_ods_code,
                    record.pds_ods_code,
                    record.upload_status,
                    record.reason,
                    record.sent_to_review,
                    record.file_path,
                ],
            )

    def _create_summary_sheet(
        self,
        workbook: Workbook,
        ods_report: OdsReport,
    ) -> None:
        summary_ws = workbook.create_sheet(title="Summary")

        self._append_summary_headers(summary_ws)
        self._append_summary_totals(summary_ws, ods_report)
        self._append_summary_optional_totals(summary_ws, ods_report)
        self._append_summary_reason_rows(summary_ws, ods_report)

    @staticmethod
    def _append_summary_headers(worksheet) -> None:
        worksheet.append(["Type", "Description", "Count"])

    @staticmethod
    def _append_summary_totals(
        worksheet,
        ods_report: OdsReport,
    ) -> None:
        worksheet.append(
            ["Total", "Total Ingested", ods_report.get_total_ingested_count()],
        )
        worksheet.append(
            ["Total", "Total Successful", ods_report.get_total_successful()],
        )
        worksheet.append(
            ["Total", "Total In Review", ods_report.get_total_in_review_count()],
        )
        worksheet.append(
            ["Total", "Review Percentage", ods_report.get_total_in_review_percentage()],
        )
        worksheet.append(
            [
                "Total",
                "Successful Percentage",
                ods_report.get_total_successful_percentage(),
            ],
        )
        worksheet.append(
            [
                "Total",
                "Successful - Registered Elsewhere",
                ods_report.get_total_registered_elsewhere_count(),
            ],
        )
        worksheet.append(
            [
                "Total",
                "Successful - Suspended",
                ods_report.get_total_suspended_count(),
            ],
        )

    @staticmethod
    def _append_summary_optional_totals(
        worksheet,
        ods_report: OdsReport,
    ) -> None:
        if ods_report.get_total_deceased_count():
            worksheet.append(
                [
                    "Total",
                    "Successful - Deceased",
                    ods_report.get_total_deceased_count(),
                ],
            )

        if ods_report.get_total_restricted_count():
            worksheet.append(
                [
                    "Total",
                    "Successful - Restricted",
                    ods_report.get_total_restricted_count(),
                ],
            )

    @staticmethod
    def _append_summary_reason_rows(
        worksheet,
        ods_report: OdsReport,
    ) -> None:
        for row in ods_report.get_unsuccessful_reasons_data_rows():
            worksheet.append(row)
