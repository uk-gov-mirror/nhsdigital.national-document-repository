import pytest
from freezegun import freeze_time
from openpyxl import load_workbook
from services.reporting.excel_report_generator_service import ExcelReportGenerator


@pytest.fixture
def excel_report_generator():
    return ExcelReportGenerator()


@pytest.fixture
def make_report(tmp_path, excel_report_generator):
    def _make(*, ods_code="Y12345", records=None, filename="report.xlsx"):
        records = records or []
        output_file = tmp_path / filename

        result = excel_report_generator.create_report_orchestration_xlsx(
            ods_code=ods_code,
            records=records,
            output_path=str(output_file),
        )

        assert result == str(output_file)
        assert output_file.exists()

        wb = load_workbook(output_file)
        ws = wb.active
        return output_file, ws

    return _make


@pytest.fixture
def expected_header_row():
    return [
        "NHS Number",
        "Date",
        "Uploader ODS",
        "PDS ODS",
        "Upload Status",
        "Reason",
        "File Path",
    ]


@freeze_time("2025-01-01T12:00:00")
def test_create_report_orchestration_xlsx_happy_path(make_report, expected_header_row):
    ods_code = "Y12345"
    records = [
        {
            "ID": 1,
            "Date": "2025-01-01",
            "NhsNumber": "1234567890",
            "UploaderOdsCode": "Y12345",
            "PdsOdsCode": "A99999",
            "UploadStatus": "SUCCESS",
            "Reason": "",
            "FilePath": "/path/file1.pdf",
        },
        {
            "ID": 2,
            "Date": "2025-01-02",
            "NhsNumber": "123456789",
            "UploaderOdsCode": "Y12345",
            "PdsOdsCode": "B88888",
            "UploadStatus": "FAILED",
            "Reason": "Invalid NHS number",
            "FilePath": "/path/file2.pdf",
        },
    ]

    _, ws = make_report(ods_code=ods_code, records=records, filename="report.xlsx")

    assert ws.title == "Daily Upload Report"
    assert ws["A1"].value == f"ODS Code: {ods_code}"
    assert ws["A2"].value == "Generated at (UTC): 2025-01-01T12:00:00+00:00"
    assert ws["A3"].value is None

    assert [cell.value for cell in ws[4]] == expected_header_row

    assert [cell.value for cell in ws[5]] == [
        "1234567890",
        "2025-01-01",
        "Y12345",
        "A99999",
        "SUCCESS",
        None,
        "/path/file1.pdf",
    ]

    assert [cell.value for cell in ws[6]] == [
        "123456789",
        "2025-01-02",
        "Y12345",
        "B88888",
        "FAILED",
        "Invalid NHS number",
        "/path/file2.pdf",
    ]


def test_create_report_orchestration_xlsx_with_no_records(
    make_report,
    expected_header_row,
):
    _, ws = make_report(records=[], filename="empty_report.xlsx")

    assert ws.max_row == 4
    assert [cell.value for cell in ws[4]] == expected_header_row


@pytest.mark.parametrize(
    "records, expected_row",
    [
        (
            [{"ID": 1, "NhsNumber": "1234567890"}],
            ["1234567890", None, None, None, None, None, None],
        ),
        (
            [{"Date": "2025-01-01"}],
            [None, "2025-01-01", None, None, None, None, None],
        ),
        (
            [{"UploaderOdsCode": "Y12345", "UploadStatus": "SUCCESS"}],
            [None, None, "Y12345", None, "SUCCESS", None, None],
        ),
    ],
)
def test_create_report_orchestration_xlsx_handles_missing_fields(
    make_report,
    expected_header_row,
    records,
    expected_row,
):
    _, ws = make_report(records=records, filename="partial.xlsx")

    assert [cell.value for cell in ws[4]] == expected_header_row
    assert [cell.value for cell in ws[5]] == expected_row
