from pathlib import Path

import boto3
import pytest
from syrupy.filters import paths

from services.base.dynamo_service import DynamoDBService
from tests.e2e.bulk_upload.conftest import read_metadata_csv, get_entry_from_table_by_nhs_number
from tests.e2e.helpers.data_helper import LloydGeorgeDataHelper

dynamo_service = DynamoDBService()

lloyd_george_data_helper = LloydGeorgeDataHelper()

s3 = boto3.client("s3")
datadir = Path(__file__).parent.parent / "data"
general_reject_test_data = read_metadata_csv(datadir, "reject-metadata.csv")
usb_reject_test_data = read_metadata_csv(datadir, "reject-metadata-usb.csv")

general_reject_test_cases = []
for record in general_reject_test_data:
    general_reject_test_cases.append((record["Test-Description"], record["NHS-NO"]))

usb_reject_test_cases = []
for record in usb_reject_test_data:
    usb_reject_test_cases.append((record["Test-Description"], record["NHS-NO"]))


@pytest.fixture(scope="session", autouse=True)
def bulk_upload_table_records():
    return {
        "lloyd_george_records": lloyd_george_data_helper.scan_lloyd_george_table(),
        "bulk_upload_report_records": lloyd_george_data_helper.scan_bulk_upload_report_table(),
        "unstitched_records": lloyd_george_data_helper.scan_unstitch_table(),
    }


@pytest.mark.parametrize(
    "description, nhs_number",
    general_reject_test_cases,
)
def test_general_reject_ingestions(
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
        "unstitched": get_entry_from_table_by_nhs_number(nhs_number, bulk_upload_table_records["unstitched_records"]),
    }
    assert records_by_num == snapshot_json(
        exclude=paths(
            "metadata.LastUpdated",
            "bulk_upload_report.Date",
            "bulk_upload_report.ID",
            "bulk_upload_report.Timestamp",
        )
    )


@pytest.mark.parametrize(
    "description, nhs_number",
    usb_reject_test_cases,
)
def test_usb_reject_ingestions(
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
        "unstitched": get_entry_from_table_by_nhs_number(nhs_number, bulk_upload_table_records["unstitched_records"]),
    }
    assert records_by_num == snapshot_json(
        exclude=paths(
            "metadata.LastUpdated",
            "bulk_upload_report.Date",
            "bulk_upload_report.ID",
            "bulk_upload_report.Timestamp",
        )
    )


@pytest.mark.parametrize("nhs_number,description", [("123456789", "Prevent Fixed on File and NhsNumber")])
def test_remap_and_fixed_reject(
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
    }
    assert records_by_num == snapshot_json(
        exclude=paths(
            "metadata.S3FileKey",
            "metadata.ID",
            "metadata.Created",
            "metadata.FileLocation",
            "metadata.LastUpdated",
            "bulk_upload_report.Date",
            "bulk_upload_report.ID",
            "bulk_upload_report.Timestamp",
        )
    )
