import copy
from unittest.mock import MagicMock, call

import pytest
from boto3.dynamodb.conditions import And, Attr, Equals, Key
from botocore.exceptions import ClientError
from enums.dynamo_filter import AttributeOperator
from enums.metadata_field_names import DocumentReferenceMetadataFields
from services.base.dynamo_service import DynamoDBService
from tests.unit.conftest import MOCK_CLIENT_ERROR, MOCK_TABLE_NAME, TEST_NHS_NUMBER
from tests.unit.helpers.data.dynamo.dynamo_responses import MOCK_SEARCH_RESPONSE
from tests.unit.helpers.data.dynamo.dynamo_scan_response import (
    EXPECTED_ITEMS_FOR_PAGINATED_RESULTS,
    MOCK_PAGINATED_RESPONSE_1,
    MOCK_PAGINATED_RESPONSE_2,
    MOCK_PAGINATED_RESPONSE_3,
    MOCK_RESPONSE,
    MOCK_RESPONSE_WITH_LAST_KEY,
)
from tests.unit.helpers.data.search_document_review.dynamo_response import (
    MOCK_DOCUMENT_REVIEW_PAGINATOR_RESPONSE,
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE,
)
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.dynamo_utils import (
    build_mixed_condition_expression,
    serialize_dict_to_dynamodb_object,
)
from utils.exceptions import DynamoServiceException


@pytest.fixture
def mock_service(set_env, mocker):
    mocker.patch("boto3.resource")
    mock_client = MagicMock()
    service = DynamoDBService()
    mocker.patch.object(service, "client", return_value=mock_client)
    yield service
    DynamoDBService.instance = None


@pytest.fixture
def mock_dynamo_service(mocker, mock_service):
    dynamo = mocker.patch.object(mock_service, "dynamodb")
    yield dynamo


@pytest.fixture
def mock_table(mocker, mock_service):
    yield mocker.patch.object(mock_service, "get_table")


@pytest.fixture
def mock_scan_method(mock_table):
    table_instance = mock_table.return_value
    scan_method = table_instance.scan
    yield scan_method


@pytest.fixture
def mock_query_method(mock_table):
    table_instance = mock_table.return_value
    query_method = table_instance.query
    yield query_method


@pytest.fixture
def mock_filter_expression():
    filter_builder = DynamoQueryFilterBuilder()
    filter_expression = filter_builder.add_condition(
        attribute=str(DocumentReferenceMetadataFields.DELETED.value),
        attr_operator=AttributeOperator.EQUAL,
        filter_value="",
    ).build()
    yield filter_expression


def mock_scan_implementation(**kwargs):
    key = kwargs.get("ExclusiveStartKey")
    if not key:
        return copy.deepcopy(MOCK_PAGINATED_RESPONSE_1)
    elif key.get("ID") == "id_token_for_page_2":
        return copy.deepcopy(MOCK_PAGINATED_RESPONSE_2)
    elif key.get("ID") == "id_token_for_page_3":
        return copy.deepcopy(MOCK_PAGINATED_RESPONSE_3)
    return None


def test_query_with_requested_fields_returns_items_from_dynamo(
    mock_service, mock_table
):
    search_key_obj = Key("NhsNumber").eq(TEST_NHS_NUMBER)
    expected_projection = "FileName,Created"

    mock_table.return_value.query.return_value = MOCK_SEARCH_RESPONSE
    expected = MOCK_SEARCH_RESPONSE["Items"]

    actual = mock_service.query_table(
        table_name=MOCK_TABLE_NAME,
        index_name="NhsNumberIndex",
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
        requested_fields=[
            DocumentReferenceMetadataFields.FILE_NAME.value,
            DocumentReferenceMetadataFields.CREATED.value,
        ],
    )

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.query.assert_called_once_with(
        IndexName="NhsNumberIndex",
        KeyConditionExpression=search_key_obj,
        ProjectionExpression=expected_projection,
    )

    assert expected == actual


def test_query_with_requested_fields_with_filter_returns_items_from_dynamo(
    mock_service, mock_table, mock_filter_expression
):
    search_key_obj = Key("NhsNumber").eq(TEST_NHS_NUMBER)
    expected_projection = "FileName,Created"
    expected_filter = Attr("Deleted").eq("")

    mock_table.return_value.query.return_value = MOCK_SEARCH_RESPONSE
    expected = MOCK_SEARCH_RESPONSE["Items"]

    actual = mock_service.query_table(
        table_name=MOCK_TABLE_NAME,
        index_name="NhsNumberIndex",
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
        requested_fields=[
            DocumentReferenceMetadataFields.FILE_NAME.value,
            DocumentReferenceMetadataFields.CREATED.value,
        ],
        query_filter=mock_filter_expression,
    )

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.query.assert_called_once_with(
        IndexName="NhsNumberIndex",
        KeyConditionExpression=search_key_obj,
        ProjectionExpression=expected_projection,
        FilterExpression=expected_filter,
    )

    assert expected == actual


