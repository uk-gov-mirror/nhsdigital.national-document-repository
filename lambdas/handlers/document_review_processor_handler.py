from models.sqs.review_message_body import ReviewMessageBody
from pydantic import ValidationError
from services.document_review_processor_service import ReviewProcessorService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging

logger = LoggingService(__name__)


@set_request_context_for_logging
@ensure_environment_variables(
    names=[
        "DOCUMENT_REVIEW_DYNAMODB_NAME",
        "STAGING_STORE_BUCKET_NAME",
        "PENDING_REVIEW_BUCKET_NAME",
    ]
)
@override_error_check
def lambda_handler(event, context):
    """
    This handler consumes SQS messages from the document review queue, creates DynamoDB
    records in the DocumentReview table, and moves files from the staging bucket
    to the pending review bucket.

    Args:
        event: Lambda event containing SQS Event
        context: Lambda context

    Returns:
        None
    """
    logger.info("Starting review processor Lambda")

    sqs_messages = event.get("Records", [])
    review_service = ReviewProcessorService()

    for sqs_message in sqs_messages:
        try:
            message = ReviewMessageBody.model_validate_json(sqs_message["body"])

            review_service.process_review_message(message)

        except ValidationError as error:
            logger.error("Malformed review message")
            logger.error(error)
            raise error

        except Exception as error:
            logger.error(
                f"Failed to process review message: {str(error)}",
                {"Result": "Review processing failed"},
            )
            raise error

        logger.info("Continuing to next message.")
