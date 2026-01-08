import time

import pytest
from enums.document_review_status import DocumentReviewStatus
from tests.e2e.mns.mns_helper import TEST_NEW_ODS, TEST_ORIGINAL_ODS, MNSTestHelper

TEST_NHS_LG = "9730154198"
TEST_NHS_DR = "9730154201"
TEST_NHS_NP = "9730154384"
TEST_NHS_BOTH = "9730154422"


@pytest.fixture(scope="session")
def setup_all_tests():
    helper = MNSTestHelper()

    lg_record = helper.create_lloyd_george_record(
        nhs_number=TEST_NHS_LG, ods_code=TEST_ORIGINAL_ODS
    )

    review_record = helper.create_document_review_record(
        nhs_number=TEST_NHS_DR, ods_code=TEST_ORIGINAL_ODS
    )

    non_pending_record = helper.create_document_review_record(
        nhs_number=TEST_NHS_NP,
        ods_code=TEST_ORIGINAL_ODS,
        review_status=DocumentReviewStatus.APPROVED,
    )

    both_lg_record = helper.create_lloyd_george_record(
        nhs_number=TEST_NHS_BOTH, ods_code=TEST_ORIGINAL_ODS
    )

    both_review_record = helper.create_document_review_record(
        nhs_number=TEST_NHS_BOTH, ods_code=TEST_ORIGINAL_ODS
    )

    initial_lg = helper.get_lloyd_george_record(lg_record["id"])
    initial_dr = helper.get_document_review_record(review_record["id"], version=1)
    initial_np = helper.get_document_review_record(non_pending_record["id"], version=1)
    initial_both_lg = helper.get_lloyd_george_record(both_lg_record["id"])
    initial_both_review = helper.get_document_review_record(
        both_review_record["id"], version=1
    )

    helper.send_gp_change_message(TEST_NHS_LG)
    helper.send_gp_change_message(TEST_NHS_DR)
    helper.send_gp_change_message(TEST_NHS_NP)
    helper.send_gp_change_message(TEST_NHS_BOTH)

    print("\nWaiting 50 seconds for all SQS messages to be processed...")
    time.sleep(50)
    print("Wait complete, starting tests...")

    setup_data = {
        "lloyd_george": {
            "record_id": lg_record["id"],
            "initial_record": initial_lg,
        },
        "document_review": {
            "record_id": review_record["id"],
            "initial_record": initial_dr,
        },
        "non_pending_review": {
            "record_id": non_pending_record["id"],
            "initial_record": initial_np,
        },
        "both_tables": {
            "lg_record_id": both_lg_record["id"],
            "review_record_id": both_review_record["id"],
            "initial_lg": initial_both_lg,
            "initial_review": initial_both_review,
        },
    }

    yield setup_data

    helper.cleanup_lloyd_george_record(lg_record["id"])
    helper.cleanup_lloyd_george_record(both_lg_record["id"])
    helper.cleanup_document_review_record(review_record["id"])
    helper.cleanup_document_review_record(non_pending_record["id"])
    helper.cleanup_document_review_record(both_review_record["id"])


@pytest.fixture
def mns_helper():
    return MNSTestHelper()


@pytest.fixture
def setup_lloyd_george_test(setup_all_tests):
    return setup_all_tests["lloyd_george"]


@pytest.fixture
def setup_document_review_test(setup_all_tests):
    return setup_all_tests["document_review"]


@pytest.fixture
def setup_non_pending_review_test(setup_all_tests):
    return setup_all_tests["non_pending_review"]


@pytest.fixture
def setup_both_tables_test(setup_all_tests):
    return setup_all_tests["both_tables"]


