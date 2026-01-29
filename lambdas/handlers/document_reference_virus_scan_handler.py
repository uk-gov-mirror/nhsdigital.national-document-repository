from enums.logging_app_interaction import LoggingAppInteraction
from services.staged_document_review_processing_service import (
    StagedDocumentReviewProcessingService,
)
from services.upload_document_reference_service import UploadDocumentReferenceService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)


@set_request_context_for_logging
@ensure_environment_variables(
    names=[
        "STAGING_STORE_BUCKET_NAME",
        "LLOYD_GEORGE_BUCKET_NAME",
        "PDM_BUCKET_NAME",
        "VIRUS_SCAN_STUB",
        "DOCUMENT_REVIEW_DYNAMODB_NAME",
        "PENDING_REVIEW_BUCKET_NAME",
    ]
)
def lambda_handler(event, context):
    request_context.app_interaction = LoggingAppInteraction.VIRUS_SCAN.value
    upload_document_reference_service = UploadDocumentReferenceService()
    review_upload_document_reference_service = StagedDocumentReviewProcessingService()

    for s3_object in event.get("Records"):
        object_key = s3_object["s3"]["object"]["key"]
        object_size = s3_object["s3"]["object"]["size"]
        if object_key.startswith("review/"):
            logger.info("Using review document service")
            service = review_upload_document_reference_service
        else:
            logger.info("Using upload document service")
            service = upload_document_reference_service

        service.handle_upload_document_reference_request(object_key, object_size)

    return ApiGatewayResponse(
        200, "Virus Scan was successful", "POST"
    ).create_api_gateway_response()
