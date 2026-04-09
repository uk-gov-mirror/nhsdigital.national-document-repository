from pathlib import Path

import boto3
import pytest
from syrupy.filters import paths

from services.base.dynamo_service import DynamoDBService
from tests.e2e.bulk_upload.conftest import (
    get_entry_from_table_by_custodian,
    get_entry_from_table_by_nhs_number,
    read_metadata_csv,
)
from tests.e2e.helpers.data_helper import LloydGeorgeDataHelper

dynamo_service = DynamoDBService()

lloyd_george_data_helper = LloydGeorgeDataHelper()

s3 = boto3.client("s3")

datadir = Path(__file__).parent.parent / "data"
general_reject_test_data = read_metadata_csv(datadir, "reject-metadata.csv")
general_reject_test_data_no_nhs = read_metadata_csv(
    datadir,
    "reject-metadata-no-nhs-no.csv",
)
general_reject_test_data_no_review = read_metadata_csv(
    datadir,
    "reject-metadata-no-record.csv",
)
usb_reject_test_data = read_metadata_csv(datadir, "reject-metadata-usb.csv")

general_reject_test_cases = []
general_reject_test_cases_no_review = []
general_reject_test_cases_no_nhs = []

for record in general_reject_test_data:
    general_reject_test_cases.append((record["Test-Description"], record["NHS-NO"]))

for record in general_reject_test_data_no_nhs:
    general_reject_test_cases_no_nhs.append(
        (record["Test-Description"], record["NHS-NO"], record["GP-PRACTICE-CODE"]),
    )

for record in general_reject_test_data_no_review:
    general_reject_test_cases_no_review.append(
        (record["Test-Description"], record["NHS-NO"]),
    )

usb_reject_test_cases = []
for record in usb_reject_test_data:
    usb_reject_test_cases.append(
        (record["Test-Description"], record["NHS-NO"], record["GP-PRACTICE-CODE"]),
    )


def validate_review(records):
    assert "review" in records and records["review"], "Review is missing"

    files = records["review"].get("Files") or []
    assert files, "Review has no files"

    for file in files:
        file_location = file.get("FileLocation")
        assert file_location, "File entry missing FileLocation"
        assert lloyd_george_data_helper.check_review_record_exists_in_s3_with_version(
            file_location,
        ), f"Review record not found in S3 for file location: {file_location}"


@pytest.fixture(scope="session", autouse=True)
def bulk_upload_table_records():
    return {
        "lloyd_george_records": lloyd_george_data_helper.scan_lloyd_george_table(),
        "bulk_upload_report_records": lloyd_george_data_helper.scan_bulk_upload_report_table(),
        "review_records": lloyd_george_data_helper.scan_review_table(),
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
        "metadata": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["lloyd_george_records"],
        ),
        "bulk_upload_report": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["bulk_upload_report_records"],
        ),
        "review": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["review_records"],
        ),
    }
    exclude_paths = [
        "metadata.LastUpdated",
        "bulk_upload_report.Date",
        "bulk_upload_report.ID",
        "bulk_upload_report.Timestamp",
        "review.ID",
        "review.UploadDate",
        "review.Files.0.FileLocation",
        "review.Files.1.FileLocation",
    ]

    if "BULK-4" in description:
        exclude_paths.append("bulk_upload_report.FilePath")
    assert records_by_num == snapshot_json(exclude=paths(*exclude_paths))
    validate_review(records_by_num)


@pytest.mark.parametrize(
    "description, nhs_number",
    general_reject_test_cases_no_review,
)
def test_general_reject_ingestions_no_review(
    nhs_number,
    description,
    snapshot_json,
    bulk_upload_table_records,
) -> None:
    records_by_num = {
        "_description": description,
        "metadata": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["lloyd_george_records"],
        ),
        "bulk_upload_report": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["bulk_upload_report_records"],
        ),
        "review": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["review_records"],
        ),
    }
    assert records_by_num == snapshot_json(
        exclude=paths(
            "metadata.LastUpdated",
            "bulk_upload_report.Date",
            "bulk_upload_report.ID",
            "bulk_upload_report.Timestamp",
        ),
    )


@pytest.mark.parametrize(
    "description, nhs_number, ods_code",
    general_reject_test_cases_no_nhs,
)
def test_general_reject_ingestions_not_in_pds(
    nhs_number,
    ods_code,
    description,
    snapshot_json,
    bulk_upload_table_records,
) -> None:
    records_by_ods = {
        "_description": description,
        "metadata": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["lloyd_george_records"],
        ),
        "bulk_upload_report": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["bulk_upload_report_records"],
        ),
        "review": get_entry_from_table_by_custodian(
            ods_code,
            bulk_upload_table_records["review_records"],
        ),
    }
    assert records_by_ods == snapshot_json(
        exclude=paths(
            "metadata.LastUpdated",
            "bulk_upload_report.Date",
            "bulk_upload_report.ID",
            "bulk_upload_report.Timestamp",
            "review.ID",
            "review.UploadDate",
            "review.Files.0.FileLocation",
            "review.Files.1.FileLocation",
        ),
    )
    validate_review(records_by_ods)


@pytest.mark.parametrize(
    "description, nhs_number, custodian",
    usb_reject_test_cases,
)
def test_usb_reject_ingestions(
    nhs_number,
    custodian,
    description,
    snapshot_json,
    bulk_upload_table_records,
) -> None:
    records_by_num = {
        "_description": description,
        "metadata": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["lloyd_george_records"],
        ),
        "bulk_upload_report": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["bulk_upload_report_records"],
        ),
        "review": get_entry_from_table_by_custodian(
            custodian,
            bulk_upload_table_records["review_records"],
        ),
    }
    assert records_by_num == snapshot_json(
        exclude=paths(
            "metadata.LastUpdated",
            "bulk_upload_report.Date",
            "bulk_upload_report.ID",
            "bulk_upload_report.Timestamp",
            "review.ID",
            "review.UploadDate",
            "review.Files.0.FileLocation",
            "review.Files.1.FileLocation",
        ),
    )
    for file in records_by_num["review"]["Files"]:
        assert lloyd_george_data_helper.check_review_record_exists_in_s3_with_version(
            file["FileLocation"],
        )


@pytest.mark.parametrize(
    "nhs_number,description",
    [("123456789", "Prevent Fixed on File and NhsNumber")],
)
def test_remap_and_fixed_reject(
    nhs_number,
    description,
    snapshot_json,
    bulk_upload_table_records,
) -> None:
    records_by_num = {
        "_description": description,
        "metadata": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["lloyd_george_records"],
        ),
        "bulk_upload_report": get_entry_from_table_by_nhs_number(
            nhs_number,
            bulk_upload_table_records["bulk_upload_report_records"],
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
        ),
    )
