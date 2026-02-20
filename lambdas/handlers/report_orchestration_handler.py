import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Tuple

from services.base.s3_service import S3Service
from services.reporting.report_orchestration_service import ReportOrchestrationService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging

logger = LoggingService(__name__)


def calculate_reporting_window() -> Tuple[int, int]:
    now = datetime.now(timezone.utc)
    today_7am = now.replace(hour=7, minute=0, second=0, microsecond=0)

    if now < today_7am:
        today_7am -= timedelta(days=1)

    yesterday_7am = today_7am - timedelta(days=1)
    return int(yesterday_7am.timestamp()), int(today_7am.timestamp())


def get_report_date_folder() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def build_s3_key(ods_code: str, report_date: str) -> str:
    return f"Report-Orchestration/{report_date}/{ods_code}.xlsx"


def upload_generated_reports(
    s3_service: S3Service,
    bucket: str,
    report_date: str,
    generated_files: Dict[str, str],
) -> list[str]:
    keys: list[str] = []
    for ods_code, local_path in generated_files.items():
        key = build_s3_key(ods_code, report_date)
        s3_service.upload_file_with_extra_args(
            file_name=local_path,
            s3_bucket_name=bucket,
            file_key=key,
            extra_args={"ServerSideEncryption": "aws:kms"},
        )
        keys.append(key)
        logger.info(f"Uploaded report for ODS={ods_code} to s3://{bucket}/{key}")
    return keys


def build_response(report_date: str, bucket: str, keys: list[str]) -> Dict[str, Any]:
    prefix = f"Report-Orchestration/{report_date}/"
    return {
        "status": "ok",
        "report_date": report_date,
        "bucket": bucket,
        "prefix": prefix,
        "keys": keys,
    }


@ensure_environment_variables(
    names=[
        "BULK_UPLOAD_REPORT_TABLE_NAME",
        "REPORT_BUCKET_NAME",
    ],
)
@override_error_check
@handle_lambda_exceptions
@set_request_context_for_logging
def lambda_handler(event, context) -> Dict[str, Any]:
    logger.info("Report orchestration lambda invoked")

    report_bucket = os.environ["REPORT_BUCKET_NAME"]
    orchestration_service = ReportOrchestrationService()
    s3_service = S3Service()

    window_start, window_end = calculate_reporting_window()
    report_date = get_report_date_folder()

    generated_files = orchestration_service.process_reporting_window(
        window_start_ts=window_start,
        window_end_ts=window_end,
    )

    if not generated_files:
        logger.info("No reports generated; exiting")
        return build_response(report_date=report_date, bucket=report_bucket, keys=[])

    keys = upload_generated_reports(
        s3_service=s3_service,
        bucket=report_bucket,
        report_date=report_date,
        generated_files=generated_files,
    )

    logger.info(
        f"Generated and uploaded {len(keys)} report(s) for report_date={report_date}",
    )
    return build_response(report_date=report_date, bucket=report_bucket, keys=keys)
