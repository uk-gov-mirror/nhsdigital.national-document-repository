import json
import os

from handlers import report_distribution_handler as handler_module


def test_lambda_handler_wires_dependencies_and_returns_result_list_mode(
    required_report_distribution_env,
    lambda_context,
    mock_report_distribution_wiring,
    report_distribution_list_event,
):
    event = {**report_distribution_list_event, "prefix": "reports/2026-01-01/"}
    mock_report_distribution_wiring.list_xlsx_keys.return_value = ["a.xlsx", "b.xlsx"]

    result = handler_module.lambda_handler(event, lambda_context)

    mock_report_distribution_wiring.list_xlsx_keys.assert_called_once_with(
        prefix="reports/2026-01-01/",
    )
    assert result == {
        "status": "ok",
        "bucket": "my-report-bucket",
        "prefix": "reports/2026-01-01/",
        "keys": ["a.xlsx", "b.xlsx"],
    }


def test_lambda_handler_uses_bucket_from_event_when_provided_list_mode(
    required_report_distribution_env,
    lambda_context,
    report_distribution_list_event,
    mock_report_distribution_wiring,
):
    event = {**report_distribution_list_event, "bucket": "override-bucket"}
    mock_report_distribution_wiring.list_xlsx_keys.return_value = []

    result = handler_module.lambda_handler(event, lambda_context)

    mock_report_distribution_wiring.list_xlsx_keys.assert_called_once_with(prefix="p/")
    assert result == {
        "status": "ok",
        "bucket": "override-bucket",
        "prefix": "p/",
        "keys": [],
    }


def test_lambda_handler_process_one_mode_happy_path(
    required_report_distribution_env,
    lambda_context,
    report_distribution_process_one_event,
    mock_report_distribution_wiring,
):
    event = {
        **report_distribution_process_one_event,
        "key": "reports/ABC/whatever.xlsx",
    }

    mock_report_distribution_wiring.extract_ods_code_from_key.return_value = "ABC"
    mock_report_distribution_wiring.process_one_report.return_value = None

    result = handler_module.lambda_handler(event, lambda_context)

    mock_report_distribution_wiring.extract_ods_code_from_key.assert_called_once_with(
        "reports/ABC/whatever.xlsx",
    )
    mock_report_distribution_wiring.process_one_report.assert_called_once_with(
        ods_code="ABC",
        key="reports/ABC/whatever.xlsx",
    )

    assert result == {
        "status": "ok",
        "bucket": "my-report-bucket",
        "key": "reports/ABC/whatever.xlsx",
        "ods_code": "ABC",
    }


def test_lambda_handler_returns_400_when_action_invalid(
    required_report_distribution_env,
    lambda_context,
):
    event = {"action": "nope"}

    result = handler_module.lambda_handler(event, lambda_context)

    assert isinstance(result, dict)
    assert result["statusCode"] == 400

    body = json.loads(result["body"])
    assert (
        body["err_code"] == handler_module.LambdaError.InvalidAction.value["err_code"]
    )
    assert "Invalid action" in body["message"]

    if body.get("interaction_id") is not None:
        assert body["interaction_id"] == lambda_context.aws_request_id


def test_lambda_handler_returns_500_when_required_env_missing(mocker, lambda_context):
    mocker.patch.dict(os.environ, {}, clear=False)

    os.environ["CONTACT_TABLE_NAME"] = "contact-table"
    os.environ["PRM_MAILBOX_EMAIL"] = "prm@example.com"
    os.environ["SES_FROM_ADDRESS"] = "from@example.com"
    os.environ["SES_CONFIGURATION_SET"] = "my-config-set"
    os.environ.pop("REPORT_BUCKET_NAME", None)

    event = {"action": handler_module.ReportDistributionAction.LIST, "prefix": "p/"}

    result = handler_module.lambda_handler(event, lambda_context)

    assert isinstance(result, dict)
    assert result["statusCode"] == 500

    body = json.loads(result["body"])
    assert body["err_code"] == "ENV_5001"
    assert "REPORT_BUCKET_NAME" in body["message"]

    if body.get("interaction_id") is not None:
        assert body["interaction_id"] == lambda_context.aws_request_id
