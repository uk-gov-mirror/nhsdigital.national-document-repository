import pytest
import os
from scripts.MigrationBase import MigrationBase
from services.dynamodb_migration_service import DynamoDBMigrationService


@pytest.fixture(autouse=True)
def set_env_vars(monkeypatch):
    monkeypatch.setenv("MIGRATION_FAILED_ITEMS_STORE_BUCKET_NAME", "dummy-bucket")


@pytest.fixture
def mock_boto3_resource(mocker):
    mock_table = mocker.Mock()
    mock_dynamodb = mocker.Mock()
    mock_dynamodb.Table.return_value = mock_table
    mocker.patch("boto3.resource", return_value=mock_dynamodb)
    return mock_table


@pytest.fixture
def service_under_test(mock_boto3_resource, mocker):
    mocker.patch("services.dynamodb_migration_service.DynamoDBService")
    service = DynamoDBMigrationService(
        segment=0,
        total_segments=10,
        table_name="TestTable",
        environment="dev",
        run_migration=True,
        migration_script="scripts.test_migration_script",
    )
    yield service


def test_load_migration_instance_loads_valid_class(service_under_test, mocker):
    class ConcreteMigration(MigrationBase):
        def main(self, entries):
            return [("test", lambda x: None)]

    mock_module = mocker.Mock()
    mock_module.ConcreteMigration = ConcreteMigration
    mocker.patch("importlib.import_module", return_value=mock_module)

    instance = service_under_test.load_migration_instance()

    assert isinstance(instance, ConcreteMigration)
    assert instance.table_name == "TestTable"
    assert instance.environment == "dev"
    assert instance.run_migration is True


def test_load_migration_instance_raises_if_no_valid_class(service_under_test, mocker):
    mocker.patch("importlib.import_module", return_value=mocker.Mock())

    with pytest.raises(ValueError) as e:
        service_under_test.load_migration_instance()

    assert "No subclass of MigrationBase" in str(e.value)


def test_scan_segment_first_page(service_under_test, mock_boto3_resource):
    mock_boto3_resource.scan.return_value = {"Items": [{"ID": "1"}, {"ID": "2"}]}

    response, items = service_under_test.scan_segment()

    assert response["Items"] == items
    assert service_under_test.scanned_count == 2
    mock_boto3_resource.scan.assert_called_once_with(Segment=0, TotalSegments=10)


def test_scan_segment_with_last_key(service_under_test, mock_boto3_resource):
    mock_boto3_resource.scan.return_value = {"Items": [{"ID": "A"}]}
    lek = {"ID": "123"}

    service_under_test.scan_segment(lek)

    mock_boto3_resource.scan.assert_called_once_with(
        Segment=0, TotalSegments=10, ExclusiveStartKey=lek
    )


def test_process_items_executes_update_functions(service_under_test, mocker):
    def dummy_update_fn(item):
        return None

    migration_instance = mocker.Mock()
    migration_instance.main.return_value = [("VeryImportantMigration", dummy_update_fn)]
    migration_instance.process_entries.return_value = {
        "successful_item_run": 1,  # <-- match implementation key
        "failed_items_count": 0
    }

    service_under_test.process_items(migration_instance, [{"ID": "1"}])

    migration_instance.main.assert_called_once_with(entries=[{"ID": "1"}])
    migration_instance.process_entries.assert_called_once_with(
        label="VeryImportantMigration",
        entries=[{"ID": "1"}],
        update_fn=dummy_update_fn,
        segment=service_under_test.segment
    )
    assert service_under_test.processed_count == 1
    assert service_under_test.error_count == 0


def test_process_items_handles_exceptions(service_under_test, mocker):
    def dummy_update_fn(item):
        return None

    migration_instance = mocker.Mock()
    migration_instance.main.return_value = [("VeryImportantMigration", dummy_update_fn)]
    migration_instance.process_entries.side_effect = Exception("failed :(")

    service_under_test.process_items(migration_instance, [{"ID": "1"}])

    migration_instance.main.assert_called_once_with(entries=[{"ID": "1"}])
    migration_instance.process_entries.assert_called_once_with(
        label="VeryImportantMigration",
        entries=[{"ID": "1"}],
        update_fn=dummy_update_fn,
        segment=service_under_test.segment
    )
    assert service_under_test.error_count == 1


def test_process_items_no_items_skips(service_under_test, mocker):
    migration_instance = mocker.Mock()
    service_under_test.process_items(migration_instance, [])
    migration_instance.main.assert_not_called()


def test_iterate_segment_items_multiple_pages(service_under_test, mocker):
    migration_instance = mocker.Mock()
    mock_scan = mocker.patch.object(
        service_under_test,
        "scan_segment",
        side_effect=[
            ({"LastEvaluatedKey": {"ID": "next"}}, [{"ID": "1"}]),
            ({"LastEvaluatedKey": False}, [{"ID": "2"}]),
        ],
    )
    mock_process = mocker.patch.object(service_under_test, "process_items")

    service_under_test.iterate_segment_items(migration_instance)

    assert mock_scan.call_count == 2
    assert mock_process.call_count == 2


def test_run_migration_success(service_under_test, mocker):
    mock_load = mocker.patch.object(service_under_test, "load_migration_instance", return_value=mocker.Mock())
    mock_iterate = mocker.patch.object(service_under_test, "iterate_segment_items")

    result = service_under_test.execute_migration()

    assert mock_load.called
    assert mock_iterate.called
    assert result["status"] == "SUCCEEDED"
    assert result["segmentId"] == 0


def test_run_migration_with_errors(service_under_test, mocker):
    mocker.patch.object(service_under_test, "load_migration_instance", return_value=mocker.Mock())
    mocker.patch.object(service_under_test, "iterate_segment_items")
    service_under_test.error_count = 2

    result = service_under_test.execute_migration()

    assert result["status"] == "COMPLETED_WITH_ERRORS"