def test_query_by_index_handles_pagination(
    mock_service, mock_table, mock_filter_expression
):
    mock_table.return_value.query.side_effect = [
        MOCK_PAGINATED_RESPONSE_1,
        MOCK_PAGINATED_RESPONSE_2,
        MOCK_PAGINATED_RESPONSE_3,
    ]
    expected_result = EXPECTED_ITEMS_FOR_PAGINATED_RESULTS
    search_key_obj = Key("NhsNumber").eq(TEST_NHS_NUMBER)

    expected_calls = [
        call(
            KeyConditionExpression=search_key_obj,
        ),
        call(
            KeyConditionExpression=search_key_obj,
            ExclusiveStartKey={"ID": "id_token_for_page_2"},
        ),
        call(
            KeyConditionExpression=search_key_obj,
            ExclusiveStartKey={"ID": "id_token_for_page_3"},
        ),
    ]

    actual = mock_service.query_table(
        table_name=MOCK_TABLE_NAME,
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
    )
    assert expected_result == actual
    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.query.assert_has_calls(expected_calls)


def test_query_by_index_handles_limits(
    mock_service, mock_filter_expression, mock_query_method
):

    mock_query_method.side_effect = [MOCK_PAGINATED_RESPONSE_1]

    expected_result = MOCK_PAGINATED_RESPONSE_1

    actual = mock_service.query_table_single(
        table_name=MOCK_TABLE_NAME,
        search_key="NhsNumber",
        index_name="NhsNumberIndex",
        search_condition=TEST_NHS_NUMBER,
        limit=4,
    )
    assert expected_result == actual


def test_query_table_single_returns_full_response(mock_service, mock_query_method):
    mock_query_method.return_value = MOCK_RESPONSE_WITH_LAST_KEY
    search_key_obj = Key("NhsNumber").eq(TEST_NHS_NUMBER)

    actual = mock_service.query_table_single(
        table_name=MOCK_TABLE_NAME,
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
    )

    assert actual == MOCK_RESPONSE_WITH_LAST_KEY
    assert "Items" in actual
    assert "LastEvaluatedKey" in actual
    mock_query_method.assert_called_once_with(
        KeyConditionExpression=search_key_obj,
    )


def test_query_table_single_with_all_parameters(
    mock_service, mock_query_method, mock_filter_expression
):
    mock_query_method.return_value = MOCK_RESPONSE
    search_key_obj = Key("NhsNumber").eq(TEST_NHS_NUMBER)
    start_key = {"ID": "test_start_key"}
    requested_fields = ["FileName", "Created"]

    actual = mock_service.query_table_single(
        table_name=MOCK_TABLE_NAME,
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
        index_name="NhsNumberIndex",
        requested_fields=requested_fields,
        query_filter=mock_filter_expression,
        limit=10,
        start_key=start_key,
    )

    assert actual == MOCK_RESPONSE
    mock_query_method.assert_called_once_with(
        KeyConditionExpression=search_key_obj,
        IndexName="NhsNumberIndex",
        ProjectionExpression="FileName,Created",
        FilterExpression=mock_filter_expression,
        Limit=10,
        ExclusiveStartKey=start_key,
    )


def test_query_table_single_with_start_key_for_pagination(
    mock_service, mock_query_method
):
    mock_query_method.return_value = MOCK_PAGINATED_RESPONSE_2
    search_key_obj = Key("NhsNumber").eq(TEST_NHS_NUMBER)
    start_key = {"ID": "id_token_for_page_2"}

    actual = mock_service.query_table_single(
        table_name=MOCK_TABLE_NAME,
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
        start_key=start_key,
    )

    assert actual == MOCK_PAGINATED_RESPONSE_2
    mock_query_method.assert_called_once_with(
        KeyConditionExpression=search_key_obj,
        ExclusiveStartKey=start_key,
    )


def test_query_table_single_client_error_raises_exception(
    mock_service, mock_query_method
):
    mock_query_method.side_effect = MOCK_CLIENT_ERROR

    with pytest.raises(ClientError) as actual_response:
        mock_service.query_table_single(
            table_name=MOCK_TABLE_NAME,
            search_key="NhsNumber",
            search_condition=TEST_NHS_NUMBER,
        )

    assert actual_response.value == MOCK_CLIENT_ERROR


def test_query_table_calls_query_table_single_and_returns_items_list(
    mock_service, mocker
):
    mock_query_table_single = mocker.patch.object(
        mock_service, "query_table_single", return_value=MOCK_RESPONSE
    )

    actual = mock_service.query_table(
        table_name=MOCK_TABLE_NAME,
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
    )

    assert actual == MOCK_RESPONSE["Items"]
    mock_query_table_single.assert_called_once_with(
        table_name=MOCK_TABLE_NAME,
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
        index_name=None,
        requested_fields=None,
        query_filter=None,
        start_key=None,
    )


def test_query_table_handles_pagination_using_query_table_single(mock_service, mocker):
    mock_query_table_single = mocker.patch.object(
        mock_service,
        "query_table_single",
        side_effect=[
            MOCK_PAGINATED_RESPONSE_1,
            MOCK_PAGINATED_RESPONSE_2,
            MOCK_PAGINATED_RESPONSE_3,
        ],
    )

    actual = mock_service.query_table(
        table_name=MOCK_TABLE_NAME,
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
    )

    assert actual == EXPECTED_ITEMS_FOR_PAGINATED_RESULTS
    assert mock_query_table_single.call_count == 3

    # Verify pagination keys are passed correctly
    calls = mock_query_table_single.call_args_list
    assert calls[0][1]["start_key"] is None
    assert calls[1][1]["start_key"] == {"ID": "id_token_for_page_2"}
    assert calls[2][1]["start_key"] == {"ID": "id_token_for_page_3"}


