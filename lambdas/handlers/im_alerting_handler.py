import json
import os

from services.im_alerting_service import IMAlertingService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.set_audit_arg import set_request_context_for_logging

logger = LoggingService(__name__)


@handle_lambda_exceptions
@set_request_context_for_logging
@ensure_environment_variables(
    names=[
        "APPCONFIG_APPLICATION",
        "APPCONFIG_CONFIGURATION",
        "TEAMS_WEBHOOK_URL",
        "CONFLUENCE_BASE_URL",
        "ALARM_HISTORY_DYNAMODB_NAME",
        "SLACK_CHANNEL_ID",
        "SLACK_BOT_TOKEN",
        "WORKSPACE",
        "VIRUS_SCANNER_TOPIC_ARN",
    ]
)
def lambda_handler(event, context):
    logger.info(f"Received event: {event}")
    alarm_notifications = event.get("Records", [])

    for sns_message in alarm_notifications:
        message = json.loads(sns_message["Sns"]["Message"])
        logger.info(f"Processing message: {message}")

        message_service = IMAlertingService(message)
        message_service.handle_alarm_alert()


def is_virus_scanner_topic(message):

    topic_arn = message.get("TopicArn", "")
    return topic_arn == os.environ["VIRUS_SCANNER_TOPIC_ARN"]
