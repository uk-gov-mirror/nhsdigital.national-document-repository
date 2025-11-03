import json

from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from services.get_document_review_service import GetDocumentReviewService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.decorators.validate_patient_id import validate_patient_id
from utils.lambda_exceptions import GetDocumentReviewException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)


@set_request_context_for_logging
@validate_patient_id
@ensure_environment_variables(
    names=[
        "DOCUMENT_REVIEW_DYNAMODB_NAME",
        "PRESIGNED_ASSUME_ROLE",
        "EDGE_REFERENCE_TABLE",
        "CLOUDFRONT_URL",
    ]
)
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, context):
    request_context.app_interaction = LoggingAppInteraction.VIEW_PATIENT.value

    logger.info("Get Document Review handler has been triggered")

    # Extract patient_id from query string parameters
    query_params = event.get("queryStringParameters", {})
    patient_id = query_params.get("patientId", "")

    if not patient_id:
        logger.error("Missing patient_id in query string parameters")
        raise GetDocumentReviewException(
            400, LambdaError.DocumentReferenceMissingParameters
        )

    # Extract id from path parameters
    path_params = event.get("pathParameters", {})
    document_id = path_params.get("id")

    if not document_id:
        logger.error("Missing id in path parameters")
        raise GetDocumentReviewException(
            400, LambdaError.DocumentReferenceMissingParameters
        )

    request_context.patient_nhs_no = patient_id

    logger.info(
        f"Retrieving document review for patient_id: {patient_id}, document_id: {document_id}"
    )

    # Get document review service
    document_review_service = GetDocumentReviewService()
    document_review = document_review_service.get_document_review(
        patient_id=patient_id, document_id=document_id
    )

    if document_review:
        logger.info(
            "Document review retrieved successfully",
            {"Result": "Successful document review retrieval"},
        )
        return ApiGatewayResponse(
            200, json.dumps(document_review), "GET"
        ).create_api_gateway_response()
    else:
        logger.error(
            "Document review not found",
            {"Result": "No document review available"},
        )
        return ApiGatewayResponse(
            404,
            LambdaError.DocumentReferenceNotFound.create_error_body(),
            "GET",
        ).create_api_gateway_response()
