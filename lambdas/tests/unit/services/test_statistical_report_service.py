import tempfile
from random import shuffle
from unittest.mock import call

import polars as pl
import pytest
from freezegun import freeze_time
from polars.testing import assert_frame_equal

from models.report.statistics import ApplicationData, OrganisationData
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service
from services.statistical_report_service import StatisticalReportService
from tests.unit.conftest import (
    MOCK_STATISTICS_REPORT_BUCKET_NAME,
    MOCK_STATISTICS_TABLE,
)
from tests.unit.helpers.data.statistic.mock_data_build_utils import (
    build_random_application_data,
    build_random_organisation_data,
    build_random_record_store_data,
)
from tests.unit.helpers.data.statistic.mock_statistic_data import (
    ALL_MOCKED_STATISTIC_DATA,
    EXPECTED_SUMMARY_APPLICATION_DATA,
    EXPECTED_SUMMARY_ORGANISATION_DATA,
    EXPECTED_SUMMARY_RECORD_STORE_DATA,
    EXPECTED_WEEKLY_SUMMARY,
    MOCK_APPLICATION_DATA_1,
    MOCK_APPLICATION_DATA_2,
    MOCK_APPLICATION_DATA_3,
    MOCK_DYNAMODB_QUERY_RESPONSE,
    MOCK_ORGANISATION_DATA_1,
    MOCK_ORGANISATION_DATA_2,
    MOCK_ORGANISATION_DATA_3,
    MOCK_RECORD_STORE_DATA_1,
    MOCK_RECORD_STORE_DATA_2,
    MOCK_RECORD_STORE_DATA_3,
)
from utils.exceptions import StatisticDataNotFoundException


@pytest.fixture
def mock_service(set_env, mock_s3_service, mock_dynamodb_service):
    return StatisticalReportService()


@pytest.fixture
def mock_s3_service(mocker):
    patched_instance = mocker.patch(
        "services.statistical_report_service.S3Service",
        spec=S3Service,
    ).return_value

    yield patched_instance


@pytest.fixture
def mock_dynamodb_service(mocker):
    patched_instance = mocker.patch(
        "services.statistical_report_service.DynamoDBService",
        spec=DynamoDBService,
    ).return_value

    yield patched_instance


@pytest.fixture
def mock_temp_folder(mocker):
    mocker.patch.object(pl.DataFrame, "write_csv")
    mocker.patch("shutil.rmtree")
    temp_folder = tempfile.mkdtemp()
    mocker.patch.object(tempfile, "mkdtemp", return_value=temp_folder)
    yield temp_folder


@freeze_time("2024-06-06T18:00:00Z")
def test_datetime_correctly_configured_during_initialise(set_env):
    service = StatisticalReportService()

    assert service.dates_to_collect == [
        "20240530",
        "20240531",
        "20240601",
        "20240602",
        "20240603",
        "20240604",
        "20240605",
    ]
    assert service.report_period == "20240530-20240605"


@freeze_time("20240512T07:00:00Z")
def test_make_weekly_summary(set_env, mocker):
    data = ALL_MOCKED_STATISTIC_DATA
    service = StatisticalReportService()
    service.get_statistic_data = mocker.MagicMock(return_value=data)

    actual = service.make_weekly_summary()
    expected = EXPECTED_WEEKLY_SUMMARY

    assert_frame_equal(
        actual,
        expected,
        check_row_order=False,
        check_dtypes=False,
        check_exact=False,
    )


def test_get_statistic_data(mock_dynamodb_service, mock_service):
    mock_service.dates_to_collect = ["20240510", "20240511"]
    mock_dynamodb_service.query_table.side_effect = MOCK_DYNAMODB_QUERY_RESPONSE

    actual = mock_service.get_statistic_data()
    expected = ALL_MOCKED_STATISTIC_DATA

    assert actual == expected

    expected_calls = [
        call(
            table_name=MOCK_STATISTICS_TABLE,
            search_key="Date",
            search_condition="20240510",
        ),
        call(
            table_name=MOCK_STATISTICS_TABLE,
            search_key="Date",
            search_condition="20240511",
        ),
    ]

    mock_dynamodb_service.query_table.assert_has_calls(expected_calls)


