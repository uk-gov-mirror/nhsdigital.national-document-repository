import os
from typing import Any, Dict

from services.base.s3_service import S3Service
from services.email_service import EmailService
from services.ses_feedback_monitor_service import (
    SesFeedbackMonitorConfig,
    SesFeedbackMonitorService,
)
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging


def parse_alert_types(configured: str) -> set[str]:
    return {s.strip().upper() for s in configured.split(",") if s.strip()}


@override_error_check
@handle_lambda_exceptions
@set_request_context_for_logging
def lambda_handler(event, context) -> Dict[str, Any]:
    config = SesFeedbackMonitorConfig(
        feedback_bucket=os.environ["SES_FEEDBACK_BUCKET_NAME"],
        feedback_prefix=os.environ["SES_FEEDBACK_PREFIX"],
        prm_mailbox=os.environ["PRM_MAILBOX_EMAIL"],
        from_address=os.environ["SES_FROM_ADDRESS"],
        alert_on_event_types=parse_alert_types(os.environ["ALERT_ON_EVENT_TYPES"]),
    )

    s3_service = S3Service()

    service = SesFeedbackMonitorService(
        s3_service=s3_service,
        email_service=EmailService(),
        config=config,
    )
    return service.process_ses_feedback_event(event)
