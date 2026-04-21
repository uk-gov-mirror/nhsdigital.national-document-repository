import json

from pydantic import ValidationError

from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from models.document_reference import UpdateEventModel
from services.update_document_reference_service import UpdateDocumentReferenceService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.decorators.validate_patient_id import validate_patient_id
from utils.document_reference_common_validations import (
    normalize_event_body_to_dict,
    process_event_body,
    validate_matching_patient_ids,
)
from utils.lambda_exceptions import DocumentRefException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)


@validate_patient_id
@set_request_context_for_logging
@ensure_environment_variables(
    names=[
        "APPCONFIG_APPLICATION",
        "APPCONFIG_CONFIGURATION",
        "APPCONFIG_ENVIRONMENT",
        "DOCUMENT_STORE_DYNAMODB_NAME",
        "LLOYD_GEORGE_DYNAMODB_NAME",
        "STAGING_STORE_BUCKET_NAME",
        "DOCUMENT_STORE_BUCKET_NAME",
        "PRESIGNED_ASSUME_ROLE",
    ],
)
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, context):
    request_context.app_interaction = LoggingAppInteraction.UPDATE_RECORD.value

    logger.info("Starting document reference update process")

    normalize_event_body_to_dict(event)

    try:
        validated_event = UpdateEventModel.model_validate(event)

        nhs_number_query = validated_event.query_string_parameters["patientId"]
        doc_ref_id = validated_event.path_parameters["id"]

        nhs_number_body, document = process_event_body(validated_event)

        validate_matching_patient_ids(nhs_number_query, nhs_number_body)

        request_context.patient_nhs_no = nhs_number_query

        logger.info("Processed update documents from request")
        update_doc_ref_service = UpdateDocumentReferenceService()

        url_responses = update_doc_ref_service.update_document_reference_request(
            nhs_number_query,
            document,
            doc_ref_id,
        )

    except ValidationError as e:
        logger.error(
            f"Failed to parse Document Reference: {str(e)}",
            {"Results": "Validation failure during document reference update"},
        )
        raise DocumentRefException(400, LambdaError.DocRefNoParse)

    return ApiGatewayResponse(
        200,
        json.dumps(url_responses),
        "PUT",
    ).create_api_gateway_response()
