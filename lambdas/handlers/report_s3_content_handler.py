from services.reporting.report_s3_content_service import ReportS3ContentService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging

logger = LoggingService(__name__)


@ensure_environment_variables(
    names=["BULK_STAGING_BUCKET_NAME", "STATISTICAL_REPORTS_BUCKET"],
)
@override_error_check
@handle_lambda_exceptions
@set_request_context_for_logging
def lambda_handler(event, context):
    logger.info("Report S3 content lambda invoked")

    service = ReportS3ContentService()

    service.process_s3_content()