def test_query_table_with_all_optional_parameters(mock_service, mocker):
    mock_query_table_single = mocker.patch.object(
        mock_service, "query_table_single", return_value=MOCK_RESPONSE
    )
    filter_expression = Attr("Deleted").eq("")
    requested_fields = ["FileName", "Created"]

    actual = mock_service.query_table(
        table_name=MOCK_TABLE_NAME,
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
        index_name="NhsNumberIndex",
        requested_fields=requested_fields,
        query_filter=filter_expression,
    )

    assert actual == MOCK_RESPONSE["Items"]
    mock_query_table_single.assert_called_once_with(
        table_name=MOCK_TABLE_NAME,
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
        index_name="NhsNumberIndex",
        requested_fields=requested_fields,
        query_filter=filter_expression,
        start_key=None,
    )


def test_query_table_raises_exception_when_response_has_no_items(mock_service, mocker):
    mocker.patch.object(mock_service, "query_table_single", return_value={"Count": 0})

    with pytest.raises(DynamoServiceException) as exc_info:
        mock_service.query_table(
            table_name=MOCK_TABLE_NAME,
            search_key="NhsNumber",
            search_condition=TEST_NHS_NUMBER,
        )

    assert "Unrecognised response from DynamoDB" in str(exc_info.value)


def test_query_table_raises_exception_when_response_is_none(mock_service, mocker):
    mocker.patch.object(mock_service, "query_table_single", return_value=None)

    with pytest.raises(DynamoServiceException) as exc_info:
        mock_service.query_table(
            table_name=MOCK_TABLE_NAME,
            search_key="NhsNumber",
            search_condition=TEST_NHS_NUMBER,
        )

    assert "Unrecognised response from DynamoDB" in str(exc_info.value)


def test_query_with_requested_fields_raises_exception_when_results_are_empty(
    mock_service, mock_table
):
    mock_table.return_value.query.return_value = []

    with pytest.raises(DynamoServiceException):
        mock_service.query_table(
            table_name=MOCK_TABLE_NAME,
            index_name="NhsNumberIndex",
            search_key="NhsNumber",
            search_condition=TEST_NHS_NUMBER,
            requested_fields=[
                DocumentReferenceMetadataFields.FILE_NAME.value,
                DocumentReferenceMetadataFields.CREATED.value,
            ],
        )


def test_query_with_requested_fields_raises_exception_when_fields_requested_is_none(
    mock_service, mock_table
):
    search_key_obj = Key("NhsNumber").eq(TEST_NHS_NUMBER)

    mock_table.return_value.query.return_value = MOCK_SEARCH_RESPONSE
    expected = MOCK_SEARCH_RESPONSE["Items"]

    actual = mock_service.query_table(
        table_name=MOCK_TABLE_NAME,
        index_name="test_index",
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
    )
    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.query.assert_called_once_with(
        IndexName="test_index",
        KeyConditionExpression=search_key_obj,
    )

    assert expected == actual


def test_query_with_requested_fields_client_error_raises_exception(
    mock_service, mock_table
):
    expected_response = MOCK_CLIENT_ERROR
    mock_table.return_value.query.side_effect = MOCK_CLIENT_ERROR

    with pytest.raises(ClientError) as actual_response:
        mock_service.query_table(
            MOCK_TABLE_NAME,
            "NhsNumberIndex",
            "NhsNumber",
            TEST_NHS_NUMBER,
            [
                DocumentReferenceMetadataFields.FILE_NAME.value,
                DocumentReferenceMetadataFields.CREATED.value,
            ],
        )

    assert expected_response == actual_response.value


def test_query_table_is_called_with_correct_parameters(mock_service, mock_table):
    mock_table.return_value.query.return_value = {
        "Items": [{"id": "fake_test_item"}],
        "Counts": 1,
    }

    mock_service.query_table(MOCK_TABLE_NAME, "test_key_condition", "test_key_value")

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.query.assert_called_once_with(
        KeyConditionExpression=Key("test_key_condition").eq("test_key_value"),
    )


def test_query_table_raises_exception_when_results_are_empty(mock_service, mock_table):
    mock_table.return_value.query.return_value = []

    with pytest.raises(DynamoServiceException):
        mock_service.query_table(
            MOCK_TABLE_NAME, "test_key_condition", "test_key_value"
        )

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.query.assert_called_once_with(
        KeyConditionExpression=Key("test_key_condition").eq("test_key_value")
    )


def test_query_table_client_error_raises_exception(mock_service, mock_table):
    expected_response = MOCK_CLIENT_ERROR
    mock_table.return_value.query.side_effect = MOCK_CLIENT_ERROR

    with pytest.raises(ClientError) as actual_response:
        mock_service.query_table(
            MOCK_TABLE_NAME, "test_key_condition", "test_key_value"
        )

    assert expected_response == actual_response.value


def test_create_item_is_called_with_correct_parameters(mock_service, mock_table):
    mock_service.create_item(MOCK_TABLE_NAME, {"NhsNumber": TEST_NHS_NUMBER})

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.put_item.assert_called_once_with(
        Item={"NhsNumber": TEST_NHS_NUMBER}
    )


