import json

from enums.feature_flags import FeatureFlags
from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from services.feature_flags_service import FeatureFlagService
from services.get_fhir_document_reference_history_service import (
    GetFhirDocumentReferenceHistoryService,
)
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.decorators.validate_patient_id import validate_patient_id
from utils.exceptions import (
    InvalidDocumentReferenceException,
    OdsErrorException,
    UserIsNotCustodianException,
)
from utils.lambda_exceptions import GetDocumentReferenceHistoryException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)


@validate_patient_id
@handle_lambda_exceptions
@set_request_context_for_logging
@ensure_environment_variables(
    names=[
        "LLOYD_GEORGE_DYNAMODB_NAME",
        "APPCONFIG_APPLICATION",
        "APPCONFIG_ENVIRONMENT",
        "APPCONFIG_CONFIGURATION",
    ],
)
@override_error_check
def lambda_handler(event, context):
    request_context.app_interaction = LoggingAppInteraction.SEARCH_HISTORY.value

    feature_flag_service = FeatureFlagService()
    feature_flag_service.validate_feature_flag(
        FeatureFlags.VERSION_HISTORY_ENABLED.value,
    )

    logger.info("Starting a document reference history search")

    try:
        document_id = event["pathParameters"]["id"]
        nhs_number = event["queryStringParameters"]["patientId"]
        request_context.patient_nhs_no = nhs_number

        logger.info(
            f"Searching a  document reference history for document ID: {document_id} and NHS number: {nhs_number}",
        )

        service = GetFhirDocumentReferenceHistoryService()
        reference_history_bundle = service.get_document_reference_history(
            document_id,
            nhs_number,
        )

    except (
        UserIsNotCustodianException,
        InvalidDocumentReferenceException,
    ) as e:
        logger.error(str(e))
        raise GetDocumentReferenceHistoryException(
            404,
            LambdaError.DocumentReferenceNotFound,
        )

    except OdsErrorException as e:
        logger.error(str(e))
        raise GetDocumentReferenceHistoryException(
            400,
            LambdaError.DocRefMissingOds,
        )

    except KeyError as e:
        logger.error(str(e))
        raise GetDocumentReferenceHistoryException(
            400,
            LambdaError.DocumentReferenceMissingParameters,
        )

    logger.info("Document reference history search completed successfully")

    return ApiGatewayResponse(
        status_code=200,
        body=json.dumps(reference_history_bundle),
        methods="GET",
    ).create_api_gateway_response()
