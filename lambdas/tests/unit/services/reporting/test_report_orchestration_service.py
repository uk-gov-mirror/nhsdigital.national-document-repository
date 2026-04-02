from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from services.reporting.report_orchestration_service import ReportOrchestrationService


def make_validated_record(uploader_ods_code, record_id):
    return SimpleNamespace(
        uploader_ods_code=uploader_ods_code,
        id=str(record_id),
    )


@pytest.fixture
def mock_repository(mocker):
    repo = mocker.Mock(name="ReportingDynamoRepositoryInstance")
    repo.get_records_for_time_window.return_value = []
    return repo


@pytest.fixture
def mock_excel_generator(mocker):
    return mocker.Mock(name="ExcelReportGeneratorInstance")


@pytest.fixture
def report_orchestration_service(mocker, mock_repository, mock_excel_generator):
    mocker.patch(
        "services.reporting.report_orchestration_service.ReportingDynamoRepository",
        autospec=True,
        return_value=mock_repository,
    )
    mocker.patch(
        "services.reporting.report_orchestration_service.ExcelReportGenerator",
        autospec=True,
        return_value=mock_excel_generator,
    )
    return ReportOrchestrationService()


@pytest.fixture
def mocked_generate(report_orchestration_service, mocker):
    return mocker.patch.object(
        report_orchestration_service,
        "generate_ods_report",
        autospec=True,
        side_effect=lambda ods_code, _records: f"/tmp/{ods_code}.xlsx",
    )


@pytest.mark.parametrize(
    "raw_records, validated_records, expected_generate_calls, expected_result",
    [
        (
            [],
            [],
            [],
            {},
        ),
        (
            [{"UploaderOdsCode": "X1", "ID": "1"}],
            [make_validated_record("X1", "1")],
            [
                ("X1", [make_validated_record("X1", "1")]),
            ],
            {"X1": "/tmp/X1.xlsx"},
        ),
        (
            [
                {"UploaderOdsCode": "Y12345", "ID": "1"},
                {"UploaderOdsCode": "Y12345", "ID": "2"},
                {"UploaderOdsCode": "A99999", "ID": "3"},
            ],
            [
                make_validated_record("Y12345", "1"),
                make_validated_record("Y12345", "2"),
                make_validated_record("A99999", "3"),
            ],
            [
                (
                    "Y12345",
                    [
                        make_validated_record("Y12345", "1"),
                        make_validated_record("Y12345", "2"),
                    ],
                ),
                ("A99999", [make_validated_record("A99999", "3")]),
            ],
            {"Y12345": "/tmp/Y12345.xlsx", "A99999": "/tmp/A99999.xlsx"},
        ),
        (
            [
                {"UploaderOdsCode": "Y12345", "ID": "1"},
                {"UploaderOdsCode": None, "ID": "2"},
                {"UploaderOdsCode": "", "ID": "3"},
            ],
            [
                make_validated_record("Y12345", "1"),
                make_validated_record(None, "2"),
                make_validated_record("", "3"),
            ],
            [
                ("Y12345", [make_validated_record("Y12345", "1")]),
                (
                    "UNKNOWN",
                    [make_validated_record(None, "2"), make_validated_record("", "3")],
                ),
            ],
            {"Y12345": "/tmp/Y12345.xlsx", "UNKNOWN": "/tmp/UNKNOWN.xlsx"},
        ),
    ],
)
def test_process_reporting_window_behaviour(
    report_orchestration_service,
    mock_repository,
    mocked_generate,
    mocker,
    raw_records,
    validated_records,
    expected_generate_calls,
    expected_result,
):
    mock_repository.get_records_for_time_window.return_value = raw_records

    validated_iter = iter(validated_records)
    mocker.patch(
        "services.reporting.report_orchestration_service.BulkUploadReport.model_validate",
        side_effect=lambda _record: next(validated_iter),
    )

    result = report_orchestration_service.process_reporting_window(100, 200)

    mock_repository.get_records_for_time_window.assert_called_once_with(100, 200)

    assert mocked_generate.call_count == len(expected_generate_calls)
    for ods_code, ods_records in expected_generate_calls:
        mocked_generate.assert_any_call(ods_code, ods_records)

    assert result == expected_result


