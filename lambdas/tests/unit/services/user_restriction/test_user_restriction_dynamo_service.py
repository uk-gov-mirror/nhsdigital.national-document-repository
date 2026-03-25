import pytest
from botocore.exceptions import ClientError
from freezegun import freeze_time
from pydantic import ValidationError

from models.user_restrictions.user_restrictions import (
    UserRestriction,
    UserRestrictionIndexes,
    UserRestrictionsFields,
)
from services.user_restrictions.user_restriction_dynamo_service import (
    UserRestrictionDynamoService,
)
from tests.unit.conftest import (
    TEST_CURRENT_GP_ODS,
    TEST_NEXT_PAGE_TOKEN,
    TEST_NHS_NUMBER,
    TEST_SMART_CARD_ID,
    TEST_UUID,
)
from tests.unit.services.user_restriction.conftest import MOCK_IDENTIFIER
from utils.exceptions import (
    UserRestrictionConditionCheckFailedException,
    UserRestrictionValidationException,
)

MOCK_USER_RESTRICTION_TABLE = "test_user_restriction_table"
MOCK_TIME_STAMP = 1704110400


MOCK_RESTRICTION_ITEM = {
    "ID": TEST_UUID,
    "NhsNumber": TEST_NHS_NUMBER,
    "RestrictedSmartcard": MOCK_IDENTIFIER,
    "CreatorSmartcard": "223456789022",
    "Custodian": TEST_CURRENT_GP_ODS,
    "IsActive": True,
    "Created": 1704067200,
    "LastUpdated": 1704067200,
}

MOCK_RESTRICTION = {
    "ID": TEST_UUID,
    "RestrictedSmartcard": TEST_SMART_CARD_ID,
    "NhsNumber": TEST_NHS_NUMBER,
    "Custodian": TEST_CURRENT_GP_ODS,
    "Created": 1700000000,
    "CreatorSmartcard": "SC002",
    "RemoverSmartCard": None,
    "IsActive": True,
    "LastUpdated": 1700000001,
}

MOCK_DYNAMO_RESPONSE_WITH_ITEM = {"Items": [MOCK_RESTRICTION_ITEM]}
MOCK_DYNAMO_RESPONSE_EMPTY = {"Items": []}


@pytest.fixture
def mock_service(set_env, monkeypatch, mocker):
    monkeypatch.setenv("RESTRICTIONS_TABLE_NAME", MOCK_USER_RESTRICTION_TABLE)
    mocker.patch(
        "services.user_restrictions.user_restriction_dynamo_service.DynamoDBService",
    )
    service = UserRestrictionDynamoService()
    service.dynamo_service.query_table_with_paginator.return_value = {"Items": []}
    yield service


@pytest.fixture
def mock_dynamo_service(mock_service):
    yield mock_service.dynamo_service


def test_query_restrictions_calls_paginator_with_correct_key_and_index(mock_service):
    mock_service.query_restrictions(ods_code=TEST_CURRENT_GP_ODS)

    call_kwargs = (
        mock_service.dynamo_service.query_table_with_paginator.call_args.kwargs
    )
    assert call_kwargs["key"] == UserRestrictionsFields.CUSTODIAN
    assert call_kwargs["condition"] == TEST_CURRENT_GP_ODS
    assert call_kwargs["index_name"] == UserRestrictionIndexes.CUSTODIAN_INDEX


def test_query_restrictions_by_ods_code_uses_active_filter(mock_service):
    mock_service.query_restrictions(ods_code=TEST_CURRENT_GP_ODS)

    call_kwargs = (
        mock_service.dynamo_service.query_table_with_paginator.call_args.kwargs
    )
    assert UserRestrictionsFields.IS_ACTIVE in call_kwargs["filter_expression"]
    assert (
        UserRestrictionsFields.RESTRICTED_USER not in call_kwargs["filter_expression"]
    )
    assert UserRestrictionsFields.NHS_NUMBER not in call_kwargs["filter_expression"]


def test_query_restrictions_by_smartcard_id_applies_smartcard_filter(mock_service):
    mock_service.query_restrictions(
        ods_code=TEST_CURRENT_GP_ODS,
        smartcard_id=TEST_SMART_CARD_ID,
    )

    call_kwargs = (
        mock_service.dynamo_service.query_table_with_paginator.call_args.kwargs
    )
    assert UserRestrictionsFields.IS_ACTIVE in call_kwargs["filter_expression"]
    assert UserRestrictionsFields.RESTRICTED_USER in call_kwargs["filter_expression"]
    assert (
        call_kwargs["expression_attribute_values"][
            f":{UserRestrictionsFields.RESTRICTED_USER}_condition_val"
        ]
        == TEST_SMART_CARD_ID
    )


def test_query_restrictions_by_nhs_number_applies_nhs_number_filter(mock_service):
    mock_service.query_restrictions(
        ods_code=TEST_CURRENT_GP_ODS,
        nhs_number=TEST_NHS_NUMBER,
    )

    call_kwargs = (
        mock_service.dynamo_service.query_table_with_paginator.call_args.kwargs
    )
    assert UserRestrictionsFields.IS_ACTIVE in call_kwargs["filter_expression"]
    assert UserRestrictionsFields.NHS_NUMBER in call_kwargs["filter_expression"]
    assert (
        call_kwargs["expression_attribute_values"][
            f":{UserRestrictionsFields.NHS_NUMBER}_condition_val"
        ]
        == TEST_NHS_NUMBER
    )


