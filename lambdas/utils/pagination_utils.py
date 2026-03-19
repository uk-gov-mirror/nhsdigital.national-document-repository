import base64
import json

from utils.audit_logging_setup import LoggingService
from utils.exceptions import InvalidParamException

logger = LoggingService(__name__)


def validate_next_page_token(next_page_token: str | None) -> None:
    """Raises InvalidParamException if the token is not valid base64-encoded JSON."""
    if not next_page_token:
        return
    try:
        decoded = base64.b64decode(next_page_token.encode("utf-8")).decode("utf-8")
        json.loads(decoded)
    except Exception as e:
        logger.error(f"Invalid next_page_token: {e}")
        raise InvalidParamException(f"Invalid next_page_token: {e}") from e
