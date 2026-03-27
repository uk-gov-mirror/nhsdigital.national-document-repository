from datetime import datetime

from freezegun import freeze_time

from enums.metadata_report import MetadataReport
from enums.upload_status import UploadStatus
from models.report.bulk_upload_report import BulkUploadReport
from models.report.bulk_upload_report_output import OdsReport, ReportBase, SummaryReport
from tests.unit.helpers.data.bulk_upload.dynamo_responses import (
    MOCK_REPORT_ITEMS_UPLOADER_1,
    MOCK_REPORT_ITEMS_UPLOADER_2,
    TEST_UPLOADER_ODS_1,
    TEST_UPLOADER_ODS_2,
)


@freeze_time("2024-01-01 12:00:00")
def get_timestamp():
    return datetime.now().strftime("%Y%m%d")


def test_report_base_get_total_successful_nhs_numbers_returns_nhs_numbers():
    base = ReportBase(generated_at=get_timestamp())
    base.total_successful = {
        ("9000000000", "2012-01-13"),
        ("9000000003", "2012-01-13"),
        ("9000000001", "2012-01-13"),
        ("9000000002", "2012-01-13"),
        ("9000000004", "2012-01-13"),
    }

    expected = ["9000000000", "9000000003", "9000000001", "9000000002", "9000000004"]

    actual = base.get_total_successful_nhs_numbers()

    assert sorted(expected) == sorted(actual)


def test_report_base_get_total_successful_nhs_numbers_returns_empty():
    base = ReportBase(generated_at=get_timestamp())

    expected = []

    actual = base.get_total_successful_nhs_numbers()

    assert expected == actual


def test_report_base_get_total_successful_percentage_returns_correct_percentage_to_two_decimal_places():
    base = ReportBase(generated_at=get_timestamp())
    base.total_ingested = {
        "9000000000",
        "9000000001",
        "9000000002",
        "9000000003",
        "9000000004",
        "9000000005",
        "9000000006",
        "9000000007",
        "9000000008",
        "9000000009",
        "90000000010",
    }
    base.total_successful = {
        ("9000000000", "2012-01-13"),
        ("9000000003", "2012-01-13"),
        ("9000000001", "2012-01-13"),
        ("9000000002", "2012-01-13"),
    }

    expected = "36.36%"
    actual = base.get_total_successful_percentage()
    assert actual == expected


def test_report_base_get_total_successful_percentage_returns_correct_whole_percentage():
    base = ReportBase(generated_at=get_timestamp())
    base.total_ingested = {
        "9000000000",
        "9000000001",
        "9000000002",
        "9000000003",
        "9000000004",
        "9000000005",
        "9000000006",
        "9000000007",
        "9000000008",
        "9000000009",
    }
    base.total_successful = {
        ("9000000000", "2012-01-13"),
    }

    expected = "10%"
    actual = base.get_total_successful_percentage()
    assert actual == expected


def test_report_base_get_total_successful_percentage_given_empty_input_returns_correctly():
    base = ReportBase(generated_at=get_timestamp())
    base.total_ingested = {}
    base.total_successful = {}

    expected = "0%"
    actual = base.get_total_successful_percentage()
    assert actual == expected


def test_report_base_total_successful_percentage_returns_correct_single_percentage():
    base = ReportBase(generated_at=get_timestamp())
    base.total_ingested = {f"{9000000000 + i}" for i in range(100)}
    print(len(base.total_ingested))
    base.total_successful = {("9000000000", "2012-01-13")}
    expected = "1%"
    actual = base.get_total_successful_percentage()
    assert actual == expected


def test_report_base_get_total_in_review_percentage_returns_correct_percentage_to_two_decimal_places():
    base = ReportBase(generated_at=get_timestamp())
    base.total_ingested = {
        "9000000000",
        "9000000001",
        "9000000002",
        "9000000003",
        "9000000004",
        "9000000005",
        "9000000006",
        "9000000007",
        "9000000008",
        "9000000009",
        "90000000010",
    }
    base.total_in_review = {
        "9000000000",
        "9000000003",
        "9000000001",
        "9000000002",
    }

    expected = "36.36%"
    actual = base.get_total_in_review_percentage()
    assert actual == expected


