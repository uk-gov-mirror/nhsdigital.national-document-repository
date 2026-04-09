import csv
import os
from datetime import datetime
from unittest.mock import call

import pytest
from boto3.dynamodb.conditions import Attr
from freezegun import freeze_time

from enums.metadata_report import MetadataReport
from models.report.bulk_upload_report import BulkUploadReport
from services.bulk_upload_report_service import BulkUploadReportService, OdsReport
from tests.unit.conftest import (
    MOCK_BULK_REPORT_TABLE_NAME,
    MOCK_STATISTICS_REPORT_BUCKET_NAME,
    TEST_CURRENT_GP_ODS,
)
from tests.unit.helpers.data.bulk_upload.dynamo_responses import (
    MOCK_REPORT_ITEMS_ALL,
    MOCK_REPORT_ITEMS_UPLOADER_1,
    MOCK_REPORT_RESPONSE_ALL,
    MOCK_REPORT_RESPONSE_ALL_WITH_LAST_KEY,
    TEST_UPLOADER_ODS_1,
    TEST_UPLOADER_ODS_2,
)
from tests.unit.helpers.data.bulk_upload.test_data import readfile
from tests.unit.helpers.data.dynamo.dynamo_scan_response import (
    MOCK_EMPTY_RESPONSE,
    UNEXPECTED_RESPONSE,
)
from utils.utilities import generate_date_folder_name

MOCK_END_REPORT_TIME = datetime(2012, 1, 14, 7, 0, 0, 0)
MOCK_START_REPORT_TIME = datetime(2012, 1, 13, 7, 0, 0, 0)
MOCK_TIMESTAMP = MOCK_START_REPORT_TIME.strftime("%Y%m%d")


@pytest.fixture
def bulk_upload_report_service(set_env, mocker):
    patched_bulk_upload_report_service = BulkUploadReportService()
    mocker.patch.object(patched_bulk_upload_report_service, "db_service")
    mocker.patch.object(patched_bulk_upload_report_service, "s3_service")

    yield patched_bulk_upload_report_service


@pytest.fixture
def mock_get_db_report_items(bulk_upload_report_service, mocker):
    yield mocker.patch.object(bulk_upload_report_service, "get_dynamodb_report_items")


@pytest.fixture
def mock_write_summary_data_to_csv(bulk_upload_report_service, mocker):
    yield mocker.patch.object(bulk_upload_report_service, "write_summary_data_to_csv")


@pytest.fixture
def mock_write_items_to_csv(bulk_upload_report_service, mocker):
    yield mocker.patch.object(bulk_upload_report_service, "write_items_to_csv")


@pytest.fixture
def mock_get_db_with_data(mocker, bulk_upload_report_service):
    yield mocker.patch.object(
        bulk_upload_report_service,
        "get_dynamodb_report_items",
        return_value=MOCK_REPORT_ITEMS_ALL,
    )


@pytest.fixture
def mock_get_times_for_scan(bulk_upload_report_service, mocker):
    mock_date_folder_name = generate_date_folder_name(MOCK_TIMESTAMP)
    bulk_upload_report_service.generated_on = MOCK_TIMESTAMP
    bulk_upload_report_service.s3_key_prefix = (
        f"bulk-upload-reports/{mock_date_folder_name}"
    )
    yield mocker.patch.object(
        bulk_upload_report_service,
        "get_times_for_scan",
        return_value=(MOCK_START_REPORT_TIME, MOCK_END_REPORT_TIME),
    )


@pytest.fixture
def mock_filter(mocker):
    mock_filter = Attr("Timestamp").gt(MOCK_START_REPORT_TIME) & Attr("Timestamp").lt(
        MOCK_END_REPORT_TIME,
    )

    mocker.patch("boto3.dynamodb.conditions.And", return_value=mock_filter)

    yield mock_filter


@freeze_time("2012-01-14 7:20:01")
def test_get_time_for_scan_after_7am(bulk_upload_report_service):
    (
        actual_start_time,
        actual_end_time,
    ) = bulk_upload_report_service.get_times_for_scan()

    assert MOCK_START_REPORT_TIME == actual_start_time
    assert MOCK_END_REPORT_TIME == actual_end_time