def test_get_statistic_data_raise_error_if_all_data_are_empty(
    mock_dynamodb_service,
    mock_service,
):
    mock_dynamodb_service.query_table.return_value = []

    with pytest.raises(StatisticDataNotFoundException):
        mock_service.get_statistic_data()


def test_summarise_record_store_data(mock_service):
    actual = mock_service.summarise_record_store_data(
        [MOCK_RECORD_STORE_DATA_1, MOCK_RECORD_STORE_DATA_2, MOCK_RECORD_STORE_DATA_3],
    )

    expected = EXPECTED_SUMMARY_RECORD_STORE_DATA

    assert_frame_equal(actual, expected, check_row_order=False, check_dtypes=False)


def test_summarise_record_store_data_larger_mock_data(mock_service):
    mock_data_h81109 = build_random_record_store_data(
        "H81109",
        ["20240601", "20240603", "20240604", "20240605", "20240607"],
    )
    mock_data_y12345 = build_random_record_store_data(
        "Y12345",
        ["20240601", "20240602", "20240603", "20240606"],
    )
    mock_record_store_data = mock_data_h81109 + mock_data_y12345
    shuffle(mock_record_store_data)

    latest_record_in_h81109 = max(mock_data_h81109, key=lambda record: record.date)
    latest_record_in_y12345 = max(mock_data_y12345, key=lambda record: record.date)
    expected = pl.DataFrame([latest_record_in_h81109, latest_record_in_y12345]).drop(
        "date",
        "statistic_id",
    )

    actual = mock_service.summarise_record_store_data(mock_record_store_data)

    assert_frame_equal(actual, expected, check_row_order=False, check_dtypes=False)


def test_summarise_record_store_data_can_handle_empty_input(mock_service):
    empty_input = []
    actual = mock_service.summarise_record_store_data(empty_input)

    assert isinstance(actual, pl.DataFrame)
    assert actual.is_empty()


def test_summarise_organisation_data(mock_service):
    actual = mock_service.summarise_organisation_data(
        [MOCK_ORGANISATION_DATA_1, MOCK_ORGANISATION_DATA_2, MOCK_ORGANISATION_DATA_3],
    )

    expected = EXPECTED_SUMMARY_ORGANISATION_DATA

    assert_frame_equal(
        actual,
        expected,
        check_row_order=False,
        check_dtypes=False,
        check_column_order=False,
    )


def test_summarise_organisation_data_larger_mock_data(mock_service):
    mock_data_h81109 = build_random_organisation_data(
        "H81109",
        ["20240603", "20240604", "20240605", "20240606", "20240607"],
    )
    mock_data_y12345 = build_random_organisation_data(
        "Y12345",
        ["20240603", "20240604", "20240605", "20240606", "20240607"],
    )
    mock_input_data = {"H81109": mock_data_h81109, "Y12345": mock_data_y12345}

    mock_organisation_data = mock_data_h81109 + mock_data_y12345
    shuffle(mock_organisation_data)

    actual = mock_service.summarise_organisation_data(mock_organisation_data)

    for ods_code in mock_input_data.keys():
        mock_data_of_ods_code = mock_input_data[ods_code]
        row_in_actual_data = actual.filter(pl.col("ods_code") == ods_code)
        assert_weekly_counts_match_sum_of_daily_counts(
            mock_data_of_ods_code,
            row_in_actual_data,
        )
        assert_average_record_per_patient_correct(
            mock_data_of_ods_code,
            row_in_actual_data,
        )
        assert_number_of_patient_correct(mock_data_of_ods_code, row_in_actual_data)
        assert_weekly_unique_user_counts_match_unique_user_ids(
            mock_data_of_ods_code,
            row_in_actual_data,
        )


def assert_weekly_counts_match_sum_of_daily_counts(mock_data, row_in_actual_data):
    for count_type in ["viewed", "downloaded", "upload", "deleted"]:
        expected_weekly_count = sum(
            getattr(data, f"daily_count_{count_type}") for data in mock_data
        )
        actual_weekly_count = row_in_actual_data.item(0, f"weekly_count_{count_type}")

        assert actual_weekly_count == expected_weekly_count


def assert_average_record_per_patient_correct(mock_data, row_in_actual_data):
    expected_average_patient_record = sum(
        data.average_records_per_patient for data in mock_data
    ) / len(mock_data)
    actual_average_patient_record = row_in_actual_data.item(
        0,
        "average_records_per_patient",
    )

    assert actual_average_patient_record == float(expected_average_patient_record)


