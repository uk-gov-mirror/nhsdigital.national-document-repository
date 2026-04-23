from services.statistical_report_service import StatisticalReportService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables_for_non_webapi
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check

logger = LoggingService(__name__)


@ensure_environment_variables_for_non_webapi(
    names=[
        "WORKSPACE",
        "STATISTICS_TABLE",
        "STATISTICAL_REPORTS_BUCKET",
    ],
)
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, _context):
    logger.info("Starting creating statistical report")
    start_date = event.get("start_date") if event else None
    end_date = event.get("end_date") if event else None
    service = StatisticalReportService(start_date=start_date, end_date=end_date)
    service.make_weekly_summary_and_output_to_bucket()