@freeze_time("2012-01-14 6:59:59")
def test_get_time_for_scan_before_7am(bulk_upload_report_service):
    expected_end_report_time = datetime(2012, 1, 13, 7, 0, 0, 0)
    expected_start_report_time = datetime(2012, 1, 12, 7, 0, 0, 0)

    (
        actual_start_time,
        actual_end_time,
    ) = bulk_upload_report_service.get_times_for_scan()

    assert expected_start_report_time == actual_start_time
    assert expected_end_report_time == actual_end_time


@freeze_time("2012-01-14 7:00:00")
def test_get_time_for_scan_at_7am(bulk_upload_report_service):
    expected_end_report_time = datetime(2012, 1, 14, 7, 0, 0, 0)
    expected_start_report_time = datetime(2012, 1, 13, 7, 0, 0, 0)

    (
        actual_start_time,
        actual_end_time,
    ) = bulk_upload_report_service.get_times_for_scan()

    assert expected_start_report_time == actual_start_time
    assert expected_end_report_time == actual_end_time


def test_get_dynamo_data_2_calls(bulk_upload_report_service, mock_filter):
    mock_last_key = {
        "FilePath": "/9000000010/2of2_Lloyd_George_Record_[NAME_2]_[9000000010]_[DOB].pdf",
    }
    bulk_upload_report_service.db_service.scan_table.side_effect = [
        MOCK_REPORT_RESPONSE_ALL_WITH_LAST_KEY,
        MOCK_REPORT_RESPONSE_ALL,
    ]

    actual = bulk_upload_report_service.get_dynamodb_report_items(
        int(MOCK_START_REPORT_TIME.timestamp()),
        int(MOCK_END_REPORT_TIME.timestamp()),
    )

    assert actual == MOCK_REPORT_ITEMS_ALL * 2
    assert bulk_upload_report_service.db_service.scan_table.call_count == 2
    calls = [
        call(MOCK_BULK_REPORT_TABLE_NAME, filter_expression=mock_filter),
        call(
            MOCK_BULK_REPORT_TABLE_NAME,
            exclusive_start_key=mock_last_key,
            filter_expression=mock_filter,
        ),
    ]
    bulk_upload_report_service.db_service.scan_table.assert_has_calls(calls)


def test_get_dynamo_data_handles_invalid_dynamo_data(
    bulk_upload_report_service,
    mock_filter,
    caplog,
):
    invalid_data = {
        "Timestamp": 1688395680,
        "Date": "2012-01-13",
        "Reason": "Lloyd George file already exists",
        "UploadStatus": "failed",
    }
    mock_response = {"Items": [invalid_data, MOCK_REPORT_RESPONSE_ALL["Items"][1]]}
    expected_message = "Failed to parse bulk update report dynamo item"

    bulk_upload_report_service.db_service.scan_table.side_effect = [
        mock_response,
    ]

    actual = bulk_upload_report_service.get_dynamodb_report_items(
        int(MOCK_START_REPORT_TIME.timestamp()),
        int(MOCK_END_REPORT_TIME.timestamp()),
    )

    assert actual == [MOCK_REPORT_ITEMS_ALL[1]]
    assert expected_message in caplog.records[-1].msg


def test_get_dynamo_data_with_no_start_key(bulk_upload_report_service, mock_filter):
    bulk_upload_report_service.db_service.scan_table.side_effect = [
        MOCK_REPORT_RESPONSE_ALL,
    ]

    actual = bulk_upload_report_service.get_dynamodb_report_items(
        int(MOCK_START_REPORT_TIME.timestamp()),
        int(MOCK_END_REPORT_TIME.timestamp()),
    )

    assert actual == MOCK_REPORT_ITEMS_ALL
    bulk_upload_report_service.db_service.scan_table.assert_called_once()
    bulk_upload_report_service.db_service.scan_table.assert_called_with(
        MOCK_BULK_REPORT_TABLE_NAME,
        filter_expression=mock_filter,
    )


def test_get_dynamo_data_with_no_items_returns_empty_list(bulk_upload_report_service):
    bulk_upload_report_service.db_service.scan_table.side_effect = [MOCK_EMPTY_RESPONSE]

    actual = bulk_upload_report_service.get_dynamodb_report_items(
        int(MOCK_START_REPORT_TIME.timestamp()),
        int(MOCK_END_REPORT_TIME.timestamp()),
    )

    assert actual == []
    bulk_upload_report_service.db_service.scan_table.assert_called_once()