def test_report_base_get_total_in_review_percentage_returns_correct_whole_percentage():
    base = ReportBase(generated_at=get_timestamp())
    base.total_ingested = {
        "9000000000",
        "9000000001",
        "9000000002",
        "9000000003",
        "9000000004",
        "9000000005",
        "9000000006",
        "9000000007",
        "9000000008",
        "9000000009",
    }
    base.total_in_review = {
        "9000000000",
    }

    expected = "10%"
    actual = base.get_total_in_review_percentage()
    assert actual == expected


def test_report_base_get_total_in_review_percentage_given_empty_input_returns_correctly():
    base = ReportBase(generated_at=get_timestamp())
    base.total_ingested = {}
    base.total_in_review = {}

    expected = "0%"
    actual = base.get_total_in_review_percentage()
    assert actual == expected


def test_report_base_total_in_review_percentage_returns_correct_single_percentage():
    base = ReportBase(generated_at=get_timestamp())
    base.total_ingested = {f"{9000000000 + i}" for i in range(100)}
    print(len(base.total_ingested))
    base.total_in_review = {"9000000000"}
    expected = "1%"
    actual = base.get_total_in_review_percentage()
    assert actual == expected


def test_report_base_get_sorted_sorts_successfully():
    to_sort = {
        ("9000000000", "2012-01-13"),
        ("9000000003", "2012-01-13"),
        ("9000000001", "2012-01-13"),
        ("9000000002", "2012-01-13"),
        ("9000000004", "2012-01-13"),
    }

    expected = [
        ("9000000000", "2012-01-13"),
        ("9000000001", "2012-01-13"),
        ("9000000002", "2012-01-13"),
        ("9000000003", "2012-01-13"),
        ("9000000004", "2012-01-13"),
    ]

    actual = OdsReport.get_sorted(to_sort)
    assert actual == expected


def test_report_base_get_sorted_returns_empty():
    to_sort = set()

    expected = []

    actual = OdsReport.get_sorted(to_sort)
    assert actual == expected


def test_ods_report_populate_report_populates_successfully():
    expected = {
        "generated_at": get_timestamp(),
        "total_ingested": {
            "9000000000",
            "9000000001",
            "9000000002",
            "9000000003",
            "9000000004",
            "9000000005",
            "9000000006",
            "9000000007",
        },
        "total_successful": {
            ("9000000000", "2012-01-13", "SUSP"),
            ("9000000001", "2012-01-13", "DECE"),
            ("9000000002", "2012-01-13", "REST"),
            ("9000000003", "2012-01-13", "True"),
            ("9000000004", "2012-01-13", "False"),
        },
        "total_registered_elsewhere": {("9000000004", "2012-01-13")},
        "total_suspended": {("9000000000", "2012-01-13")},
        "total_deceased": {
            ("9000000001", "2012-01-13", "Patient is deceased - INFORMAL", False),
        },
        "total_restricted": {("9000000002", "2012-01-13", False)},
        "total_in_review": set(),
        "report_items": MOCK_REPORT_ITEMS_UPLOADER_1,
        "failures_per_patient": {
            "9000000005": {
                "Date": "2012-01-13",
                "Reason": "Could not find the given patient on PDS",
                "Timestamp": 1688395681,
                "UploaderOdsCode": "Y12345",
                MetadataReport.RegisteredAtUploaderPractice.value: "True",
                "SentToReview": False,
            },
            "9000000006": {
                "Date": "2012-01-13",
                "Reason": "Could not find the given patient on PDS",
                "Timestamp": 1688395681,
                "UploaderOdsCode": "Y12345",
                MetadataReport.RegisteredAtUploaderPractice.value: "True",
                "SentToReview": False,
            },
            "9000000007": {
                "Date": "2012-01-13",
                "Reason": "Lloyd George file already exists",
                "Timestamp": 1688395681,
                "UploaderOdsCode": "Y12345",
                MetadataReport.RegisteredAtUploaderPractice.value: "True",
                "SentToReview": False,
            },
        },
        "unique_failures": {
            "Could not find the given patient on PDS": 2,
            "Lloyd George file already exists": 1,
        },
        "uploader_ods_code": TEST_UPLOADER_ODS_1,
    }

    actual = OdsReport(
        get_timestamp(),
        TEST_UPLOADER_ODS_1,
        MOCK_REPORT_ITEMS_UPLOADER_1,
    ).__dict__

    assert actual == expected