def assert_number_of_patient_correct(mock_data, row_in_actual_data):
    most_recent_record_in_mock_data = max(mock_data, key=lambda data: data.date)
    expected_number_of_patients = most_recent_record_in_mock_data.number_of_patients
    actual_number_of_patient = row_in_actual_data.item(0, "number_of_patients")

    assert actual_number_of_patient == expected_number_of_patients


def assert_weekly_unique_user_counts_match_unique_user_ids(
    mock_data,
    row_in_actual_data,
):
    count_to_user_id_map = {
        "weekly_count_users_uploaded": "daily_user_ids_uploaded",
        "weekly_count_users_reviewed": "daily_user_ids_reviewed",
        "weekly_count_users_reassigned": "daily_user_ids_reassigned",
        "weekly_count_users_accessing_review": "daily_user_ids_accessed_review",
        "weekly_count_users_accessing_deceased": "daily_user_ids_accessed_deceased_patient",
    }

    for weekly_count_column, user_id_column in count_to_user_id_map.items():
        all_user_ids = []
        for data in mock_data:
            all_user_ids.extend(getattr(data, user_id_column))
        expected_unique_count = len(set(all_user_ids))
        actual_unique_count = row_in_actual_data.item(0, weekly_count_column)

        assert actual_unique_count == expected_unique_count


def test_summarise_organisation_data_counts_unique_users_across_days(mock_service):
    day1 = OrganisationData(
        ods_code="TEST01",
        date="20240101",
        daily_user_ids_uploaded=["user1", "user2"],
        daily_user_ids_reviewed=["user1", "user3"],
        daily_user_ids_reassigned=["user1", "user4"],
        daily_user_ids_accessed_review=["user1", "user5"],
        daily_user_ids_accessed_deceased_patient=["user1", "user6"],
    )
    day2 = OrganisationData(
        ods_code="TEST01",
        date="20240102",
        daily_user_ids_uploaded=["user1", "user7"],
        daily_user_ids_reviewed=["user1", "user8"],
        daily_user_ids_reassigned=["user1", "user9"],
        daily_user_ids_accessed_review=["user1", "user10"],
        daily_user_ids_accessed_deceased_patient=["user1", "user11"],
    )
    day3 = OrganisationData(
        ods_code="TEST01",
        date="20240103",
        daily_user_ids_uploaded=["user1", "user2", "user12"],
        daily_user_ids_reviewed=["user1", "user3", "user13"],
        daily_user_ids_reassigned=["user1", "user4", "user14"],
        daily_user_ids_accessed_review=["user1", "user5", "user15"],
        daily_user_ids_accessed_deceased_patient=["user1", "user6", "user16"],
    )

    actual = mock_service.summarise_organisation_data([day1, day2, day3])

    assert actual.item(0, "weekly_count_users_uploaded") == 4
    assert actual.item(0, "weekly_count_users_reviewed") == 4
    assert actual.item(0, "weekly_count_users_reassigned") == 4
    assert actual.item(0, "weekly_count_users_accessing_review") == 4
    assert actual.item(0, "weekly_count_users_accessing_deceased") == 4


def test_summarise_organisation_data_can_handle_empty_input(mock_service):
    empty_input = []
    actual = mock_service.summarise_organisation_data(empty_input)

    assert isinstance(actual, pl.DataFrame)
    assert actual.is_empty()


def test_summarise_application_data(mock_service):
    mock_data = [
        MOCK_APPLICATION_DATA_1,
        MOCK_APPLICATION_DATA_2,
        MOCK_APPLICATION_DATA_3,
    ]

    expected = EXPECTED_SUMMARY_APPLICATION_DATA
    actual = mock_service.summarise_application_data(mock_data)

    assert_frame_equal(
        actual,
        expected,
        check_dtypes=False,
        check_row_order=False,
        check_column_order=False,
    )


