import os
from datetime import datetime, timezone
from enum import StrEnum

from botocore.exceptions import ClientError
from pydantic import ValidationError

from enums.dynamo_filter import ConditionOperator
from models.user_restrictions.user_restrictions import (
    UserRestriction,
    UserRestrictionsFields,
)
from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService
from utils.dynamo_utils import build_mixed_condition_expression
from utils.exceptions import (
    UserRestrictionConditionCheckFailedException,
    UserRestrictionValidationException,
)

logger = LoggingService(__name__)

DEFAULT_LIMIT = 10
MAX_LIMIT = 100

SMARTCARD_KEY = "RestrictedSmartcard"
NHS_NUMBER_KEY = "NhsNumber"
ODS_CODE_GSI = "CustodianIndex"
ODS_CODE_KEY = "Custodian"


class DynamoClientErrors(StrEnum):
    NOT_FOUND = "ResourceNotFoundException"
    CONDITION_CHECK_FAILURE = "ConditionalCheckFailedException"


class UserRestrictionDynamoService:
    def __init__(self):
        self.dynamo_service = DynamoDBService()
        self.table_name = os.environ["RESTRICTIONS_TABLE_NAME"]

    def query_restrictions(
        self,
        ods_code: str,
        smart_card_id: str | None = None,
        nhs_number: str | None = None,
        limit: int = DEFAULT_LIMIT,
        start_key: str | None = None,
    ) -> tuple[list[UserRestriction], str | None]:
        filter_expression, expression_attribute_names, expression_attribute_values = (
            self._build_query_filter(
                smart_card_id=smart_card_id,
                nhs_number=nhs_number,
            )
        )

        response = self.dynamo_service.query_table_with_paginator(
            table_name=self.table_name,
            index_name=ODS_CODE_GSI,
            key=ODS_CODE_KEY,
            condition=ods_code,
            filter_expression=filter_expression,
            expression_attribute_names=expression_attribute_names,
            expression_attribute_values=expression_attribute_values,
            limit=limit,
            start_key=start_key,
        )

        items = response.get("Items", [])
        restrictions = self._validate_restrictions(items)
        next_token = response.get("NextToken")

        return restrictions, next_token

    def get_restriction_by_smartcard_id(
        self,
        restriction_id: str | None = None,
    ) -> UserRestriction | None:
        response = self.dynamo_service.get_item(
            table_name=self.table_name,
            key={UserRestrictionsFields.ID.value: restriction_id},
        )

        if "Item" not in response:
            return None

        return UserRestriction.model_validate(response["Item"])

    def update_restriction_inactive(
        self,
        restriction_id: str,
        removed_by: str,
        patient_id: str,
    ):
        try:
            logger.info("Updating user restriction inactive.")
            current_time = int(datetime.now(timezone.utc).timestamp())

            updated_fields = {
                UserRestrictionsFields.REMOVED_BY.value: removed_by,
                UserRestrictionsFields.LAST_UPDATED.value: current_time,
                UserRestrictionsFields.IS_ACTIVE.value: False,
            }

            self.dynamo_service.update_item(
                table_name=self.table_name,
                key_pair={UserRestrictionsFields.ID.value: restriction_id},
                updated_fields=updated_fields,
                condition_expression=f"{UserRestrictionsFields.IS_ACTIVE.value} = :true "
                f"AND {UserRestrictionsFields.RESTRICTED_USER.value} <> :user_id "
                f"AND {UserRestrictionsFields.NHS_NUMBER.value} = :patient_id",
                expression_attribute_values={
                    ":true": True,
                    ":user_id": removed_by,
                    ":patient_id": patient_id,
                },
            )

        except ClientError as e:
            logger.error(e)
            if (
                e.response["Error"]["Code"]
                == DynamoClientErrors.CONDITION_CHECK_FAILURE
            ):
                raise UserRestrictionConditionCheckFailedException()
            else:
                raise e

    @staticmethod
    def _build_query_filter(
        smart_card_id: str | None,
        nhs_number: str | None,
    ) -> tuple[str, dict, dict]:
        conditions = [
            {
                "field": "IsActive",
                "operator": ConditionOperator.EQUAL.value,
                "value": True,
            },
        ]
        if smart_card_id:
            conditions.append(
                {
                    "field": SMARTCARD_KEY,
                    "operator": ConditionOperator.EQUAL.value,
                    "value": smart_card_id,
                },
            )
        if nhs_number:
            conditions.append(
                {
                    "field": NHS_NUMBER_KEY,
                    "operator": ConditionOperator.EQUAL.value,
                    "value": nhs_number,
                },
            )
        return build_mixed_condition_expression(conditions)

    @staticmethod
    def _validate_restrictions(items: list[dict]) -> list[UserRestriction]:
        try:
            return [UserRestriction.model_validate(item) for item in items]
        except ValidationError as e:
            logger.error(e)
            raise UserRestrictionValidationException(
                f"Failed to validate user restrictions: {e}",
            ) from e