def test_get_dynamo_data_with_bad_response_returns_empty_list(
    bulk_upload_report_service,
):
    bulk_upload_report_service.db_service.scan_table.side_effect = [UNEXPECTED_RESPONSE]

    actual = bulk_upload_report_service.get_dynamodb_report_items(
        int(MOCK_START_REPORT_TIME.timestamp()),
        int(MOCK_END_REPORT_TIME.timestamp()),
    )

    assert actual == []
    bulk_upload_report_service.db_service.scan_table.assert_called_once()


def test_report_handler_no_items_returns_expected_log(
    bulk_upload_report_service,
    caplog,
    mock_get_db_report_items,
    mock_write_items_to_csv,
    mock_get_times_for_scan,
):
    expected_message = "No data found, no new report file to upload"
    mock_get_db_report_items.return_value = []
    bulk_upload_report_service.report_handler()

    mock_get_times_for_scan.assert_called_once()
    mock_get_db_report_items.assert_called_once()
    mock_get_db_report_items.assert_called_with(
        int(MOCK_START_REPORT_TIME.timestamp()),
        int(MOCK_END_REPORT_TIME.timestamp()),
    )

    mock_write_items_to_csv.assert_not_called()
    bulk_upload_report_service.s3_service.upload_file.assert_not_called()

    assert caplog.records[-1].msg == expected_message


def test_report_handler_with_items_uploads_summary_report_to_bucket(
    bulk_upload_report_service,
    mock_get_db_with_data,
    mock_write_summary_data_to_csv,
    mock_get_times_for_scan,
    caplog,
):
    expected_messages = [
        "Bulk upload reports for 2012-01-13 07:00:00 to 2012-01-14 07:00:00.csv",
        "Generating ODS report file for Y12345",
        "Uploading ODS report file for Y12345 to S3",
        "Generating ODS report file for Z12345",
        "Uploading ODS report file for Z12345 to S3",
        "Successfully processed daily ODS reports",
        "Uploading daily summary report file to S3",
        "Successfully processed daily summary report",
        "Uploading daily report file to S3",
        "Successfully processed daily report",
        "Uploading daily success report file to S3",
        "Successfully processed success report",
        "Uploading daily suspended report file to S3",
        "Successfully processed suspended report",
        "Uploading daily deceased report file to S3",
        "Successfully processed deceased report",
        "Uploading daily restricted report file to S3",
        "Successfully processed restricted report",
        "Uploading daily rejected report file to S3",
        "Successfully processed rejected report",
    ]

    bulk_upload_report_service.report_handler()

    mock_get_times_for_scan.assert_called_once()
    mock_get_db_with_data.assert_called_once_with(
        int(MOCK_START_REPORT_TIME.timestamp()),
        int(MOCK_END_REPORT_TIME.timestamp()),
    )

    mock_write_summary_data_to_csv.assert_called()

    calls = [
        call(
            s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
            file_key=f"bulk-upload-reports/2012-01-13/daily_statistical_report_bulk_upload_ods_summary_{MOCK_TIMESTAMP}_uploaded_by_Y12345.csv",
            file_name=f"/tmp/daily_statistical_report_bulk_upload_ods_summary_{MOCK_TIMESTAMP}_uploaded_by_Y12345.csv",
        ),
        call(
            s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
            file_key=f"bulk-upload-reports/2012-01-13/daily_statistical_report_bulk_upload_ods_summary_{MOCK_TIMESTAMP}_uploaded_by_Z12345.csv",
            file_name=f"/tmp/daily_statistical_report_bulk_upload_ods_summary_{MOCK_TIMESTAMP}_uploaded_by_Z12345.csv",
        ),
        call(
            s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
            file_key=f"bulk-upload-reports/2012-01-13/daily_statistical_report_bulk_upload_summary_{MOCK_TIMESTAMP}.csv",
            file_name=f"/tmp/daily_statistical_report_bulk_upload_summary_{MOCK_TIMESTAMP}.csv",
        ),
        call(
            s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
            file_key=f"bulk-upload-reports/2012-01-13/daily_statistical_report_entire_bulk_upload_{str(MOCK_START_REPORT_TIME)}_to_{str(MOCK_END_REPORT_TIME)}.csv",
            file_name=f"/tmp/daily_statistical_report_entire_bulk_upload_{str(MOCK_START_REPORT_TIME)}_to_{str(MOCK_END_REPORT_TIME)}.csv",
        ),
        call(
            s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
            file_key=f"bulk-upload-reports/2012-01-13/daily_statistical_report_bulk_upload_success_{MOCK_TIMESTAMP}.csv",
            file_name=f"/tmp/daily_statistical_report_bulk_upload_success_{MOCK_TIMESTAMP}.csv",
        ),
        call(
            s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
            file_key=f"bulk-upload-reports/2012-01-13/daily_statistical_report_bulk_upload_suspended_{MOCK_TIMESTAMP}.csv",
            file_name=f"/tmp/daily_statistical_report_bulk_upload_suspended_{MOCK_TIMESTAMP}.csv",
        ),
        call(
            s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
            file_key=f"bulk-upload-reports/2012-01-13/daily_statistical_report_bulk_upload_deceased_{MOCK_TIMESTAMP}.csv",
            file_name=f"/tmp/daily_statistical_report_bulk_upload_deceased_{MOCK_TIMESTAMP}.csv",
        ),
        call(
            s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
            file_key=f"bulk-upload-reports/2012-01-13/daily_statistical_report_bulk_upload_restricted_{MOCK_TIMESTAMP}.csv",
            file_name=f"/tmp/daily_statistical_report_bulk_upload_restricted_{MOCK_TIMESTAMP}.csv",
        ),
        call(
            s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
            file_key=f"bulk-upload-reports/2012-01-13/daily_statistical_report_bulk_upload_rejected_{MOCK_TIMESTAMP}.csv",
            file_name=f"/tmp/daily_statistical_report_bulk_upload_rejected_{MOCK_TIMESTAMP}.csv",
        ),
    ]

    bulk_upload_report_service.s3_service.upload_file.assert_has_calls(
        calls,
        any_order=False,
    )

    log_message_match = set(expected_messages).issubset(caplog.messages)

    assert log_message_match


