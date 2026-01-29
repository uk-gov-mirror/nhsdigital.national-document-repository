from botocore.exceptions import ClientError

TRANSIENT_ERROR_CODES = {
    "RequestTimeout",
    "RequestTimeoutException",
    "PriorRequestNotComplete",
    "HTTPClientError",
    "ConnectionError",
    "RequestLimitExceeded",
    "ThrottlingException",
}


def is_transient_error(error: Exception) -> bool:
    """
    Check if an error is transient and should trigger a retry.

    Transient errors include:
    - Network timeouts
    - Server-side errors (5xx)

    Args:
        error: The exception to check

    Returns:
        True if the error is transient and should be retried, False otherwise
    """
    if isinstance(error, ClientError):
        error_code = error.response.get("Error", {}).get("Code", "")
        http_status_code = error.response.get("ResponseMetadata", {}).get(
            "HTTPStatusCode", 0
        )

        if error_code in TRANSIENT_ERROR_CODES:
            return True

        if 500 <= http_status_code < 600:
            return True

        if http_status_code == 429:
            return True

    return False