def test_query_restrictions_passes_limit_and_start_key(mock_service):
    mock_service.query_restrictions(
        ods_code=TEST_CURRENT_GP_ODS,
        limit=5,
        start_key=TEST_NEXT_PAGE_TOKEN,
    )

    call_kwargs = (
        mock_service.dynamo_service.query_table_with_paginator.call_args.kwargs
    )
    assert call_kwargs["limit"] == 5
    assert call_kwargs["start_key"] == TEST_NEXT_PAGE_TOKEN


def test_query_restrictions_returns_next_token(mock_service):
    mock_service.dynamo_service.query_table_with_paginator.return_value = {
        "Items": [MOCK_RESTRICTION],
        "NextToken": TEST_NEXT_PAGE_TOKEN,
    }

    _, next_token = mock_service.query_restrictions(ods_code=TEST_CURRENT_GP_ODS)

    assert next_token == TEST_NEXT_PAGE_TOKEN


def test_query_restrictions_returns_empty_list_when_no_items(mock_service):
    mock_service.dynamo_service.query_table_with_paginator.return_value = {"Items": []}

    results, next_token = mock_service.query_restrictions(ods_code=TEST_CURRENT_GP_ODS)

    assert results == []
    assert next_token is None


def test_validate_restrictions_raises_for_invalid_items():
    with pytest.raises(UserRestrictionValidationException):
        UserRestrictionDynamoService._validate_restrictions([{"invalid": "data"}])


def test_query_restrictions_raises_validation_exception_on_client_error(mock_service):
    mock_service.dynamo_service.query_table_with_paginator.side_effect = ClientError(
        {"Error": {"Code": "500", "Message": "DynamoDB error"}},
        "query",
    )

    with pytest.raises(UserRestrictionValidationException):
        mock_service.query_restrictions(ods_code=TEST_CURRENT_GP_ODS)


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


def test_get_user_restrictions_returns_user_restriction_object(
    mock_service,
    mock_dynamo_service,
):
    mock_dynamo_service.query_table_single.return_value = MOCK_DYNAMO_RESPONSE_WITH_ITEM

    actual = mock_service.get_active_user_restrictions_by_smartcard_and_nhs_number(
        TEST_NHS_NUMBER,
        MOCK_IDENTIFIER,
    )

    assert isinstance(actual, UserRestriction)
    assert actual.nhs_number == TEST_NHS_NUMBER
    assert actual.restricted_user == MOCK_IDENTIFIER


def test_get_user_restrictions_returns_none_when_no_items(
    mock_service,
    mock_dynamo_service,
):
    mock_dynamo_service.query_table_single.return_value = MOCK_DYNAMO_RESPONSE_EMPTY

    actual = mock_service.get_active_user_restrictions_by_smartcard_and_nhs_number(
        TEST_NHS_NUMBER,
        MOCK_IDENTIFIER,
    )

    assert actual is None


def test_get_user_restrictions_calls_dynamo_with_correct_args(
    mock_service,
    mock_dynamo_service,
):
    mock_dynamo_service.query_table_single.return_value = MOCK_DYNAMO_RESPONSE_EMPTY

    mock_service.get_active_user_restrictions_by_smartcard_and_nhs_number(
        TEST_NHS_NUMBER,
        MOCK_IDENTIFIER,
    )

    mock_dynamo_service.query_table_single.assert_called_once_with(
        table_name=MOCK_USER_RESTRICTION_TABLE,
        index_name=UserRestrictionIndexes.NHS_NUMBER_INDEX,
        search_key=UserRestrictionsFields.NHS_NUMBER,
        search_condition=TEST_NHS_NUMBER,
        query_filter=mock_dynamo_service.query_table_single.call_args.kwargs[
            "query_filter"
        ],
        limit=1,
    )


def test_get_user_restrictions_raises_exception_on_client_error(
    mock_service,
    mock_dynamo_service,
):
    mock_dynamo_service.query_table_single.side_effect = ClientError(
        {"Error": {"Code": "InternalServerError", "Message": "DynamoDB error"}},
        "Query",
    )

    with pytest.raises(UserRestrictionValidationException):
        mock_service.get_active_user_restrictions_by_smartcard_and_nhs_number(
            TEST_NHS_NUMBER,
            MOCK_IDENTIFIER,
        )


def test_get_user_restrictions_raises_exception_on_validation_error(
    mock_service,
    mock_dynamo_service,
    mocker,
):
    mock_dynamo_service.query_table_single.return_value = MOCK_DYNAMO_RESPONSE_WITH_ITEM
    mocker.patch.object(
        UserRestriction,
        "model_validate",
        side_effect=ValidationError("", []),
    )

    with pytest.raises(UserRestrictionValidationException):
        mock_service.get_active_user_restrictions_by_smartcard_and_nhs_number(
            TEST_NHS_NUMBER,
            MOCK_IDENTIFIER,
        )


def test_check_user_restriction_returns_true_when_restriction_exists(
    mock_service,
    mocker,
):
    mocker.patch.object(
        mock_service,
        "get_active_user_restrictions_by_smartcard_and_nhs_number",
        return_value=UserRestriction.model_validate(MOCK_RESTRICTION_ITEM),
    )

    actual = mock_service.check_user_restriction(TEST_NHS_NUMBER, MOCK_IDENTIFIER)

    assert actual is True


def test_check_user_restriction_returns_false_when_no_restriction(mock_service, mocker):
    mocker.patch.object(
        mock_service,
        "get_active_user_restrictions_by_smartcard_and_nhs_number",
        return_value=None,
    )

    actual = mock_service.check_user_restriction(TEST_NHS_NUMBER, MOCK_IDENTIFIER)

    assert actual is False
