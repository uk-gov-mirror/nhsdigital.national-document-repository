import json
from copy import deepcopy

import pytest
from enums.lambda_error import LambdaError
from enums.metadata_field_names import DocumentReferenceMetadataFields
from tests.unit.conftest import (
    MOCK_TABLE_NAME,
    TEST_CURRENT_GP_ODS,
    TEST_DOCUMENT_LOCATION,
    TEST_FILE_KEY,
    TEST_NHS_NUMBER,
    TEST_UUID,
    WORKSPACE,
)
from tests.unit.helpers.data.dynamo.dynamo_stream import (
    MOCK_OLD_IMAGE_EVENT,
    MOCK_OLD_IMAGE_MODEL,
)
from utils.dynamo_utils import (
    DocTypeTableRouter,
    build_general_transaction_item,
    build_mixed_condition_expression,
    build_transaction_item,
    create_expression_attribute_placeholder,
    create_expression_attribute_values,
    create_expression_value_placeholder,
    create_expressions,
    create_update_expression,
    deserialize_dynamodb_object,
    parse_dynamo_record,
    serialize_dict_to_dynamodb_object,
)
from utils.lambda_exceptions import InvalidDocTypeException

from lambdas.enums.snomed_codes import SnomedCodes

MOCK_PYTHON_DICT = {
    "test_string": "hello",
    "test_int": 123,
    "test_bool": True,
    "test_list": [1, 2, 3],
    "test_dict": {"key1": "value1", "key2": 1},
    "test_list_of_dicts": [{"key1": "value1"}, {"key2": 2}],
}

MOCK_DYNAMO_DB_OBJECT = {
    "test_string": {"S": "hello"},
    "test_int": {"N": "123"},
    "test_bool": {"BOOL": True},
    "test_list": {"L": [{"N": "1"}, {"N": "2"}, {"N": "3"}]},
    "test_dict": {"M": {"key1": {"S": "value1"}, "key2": {"N": "1"}}},
    "test_list_of_dicts": {
        "L": [{"M": {"key1": {"S": "value1"}}}, {"M": {"key2": {"N": "2"}}}]
    },
}


def test_create_expressions_correctly_creates_an_expression_of_one_field():
    expected_projection = "#VirusScannerResult_attr"
    expected_expr_attr_names = {"#VirusScannerResult_attr": "VirusScannerResult"}

    fields_requested = [DocumentReferenceMetadataFields.VIRUS_SCANNER_RESULT.value]

    actual_projection, actual_expr_attr_names = create_expressions(fields_requested)

    assert actual_projection == expected_projection
    assert actual_expr_attr_names == expected_expr_attr_names


def test_create_expressions_correctly_creates_an_expression_of_multiple_fields():
    expected_projection = "#NhsNumber_attr,#FileLocation_attr,#ContentType_attr"
    expected_expr_attr_names = {
        "#NhsNumber_attr": "NhsNumber",
        "#FileLocation_attr": "FileLocation",
        "#ContentType_attr": "ContentType",
    }

    fields_requested = [
        DocumentReferenceMetadataFields.NHS_NUMBER.value,
        DocumentReferenceMetadataFields.FILE_LOCATION.value,
        DocumentReferenceMetadataFields.CONTENT_TYPE.value,
    ]

    actual_projection, actual_expr_attr_names = create_expressions(fields_requested)

    assert actual_projection == expected_projection
    assert actual_expr_attr_names == expected_expr_attr_names


def test_create_expression_attribute_values():
    attribute_field_values = {
        DocumentReferenceMetadataFields.DELETED.value: "True",
        DocumentReferenceMetadataFields.VIRUS_SCANNER_RESULT.value: "Scanned",
    }
    expected = {":Deleted_val": "True", ":VirusScannerResult_val": "Scanned"}

    actual = create_expression_attribute_values(attribute_field_values)

    assert actual == expected


