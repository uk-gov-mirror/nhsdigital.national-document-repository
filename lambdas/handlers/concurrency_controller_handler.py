from services.concurrency_controller_service import ConcurrencyControllerService
from utils.audit_logging_setup import LoggingService
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging

logger = LoggingService(__name__)


def validate_event(event):
    target_function = event.get("targetFunction")
    reserved_concurrency = event.get("reservedConcurrency")

    if not target_function:
        logger.error("Missing required parameter: targetFunction")
        raise ValueError("targetFunction is required")

    if reserved_concurrency is None:
        logger.error("Missing required parameter: reservedConcurrency")
        raise ValueError("reservedConcurrency is required")

    return target_function, reserved_concurrency


@set_request_context_for_logging
@override_error_check
@handle_lambda_exceptions
def lambda_handler(event, _context):
    target_function, reserved_concurrency = validate_event(event)
    
    service = ConcurrencyControllerService()
    updated_concurrency = service.update_function_concurrency(target_function, reserved_concurrency)
    
    return {
        "statusCode": 200,
        "body": {
            "message": "Concurrency updated successfully",
            "function": target_function,
            "reservedConcurrency": updated_concurrency
        }
    }
