import json

from handlers import report_orchestration_handler as handler_module


def test_lambda_handler_calls_service_and_returns_expected_response(
    required_report_orchestration_env,
    lambda_context,
    mock_report_orchestration_wiring,
):
    orchestration_service = mock_report_orchestration_wiring["orchestration_service"]
    s3_service = mock_report_orchestration_wiring["s3_service"]
    mock_window = mock_report_orchestration_wiring["mock_window"]
    mock_report_date = mock_report_orchestration_wiring["mock_report_date"]

    orchestration_service.process_reporting_window.return_value = {
        "A12345": "/tmp/A12345.xlsx",
        "B67890": "/tmp/B67890.xlsx",
    }

    result = handler_module.lambda_handler(event={}, context=lambda_context)

    mock_window.assert_called_once()
    mock_report_date.assert_called_once()

    orchestration_service.process_reporting_window.assert_called_once_with(
        window_start_ts=100,
        window_end_ts=200,
    )
    assert s3_service.upload_file_with_extra_args.call_count == 2

    assert result == {
        "status": "ok",
        "report_date": "2026-01-02",
        "bucket": "test-report-bucket",
        "prefix": "Report-Orchestration/2026-01-02/",
        "keys": [
            "Report-Orchestration/2026-01-02/A12345.xlsx",
            "Report-Orchestration/2026-01-02/B67890.xlsx",
        ],
    }


def test_lambda_handler_calls_window_function(
    required_report_orchestration_env,
    lambda_context,
    mock_report_orchestration_wiring,
):
    orchestration_service = mock_report_orchestration_wiring["orchestration_service"]
    mock_window = mock_report_orchestration_wiring["mock_window"]

    orchestration_service.process_reporting_window.return_value = {}

    handler_module.lambda_handler(event={}, context=lambda_context)

    mock_window.assert_called_once()


def test_lambda_handler_returns_empty_keys_when_no_reports_generated(
    required_report_orchestration_env,
    lambda_context,
    mock_report_orchestration_wiring,
):
    orchestration_service = mock_report_orchestration_wiring["orchestration_service"]
    s3_service = mock_report_orchestration_wiring["s3_service"]

    orchestration_service.process_reporting_window.return_value = {}

    result = handler_module.lambda_handler(event={}, context=lambda_context)

    assert result == {
        "status": "ok",
        "report_date": "2026-01-02",
        "bucket": "test-report-bucket",
        "prefix": "Report-Orchestration/2026-01-02/",
        "keys": [],
    }
    s3_service.upload_file_with_extra_args.assert_not_called()


def test_lambda_handler_uploads_each_report_to_s3_with_kms_encryption(
    required_report_orchestration_env,
    lambda_context,
    mock_report_orchestration_wiring,
):
    orchestration_service = mock_report_orchestration_wiring["orchestration_service"]
    s3_service = mock_report_orchestration_wiring["s3_service"]

    orchestration_service.process_reporting_window.return_value = {
        "A12345": "/tmp/A12345.xlsx",
        "UNKNOWN": "/tmp/UNKNOWN.xlsx",
    }

    result = handler_module.lambda_handler(event={}, context=lambda_context)

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


def test_lambda_handler_returns_error_when_required_env_missing(
    lambda_context,
    monkeypatch,
):
    monkeypatch.setenv("BULK_UPLOAD_REPORT_TABLE_NAME", "TestTable")
    monkeypatch.delenv("REPORT_BUCKET_NAME", raising=False)

    result = handler_module.lambda_handler(event={}, context=lambda_context)

    assert isinstance(result, dict)
    assert result["statusCode"] == 500

    body = json.loads(result["body"])
    assert body["err_code"] == "ENV_5001"
    assert "REPORT_BUCKET_NAME" in body["message"]

    if body.get("interaction_id") is not None:
        assert body["interaction_id"] == lambda_context.aws_request_id