def test_create_update_expression_multiple_values():
    field_names = ["Deleted", "VirusScannerResult"]
    expected = "SET #Deleted_attr = :Deleted_val, #VirusScannerResult_attr = :VirusScannerResult_val"

    actual = create_update_expression(field_names)

    assert actual == expected


def test_create_update_expression_singular_value():
    field_names = ["Deleted"]
    expected = "SET #Deleted_attr = :Deleted_val"

    actual = create_update_expression(field_names)

    assert actual == expected


def test_create_expression_value_placeholder_capital_camel_case():
    test_value = "VirusScannerResult"
    expected = ":VirusScannerResult_val"

    actual = create_expression_value_placeholder(test_value)

    assert actual == expected


def test_create_expression_value_placeholder_camel_case():
    test_value = "virusScannerResult"
    expected = ":VirusScannerResult_val"

    actual = create_expression_value_placeholder(test_value)

    assert actual == expected


def test_create_expression_attribute_placeholder_capital_camel_case():
    test_value = "VirusScannerResult"
    expected = "#VirusScannerResult_attr"

    actual = create_expression_attribute_placeholder(test_value)

    assert actual == expected


def test_create_expression_attribute_placeholder_camel_case():
    test_value = "virusScannerResult"
    expected = "#VirusScannerResult_attr"

    actual = create_expression_attribute_placeholder(test_value)

    assert actual == expected


def test_parse_dynamo_record_parses_correctly():
    test_data = MOCK_OLD_IMAGE_EVENT
    test_image = MOCK_OLD_IMAGE_MODEL

    expected = {
        "ContentType": test_image.content_type,
        "FileName": TEST_FILE_KEY,
        "Uploading": test_image.uploading,
        "TTL": test_image.ttl,
        "Created": test_image.created,
        "Uploaded": test_image.uploaded,
        "FileLocation": TEST_DOCUMENT_LOCATION,
        "CurrentGpOds": TEST_CURRENT_GP_ODS,
        "VirusScannerResult": test_image.virus_scanner_result,
        "Deleted": test_image.deleted,
        "ID": TEST_UUID,
        "LastUpdated": test_image.last_updated,
        "NhsNumber": TEST_NHS_NUMBER,
    }

    actual = parse_dynamo_record(test_data)

    assert actual == expected


@pytest.mark.parametrize(
    "test_json_string",
    [
        '{"Test": {"BOOL": "Not Bool"}}',
        '{"Test": {"N": "Not Integer"}}',
    ],
)
def test_parse_dynamo_record_raises_value_error(test_json_string):
    test_object = json.loads(test_json_string)

    with pytest.raises(ValueError):
        parse_dynamo_record(test_object)


@pytest.mark.parametrize(
    "doc_type, expected_suffix",
    [
        (SnomedCodes.LLOYD_GEORGE.value, "LloydGeorgeReferenceMetadata"),
        (SnomedCodes.PATIENT_DATA.value, "COREDocumentMetadata"),
    ],
)
def test_dynamo_table_mapping(set_env, doc_type, expected_suffix):
    router = DocTypeTableRouter()
    table = router.resolve(doc_type)

    assert table == f"{WORKSPACE}_{expected_suffix}"


@pytest.mark.parametrize(
    "doc_type",
    [
        SnomedCodes.GENERAL_MEDICAL_PRACTICE.value,
    ],
)
def test_dynamo_table_mapping_fails(set_env, doc_type):
    table_router = DocTypeTableRouter()
    with pytest.raises(InvalidDocTypeException) as excinfo:
        table_router.resolve(doc_type)

    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocTypeDB


def test_create_expression_value_placeholder_with_suffix():
    test_value = "VirusScannerResult"
    expected = ":VirusScannerResult_condition_val"

    actual = create_expression_value_placeholder(test_value, "_condition")

    assert actual == expected


def test_create_expression_value_placeholder_with_empty_suffix():
    test_value = "VirusScannerResult"
    expected = ":VirusScannerResult_val"

    actual = create_expression_value_placeholder(test_value, "")

    assert actual == expected


