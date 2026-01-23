import os
from typing import Any, Dict

from repositories.reporting.report_contact_repository import ReportContactRepository
from services.base.s3_service import S3Service
from services.email_service import EmailService
from services.reporting.report_distribution_service import ReportDistributionService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging

logger = LoggingService(__name__)


@ensure_environment_variables(
    names=[
        "REPORT_BUCKET_NAME",
        "CONTACT_TABLE_NAME",
        "PRM_MAILBOX_EMAIL",
        "SES_FROM_ADDRESS",
    ]
)
@override_error_check
@handle_lambda_exceptions
@set_request_context_for_logging
def lambda_handler(event, context) -> Dict[str, Any]:
    action = event.get("action")
    if action not in {"list", "process_one"}:
        raise ValueError("Invalid action. Expected 'list' or 'process_one'.")

    bucket = event.get("bucket") or os.environ["REPORT_BUCKET_NAME"]
    contact_table = os.environ["CONTACT_TABLE_NAME"]
    prm_mailbox = os.environ["PRM_MAILBOX_EMAIL"]
    from_address = os.environ["SES_FROM_ADDRESS"]

    s3_service = S3Service()
    contact_repo = ReportContactRepository(contact_table)
    email_service = EmailService()

    service = ReportDistributionService(
        s3_service=s3_service,
        contact_repo=contact_repo,
        email_service=email_service,
        bucket=bucket,
        from_address=from_address,
        prm_mailbox=prm_mailbox,
    )

    if action == "list":
        prefix = event["prefix"]
        keys = service.list_xlsx_keys(prefix=prefix)
        logger.info(f"List mode: returning {len(keys)} key(s) for prefix={prefix}")
        return {"bucket": bucket, "prefix": prefix, "keys": keys}

    key = event["key"]
    ods_code = service.extract_ods_code_from_key(key)
    service.process_one_report(ods_code=ods_code, key=key)
    logger.info(f"Process-one mode: processed ods={ods_code}, key={key}")
    return {"status": "ok", "bucket": bucket, "key": key, "ods_code": ods_code}
