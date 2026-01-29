from services.expedite_transfer_family_kill_switch_service import (
    ExpediteKillSwitchService,
)
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.set_audit_arg import set_request_context_for_logging


@handle_lambda_exceptions
@set_request_context_for_logging
def lambda_handler(event, context):
    service = ExpediteKillSwitchService()
    return service.handle_sns_event(event)
