from botocore.exceptions import ClientError
from utils.aws_transient_error_check import is_transient_error


def test_transient_error_code():
    error = ClientError(
        {
            "Error": {"Code": "RequestLimitExceeded", "Message": "Rate exceeded"},
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        "operation_name",
    )
    assert is_transient_error(error) is True


def test_service_unavailable_error():
    error = ClientError(
        {
            "Error": {"Code": "ServiceUnavailable", "Message": "Service unavailable"},
            "ResponseMetadata": {"HTTPStatusCode": 503},
        },
        "operation_name",
    )
    assert is_transient_error(error) is True


def test_5xx_http_status_code():
    error = ClientError(
        {
            "Error": {"Code": "InternalServerError", "Message": "Internal error"},
            "ResponseMetadata": {"HTTPStatusCode": 500},
        },
        "operation_name",
    )
    assert is_transient_error(error) is True


def test_429_too_many_requests():
    error = ClientError(
        {
            "Error": {"Code": "TooManyRequests", "Message": "Too many requests"},
            "ResponseMetadata": {"HTTPStatusCode": 429},
        },
        "operation_name",
    )
    assert is_transient_error(error) is True


def test_permanent_error_404():
    error = ClientError(
        {
            "Error": {
                "Code": "NoSuchKey",
                "Message": "The specified key does not exist",
            },
            "ResponseMetadata": {"HTTPStatusCode": 404},
        },
        "operation_name",
    )
    assert is_transient_error(error) is False


def test_permanent_error_403():
    error = ClientError(
        {
            "Error": {"Code": "AccessDenied", "Message": "Access denied"},
            "ResponseMetadata": {"HTTPStatusCode": 403},
        },
        "operation_name",
    )
    assert is_transient_error(error) is False


def test_non_client_error_exception():
    """Test that non-ClientError exceptions return False"""
    error = ValueError("Some validation error")
    assert is_transient_error(error) is False
