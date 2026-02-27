from types import SimpleNamespace

import pytest

from lambdas.handlers.report_s3_content_handler import lambda_handler


@pytest.fixture(autouse=True)
def patch_env_vars(monkeypatch):
    env_vars = {
        "STATISTICAL_REPORTS_BUCKET": "bucket-b",
        "BULK_STAGING_BUCKET_NAME": "bucket-c",
    }
    for key, value in env_vars.items():
        monkeypatch.setenv(key, value)


@pytest.fixture
def lambda_context():
    return SimpleNamespace(aws_request_id="test-request-id")


def test_lambda_handler_invokes_service(mocker, lambda_context):
    mock_service_cls = mocker.patch(
        "lambdas.handlers.report_s3_content_handler.ReportS3ContentService",
    )
    mock_service = mock_service_cls.return_value

    lambda_handler({}, lambda_context)

    mock_service_cls.assert_called_once()
    mock_service.process_s3_content.assert_called_once()


def test_lambda_handler_runs_without_event_data(mocker, lambda_context):
    mock_service_cls = mocker.patch(
        "lambdas.handlers.report_s3_content_handler.ReportS3ContentService",
    )
    mock_service = mock_service_cls.return_value

    lambda_handler({}, lambda_context)

    mock_service_cls.assert_called_once()
    mock_service.process_s3_content.assert_called_once()
