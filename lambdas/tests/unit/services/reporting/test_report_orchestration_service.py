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


def test_process_reporting_window_no_records(
    report_orchestration_service, mock_repository, mock_excel_generator
):
    mock_repository.get_records_for_time_window.return_value = []

    report_orchestration_service.process_reporting_window(100, 200, output_dir="/tmp")

    mock_excel_generator.create_report_orchestration_xlsx.assert_not_called()


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
        report_orchestration_service, "generate_ods_report"
    )

    report_orchestration_service.process_reporting_window(100, 200, output_dir="/tmp")

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


def test_generate_ods_report_creates_excel_report(
    report_orchestration_service, mock_excel_generator, mocker
):
    fake_tmp = mocker.MagicMock()
    fake_tmp.__enter__.return_value = fake_tmp
    fake_tmp.name = "/tmp/fake_Y12345.xlsx"

    mocker.patch(
        "services.reporting.report_orchestration_service.tempfile.NamedTemporaryFile",
        return_value=fake_tmp,
    )

    records = [{"ID": 1, "UploaderOdsCode": "Y12345"}]

    report_orchestration_service.generate_ods_report("Y12345", records)

    mock_excel_generator.create_report_orchestration_xlsx.assert_called_once_with(
        ods_code="Y12345",
        records=records,
        output_path=fake_tmp.name,
    )