def test_ods_report_process_failed_report_item_handles_failures():
    old_time_stamp = 1698661500
    new_time_stamp = 1698661501
    old_reason = "old reason"
    newest_reason = "new reason"

    test_items = [
        BulkUploadReport(
            nhs_number="9000000009",
            timestamp=old_time_stamp,
            date="2023-10-30",
            upload_status=UploadStatus.FAILED,
            file_path="/9000000009/1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000009]_[25-12-2019].pdf",
            reason=old_reason,
            pds_ods_code=TEST_UPLOADER_ODS_1,
            uploader_ods_code=TEST_UPLOADER_ODS_1,
            sent_to_review=False,
        ),
    ]

    new_failed_item = BulkUploadReport(
        nhs_number="9000000009",
        timestamp=new_time_stamp,
        date="2023-10-30",
        upload_status=UploadStatus.FAILED,
        file_path="/9000000009/1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000009]_[25-12-2019].pdf",
        reason=newest_reason,
        pds_ods_code=TEST_UPLOADER_ODS_1,
        uploader_ods_code=TEST_UPLOADER_ODS_1,
        sent_to_review=False,
    )

    expected = {
        "9000000009": {
            "Date": "2023-10-30",
            "Reason": old_reason,
            "Timestamp": old_time_stamp,
            "UploaderOdsCode": TEST_UPLOADER_ODS_1,
            MetadataReport.RegisteredAtUploaderPractice.value: "True",
            "SentToReview": False,
        },
    }

    report = OdsReport(
        get_timestamp(),
        TEST_UPLOADER_ODS_1,
        test_items,
    )
    report.report_items = test_items

    actual = report.failures_per_patient
    assert actual == expected

    report.process_failed_report_item(new_failed_item)
    expected = {
        "9000000009": {
            "Date": "2023-10-30",
            "Reason": newest_reason,
            "Timestamp": new_time_stamp,
            "UploaderOdsCode": TEST_UPLOADER_ODS_1,
            MetadataReport.RegisteredAtUploaderPractice.value: "True",
            "SentToReview": False,
        },
    }

    actual = report.failures_per_patient
    assert actual == expected


def test_ods_report_get_unsuccessful_reasons_data_rows_returns_correct_rows():
    report = OdsReport(
        get_timestamp(),
        TEST_UPLOADER_ODS_1,
        MOCK_REPORT_ITEMS_UPLOADER_1,
    )

    expected = [
        [MetadataReport.Reason, "Could not find the given patient on PDS", 2],
        [MetadataReport.Reason, "Lloyd George file already exists", 1],
    ]

    actual = report.get_unsuccessful_reasons_data_rows()

    assert actual == expected


def test_ods_report_populate_report_empty_list_populates_successfully():
    expected = {
        "generated_at": get_timestamp(),
        "total_ingested": set(),
        "total_successful": set(),
        "total_registered_elsewhere": set(),
        "total_suspended": set(),
        "total_deceased": set(),
        "total_restricted": set(),
        "total_in_review": set(),
        "report_items": [],
        "failures_per_patient": {},
        "unique_failures": {},
        "uploader_ods_code": TEST_UPLOADER_ODS_1,
    }

    actual = OdsReport(
        get_timestamp(),
        TEST_UPLOADER_ODS_1,
        [],
    ).__dict__

    assert actual == expected


