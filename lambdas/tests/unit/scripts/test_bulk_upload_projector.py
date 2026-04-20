import csv
from pathlib import Path

import pytest

from scripts.bulk_upload_projector import BulkUploadProjector
from utils.exceptions import InvalidFileNameException

VALID_NHS = "9000000009"
VALID_ODS = "Y12345"
VALID_FILENAME = "1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000009]_[25-12-2019].pdf"
VALID_FILEPATH = f"9000000009/{VALID_FILENAME}"
INVALID_FILENAME = "not_a_valid_lloyd_george_file.pdf"

BASE_ROW = {
    "NHS-NO": VALID_NHS,
    "FILEPATH": VALID_FILEPATH,
    "GP-PRACTICE-CODE": VALID_ODS,
    "SCAN-DATE": "2019-12-25",
}


@pytest.fixture
def mock_formatter(mocker):
    return mocker.Mock()


@pytest.fixture
def projector(mocker, mock_formatter):
    mocker.patch(
        "scripts.bulk_upload_projector.MetadataGeneralPreprocessor",
        return_value=mock_formatter,
    )
    return BulkUploadProjector()


def make_csv(tmp_path, rows, filename="metadata.csv"):
    csv_path = tmp_path / filename
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return str(csv_path)


# --- Instantiation ---


def test_projector_instantiates(projector):
    assert isinstance(projector, BulkUploadProjector)


def test_projector_uses_custom_formatter(mock_formatter):
    p = BulkUploadProjector(metadata_formatter_service=mock_formatter)
    assert p.metadata_formatter_service is mock_formatter


# --- csv_to_sqs_metadata ---


def test_valid_row_produces_staging_metadata(projector, tmp_path):
    csv_path = make_csv(tmp_path, [BASE_ROW])
    result, failed, row_results = projector.csv_to_sqs_metadata(csv_path)

    assert len(result) == 1
    assert result[0].nhs_number == VALID_NHS
    assert len(result[0].files) == 1
    assert len(failed) == 0
    assert all(r["status"] == "to_be_ingested" for r in row_results)


def test_multiple_files_for_same_patient_are_grouped(projector, tmp_path):
    rows = [
        {
            **BASE_ROW,
            "FILEPATH": "9000000009/1of2_Lloyd_George_Record_[Joe Bloggs]_[9000000009]_[25-12-2019].pdf",
        },
        {
            **BASE_ROW,
            "FILEPATH": "9000000009/2of2_Lloyd_George_Record_[Joe Bloggs]_[9000000009]_[25-12-2019].pdf",
        },
    ]
    csv_path = make_csv(tmp_path, rows)
    result, failed, _ = projector.csv_to_sqs_metadata(csv_path)

    assert len(result) == 1
    assert len(result[0].files) == 2


def test_different_patients_produce_separate_entries(projector, tmp_path):
    rows = [
        BASE_ROW,
        {
            "NHS-NO": "9000000025",
            "FILEPATH": "9000000025/1of1_Lloyd_George_Record_[Jane Doe]_[9000000025]_[01-01-2020].pdf",
            "GP-PRACTICE-CODE": VALID_ODS,
            "SCAN-DATE": "2020-01-01",
        },
    ]
    csv_path = make_csv(tmp_path, rows)
    result, _, _ = projector.csv_to_sqs_metadata(csv_path)

    assert len(result) == 2


def test_invalid_filename_goes_to_review_not_ingested(projector, tmp_path):
    projector.metadata_formatter_service.validate_record_filename.side_effect = (
        InvalidFileNameException("bad name")
    )
    rows = [{**BASE_ROW, "FILEPATH": INVALID_FILENAME}]
    csv_path = make_csv(tmp_path, rows)
    result, failed, _ = projector.csv_to_sqs_metadata(csv_path)

    assert len(result) == 0
    assert len(failed) == 1


