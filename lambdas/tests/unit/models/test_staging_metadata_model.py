import json

import pytest
from pydantic import ValidationError

from models.staging_metadata import MetadataFile, StagingSqsMetadata
from tests.unit.helpers.data.bulk_upload.test_data import (
    EXPECTED_SQS_MSG_FOR_PATIENT_123456789,
    EXPECTED_SQS_MSG_FOR_PATIENT_1234567890,
    patient_1,
    patient_2,
)


def test_serialise_staging_data_to_json():
    assert (
        patient_1.model_dump_json(by_alias=True)
        == EXPECTED_SQS_MSG_FOR_PATIENT_1234567890
    )
    assert (
        patient_2.model_dump_json(by_alias=True)
        == EXPECTED_SQS_MSG_FOR_PATIENT_123456789
    )


def test_deserialise_json_to_staging_data():
    assert (
        StagingSqsMetadata.model_validate(
            json.loads(EXPECTED_SQS_MSG_FOR_PATIENT_1234567890),
        )
        == patient_1
    )
    assert (
        StagingSqsMetadata.model_validate(
            json.loads(EXPECTED_SQS_MSG_FOR_PATIENT_123456789),
        )
        == patient_2
    )


VALID_ROW_BASE = {
    "FILEPATH": "some/file.pdf",
    "GP-PRACTICE-CODE": "Y12345",
    "NHS-NO": "1234567890",
    "SCAN-DATE": "01/01/2023",
}


@pytest.mark.parametrize(
    "raw_value, expected",
    [
        ("Y12345", "Y12345"),
        ("  Y12345", "Y12345"),
        ("Y12345  ", "Y12345"),
        ("  Y12345  ", "Y12345"),
        ("\tY12345\t", "Y12345"),
    ],
)
def test_gp_practice_code_strips_whitespace(raw_value, expected):
    row = {**VALID_ROW_BASE, "GP-PRACTICE-CODE": raw_value}
    result = MetadataFile.model_validate(row)
    assert result.gp_practice_code == expected


def test_gp_practice_code_whitespace_only_fails_validation():
    row = {**VALID_ROW_BASE, "GP-PRACTICE-CODE": "   "}
    with pytest.raises(ValidationError):
        MetadataFile.model_validate(row)


def test_gp_practice_code_empty_fails_validation():
    row = {**VALID_ROW_BASE, "GP-PRACTICE-CODE": ""}
    with pytest.raises(ValidationError):
        MetadataFile.model_validate(row)
