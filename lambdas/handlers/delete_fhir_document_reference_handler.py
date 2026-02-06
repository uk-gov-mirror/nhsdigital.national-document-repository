from enums.fhir.fhir_issue_type import FhirIssueCoding
from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from services.delete_fhir_document_reference_service import (
    DeleteFhirDocumentReferenceService,
)
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions_fhir
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.error_response import ErrorResponse
from utils.exceptions import FhirDocumentReferenceException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)


@handle_lambda_exceptions_fhir
@set_request_context_for_logging
@ensure_environment_variables(
    names=[
        "DOCUMENT_STORE_DYNAMODB_NAME",
        "LLOYD_GEORGE_DYNAMODB_NAME",
        "UNSTITCHED_LLOYD_GEORGE_DYNAMODB_NAME",
    ]
)
def lambda_handler(event, context):
    try:
        request_context.app_interaction = LoggingAppInteraction.FHIR_DELETE_RECORD.value
        logger.info("Processing FHIR document reference DELETE request")
        fhir_doc_ref_service = DeleteFhirDocumentReferenceService()

        fhir_response = fhir_doc_ref_service.process_fhir_document_reference(event)

        if fhir_response:
            logger.info(
                "FHIR Documents were deleted successfully",
                {"Result": "Successful deletion"},
            )
            return ApiGatewayResponse(
                status_code=204, methods="DELETE"
            ).create_api_gateway_response()
        else:
            logger.error(
                LambdaError.DocDelNull.to_str(),
                {
                    "Result": "No matching documents available during FHIR DELETE request"
                },
            )

            return ApiGatewayResponse(
                status_code=404,
                body=ErrorResponse(
                    "404",
                    "No Documents found for deletion.",
                    getattr(request_context, "request_id", None),
                ).create_error_fhir_response(FhirIssueCoding.NOT_FOUND),
                methods="DELETE",
            ).create_api_gateway_response()

    except FhirDocumentReferenceException as exception:
        logger.error(f"Error processing FHIR document reference: {str(exception)}")
        return ApiGatewayResponse(
            status_code=exception.status_code,
            body=exception.error.create_error_response().create_error_fhir_response(
                exception.error.value.get("fhir_coding")
            ),
            methods="DELETE",
        ).create_api_gateway_response()
