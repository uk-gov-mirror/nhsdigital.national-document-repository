import base64
import json

from services.search_document_review_service import SearchDocumentReviewService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.exceptions import OdsErrorException, SearchDocumentReviewReferenceException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)

@set_request_context_for_logging
@ensure_environment_variables(names=["DOCUMENT_REVIEW_DYNAMODB_NAME"])
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, context):

    try:
        ods_code = get_ods_code_from_request_context()

        limit, start_key = parse_querystring_parameters(event)

        service = SearchDocumentReviewService()

        references, last_evaluated_key = service.get_review_document_references(
            ods_code=ods_code, limit=limit
        )

        return ApiGatewayResponse(
            status_code=200,
            body=json.dumps(
                {
                    "documentReviewReferences": [
                        reference.model_dump_json(exclude_none=True, include={"id", "nhs_number", "review_reason"}) for reference in references
                    ],
                    "lastEvaluatedKey": base64.b64encode(last_evaluated_key.encode("ascii")).decode("utf-8") if last_evaluated_key else None,
                    "count": len(references),
                }
            ),
            methods="GET",
        ).create_api_gateway_response()

    except OdsErrorException as e:
        logger.error(e)
        return ApiGatewayResponse(
            status_code=400, body="No ODS code provided.", methods="GET"
        ).create_api_gateway_response()

    except SearchDocumentReviewReferenceException as e:
        logger.error(e)
        return ApiGatewayResponse(
            status_code=500,
            body="Error retrieving for document review references.",
            methods="GET",
        ).create_api_gateway_response()


def get_ods_code_from_request_context():
    logger.info("Getting ODS code from request context")
    ods_code = request_context.authorization.get("selected_organisation", {}).get(
        "org_ods_code"
    )
    if not ods_code:
        raise OdsErrorException("No ODS code provided")

    return ods_code


def parse_querystring_parameters(event):
    logger.info("Parsing query string parameters.")
    params = event.get("queryStringParameters", {})
    if not params:
        return None, None

    limit = params.get("limit", None)
    encoded_start_key = params.get("startKey", None)
    start_key = base64.b64decode(encoded_start_key.encode("ascii")).decode("utf-8") if encoded_start_key else None

    return limit, start_key
