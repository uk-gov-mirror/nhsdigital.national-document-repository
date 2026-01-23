import importlib
import os
import pytest

MODULE_UNDER_TEST = "handlers.report_distribution_handler"


@pytest.fixture
def handler_module():
    return importlib.import_module(MODULE_UNDER_TEST)


@pytest.fixture
def required_env(mocker):
    mocker.patch.dict(
        os.environ,
        {
            "REPORT_BUCKET_NAME": "my-report-bucket",
            "CONTACT_TABLE_NAME": "contact-table",
            "PRM_MAILBOX_EMAIL": "prm@example.com",
            "SES_FROM_ADDRESS": "from@example.com",
        },
        clear=False,
    )


def test_lambda_handler_wires_dependencies_and_returns_result_list_mode(
    mocker, handler_module, required_env
):
    event = {"action": "list", "prefix": "reports/2026-01-01/"}
    context = mocker.Mock()
    context.aws_request_id = "req-123"  # avoid JSON serialization issues in decorators

    s3_instance = mocker.Mock(name="S3ServiceInstance")
    contact_repo_instance = mocker.Mock(name="ReportContactRepositoryInstance")
    email_instance = mocker.Mock(name="EmailServiceInstance")

    svc_instance = mocker.Mock(name="ReportDistributionServiceInstance")
    svc_instance.list_xlsx_keys.return_value = ["a.xlsx", "b.xlsx"]

    mocked_s3_cls = mocker.patch.object(
        handler_module, "S3Service", autospec=True, return_value=s3_instance
    )
    mocked_contact_repo_cls = mocker.patch.object(
        handler_module,
        "ReportContactRepository",
        autospec=True,
        return_value=contact_repo_instance,
    )
    mocked_email_cls = mocker.patch.object(
        handler_module, "EmailService", autospec=True, return_value=email_instance
    )
    mocked_dist_svc_cls = mocker.patch.object(
        handler_module,
        "ReportDistributionService",
        autospec=True,
        return_value=svc_instance,
    )

    result = handler_module.lambda_handler(event, context)

    mocked_s3_cls.assert_called_once_with()
    mocked_contact_repo_cls.assert_called_once_with("contact-table")
    mocked_email_cls.assert_called_once_with()

    mocked_dist_svc_cls.assert_called_once_with(
        s3_service=s3_instance,
        contact_repo=contact_repo_instance,
        email_service=email_instance,
        bucket="my-report-bucket",
        from_address="from@example.com",
        prm_mailbox="prm@example.com",
    )

    svc_instance.list_xlsx_keys.assert_called_once_with(prefix="reports/2026-01-01/")
    assert result == {
        "bucket": "my-report-bucket",
        "prefix": "reports/2026-01-01/",
        "keys": ["a.xlsx", "b.xlsx"],
    }


def test_lambda_handler_uses_bucket_from_event_when_provided_list_mode(
    mocker, handler_module, required_env
):
    event = {"action": "list", "prefix": "p/", "bucket": "override-bucket"}
    context = mocker.Mock()
    context.aws_request_id = "req-456"

    svc_instance = mocker.Mock()
    svc_instance.list_xlsx_keys.return_value = []

    mocker.patch.object(handler_module, "ReportDistributionService", autospec=True, return_value=svc_instance)
    mocker.patch.object(handler_module, "S3Service", autospec=True, return_value=mocker.Mock())
    mocker.patch.object(handler_module, "ReportContactRepository", autospec=True, return_value=mocker.Mock())
    mocker.patch.object(handler_module, "EmailService", autospec=True, return_value=mocker.Mock())

    result = handler_module.lambda_handler(event, context)

    svc_instance.list_xlsx_keys.assert_called_once_with(prefix="p/")
    assert result == {"bucket": "override-bucket", "prefix": "p/", "keys": []}


def test_lambda_handler_process_one_mode_happy_path(
    mocker, handler_module, required_env
):
    event = {"action": "process_one", "key": "reports/ABC/whatever.xlsx"}
    context = mocker.Mock()
    context.aws_request_id = "req-789"

    svc_instance = mocker.Mock()
    svc_instance.extract_ods_code_from_key.return_value = "ABC"
    svc_instance.process_one_report.return_value = None

    mocker.patch.object(handler_module, "ReportDistributionService", autospec=True, return_value=svc_instance)
    mocker.patch.object(handler_module, "S3Service", autospec=True, return_value=mocker.Mock())
    mocker.patch.object(handler_module, "ReportContactRepository", autospec=True, return_value=mocker.Mock())
    mocker.patch.object(handler_module, "EmailService", autospec=True, return_value=mocker.Mock())

    result = handler_module.lambda_handler(event, context)

    svc_instance.extract_ods_code_from_key.assert_called_once_with("reports/ABC/whatever.xlsx")
    svc_instance.process_one_report.assert_called_once_with(ods_code="ABC", key="reports/ABC/whatever.xlsx")

    assert result == {
        "status": "ok",
        "bucket": "my-report-bucket",
        "key": "reports/ABC/whatever.xlsx",
        "ods_code": "ABC",
    }