def test_hard_rejected_rows_counted(projector, tmp_path):
    rows = [
        BASE_ROW,
        {"NHS-NO": "", "FILEPATH": "", "GP-PRACTICE-CODE": "", "SCAN-DATE": ""},
    ]
    csv_path = make_csv(tmp_path, rows)
    _, _, row_results = projector.csv_to_sqs_metadata(csv_path)

    assert sum(1 for r in row_results if r["status"] == "hard_rejected") == 1


def test_empty_csv_raises(projector, tmp_path):
    csv_path = tmp_path / "empty.csv"
    csv_path.write_text("")
    with pytest.raises(ValueError, match="empty or missing headers"):
        projector.csv_to_sqs_metadata(str(csv_path))


# --- _validate_and_correct_filename ---


def test_already_valid_filename_returned_as_is(projector):
    from models.staging_metadata import MetadataFile

    file_metadata = MetadataFile(
        file_path=VALID_FILENAME,
        nhs_number=VALID_NHS,
        gp_practice_code=VALID_ODS,
        scan_date="2019-12-25",
    )
    result = projector._validate_and_correct_filename(file_metadata)
    assert result == VALID_FILENAME
    projector.metadata_formatter_service.validate_record_filename.assert_not_called()


def test_correctable_filename_uses_formatter(projector):
    from models.staging_metadata import MetadataFile

    projector.metadata_formatter_service.validate_record_filename.return_value = (
        VALID_FILENAME
    )
    file_metadata = MetadataFile(
        file_path=INVALID_FILENAME,
        nhs_number=VALID_NHS,
        gp_practice_code=VALID_ODS,
        scan_date="2019-12-25",
    )
    result = projector._validate_and_correct_filename(file_metadata)
    assert result == VALID_FILENAME


def test_uncorrectable_filename_raises(projector):
    from models.staging_metadata import MetadataFile

    projector.metadata_formatter_service.validate_record_filename.side_effect = (
        InvalidFileNameException("bad")
    )
    file_metadata = MetadataFile(
        file_path=INVALID_FILENAME,
        nhs_number=VALID_NHS,
        gp_practice_code=VALID_ODS,
        scan_date="2019-12-25",
    )
    with pytest.raises(InvalidFileNameException):
        projector._validate_and_correct_filename(file_metadata)


# --- _apply_fixed_values ---


def test_fixed_values_overwrite_fields(projector):
    from models.staging_metadata import MetadataFile

    projector.fixed_values = {"GP-PRACTICE-CODE": "Z99999"}
    file_metadata = MetadataFile(
        file_path=VALID_FILEPATH,
        nhs_number=VALID_NHS,
        gp_practice_code=VALID_ODS,
        scan_date="2019-12-25",
    )
    result = projector._apply_fixed_values(file_metadata)
    assert result.gp_practice_code == "Z99999"


# --- run ---


def test_run_returns_staging_metadata_list(projector, tmp_path):
    csv_path = make_csv(tmp_path, [BASE_ROW])
    result = projector.run(str(csv_path), expected_count=1)

    assert len(result) == 1
    assert result[0].nhs_number == VALID_NHS


def test_run_with_mix_of_valid_and_invalid(projector, tmp_path):
    projector.metadata_formatter_service.validate_record_filename.side_effect = (
        InvalidFileNameException("bad")
    )
    rows = [
        BASE_ROW,
        {**BASE_ROW, "NHS-NO": "9000000025", "FILEPATH": INVALID_FILENAME},
    ]
    csv_path = make_csv(tmp_path, rows)
    result = projector.run(str(csv_path), expected_count=2)

    assert len(result) == 1
    assert result[0].nhs_number == VALID_NHS


def find_output_file(tmp_path: Path, suffix: str) -> Path:
    matches = list(tmp_path.glob(f"*{suffix}"))
    assert len(matches) == 1, f"Expected one {suffix} file, found: {matches}"
    return matches[0]


