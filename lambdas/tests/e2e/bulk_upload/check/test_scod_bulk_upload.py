from pathlib import Path

import pytest
from services.base.dynamo_service import DynamoDBService
from syrupy.filters import paths
from tests.e2e.bulk_upload.conftest import (
    get_all_entries_from_table_by_nhs_number,
    get_entry_from_table_by_nhs_number,
    read_metadata_csv,
)
from tests.e2e.helpers.data_helper import LloydGeorgeDataHelper

dynamo_service = DynamoDBService()

lloyd_george_data_helper = LloydGeorgeDataHelper()

datadir = Path(__file__).parent.parent / "data"
accept_test_data = read_metadata_csv(datadir, "scod.csv")

accept_test_cases = []
for record in accept_test_data:
    accept_test_cases.append((record["Test-Description"], record["NHS-NO"]))


@pytest.fixture(scope="session", autouse=True)
def bulk_upload_table_records():
    return {
        "lloyd_george_records": lloyd_george_data_helper.scan_lloyd_george_table(),
        "bulk_upload_report_records": lloyd_george_data_helper.scan_bulk_upload_report_table(),
        "unstitched_records": lloyd_george_data_helper.scan_unstitch_table(),
    }


@pytest.mark.parametrize(
    "description, nhs_number",
    accept_test_cases,
)
def test_scod_ingestions(
    nhs_number,
    description,
    snapshot_json,
    bulk_upload_table_records,
) -> None:
    records_by_num = {
        "_description": description,
        "metadata": get_entry_from_table_by_nhs_number(
            nhs_number, bulk_upload_table_records["lloyd_george_records"]
        ),
        "bulk_upload_report": get_entry_from_table_by_nhs_number(
            nhs_number, bulk_upload_table_records["bulk_upload_report_records"]
        ),
        "unstitched": get_all_entries_from_table_by_nhs_number(
            nhs_number, bulk_upload_table_records["unstitched_records"]
        ),
    }
    assert records_by_num == snapshot_json(
        exclude=paths(
            "metadata.S3FileKey",
            "metadata.ID",
            "metadata.Created",
            "metadata.FileLocation",
            "metadata.LastUpdated",
            "metadata.S3VersionID",
            "metadata.DocumentScanCreation",
            "bulk_upload_report.Date",
            "bulk_upload_report.ID",
            "bulk_upload_report.Timestamp",
        )
    )
    metadata = records_by_num.get("metadata") or {}
    if "Reject" not in description:
        metadata_s3_key = metadata.get("S3FileKey")
        s3_version_id = metadata.get("S3VersionID")

        exists = lloyd_george_data_helper.check_record_exists_in_s3_with_version(
            metadata_s3_key, s3_version_id
        )
        assert exists