def test_write_items_to_csv_writes_header_and_rows(
    tmp_path,
    bulk_upload_report_service,
):
    items = [
        BulkUploadReport(
            ID="abc-123",
            nhs_number="9000000009",
            upload_status="complete",
            reason="",
            pds_ods_code="Y12345",
            uploader_ods_code="Y12345",
            file_path="/9000000009/file1.pdf",
            stored_file_name="/9000000009/file1.pdf",
            date="2023-10-30",
            timestamp=1698661500,
        ),
        BulkUploadReport(
            ID="def-456",
            nhs_number="9000000025",
            upload_status="failed",
            reason="Invalid filename",
            pds_ods_code="",
            uploader_ods_code="Z12345",
            file_path="/9000000025/invalid.pdf",
            stored_file_name="/9000000025/invalid.pdf",
            date="2023-10-30",
            timestamp=1698661600,
        ),
    ]

    csv_path = tmp_path / "report.csv"

    bulk_upload_report_service.write_items_to_csv(items, str(csv_path))

    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        expected_headers = [
            MetadataReport.NhsNumber,
            MetadataReport.UploadStatus,
            MetadataReport.Reason,
            MetadataReport.PdsOdsCode,
            MetadataReport.UploaderOdsCode,
            MetadataReport.FilePath,
            MetadataReport.Date,
            MetadataReport.Timestamp,
            MetadataReport.SentToReview,
        ]
        assert reader.fieldnames == expected_headers

        rows = list(reader)
        assert len(rows) == 2
        assert rows[0][MetadataReport.NhsNumber] == "9000000009"
        assert rows[0][MetadataReport.UploadStatus] == "complete"
        assert rows[0][MetadataReport.Reason] == ""
        assert rows[0][MetadataReport.PdsOdsCode] == "Y12345"
        assert rows[0][MetadataReport.UploaderOdsCode] == "Y12345"
        assert rows[0][MetadataReport.FilePath] == "/9000000009/file1.pdf"
        assert rows[0][MetadataReport.Date] == "2023-10-30"
        assert rows[0][MetadataReport.Timestamp] == "1698661500"
        assert rows[0][MetadataReport.SentToReview] == "False"

        assert rows[1][MetadataReport.NhsNumber] == "9000000025"
        assert rows[1][MetadataReport.UploadStatus] == "failed"
        assert rows[1][MetadataReport.Reason] == "Invalid filename"
        assert rows[1][MetadataReport.PdsOdsCode] == ""
        assert rows[1][MetadataReport.UploaderOdsCode] == "Z12345"
        assert rows[1][MetadataReport.FilePath] == "/9000000025/invalid.pdf"
        assert rows[1][MetadataReport.Date] == "2023-10-30"
        assert rows[1][MetadataReport.Timestamp] == "1698661600"
        assert rows[1][MetadataReport.SentToReview] == "False"


