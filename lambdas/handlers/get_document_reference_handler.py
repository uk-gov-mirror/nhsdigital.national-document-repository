import json

from enums.feature_flags import FeatureFlags
from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from services.feature_flags_service import FeatureFlagService
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
    request_context.app_interaction = LoggingAppInteraction.VIEW_LG_RECORD.value

    feature_flag_service = FeatureFlagService()
    feature_flag_service.validate_feature_flag(
        FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED,
    )

    version_history_flag = FeatureFlags.VERSION_HISTORY_ENABLED.value
    version_history_flag_object = feature_flag_service.get_feature_flags_by_flag(
        version_history_flag,
    )

    logger.info("Starting document fetch by ID process")

    try:
        document_id = event["pathParameters"]["id"]
        nhs_number = event["queryStringParameters"]["patientId"]
        version = event["pathParameters"].get("version", None)
        if (
            not version_history_flag_object[version_history_flag]
            and version is not None
        ):
            logger.error(
                "Version history feature flag is disabled, but version was provided in request",
            )
            raise GetDocumentRefException(
                400,
                LambdaError.FeatureFlagDisabled,
            )
    except KeyError:
        raise GetDocumentRefException(
            400,
            LambdaError.DocumentReferenceMissingParameters,
        )

    service = GetDocumentReferenceService()

    document_info = service.get_document_url_by_id(document_id, nhs_number, version)

    return ApiGatewayResponse(
        status_code=200,
        body=json.dumps(document_info),
        methods="GET",
    ).create_api_gateway_response()
