from datetime import date
from unittest.mock import MagicMock

import pytest
from repositories.reporting.reporting_dynamo_repository import ReportingDynamoRepository


@pytest.fixture
def mock_dynamo_service(mocker):
    mock_service_class = mocker.patch(
        "repositories.reporting.reporting_dynamo_repository.DynamoDBService"
    )
    mock_instance = mock_service_class.return_value
    mock_instance.query_by_key_condition_expression = MagicMock()
    return mock_instance


@pytest.fixture
def reporting_repo(mock_dynamo_service):
    return ReportingDynamoRepository(table_name="TestTable")


def test_get_records_for_time_window_same_date_queries_once(mocker, mock_dynamo_service, reporting_repo):
    mock_utc_date = mocker.patch("repositories.reporting.reporting_dynamo_repository.utc_date")
    mock_utc_date.side_effect = [date(2026, 1, 7), date(2026, 1, 7)]

    mock_dynamo_service.query_by_key_condition_expression.return_value = [{"ID": "one"}]

    result = reporting_repo.get_records_for_time_window(100, 200)

    assert result == [{"ID": "one"}]
    mock_dynamo_service.query_by_key_condition_expression.assert_called_once()

    call_kwargs = mock_dynamo_service.query_by_key_condition_expression.call_args.kwargs
    assert call_kwargs["table_name"] == "TestTable"
    assert call_kwargs["index_name"] == "TimestampIndex"
    assert "key_condition_expression" in call_kwargs


def test_get_records_for_time_window_different_dates_queries_twice(mocker, mock_dynamo_service, reporting_repo):
    mock_utc_date = mocker.patch("repositories.reporting.reporting_dynamo_repository.utc_date")
    mock_utc_date.side_effect = [date(2026, 1, 6), date(2026, 1, 7)]

    mock_dynamo_service.query_by_key_condition_expression.side_effect = [
        [{"ID": "start-day"}],
        [{"ID": "end-day"}],
    ]

    result = reporting_repo.get_records_for_time_window(100, 200)

    assert result == [{"ID": "start-day"}, {"ID": "end-day"}]
    assert mock_dynamo_service.query_by_key_condition_expression.call_count == 2


def test_get_records_for_time_window_returns_empty_list_when_no_items(mocker, mock_dynamo_service, reporting_repo):
    mock_utc_date = mocker.patch("repositories.reporting.reporting_dynamo_repository.utc_date")
    mock_utc_date.side_effect = [date(2026, 1, 6), date(2026, 1, 7)]

    mock_dynamo_service.query_by_key_condition_expression.side_effect = [[], []]

    result = reporting_repo.get_records_for_time_window(100, 200)

    assert result == []
    assert mock_dynamo_service.query_by_key_condition_expression.call_count == 2
