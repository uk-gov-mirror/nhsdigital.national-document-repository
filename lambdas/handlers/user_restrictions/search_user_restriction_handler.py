import json

from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from enums.user_restriction_accepted_querystring_parameters import (
    UserRestrictionQuerystringParameters,
)
from services.user_restrictions.search_user_restriction_service import (
    DEFAULT_LIMIT,
    SearchUserRestrictionService,
)
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.exceptions import (
    InvalidParamException,
    OdsErrorException,
    UserRestrictionException,
    UserRestrictionValidationException,
)
from utils.lambda_response import ApiGatewayResponse
from utils.ods_utils import extract_ods_code_from_request_context
from utils.request_context import request_context

logger = LoggingService(__name__)


@set_request_context_for_logging
@ensure_environment_variables(
    names=[
        "RESTRICTIONS_TABLE_NAME",
        "APPCONFIG_APPLICATION",
        "APPCONFIG_CONFIGURATION",
        "APPCONFIG_ENVIRONMENT",
        "HEALTHCARE_WORKER_API_URL",
    ],
)
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, _context):
    try:
        request_context.app_interaction = (
            LoggingAppInteraction.SEARCH_USER_RESTRICTION.value
        )
        ods_code = extract_ods_code_from_request_context()
        logger.info(f"Starting user restriction search process for ods code {ods_code}")
        params = parse_querystring_parameters(event)

        service = SearchUserRestrictionService()

        restrictions, next_token = service.process_request(
            ods_code=ods_code,
            smartcard_id=params.get(UserRestrictionQuerystringParameters.SMARTCARD_ID),
            nhs_number=params.get(UserRestrictionQuerystringParameters.NHS_NUMBER),
            next_page_token=params.get(
                UserRestrictionQuerystringParameters.NEXT_PAGE_TOKEN,
            ),
            limit=params.get(UserRestrictionQuerystringParameters.LIMIT, DEFAULT_LIMIT),
        )

        response_body: dict = {
            "restrictions": restrictions,
            "count": len(restrictions),
        }

        if next_token:
            response_body["nextPageToken"] = next_token
        logger.info(
            "Successfully retrieved user restrictions",
            {"Result": "Successful user restrictions search"},
        )
        return ApiGatewayResponse(
            status_code=200,
            body=json.dumps(response_body),
            methods="GET",
        ).create_api_gateway_response()

    except OdsErrorException as e:
        logger.error(e)
        return ApiGatewayResponse(
            status_code=401,
            body=LambdaError.UserRestrictionMissingContext.create_error_body(),
            methods="GET",
        ).create_api_gateway_response()

    except (UserRestrictionException, InvalidParamException) as e:
        logger.error(f"Invalid query parameter: {e}")
        return ApiGatewayResponse(
            status_code=400,
            body=LambdaError.UserRestrictionInvalidEvent.create_error_body(
                details=str(e),
            ),
            methods="GET",
        ).create_api_gateway_response()

    except UserRestrictionValidationException as e:
        logger.error(f"Restriction model validation error: {e}")
        return ApiGatewayResponse(
            status_code=500,
            body=LambdaError.UserRestrictionModelValidationError.create_error_body(),
            methods="GET",
        ).create_api_gateway_response()


def parse_querystring_parameters(event: dict) -> dict:
    logger.info("Parsing query string parameters.")
    params = event.get("queryStringParameters") or {}

    return {
        param.value: params[param.value]
        for param in UserRestrictionQuerystringParameters
        if param.value in params
    }
