import pytest

from services.reporting.report_orchestration_service import ReportOrchestrationService


@pytest.fixture
def mock_repository(mocker):
    repo = mocker.Mock()
    repo.get_records_for_time_window.return_value = []
    return repo


@pytest.fixture
def mock_excel_generator(mocker):
    return mocker.Mock()


@pytest.fixture
def report_orchestration_service(mock_repository, mock_excel_generator):
    return ReportOrchestrationService(
        repository=mock_repository,
        excel_generator=mock_excel_generator,
    )


def test_process_reporting_window_no_records_returns_empty_dict_and_does_not_generate(
    report_orchestration_service, mock_repository, mock_excel_generator
):
    mock_repository.get_records_for_time_window.return_value = []

    result = report_orchestration_service.process_reporting_window(100, 200)

    assert result == {}
    mock_excel_generator.create_report_orchestration_xlsx.assert_not_called()


def test_process_reporting_window_calls_repository_with_window_args(
    report_orchestration_service, mock_repository, mocker
):
    mock_repository.get_records_for_time_window.return_value = [{"UploaderOdsCode": "X1", "ID": 1}]
    mocked_generate = mocker.patch.object(report_orchestration_service, "generate_ods_report", return_value="/tmp/x.xlsx")

    report_orchestration_service.process_reporting_window(100, 200)

    mock_repository.get_records_for_time_window.assert_called_once_with(100, 200)
    mocked_generate.assert_called_once()


def test_process_reporting_window_generates_reports_per_ods(
    report_orchestration_service, mock_repository, mocker
):
    records = [
        {"UploaderOdsCode": "Y12345", "ID": 1},
        {"UploaderOdsCode": "Y12345", "ID": 2},
        {"UploaderOdsCode": "A99999", "ID": 3},
    ]
    mock_repository.get_records_for_time_window.return_value = records

    mocked_generate = mocker.patch.object(
        report_orchestration_service, "generate_ods_report", return_value="/tmp/ignored.xlsx"
    )

    report_orchestration_service.process_reporting_window(100, 200)

    mocked_generate.assert_any_call(
        "Y12345",
        [
            {"UploaderOdsCode": "Y12345", "ID": 1},
            {"UploaderOdsCode": "Y12345", "ID": 2},
        ],
    )
    mocked_generate.assert_any_call(
        "A99999",
        [{"UploaderOdsCode": "A99999", "ID": 3}],
    )
    assert mocked_generate.call_count == 2


def test_process_reporting_window_returns_mapping_of_ods_to_generated_file_path(
    report_orchestration_service, mock_repository, mocker
):
    records = [
        {"UploaderOdsCode": "Y12345", "ID": 1},
        {"UploaderOdsCode": "A99999", "ID": 2},
    ]
    mock_repository.get_records_for_time_window.return_value = records

    def _side_effect(ods_code, ods_records):
        return f"/tmp/{ods_code}.xlsx"

    mocker.patch.object(
        report_orchestration_service,
        "generate_ods_report",
        side_effect=_side_effect,
    )

    result = report_orchestration_service.process_reporting_window(100, 200)

    assert result == {
        "Y12345": "/tmp/Y12345.xlsx",
        "A99999": "/tmp/A99999.xlsx",
    }


def test_process_reporting_window_includes_unknown_ods_group(
    report_orchestration_service, mock_repository, mocker
):
    records = [
        {"UploaderOdsCode": "Y12345", "ID": 1},
        {"ID": 2},  # missing ODS -> UNKNOWN
        {"UploaderOdsCode": None, "ID": 3},  # null ODS -> UNKNOWN
    ]
    mock_repository.get_records_for_time_window.return_value = records

    mocked_generate = mocker.patch.object(
        report_orchestration_service, "generate_ods_report", return_value="/tmp/ignored.xlsx"
    )

    report_orchestration_service.process_reporting_window(100, 200)

    # Expect 2 groups: Y12345 and UNKNOWN
    assert mocked_generate.call_count == 2
    mocked_generate.assert_any_call(
        "Y12345",
        [{"UploaderOdsCode": "Y12345", "ID": 1}],
    )
    mocked_generate.assert_any_call(
        "UNKNOWN",
        [{"ID": 2}, {"UploaderOdsCode": None, "ID": 3}],
    )


def test_group_records_by_ods_groups_correctly():
    records = [
        {"UploaderOdsCode": "Y12345", "ID": 1},
        {"UploaderOdsCode": "Y12345", "ID": 2},
        {"UploaderOdsCode": "A99999", "ID": 3},
        {"ID": 4},  # missing ODS
        {"UploaderOdsCode": None, "ID": 5},  # null ODS
    ]

    result = ReportOrchestrationService.group_records_by_ods(records)

    assert result["Y12345"] == [
        {"UploaderOdsCode": "Y12345", "ID": 1},
        {"UploaderOdsCode": "Y12345", "ID": 2},
    ]
    assert result["A99999"] == [{"UploaderOdsCode": "A99999", "ID": 3}]
    assert result["UNKNOWN"] == [
        {"ID": 4},
        {"UploaderOdsCode": None, "ID": 5},
    ]


def test_group_records_by_ods_empty_input_returns_empty_mapping():
    result = ReportOrchestrationService.group_records_by_ods([])
    assert dict(result) == {}


def test_group_records_by_ods_treats_empty_string_as_unknown():
    records = [{"UploaderOdsCode": "", "ID": 1}]
    result = ReportOrchestrationService.group_records_by_ods(records)
    assert result["UNKNOWN"] == [{"UploaderOdsCode": "", "ID": 1}]


def test_generate_ods_report_creates_excel_report_and_returns_path(
    report_orchestration_service, mock_excel_generator, mocker
):
    fake_tmp = mocker.MagicMock()
    fake_tmp.__enter__.return_value = fake_tmp
    fake_tmp.name = "/tmp/fake_Y12345.xlsx"

    mocked_ntf = mocker.patch(
        "services.reporting.report_orchestration_service.tempfile.NamedTemporaryFile",
        return_value=fake_tmp,
    )

    records = [{"ID": 1, "UploaderOdsCode": "Y12345"}]

    result_path = report_orchestration_service.generate_ods_report("Y12345", records)

    assert result_path == fake_tmp.name

    mocked_ntf.assert_called_once_with(
        suffix="_Y12345.xlsx",
        delete=False,
    )

    mock_excel_generator.create_report_orchestration_xlsx.assert_called_once_with(
        ods_code="Y12345",
        records=records,
        output_path=fake_tmp.name,
    )