def test_summarise_application_data_larger_mock_data(mock_service):
    mock_data_h81109 = build_random_application_data(
        "H81109",
        ["20240603", "20240604", "20240605", "20240606", "20240607"],
    )
    mock_data_y12345 = build_random_application_data(
        "Y12345",
        ["20240603", "20240604", "20240605", "20240606", "20240607"],
    )
    mock_organisation_data = mock_data_h81109 + mock_data_y12345
    shuffle(mock_organisation_data)

    active_users_count_h81109 = count_unique_user_ids(mock_data_h81109)
    active_users_count_y12345 = count_unique_user_ids(mock_data_y12345)

    expected = pl.DataFrame(
        [
            {
                "ods_code": "H81109",
                "active_users_count": len(active_users_count_h81109),
                "unique_active_user_ids_hashed": str(active_users_count_h81109),
            },
            {
                "ods_code": "Y12345",
                "active_users_count": len(active_users_count_y12345),
                "unique_active_user_ids_hashed": str(active_users_count_y12345),
            },
        ],
    )
    actual = mock_service.summarise_application_data(mock_organisation_data)

    assert_frame_equal(
        actual,
        expected,
        check_dtypes=False,
        check_row_order=False,
        check_column_order=False,
    )


def count_unique_user_ids(mock_data: list[ApplicationData]) -> list:
    active_users_of_each_day = [set(data.active_user_ids_hashed) for data in mock_data]
    unique_active_users_for_whole_week = set.union(*active_users_of_each_day)

    return sorted(list(unique_active_users_for_whole_week))


def test_summarise_application_data_can_handle_empty_input(mock_service):
    empty_input = []
    actual = mock_service.summarise_application_data(empty_input)

    assert isinstance(actual, pl.DataFrame)
    assert actual.is_empty()


def test_summarise_organisation_data_sums_file_type_breakdown_columns(mock_service):
    data_day1 = OrganisationData(
        date="20240510",
        ods_code="Z56789",
        daily_count_upload_review_lloyd_george_record_folder=3,
        daily_count_upload_lloyd_george_record_folder=1,
    )
    data_day2 = OrganisationData(
        date="20240511",
        ods_code="Z56789",
        daily_count_upload_review_lloyd_george_record_folder=2,
        daily_count_upload_lloyd_george_record_folder=4,
    )

    actual = mock_service.summarise_organisation_data([data_day1, data_day2])

    assert actual.item(0, "weekly_count_upload_review_lloyd_george_record_folder") == 5
    assert actual.item(0, "weekly_count_upload_lloyd_george_record_folder") == 5


def test_summarise_organisation_data_sums_multiple_file_types_per_ods_code(
    mock_service,
):
    data_day1 = OrganisationData(
        date="20240510",
        ods_code="H81109",
        daily_count_upload_review_electronic_health_record=5,
        daily_count_upload_review_care_plan=2,
    )
    data_day2 = OrganisationData(
        date="20240511",
        ods_code="H81109",
        daily_count_upload_review_electronic_health_record=3,
        daily_count_upload_review_care_plan=1,
    )

    actual = mock_service.summarise_organisation_data([data_day1, data_day2])

    assert actual.item(0, "weekly_count_upload_review_electronic_health_record") == 8
    assert actual.item(0, "weekly_count_upload_review_care_plan") == 3


def test_reorder_columns_puts_priority_columns_first(mock_service):
    input_df = pl.DataFrame(
        [
            {
                "ods_code": "Z56789",
                "weekly_count_upload": 0,
                "weekly_count_viewed": 35,
                "weekly_count_deleted": 1,
                "weekly_count_searched": 0,
                "weekly_count_users_uploaded": 0,
                "weekly_count_users_reviewed": 0,
                "weekly_count_users_reassigned": 0,
                "weekly_count_users_accessing_review": 3,
                "weekly_count_users_accessing_deceased": 12,
                "weekly_count_ods_report_requested": 10,
                "weekly_count_ods_report_created": 0,
                "weekly_count_upload_review": 0,
                "weekly_count_downloaded": 4,
                "active_users_count": 1,
                "unique_active_user_ids_hashed": "[]",
                "number_of_patients": 4,
                "total_number_of_records": 18,
                "date": "20240530-20240605",
            },
        ],
    )

    actual = mock_service.reorder_columns(input_df)

    columns = actual.columns
    assert columns[0] == "date"
    assert columns[1] == "ods_code"
    assert columns[2] == "number_of_patients"
    assert columns[3] == "total_number_of_records"
    assert "weekly_count_upload_review" in columns
    assert "weekly_count_upload" in columns