def test_build_mixed_condition_expression_single_condition():
    conditions = [{"field": "DocStatus", "operator": "=", "value": "final"}]
    expected_expr = "#DocStatus_attr = :DocStatus_condition_val"
    expected_names = {"#DocStatus_attr": "DocStatus"}
    expected_values = {":DocStatus_condition_val": "final"}

    actual_expr, actual_names, actual_values = build_mixed_condition_expression(
        conditions
    )

    assert actual_expr == expected_expr
    assert actual_names == expected_names
    assert actual_values == expected_values


def test_build_mixed_condition_expression_mixed_operators():
    conditions = [
        {"field": "DocStatus", "operator": "=", "value": "final"},
        {"field": "Deleted", "operator": "attribute_not_exists"},
        {"field": "Version", "operator": ">", "value": 0},
    ]
    expected_names = {
        "#DocStatus_attr": "DocStatus",
        "#Deleted_attr": "Deleted",
        "#Version_attr": "Version",
    }
    expected_values = {":DocStatus_condition_val": "final", ":Version_condition_val": 0}

    actual_expr, actual_names, actual_values = build_mixed_condition_expression(
        conditions
    )

    assert "#DocStatus_attr = :DocStatus_condition_val" in actual_expr
    assert "attribute_not_exists(#Deleted_attr)" in actual_expr
    assert "#Version_attr > :Version_condition_val" in actual_expr
    assert " AND " in actual_expr
    assert actual_names == expected_names
    assert actual_values == expected_values


def test_build_mixed_condition_expression_with_custom_suffix():
    conditions = [{"field": "Status", "operator": "=", "value": "active"}]
    expected_expr = "#Status_attr = :Status_update_val"
    expected_names = {"#Status_attr": "Status"}
    expected_values = {":Status_update_val": "active"}

    actual_expr, actual_names, actual_values = build_mixed_condition_expression(
        conditions, suffix="_update"
    )

    assert actual_expr == expected_expr
    assert actual_names == expected_names
    assert actual_values == expected_values


def test_build_general_transaction_item_put_action():
    table_name = MOCK_TABLE_NAME
    item = {"ID": "test_id", "FileName": "test.pdf", "Status": "active"}

    result = build_general_transaction_item(
        table_name=table_name, action="Put", item=item
    )

    assert "Put" in result
    put_item = result["Put"]
    assert put_item["TableName"] == table_name
    assert put_item["Item"] == item
    assert "ConditionExpression" not in put_item


def test_build_general_transaction_item_put_with_condition():
    table_name = MOCK_TABLE_NAME
    item = {"ID": "test_id", "FileName": "test.pdf"}
    conditions = [
        {"field": "Version", "operator": "=", "value": 5},
        {"field": "Deleted", "operator": "attribute_not_exists"},
        {"field": "Status", "operator": "<>", "value": "archived"},
    ]

    condition_expr, attr_names, attr_values = build_mixed_condition_expression(
        conditions
    )

    result = build_general_transaction_item(
        table_name=table_name,
        action="Put",
        item=item,
        condition_expression=condition_expr,
        expression_attribute_names=attr_names,
        expression_attribute_values=attr_values,
    )

    assert "Put" in result
    put_item = result["Put"]
    assert put_item["TableName"] == table_name
    assert put_item["Item"] == item

    condition_expr = put_item["ConditionExpression"]
    assert "#Version_attr = :Version_condition_val" in condition_expr
    assert "attribute_not_exists(#Deleted_attr)" in condition_expr
    assert "#Status_attr <> :Status_condition_val" in condition_expr
    assert " AND " in condition_expr

    assert put_item["ExpressionAttributeNames"]["#Version_attr"] == "Version"
    assert put_item["ExpressionAttributeNames"]["#Deleted_attr"] == "Deleted"
    assert put_item["ExpressionAttributeNames"]["#Status_attr"] == "Status"

    assert put_item["ExpressionAttributeValues"][":Version_condition_val"] == 5
    assert put_item["ExpressionAttributeValues"][":Status_condition_val"] == "archived"


