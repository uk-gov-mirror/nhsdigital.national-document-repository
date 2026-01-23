import pytest
from freezegun import freeze_time
from openpyxl import load_workbook
from services.reporting.excel_report_generator_service import ExcelReportGenerator


@pytest.fixture
def excel_report_generator():
    return ExcelReportGenerator()


@freeze_time("2025-01-01T12:00:00")
def test_create_report_orchestration_xlsx_happy_path(
    excel_report_generator,
    tmp_path,
):
    output_file = tmp_path / "report.xlsx"

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

    result = excel_report_generator.create_report_orchestration_xlsx(
        ods_code=ods_code,
        records=records,
        output_path=str(output_file),
    )

    assert result == str(output_file)
    assert output_file.exists()

    wb = load_workbook(output_file)
    ws = wb.active

    assert ws.title == "Daily Upload Report"
    assert ws["A1"].value == f"ODS Code: {ods_code}"
    assert ws["A2"].value.startswith("Generated at (UTC): ")
    assert ws["A3"].value is None  # blank row

    assert [cell.value for cell in ws[4]] == [
        "NHS Number",
        "Date",
        "Uploader ODS",
        "PDS ODS",
        "Upload Status",
        "Reason",
        "File Path",
    ]

    # First data row (no ID column)
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
    excel_report_generator,
    tmp_path,
):
    output_file = tmp_path / "empty_report.xlsx"

    excel_report_generator.create_report_orchestration_xlsx(
        ods_code="Y12345",
        records=[],
        output_path=str(output_file),
    )

    wb = load_workbook(output_file)
    ws = wb.active

    assert ws.max_row == 4


def test_create_report_orchestration_xlsx_handles_missing_fields(
    excel_report_generator,
    tmp_path,
):
    output_file = tmp_path / "partial.xlsx"

    records = [
        {
            "ID": 1,
            "NhsNumber": "1234567890",
        }
    ]

    excel_report_generator.create_report_orchestration_xlsx(
        ods_code="Y12345",
        records=records,
        output_path=str(output_file),
    )

    wb = load_workbook(output_file)
    ws = wb.active

    row = [cell.value for cell in ws[5]]

    assert row == [
        "1234567890",
        None,
        None,
        None,
        None,
        None,
        None,
    ]