def test_write_items_to_csv_excludes_id_and_stored_file_name(
    tmp_path,
    bulk_upload_report_service,
):
    item = BulkUploadReport(
        ID="abc-123",
        nhs_number="9000000009",
        upload_status="complete",
        pds_ods_code="Y12345",
        uploader_ods_code="Y12345",
        file_path="/9000000009/file1.pdf",
        stored_file_name="/9000000009/file1.pdf",
        date="2023-10-30",
        timestamp=1698661500,
    )

    csv_path = tmp_path / "report_exclude.csv"

    bulk_upload_report_service.write_items_to_csv([item], str(csv_path))

    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        assert MetadataReport.ID not in reader.fieldnames
        assert MetadataReport.StoredFileName not in reader.fieldnames
        rows = list(reader)
        assert len(rows) == 1
        assert MetadataReport.ID not in rows[0]
        assert MetadataReport.StoredFileName not in rows[0]


def test_write_items_to_csv_with_empty_list_writes_only_header(
    tmp_path,
    bulk_upload_report_service,
):
    csv_path = tmp_path / "empty.csv"

    bulk_upload_report_service.write_items_to_csv([], str(csv_path))

    with open(csv_path, newline="") as f:
        reader = csv.reader(f)
        lines = list(reader)
        assert len(lines) == 1
        expected_headers = [
            MetadataReport.NhsNumber,
            MetadataReport.UploadStatus,
            MetadataReport.Reason,
            MetadataReport.PdsOdsCode,
            MetadataReport.UploaderOdsCode,
            MetadataReport.FilePath,
            MetadataReport.Date,
            MetadataReport.Timestamp,
            MetadataReport.SentToReview,
        ]
        assert lines[0] == expected_headers


def test_write_summary_data_to_csv_writes_review_rows_and_reason_rows(
    bulk_upload_report_service,
):
    mock_file_name = "test_summary_report.csv"

    bulk_upload_report_service.write_summary_data_to_csv(
        file_name=mock_file_name,
        total_ingested=10,
        total_successful=3,
        total_successful_percentage="30%",
        total_registered_elsewhere=1,
        total_suspended=0,
        total_in_review=6,
        total_in_review_percentage="60%",
        total_deceased=0,
        total_restricted=0,
        extra_rows=[
            ["Reason", "Fail to parse the patient detail response from PDS API.", 1],
        ],
    )

    with open(f"/tmp/{mock_file_name}", newline="") as f:
        rows = list(csv.reader(f))

    assert rows == [
        ["Type", "Description", "Count"],
        ["Total", "Total Ingested", "10"],
        ["Total", "Total Successful", "3"],
        ["Total", "Total In Review", "6"],
        ["Total", "Review Percentage", "60%"],
        ["Total", "Successful Percentage", "30%"],
        ["Total", "Successful - Registered Elsewhere", "1"],
        ["Total", "Successful - Suspended", "0"],
        ["Reason", "Fail to parse the patient detail response from PDS API.", "1"],
    ]

    os.remove(f"/tmp/{mock_file_name}")


def test_write_summary_data_to_csv_does_not_write_reason_rows_when_extra_rows_empty(
    bulk_upload_report_service,
):
    mock_file_name = "test_summary_report_no_reasons.csv"

    bulk_upload_report_service.write_summary_data_to_csv(
        file_name=mock_file_name,
        total_ingested=18,
        total_successful=0,
        total_successful_percentage="0%",
        total_registered_elsewhere=0,
        total_suspended=0,
        total_in_review=18,
        total_in_review_percentage="100%",
        extra_rows=[],
    )

    with open(f"/tmp/{mock_file_name}", newline="") as f:
        rows = list(csv.reader(f))

    assert rows == [
        ["Type", "Description", "Count"],
        ["Total", "Total Ingested", "18"],
        ["Total", "Total Successful", "0"],
        ["Total", "Total In Review", "18"],
        ["Total", "Review Percentage", "100%"],
        ["Total", "Successful Percentage", "0%"],
        ["Total", "Successful - Registered Elsewhere", "0"],
        ["Total", "Successful - Suspended", "0"],
    ]

    os.remove(f"/tmp/{mock_file_name}")


