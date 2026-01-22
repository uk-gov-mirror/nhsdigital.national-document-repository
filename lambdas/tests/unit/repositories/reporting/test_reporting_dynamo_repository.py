from unittest.mock import MagicMock

import pytest
from repositories.reporting.reporting_dynamo_repository import ReportingDynamoRepository


@pytest.fixture
def mock_dynamo_service(mocker):
    mock_service = mocker.patch(
        "repositories.reporting.reporting_dynamo_repository.DynamoDBService"
    )
    instance = mock_service.return_value
    instance.scan_whole_table = MagicMock()
    return instance


@pytest.fixture
def reporting_repo(mock_dynamo_service):
    return ReportingDynamoRepository(table_name="TestTable")


def test_get_records_for_time_window_calls_scan(mock_dynamo_service, reporting_repo):
    mock_dynamo_service.scan_whole_table.return_value = []

    reporting_repo.get_records_for_time_window(100, 200)

    mock_dynamo_service.scan_whole_table.assert_called_once()
    assert "filter_expression" in mock_dynamo_service.scan_whole_table.call_args.kwargs


def test_get_records_for_time_window_returns_empty_list(
    mock_dynamo_service, reporting_repo
):
    start_ts = 0
    end_ts = 50
    mock_dynamo_service.scan_whole_table.return_value = []

    result = reporting_repo.get_records_for_time_window(start_ts, end_ts)

    assert result == []
    mock_dynamo_service.scan_whole_table.assert_called_once()
