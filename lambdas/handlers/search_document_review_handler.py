import json

from enums.document_review_accepted_querystring_parameters import (
    DocumentReviewQuerystringParameters,
)
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
from utils.lambda_exceptions import DocumentReviewException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)


@set_request_context_for_logging
@ensure_environment_variables(names=["DOCUMENT_REVIEW_DYNAMODB_NAME"])
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, context):
    """
        Lambda handler for searching documents pending review by custodian.
        Triggered by GET request to /SearchDocumentReview endpoint.
    Args:
        event: API Gateway event containing query optional query string parameters
               QueryStringParameters: limit - Limit for DynamoDB query, defaulted to 50 if not provided,
                                      nhsNumber - Patient NHS number, used for filtering DynamoDB results,
                                      uploader - Author ODS code, used for filtering DynamoDB results,
                                      nextPageToken - Encoded exclusive start key used to query DynamoDB for next page of results.
        context: Lambda context

    Returns:
        API Gateway response containing Document Review references, number of reference returned, and next page token if present.
        401 - No ODS code or auth token provided in request.
        500 - Document Review Error, Internal Server Error.

    """
    try:
        feature_flag_service = FeatureFlagService()
        upload_lambda_enabled_flag_object = (
            feature_flag_service.get_feature_flags_by_flag(
                FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED
            )
        )

        if not upload_lambda_enabled_flag_object[
            FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED
        ]:
            logger.info("Feature flag not enabled, event will not be processed")
            raise DocumentReviewException(403, LambdaError.FeatureFlagDisabled)

        ods_code = get_ods_code_from_request_context()

        params = parse_querystring_parameters(event)

        search_document_reference_service = SearchDocumentReviewService()

        references, next_page_token = search_document_reference_service.process_request(
            params=params, ods_code=ods_code
        )

        response = {"documentReviewReferences": references, "count": len(references)}

        if next_page_token:
            response["nextPageToken"] = next_page_token

        return ApiGatewayResponse(
            status_code=200,
            body=json.dumps(response),
            methods="GET",
        ).create_api_gateway_response()

    except OdsErrorException as e:
        logger.error(e)
        return ApiGatewayResponse(
            status_code=401,
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
        raise DocumentReviewException(401, LambdaError.SearchDocumentReviewMissingODS)


def parse_querystring_parameters(event):
    logger.info("Parsing query string parameters.")
    params = event.get("queryStringParameters", {})

    extracted_params = {}

    if not params:
        return extracted_params

    for param in DocumentReviewQuerystringParameters:
        if param in params:
            extracted_params[param.value] = params.get(param)

    return extracted_params
