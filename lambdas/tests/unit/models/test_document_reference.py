from datetime import datetime

import pytest
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

@pytest.mark.parametrize(
    "deleted, uploaded, uploading, expected",
    [
        ("2024-01-01T00:00:00Z", False, False, "deprecated"),  # deleted = string timestamp
        ("", True, False, "final"),                            # deleted empty → not deleted
        ("", False, True, "preliminary"),
        ("", False, False, None),
    ],
)
def test_infer_doc_status(deleted, uploaded, uploading, expected):
    document = DocumentReference(
        id="123",
        file_name="test.pdf",
        nhs_number="1234567890",
        deleted=deleted,
        uploaded=uploaded,
        uploading=uploading,
    )

    actual = document.infer_doc_status()

    assert actual == expected