def test_process_reporting_window_skips_invalid_records(
    report_orchestration_service,
    mock_repository,
    mocked_generate,
    mocker,
):
    raw_records = [
        {"UploaderOdsCode": "Y12345", "ID": "1"},
        {"UploaderOdsCode": "A99999", "ID": "2"},
    ]
    mock_repository.get_records_for_time_window.return_value = raw_records

    valid_record = make_validated_record("Y12345", "1")

    mocker.patch(
        "services.reporting.report_orchestration_service.BulkUploadReport.model_validate",
        side_effect=[
            valid_record,
            ValidationError.from_exception_data(
                "BulkUploadReport",
                [],
            ),
        ],
    )

    result = report_orchestration_service.process_reporting_window(100, 200)

    mocked_generate.assert_called_once_with("Y12345", [valid_record])
    assert result == {"Y12345": "/tmp/Y12345.xlsx"}


def test_process_reporting_window_returns_empty_when_all_records_invalid(
    report_orchestration_service,
    mock_repository,
    mocked_generate,
    mocker,
):
    raw_records = [
        {"UploaderOdsCode": "Y12345", "ID": "1"},
        {"UploaderOdsCode": "A99999", "ID": "2"},
    ]
    mock_repository.get_records_for_time_window.return_value = raw_records

    mocker.patch(
        "services.reporting.report_orchestration_service.BulkUploadReport.model_validate",
        side_effect=[
            ValidationError.from_exception_data("BulkUploadReport", []),
            ValidationError.from_exception_data("BulkUploadReport", []),
        ],
    )

    result = report_orchestration_service.process_reporting_window(100, 200)

    mocked_generate.assert_not_called()
    assert result == {}


@pytest.mark.parametrize(
    "records, expected",
    [
        (
            [
                make_validated_record("Y12345", "1"),
                make_validated_record("Y12345", "2"),
                make_validated_record("A99999", "3"),
                make_validated_record(None, "4"),
                make_validated_record("", "5"),
            ],
            {
                "Y12345": [
                    make_validated_record("Y12345", "1"),
                    make_validated_record("Y12345", "2"),
                ],
                "A99999": [make_validated_record("A99999", "3")],
                "UNKNOWN": [
                    make_validated_record(None, "4"),
                    make_validated_record("", "5"),
                ],
            },
        ),
        ([], {}),
        (
            [make_validated_record("", "1")],
            {"UNKNOWN": [make_validated_record("", "1")]},
        ),
    ],
)
def test_group_records_by_ods(records, expected):
    result = ReportOrchestrationService.group_records_by_ods(records)

    assert dict(result) == expected


@pytest.fixture
def fake_named_tmpfile(mocker):
    fake_tmp = mocker.MagicMock()
    fake_tmp.__enter__.return_value = fake_tmp
    fake_tmp.__exit__.return_value = False
    fake_tmp.name = "/tmp/fake_Y12345.xlsx"

    mocked_ntf = mocker.patch(
        "services.reporting.report_orchestration_service.tempfile.NamedTemporaryFile",
        return_value=fake_tmp,
    )
    return mocked_ntf, fake_tmp


def test_generate_ods_report_creates_excel_report_and_returns_path(
    report_orchestration_service,
    mock_excel_generator,
    fake_named_tmpfile,
):
    mocked_ntf, fake_tmp = fake_named_tmpfile
    records = [make_validated_record("Y12345", "1")]

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


def test_init_constructs_repository_and_excel_generator(mocker):
    mock_repo = mocker.Mock(name="ReportingDynamoRepositoryInstance")
    mock_excel = mocker.Mock(name="ExcelReportGeneratorInstance")

    mocked_repo_cls = mocker.patch(
        "services.reporting.report_orchestration_service.ReportingDynamoRepository",
        autospec=True,
        return_value=mock_repo,
    )
    mocked_excel_cls = mocker.patch(
        "services.reporting.report_orchestration_service.ExcelReportGenerator",
        autospec=True,
        return_value=mock_excel,
    )

    svc = ReportOrchestrationService()

    mocked_repo_cls.assert_called_once_with()
    mocked_excel_cls.assert_called_once_with()
    assert svc.repository is mock_repo
    assert svc.excel_generator is mock_excel
