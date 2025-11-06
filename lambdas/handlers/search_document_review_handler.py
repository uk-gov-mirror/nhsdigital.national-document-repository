import json

from enums.feature_flags import FeatureFlags
from enums.lambda_error import LambdaError
from services.feature_flags_service import FeatureFlagService
from services.search_document_review_service import SearchDocumentReviewService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.exceptions import OdsErrorException
from utils.lambda_exceptions import SearchDocumentReviewReferenceException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)


@set_request_context_for_logging
@ensure_environment_variables(names=["DOCUMENT_REVIEW_DYNAMODB_NAME"])
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, context):

    try:
        feature_flag_service = FeatureFlagService()
        upload_lambda_enabled_flag_object = feature_flag_service.get_feature_flags_by_flag(
            FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED
        )

        if not upload_lambda_enabled_flag_object[FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED]:
            logger.info("Feature flag not enabled, event will not be processed")
            raise SearchDocumentReviewReferenceException(404, LambdaError.FeatureFlagDisabled)

        ods_code = get_ods_code_from_request_context()

        limit, start_key = parse_querystring_parameters(event)

        search_document_reference_service = SearchDocumentReviewService()

        references, next_page_token = (
            search_document_reference_service.process_request(
                ods_code=ods_code, limit=limit, encoded_start_key=start_key
            )
        )

        return ApiGatewayResponse(
            status_code=200,
            body=json.dumps(
                {
                    "documentReviewReferences": references,
                    "nextPageToken": next_paged_token,
                    "count": len(references),
                }
            ),
            methods="GET",
        ).create_api_gateway_response()

    except OdsErrorException as e:
        logger.error(e)
        return ApiGatewayResponse(
            status_code=400,
            body=LambdaError.SearchDocumentReviewMissingODS.create_error_body(),
            methods="GET",
        ).create_api_gateway_response()


def get_ods_code_from_request_context():
    logger.info("Getting ODS code from request context")
    try:
        ods_code = request_context.authorization.get("selected_organisation", {}).get(
            "org_ods_code"
        )
        if not ods_code:
            raise OdsErrorException()

        return ods_code

    except AttributeError as e:
        logger.error(e)
        raise SearchDocumentReviewReferenceException(
            400, LambdaError.SearchDocumentReviewMissingODS
        )


def parse_querystring_parameters(event):
    logger.info("Parsing query string parameters.")
    params = event.get("queryStringParameters", {})
    if not params:
        return None, None

    limit = params.get("limit", None)
    start_key = params.get("startKey", None)

    return limit, start_key
