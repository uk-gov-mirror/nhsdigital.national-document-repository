from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from services.feature_flags_service import FeatureFlagService
from enums.feature_flags import FeatureFlags
from services.get_document_reference_service import GetDocumentReferenceService
from utils.decorators.validate_patient_id import validate_patient_id
from utils.lambda_exceptions import FeatureFlagsException
from enums.lambda_error import LambdaError
from utils.lambda_exceptions import GetDocumentRefException
from utils.lambda_response import ApiGatewayResponse
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.set_audit_arg import set_request_context_for_logging
from enums.logging_app_interaction import LoggingAppInteraction
from utils.audit_logging_setup import LoggingService
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
    ]
)
@override_error_check
def lambda_handler(event: dict[str, any], context):
    request_context.app_interaction = LoggingAppInteraction.VIEW_LG_RECORD.value

    feature_flag_service = FeatureFlagService()
    feature_flag = FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED
    upload_document_iteration_3_feature_flag = feature_flag_service.get_feature_flags_by_flag(
        feature_flag
    )

    if not upload_document_iteration_3_feature_flag[feature_flag]:
        logger.error("Upload document iteration 3 feature flag disabled")
        raise FeatureFlagsException(404, LambdaError.FeatureFlagDisabled)
    
    logger.info("Starting document fetch by ID process")

    path_params = event.get("pathParameters", {}).get("id", None)
    document_id, snomed_code = get_id_and_snomed_from_path_parameters(path_params)
    nhs_number = event.get("queryStringParameters", {}).get("patientId", None)

    if not document_id or not snomed_code or not nhs_number:
        raise GetDocumentRefException(400, LambdaError.DocumentReferenceMissingParameters)
    
    service = GetDocumentReferenceService()

    presigned_s3_url = service.get_document_url_by_id(document_id, snomed_code, nhs_number)

    return ApiGatewayResponse(
        status_code=200, body=presigned_s3_url, methods="GET"
    ).create_api_gateway_response()

def get_id_and_snomed_from_path_parameters(path_parameters):
    """Extract document ID and SNOMED code from path parameters"""
    if path_parameters:
        params = path_parameters.split("~")
        if len(params) == 2:
            return params[1], params[0]
    return None, None