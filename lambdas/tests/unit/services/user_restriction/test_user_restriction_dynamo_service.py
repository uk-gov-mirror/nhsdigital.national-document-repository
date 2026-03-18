import pytest
from botocore.exceptions import ClientError
from freezegun import freeze_time

from models.user_restrictions.user_restrictions import UserRestrictionsFields
from services.user_restrictions.user_restriction_dynamo_service import (
    NHS_NUMBER_KEY,
    ODS_CODE_GSI,
    ODS_CODE_KEY,
    SMARTCARD_KEY,
    UserRestrictionDynamoService,
)
from tests.unit.conftest import TEST_NHS_NUMBER, TEST_UUID
from utils.exceptions import (
    UserRestrictionConditionCheckFailedException,
    UserRestrictionValidationException,
)

TEST_ODS_CODE = "Y12345"
TEST_SMART_CARD_ID = "SC001"
MOCK_USER_RESTRICTION_TABLE = "test_user_restriction_table"
TEST_NEXT_TOKEN = "some-opaque-next-token"

MOCK_RESTRICTION = {
    "ID": TEST_UUID,
    "RestrictedSmartcard": TEST_SMART_CARD_ID,
    "NhsNumber": TEST_NHS_NUMBER,
    "Custodian": TEST_ODS_CODE,
    "Created": 1700000000,
    "CreatorSmartcard": "SC002",
    "RemoverSmartCard": None,
    "IsActive": True,
    "LastUpdated": 1700000001,
}

MOCK_TIME_STAMP = 1704110400


@pytest.fixture
def mock_service(set_env, mocker):
    mocker.patch(
        "services.user_restrictions.user_restriction_dynamo_service.DynamoDBService",
    )
    service = UserRestrictionDynamoService()
    service.dynamo_service.query_table_with_paginator.return_value = {"Items": []}
    yield service


def test_query_restrictions_calls_paginator_with_correct_key_and_index(mock_service):
    mock_service.query_restrictions(ods_code=TEST_ODS_CODE)

    call_kwargs = (
        mock_service.dynamo_service.query_table_with_paginator.call_args.kwargs
    )
    assert call_kwargs["key"] == ODS_CODE_KEY
    assert call_kwargs["condition"] == TEST_ODS_CODE
    assert call_kwargs["index_name"] == ODS_CODE_GSI


def test_query_restrictions_by_ods_code_uses_active_filter(mock_service):
    mock_service.query_restrictions(ods_code=TEST_ODS_CODE)

    call_kwargs = (
        mock_service.dynamo_service.query_table_with_paginator.call_args.kwargs
    )
    assert "IsActive" in call_kwargs["filter_expression"]
    assert SMARTCARD_KEY not in call_kwargs["filter_expression"]
    assert NHS_NUMBER_KEY not in call_kwargs["filter_expression"]


def test_query_restrictions_by_smart_card_id_applies_smartcard_filter(mock_service):
    mock_service.query_restrictions(
        ods_code=TEST_ODS_CODE,
        smart_card_id=TEST_SMART_CARD_ID,
    )

    call_kwargs = (
        mock_service.dynamo_service.query_table_with_paginator.call_args.kwargs
    )
    assert "IsActive" in call_kwargs["filter_expression"]
    assert SMARTCARD_KEY in call_kwargs["filter_expression"]
    assert (
        call_kwargs["expression_attribute_values"][":RestrictedSmartcard_condition_val"]
        == TEST_SMART_CARD_ID
    )


def test_query_restrictions_by_nhs_number_applies_nhs_number_filter(mock_service):
    mock_service.query_restrictions(ods_code=TEST_ODS_CODE, nhs_number=TEST_NHS_NUMBER)

    call_kwargs = (
        mock_service.dynamo_service.query_table_with_paginator.call_args.kwargs
    )
    assert "IsActive" in call_kwargs["filter_expression"]
    assert NHS_NUMBER_KEY in call_kwargs["filter_expression"]
    assert (
        call_kwargs["expression_attribute_values"][":NhsNumber_condition_val"]
        == TEST_NHS_NUMBER
    )


def test_query_restrictions_passes_limit_and_start_key(mock_service):
    mock_service.query_restrictions(
        ods_code=TEST_ODS_CODE,
        limit=5,
        start_key=TEST_NEXT_TOKEN,
    )

    call_kwargs = (
        mock_service.dynamo_service.query_table_with_paginator.call_args.kwargs
    )
    assert call_kwargs["limit"] == 5
    assert call_kwargs["start_key"] == TEST_NEXT_TOKEN


def test_query_restrictions_returns_next_token(mock_service):
    mock_service.dynamo_service.query_table_with_paginator.return_value = {
        "Items": [MOCK_RESTRICTION],
        "NextToken": TEST_NEXT_TOKEN,
    }

    _, next_token = mock_service.query_restrictions(ods_code=TEST_ODS_CODE)

    assert next_token == TEST_NEXT_TOKEN


def test_query_restrictions_returns_empty_list_when_no_items(mock_service):
    mock_service.dynamo_service.query_table_with_paginator.return_value = {"Items": []}

    results, next_token = mock_service.query_restrictions(ods_code=TEST_ODS_CODE)

    assert results == []
    assert next_token is None


def test_validate_restrictions_raises_for_invalid_items():
    with pytest.raises(UserRestrictionValidationException):
        UserRestrictionDynamoService._validate_restrictions([{"invalid": "data"}])


def test_get_restriction_by_smartcard_id(mock_service):
    mock_service.get_restriction_by_smartcard_id(TEST_UUID)

    mock_service.dynamo_service.get_item.assert_called_with(
        table_name=MOCK_USER_RESTRICTION_TABLE,
        key={UserRestrictionsFields.ID.value: TEST_UUID},
    )


@freeze_time("2024-01-01 12:00:00")
def test_soft_delete_user_restriction(mock_service):
    mock_service.update_restriction_inactive(
        restriction_id=TEST_UUID,
        removed_by=TEST_SMART_CARD_ID,
        patient_id=TEST_NHS_NUMBER,
    )

    expected_updated_fields = {
        UserRestrictionsFields.REMOVED_BY.value: TEST_SMART_CARD_ID,
        UserRestrictionsFields.LAST_UPDATED.value: MOCK_TIME_STAMP,
        UserRestrictionsFields.IS_ACTIVE.value: False,
    }

    mock_service.dynamo_service.update_item.assert_called_with(
        table_name=MOCK_USER_RESTRICTION_TABLE,
        key_pair={UserRestrictionsFields.ID.value: TEST_UUID},
        updated_fields=expected_updated_fields,
        condition_expression=f"{UserRestrictionsFields.IS_ACTIVE.value} = :true AND "
        f"{UserRestrictionsFields.RESTRICTED_USER.value} <> :user_id AND {UserRestrictionsFields.NHS_NUMBER.value} = :patient_id",
        expression_attribute_values={
            ":true": True,
            ":user_id": TEST_SMART_CARD_ID,
            ":patient_id": TEST_NHS_NUMBER,
        },
    )


def test_soft_delete_user_restriction_handles_restriction_already_inactive(
    mock_service,
):
    mock_service.dynamo_service.update_item.side_effect = ClientError(
        {
            "Error": {
                "Code": "ConditionalCheckFailedException",
                "Message": "Condition not met",
            },
        },
        "Update Item",
    )

    with pytest.raises(UserRestrictionConditionCheckFailedException):
        mock_service.update_restriction_inactive(
            restriction_id=TEST_UUID,
            removed_by=TEST_SMART_CARD_ID,
            patient_id=TEST_NHS_NUMBER,
        )