def test_create_item_raise_client_error(mock_service, mock_table):
    mock_service.create_item(MOCK_TABLE_NAME, {"NhsNumber": TEST_NHS_NUMBER})
    mock_table.return_value.put_item.side_effect = MOCK_CLIENT_ERROR

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.put_item.assert_called_once_with(
        Item={"NhsNumber": TEST_NHS_NUMBER}
    )

    with pytest.raises(ClientError) as actual_response:
        mock_service.create_item(MOCK_TABLE_NAME, {"NhsNumber": TEST_NHS_NUMBER})

    assert MOCK_CLIENT_ERROR == actual_response.value


def test_create_item_with_key_name(mock_service, mock_table):
    item = {"NhsNumber": TEST_NHS_NUMBER, "Name": "Test Patient"}
    key_name = "NhsNumber"

    mock_service.create_item(MOCK_TABLE_NAME, item, key_name)
    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.put_item.assert_called_once_with(
        Item=item, ConditionExpression=f"attribute_not_exists({key_name})"
    )


def test_create_item_raises_client_error(mock_service, mock_table):
    item = {"NhsNumber": TEST_NHS_NUMBER, "Name": "Test Patient"}
    key_name = "NhsNumber"

    mock_table.return_value.put_item.side_effect = MOCK_CLIENT_ERROR

    with pytest.raises(ClientError) as actual_response:
        mock_service.create_item(MOCK_TABLE_NAME, item, key_name)

    assert MOCK_CLIENT_ERROR == actual_response.value


def test_delete_item_is_called_with_correct_parameters(mock_service, mock_table):
    mock_service.delete_item(MOCK_TABLE_NAME, {"NhsNumber": TEST_NHS_NUMBER})

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.delete_item.assert_called_once_with(
        Key={"NhsNumber": TEST_NHS_NUMBER}
    )


def test_delete_item_client_error_raises_exception(mock_service, mock_table):
    expected_response = MOCK_CLIENT_ERROR
    mock_table.return_value.delete_item.side_effect = MOCK_CLIENT_ERROR

    with pytest.raises(ClientError) as actual_response:
        mock_service.delete_item(MOCK_TABLE_NAME, {"NhsNumber": TEST_NHS_NUMBER})

    assert expected_response == actual_response.value


def test_get_item_is_called_with_correct_parameters(mock_service, mock_table):
    mock_service.get_item(MOCK_TABLE_NAME, {"NhsNumber": TEST_NHS_NUMBER})

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.get_item.assert_called_once_with(
        Key={"NhsNumber": TEST_NHS_NUMBER}
    )


def test_get_item_client_error_raises_exception(mock_service, mock_table):
    expected_response = MOCK_CLIENT_ERROR
    mock_table.return_value.get_item.side_effect = MOCK_CLIENT_ERROR

    with pytest.raises(ClientError) as actual_response:
        mock_service.get_item(MOCK_TABLE_NAME, {"NhsNumber": TEST_NHS_NUMBER})

    assert expected_response == actual_response.value


def test_batch_get_items_success(mock_service, mock_dynamo_service):
    key_list = ["id1", "id2", "id3"]
    mock_response = {
        "Responses": {
            MOCK_TABLE_NAME: [
                {"ID": "id1", "data": "value1"},
                {"ID": "id2", "data": "value2"},
                {"ID": "id3", "data": "value3"},
            ]
        }
    }
    mock_dynamo_service.batch_get_item.return_value = mock_response

    results = mock_service.batch_get_items(MOCK_TABLE_NAME, key_list)

    expected_request_items = {
        MOCK_TABLE_NAME: {"Keys": [{"ID": "id1"}, {"ID": "id2"}, {"ID": "id3"}]}
    }
    mock_dynamo_service.batch_get_item.assert_called_once_with(
        RequestItems=expected_request_items
    )
    assert len(results) == 3
    assert results[0]["ID"] == "id1"
    assert results[1]["ID"] == "id2"
    assert results[2]["ID"] == "id3"


def test_batch_get_items_with_unprocessed_keys(mock_service, mock_dynamo_service):
    key_list = ["id1", "id2", "id3"]

    first_response = {
        "Responses": {MOCK_TABLE_NAME: [{"ID": "id1", "data": "value1"}]},
        "UnprocessedKeys": {MOCK_TABLE_NAME: {"Keys": [{"ID": "id2"}, {"ID": "id3"}]}},
    }

    second_response = {
        "Responses": {
            MOCK_TABLE_NAME: [
                {"ID": "id2", "data": "value2"},
                {"ID": "id3", "data": "value3"},
            ]
        }
    }

    mock_dynamo_service.batch_get_item.side_effect = [first_response, second_response]

    result = mock_service.batch_get_items(MOCK_TABLE_NAME, key_list)

    assert mock_dynamo_service.batch_get_item.call_count == 2
    assert len(result) == 3
    assert [item["ID"] for item in result] == ["id1", "id2", "id3"]


def test_batch_get_items_with_too_many_keys(mock_service, mock_dynamo_service):
    key_list = [f"id{i}" for i in range(101)]

    result = mock_service.batch_get_items(MOCK_TABLE_NAME, key_list)

    assert isinstance(result, DynamoServiceException)
    assert str(result) == "Cannot fetch more than 100 items at a time"
    mock_dynamo_service.batch_get_item.assert_not_called()


