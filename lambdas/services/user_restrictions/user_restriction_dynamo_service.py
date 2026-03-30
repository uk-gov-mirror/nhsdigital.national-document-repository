import os
from datetime import datetime, timezone
from enum import StrEnum

from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
from pydantic import ValidationError

from enums.dynamo_filter import AttributeOperator, ConditionOperator
from models.user_restrictions.user_restrictions import (
    UserRestriction,
    UserRestrictionIndexes,
    UserRestrictionsFields,
)
from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.dynamo_utils import build_mixed_condition_expression
from utils.exceptions import (
    UserRestrictionConditionCheckFailedException,
    UserRestrictionDynamoDBException,
    UserRestrictionValidationException,
)

logger = LoggingService(__name__)

DEFAULT_LIMIT = 10
MAX_LIMIT = 100


class DynamoClientErrors(StrEnum):
    NOT_FOUND = "ResourceNotFoundException"
    CONDITION_CHECK_FAILURE = "ConditionalCheckFailedException"


class UserRestrictionDynamoService:
    def __init__(self):
        self.dynamo_service = DynamoDBService()
        self.table_name = os.environ["RESTRICTIONS_TABLE_NAME"]

    def create_restriction_item(self, restriction: UserRestriction) -> None:
        self.dynamo_service.create_item(
            table_name=self.table_name,
            item=restriction.model_dump(by_alias=True, exclude_none=True),
            key_name=UserRestrictionsFields.ID.value,
        )

    def get_active_restriction(
        self,
        nhs_number: str,
        restricted_user: str,
    ) -> dict | None:
        query_filter = Attr(UserRestrictionsFields.RESTRICTED_USER).eq(
            restricted_user,
        ) & Attr(UserRestrictionsFields.IS_ACTIVE).eq(True)

        results = self.dynamo_service.query_table(
            table_name=self.table_name,
            index_name=UserRestrictionIndexes.NHS_NUMBER_INDEX,
            search_key=UserRestrictionsFields.NHS_NUMBER,
            search_condition=nhs_number,
            query_filter=query_filter,
        )
        return results[0] if results else None

    def query_restrictions(
        self,
        ods_code: str,
        smartcard_id: str | None = None,
        nhs_number: str | None = None,
        limit: int = DEFAULT_LIMIT,
        start_key: str | None = None,
    ) -> tuple[list[UserRestriction], str | None]:
        limit = max(1, min(limit, MAX_LIMIT))

        filter_expression, expression_attribute_names, expression_attribute_values = (
            self._build_query_filter(
                smartcard_id=smartcard_id,
                nhs_number=nhs_number,
            )
        )

        try:
            response = self.dynamo_service.query_table_with_paginator(
                table_name=self.table_name,
                index_name=UserRestrictionIndexes.CUSTODIAN_INDEX,
                key=UserRestrictionsFields.CUSTODIAN,
                condition=ods_code,
                filter_expression=filter_expression,
                expression_attribute_names=expression_attribute_names,
                expression_attribute_values=expression_attribute_values,
                limit=limit,
                start_key=start_key,
            )
        except ClientError as e:
            logger.error(f"DynamoDB ClientError when querying restrictions: {e}")
            raise UserRestrictionValidationException(
                f"Failed to query user restrictions from DynamoDB: {e}",
            ) from e

        items = response.get("Items", [])
        restrictions = self._validate_restrictions(items)
        next_token = response.get("NextToken")

        return restrictions, next_token

    def update_restriction_inactive(
        self,
        restriction_id: str,
        removed_by: str,
        patient_id: str,
    ):
        logger.info("Updating user restriction inactive.")
        current_time = int(datetime.now(timezone.utc).timestamp())

        updated_fields = {
            UserRestrictionsFields.REMOVED_BY.value: removed_by,
            UserRestrictionsFields.LAST_UPDATED.value: current_time,
            UserRestrictionsFields.IS_ACTIVE.value: False,
        }

        try:
            self.dynamo_service.update_item(
                table_name=self.table_name,
                key_pair={UserRestrictionsFields.ID.value: restriction_id},
                updated_fields=updated_fields,
                condition_expression=(
                    f"{UserRestrictionsFields.IS_ACTIVE} = :true"
                    f" AND {UserRestrictionsFields.RESTRICTED_USER} <> :user_id"
                    f" AND {UserRestrictionsFields.NHS_NUMBER} = :patient_id"
                ),
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
            logger.error(
                f"Unexpected DynamoDB error in update_restriction_inactive: "
                f"{e.response['Error']['Code']} - {e}",
            )
            raise UserRestrictionDynamoDBException(
                "An issue occurred while updating user restriction inactive",
            )

    def query_restrictions_by_nhs_number(
        self,
        nhs_number: str,
    ) -> list[UserRestriction]:
        try:
            logger.info("Building IsActive filter for DynamoDB query.")
            filter_builder = DynamoQueryFilterBuilder()
            filter_builder.add_condition(
                UserRestrictionsFields.IS_ACTIVE,
                AttributeOperator.EQUAL,
                True,
            )
            active_filter_expression = filter_builder.build()

            logger.info("Querying Restrictions by NHS Number.")
            items = self.dynamo_service.query_table(
                table_name=self.table_name,
                index_name=UserRestrictionIndexes.NHS_NUMBER_INDEX,
                search_key=UserRestrictionsFields.NHS_NUMBER,
                search_condition=nhs_number,
                query_filter=active_filter_expression,
            )

            return self._validate_restrictions(items)
        except ClientError as e:
            logger.error(e)
            raise UserRestrictionDynamoDBException(
                "An issue occurred while querying restrictions",
            )

    def update_restriction_custodian(self, restriction_id: str, updated_custodian: str):
        logger.info(f"Updating custodian for restriction: {restriction_id}")
        current_time = int(datetime.now(timezone.utc).timestamp())

        updated_fields = {
            UserRestrictionsFields.LAST_UPDATED.value: current_time,
            UserRestrictionsFields.CUSTODIAN.value: updated_custodian,
        }

        try:
            self.dynamo_service.update_item(
                table_name=self.table_name,
                key_pair={UserRestrictionsFields.ID.value: restriction_id},
                updated_fields=updated_fields,
            )
        except ClientError as e:
            logger.error(
                f"DynamoDB ClientError when updating custodian for restriction {restriction_id}: {e}",
            )
            raise UserRestrictionDynamoDBException(
                f"An issue occurred while updating restriction custodian for restriction {restriction_id}",
            ) from e

    @staticmethod
    def _build_query_filter(
        smartcard_id: str | None,
        nhs_number: str | None,
    ) -> tuple[str, dict, dict]:
        conditions = [
            {
                "field": UserRestrictionsFields.IS_ACTIVE,
                "operator": ConditionOperator.EQUAL.value,
                "value": True,
            },
        ]
        if smartcard_id:
            conditions.append(
                {
                    "field": UserRestrictionsFields.RESTRICTED_USER,
                    "operator": ConditionOperator.EQUAL.value,
                    "value": smartcard_id,
                },
            )
        if nhs_number:
            conditions.append(
                {
                    "field": UserRestrictionsFields.NHS_NUMBER,
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

    def get_active_user_restrictions_by_smartcard_and_nhs_number(
        self,
        nhs_number: str,
        smartcard_id: str,
    ) -> UserRestriction | None:
        query_filter = (
            DynamoQueryFilterBuilder()
            .add_condition(
                attribute=UserRestrictionsFields.RESTRICTED_USER,
                attr_operator=AttributeOperator.EQUAL,
                filter_value=smartcard_id,
            )
            .add_condition(
                attribute=UserRestrictionsFields.IS_ACTIVE,
                attr_operator=AttributeOperator.EQUAL,
                filter_value=True,
            )
            .build()
        )
        try:
            response = self.dynamo_service.query_table_single(
                table_name=self.table_name,
                index_name=UserRestrictionIndexes.NHS_NUMBER_INDEX,
                search_key=UserRestrictionsFields.NHS_NUMBER,
                search_condition=nhs_number,
                query_filter=query_filter,
                limit=1,
            )
        except ClientError as e:
            logger.error(f"DynamoDB ClientError when checking user restriction: {e}")
            raise UserRestrictionValidationException(
                f"Failed to check user restriction in DynamoDB: {e}",
            ) from e

        items = response.get("Items", [])
        if not items:
            return None
        return self._validate_restrictions(items)[0]

    def check_user_restriction(
        self,
        nhs_number: str,
        smartcard_id: str,
    ) -> bool:
        return (
            self.get_active_user_restrictions_by_smartcard_and_nhs_number(
                nhs_number,
                smartcard_id,
            )
            is not None
        )