def test_ods_report_populate_report_returns_correct_statistics():
    actual = OdsReport(
        get_timestamp(),
        TEST_UPLOADER_ODS_1,
        MOCK_REPORT_ITEMS_UPLOADER_1,
    )

    assert actual.get_total_successful() == 5
    assert actual.get_total_successful_percentage() == "62.5%"
    assert actual.get_total_deceased_count() == 1
    assert actual.get_total_suspended_count() == 1
    assert actual.get_total_restricted_count() == 1
    assert actual.get_total_registered_elsewhere_count() == 1
    assert actual.get_total_in_review_count() == 0
    assert actual.get_total_in_review_percentage() == "0%"


def test_ods_report_populate_report_empty_list_returns_correct_statistics():
    actual = OdsReport(
        get_timestamp(),
        TEST_UPLOADER_ODS_1,
        [],
    )

    assert actual.get_total_successful() == 0
    assert actual.get_total_successful_percentage() == "0%"
    assert actual.get_total_deceased_count() == 0
    assert actual.get_total_suspended_count() == 0
    assert actual.get_total_restricted_count() == 0
    assert actual.get_total_registered_elsewhere_count() == 0
    assert actual.get_total_in_review_count() == 0
    assert actual.get_total_in_review_percentage() == "0%"


def test_ods_report_populate_report_counts_reviewed_failures_and_excludes_them_from_reason_summary():
    test_items = [
        BulkUploadReport(
            nhs_number="9000000020",
            timestamp=1698661500,
            date="2023-10-30",
            upload_status=UploadStatus.FAILED,
            file_path="/9000000020/1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000020]_[25-12-2019].pdf",
            reason="Could not find the given patient on PDS",
            pds_ods_code=TEST_UPLOADER_ODS_1,
            uploader_ods_code=TEST_UPLOADER_ODS_1,
            sent_to_review=True,
        ),
        BulkUploadReport(
            nhs_number="9000000021",
            timestamp=1698661501,
            date="2023-10-30",
            upload_status=UploadStatus.FAILED,
            file_path="/9000000021/1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000021]_[25-12-2019].pdf",
            reason="Lloyd George file already exists",
            pds_ods_code=TEST_UPLOADER_ODS_1,
            uploader_ods_code=TEST_UPLOADER_ODS_1,
            sent_to_review=False,
        ),
        BulkUploadReport(
            nhs_number="9000000022",
            timestamp=1698661502,
            date="2023-10-30",
            upload_status=UploadStatus.FAILED,
            file_path="/9000000022/1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000022]_[25-12-2019].pdf",
            reason="Invalid NHS number format",
            pds_ods_code=TEST_UPLOADER_ODS_1,
            uploader_ods_code=TEST_UPLOADER_ODS_1,
            sent_to_review=True,
        ),
    ]

    actual = OdsReport(
        get_timestamp(),
        TEST_UPLOADER_ODS_1,
        test_items,
    )

    assert actual.total_in_review == {"9000000020", "9000000022"}
    assert actual.get_total_in_review_count() == 2
    assert actual.get_total_in_review_percentage() == "66.67%"
    assert actual.unique_failures == {"Lloyd George file already exists": 1}
    assert actual.get_unsuccessful_reasons_data_rows() == [
        [MetadataReport.Reason, "Lloyd George file already exists", 1],
    ]


