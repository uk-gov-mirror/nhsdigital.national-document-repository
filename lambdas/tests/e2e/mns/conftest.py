import pytest
from tests.e2e.mns.mns_helper import MNSTestHelper


@pytest.fixture
def mns_helper():
    return MNSTestHelper()


@pytest.fixture
def test_records():
    records = {"lloyd_george": [], "document_review": []}
    yield records

    helper = MNSTestHelper()
    for record_id in records["lloyd_george"]:
        helper.cleanup_lloyd_george_record(record_id)
    for record_id in records["document_review"]:
        helper.cleanup_document_review_record(record_id)
