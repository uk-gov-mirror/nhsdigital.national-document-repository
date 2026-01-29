import os
import tempfile
from datetime import datetime, timedelta, timezone

from repositories.reporting.reporting_dynamo_repository import ReportingDynamoRepository
from services.reporting.excel_report_generator_service import ExcelReportGenerator
from services.reporting.report_orchestration_service import ReportOrchestrationService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging

logger = LoggingService(__name__)


def calculate_reporting_window():
    now = datetime.now(timezone.utc)
    today_7am = now.replace(hour=7, minute=0, second=0, microsecond=0)

    if now < today_7am:
        today_7am -= timedelta(days=1)

    yesterday_7am = today_7am - timedelta(days=1)

    return (
        int(yesterday_7am.timestamp()),
        int(today_7am.timestamp()),
    )


@ensure_environment_variables(names=["BULK_UPLOAD_REPORT_TABLE_NAME"])
@override_error_check
@handle_lambda_exceptions
@set_request_context_for_logging
def lambda_handler(event, context):
    logger.info("Report orchestration lambda invoked")
    table_name = os.getenv("BULK_UPLOAD_REPORT_TABLE_NAME")

    repository = ReportingDynamoRepository(table_name)
    excel_generator = ExcelReportGenerator()

    service = ReportOrchestrationService(
        repository=repository,
        excel_generator=excel_generator,
    )

    window_start, window_end = calculate_reporting_window()
    tmp_dir = tempfile.mkdtemp()

    service.process_reporting_window(
        window_start_ts=window_start,
        window_end_ts=window_end,
        output_dir=tmp_dir,
    )
