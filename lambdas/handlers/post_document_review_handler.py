import json

from enums.feature_flags import FeatureFlags
from enums.lambda_error import LambdaError
from models.document_review import DocumentReviewUploadEvent
from pydantic import ValidationError
from services.feature_flags_service import FeatureFlagService
from services.post_document_review_service import PostDocumentReviewService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.exceptions import InvalidNhsNumberException, InvalidFileTypeException
from utils.lambda_exceptions import DocumentReviewLambdaException
from utils.lambda_response import ApiGatewayResponse

logger = LoggingService("__name__")


@set_request_context_for_logging
@ensure_environment_variables(
    names=[
        "STAGING_STORE_BUCKET_NAME",
        "PRESIGNED_ASSUME_ROLE",
        "EDGE_REFERENCE_TABLE",
        "CLOUDFRONT_URL",
    ]
)
@handle_lambda_exceptions
def lambda_handler(event, context):
    feature_flag_service = FeatureFlagService()
    feature_flag_service.validate_feature_flag(
        FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED
    )

    try:
        validated_event_body = validate_event_body(event["body"])
    except KeyError as e:
        logger.error(e)
        raise DocumentReviewLambdaException(
            400, LambdaError.DocumentReviewUploadInvalidRequest
        )

    post_document_review_service = PostDocumentReviewService()
    logger.info(f"Processing event: {event}.")
    response = post_document_review_service.process_event(event=validated_event_body)

    return ApiGatewayResponse(
        status_code=200, body=json.dumps(response), methods="POST"
    ).create_api_gateway_response()


def validate_event_body(body):
    try:
        event_body = DocumentReviewUploadEvent.model_validate_json(body)

        return event_body
    except (ValidationError, InvalidNhsNumberException) as e:
        logger.error(e)
        raise DocumentReviewLambdaException(
            400, LambdaError.DocumentReviewUploadInvalidRequest
        )
    except InvalidFileTypeException as e:
        logger.error(e)
        raise DocumentReviewLambdaException(
            400, LambdaError.DocumentReviewUnsupportedFileType
        )