def test_batch_get_items_with_exception(mock_service, mock_dynamo_service):
    key_list = ["id1", "id2"]
    mock_dynamo_service.batch_get_item.side_effect = Exception("Test exception")

    with pytest.raises(Exception) as excinfo:
        mock_service.batch_get_items(MOCK_TABLE_NAME, key_list)

    assert str(excinfo.value) == "Test exception"

    expected_request_items = {MOCK_TABLE_NAME: {"Keys": [{"ID": "id1"}, {"ID": "id2"}]}}
    mock_dynamo_service.batch_get_item.assert_called_once_with(
        RequestItems=expected_request_items
    )


def test_update_item_is_called_with_correct_parameters(mock_service, mock_table):
    update_key = {"ID": "9000000009"}
    expected_update_expression = (
        "SET #FileName_attr = :FileName_val, #Deleted_attr = :Deleted_val"
    )
    expected_expr_attr_names = {
        "#FileName_attr": "FileName",
        "#Deleted_attr": "Deleted",
    }
    expected_expr_attr_values = {
        ":FileName_val": "test-filename",
        ":Deleted_val": "test-delete",
    }

    mock_service.update_item(
        table_name=MOCK_TABLE_NAME,
        key_pair={"ID": TEST_NHS_NUMBER},
        updated_fields={
            DocumentReferenceMetadataFields.FILE_NAME.value: "test-filename",
            DocumentReferenceMetadataFields.DELETED.value: "test-delete",
        },
    )

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.update_item.assert_called_once_with(
        Key=update_key,
        UpdateExpression=expected_update_expression,
        ExpressionAttributeNames=expected_expr_attr_names,
        ExpressionAttributeValues=expected_expr_attr_values,
        ReturnValues="ALL_NEW",
    )


def test_update_item_client_error_raises_exception(mock_service, mock_table):
    expected_response = MOCK_CLIENT_ERROR
    mock_table.return_value.update_item.side_effect = MOCK_CLIENT_ERROR

    with pytest.raises(ClientError) as actual_response:
        mock_service.update_item(
            MOCK_TABLE_NAME,
            {"ID": TEST_NHS_NUMBER},
            {
                DocumentReferenceMetadataFields.FILE_NAME.value: "test-filename",
                DocumentReferenceMetadataFields.DELETED.value: "test-delete",
            },
        )

    assert expected_response == actual_response.value


def test_scan_table_is_called_with_correct_no_args(mock_service, mock_table):
    mock_table.return_value.scan.return_value = []

    mock_service.scan_table(MOCK_TABLE_NAME)
    mock_table.return_value.scan.assert_called_once()


def test_scan_table_is_called_with_with_filter(mock_service, mock_table):
    mock_table.return_value.scan.return_value = []

    mock_service.scan_table(MOCK_TABLE_NAME, filter_expression="filter_test")
    mock_table.return_value.scan.assert_called_once_with(FilterExpression="filter_test")


def test_scan_table_with_is_called_with_start_key(mock_service, mock_table):
    mock_table.return_value.scan.return_value = []

    mock_service.scan_table(
        MOCK_TABLE_NAME, exclusive_start_key={"key": "exclusive_start_key"}
    )
    mock_table.return_value.scan.assert_called_once_with(
        ExclusiveStartKey={"key": "exclusive_start_key"}
    )


def test_scan_table_is_called_correctly_with_start_key_and_filter(
    mock_service, mock_table
):
    mock_table.return_value.scan.return_value = []

    mock_service.scan_table(
        MOCK_TABLE_NAME,
        exclusive_start_key={"key": "exclusive_start_key"},
        filter_expression="filter_test",
    )
    mock_table.return_value.scan.assert_called_once_with(
        ExclusiveStartKey={"key": "exclusive_start_key"},
        FilterExpression="filter_test",
    )


def test_scan_table_client_error_raises_exception(mock_service, mock_table):
    expected_response = MOCK_CLIENT_ERROR
    mock_table.return_value.scan.side_effect = expected_response

    with pytest.raises(ClientError) as actual_response:
        mock_service.scan_table(
            MOCK_TABLE_NAME,
            exclusive_start_key={"key": "exclusive_start_key"},
            filter_expression="filter_test",
        )

    assert expected_response == actual_response.value


def test_scan_whole_table_return_items_in_response(
    mock_service, mock_scan_method, mock_filter_expression
):
    mock_project_expression = "mock_project_expression"
    mock_scan_method.return_value = MOCK_RESPONSE

    expected = MOCK_RESPONSE["Items"]
    actual = mock_service.scan_whole_table(
        table_name=MOCK_TABLE_NAME,
        project_expression=mock_project_expression,
        filter_expression=mock_filter_expression,
    )

    assert expected == actual

    mock_service.get_table.assert_called_with(MOCK_TABLE_NAME)
    mock_scan_method.assert_called_with(
        ProjectionExpression=mock_project_expression,
        FilterExpression=mock_filter_expression,
    )


def test_scan_whole_table_handles_pagination(
    mock_service, mock_scan_method, mock_filter_expression
):
    mock_project_expression = "mock_project_expression"
    mock_scan_method.side_effect = mock_scan_implementation

    expected_result = EXPECTED_ITEMS_FOR_PAGINATED_RESULTS
    expected_calls = [
        call(
            ProjectionExpression=mock_project_expression,
            FilterExpression=mock_filter_expression,
        ),
        call(
            ProjectionExpression=mock_project_expression,
            FilterExpression=mock_filter_expression,
            ExclusiveStartKey={"ID": "id_token_for_page_2"},
        ),
        call(
            ProjectionExpression=mock_project_expression,
            FilterExpression=mock_filter_expression,
            ExclusiveStartKey={"ID": "id_token_for_page_3"},
        ),
    ]

    actual = mock_service.scan_whole_table(
        table_name=MOCK_TABLE_NAME,
        project_expression=mock_project_expression,
        filter_expression=mock_filter_expression,
    )

    assert expected_result == actual

    mock_service.get_table.assert_called_with(MOCK_TABLE_NAME)
    mock_scan_method.assert_has_calls(expected_calls)