def test_ods_report_populate_report_same_patient_failed_to_review_then_succeeded_removes_from_review_and_reasons():
    test_items = [
        BulkUploadReport(
            nhs_number="9000000030",
            timestamp=1698661500,
            date="2023-10-30",
            upload_status=UploadStatus.FAILED,
            file_path="/9000000030/1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000030]_[25-12-2019].pdf",
            reason="Could not find the given patient on PDS",
            pds_ods_code=TEST_UPLOADER_ODS_1,
            uploader_ods_code=TEST_UPLOADER_ODS_1,
            sent_to_review=True,
        ),
        BulkUploadReport(
            nhs_number="9000000030",
            timestamp=1698661501,
            date="2023-10-30",
            upload_status=UploadStatus.COMPLETE,
            file_path="/9000000030/1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000030]_[25-12-2019].pdf",
            reason="",
            pds_ods_code=TEST_UPLOADER_ODS_1,
            uploader_ods_code=TEST_UPLOADER_ODS_1,
            sent_to_review=False,
        ),
    ]

    actual = OdsReport(
        get_timestamp(),
        TEST_UPLOADER_ODS_1,
        test_items,
    )

    assert actual.failures_per_patient == {}
    assert actual.total_in_review == set()
    assert actual.unique_failures == {}
    assert actual.get_total_in_review_count() == 0
    assert actual.get_total_in_review_percentage() == "0%"


def test_summary_report_populate_report_populates_successfully():
    test_uploader_reports = [
        OdsReport(
            get_timestamp(),
            TEST_UPLOADER_ODS_1,
            MOCK_REPORT_ITEMS_UPLOADER_1,
        ),
        OdsReport(
            get_timestamp(),
            TEST_UPLOADER_ODS_2,
            MOCK_REPORT_ITEMS_UPLOADER_2,
        ),
    ]

    expected = {
        "generated_at": get_timestamp(),
        "total_ingested": {
            "9000000006",
            "9000000009",
            "9000000005",
            "9000000010",
            "9000000013",
            "9000000016",
            "9000000004",
            "9000000007",
            "9000000012",
            "9000000011",
            "9000000002",
            "9000000003",
            "9000000001",
            "9000000000",
            "9000000014",
            "9000000015",
        },
        "total_successful": {
            ("9000000000", "2012-01-13", "SUSP"),
            ("9000000001", "2012-01-13", "DECE"),
            ("9000000002", "2012-01-13", "REST"),
            ("9000000003", "2012-01-13", "True"),
            ("9000000004", "2012-01-13", "False"),
            ("9000000009", "2012-01-13", "SUSP"),
            ("9000000010", "2012-01-13", "DECE"),
            ("9000000011", "2012-01-13", "REST"),
            ("9000000012", "2012-01-13", "False"),
            ("9000000013", "2012-01-13", "True"),
        },
        "total_registered_elsewhere": {
            ("9000000004", "2012-01-13"),
            ("9000000012", "2012-01-13"),
        },
        "total_suspended": {("9000000000", "2012-01-13"), ("9000000009", "2012-01-13")},
        "total_deceased": {
            ("9000000001", "2012-01-13", "Patient is deceased - INFORMAL", False),
            ("9000000010", "2012-01-13", "Patient is deceased - FORMAL", False),
        },
        "total_restricted": {
            ("9000000002", "2012-01-13", False),
            ("9000000011", "2012-01-13", False),
        },
        "total_in_review": set(),
        "ods_reports": test_uploader_reports,
        "success_summary": [
            ["Success by ODS", "Y12345", 5],
            ["Success by ODS", "Z12345", 5],
        ],
        "reason_summary": [
            ["Reason for Y12345", "Could not find the given patient on PDS", 2],
            ["Reason for Y12345", "Lloyd George file already exists", 1],
            ["Reason for Z12345", "Could not find the given patient on PDS", 2],
            ["Reason for Z12345", "Lloyd George file already exists", 1],
        ],
    }

    actual = SummaryReport(
        generated_at=get_timestamp(),
        ods_reports=test_uploader_reports,
    ).__dict__

    assert actual == expected