def test_generate_individual_ods_report_creates_ods_report(
    bulk_upload_report_service,
    mock_write_summary_data_to_csv,
    mock_get_times_for_scan,
):
    expected = OdsReport(
        MOCK_TIMESTAMP,
        TEST_UPLOADER_ODS_1,
        MOCK_REPORT_ITEMS_UPLOADER_1,
    )

    actual = bulk_upload_report_service.generate_individual_ods_report(
        TEST_UPLOADER_ODS_1,
        MOCK_REPORT_ITEMS_UPLOADER_1,
    )

    assert actual.__dict__ == expected.__dict__

    mock_write_summary_data_to_csv.assert_called_with(
        file_name=f"daily_statistical_report_bulk_upload_ods_summary_{MOCK_TIMESTAMP}_uploaded_by_{TEST_CURRENT_GP_ODS}.csv",
        total_ingested=8,
        total_successful=5,
        total_successful_percentage="62.5%",
        total_registered_elsewhere=1,
        total_suspended=1,
        total_in_review=0,
        total_in_review_percentage="0%",
        total_deceased=1,
        extra_rows=[
            ["Reason", "Could not find the given patient on PDS", 2],
            ["Reason", "Lloyd George file already exists", 1],
        ],
    )
    bulk_upload_report_service.s3_service.upload_file.assert_called()


def test_generate_individual_ods_report_writes_csv_report(
    bulk_upload_report_service,
    mock_get_times_for_scan,
):
    mock_file_name = f"daily_statistical_report_bulk_upload_ods_summary_{MOCK_TIMESTAMP}_uploaded_by_{TEST_CURRENT_GP_ODS}.csv"

    bulk_upload_report_service.generate_individual_ods_report(
        TEST_UPLOADER_ODS_1,
        MOCK_REPORT_ITEMS_UPLOADER_1,
    )
    expected = readfile("expected_ods_report_for_uploader_1.csv")
    with open(f"/tmp/{mock_file_name}") as test_file:
        actual = test_file.read()
        assert expected == actual
    os.remove(f"/tmp/{mock_file_name}")

    bulk_upload_report_service.s3_service.upload_file.assert_called_with(
        s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
        file_key=f"bulk-upload-reports/2012-01-13/{mock_file_name}",
        file_name=f"/tmp/{mock_file_name}",
    )


def test_generate_ods_reports_writes_multiple_ods_reports(
    bulk_upload_report_service,
    mock_get_times_for_scan,
):
    mock_file_name_uploader_1 = (
        f"daily_statistical_report_bulk_upload_ods_summary_{MOCK_TIMESTAMP}"
        f"_uploaded_by_{TEST_UPLOADER_ODS_1}.csv"
    )
    mock_file_name_uploader_2 = (
        f"daily_statistical_report_bulk_upload_ods_summary_{MOCK_TIMESTAMP}"
        f"_uploaded_by_{TEST_UPLOADER_ODS_2}.csv"
    )

    bulk_upload_report_service.generate_ods_reports(
        MOCK_REPORT_ITEMS_ALL,
    )
    expected = readfile("expected_ods_report_for_uploader_1.csv")
    with open(f"/tmp/{mock_file_name_uploader_1}") as test_file:
        actual = test_file.read()
        assert expected == actual
    os.remove(f"/tmp/{mock_file_name_uploader_1}")

    expected = readfile("expected_ods_report_for_uploader_2.csv")
    with open(f"/tmp/{mock_file_name_uploader_2}") as test_file:
        actual = test_file.read()
        assert expected == actual
    os.remove(f"/tmp/{mock_file_name_uploader_2}")


def test_generate_summary_report_with_two_ods_reports(
    bulk_upload_report_service,
    mock_get_times_for_scan,
):
    mock_file_name = (
        f"daily_statistical_report_bulk_upload_summary_{MOCK_TIMESTAMP}.csv"
    )

    ods_reports = bulk_upload_report_service.generate_ods_reports(MOCK_REPORT_ITEMS_ALL)
    assert len(ods_reports) == 2
    bulk_upload_report_service.generate_summary_report(ods_reports)
    expected = readfile("expected_bulk_upload_summary_report.csv")
    with open(f"/tmp/{mock_file_name}") as test_file:
        actual = test_file.read()
        assert expected == actual
    os.remove(f"/tmp/{mock_file_name}")


