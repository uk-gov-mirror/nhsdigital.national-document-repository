import os

from enums.logging_app_interaction import LoggingAppInteraction
from services.ssh_key_management_service import SSHKeyManagementService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.request_context import request_context

logger = LoggingService(__name__)


@set_request_context_for_logging
@override_error_check
@ensure_environment_variables(names=["PRM_MAILBOX_EMAIL"])
@handle_lambda_exceptions
def lambda_handler(_event, _context):
    request_context.app_interaction = LoggingAppInteraction.SSH_KEY_MANAGEMENT.value

    prm_mailbox = os.getenv("PRM_MAILBOX_EMAIL")
    dry_run = os.getenv("DRY_RUN", "false").lower() == "true"

    logger.info(f"Starting SSH key management process, dry_run={dry_run}")

    ssh_key_service = SSHKeyManagementService()
    ssh_key_service.process_ssh_key_expiry(prm_mailbox, dry_run)