def test_scan_whole_table_omit_expression_arguments_if_not_given(
    mock_service, mock_scan_method
):
    mock_service.scan_whole_table(
        table_name=MOCK_TABLE_NAME,
    )

    mock_service.get_table.assert_called_with(MOCK_TABLE_NAME)
    mock_scan_method.assert_called_with()


def test_get_table_when_table_exists_then_table_is_returned_successfully(
    mock_service, mock_dynamo_service
):
    mock_service.get_table(
        MOCK_TABLE_NAME,
    )

    mock_dynamo_service.Table.assert_called_once_with(MOCK_TABLE_NAME)


def test_get_table_when_table_does_not_exists_then_exception_is_raised(
    mock_service, mock_dynamo_service
):
    expected_response = MOCK_CLIENT_ERROR
    mock_dynamo_service.Table.side_effect = expected_response

    with pytest.raises(ClientError) as actual_response:
        mock_service.get_table(
            MOCK_TABLE_NAME,
        )

    assert expected_response == actual_response.value


def test_dynamo_service_singleton_instance(mocker):
    mocker.patch("boto3.resource")

    instance_1 = DynamoDBService()
    instance_2 = DynamoDBService()

    assert instance_1 is instance_2


def test_query_table_with_pagination(mock_service, mock_table):
    mock_table.return_value.query.side_effect = mock_scan_implementation
    expected_result = EXPECTED_ITEMS_FOR_PAGINATED_RESULTS
    search_key_obj = Key("NhsNumber").eq(TEST_NHS_NUMBER)

    expected_calls = [
        call(
            KeyConditionExpression=search_key_obj,
        ),
        call(
            KeyConditionExpression=search_key_obj,
            ExclusiveStartKey={"ID": "id_token_for_page_2"},
        ),
        call(
            KeyConditionExpression=search_key_obj,
            ExclusiveStartKey={"ID": "id_token_for_page_3"},
        ),
    ]

    actual = mock_service.query_table(
        table_name=MOCK_TABLE_NAME,
        search_key="NhsNumber",
        search_condition=TEST_NHS_NUMBER,
    )
    assert expected_result == actual
    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.query.assert_has_calls(expected_calls)


def test_update_item_with_condition_expression(mock_service, mock_table):
    update_key = {"ID": "9000000009"}
    condition_expression = "attribute_exists(FileName)"
    expression_attribute_values = {":expected_val": "expected_value"}

    expected_update_expression = "SET #FileName_attr = :FileName_val"
    expected_expr_attr_names = {"#FileName_attr": "FileName"}
    expected_expr_attr_values = {
        ":FileName_val": "test-filename",
        ":expected_val": "expected_value",
    }

    mock_service.update_item(
        table_name=MOCK_TABLE_NAME,
        key_pair={"ID": TEST_NHS_NUMBER},
        updated_fields={
            DocumentReferenceMetadataFields.FILE_NAME.value: "test-filename"
        },
        condition_expression=condition_expression,
        expression_attribute_values=expression_attribute_values,
    )

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.update_item.assert_called_once_with(
        Key=update_key,
        UpdateExpression=expected_update_expression,
        ExpressionAttributeNames=expected_expr_attr_names,
        ExpressionAttributeValues=expected_expr_attr_values,
        ConditionExpression=condition_expression,
        ReturnValues="ALL_NEW",
    )


def test_batch_writing_is_called_with_correct_parameters(mock_service, mock_table):
    items_to_write = [
        {"ID": "id1", "Name": "Item 1"},
        {"ID": "id2", "Name": "Item 2"},
        {"ID": "id3", "Name": "Item 3"},
    ]

    mock_batch_writer = (
        mock_table.return_value.batch_writer.return_value.__enter__.return_value
    )

    mock_service.batch_writing(MOCK_TABLE_NAME, items_to_write)

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.batch_writer.assert_called_once()

    assert mock_batch_writer.put_item.call_count == 3
    for item in items_to_write:
        mock_batch_writer.put_item.assert_any_call(Item=item)


def test_batch_writing_client_error_raises_exception(mock_service, mock_table):
    items_to_write = [{"ID": "id1", "Name": "Item 1"}]
    expected_response = MOCK_CLIENT_ERROR

    mock_table.return_value.batch_writer.return_value.__enter__.side_effect = (
        MOCK_CLIENT_ERROR
    )

    with pytest.raises(ClientError) as actual_response:
        mock_service.batch_writing(MOCK_TABLE_NAME, items_to_write)

    assert expected_response == actual_response.value


def test_batch_writing_with_empty_list(mock_service, mock_table):
    items_to_write = []

    mock_batch_writer = (
        mock_table.return_value.batch_writer.return_value.__enter__.return_value
    )

    mock_service.batch_writing(MOCK_TABLE_NAME, items_to_write)

    mock_table.assert_called_with(MOCK_TABLE_NAME)
    mock_table.return_value.batch_writer.assert_called_once()
    mock_batch_writer.put_item.assert_not_called()