def test_run_writes_rows_file(projector, tmp_path):
    csv_path = make_csv(tmp_path, [BASE_ROW])
    projector.run(str(csv_path), expected_count=1)

    rows_file = find_output_file(tmp_path, "_projection_rows_*.csv")
    with open(rows_file) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert len(rows) == 1
    assert rows[0]["nhs_number"] == VALID_NHS
    assert rows[0]["status"] == "to_be_ingested"


def test_run_writes_summary_file(projector, tmp_path):
    csv_path = make_csv(tmp_path, [BASE_ROW])
    projector.run(str(csv_path), expected_count=1)

    summary_file = find_output_file(tmp_path, "_projection_summary_*.txt")
    content = summary_file.read_text()
    assert "METADATA PROJECTION SUMMARY" in content
    assert "Patients to be ingested" in content


def test_rows_file_captures_review_status(projector, tmp_path):
    projector.metadata_formatter_service.validate_record_filename.side_effect = (
        InvalidFileNameException("bad name")
    )
    rows = [{**BASE_ROW, "FILEPATH": INVALID_FILENAME}]
    csv_path = make_csv(tmp_path, rows)
    projector.run(str(csv_path), expected_count=1)

    rows_file = find_output_file(tmp_path, "_projection_rows_*.csv")
    with open(rows_file) as f:
        reader = csv.DictReader(f)
        result_rows = list(reader)
    assert result_rows[0]["status"] == "sent_for_review"
    assert result_rows[0]["reason"] == "bad name"


def test_rows_file_captures_hard_rejected(projector, tmp_path):
    rows = [
        BASE_ROW,
        {"NHS-NO": "", "FILEPATH": "", "GP-PRACTICE-CODE": "", "SCAN-DATE": ""},
    ]
    csv_path = make_csv(tmp_path, rows)
    projector.run(str(csv_path), expected_count=2)

    rows_file = find_output_file(tmp_path, "_projection_rows_*.csv")
    with open(rows_file) as f:
        reader = csv.DictReader(f)
        result_rows = list(reader)
    statuses = [r["status"] for r in result_rows]
    assert "hard_rejected" in statuses
    assert "to_be_ingested" in statuses


# --- _count_patients_per_ods ---


def test_count_patients_per_ods_ingested(projector):
    row_results = [
        {"nhs_number": "9000000009", "gp_practice_code": "Y12345", "status": "to_be_ingested"},
        {"nhs_number": "9000000025", "gp_practice_code": "Y12345", "status": "to_be_ingested"},
        {"nhs_number": "9000000033", "gp_practice_code": "Z99999", "status": "to_be_ingested"},
    ]
    ingested, review = projector._count_patients_per_ods(row_results)
    assert ingested["Y12345"] == 2
    assert ingested["Z99999"] == 1
    assert len(review) == 0


def test_count_patients_per_ods_review(projector):
    row_results = [
        {"nhs_number": "9000000009", "gp_practice_code": "Y12345", "status": "sent_for_review"},
        {"nhs_number": "9000000025", "gp_practice_code": "Z99999", "status": "sent_for_review"},
    ]
    ingested, review = projector._count_patients_per_ods(row_results)
    assert len(ingested) == 0
    assert review["Y12345"] == 1
    assert review["Z99999"] == 1


def test_count_patients_per_ods_deduplicates_same_patient(projector):
    row_results = [
        {"nhs_number": "9000000009", "gp_practice_code": "Y12345", "status": "to_be_ingested"},
        {"nhs_number": "9000000009", "gp_practice_code": "Y12345", "status": "to_be_ingested"},
    ]
    ingested, _ = projector._count_patients_per_ods(row_results)
    assert ingested["Y12345"] == 1


def test_count_patients_per_ods_skips_hard_rejected(projector):
    row_results = [
        {"nhs_number": "", "gp_practice_code": "", "status": "hard_rejected"},
    ]
    ingested, review = projector._count_patients_per_ods(row_results)
    assert len(ingested) == 0
    assert len(review) == 0


# --- per-ODS in summary output ---


