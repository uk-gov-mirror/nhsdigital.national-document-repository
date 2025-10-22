from datetime import datetime

from freezegun import freeze_time
from models.document_reference import DocumentReference
from tests.unit.helpers.data.dynamo.dynamo_responses import MOCK_SEARCH_RESPONSE

MOCK_DOCUMENT_REFERENCE = DocumentReference.model_validate(
    MOCK_SEARCH_RESPONSE["Items"][0]
)


def test_get_base_name():
    expected = "document"

    actual = MOCK_DOCUMENT_REFERENCE.get_base_name()

    assert expected == actual


def test_get_file_extension():
    expected = ".csv"

    actual = MOCK_DOCUMENT_REFERENCE.get_file_extension()

    assert expected == actual


@freeze_time("2023-10-30T10:25:00")
def test_last_updated_within_three_minutes_return_true_when_last_updated_is_less_than_3_minutes_ago():
    within_three_minutes = int(
        datetime.fromisoformat("2023-10-30T10:22:01").timestamp()
    )
    MOCK_DOCUMENT_REFERENCE.last_updated = within_three_minutes

    actual = MOCK_DOCUMENT_REFERENCE.last_updated_within_three_minutes()
    expected = True

    assert expected == actual


@freeze_time("2023-10-30T10:25:00")
def test_last_updated_within_three_minutes_return_false_when_last_updated_is_more_than_3_minutes_ago():
    more_than_three_minutes_ago = int(
        datetime.fromisoformat("2023-10-30T10:21:59").timestamp()
    )
    MOCK_DOCUMENT_REFERENCE.last_updated = more_than_three_minutes_ago

    actual = MOCK_DOCUMENT_REFERENCE.last_updated_within_three_minutes()
    expected = False

    assert expected == actual


def test_infer_doc_status_returns_deprecated_when_deleted():
    MOCK_DOCUMENT_REFERENCE.deleted = "2023-10-30T10:25:00.000Z"
    MOCK_DOCUMENT_REFERENCE.uploaded = True
    MOCK_DOCUMENT_REFERENCE.uploading = False

    actual = MOCK_DOCUMENT_REFERENCE.infer_doc_status()
    expected = "deprecated"

    assert expected == actual


def test_infer_doc_status_returns_final_when_uploaded():
    MOCK_DOCUMENT_REFERENCE.deleted = None
    MOCK_DOCUMENT_REFERENCE.uploaded = True
    MOCK_DOCUMENT_REFERENCE.uploading = False

    actual = MOCK_DOCUMENT_REFERENCE.infer_doc_status()
    expected = "final"

    assert expected == actual


def test_infer_doc_status_returns_preliminary_when_uploading():
    MOCK_DOCUMENT_REFERENCE.deleted = None
    MOCK_DOCUMENT_REFERENCE.uploaded = False
    MOCK_DOCUMENT_REFERENCE.uploading = True

    actual = MOCK_DOCUMENT_REFERENCE.infer_doc_status()
    expected = "preliminary"

    assert expected == actual


def test_infer_doc_status_returns_none_when_no_status_indicators():
    MOCK_DOCUMENT_REFERENCE.deleted = None
    MOCK_DOCUMENT_REFERENCE.uploaded = False
    MOCK_DOCUMENT_REFERENCE.uploading = False

    actual = MOCK_DOCUMENT_REFERENCE.infer_doc_status()
    expected = None

    assert expected == actual


def test_infer_doc_status_returns_none_when_all_flags_are_none():
    MOCK_DOCUMENT_REFERENCE.deleted = None
    MOCK_DOCUMENT_REFERENCE.uploaded = None
    MOCK_DOCUMENT_REFERENCE.uploading = None

    actual = MOCK_DOCUMENT_REFERENCE.infer_doc_status()
    expected = None

    assert expected == actual
