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


def test_set_location_properties_with_file_location_sets_bucket_and_key():
    data = {
        "id": "test-id-123",
        "file_name": "test.pdf",
        "nhs_number": "9000000009",
        "file_location": "s3://my-bucket/folder/9000000009/test-id-123",
    }

    doc_ref = DocumentReference.model_validate(data)

    assert doc_ref.s3_bucket_name == "my-bucket"
    assert doc_ref.s3_file_key == "folder/9000000009/test-id-123"
    assert doc_ref.file_location == "s3://my-bucket/folder/9000000009/test-id-123"


def test_set_location_properties_with_FileLocation_pascal_case():
    data = {
        "id": "test-id-456",
        "file_name": "test.pdf",
        "nhs_number": "9000000009",
        "FileLocation": "s3://another-bucket/path/to/file",
    }

    doc_ref = DocumentReference.model_validate(data)

    assert doc_ref.s3_bucket_name == "another-bucket"
    assert doc_ref.s3_file_key == "path/to/file"
    assert doc_ref.file_location == "s3://another-bucket/path/to/file"


def test_set_location_properties_with_s3_bucket_name_builds_location():
    data = {
        "id": "test-id-789",
        "file_name": "test.pdf",
        "nhs_number": "9000000009",
        "s3_bucket_name": "test-bucket",
    }

    doc_ref = DocumentReference.model_validate(data)

    assert doc_ref.s3_bucket_name == "test-bucket"
    assert doc_ref.s3_file_key == "9000000009/test-id-789"
    assert doc_ref.file_location == "s3://test-bucket/9000000009/test-id-789"


def test_set_location_properties_with_s3_bucket_and_subfolder():
    data = {
        "id": "test-id-101",
        "file_name": "test.pdf",
        "nhs_number": "9000000009",
        "s3_bucket_name": "test-bucket",
        "sub_folder": "patients/archive",
    }

    doc_ref = DocumentReference.model_validate(data)

    assert doc_ref.s3_bucket_name == "test-bucket"
    assert doc_ref.s3_file_key == "patients/archive/9000000009/test-id-101"
    assert (
        doc_ref.file_location
        == "s3://test-bucket/patients/archive/9000000009/test-id-101"
    )


def test_set_location_properties_with_s3_bucket_subfolder_and_doc_type():
    data = {
        "id": "test-id-202",
        "file_name": "test.pdf",
        "nhs_number": "9000000009",
        "s3_bucket_name": "test-bucket",
        "sub_folder": "patients/active",
        "doc_type": "ARF",
    }

    doc_ref = DocumentReference.model_validate(data)

    assert doc_ref.s3_bucket_name == "test-bucket"
    assert doc_ref.s3_file_key == "patients/active/ARF/9000000009/test-id-202"
    assert (
        doc_ref.file_location
        == "s3://test-bucket/patients/active/ARF/9000000009/test-id-202"
    )


def test_set_location_properties_with_explicit_s3_file_key():
    data = {
        "id": "test-id-303",
        "file_name": "test.pdf",
        "nhs_number": "9000000009",
        "s3_bucket_name": "test-bucket",
        "s3_file_key": "custom/path/to/file",
    }

    doc_ref = DocumentReference.model_validate(data)

    assert doc_ref.s3_bucket_name == "test-bucket"
    assert doc_ref.s3_file_key == "custom/path/to/file"
    assert doc_ref.file_location == "s3://test-bucket/9000000009/test-id-303"


def test_set_location_properties_file_location_does_not_override_explicit_s3_key():
    data = {
        "id": "test-id-404",
        "file_name": "test.pdf",
        "nhs_number": "9000000009",
        "file_location": "s3://bucket-one/old/path/file",
        "s3_file_key": "new/path/file",
    }

    doc_ref = DocumentReference.model_validate(data)

    assert doc_ref.s3_bucket_name == "bucket-one"
    assert doc_ref.s3_file_key == "new/path/file"


def test_set_location_properties_with_leading_slash_in_key():
    data = {
        "id": "test-id-505",
        "file_name": "test.pdf",
        "nhs_number": "9000000009",
        "s3_bucket_name": "test-bucket",
        "s3_file_key": "/leading/slash/path",
    }

    doc_ref = DocumentReference.model_validate(data)

    assert doc_ref.file_location == "s3://test-bucket/9000000009/test-id-505"


def test_set_location_properties_complex_s3_location():
    data = {
        "id": "test-id-606",
        "file_name": "test.pdf",
        "nhs_number": "9000000009",
        "file_location": "s3://prod-bucket/year/2024/month/10/patient/9000000009/test-id-606",
    }

    doc_ref = DocumentReference.model_validate(data)

    assert doc_ref.s3_bucket_name == "prod-bucket"
    assert doc_ref.s3_file_key == "year/2024/month/10/patient/9000000009/test-id-606"
    assert (
        doc_ref.file_location
        == "s3://prod-bucket/year/2024/month/10/patient/9000000009/test-id-606"
    )
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