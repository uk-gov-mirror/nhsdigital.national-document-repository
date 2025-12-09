import os
from datetime import datetime
from typing import Any, Dict

import inflection
from enums.dynamo_filter import AttributeOperator
from enums.infrastructure import DynamoTables
from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCode, SnomedCodes
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import get_not_deleted_filter
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.lambda_exceptions import InvalidDocTypeException

logger = LoggingService(__name__)


def create_expressions(requested_fields: list) -> tuple[str, dict]:
    """
    Creates expression components for a dynamo query
        :param requested_fields: List of enum fields names

    example usage:
        requested_fields = ["ID", "Created", "FileName"]
        projection_expression, expression_attribute_names = create_expressions(requested_fields)

    result:
        [
            "#ID_attr,#Created_attr,#FileName_attr",
            {"#ID_attr": "ID", "#Created_attr": "Created", "#FileName_attr": "FileName"}
        ]
    """
    projection_expression = ""
    expression_attribute_names = {}

    for field_definition in requested_fields:
        field_placeholder = create_expression_attribute_placeholder(field_definition)
        if len(projection_expression) > 0:
            projection_expression = f"{projection_expression},{field_placeholder}"
        else:
            projection_expression = field_placeholder

        expression_attribute_names[field_placeholder] = field_definition
    return projection_expression, expression_attribute_names


def create_update_expression(field_names: list) -> str:
    """
    Creates an expression for dynamodb queries to SET a new value for an item
        :param field_names: List of fields to update

    example usage:
        field_names = ["Name", "Age"...]
        fields_filter = create_update_expression(field_names)

    result:
        "SET #Name_attr = :Name_val, #Age_attr = :Age_val"

    """
    update_expression = "SET"
    for field in field_names:
        expression = f" {create_expression_attribute_placeholder(field)} = {create_expression_value_placeholder(field)}"
        if update_expression == "SET":
            update_expression += expression
        else:
            update_expression += f",{expression}"

    return update_expression


def create_expression_attribute_values(attribute_field_values: dict) -> dict:
    """
    Maps a dict of expression names and expression values to create a dictionary to pass into query
        :param attribute_field_values: Dictionary of attribute field names and values

    example usage:
        attribute_field_values = {
                DocumentReferenceMetadataFields.DELETED.value: "",
                DocumentReferenceMetadataFields.FILENAME.value: "Test Filename"
            }
        expression_attribute_values = create_expression_attribute_values(attribute_field_values)

    result:
        {
            ":Deleted_val" : ""
            ":FileName_val" : "Test Filename"
        }
    """
    expression_attribute_values = {}
    for field_name, field_value in attribute_field_values.items():
        expression_attribute_values[
            f"{create_expression_value_placeholder(field_name)}"
        ] = field_value

    return expression_attribute_values


def create_expression_value_placeholder(value: str, suffix: str = "") -> str:
    """
    Creates a placeholder value for an expression attribute name
        :param value: Value to change into a placeholder
        :param suffix: Optional suffix to add before "_val" (e.g. "_condition")

    Example usage:
        placeholder = create_expression_value_placeholder("VirusScanResult")
        # Result: ":VirusScanResult_val"
        placeholder = create_expression_value_placeholder("VirusScanResult", "_condition")
        # Result: ":VirusScanResult_condition_val"
    """
    camelized = inflection.camelize(value, uppercase_first_letter=True)
    return f":{camelized}{suffix}_val"


def create_expression_attribute_placeholder(value: str) -> str:
    """
    Creates a placeholder value for a projection attribute name
        :param value: Value to change into a placeholder

    example usage:
        placeholder = create_expression_attribute_placeholder("VirusScanResult")

    result:
        "#VirusScanResult_attr"
    """
    return f"#{inflection.camelize(value, uppercase_first_letter=True)}_attr"


def filter_uploaded_docs_and_recently_uploading_docs():
    filter_builder = DynamoQueryFilterBuilder()
    time_limit = int(datetime.now().timestamp() - (60 * 3))

    delete_filter_expression = get_not_deleted_filter(filter_builder)

    filter_builder.add_condition("Uploaded", AttributeOperator.EQUAL, True)
    uploaded_filter_expression = filter_builder.build()

    filter_builder.add_condition(
        "Uploading", AttributeOperator.EQUAL, True
    ).add_condition("LastUpdated", AttributeOperator.GREATER_OR_EQUAL, time_limit)
    uploading_filter_expression = filter_builder.build()

    return delete_filter_expression & (
        uploaded_filter_expression | uploading_filter_expression
    )


def parse_dynamo_record(dynamodb_record: Dict[str, Any]) -> Dict[str, Any]:
    result = {}
    for key, value in dynamodb_record.items():
        match value:
            case {"S": str(s)}:
                result[key] = s
            case {"N": str(n)}:
                result[key] = int(n)
            case {"BOOL": bool(b)}:
                result[key] = b
            case _:
                raise ValueError(f"Unsupported DynamoDB type for key {key}: {value}")
    return result


