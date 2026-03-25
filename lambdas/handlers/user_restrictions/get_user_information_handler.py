import json

from enums.feature_flags import FeatureFlags
from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from services.feature_flags_service import FeatureFlagService
from services.user_restrictions.utilities import get_healthcare_worker_api_service
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.exceptions import (
    HealthcareWorkerAPIException,
    HealthcareWorkerPractitionerModelException,
)
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)


@set_request_context_for_logging
@ensure_environment_variables(
    names=[
        "HEALTHCARE_WORKER_API_URL",
    ],
)
@handle_lambda_exceptions
def lambda_handler(event, context):
    try:
        feature_flag_service = FeatureFlagService()
        feature_flag_service.validate_feature_flag(
            FeatureFlags.USER_RESTRICTION_ENABLED,
        )

        request_context.app_interaction = LoggingAppInteraction.GET_USER_INFO.value

        logger.info("Processing request to retrieve user information.")
        identifier = event.get("queryStringParameters", {}).get("identifier")

        if not identifier:
            logger.error("No identifier provided.")
            return ApiGatewayResponse(
                400,
                LambdaError.UserRestrictionInvalidEvent.create_error_body(),
                "GET",
            ).create_api_gateway_response()

        healthcare_worker_api_service = get_healthcare_worker_api_service()

        practitioner_information = healthcare_worker_api_service.get_practitioner(
            identifier=identifier,
        )
        logger.info(
            "Returning user information. {Result: returning information for %s}"
            % identifier,
        )
        return ApiGatewayResponse(
            200,
            json.dumps(practitioner_information.model_dump_camel_case()),
            "GET",
        ).create_api_gateway_response()
    except HealthcareWorkerAPIException as e:
        return ApiGatewayResponse(
            502,
            json.dumps(e.message),
            "GET",
        ).create_api_gateway_response()
    except HealthcareWorkerPractitionerModelException:
        return ApiGatewayResponse(
            500,
            LambdaError.UserRestrictionModelValidationError.create_error_body(),
            "GET",
        ).create_api_gateway_response()
