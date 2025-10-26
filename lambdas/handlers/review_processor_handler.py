import json
from lambdas.models.sqs.review_message_body import ReviewMessageBody
# from services.review_processor_service import ReviewProcessorService // TODO
from lambdas.services.review_processor_service import ReviewProcessorService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.decorators.validate_sqs_message_event import validate_sqs_event
from utils.lambda_response import ApiGatewayResponse

logger = LoggingService(__name__)


@set_request_context_for_logging
@override_error_check
@ensure_environment_variables(
    names=[
        "DOCUMENT_REVIEW_DYNAMODB_NAME",
        "STAGING_STORE_BUCKET_NAME",
        "PENDING_REVIEW_BUCKET_NAME",
    ]
)
@handle_lambda_exceptions
@validate_sqs_event
def lambda_handler(event, context):
    """
    This handler consumes SQS messages from the document review queue, creates DynamoDB
    records in the DocumentReview table, and moves files from the staging bucket
    to the pending review bucket.

    Args:
        event: Lambda event containing SQS Event
        _context: Lambda context

    Returns:
        ApiGatewayResponse with processing status
    """
    logger.info("Starting review processor Lambda")

    sqs_messages = event.get("Records", [])
    review_service = ReviewProcessorService()

    processed_count = 0
    failed_count = 0

    for sqs_message in sqs_messages:
        try:
            sqs_message_body = json.loads(sqs_message["body"])
            review_message = ReviewMessageBody(**sqs_message_body)

            message = ReviewMessageBody.model_validate(review_message)

            review_service.process_review_message(message)
            processed_count += 1
        except Exception as e:
            logger.error(
                f"Failed to process review message: {str(e)}",
                {"Result": "Review processing failed"},
            )
            failed_count += 1

            raise

    logger.info(
        f"Review processor completed: {processed_count} processed, {failed_count} failed"
    )

    return ApiGatewayResponse(
        status_code=200,
        body=f"Processed {processed_count} messages",
        methods="GET",
    ).create_api_gateway_response()
