from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from services.user_restrictions.update_status_user_restriction_service import (
    UpdateStatusUserRestrictionService,
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
    UserRestrictionConditionCheckFailedException,
)
from utils.lambda_response import ApiGatewayResponse
from utils.ods_utils import extract_creator_and_ods_code_from_request_context
from utils.request_context import request_context

logger = LoggingService(__name__)


@validate_patient_id
@override_error_check
@set_request_context_for_logging
@handle_lambda_exceptions
@ensure_environment_variables(
    names=["APPCONFIG_APPLICATION", "RESTRICTIONS_TABLE_NAME"],
)
def lambda_handler(event, context):
    try:
        request_context.app_interaction = (
            LoggingAppInteraction.RESTRICTION_SOFT_DELETE.value
        )

        logger.info("Extracting restriction id from event")
        restriction_id = event.get("pathParameters", {}).get("id")

        patient_id = extract_nhs_number_from_event(event)
        request_context.patient_nhs_no = patient_id

        logger.info("Obtaining user smartcard id from request context")
        user_id, _ = extract_creator_and_ods_code_from_request_context()

        logger.info(f"Processing soft delete for restriction {restriction_id}")
        update_status_user_restriction_service = UpdateStatusUserRestrictionService()
        update_status_user_restriction_service.handle_delete_restriction(
            restriction_id=restriction_id,
            removed_by=user_id,
            nhs_number=patient_id,
        )

        logger.info(
            "Successfully processed soft delete, {Result: %s has been set inactive}"
            % restriction_id,
        )
        return ApiGatewayResponse(
            status_code=204,
            methods="PATCH",
        ).create_api_gateway_response()
    except UserRestrictionConditionCheckFailedException:
        return ApiGatewayResponse(
            status_code=400,
            body=LambdaError.UserRestrictionDynamoDBConditionError.create_error_body(),
            methods="PATCH",
        ).create_api_gateway_response()
