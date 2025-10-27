from services.edge_presign_service import EdgePresignService
from utils.audit_logging_setup import LoggingService
from utils.decorators.handle_edge_exceptions import handle_edge_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging

logger = LoggingService(__name__)


@set_request_context_for_logging
@override_error_check
@handle_edge_exceptions
def lambda_handler(event, context):
    request: dict = event["Records"][0]["cf"]["request"]
    logger.info("Edge received S3 request")
    logger.info(f"Request: {request}")

    env = get_env_from_context(context)

    edge_presign_service = EdgePresignService(environment=env)
    modified_request = edge_presign_service.use_presigned(request)

    forwarded_request: dict = edge_presign_service.update_s3_headers(modified_request)

    logger.info("Edge forwarding S3 request")
    return forwarded_request

def get_env_from_context(context):
    function_name = context["function_name"]
    return function_name.split("_")[0]