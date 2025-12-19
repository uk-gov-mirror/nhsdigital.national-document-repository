import json

from enums.feature_flags import FeatureFlags
from enums.lambda_error import LambdaError
from services.feature_flags_service import FeatureFlagService
from services.review_document_status_check_service import (
    ReviewDocumentStatusCheckService,
)
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.exceptions import OdsErrorException
from utils.lambda_exceptions import DocumentReviewLambdaException
from utils.lambda_handler_utils import validate_review_path_parameters
from utils.lambda_response import ApiGatewayResponse
from utils.ods_utils import extract_ods_code_from_request_context

logger = LoggingService(__name__)


@ensure_environment_variables(
    names=["DOCUMENT_REVIEW_DYNAMODB_NAME"]
)
@set_request_context_for_logging
@handle_lambda_exceptions
def lambda_handler(event, context):
    """
        Lambda handler for checking the review status of a document in the review table
        Trigger by GET request to /DocumentReview/{id}/{version}/Status

    Args:
        event: API Gateway event containing path parameters {id} and {version}
        context: Lambda Context

    Returns:
        ApiGatewayResponse, body contains id, version and review status of reference searched for.
        401 - No ODS code or auth token provided in request.
        403 - User is not author of review entry.
        500 - Document Review Error, Internal Server Error.

    """
    try:

        feature_flag_service = FeatureFlagService()
        feature_flag_service.validate_feature_flag(
            FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED
        )

        ods_code = extract_ods_code_from_request_context()

        logger.info("Initialising Review Document Status Check service.")
        status_check_service = ReviewDocumentStatusCheckService()

        document_id, document_version = validate_review_path_parameters(event)
        body = status_check_service.get_document_review_status(
            ods_code=ods_code,
            document_id=document_id,
            document_version=document_version,
        )

        logger.info("Returning document review status.")
        return ApiGatewayResponse(
            status_code=200,
            body=json.dumps(body),
            methods="GET",
        ).create_api_gateway_response()

    except OdsErrorException:
        logger.error("Missing ODS code in request context.")
        raise DocumentReviewLambdaException(401, LambdaError.DocumentReviewMissingODS)
