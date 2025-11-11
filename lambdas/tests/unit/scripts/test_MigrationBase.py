import pytest
from scripts.MigrationBase import MigrationBase


class DummyMigration(MigrationBase):
    def main(self, entries):
        return [
            (
                "dummy",
                lambda entry: {"field": "value"} if entry.get("ID") != "skip" else None,
            )
        ]


@pytest.fixture(autouse=True)
def set_env_vars(monkeypatch):
    monkeypatch.setenv("MIGRATION_FAILED_ITEMS_STORE_BUCKET_NAME", "test-bucket")


@pytest.fixture
def dummy_migration(mocker):
    # Patch boto3 client and LoggingService
    mocker.patch("scripts.MigrationBase.boto3.client", return_value=mocker.Mock())
    mocker.patch("scripts.MigrationBase.LoggingService", return_value=mocker.Mock())
    mocker.patch("scripts.MigrationBase.DynamoDBService", return_value=mocker.Mock())
    return DummyMigration(environment="dev", table_name="TestTable", run_migration=True)


def test_init_sets_properties(dummy_migration):
    assert dummy_migration.environment == "dev"
    assert dummy_migration.table_name == "TestTable"
    assert dummy_migration.run_migration is True
    assert dummy_migration.failed_items_bucket == "test-bucket"


def test_abstract_main_enforced():
    class IncompleteMigration(MigrationBase):
        pass

    with pytest.raises(TypeError):
        IncompleteMigration(environment="dev", table_name="TestTable")


def test_process_entries_successful(dummy_migration, mocker):
    dummy_migration.dynamo_service.update_item = mocker.Mock()
    dummy_migration.logger = mocker.Mock()
    dummy_migration.s3_client = mocker.Mock()

    entries = [{"ID": "1"}, {"ID": "skip"}]
    result = dummy_migration.process_entries(
        label="dummy",
        entries=entries,
        update_fn=lambda entry: (
            {"field": "value"} if entry.get("ID") != "skip" else None
        ),
        segment=0,
        execution_id="exec-1",
    )
    assert result["successful_item_runs"] == 1
    assert result["skipped_items_count"] == 1
    assert result["failed_items_count"] == 0
    dummy_migration.dynamo_service.update_item.assert_called_once()


def test_process_entries_dry_run(mocker):
    mocker.patch("scripts.MigrationBase.boto3.client", return_value=mocker.Mock())
    mocker.patch("scripts.MigrationBase.LoggingService", return_value=mocker.Mock())
    mocker.patch("scripts.MigrationBase.DynamoDBService", return_value=mocker.Mock())
    migration = DummyMigration(
        environment="dev", table_name="TestTable", run_migration=False
    )
    migration.logger = mocker.Mock()
    migration.s3_client = mocker.Mock()
    entries = [{"ID": "1"}]
    result = migration.process_entries(
        label="dummy",
        entries=entries,
        update_fn=lambda entry: {"field": "value"},
        segment=0,
        execution_id="exec-2",
    )
    assert result["successful_item_runs"] == 1
    migration.dynamo_service.update_item.assert_not_called()


def test_process_entries_unrecoverable_exception(dummy_migration, mocker):
    dummy_migration.logger = mocker.Mock()
    dummy_migration.s3_client = mocker.Mock()
    dummy_migration.dynamo_service.update_item = mocker.Mock()
    # Patch MigrationUnrecoverableException
    from utils.exceptions import MigrationUnrecoverableException

    def bad_update_fn(entry):
        raise MigrationUnrecoverableException(item_id=entry.get("ID"), message="fail")

    entries = [{"ID": "bad"}]
    result = dummy_migration.process_entries(
        label="dummy",
        entries=entries,
        update_fn=bad_update_fn,
        segment=1,
        execution_id="exec-3",
    )
    assert result["failed_items_count"] == 1
    dummy_migration.s3_client.put_object.assert_called_once()


def test_process_entries_other_exception(dummy_migration):
    def bad_update_fn(entry):
        raise Exception("other error")

    with pytest.raises(Exception):
        dummy_migration.process_entries(
            label="dummy",
            entries=[{"ID": "err"}],
            update_fn=bad_update_fn,
            segment=2,
            execution_id="exec-4",
        )
