import os
from typing import Any, Dict

from enums.lambda_error import LambdaError
from enums.report_distribution_action import ReportDistributionAction
from services.reporting.report_distribution_service import ReportDistributionService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.lambda_exceptions import ReportDistributionException

logger = LoggingService(__name__)


@ensure_environment_variables(
    names=[
        "REPORT_BUCKET_NAME",
        "CONTACT_TABLE_NAME",
        "PRM_MAILBOX_EMAIL",
        "SES_FROM_ADDRESS",
        "SES_CONFIGURATION_SET",
    ],
)
@override_error_check
@handle_lambda_exceptions
@set_request_context_for_logging
def lambda_handler(event, context) -> Dict[str, Any]:
    action = event.get("action")
    if action not in {
        ReportDistributionAction.LIST,
        ReportDistributionAction.PROCESS_ONE,
    }:
        logger.error("Invalid action. Expected 'list' or 'process_one'.")
        raise ReportDistributionException(400, LambdaError.InvalidAction)

    bucket = event.get("bucket") or os.environ["REPORT_BUCKET_NAME"]

    service = ReportDistributionService(bucket=bucket)

    response = {"status": "ok", "bucket": bucket}

    if action == ReportDistributionAction.LIST:
        prefix = event["prefix"]
        keys = service.list_xlsx_keys(prefix=prefix)
        logger.info(f"List mode: returning {len(keys)} key(s) for prefix={prefix}")
        response.update({"prefix": prefix, "keys": keys})
    else:
        key = event["key"]
        ods_code = service.extract_ods_code_from_key(key)
        service.process_one_report(ods_code=ods_code, key=key)
        logger.info(f"Process-one mode: processed ods={ods_code}, key={key}")
        response.update({"key": key, "ods_code": ods_code})

    return response