class TestMNSChangeOfGP:
    def test_gp_change_updates_lloyd_george_record(
        self, mns_helper, setup_lloyd_george_test
    ):
        record_id = setup_lloyd_george_test["record_id"]
        initial_record = setup_lloyd_george_test["initial_record"]

        print(initial_record)
        assert initial_record["CurrentGpOds"] == TEST_ORIGINAL_ODS
        assert initial_record["Custodian"] == TEST_ORIGINAL_ODS

        def check_update():
            updated_record = mns_helper.get_lloyd_george_record(record_id)
            print(updated_record)
            last_updated_changed = (
                updated_record["LastUpdated"] != initial_record["LastUpdated"]
            )
            custodian_changed = (
                updated_record["Custodian"] != initial_record["Custodian"]
            )
            current_gp_changed = (
                updated_record["CurrentGpOds"] != initial_record["CurrentGpOds"]
            )
            return last_updated_changed and custodian_changed and current_gp_changed

        update_successful = mns_helper.wait_for_update(check_update)
        assert update_successful, "Lloyd George record was not updated after GP change"

    def test_gp_change_updates_document_review_record(
        self, mns_helper, setup_document_review_test
    ):
        record_id = setup_document_review_test["record_id"]
        initial_record = setup_document_review_test["initial_record"]

        assert initial_record["Custodian"] == TEST_ORIGINAL_ODS
        assert (
            initial_record["ReviewStatus"] == DocumentReviewStatus.PENDING_REVIEW.value
        )
        assert initial_record["Version"] == 1

        def check_new_version():
            try:
                new_version = mns_helper.get_document_review_record(
                    record_id, version=2
                )
                return new_version is not None
            except Exception:
                return False

        update_successful = mns_helper.wait_for_update(check_new_version)
        assert (
            update_successful
        ), "New version of document review record was not created after GP change"

        version_2_record = mns_helper.get_document_review_record(record_id, version=2)
        assert version_2_record["Version"] == 2
        assert version_2_record["Custodian"] == TEST_NEW_ODS
        assert version_2_record is not None

        version_1_record = mns_helper.get_document_review_record(record_id, version=1)
        assert (
            version_1_record["ReviewStatus"]
            == DocumentReviewStatus.NEVER_REVIEWED.value
        )
        assert version_1_record.get("ReviewDate") is not None
        assert version_1_record["Reviewer"] == TEST_ORIGINAL_ODS

    def test_gp_change_non_pending_review_no_new_version(
        self, mns_helper, setup_non_pending_review_test
    ):
        record_id = setup_non_pending_review_test["record_id"]
        initial_record = setup_non_pending_review_test["initial_record"]

        assert initial_record["Custodian"] == TEST_ORIGINAL_ODS
        assert initial_record["ReviewStatus"] == DocumentReviewStatus.APPROVED.value
        assert initial_record["Version"] == 1

        def check_no_new_version():
            version_1_record = mns_helper.get_document_review_record(
                record_id, version=1
            )
            updated = version_1_record.get("Custodian") == TEST_NEW_ODS
            return updated

        no_new_version = mns_helper.wait_for_update(check_no_new_version)
        assert (
            no_new_version
        ), "Version 1 should have been updated for non-PENDING_REVIEW record"

        version_1_record = mns_helper.get_document_review_record(record_id, version=1)
        assert version_1_record is not None
        assert version_1_record["Version"] == 1
        assert version_1_record["ReviewStatus"] == DocumentReviewStatus.APPROVED.value
        assert version_1_record["Custodian"] == TEST_NEW_ODS

        try:
            mns_helper.get_document_review_record(record_id, version=2)
            assert False, "Version 2 should not exist"
        except Exception:
            pass

    def test_gp_change_updates_both_tables(self, mns_helper, setup_both_tables_test):
        lg_record_id = setup_both_tables_test["lg_record_id"]
        review_record_id = setup_both_tables_test["review_record_id"]
        initial_lg = setup_both_tables_test["initial_lg"]
        initial_review = setup_both_tables_test["initial_review"]

        def check_updates():
            try:
                updated_record = mns_helper.get_lloyd_george_record(lg_record_id)
                last_updated_changed = (
                    updated_record["LastUpdated"] != initial_lg["LastUpdated"]
                )
                custodian_changed = (
                    updated_record["Custodian"] != initial_lg["Custodian"]
                )
                current_gp_changed = (
                    updated_record["CurrentGpOds"] != initial_lg["CurrentGpOds"]
                )
                lg_changed = (
                    last_updated_changed and custodian_changed and current_gp_changed
                )

                new_review_version = mns_helper.get_document_review_record(
                    review_record_id, version=2
                )
                review_versioned = new_review_version is not None

                return lg_changed and review_versioned
            except Exception:
                return False

        update_successful = mns_helper.wait_for_update(check_updates)
        assert update_successful, "Both tables were not updated after GP change"

        final_lg_record = mns_helper.get_lloyd_george_record(lg_record_id)
        assert final_lg_record is not None

        final_review_v2 = mns_helper.get_document_review_record(
            review_record_id, version=2
        )
        assert final_review_v2 is not None
        assert final_review_v2["Version"] == 2

        final_review_v1 = mns_helper.get_document_review_record(
            review_record_id, version=1
        )
        assert (
            final_review_v1["ReviewStatus"] == DocumentReviewStatus.NEVER_REVIEWED.value
        )
        assert final_review_v1.get("ReviewDate") is not None
        assert final_review_v1["Reviewer"] == initial_review["Custodian"]
        assert final_review_v1["Custodian"] != initial_lg["Custodian"]