def test_build_general_transaction_item_update_action():
    table_name = MOCK_TABLE_NAME
    key = {"ID": "test_id"}
    update_fields = {"FileName": "updated.pdf", "Status": "completed"}

    field_names = list(update_fields.keys())
    update_expr = create_update_expression(field_names)
    _, attr_names = create_expressions(field_names)
    attr_values = create_expression_attribute_values(update_fields)

    result = build_general_transaction_item(
        table_name=table_name,
        action="Update",
        key=key,
        update_expression=update_expr,
        expression_attribute_names=attr_names,
        expression_attribute_values=attr_values,
    )

    assert "Update" in result
    update_item = result["Update"]
    assert update_item["TableName"] == table_name
    assert update_item["Key"] == key
    assert "SET" in update_item["UpdateExpression"]
    assert "#FileName_attr" in update_item["UpdateExpression"]
    assert "#Status_attr" in update_item["UpdateExpression"]
    assert update_item["ExpressionAttributeNames"]["#FileName_attr"] == "FileName"
    assert update_item["ExpressionAttributeNames"]["#Status_attr"] == "Status"
    assert update_item["ExpressionAttributeValues"][":FileName_val"] == "updated.pdf"
    assert update_item["ExpressionAttributeValues"][":Status_val"] == "completed"


def test_build_general_transaction_item_update_with_condition():
    """Test Update action with both update expression and condition"""
    table_name = MOCK_TABLE_NAME
    key = {"ID": "test_id"}
    update_fields = {"Status": "completed"}
    conditions = [{"field": "Status", "operator": "=", "value": "pending"}]

    field_names = list(update_fields.keys())
    update_expr = create_update_expression(field_names)
    _, update_attr_names = create_expressions(field_names)
    update_attr_values = create_expression_attribute_values(update_fields)

    condition_expr, condition_attr_names, condition_attr_values = (
        build_mixed_condition_expression(conditions)
    )

    merged_names = {**update_attr_names, **condition_attr_names}
    merged_values = {**update_attr_values, **condition_attr_values}

    result = build_general_transaction_item(
        table_name=table_name,
        action="Update",
        key=key,
        update_expression=update_expr,
        condition_expression=condition_expr,
        expression_attribute_names=merged_names,
        expression_attribute_values=merged_values,
    )

    assert "Update" in result
    update_item = result["Update"]
    assert update_item["ConditionExpression"] == condition_expr
    assert ":Status_val" in str(update_item["ExpressionAttributeValues"])
    assert ":Status_condition_val" in str(update_item["ExpressionAttributeValues"])


def test_build_general_transaction_item_delete_with_condition():
    """Test Delete action with condition expression"""
    table_name = MOCK_TABLE_NAME
    key = {"ID": "test_id"}
    conditions = [{"field": "Status", "operator": "=", "value": "archived"}]

    condition_expr, attr_names, attr_values = build_mixed_condition_expression(
        conditions
    )

    result = build_general_transaction_item(
        table_name=table_name,
        action="Delete",
        key=key,
        condition_expression=condition_expr,
        expression_attribute_names=attr_names,
        expression_attribute_values=attr_values,
    )

    assert "Delete" in result
    delete_item = result["Delete"]
    assert delete_item["ConditionExpression"] == condition_expr
    assert delete_item["ExpressionAttributeNames"] == attr_names
    assert delete_item["ExpressionAttributeValues"] == attr_values


def test_build_general_transaction_item_put_without_item():
    table_name = MOCK_TABLE_NAME

    with pytest.raises(ValueError):
        build_general_transaction_item(table_name=table_name, action="Put")


def test_build_general_transaction_item_update_without_key():
    table_name = MOCK_TABLE_NAME
    update_fields = {"Status": "completed"}

    field_names = list(update_fields.keys())
    update_expr = create_update_expression(field_names)
    _, attr_names = create_expressions(field_names)
    attr_values = create_expression_attribute_values(update_fields)

    with pytest.raises(ValueError):
        build_general_transaction_item(
            table_name=table_name,
            action="Update",
            update_expression=update_expr,
            expression_attribute_names=attr_names,
            expression_attribute_values=attr_values,
        )


