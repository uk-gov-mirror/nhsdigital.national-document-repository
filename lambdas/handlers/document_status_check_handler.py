import json

from enums.cloudwatch_logs_reporting_message import CloudwatchLogsReportingMessage
from enums.lambda_error import LambdaError
from enums.logging_app_interaction import LoggingAppInteraction
from services.get_document_upload_status import GetDocumentUploadStatusService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.decorators.validate_patient_id import validate_patient_id
from utils.lambda_exceptions import UploadConfirmResultException
from utils.lambda_response import ApiGatewayResponse
from utils.request_context import request_context

logger = LoggingService(__name__)


@set_request_context_for_logging
@ensure_environment_variables(
    names=[
        "APPCONFIG_APPLICATION",
        "APPCONFIG_CONFIGURATION",
        "APPCONFIG_ENVIRONMENT",
        "DOCUMENT_STORE_DYNAMODB_NAME",
        "LLOYD_GEORGE_DYNAMODB_NAME",
    ],
)
@validate_patient_id
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, context):
    request_context.app_interaction = LoggingAppInteraction.UPLOAD_CONFIRMATION.value

    logger.info("Document status check handler triggered")

    nhs_number_query_string = event["queryStringParameters"]["patientId"]
    documents_list_query_string = event["queryStringParameters"].get("docIds")
    request_context.patient_nhs_no = nhs_number_query_string
    if not documents_list_query_string or not nhs_number_query_string:
        raise UploadConfirmResultException(
            400,
            LambdaError.UploadConfirmResultMissingParams,
        )
    documents_id_list = set(documents_list_query_string.split(","))

    upload_confirm_result_service = GetDocumentUploadStatusService()
    results = upload_confirm_result_service.get_document_references_by_id(
        document_ids=documents_id_list,
        nhs_number=nhs_number_query_string,
    )
    if results:
        logger.info(CloudwatchLogsReportingMessage.UPLOAD_STATUS_CHECKED)
        return ApiGatewayResponse(
            status_code=200,
            body=json.dumps(results),
            methods="GET",
        ).create_api_gateway_response()
    return ApiGatewayResponse(
        status_code=404,
        body=json.dumps(results),
        methods="GET",
    )
