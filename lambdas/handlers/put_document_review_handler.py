import json
from datetime import datetime, timezone

from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from models.document_review import PutDocumentReviewRequest
from pydantic import ValidationError
from services.put_document_review_service import PutDocumentReviewService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.decorators.validate_patient_id import validate_patient_id
from utils.lambda_exceptions import PutDocumentReviewException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)


@set_request_context_for_logging
@validate_patient_id
@ensure_environment_variables(
    names=[
        "DOCUMENT_REVIEW_DYNAMODB_NAME",
    ]
)
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, context):
    request_context.app_interaction = LoggingAppInteraction.UPDATE_REVIEW.value

    logger.info("Put Document Review handler has been triggered")

    query_params = event.get("queryStringParameters", {})
    patient_id = query_params.get("patient_id")

    if not patient_id:
        logger.error("Missing patient_id in query string parameters")
        raise PutDocumentReviewException(
            400, LambdaError.DocumentReferenceMissingParameters
        )

    path_params = event.get("pathParameters", {})
    document_id = path_params.get("id")

    if not document_id:
        logger.error("Missing id in path parameters")
        raise PutDocumentReviewException(
            400, LambdaError.DocumentReferenceMissingParameters
        )
    body = event.get("body")

    review_request = PutDocumentReviewRequest.model_validate_json(body)

    reviewer_ods_code = None
    if isinstance(request_context.authorization, dict):
        reviewer_ods_code = request_context.authorization.get(
            "selected_organisation", {}
        ).get("org_ods_code")

    if not reviewer_ods_code:
        logger.error("Missing ODS code in authorization token")
        raise PutDocumentReviewException(
            401, LambdaError.DocumentReferenceUnauthorised
        )

    document_review_service = PutDocumentReviewService()
    document_review_service.update_document_review(
        patient_id=patient_id,
        document_id=document_id,
        update_data=review_request,
        reviewer_ods_code=reviewer_ods_code,
    )

    logger.info(
        "Document review updated successfully",
        {"Result": "Successful document review update"},
    )
    return ApiGatewayResponse(
        200, "", "PUT"
    ).create_api_gateway_response()