def test_build_transaction_item_put_action():
    table_name = MOCK_TABLE_NAME
    item = {"ID": "test_id", "Name": "Test Name", "Status": "active"}

    result = build_transaction_item(table_name=table_name, action="Put", item=item)

    assert "Put" in result
    put_item = result["Put"]
    assert put_item["TableName"] == table_name
    assert put_item["Item"] == item
    assert "ConditionExpression" not in put_item


def test_build_transaction_item_update_with_fields_and_conditions():
    """Test Update action with both update fields and conditions"""
    table_name = MOCK_TABLE_NAME
    key = {"ID": "test_id"}
    update_fields = {"Status": "completed", "LastUpdated": 1234567890}
    conditions = [
        {"field": "Status", "operator": "=", "value": "pending"},
        {"field": "Deleted", "operator": "attribute_not_exists"},
    ]

    result = build_transaction_item(
        table_name=table_name,
        action="Update",
        key=key,
        update_fields=update_fields,
        conditions=conditions,
        condition_join_operator="AND",
    )

    assert "Update" in result
    update_item = result["Update"]
    assert update_item["TableName"] == table_name
    assert update_item["Key"] == key
    assert "UpdateExpression" in update_item
    assert "SET" in update_item["UpdateExpression"]
    assert "#Status_attr" in update_item["UpdateExpression"]
    assert "#LastUpdated_attr" in update_item["UpdateExpression"]
    assert "ConditionExpression" in update_item
    assert "attribute_not_exists" in update_item["ConditionExpression"]
    assert update_item["ExpressionAttributeNames"]["#Status_attr"] == "Status"
    assert update_item["ExpressionAttributeNames"]["#Deleted_attr"] == "Deleted"
    assert update_item["ExpressionAttributeValues"][":Status_val"] == "completed"
    assert (
        update_item["ExpressionAttributeValues"][":Status_condition_val"] == "pending"
    )


def test_build_transaction_item_delete_with_conditions():
    table_name = MOCK_TABLE_NAME
    key = {"ID": "test_id"}
    conditions = [
        {"field": "Status", "operator": "=", "value": "archived"},
        {"field": "Expired", "operator": "=", "value": True},
    ]

    result = build_transaction_item(
        table_name=table_name,
        action="Delete",
        key=key,
        conditions=conditions,
        condition_join_operator="OR",
    )

    assert "Delete" in result
    delete_item = result["Delete"]
    assert delete_item["TableName"] == table_name
    assert delete_item["Key"] == key
    assert "ConditionExpression" in delete_item
    assert " OR " in delete_item["ConditionExpression"]
    assert "#Status_attr" in delete_item["ConditionExpression"]
    assert "#Expired_attr" in delete_item["ConditionExpression"]
    assert delete_item["ExpressionAttributeNames"]["#Status_attr"] == "Status"
    assert delete_item["ExpressionAttributeNames"]["#Expired_attr"] == "Expired"
    assert (
        delete_item["ExpressionAttributeValues"][":Status_condition_val"] == "archived"
    )
    assert delete_item["ExpressionAttributeValues"][":Expired_condition_val"] is True


def test_serialize_dict_to_dynamodb_object():
    input = MOCK_PYTHON_DICT

    expected = MOCK_DYNAMO_DB_OBJECT
    actual = serialize_dict_to_dynamodb_object(input)
    assert actual == expected


def test_deserialize_dynamodb_object():
    input = MOCK_DYNAMO_DB_OBJECT
    expected = MOCK_PYTHON_DICT

    actual = deserialize_dynamodb_object(input)
    assert actual == expected


def test_serialize_dynamodb_object_throws_error_unsupported_data_type():
    unsupported_input = deepcopy(MOCK_PYTHON_DICT)
    unsupported_input.update({"float": 1.23})

    with pytest.raises(TypeError):
        serialize_dict_to_dynamodb_object(unsupported_input)
