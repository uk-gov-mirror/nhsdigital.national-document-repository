from pathlib import Path

import pytest
from syrupy.filters import paths

from services.base.dynamo_service import DynamoDBService
from tests.e2e.bulk_upload.conftest import (
    get_all_entries_from_table_by_nhs_number,
    read_metadata_csv,
    get_entry_from_table_by_nhs_number,
)
from tests.e2e.helpers.data_helper import LloydGeorgeDataHelper

dynamo_service = DynamoDBService()

lloyd_george_data_helper = LloydGeorgeDataHelper()

datadir = Path(__file__).parent.parent / "data"
general_accept_test_data = read_metadata_csv(datadir, "accept-metadata.csv")
usb_accept_test_data = read_metadata_csv(datadir, "accept-metadata-usb.csv")

general_accept_test_cases = []
for record in general_accept_test_data:
    general_accept_test_cases.append((record["Test-Description"], record["NHS-NO"]))

usb_accept_test_cases = []
for record in usb_accept_test_data:
    usb_accept_test_cases.append((record["Test-Description"], record["NHS-NO"]))


@pytest.fixture(scope="session", autouse=True)
def bulk_upload_table_records():
    return {
        "lloyd_george_records": lloyd_george_data_helper.scan_lloyd_george_table(),
        "bulk_upload_report_records": lloyd_george_data_helper.scan_bulk_upload_report_table(),
        "unstitched_records": lloyd_george_data_helper.scan_unstitch_table(),
    }


@pytest.mark.parametrize(
    "description, nhs_number",
    general_accept_test_cases,
)
def test_general_accepted_ingestions(
        nhs_number,
        description,
        snapshot_json,
        bulk_upload_table_records,
) -> None:
    records_by_num = {
        "_description": description,
        "metadata": get_entry_from_table_by_nhs_number(nhs_number, bulk_upload_table_records["lloyd_george_records"]),
        "bulk_upload_report": get_entry_from_table_by_nhs_number(
            nhs_number, bulk_upload_table_records["bulk_upload_report_records"]
        ),
        "unstitched": get_all_entries_from_table_by_nhs_number(nhs_number,
                                                               bulk_upload_table_records["unstitched_records"]),
    }

    def generate_unstitched_exclusions(num):
        return [
            f"unstitched.{i}.{key}"
            for i in range(num)
            for key in ["Created", "FileLocation", "ID", "S3VersionID", "S3FileKey", "LastUpdated", "FileName"]
        ]

    assert records_by_num == snapshot_json(
        exclude=paths(
            "metadata.S3FileKey",
            "metadata.ID",
            "metadata.Created",
            "metadata.FileLocation",
            "metadata.LastUpdated",
            "metadata.S3VersionID",
            "bulk_upload_report.Date",
            "bulk_upload_report.ID",
            "bulk_upload_report.Timestamp",
            "bulk_upload_report.FilePath",
            "bulk_upload_report.StoredFileName",
            "bulk_upload_report.Created",
            *generate_unstitched_exclusions(3),
        )
    )
    metadata = records_by_num.get("metadata") or {}
    metadata_s3_key = str(metadata.get("S3FileKey"))
    metadata_s3_version = str(metadata.get("S3VersionID"))
    assert lloyd_george_data_helper.check_record_exists_in_s3_with_version(metadata_s3_key, metadata_s3_version)


@pytest.mark.parametrize(
    "description, nhs_number",
    usb_accept_test_cases,
)
def test_usb_accepted_ingestions(
        nhs_number,
        description,
        snapshot_json,
        bulk_upload_table_records,
) -> None:
    records_by_num = {
        "_description": description,
        "metadata": get_entry_from_table_by_nhs_number(nhs_number, bulk_upload_table_records["lloyd_george_records"]),
        "bulk_upload_report": get_entry_from_table_by_nhs_number(
            nhs_number, bulk_upload_table_records["bulk_upload_report_records"]
        ),
        "unstitched": get_all_entries_from_table_by_nhs_number(nhs_number,
                                                               bulk_upload_table_records["unstitched_records"]),
    }
    assert records_by_num == snapshot_json(
        exclude=paths(
            "metadata.S3FileKey",
            "metadata.ID",
            "metadata.Created",
            "metadata.FileLocation",
            "metadata.S3VersionID",
            "metadata.LastUpdated",
            "bulk_upload_report.Date",
            "bulk_upload_report.ID",
            "bulk_upload_report.Timestamp",
        )
    )
    metadata = records_by_num.get("metadata") or {}
    metadata_s3_key = str(metadata.get("S3FileKey"))
    metadata_s3_version = str(metadata.get("S3VersionID"))
    assert lloyd_george_data_helper.check_record_exists_in_s3_with_version(metadata_s3_key, metadata_s3_version)


@pytest.mark.parametrize("nhs_number,description", [("9730787492", "Remap and Fixed")])
def test_remap_and_fixed(
        nhs_number,
        description,
        snapshot_json,
        bulk_upload_table_records,
) -> None:
    records_by_num = {
        "_description": description,
        "metadata": get_entry_from_table_by_nhs_number(nhs_number, bulk_upload_table_records["lloyd_george_records"]),
        "bulk_upload_report": get_entry_from_table_by_nhs_number(
            nhs_number, bulk_upload_table_records["bulk_upload_report_records"]
        ),
        "unstitched": get_all_entries_from_table_by_nhs_number(nhs_number,
                                                               bulk_upload_table_records["unstitched_records"]),
    }
    assert records_by_num == snapshot_json(
        exclude=paths(
            "metadata.S3FileKey",
            "metadata.S3VersionID",
            "metadata.ID",
            "metadata.Created",
            "metadata.FileLocation",
            "metadata.LastUpdated",
            "bulk_upload_report.Date",
            "bulk_upload_report.ID",
            "bulk_upload_report.Timestamp",
        )
    )
    metadata = records_by_num.get("metadata") or {}
    metadata_s3_key = str(metadata.get("S3FileKey"))
    metadata_s3_version = str(metadata.get("S3VersionID"))
    assert lloyd_george_data_helper.check_record_exists_in_s3_with_version(metadata_s3_key, metadata_s3_version)