def test_transact_write_items_success(mock_service, mock_dynamo_service):
    transact_items = [
        {
            "Put": {
                "TableName": MOCK_TABLE_NAME,
                "Item": {"ID": "id1", "Name": "Item 1"},
            }
        },
        {
            "Update": {
                "TableName": MOCK_TABLE_NAME,
                "Key": {"ID": "id2"},
                "UpdateExpression": "SET #name = :name",
                "ExpressionAttributeNames": {"#name": "Name"},
                "ExpressionAttributeValues": {":name": "Updated Item 2"},
            }
        },
    ]

    mock_response = {"ResponseMetadata": {"HTTPStatusCode": 200}}
    mock_dynamo_service.meta.client.transact_write_items.return_value = mock_response

    result = mock_service.transact_write_items(transact_items)

    mock_dynamo_service.meta.client.transact_write_items.assert_called_once_with(
        TransactItems=transact_items
    )
    assert result == mock_response


def test_transact_write_items_transaction_cancelled(mock_service, mock_dynamo_service):
    transact_items = [
        {
            "Put": {
                "TableName": MOCK_TABLE_NAME,
                "Item": {"ID": "id1", "Name": "Item 1"},
            }
        }
    ]

    error_response = {
        "Error": {
            "Code": "TransactionCanceledException",
            "Message": "Transaction cancelled",
        },
        "CancellationReasons": [{"Code": "ConditionalCheckFailed"}],
    }
    mock_dynamo_service.meta.client.transact_write_items.side_effect = ClientError(
        error_response, "TransactWriteItems"
    )

    with pytest.raises(ClientError) as exc_info:
        mock_service.transact_write_items(transact_items)

    assert exc_info.value.response["Error"]["Code"] == "TransactionCanceledException"


def test_transact_write_items_generic_client_error(mock_service, mock_dynamo_service):
    transact_items = [
        {
            "Put": {
                "TableName": MOCK_TABLE_NAME,
                "Item": {"ID": "id1", "Name": "Item 1"},
            }
        }
    ]

    mock_dynamo_service.meta.client.transact_write_items.side_effect = MOCK_CLIENT_ERROR

    with pytest.raises(ClientError) as exc_info:
        mock_service.transact_write_items(transact_items)

    assert exc_info.value == MOCK_CLIENT_ERROR


def test_build_update_transaction_item_single_condition(mock_service):
    table_name = MOCK_TABLE_NAME
    document_key = {"ID": "test_id"}
    update_fields = {"FileName": "new_filename.pdf", "Deleted": ""}
    condition_fields = {"DocStatus": "final"}

    result = mock_service.build_update_transaction_item(
        table_name, document_key, update_fields, condition_fields
    )

    assert "Update" in result
    update_item = result["Update"]

    assert update_item["TableName"] == table_name
    assert update_item["Key"] == document_key
    assert (
        "SET #FileName_attr = :FileName_val, #Deleted_attr = :Deleted_val"
        == update_item["UpdateExpression"]
    )
    assert (
        update_item["ConditionExpression"]
        == "#DocStatus_attr = :DocStatus_condition_val"
    )

    assert update_item["ExpressionAttributeNames"]["#FileName_attr"] == "FileName"
    assert update_item["ExpressionAttributeNames"]["#Deleted_attr"] == "Deleted"
    assert update_item["ExpressionAttributeNames"]["#DocStatus_attr"] == "DocStatus"

    assert (
        update_item["ExpressionAttributeValues"][":FileName_val"] == "new_filename.pdf"
    )
    assert update_item["ExpressionAttributeValues"][":Deleted_val"] == ""
    assert (
        update_item["ExpressionAttributeValues"][":DocStatus_condition_val"] == "final"
    )


def test_build_update_transaction_item_multiple_conditions(mock_service):
    table_name = MOCK_TABLE_NAME
    document_key = {"ID": "test_id", "SK": "test_sk"}
    update_fields = {"FileName": "updated.pdf"}
    condition_fields = {"DocStatus": "final", "Version": 1, "Uploaded": True}

    result = mock_service.build_update_transaction_item(
        table_name, document_key, update_fields, condition_fields
    )

    assert "Update" in result
    update_item = result["Update"]

    assert update_item["TableName"] == table_name
    assert update_item["Key"] == document_key

    # Check that all conditions are present (order might vary)
    condition_expr = update_item["ConditionExpression"]
    assert "#DocStatus_attr = :DocStatus_condition_val" in condition_expr
    assert "#Version_attr = :Version_condition_val" in condition_expr
    assert "#Uploaded_attr = :Uploaded_condition_val" in condition_expr
    assert condition_expr.count(" AND ") == 2

    # Check all attribute names are present
    assert update_item["ExpressionAttributeNames"]["#FileName_attr"] == "FileName"
    assert update_item["ExpressionAttributeNames"]["#DocStatus_attr"] == "DocStatus"
    assert update_item["ExpressionAttributeNames"]["#Version_attr"] == "Version"
    assert update_item["ExpressionAttributeNames"]["#Uploaded_attr"] == "Uploaded"

    # Check all attribute values are present
    assert update_item["ExpressionAttributeValues"][":FileName_val"] == "updated.pdf"
    assert (
        update_item["ExpressionAttributeValues"][":DocStatus_condition_val"] == "final"
    )
    assert update_item["ExpressionAttributeValues"][":Version_condition_val"] == 1
    assert update_item["ExpressionAttributeValues"][":Uploaded_condition_val"] is True


