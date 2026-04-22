import json

from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from services.get_document_reference_service import GetDocumentReferenceService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.decorators.validate_patient_id import validate_patient_id
from utils.lambda_exceptions import GetDocumentRefException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)


@validate_patient_id
@handle_lambda_exceptions
@set_request_context_for_logging
@ensure_environment_variables(
    names=[
        "LLOYD_GEORGE_DYNAMODB_NAME",
        "PRESIGNED_ASSUME_ROLE",
        "APPCONFIG_APPLICATION",
        "APPCONFIG_ENVIRONMENT",
        "APPCONFIG_CONFIGURATION",
        "EDGE_REFERENCE_TABLE",
        "CLOUDFRONT_URL",
    ],
)
@override_error_check
def lambda_handler(event: dict[str, any], context):
    request_context.app_interaction = LoggingAppInteraction.GET_DOCUMENT.value

    logger.info("Starting document fetch by ID process")

    document_id = event["pathParameters"].get("id")
    nhs_number = event["queryStringParameters"].get("patientId")
    version = event["pathParameters"].get("version", None)

    if not document_id or not nhs_number:
        raise GetDocumentRefException(
            400,
            LambdaError.DocumentReferenceMissingParameters,
        )

    request_context.patient_nhs_no = nhs_number

    service = GetDocumentReferenceService()

    document_info = service.get_document_url_by_id(document_id, nhs_number, version)

    logger.info("Document fetch by ID process completed")
    return ApiGatewayResponse(
        status_code=200,
        body=json.dumps(document_info),
        methods="GET",
    ).create_api_gateway_response()