def test_reorder_columns_puts_extra_columns_after_priority_columns_sorted(mock_service):
    input_df = pl.DataFrame(
        [
            {
                "ods_code": "Z56789",
                "date": "20240530-20240605",
                "number_of_patients": 4,
                "total_number_of_records": 18,
                "weekly_count_upload_review": 0,
                "weekly_count_upload": 0,
                "weekly_count_upload_review_care_plan": 1,
                "weekly_count_upload_lloyd_george_record_folder": 2,
            },
        ],
    )

    actual = mock_service.reorder_columns(input_df)

    priority = [
        "date",
        "ods_code",
        "number_of_patients",
        "total_number_of_records",
        "weekly_count_upload_review",
        "weekly_count_upload",
    ]
    for i, col in enumerate(priority):
        assert actual.columns[i] == col

    extra_cols = actual.columns[len(priority) :]
    assert extra_cols == sorted(extra_cols)


def test_rename_snakecase_columns_converts_ods_code(mock_service):
    assert mock_service.rename_snakecase_columns("ods_code") == "ODS code"


def test_rename_snakecase_columns_humanizes_snake_case(mock_service):
    assert (
        mock_service.rename_snakecase_columns("weekly_count_upload")
        == "Weekly count upload"
    )
    assert (
        mock_service.rename_snakecase_columns("number_of_patients")
        == "Number of patients"
    )
    assert (
        mock_service.rename_snakecase_columns("weekly_count_upload_review_care_plan")
        == "Weekly count upload review care plan"
    )


def test_tidy_up_data_updates_date_and_renames_columns(mock_service):
    mock_service.report_period = "20240530-20240605"
    input_df = pl.DataFrame(
        [{"ods_code": "Z56789", "number_of_patients": 4, "weekly_count_upload": 2}],
    )

    actual = mock_service.tidy_up_data(input_df)

    assert "Date" in actual.columns
    assert actual.item(0, "Date") == "20240530-20240605"
    assert "ODS code" in actual.columns
    assert "Number of patients" in actual.columns
    assert "Weekly count upload" in actual.columns


def test_join_dataframes_by_ods_code(mock_service):
    mock_data_1 = pl.DataFrame([{"ods_code": "Y12345", "field1": "apple"}])
    mock_data_2 = pl.DataFrame(
        [
            {"ods_code": "Y12345", "field2": "banana"},
            {"ods_code": "Z56789", "field2": "cherry"},
        ],
    )

    expected = pl.DataFrame(
        [
            {"ods_code": "Y12345", "field1": "apple", "field2": "banana"},
            {"ods_code": "Z56789", "field2": "cherry"},
        ],
    )
    actual = mock_service.join_dataframes_by_ods_code([mock_data_1, mock_data_2])

    assert_frame_equal(actual, expected, check_dtypes=False, check_row_order=False)


def test_join_dataframes_by_ods_code_can_handle_empty_dataframe(mock_service):
    mock_data_1 = pl.DataFrame([{"ods_code": "Y12345", "field1": "cat"}])
    mock_data_2 = pl.DataFrame()
    mock_data_3 = pl.DataFrame(
        [
            {"ods_code": "Y12345", "field2": "dog"},
            {"ods_code": "Z56789", "field3": "lizard"},
        ],
    )

    expected = pl.DataFrame(
        [
            {"ods_code": "Y12345", "field1": "cat", "field2": "dog"},
            {"ods_code": "Z56789", "field3": "lizard"},
        ],
    )
    actual = mock_service.join_dataframes_by_ods_code(
        [mock_data_1, mock_data_2, mock_data_3],
    )

    assert_frame_equal(actual, expected, check_dtypes=False, check_row_order=False)


@freeze_time("20240512T07:00:00Z")
def test_store_report_to_s3(set_env, mock_s3_service, mock_temp_folder):
    mock_weekly_summary = EXPECTED_WEEKLY_SUMMARY
    expected_date_folder = "2024-05-11"
    expected_filename = "statistical_report_20240505-20240511.csv"

    service = StatisticalReportService()

    service.store_report_to_s3(mock_weekly_summary)

    mock_s3_service.upload_file.assert_called_with(
        s3_bucket_name=MOCK_STATISTICS_REPORT_BUCKET_NAME,
        file_key=f"statistic-reports/{expected_date_folder}/{expected_filename}",
        file_name=f"{mock_temp_folder}/{expected_filename}",
    )
