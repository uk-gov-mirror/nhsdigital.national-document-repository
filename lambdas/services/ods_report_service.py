import os
import tempfile
from datetime import datetime
from typing import Any

from openpyxl.workbook import Workbook
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from enums.dynamo_filter import AttributeOperator
from enums.file_type import FileType
from enums.lambda_error import LambdaError
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.patient_ods_inactive_status import PatientOdsInactiveStatus
from enums.report_type import ReportType
from enums.repository_role import RepositoryRole
from models.document_review import DocumentUploadReviewReference
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service
from services.search_document_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import (
    FinalStatusAndNotSuperseded,
    get_not_deleted_filter,
)
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.lambda_exceptions import OdsReportException
from utils.request_context import request_context
from utils.utilities import (
    datetime_to_utc_iso_string,
    epoch_seconds_to_datetime_utc,
    iso_utc_string_to_datetime,
)

logger = LoggingService(__name__)


class OdsReportService:
    def __init__(self):
        self.dynamo_service = DynamoDBService()
        self.table_name = os.getenv("LLOYD_GEORGE_DYNAMODB_NAME")
        self.reports_bucket = os.getenv("STATISTICAL_REPORTS_BUCKET")
        self.temp_output_dir = ""
        download_report_aws_role_arn = os.getenv("PRESIGNED_ASSUME_ROLE")
        self.s3_service = S3Service(custom_aws_role=download_report_aws_role_arn)
        self.document_upload_review_service = DocumentUploadReviewService()

    def generate_ods_report(
        self,
        ods_code: str,
        is_pre_signed_needed: bool = False,
        is_upload_to_s3_needed: bool = False,
        file_type_output: FileType = FileType.CSV,
    ):
        document_items = self.query_table_by_index(ods_code)
        patient_rows = self.build_patient_rows(document_items)

        if is_upload_to_s3_needed:
            self.temp_output_dir = tempfile.mkdtemp()

        return self.create_and_save_ods_report(
            ods_code=ods_code,
            patient_rows=patient_rows,
            create_pre_signed_url=is_pre_signed_needed,
            upload_to_s3=is_upload_to_s3_needed,
            file_type_output=file_type_output,
        )

    def get_documents_for_review(
        self,
        ods_code: str,
        output_file_type: FileType = FileType.CSV,
    ):
        if output_file_type != FileType.CSV:
            raise OdsReportException(400, LambdaError.UnsupportedFileType)

        query_filter = self.document_upload_review_service.build_review_dynamo_filter()

        review_rows = self.document_upload_review_service.fetch_documents_from_table(
            search_key="Custodian",
            search_condition=ods_code,
            index_name="CustodianIndex",
            query_filter=query_filter,
        )

        self.temp_output_dir = tempfile.mkdtemp()

        return self.create_and_save_review_report(
            ods_code=ods_code,
            review_rows=review_rows,
            create_pre_signed_url=True,
            upload_to_s3=True,
        )

    def _upload_and_presign_if_needed(
        self,
        *,
        ods_code: str,
        file_name: str,
        local_file_path: str,
        upload_to_s3: bool,
        create_pre_signed_url: bool,
    ):
        if upload_to_s3:
            self.save_report_to_s3(ods_code, file_name, local_file_path)
            if create_pre_signed_url:
                return self.get_pre_signed_url(ods_code, file_name)
        return None

    def create_and_save_review_report(
        self,
        ods_code: str,
        review_rows: list[DocumentUploadReviewReference],
        create_pre_signed_url: bool = False,
        upload_to_s3: bool = False,
    ):
        file_name = self.get_file_name_for_report_type(
            ReportType.REVIEW,
            ods_code,
            len(review_rows),
            FileType.CSV,
        )

        local_file_path = os.path.join(self.temp_output_dir, file_name)

        self.create_review_csv_report(local_file_path, review_rows)

        logger.info(
            f"Query completed. {len(review_rows)} items written to {file_name}.",
        )

        return self._upload_and_presign_if_needed(
            ods_code=ods_code,
            file_name=file_name,
            local_file_path=local_file_path,
            upload_to_s3=upload_to_s3,
            create_pre_signed_url=create_pre_signed_url,
        )

    def scan_table_with_filter(self, ods_code: str):
        ods_codes = [ods_code]
        authorization_user = getattr(request_context, "authorization", {})
        if (
            authorization_user
            and authorization_user.get("repository_role") == RepositoryRole.PCSE.value
        ):
            ods_codes = [
                PatientOdsInactiveStatus.SUSPENDED,
                PatientOdsInactiveStatus.DECEASED,
            ]
        ods_filter_expression = self.build_filter_expression(ods_codes)
        field_names_expression = ",".join(DocumentReferenceMetadataFields.list())

        results = []
        response = self.dynamo_service.scan_whole_table(
            table_name=self.table_name,
            project_expression=field_names_expression,
            filter_expression=ods_filter_expression,
        )
        results.extend(response)
        if not results:
            logger.info("No records found for ODS code {}".format(ods_code))
            raise OdsReportException(404, LambdaError.NoDataFound)

        return results

    @staticmethod
    def build_filter_expression(ods_codes: list[str]):
        filter_builder = DynamoQueryFilterBuilder()
        delete_filter_expression = get_not_deleted_filter(filter_builder)
        filter_builder.add_condition("CurrentGpOds", AttributeOperator.IN, ods_codes)
        ods_code_filter_expression = filter_builder.build()
        return delete_filter_expression & ods_code_filter_expression

    def query_table_by_index(self, ods_code: str):
        ods_codes = [ods_code]
        authorization_user = getattr(request_context, "authorization", {})
        if (
            authorization_user
            and authorization_user.get("repository_role") == RepositoryRole.PCSE.value
        ):
            ods_codes = [
                PatientOdsInactiveStatus.SUSPENDED,
                PatientOdsInactiveStatus.DECEASED,
            ]
        results = []
        for ods_code in ods_codes:
            response = self.dynamo_service.query_table(
                table_name=self.table_name,
                index_name="OdsCodeIndex",
                search_key=DocumentReferenceMetadataFields.CURRENT_GP_ODS.value,
                search_condition=ods_code,
                query_filter=FinalStatusAndNotSuperseded,
            )
            results += response

        if not results:
            logger.info("No records found for ODS code {}".format(ods_code))
            raise OdsReportException(404, LambdaError.NoDataFound)
        return results

    def create_and_save_ods_report(
        self,
        ods_code: str,
        patient_rows: dict[str, dict[str, Any]],
        create_pre_signed_url: bool = False,
        upload_to_s3: bool = False,
        file_type_output: FileType = FileType.CSV,
    ):
        file_name, local_file_path = self.create_ods_report(
            ods_code=ods_code,
            patient_rows=patient_rows,
            file_type_output=file_type_output,
        )

        return self._upload_and_presign_if_needed(
            ods_code=ods_code,
            file_name=file_name,
            local_file_path=local_file_path,
            upload_to_s3=upload_to_s3,
            create_pre_signed_url=create_pre_signed_url,
        )

    def create_ods_report(
        self,
        ods_code: str,
        patient_rows: dict[str, dict[str, Any]],
        file_type_output: FileType = FileType.CSV,
    ):
        file_name = self.get_file_name_for_report_type(
            ReportType.PATIENT,
            ods_code,
            len(patient_rows),
            file_type_output,
        )

        local_file_path = os.path.join(self.temp_output_dir, file_name)
        match file_type_output:
            case FileType.CSV:
                self.create_csv_report(local_file_path, patient_rows, ods_code)
            case FileType.XLSX:
                self.create_xlsx_report(local_file_path, patient_rows, ods_code)
            case FileType.PDF:
                self.create_pdf_report(local_file_path, patient_rows, ods_code)
            case _:
                raise OdsReportException(400, LambdaError.UnsupportedFileType)

        return (file_name, local_file_path)

    def get_file_name_for_report_type(
        self,
        report_type: ReportType,
        ods_code: str,
        data_length: int,
        file_type_output: FileType,
    ):
        formatted_time = datetime.now().strftime("%Y-%m-%d_%H-%M")

        file_name_prepend = ""

        match report_type:
            case ReportType.PATIENT:
                file_name_prepend = "LloydGeorgeSummary_"
            case ReportType.REVIEW:
                file_name_prepend = "ReviewReport_"

        file_name = (
            file_name_prepend
            + ods_code
            + f"_{data_length}_"
            + formatted_time
            + "."
            + file_type_output
        )

        return file_name

    def create_review_csv_report(
        self,
        file_name: str,
        data: list[DocumentUploadReviewReference],
    ):
        headers = [
            "nhs_number",
            "review_reason",
            "document_snomed_code_type",
            "author",
            "upload_date",
        ]

        with open(file_name, "w") as f:
            full_line = ""
            for header in headers:
                full_line += f"{header},"
            full_line = full_line[:-1]
            f.write(f"{full_line}\n")

            for line in data:
                upload_date = datetime.fromtimestamp(line.upload_date).isoformat()
                f.write(
                    line.nhs_number
                    + ","
                    + line.review_reason
                    + ","
                    + line.document_snomed_code_type
                    + ","
                    + line.author
                    + ","
                    + upload_date
                    + "\n",
                )

    def build_patient_rows(
        self,
        document_items: list[dict],
    ) -> dict[str, dict[str, Any]]:
        rows: dict[str, dict[str, Any]] = {}

        for item in document_items:
            nhs_number = item.get(DocumentReferenceMetadataFields.NHS_NUMBER.value)
            if not nhs_number:
                logger.warning(f"No nhs number found in document_item: {item}")
                continue

            created_dt = iso_utc_string_to_datetime(
                item.get(DocumentReferenceMetadataFields.CREATED.value),
            )
            updated_dt = epoch_seconds_to_datetime_utc(
                item.get(DocumentReferenceMetadataFields.LAST_UPDATED.value),
            )

            current_row_for_patient = rows.get(nhs_number)
            if current_row_for_patient is None:
                rows[nhs_number] = {
                    "nhs_number": nhs_number,
                    "latest_created_date": created_dt,
                    "latest_updated_date": updated_dt,
                }
                continue

            if created_dt is not None and (
                current_row_for_patient["latest_created_date"] is None
                or created_dt > current_row_for_patient["latest_created_date"]
            ):
                current_row_for_patient["latest_created_date"] = created_dt

            if updated_dt is not None and (
                current_row_for_patient["latest_updated_date"] is None
                or updated_dt > current_row_for_patient["latest_updated_date"]
            ):
                current_row_for_patient["latest_updated_date"] = updated_dt

        return rows

    def create_csv_report(
        self,
        file_name: str,
        patient_rows: dict[str, dict[str, Any]],
        ods_code: str,
    ):
        with open(file_name, "w") as f:
            f.write(
                f"Total number of patients for ODS code {ods_code}: {len(patient_rows)}\n",
            )

            f.write("NHS Number,Latest Created Date,Latest Updated Date\n")
            for nhs in sorted(patient_rows.keys()):
                row = patient_rows[nhs]
                created = datetime_to_utc_iso_string(row.get("latest_created_date"))
                last_updated = datetime_to_utc_iso_string(
                    row.get("latest_updated_date"),
                )
                f.write(f"{nhs},{created},{last_updated}\n")

    def create_xlsx_report(
        self,
        file_name: str,
        patient_rows: dict[str, dict[str, Any]],
        ods_code: str,
    ):
        wb = Workbook()
        ws = wb.active
        ws["A1"] = (
            f"Total number of patients for ODS code {ods_code}: {len(patient_rows)}\n"
        )

        ws.append(["NHS Number", "Latest Created Date", "Latest Updated Date"])

        for nhs in sorted(patient_rows.keys()):
            row = patient_rows[nhs]
            ws.append(
                [
                    row.get("nhs_number", ""),
                    datetime_to_utc_iso_string(row.get("latest_created_date")),
                    datetime_to_utc_iso_string(row.get("latest_updated_date")),
                ],
            )

        ws.column_dimensions["A"].width = 14
        ws.column_dimensions["B"].width = 20
        ws.column_dimensions["C"].width = 20

        wb.save(file_name)

    def create_pdf_report(
        self,
        file_name: str,
        patient_rows: dict[str, dict[str, Any]],
        ods_code: str,
    ):
        c = canvas.Canvas(file_name, pagesize=letter)
        _, height = letter
        c.setFont("Helvetica-Bold", 16)
        x = 100
        y = 700
        c.drawString(x, height - 50, f"NHS numbers within NDR for ODS code: {ods_code}")
        c.setFont("Helvetica", 12)
        c.drawString(x, y, f"Total number of patients: {len(patient_rows)}")
        y -= 20
        c.drawString(x, y, "NHS Number | Latest Created Date | Latest Updated Date")
        y -= 20
        for nhs in sorted(patient_rows.keys()):
            if y < 40:
                c.showPage()
                c.setFont("Helvetica-Bold", 16)
                c.drawString(
                    x,
                    height - 50,
                    f"NHS numbers within NDR for ODS code: {ods_code}",
                )
                c.setFont("Helvetica", 12)
                y = height - 50

                y -= 40
                c.drawString(
                    x,
                    y,
                    "NHS Number | Latest Created Date | Latest Updated Date",
                )
                y -= 20

            row = patient_rows[nhs]
            created = datetime_to_utc_iso_string(row.get("latest_created_date"))
            last_updated = datetime_to_utc_iso_string(row.get("latest_updated_date"))

            line = f"{nhs} | {created} | {last_updated}"
            c.drawString(x, y, line[:120])
            y -= 20

        c.save()

    def save_report_to_s3(self, ods_code: str, file_name: str, temp_file_path: str):
        logger.info("Uploading the csv report to S3 bucket...")
        today = datetime.now().date()
        self.s3_service.upload_file(
            s3_bucket_name=self.reports_bucket,
            file_key=f"ods-reports/{ods_code}/{today.year}/{today.month}/{today.day}/{file_name}",
            file_name=temp_file_path,
        )

    def get_pre_signed_url(self, ods_code: str, file_name: str):
        today = datetime.now().date()
        return self.s3_service.create_download_presigned_url(
            s3_bucket_name=self.reports_bucket,
            file_key=f"ods-reports/{ods_code}/{today.year}/{today.month}/{today.day}/{file_name}",
        )