def test_generate_summary_report_passes_review_counts_to_csv_writer(
    bulk_upload_report_service,
    mock_get_times_for_scan,
    mocker,
):
    ods_reports = bulk_upload_report_service.generate_ods_reports(MOCK_REPORT_ITEMS_ALL)

    mock_write_summary_data_to_csv = mocker.patch.object(
        bulk_upload_report_service,
        "write_summary_data_to_csv",
    )

    bulk_upload_report_service.generate_summary_report(ods_reports)

    mock_write_summary_data_to_csv.assert_called_once_with(
        file_name=f"daily_statistical_report_bulk_upload_summary_{MOCK_TIMESTAMP}.csv",
        total_ingested=16,
        total_successful=10,
        total_successful_percentage="62.5%",
        total_registered_elsewhere=2,
        total_suspended=2,
        total_in_review=0,
        total_in_review_percentage="0%",
        total_deceased=2,
        total_restricted=2,
        extra_rows=[
            ["Success by ODS", "Y12345", 5],
            ["Success by ODS", "Z12345", 5],
            ["Reason for Y12345", "Could not find the given patient on PDS", 2],
            ["Reason for Y12345", "Lloyd George file already exists", 1],
            ["Reason for Z12345", "Could not find the given patient on PDS", 2],
            ["Reason for Z12345", "Lloyd George file already exists", 1],
        ],
    )


def test_generate_success_report_writes_csv(
    bulk_upload_report_service,
    mock_get_times_for_scan,
    mocker,
):
    mock_file_name = (
        f"daily_statistical_report_bulk_upload_success_{MOCK_TIMESTAMP}.csv"
    )
    bulk_upload_report_service.write_and_upload_additional_reports = mocker.MagicMock()

    test_ods_reports = bulk_upload_report_service.generate_ods_reports(
        MOCK_REPORT_ITEMS_ALL,
    )

    bulk_upload_report_service.generate_success_report(test_ods_reports)
    expected = readfile("expected_success_report.csv")
    with open(f"/tmp/{mock_file_name}") as test_file:
        actual = test_file.read()
        assert expected == actual
    os.remove(f"/tmp/{mock_file_name}")

    bulk_upload_report_service.write_and_upload_additional_reports.assert_called()


def test_generate_success_report_does_not_write_when_no_data(
    bulk_upload_report_service,
    mock_get_times_for_scan,
    mocker,
):
    bulk_upload_report_service.write_and_upload_additional_reports = mocker.MagicMock()

    blank_ods_reports = bulk_upload_report_service.generate_ods_reports([])

    bulk_upload_report_service.generate_success_report(blank_ods_reports)

    bulk_upload_report_service.write_and_upload_additional_reports.assert_not_called()


def test_generate_suspended_report_writes_csv(
    bulk_upload_report_service,
    mock_get_times_for_scan,
    mocker,
):
    bulk_upload_report_service.write_and_upload_additional_reports = mocker.MagicMock()

    test_ods_reports = bulk_upload_report_service.generate_ods_reports(
        MOCK_REPORT_ITEMS_ALL,
    )

    bulk_upload_report_service.generate_suspended_report(test_ods_reports)

    bulk_upload_report_service.write_and_upload_additional_reports.assert_called()


def test_generate_suspended_report_does_not_write_when_no_data(
    bulk_upload_report_service,
    mock_get_times_for_scan,
    mocker,
):
    bulk_upload_report_service.write_and_upload_additional_reports = mocker.MagicMock()

    blank_ods_reports = bulk_upload_report_service.generate_ods_reports([])

    bulk_upload_report_service.generate_suspended_report(blank_ods_reports)

    bulk_upload_report_service.s3_service.upload_file.assert_not_called()


def test_generate_deceased_report_writes_csv(
    bulk_upload_report_service,
    mock_get_times_for_scan,
    mocker,
):
    bulk_upload_report_service.write_and_upload_additional_reports = mocker.MagicMock()

    test_ods_reports = bulk_upload_report_service.generate_ods_reports(
        MOCK_REPORT_ITEMS_ALL,
    )

    bulk_upload_report_service.generate_deceased_report(test_ods_reports)

    bulk_upload_report_service.write_and_upload_additional_reports.assert_called()


def test_generate_deceased_report_does_not_write_when_no_data(
    bulk_upload_report_service,
    mock_get_times_for_scan,
    mocker,
):
    bulk_upload_report_service.write_and_upload_additional_reports = mocker.MagicMock()

    blank_ods_reports = bulk_upload_report_service.generate_ods_reports([])

    bulk_upload_report_service.generate_deceased_report(blank_ods_reports)

    bulk_upload_report_service.s3_service.upload_file.assert_not_called()