def test_build_update_transaction_item_empty_condition_fields(mock_service):
    table_name = MOCK_TABLE_NAME
    document_key = {"ID": "test_id"}
    update_fields = {"FileName": "new_filename.pdf"}
    condition_fields = {}

    result = mock_service.build_update_transaction_item(
        table_name, document_key, update_fields, condition_fields
    )

    assert "Update" in result
    update_item = result["Update"]

    # With empty condition_fields, condition expression should be empty string
    assert update_item["ConditionExpression"] == ""
    assert update_item["TableName"] == table_name
    assert update_item["Key"] == document_key


@pytest.mark.parametrize(
    ["search_key", "search_condition", "expected"],
    [
        ("pk", "foobar", [{"name": "pk", "value": "foobar"}]),
        (
            ["pk", "sk"],
            ["foobar", "barfoo"],
            [{"name": "pk", "value": "foobar"}, {"name": "sk", "value": "barfoo"}],
        ),
        (
            ["gsi_pk", "gsi_sk"],
            ["gsi_foo", "gsi_bar"],
            [
                {"name": "gsi_pk", "value": "gsi_foo"},
                {"name": "gsi_sk", "value": "gsi_bar"},
            ],
        ),
    ],
)
def test_build_key_condition(mock_service, search_key, search_condition, expected):
    key_condition = mock_service.build_key_condition(
        search_key=search_key, search_condition=search_condition
    )
    if isinstance(key_condition, Equals):
        attr_key, attr_value = key_condition._values

        assert attr_key.name == expected[0]["name"]
        assert attr_value == expected[0]["value"]
    else:
        assert isinstance(key_condition, And)
        for idx, c in enumerate(key_condition._values):
            assert isinstance(c, Equals)
            assert c._values[0].name == expected[idx]["name"]
            assert c._values[1] == expected[idx]["value"]


@pytest.mark.parametrize(
    ["search_key", "search_condition"],
    [
        (["pk", "sk"], "foobar"),
        (
            "pk",
            ["foobar", "barfoo"],
        ),
        (
            ["pk", "sk"],
            ["foo", "bar", "foobar"],
        ),
        (
            ["pk", "sk"],
            ["foo"],
        ),
    ],
)
def test_build_key_condition_non_matching_list_lengths(
    mock_service, search_key, search_condition
):

    with pytest.raises(DynamoServiceException):
        mock_service.build_key_condition(
            search_key=search_key, search_condition=search_condition
        )


def test_query_table_using_paginator(mock_service):
    mock_paginator = mock_service.client.get_paginator.return_value = MagicMock()

    mock_paginator.paginate.return_value.build_full_result.return_value = (
        MOCK_DOCUMENT_REVIEW_PAGINATOR_RESPONSE
    )

    expected = {
        "Items": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"],
        "NextToken": MOCK_DOCUMENT_REVIEW_PAGINATOR_RESPONSE["NextToken"],
    }

    actual = mock_service.query_table_with_paginator(
        table_name=MOCK_TABLE_NAME,
        index_name="NhsNumberIndex",
        key="NhsNumber",
        condition=TEST_NHS_NUMBER,
    )

    mock_paginator.paginate.assert_called_with(
        TableName=MOCK_TABLE_NAME,
        IndexName="NhsNumberIndex",
        KeyConditionExpression="NhsNumber=:i",
        ExpressionAttributeValues={":i": {"S": TEST_NHS_NUMBER}},
        PaginationConfig={"MaxItems": 20, "PageSize": 1, "StartingToken": None},
    )

    assert actual == expected


def test_query_table_using_pagination_with_filter_expression(mock_service):
    mock_paginator = mock_service.client.get_paginator.return_value = MagicMock()

    conditions = [
        {
            "field": "ReviewStatus",
            "operator": "=",
            "value": "PENDING_REVIEW",
        },
        {
            "field": "NhsNumber",
            "operator": "=",
            "value": TEST_NHS_NUMBER,
        },
    ]
    filter_expression, condition_attribute_names, condition_attribute_values = (
        build_mixed_condition_expression(conditions=conditions)
    )

    serialized_condition_attribute_values = serialize_dict_to_dynamodb_object(
        condition_attribute_values
    )

    mock_service.query_table_with_paginator(
        table_name=MOCK_TABLE_NAME,
        index_name="NhsNumberIndex",
        key="NhsNumber",
        condition=TEST_NHS_NUMBER,
        filter_expression=filter_expression,
        expression_attribute_names=condition_attribute_names,
        expression_attribute_values=condition_attribute_values,
    )

    mock_paginator.paginate.assert_called_with(
        TableName=MOCK_TABLE_NAME,
        IndexName="NhsNumberIndex",
        KeyConditionExpression="NhsNumber=:i",
        FilterExpression=filter_expression,
        ExpressionAttributeValues={
            ":i": {"S": TEST_NHS_NUMBER},
            **serialized_condition_attribute_values,
        },
        ExpressionAttributeNames=condition_attribute_names,
        PaginationConfig={"MaxItems": 20, "PageSize": 1, "StartingToken": None},
    )
