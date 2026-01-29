import time

import pytest
from enums.death_notification_status import DeathNotificationStatus
from enums.document_review_status import DocumentReviewStatus
from enums.patient_ods_inactive_status import PatientOdsInactiveStatus
from tests.e2e.mns.mns_helper import TEST_ORIGINAL_ODS, MNSTestHelper

TEST_NHS_FORMAL = "9730135967"
TEST_NHS_INFORMAL = "9730154813"
TEST_NHS_BOTH = "9730153949"


@pytest.fixture(scope="session")
def setup_all_death_tests():
    helper = MNSTestHelper()

    formal_lg_record = helper.create_lloyd_george_record(
        nhs_number=TEST_NHS_FORMAL, ods_code=TEST_ORIGINAL_ODS
    )

    informal_lg_record = helper.create_lloyd_george_record(
        nhs_number=TEST_NHS_INFORMAL, ods_code=TEST_ORIGINAL_ODS
    )

    both_lg_record = helper.create_lloyd_george_record(
        nhs_number=TEST_NHS_BOTH, ods_code=TEST_ORIGINAL_ODS
    )

    both_review_record = helper.create_document_review_record(
        nhs_number=TEST_NHS_BOTH, ods_code=TEST_ORIGINAL_ODS
    )

    initial_formal_lg = helper.get_lloyd_george_record(formal_lg_record["id"])
    initial_informal_lg = helper.get_lloyd_george_record(informal_lg_record["id"])
    initial_both_lg = helper.get_lloyd_george_record(both_lg_record["id"])
    initial_both_review = helper.get_document_review_record(
        both_review_record["id"], version=1
    )

    helper.send_death_notification_message(
        nhs_number=TEST_NHS_FORMAL, death_status=DeathNotificationStatus.FORMAL
    )
    helper.send_death_notification_message(
        nhs_number=TEST_NHS_INFORMAL, death_status=DeathNotificationStatus.INFORMAL
    )
    helper.send_death_notification_message(
        nhs_number=TEST_NHS_BOTH, death_status=DeathNotificationStatus.FORMAL
    )

    print("\nWaiting 50 seconds for all death notification messages to be processed...")
    time.sleep(50)
    print("Wait complete, starting death tests...")

    setup_data = {
        "formal": {
            "record_id": formal_lg_record["id"],
            "initial_record": initial_formal_lg,
        },
        "informal": {
            "record_id": informal_lg_record["id"],
            "initial_record": initial_informal_lg,
        },
        "both_tables": {
            "lg_record_id": both_lg_record["id"],
            "review_record_id": both_review_record["id"],
            "initial_lg": initial_both_lg,
            "initial_review": initial_both_review,
        },
    }

    yield setup_data

    helper.cleanup_lloyd_george_record(formal_lg_record["id"])
    helper.cleanup_lloyd_george_record(informal_lg_record["id"])
    helper.cleanup_lloyd_george_record(both_lg_record["id"])
    helper.cleanup_document_review_record(both_review_record["id"])


@pytest.fixture
def mns_helper():
    return MNSTestHelper()


@pytest.fixture
def setup_formal_death_test(setup_all_death_tests):
    return setup_all_death_tests["formal"]


@pytest.fixture
def setup_informal_death_test(setup_all_death_tests):
    return setup_all_death_tests["informal"]


@pytest.fixture
def setup_death_both_tables_test(setup_all_death_tests):
    return setup_all_death_tests["both_tables"]


class TestMNSDeathNotification:
    def test_formal_death_notification_marks_patient_deceased(
        self, mns_helper, setup_formal_death_test
    ):
        record_id = setup_formal_death_test["record_id"]
        initial_record = setup_formal_death_test["initial_record"]

        assert initial_record["CurrentGpOds"] == TEST_ORIGINAL_ODS

        def check_update():
            return (
                mns_helper.get_lloyd_george_record(record_id)["CurrentGpOds"]
                == PatientOdsInactiveStatus.DECEASED.value
            )

        update_successful = mns_helper.wait_for_update(check_update)
        assert update_successful, "Lloyd George record was not marked as deceased"

    def test_formal_death_updates_both_tables(
        self, mns_helper, setup_death_both_tables_test
    ):
        lg_record_id = setup_death_both_tables_test["lg_record_id"]
        review_record_id = setup_death_both_tables_test["review_record_id"]

        def check_death_updates():
            try:
                lg_record_updated = mns_helper.get_lloyd_george_record(lg_record_id)
                lg_deceased = (
                    lg_record_updated["CurrentGpOds"]
                    == PatientOdsInactiveStatus.DECEASED.value
                )

                new_version = mns_helper.get_document_review_record(
                    review_record_id, version=2
                )
                review_deceased = (
                    new_version is not None
                    and new_version["Custodian"]
                    == PatientOdsInactiveStatus.DECEASED.value
                )
                if new_version:
                    assert (
                        new_version["ReviewStatus"]
                        == DocumentReviewStatus.PENDING_REVIEW.value
                    )
                return lg_deceased and review_deceased
            except Exception:
                return False

        update_successful = mns_helper.wait_for_update(check_death_updates)
        assert (
            update_successful
        ), "Both tables were not marked as deceased after formal death notification"

        final_review_v1 = mns_helper.get_document_review_record(
            review_record_id, version=1
        )
        assert (
            final_review_v1["ReviewStatus"] == DocumentReviewStatus.NEVER_REVIEWED.value
        )

    def test_informal_death_notification_no_change(
        self, mns_helper, setup_informal_death_test
    ):
        record_id = setup_informal_death_test["record_id"]
        initial_record = setup_informal_death_test["initial_record"]

        initial_last_updated = initial_record["LastUpdated"]

        final_record = mns_helper.get_lloyd_george_record(record_id)
        assert final_record["Custodian"] == TEST_ORIGINAL_ODS
        assert final_record["CurrentGpOds"] == TEST_ORIGINAL_ODS
        assert final_record["LastUpdated"] == initial_last_updated