def test_generate_restricted_report_writes_csv(
    bulk_upload_report_service,
    mock_get_times_for_scan,
    mocker,
):
    bulk_upload_report_service.write_and_upload_additional_reports = mocker.MagicMock()

    test_ods_reports = bulk_upload_report_service.generate_ods_reports(
        MOCK_REPORT_ITEMS_ALL,
    )

    bulk_upload_report_service.generate_restricted_report(test_ods_reports)

    bulk_upload_report_service.write_and_upload_additional_reports.assert_called()


def test_generate_restricted_report_does_not_write_when_no_data(
    bulk_upload_report_service,
    mock_get_times_for_scan,
    mocker,
):
    bulk_upload_report_service.write_and_upload_additional_reports = mocker.MagicMock()

    blank_ods_reports = bulk_upload_report_service.generate_ods_reports([])

    bulk_upload_report_service.generate_restricted_report(blank_ods_reports)

    bulk_upload_report_service.s3_service.upload_file.assert_not_called()


def test_generate_rejected_report_writes_csv(
    bulk_upload_report_service,
    mock_get_times_for_scan,
    mocker,
):
    mock_file_name = (
        f"daily_statistical_report_bulk_upload_rejected_{MOCK_TIMESTAMP}.csv"
    )
    bulk_upload_report_service.write_and_upload_additional_reports = mocker.MagicMock()

    test_ods_reports = bulk_upload_report_service.generate_ods_reports(
        MOCK_REPORT_ITEMS_ALL,
    )

    bulk_upload_report_service.generate_rejected_report(test_ods_reports)

    expected = readfile("expected_rejected_report.csv")
    with open(f"/tmp/{mock_file_name}") as test_file:
        actual = test_file.read()
        assert expected == actual
    os.remove(f"/tmp/{mock_file_name}")

    bulk_upload_report_service.write_and_upload_additional_reports.assert_called()


def test_generate_rejected_report_does_not_write_when_no_data(
    bulk_upload_report_service,
    mock_get_times_for_scan,
    mocker,
):
    bulk_upload_report_service.write_and_upload_additional_reports = mocker.MagicMock()

    blank_ods_reports = bulk_upload_report_service.generate_ods_reports([])

    bulk_upload_report_service.generate_rejected_report(blank_ods_reports)

    bulk_upload_report_service.s3_service.upload_file.assert_not_called()


def test_write_and_upload_additional_reports_creates_csv_and_writes_to_s3(
    bulk_upload_report_service,
    mock_get_times_for_scan,
):
    mock_file_name = (
        f"daily_statistical_report_bulk_upload_rejected_{MOCK_TIMESTAMP}.csv"
    )

    mock_headers = [
        MetadataReport.NhsNumber,
        MetadataReport.UploaderOdsCode,
        MetadataReport.Date,
        MetadataReport.Reason,
        MetadataReport.RegisteredAtUploaderPractice,
        MetadataReport.SentToReview,
    ]

    mock_data_rows = [
        [
            "9000000005",
            "Y12345",
            "2012-01-13",
            "Could not find the given patient on PDS",
            "True",
            False,
        ],
        [
            "9000000006",
            "Y12345",
            "2012-01-13",
            "Could not find the given patient on PDS",
            "True",
            False,
        ],
        [
            "9000000007",
            "Y12345",
            "2012-01-13",
            "Lloyd George file already exists",
            "True",
            False,
        ],
        [
            "9000000014",
            "Z12345",
            "2012-01-13",
            "Could not find the given patient on PDS",
            "True",
            False,
        ],
        [
            "9000000015",
            "Z12345",
            "2012-01-13",
            "Could not find the given patient on PDS",
            "True",
            False,
        ],
        [
            "9000000016",
            "Z12345",
            "2012-01-13",
            "Lloyd George file already exists",
            "True",
            False,
        ],
    ]

    bulk_upload_report_service.write_and_upload_additional_reports(
        mock_file_name,
        mock_headers,
        mock_data_rows,
    )

    expected = readfile("expected_rejected_report.csv")
    with open(f"/tmp/{mock_file_name}") as test_file:
        actual = test_file.read()
        assert expected == actual
    os.remove(f"/tmp/{mock_file_name}")

    bulk_upload_report_service.s3_service.upload_file.assert_called_with(
        s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
        file_key=f"bulk-upload-reports/2012-01-13/{mock_file_name}",
        file_name=f"/tmp/{mock_file_name}",
    )
