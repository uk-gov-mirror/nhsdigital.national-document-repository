from unittest import mock
from unittest.mock import MagicMock

import pytest
from handlers.report_orchestration_handler import lambda_handler


class FakeContext:
    aws_request_id = "test-request-id"


@pytest.fixture(autouse=True)
def mock_env(monkeypatch):
    monkeypatch.setenv("BULK_UPLOAD_REPORT_TABLE_NAME", "TestTable")


@pytest.fixture
def mock_logger(mocker):
    return mocker.patch("handlers.report_orchestration_handler.logger", new=MagicMock())


@pytest.fixture
def mock_repo(mocker):
    return mocker.patch(
        "handlers.report_orchestration_handler.ReportingDynamoRepository",
        autospec=True,
    )


@pytest.fixture
def mock_excel_generator(mocker):
    return mocker.patch(
        "handlers.report_orchestration_handler.ExcelReportGenerator",
        autospec=True,
    )


@pytest.fixture
def mock_service(mocker):
    return mocker.patch(
        "handlers.report_orchestration_handler.ReportOrchestrationService",
        autospec=True,
    )


@pytest.fixture
def mock_window(mocker):
    return mocker.patch(
        "handlers.report_orchestration_handler.calculate_reporting_window",
        return_value=(100, 200),
    )


def test_lambda_handler_calls_service(
    mock_logger, mock_repo, mock_excel_generator, mock_service, mock_window
):
    lambda_handler(event={}, context=FakeContext())

    mock_repo.assert_called_once_with("TestTable")
    mock_excel_generator.assert_called_once_with()

    mock_service.assert_called_once()
    instance = mock_service.return_value
    instance.process_reporting_window.assert_called_once_with(
        window_start_ts=100,
        window_end_ts=200,
        output_dir=mock.ANY,
    )

    mock_logger.info.assert_any_call("Report orchestration lambda invoked")


def test_lambda_handler_calls_window_function(mock_service, mock_window):
    lambda_handler(event={}, context=FakeContext())
    mock_window.assert_called_once()