def test_summary_file_includes_ods_breakdown(projector, tmp_path):
    second_ods = "Z99999"
    rows = [
        BASE_ROW,
        {
            "NHS-NO": "9000000025",
            "FILEPATH": "9000000025/1of1_Lloyd_George_Record_[Jane Doe]_[9000000025]_[01-01-2020].pdf",
            "GP-PRACTICE-CODE": second_ods,
            "SCAN-DATE": "2020-01-01",
        },
    ]
    csv_path = make_csv(tmp_path, rows)
    projector.run(str(csv_path), expected_count=2)

    summary_file = find_output_file(tmp_path, "_projection_summary_*.txt")
    content = summary_file.read_text()
    assert "Per ODS code:" in content
    assert VALID_ODS in content
    assert second_ods in content


def test_summary_file_ods_counts_correct(projector, tmp_path):
    rows = [BASE_ROW, {**BASE_ROW, "NHS-NO": "9000000025",
                       "FILEPATH": "9000000025/1of1_Lloyd_George_Record_[Jane Doe]_[9000000025]_[01-01-2020].pdf"}]
    csv_path = make_csv(tmp_path, rows)
    projector.run(str(csv_path), expected_count=2)

    summary_file = find_output_file(tmp_path, "_projection_summary_*.txt")
    content = summary_file.read_text()
    assert f"{VALID_ODS}: 2 to be ingested" in content


# --- pre-processed file count ---


def test_summary_shows_preprocessed_count(projector, tmp_path):
    projector.metadata_formatter_service.validate_record_filename.return_value = (
        VALID_FILENAME
    )
    rows = [
        BASE_ROW,
        {**BASE_ROW, "NHS-NO": "9000000025", "FILEPATH": "not_a_valid_lloyd_george_file.pdf"},
    ]
    csv_path = make_csv(tmp_path, rows)
    projector.run(str(csv_path), expected_count=2)

    summary_file = find_output_file(tmp_path, "_projection_summary_*.txt")
    content = summary_file.read_text()
    assert "Files pre-processed     : 1" in content


def test_no_preprocessed_files_shows_zero(projector, tmp_path):
    csv_path = make_csv(tmp_path, [BASE_ROW])
    projector.run(str(csv_path), expected_count=1)

    summary_file = find_output_file(tmp_path, "_projection_summary_*.txt")
    content = summary_file.read_text()
    assert "Files pre-processed     : 0" in content


# --- expected count check ---


def test_count_check_passes_when_correct(projector, tmp_path):
    csv_path = make_csv(tmp_path, [BASE_ROW])
    projector.run(str(csv_path), expected_count=1)

    summary_file = find_output_file(tmp_path, "_projection_summary_*.txt")
    content = summary_file.read_text()
    assert "Expected count check    : PASSED (1)" in content


def test_count_check_mismatch_shown_in_summary(projector, tmp_path):
    csv_path = make_csv(tmp_path, [BASE_ROW])
    projector.run(str(csv_path), expected_count=99)

    summary_file = find_output_file(tmp_path, "_projection_summary_*.txt")
    content = summary_file.read_text()
    assert "*** COUNT MISMATCH: expected 99, got 1 ***" in content


def test_count_check_includes_review_and_hard_rejected(projector, tmp_path):
    projector.metadata_formatter_service.validate_record_filename.side_effect = (
        InvalidFileNameException("bad name")
    )
    rows = [
        BASE_ROW,
        {**BASE_ROW, "NHS-NO": "9000000025", "FILEPATH": INVALID_FILENAME},
        {"NHS-NO": "", "FILEPATH": "", "GP-PRACTICE-CODE": "", "SCAN-DATE": ""},
    ]
    csv_path = make_csv(tmp_path, rows)
    # 1 ingested + 1 review + 1 hard rejected = 3
    projector.run(str(csv_path), expected_count=3)

    summary_file = find_output_file(tmp_path, "_projection_summary_*.txt")
    content = summary_file.read_text()
    assert "Expected count check    : PASSED (3)" in content
