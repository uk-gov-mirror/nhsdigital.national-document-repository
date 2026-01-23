import json
import os
from unittest.mock import MagicMock

import pytest

from handlers.report_orchestration_handler import lambda_handler


class FakeContext:
    aws_request_id = "test-request-id"


@pytest.fixture(autouse=True)
def mock_env(mocker):
    mocker.patch.dict(
        os.environ,
        {
            "BULK_UPLOAD_REPORT_TABLE_NAME": "TestTable",
            "REPORT_BUCKET_NAME": "test-report-bucket",
        },
        clear=False,
    )


@pytest.fixture
def mock_logger(mocker):
    return mocker.patch("handlers.report_orchestration_handler.logger", new=MagicMock())


@pytest.fixture
def mock_window(mocker):
    return mocker.patch(
        "handlers.report_orchestration_handler.calculate_reporting_window",
        return_value=(100, 200),
    )


@pytest.fixture
def mock_report_date(mocker):
    return mocker.patch(
        "handlers.report_orchestration_handler.get_report_date_folder",
        return_value="2026-01-02",
    )


@pytest.fixture
def mock_build_services(mocker):
    orchestration_service = MagicMock()
    s3_service = MagicMock()
    patcher = mocker.patch(
        "handlers.report_orchestration_handler.build_services",
        return_value=(orchestration_service, s3_service),
    )
    return patcher, orchestration_service, s3_service


def test_lambda_handler_calls_service_and_returns_expected_response(
    mock_logger,
    mock_build_services,
    mock_window,
    mock_report_date,
):
    build_services_patcher, orchestration_service, s3_service = mock_build_services

    orchestration_service.process_reporting_window.return_value = {
        "A12345": "/tmp/A12345.xlsx",
        "B67890": "/tmp/B67890.xlsx",
    }

    result = lambda_handler(event={}, context=FakeContext())

    build_services_patcher.assert_called_once_with("TestTable")

    orchestration_service.process_reporting_window.assert_called_once_with(
        window_start_ts=100,
        window_end_ts=200,
    )

    assert s3_service.upload_file_with_extra_args.call_count == 2

    assert result["report_date"] == "2026-01-02"
    assert result["bucket"] == "test-report-bucket"
    assert result["prefix"] == "Report-Orchestration/2026-01-02/"
    assert set(result["keys"]) == {
        "Report-Orchestration/2026-01-02/A12345.xlsx",
        "Report-Orchestration/2026-01-02/B67890.xlsx",
    }

    mock_logger.info.assert_any_call("Report orchestration lambda invoked")


def test_lambda_handler_calls_window_function(
    mock_build_services,
    mock_window,
    mock_report_date,
):
    _, orchestration_service, _ = mock_build_services
    orchestration_service.process_reporting_window.return_value = {}

    lambda_handler(event={}, context=FakeContext())

    mock_window.assert_called_once()


def test_lambda_handler_returns_empty_keys_when_no_reports_generated(
    mock_build_services,
    mock_logger,
    mock_window,
    mock_report_date,
):
    _, orchestration_service, s3_service = mock_build_services
    orchestration_service.process_reporting_window.return_value = {}

    result = lambda_handler(event={}, context=FakeContext())

    assert result == {
        "report_date": "2026-01-02",
        "bucket": "test-report-bucket",
        "prefix": "Report-Orchestration/2026-01-02/",
        "keys": [],
    }

    s3_service.upload_file_with_extra_args.assert_not_called()
    mock_logger.info.assert_any_call("No reports generated; exiting")


def test_lambda_handler_uploads_each_report_to_s3_with_kms_encryption(
    mock_build_services,
    mock_window,
    mock_report_date,
):
    _, orchestration_service, s3_service = mock_build_services
    orchestration_service.process_reporting_window.return_value = {
        "A12345": "/tmp/A12345.xlsx",
        "UNKNOWN": "/tmp/UNKNOWN.xlsx",
    }

    result = lambda_handler(event={}, context=FakeContext())

    assert s3_service.upload_file_with_extra_args.call_count == 2

    s3_service.upload_file_with_extra_args.assert_any_call(
        file_name="/tmp/A12345.xlsx",
        s3_bucket_name="test-report-bucket",
        file_key="Report-Orchestration/2026-01-02/A12345.xlsx",
        extra_args={"ServerSideEncryption": "aws:kms"},
    )

    s3_service.upload_file_with_extra_args.assert_any_call(
        file_name="/tmp/UNKNOWN.xlsx",
        s3_bucket_name="test-report-bucket",
        file_key="Report-Orchestration/2026-01-02/UNKNOWN.xlsx",
        extra_args={"ServerSideEncryption": "aws:kms"},
    )

    assert result["keys"] == [
        "Report-Orchestration/2026-01-02/A12345.xlsx",
        "Report-Orchestration/2026-01-02/UNKNOWN.xlsx",
    ]


def test_lambda_handler_returns_error_when_required_env_missing(mocker):
    mocker.patch.dict(os.environ, {"BULK_UPLOAD_REPORT_TABLE_NAME": "TestTable"}, clear=False)
    os.environ.pop("REPORT_BUCKET_NAME", None)

    ctx = FakeContext()
    ctx.aws_request_id = "test-request-id"

    result = lambda_handler(event={}, context=ctx)

    assert isinstance(result, dict)
    assert result["statusCode"] == 500

    body = json.loads(result["body"])
    assert body["err_code"] == "ENV_5001"
    assert "REPORT_BUCKET_NAME" in body["message"]

    if body.get("interaction_id") is not None:
        assert body["interaction_id"] == "test-request-id"
