import pytest

from handlers.migration_dynamodb_handler import (
    lambda_handler,
    extract_table_info,
    validate_event_input,
)

@pytest.fixture
def mock_validate_event_input(mocker):
    return mocker.patch(
        "handlers.migration_dynamodb_handler.validate_event_input",
        return_value=(0, 10, "my_table", "dev", "eu-west-2", False, "scripts.my_script", "test-exec-id")
    )

@pytest.fixture
def mock_service(mocker):
    mock_class = mocker.patch("handlers.migration_dynamodb_handler.DynamoDBMigrationService")
    instance = mock_class.return_value
    instance.execute_migration.return_value = {
        "segmentId": 0,
        "totalSegments": 10,
        "status": "SUCCEEDED"
    }
    return instance

def test_handler_calls_dependencies_and_returns_result(mock_validate_event_input, mock_service, context):
    event = {"segment": 0, "totalSegments": 10, "migrationScript": "scripts.my_script", "executionId": "test-exec-id"}

    result = lambda_handler(event, context)

    mock_validate_event_input.assert_called_once_with(event)
    mock_service.execute_migration.assert_called_once()
    assert result["status"] == "SUCCEEDED"

def test_handler_catches_client_error(mocker, mock_validate_event_input, context):
    from botocore.exceptions import ClientError

    mock_service_class = mocker.patch("handlers.migration_dynamodb_handler.DynamoDBMigrationService")
    mock_instance = mock_service_class.return_value
    mock_instance.execute_migration.side_effect = ClientError(
        {"Error": {"Code": "AccessDeniedException", "Message": "Denied"}}, "Scan"
    )

    event = {"segment": 0, "totalSegments": 10, "migrationScript": "scripts.my_script", "executionId": "test-exec-id"}

    with pytest.raises(ClientError):
        lambda_handler(event, context)


@pytest.mark.parametrize(
    "update, expected_message",
    [
        ({"segment": "not-int"}, "'segment' and 'totalSegments' must be integers"),
        ({"segment": -1}, "'segment' must be >= 0"),
        ({"totalSegments": 0}, "'totalSegments' must be positive"),
        ({"segment": 10}, "'segment' must be less than 'totalSegments'"),
        ({"migrationScript": "  "}, "'migrationScript' cannot be empty"),
    ],
)
def test_validate_event_invalid_inputs_raise_valueerror(update, expected_message):
    event = {
        "segment": 0,
        "totalSegments": 10,
        "tableName": "my_table",
        "environment": "dev",
        "migrationScript": "scripts.my_script",
        "executionId": "test-exec-id"
    }

    event.update(update)

    with pytest.raises(ValueError) as exc:
        validate_event_input(event)

    assert expected_message in str(exc.value)


def test_validate_event_missing_required_field():
    event = {"segment": 0, "tableName": "my_table"}
    with pytest.raises(ValueError) as exc:
        validate_event_input(event)
    assert "Missing required field" in str(exc.value)

def test_extract_table_info_extract_arn():
    arn = "arn:aws:dynamodb:eu-west-2:123456789012:table/dev_MyTable"
    event = {"tableArn": arn}

    table_name, environment, region = extract_table_info(event)

    assert table_name == "dev_MyTable"
    assert environment == "dev"
    assert region == "eu-west-2"


def test_extract_table_info_extract_table_name_and_env():
    event = {"tableName": "MyTable", "environment": "test"}
    table_name, environment, region = extract_table_info(event)
    assert table_name == "MyTable"
    assert environment == "test"
    assert region is None


def test_extract_table_info_fails_with_missing_fields():
    event = {}
    with pytest.raises(ValueError):
        extract_table_info(event)


def test_extract_table_info_invalid_arn_format():
    event = {"tableArn": "not-a-valid-arn"}
    with pytest.raises(ValueError):
        extract_table_info(event)

def test_extract_table_info_raises_valueerror():
    bad_arn = "arn:aws:dynamodb"
    event = {"tableArn": bad_arn}

    with pytest.raises(ValueError):
        extract_table_info(event)


def test_lambda_handler_catches_valueerror_exception(mocker, context):
    mocker.patch(
        "handlers.migration_dynamodb_handler.validate_event_input",
        side_effect=ValueError("bad event"),
    )
    mock_logger = mocker.patch("handlers.migration_dynamodb_handler.logger")

    event = {"segment": 0, "totalSegments": 10, "migrationScript": "scripts.my_script", "executionId": "test-exec-id"}

    with pytest.raises(ValueError):
        lambda_handler(event, context)

    mock_logger.error.assert_any_call(
        "Unexpected error in dynamodb_migration_handler: bad event", exc_info=True
    )

def test_validate_event_input_run_migration_true(mocker):
    event = {
        "segment": 0,
        "totalSegments": 10,
        "tableName": "my_table",
        "environment": "dev",
        "migrationScript": "scripts.my_script",
        "executionId": "test-exec-id",
        "runMigration": True
    }
    result = validate_event_input(event)
    assert result[5] is True  # run_migration

def test_validate_event_input_region_extracted_from_arn(mocker):
    event = {
        "segment": 0,
        "totalSegments": 10,
        "tableArn": "arn:aws:dynamodb:eu-west-2:123456789012:table/dev_MyTable",
        "migrationScript": "scripts.my_script",
        "executionId": "test-exec-id"
    }
    result = validate_event_input(event)
    assert result[4] == "eu-west-2"

def test_extract_table_info_invalid_arn_prefix():
    event = {"tableArn": "invalid-arn"}
    with pytest.raises(ValueError) as exc:
        extract_table_info(event)
    assert "Invalid DynamoDB ARN format" in str(exc.value)

def test_extract_table_info_unable_to_parse_arn():
    event = {"tableArn": "arn:aws:dynamodb:eu-west-2:bad"}
    # purposely break the ARN so split fails
    table_name, environment, region = extract_table_info(event)
    assert table_name == "arn:aws:dynamodb:eu-west-2:bad"
    assert environment == "unknown"
    assert region == "eu-west-2"

def test_validate_event_input_missing_execution_id():
    event = {
        "segment": 0,
        "totalSegments": 10,
        "tableName": "my_table",
        "environment": "dev",
        "migrationScript": "scripts.my_script"
    }
    with pytest.raises(ValueError) as exc:
        validate_event_input(event)
    assert "Missing required field: 'executionId' in event" in str(exc.value)

def test_validate_event_input_missing_table_info():
    event = {
        "segment": 0,
        "totalSegments": 10,
        "migrationScript": "scripts.my_script",
        "executionId": "test-exec-id"
    }
    with pytest.raises(ValueError) as exc:
        validate_event_input(event)
    assert "Event must include either 'tableArn' or both 'tableName' and 'environment'" in str(exc.value)

