from datetime import date

import pytest
from repositories.reporting.reporting_dynamo_repository import ReportingDynamoRepository


@pytest.fixture
def reporting_repo(monkeypatch, mock_reporting_dynamo_service):
    monkeypatch.setenv("BULK_UPLOAD_REPORT_TABLE_NAME", "TestTable")
    return ReportingDynamoRepository()


@pytest.mark.parametrize(
    "start_dt,end_dt,service_side_effect,expected,expected_call_count",
    [
        (
            date(2026, 1, 7),
            date(2026, 1, 7),
            [
                [
                    {
                        "Date": "2026-01-07",
                        "Timestamp": 1704601000,
                        "UploaderOdsCode": "A12345",
                        "DocumentId": "doc-001",
                        "Status": "UPLOADED",
                    },
                ],
            ],
            [
                {
                    "Date": "2026-01-07",
                    "Timestamp": 1704601000,
                    "UploaderOdsCode": "A12345",
                    "DocumentId": "doc-001",
                    "Status": "UPLOADED",
                },
            ],
            1,
        ),
        (
            date(2026, 1, 6),
            date(2026, 1, 7),
            [
                [
                    {
                        "Date": "2026-01-06",
                        "Timestamp": 1704517200,
                        "UploaderOdsCode": "A12345",
                        "DocumentId": "doc-101",
                        "Status": "UPLOADED",
                    },
                ],
                [
                    {
                        "Date": "2026-01-07",
                        "Timestamp": 1704590000,
                        "UploaderOdsCode": "B67890",
                        "DocumentId": "doc-202",
                        "Status": "PROCESSED",
                    },
                    {
                        "Date": "2026-01-07",
                        "Timestamp": 1704593600,
                        "UploaderOdsCode": "B67890",
                        "DocumentId": "doc-203",
                        "Status": "PROCESSED",
                    },
                ],
            ],
            [
                {
                    "Date": "2026-01-06",
                    "Timestamp": 1704517200,
                    "UploaderOdsCode": "A12345",
                    "DocumentId": "doc-101",
                    "Status": "UPLOADED",
                },
                {
                    "Date": "2026-01-07",
                    "Timestamp": 1704590000,
                    "UploaderOdsCode": "B67890",
                    "DocumentId": "doc-202",
                    "Status": "PROCESSED",
                },
                {
                    "Date": "2026-01-07",
                    "Timestamp": 1704593600,
                    "UploaderOdsCode": "B67890",
                    "DocumentId": "doc-203",
                    "Status": "PROCESSED",
                },
            ],
            2,
        ),
        (
            date(2026, 1, 6),
            date(2026, 1, 7),
            [
                [],
                [],
            ],
            [],
            2,
        ),
    ],
)
def test_get_records_for_time_window(
    mocker,
    mock_reporting_dynamo_service,
    reporting_repo,
    start_dt,
    end_dt,
    service_side_effect,
    expected,
    expected_call_count,
):
    mock_utc_date = mocker.patch(
        "repositories.reporting.reporting_dynamo_repository.utc_date",
    )
    mock_utc_date.side_effect = [start_dt, end_dt]
    mock_reporting_dynamo_service.query_by_key_condition_expression.side_effect = (
        service_side_effect
    )

    result = reporting_repo.get_records_for_time_window(100, 200)

    assert result == expected
    assert (
        mock_reporting_dynamo_service.query_by_key_condition_expression.call_count
        == expected_call_count
    )

    for (
        call
    ) in mock_reporting_dynamo_service.query_by_key_condition_expression.call_args_list:
        kwargs = call.kwargs
        assert kwargs["table_name"] == "TestTable"
        assert kwargs["index_name"] == "TimestampIndex"
        assert "key_condition_expression" in kwargs