def build_mixed_condition_expression(
    conditions: list[dict[str, Any]],
    join_operator: str = "AND",
    suffix: str = "_condition",
) -> tuple[str, dict[str, str], dict[str, Any]]:
    """
    Build a condition expression with mixed operators and conditions.

    Args:
        conditions: List of condition dictionaries, each with:
                   - "field": field name
                   - "operator": comparison operator or "attribute_exists"/"attribute_not_exists"
                   - "value": value to compare (not needed for existence checks)
                   Example: [
                       {"field": "DocStatus", "operator": "=", "value": "final"},
                       {"field": "Deleted", "operator": "attribute_not_exists"}
                   ]
        join_operator: Logical operator to join conditions (default: "AND")
        suffix: Suffix to add to value placeholders (default: "_condition")

    Returns:
        Tuple of (condition_expression, expression_attribute_names, expression_attribute_values)
    """
    condition_expressions = []
    condition_attribute_names = {}
    condition_attribute_values = {}

    for condition in conditions:
        field_name = condition["field"]
        operator = condition["operator"]
        field_value = condition.get("value")

        condition_placeholder = create_expression_attribute_placeholder(field_name)
        condition_attribute_names[condition_placeholder] = field_name

        if operator in ["attribute_exists", "attribute_not_exists"]:
            condition_expressions.append(f"{operator}({condition_placeholder})")
        else:
            condition_value_placeholder = create_expression_value_placeholder(
                field_name, suffix
            )
            condition_expressions.append(
                f"{condition_placeholder} {operator} {condition_value_placeholder}"
            )
            condition_attribute_values[condition_value_placeholder] = field_value

    condition_expression = f" {join_operator} ".join(condition_expressions)

    return condition_expression, condition_attribute_names, condition_attribute_values


def build_general_transaction_item(
    table_name: str,
    action: str,
    key: dict | None = None,
    item: dict | None = None,
    update_expression: str | None = None,
    condition_expression: str | None = None,
    expression_attribute_names: dict | None = None,
    expression_attribute_values: dict | None = None,
) -> dict[str, dict[str, Any]]:
    """
    Build a general DynamoDB transaction item for any action type.
    All expressions and attributes must be pre-formatted.

    Args:
        table_name: The name of the DynamoDB table
        action: Transaction action type ('Put', 'Update', 'Delete', 'ConditionCheck')
        key: The primary key of the item (required for Update, Delete, ConditionCheck)
        item: The complete item to put (required for Put)
        update_expression: Pre-formatted update expression (optional for Update)
        condition_expression: Pre-formatted condition expression (optional)
        expression_attribute_names: Pre-formatted expression attribute names (optional)
        expression_attribute_values: Pre-formatted expression attribute values (optional)

    Returns:
        A transaction item dict ready for transact_write_items

    Raises:
        ValueError: If required parameters are missing for the specified action
    """
    action = action.capitalize()

    if action not in ["Put", "Update", "Delete", "Conditioncheck"]:
        raise ValueError(
            f"Invalid action: {action}. Must be one of: Put, Update, Delete, ConditionCheck"
        )

    transaction_item: dict[str, dict[str, Any]] = {action: {"TableName": table_name}}

    if action == "Put":
        if item is None:
            raise ValueError("'item' is required for Put action")
        transaction_item[action]["Item"] = item

    elif action == "Update":
        if key is None:
            raise ValueError("'key' is required for Update action")
        transaction_item[action]["Key"] = key
        if update_expression:
            transaction_item[action]["UpdateExpression"] = update_expression

    elif action in ["Delete", "Conditioncheck"]:
        if key is None:
            raise ValueError(f"'key' is required for {action} action")
        transaction_item[action]["Key"] = key

    if condition_expression:
        transaction_item[action]["ConditionExpression"] = condition_expression

    if expression_attribute_names:
        transaction_item[action][
            "ExpressionAttributeNames"
        ] = expression_attribute_names

    if expression_attribute_values:
        transaction_item[action][
            "ExpressionAttributeValues"
        ] = expression_attribute_values

    return transaction_item


def build_transaction_item(
    table_name: str,
    action: str,
    key: dict | None = None,
    item: dict | None = None,
    update_fields: dict | None = None,
    conditions: list[dict] | None = None,
    condition_join_operator: str = "AND",
) -> dict:
    update_expression = None
    condition_expression = None
    expression_attribute_names = {}
    expression_attribute_values = {}

    if action.lower() == "update" and update_fields:
        field_names = list(update_fields.keys())
        update_expression = create_update_expression(field_names)
        _, update_attr_names = create_expressions(field_names)
        update_attr_values = create_expression_attribute_values(update_fields)

        expression_attribute_names.update(update_attr_names)
        expression_attribute_values.update(update_attr_values)

    if conditions:
        condition_expr, condition_attr_names, condition_attr_values = (
            build_mixed_condition_expression(conditions, condition_join_operator)
        )
        condition_expression = condition_expr
        expression_attribute_names.update(condition_attr_names)
        expression_attribute_values.update(condition_attr_values)

    return build_general_transaction_item(
        table_name=table_name,
        action=action,
        key=key,
        item=item,
        update_expression=update_expression,
        condition_expression=condition_expression,
        expression_attribute_names=expression_attribute_names or None,
        expression_attribute_values=expression_attribute_values or None,
    )


class DocTypeTableRouter:
    def __init__(self):
        self._define_tables()
        self.mapping = {
            SnomedCodes.LLOYD_GEORGE.value.code: self.lg_dynamo_table,
            SnomedCodes.PATIENT_DATA.value.code: self.core_dynamo_table,
        }

    def _define_tables(self):
        self.lg_dynamo_table = DynamoTables.LLOYD_GEORGE
        self.pdm_dynamo_table = DynamoTables.PDM
        self.core_dynamo_table = DynamoTables.CORE

    def resolve(self, doc_type: SnomedCode) -> str:
        try:
            table = self.mapping[doc_type.code]
            return str(table)
        except KeyError:
            logger.error(
                f"SNOMED code {doc_type.code} - {doc_type.display_name} is not supported"
            )
            raise InvalidDocTypeException(400, LambdaError.DocTypeDB)
