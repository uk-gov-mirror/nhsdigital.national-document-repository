from pydantic import ValidationError

from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from models.document_review import PatchDocumentReviewRequest
from services.update_document_review_service import UpdateDocumentReviewService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.decorators.validate_patient_id import validate_patient_id
from utils.exceptions import OdsErrorException
from utils.lambda_exceptions import UpdateDocumentReviewException
from utils.lambda_handler_utils import validate_review_path_parameters
from utils.lambda_response import ApiGatewayResponse
from utils.ods_utils import extract_ods_code_from_request_context
from utils.request_context import request_context

logger = LoggingService(__name__)


@set_request_context_for_logging
@validate_patient_id
@ensure_environment_variables(
    names=[
        "DOCUMENT_REVIEW_DYNAMODB_NAME",
    ],
)
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, context):
    request_context.app_interaction = LoggingAppInteraction.UPDATE_REVIEW.value

    logger.info("Patch Document Review handler has been triggered")

    query_params = event.get("queryStringParameters", {})
    patient_id = query_params.get("patientId")

    if not patient_id:
        logger.error("Missing patient_id in query string parameters")
        raise UpdateDocumentReviewException(400, LambdaError.PatientIdNoKey)
    request_context.patient_nhs_no = patient_id

    document_id, document_version = validate_review_path_parameters(event)

    try:
        reviewer_ods_code = extract_ods_code_from_request_context()

    except OdsErrorException:
        raise UpdateDocumentReviewException(
            401,
            LambdaError.DocumentReferenceUnauthorised,
        )

    body = event.get("body")
    try:
        review_request = PatchDocumentReviewRequest.model_validate_json(body)
    except ValidationError as e:
        logger.error(f"Invalid request body: {str(e)}")
        raise UpdateDocumentReviewException(400, LambdaError.DocumentReviewInvalidBody)

    document_review_service = UpdateDocumentReviewService()
    document_review_service.update_document_review(
        patient_id=patient_id,
        document_id=document_id,
        document_version=document_version,
        update_data=review_request,
        reviewer_ods_code=reviewer_ods_code,
    )

    logger.info(
        "Document review updated successfully",
        {"Result": "Successful document review update"},
    )
    return ApiGatewayResponse(200, "", "PATCH").create_api_gateway_response()