def test_summary_report_populate_report_empty_reports_objects_populate_successfully():
    test_uploader_reports = [
        OdsReport(
            get_timestamp(),
            TEST_UPLOADER_ODS_1,
            [],
        ),
        OdsReport(
            get_timestamp(),
            TEST_UPLOADER_ODS_2,
            [],
        ),
    ]

    expected = {
        "generated_at": get_timestamp(),
        "total_ingested": set(),
        "total_successful": set(),
        "total_registered_elsewhere": set(),
        "total_suspended": set(),
        "total_deceased": set(),
        "total_restricted": set(),
        "total_in_review": set(),
        "ods_reports": test_uploader_reports,
        "success_summary": [
            ["Success by ODS", "Y12345", 0],
            ["Success by ODS", "Z12345", 0],
        ],
        "reason_summary": [],
    }

    actual = SummaryReport(
        generated_at=get_timestamp(),
        ods_reports=test_uploader_reports,
    ).__dict__

    assert actual == expected


def test_summary_report_populate_report_no_report_objects_populate_successfully():
    expected = {
        "generated_at": get_timestamp(),
        "total_ingested": set(),
        "total_successful": set(),
        "total_registered_elsewhere": set(),
        "total_suspended": set(),
        "total_deceased": set(),
        "total_restricted": set(),
        "total_in_review": set(),
        "ods_reports": [],
        "success_summary": [["Success by ODS", "No ODS codes found", 0]],
        "reason_summary": [],
    }

    actual = SummaryReport(generated_at=get_timestamp(), ods_reports=[]).__dict__

    assert actual == expected


def test_summary_report_populate_report_aggregates_total_in_review_and_only_non_review_reasons():
    uploader_1_report = OdsReport(
        get_timestamp(),
        TEST_UPLOADER_ODS_1,
        [
            BulkUploadReport(
                nhs_number="9000000040",
                timestamp=1698661500,
                date="2023-10-30",
                upload_status=UploadStatus.FAILED,
                file_path="/9000000040/1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000040]_[25-12-2019].pdf",
                reason="Could not find the given patient on PDS",
                pds_ods_code=TEST_UPLOADER_ODS_1,
                uploader_ods_code=TEST_UPLOADER_ODS_1,
                sent_to_review=True,
            ),
            BulkUploadReport(
                nhs_number="9000000041",
                timestamp=1698661501,
                date="2023-10-30",
                upload_status=UploadStatus.FAILED,
                file_path="/9000000041/1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000041]_[25-12-2019].pdf",
                reason="Lloyd George file already exists",
                pds_ods_code=TEST_UPLOADER_ODS_1,
                uploader_ods_code=TEST_UPLOADER_ODS_1,
                sent_to_review=False,
            ),
        ],
    )

    uploader_2_report = OdsReport(
        get_timestamp(),
        TEST_UPLOADER_ODS_2,
        [
            BulkUploadReport(
                nhs_number="9000000050",
                timestamp=1698661502,
                date="2023-10-30",
                upload_status=UploadStatus.FAILED,
                file_path="/9000000050/1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000050]_[25-12-2019].pdf",
                reason="Invalid NHS number format",
                pds_ods_code=TEST_UPLOADER_ODS_2,
                uploader_ods_code=TEST_UPLOADER_ODS_2,
                sent_to_review=True,
            ),
            BulkUploadReport(
                nhs_number="9000000051",
                timestamp=1698661503,
                date="2023-10-30",
                upload_status=UploadStatus.FAILED,
                file_path="/9000000051/1of1_Lloyd_George_Record_[Joe Bloggs]_[9000000051]_[25-12-2019].pdf",
                reason="Fail to parse the patient detail response from PDS API.",
                pds_ods_code=TEST_UPLOADER_ODS_2,
                uploader_ods_code=TEST_UPLOADER_ODS_2,
                sent_to_review=False,
            ),
        ],
    )

    actual = SummaryReport(
        generated_at=get_timestamp(),
        ods_reports=[uploader_1_report, uploader_2_report],
    )

    assert actual.total_in_review == {"9000000040", "9000000050"}
    assert actual.get_total_in_review_count() == 2
    assert actual.get_total_in_review_percentage() == "50%"
    assert actual.reason_summary == [
        ["Reason for Y12345", "Lloyd George file already exists", 1],
        [
            "Reason for Z12345",
            "Fail to parse the patient detail response from PDS API.",
            1,
        ],
    ]
