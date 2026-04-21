import json

from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from services.document_reference_search_service import DocumentReferenceSearchService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.decorators.validate_patient_id import validate_patient_id
from utils.document_type_utils import extract_document_type_to_enum
from utils.lambda_exceptions import DocumentRefSearchException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context
from utils.utilities import camelize_dict

logger = LoggingService(__name__)


@set_request_context_for_logging
@validate_patient_id
@ensure_environment_variables(names=["LLOYD_GEORGE_DYNAMODB_NAME"])
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, context):
    request_context.app_interaction = LoggingAppInteraction.SEARCH_DOCUMENT.value
    logger.info("Starting document reference search process")

    nhs_number, next_page_token, limit = extract_querystring_params(event)

    doc_type = event.get("queryStringParameters", {}).get("docType", None)
    try:
        document_snomed_code = (
            extract_document_type_to_enum(doc_type) if doc_type else None
        )
    except ValueError:
        raise DocumentRefSearchException(400, LambdaError.DocTypeInvalid)

    request_context.patient_nhs_no = nhs_number

    document_reference_search_service = DocumentReferenceSearchService()

    additional_filters = {
        "doc_status": "final",
    }
    if document_snomed_code:
        additional_filters["document_snomed_code"] = document_snomed_code[0].value

    logger.info("Searching for patient references with pagination.")

    response_dict = (
        document_reference_search_service.get_paginated_references_by_nhs_number(
            nhs_number=nhs_number,
            limit=limit,
            next_page_token=next_page_token,
            filter=additional_filters,
        )
    )
    response = camelize_dict(response_dict)
    logger.info("User is able to view docs", {"Result": "Successful viewing docs"})

    return ApiGatewayResponse(
        200,
        json.dumps(response),
        "GET",
    ).create_api_gateway_response()


def extract_querystring_params(event):
    nhs_number = event["queryStringParameters"]["patientId"]
    next_page_token = event["queryStringParameters"].get("nextPageToken")
    limit = event["queryStringParameters"].get("limit")

    return nhs_number, next_page_token, limit
