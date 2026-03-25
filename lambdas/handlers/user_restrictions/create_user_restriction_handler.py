import json

from enums.feature_flags import FeatureFlags
from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from services.feature_flags_service import FeatureFlagService
from services.user_restrictions.create_user_restriction_service import (
    CreateUserRestrictionService,
)
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.decorators.validate_patient_id import (
    extract_nhs_number_from_event,
    validate_patient_id,
)
from utils.exceptions import (
    HealthcareWorkerAPIException,
    HealthcareWorkerPractitionerModelException,
    OdsErrorException,
    UserRestrictionAlreadyExistsException,
)
from utils.lambda_exceptions import LambdaException
from utils.lambda_response import ApiGatewayResponse
from utils.ods_utils import extract_creator_and_ods_code_from_request_context
from utils.request_context import request_context

logger = LoggingService(__name__)


def parse_body(body: str | None) -> tuple[str, str]:
    if not body:
        logger.error("Missing request body")
        raise LambdaException(
            400,
            LambdaError.CreateRestrictionMissingBody,
        )

    payload = json.loads(body)

    restricted_smartcard_id = payload.get("smartcardId")
    nhs_number = payload.get("nhsNumber")
    if not restricted_smartcard_id or not nhs_number:
        logger.error("Missing required fields")
        raise LambdaException(
            400,
            LambdaError.CreateRestrictionMissingFields,
        )

    return restricted_smartcard_id, nhs_number


@set_request_context_for_logging
@override_error_check
@ensure_environment_variables(
    names=[
        "RESTRICTIONS_TABLE_NAME",
        "HEALTHCARE_WORKER_API_URL",
    ],
)
@handle_lambda_exceptions
@validate_patient_id
def lambda_handler(event, context):
    request_context.app_interaction = LoggingAppInteraction.USER_RESTRICTION.value

    feature_flag_service = FeatureFlagService()
    feature_flag_service.validate_feature_flag(
        FeatureFlags.USER_RESTRICTION_ENABLED,
    )
    logger.info("Starting create user restriction process")

    restricted_smartcard_id, nhs_number = parse_body(event.get("body"))
    request_context.patient_nhs_no = nhs_number

    patient_id = extract_nhs_number_from_event(event)
    if patient_id != nhs_number:
        logger.error("patientId query param does not match nhs_number in request body")
        raise LambdaException(
            400,
            LambdaError.PatientIdMismatch,
        )

    try:
        creator, ods_code = extract_creator_and_ods_code_from_request_context()
    except OdsErrorException:
        logger.error("Missing user context")
        raise LambdaException(
            400,
            LambdaError.CreateRestrictionMissingContext,
        )

    service = CreateUserRestrictionService()
    try:
        restriction_id = service.create_restriction(
            restricted_smartcard_id=restricted_smartcard_id,
            nhs_number=nhs_number,
            custodian=ods_code,
            creator=creator,
        )
    except UserRestrictionAlreadyExistsException as exc:
        logger.error(exc)
        raise LambdaException(
            409,
            LambdaError.CreateRestrictionAlreadyExists,
        )
    except HealthcareWorkerAPIException as exc:
        logger.error(exc)
        raise LambdaException(
            400,
            LambdaError.CreateRestrictionInvalidWorker,
        )
    except HealthcareWorkerPractitionerModelException as exc:
        logger.error(exc)
        raise LambdaException(
            400,
            LambdaError.CreateRestrictionPractitionerModelError,
        )

    return ApiGatewayResponse(
        201,
        json.dumps({"id": restriction_id}),
        "POST",
    ).create_api_gateway_response()
