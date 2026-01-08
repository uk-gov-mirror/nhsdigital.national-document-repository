import tempfile
from pathlib import Path

import boto3
import pytest

from tests.e2e.bulk_upload.conftest import empty_table
from tests.e2e.bulk_upload.conftest import read_metadata_csv
from tests.e2e.helpers.data_helper import LloydGeorgeDataHelper

s3_client = boto3.client("s3")
lambda_client = boto3.client("lambda")
datadir = Path(__file__).parent.parent / "data"

lloyd_george_helper = LloydGeorgeDataHelper()


@pytest.fixture(scope="module", autouse=True)
def cleanup_databases():
    empty_table(lloyd_george_helper.bulk_upload_table)
    empty_table(lloyd_george_helper.unstitched_table)
    empty_table(lloyd_george_helper.dynamo_table)


def upload_record(record: str, pdf_path: Path, prefix=None, infected=False):
    s3_key = (prefix + "/" + record) if prefix else record

    if infected:
        virus_scanner_result_value = "Infected"
    else:
        virus_scanner_result_value = "Clean"
    virus_scanner_date_value = "2023-11-23T15:50:33Z"

    with open(pdf_path, "rb") as f:
        lloyd_george_helper.upload_to_staging_directory(s3_key, f.read())
        lloyd_george_helper.add_virus_scan_tag(s3_key, virus_scanner_result_value, virus_scanner_date_value)


def generate_corrupt_file(source_file: Path) -> Path:
    data = bytearray(source_file.read_bytes())

    for offset in range(min(3, len(data))):
        data[offset] ^= 0xFF

    _, tmp_path = tempfile.mkstemp(suffix=source_file.suffix)
    Path(tmp_path).write_bytes(data)

    return Path(tmp_path)


def upload_corrupted_record(record: str, pdf_path: Path, prefix="reject"):
    s3_key = prefix + "/" + record
    path = generate_corrupt_file(pdf_path)

    virus_scanner_result_value = "Clean"
    virus_scanner_date_value = "2023-11-23T15:50:33Z"

    with open(path, "rb") as f:
        lloyd_george_helper.upload_to_staging_directory(s3_key, f.read())
        lloyd_george_helper.add_virus_scan_tag(s3_key, virus_scanner_result_value, virus_scanner_date_value)


def run_bulk_upload(metadata_filename, pre_format_type="general"):
    payload = {"inputFileLocation": metadata_filename, "preFormatType": pre_format_type}
    response = lloyd_george_helper.run_bulk_upload(payload=payload)
    return response


def run_bulk_upload_with_remappings_and_fixes(metada_filename, remappings, fixed_values):
    payload = {"inputFileLocation": metada_filename, "metadataFieldRemappings": remappings, "fixedValues": fixed_values}
    response = lloyd_george_helper.run_bulk_upload(payload=payload)
    return response


def test_run_bulk_upload_accepted():
    rows = read_metadata_csv(datadir, "accept-metadata.csv")
    for row in rows:
        pdf_filepath = datadir / "pdf" / "valid.pdf"
        upload_record(row["FILEPATH"], pdf_filepath, "accept")
    metadata_filepath = datadir / "accept-metadata.csv"
    s3_key = "accept/index.csv"

    with open(metadata_filepath, "rb") as file:
        file_content = file.read()
        lloyd_george_helper.upload_to_staging_directory(s3_key, file_content)
    run_bulk_upload(s3_key)


def test_run_bulk_upload_accepted_usb():
    rows = read_metadata_csv(datadir, "accept-metadata-usb.csv")
    for row in rows:
        pdf_filepath = datadir / "pdf" / "valid.pdf"
        upload_record(row["FILEPATH"], pdf_filepath, "accept-usb")
    metadata_filepath = datadir / "accept-metadata-usb.csv"
    s3_key = "accept-usb/index.csv"

    with open(metadata_filepath, "rb") as file:
        file_content = file.read()
        lloyd_george_helper.upload_to_staging_directory(s3_key, file_content)
    run_bulk_upload(s3_key, "usb")


def test_run_bulk_upload_rejected():
    rows = read_metadata_csv(datadir, "reject-metadata.csv")
    for row in rows:
        pdf_filepath = datadir / "pdf" / "valid.pdf"
        if "Infected" in row["Test-Description"]:
            upload_record(row["FILEPATH"], pdf_filepath, "reject", True)
        elif "Corrupted" in row["Test-Description"]:
            upload_corrupted_record(row["FILEPATH"], pdf_filepath, "reject")
        else:
            upload_record(row["FILEPATH"], pdf_filepath, "reject")
    metadata_filepath = datadir / "reject-metadata.csv"
    s3_key = "reject/index.csv"

    with open(metadata_filepath, "rb") as file:
        file_content = file.read()
        lloyd_george_helper.upload_to_staging_directory(s3_key, file_content)

    run_bulk_upload(s3_key)


def test_run_bulk_upload_rejected_usb():
    rows = read_metadata_csv(datadir, "reject-metadata-usb.csv")
    for row in rows:
        pdf_filepath = datadir / "pdf" / "valid.pdf"
        upload_record(row["FILEPATH"], pdf_filepath, "reject-usb")
    metadata_filepath = datadir / "reject-metadata-usb.csv"
    s3_key = "reject-usb/index.csv"

    with open(metadata_filepath, "rb") as file:
        file_content = file.read()
        lloyd_george_helper.upload_to_staging_directory(s3_key, file_content)
    run_bulk_upload(s3_key, "usb")


def test_run_bulk_upload_remap_and_fixed():
    rows = read_metadata_csv(datadir, "accept-remap-and-fixed.csv")
    for row in rows:
        pdf_filepath = datadir / "pdf" / "valid.pdf"
        upload_record(row["file"], pdf_filepath, "accept-remap-and-fixed")
    metadata_filepath = datadir / "accept-remap-and-fixed.csv"
    s3_key = "accept-remap-and-fixed/metadata.csv"

    with open(metadata_filepath, "rb") as file:
        file_content = file.read()
        lloyd_george_helper.upload_to_staging_directory(s3_key, file_content)

    metdata_field_remappings = {
        "NHS-NO": "nhsnumber",
        "FILEPATH": "file",
    }
    fixed_values = {"GP-PRACTICE-CODE": "M85143", "SCAN-DATE": "01/01/2022"}
    run_bulk_upload_with_remappings_and_fixes(s3_key, metdata_field_remappings, fixed_values)


def test_run_bulk_upload_fixed_reject():
    rows = read_metadata_csv(datadir, "reject-fixed.csv")
    for row in rows:
        pdf_filepath = datadir / "pdf" / "valid.pdf"
        upload_record(row["FILEPATH"], pdf_filepath, "reject-fixed")
    metadata_filepath = datadir / "reject-fixed.csv"
    s3_key = "reject-fixed/index.csv"

    with open(metadata_filepath, "rb") as file:
        file_content = file.read()
        lloyd_george_helper.upload_to_staging_directory(s3_key, file_content)

    metdata_field_remappings = {}

    fixed_values = {"NHS-NO": "123456789", "FILEPATH": "myfile.pdf"}
    run_bulk_upload_with_remappings_and_fixes(s3_key, metdata_field_remappings, fixed_values)


def test_run_bulk_upload_scod():
    rows = read_metadata_csv(datadir, "scod.csv")
    for row in rows:
        pdf_filepath = datadir / "pdf" / "valid.pdf"
        upload_record(row["FILEPATH"], pdf_filepath)
