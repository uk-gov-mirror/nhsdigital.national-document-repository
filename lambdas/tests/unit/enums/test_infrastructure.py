import pytest
from enums.infrastructure import DynamoTables
from enums.lambda_error import LambdaError
from tests.unit.conftest import WORKSPACE
from utils.lambda_exceptions import DocumentRefException, InvalidDocTypeException


@pytest.mark.parametrize(
    ["enum_value", "expected"],
    [
        (DynamoTables.LLOYD_GEORGE, "LloydGeorgeReferenceMetadata"),
        (DynamoTables.CORE, "COREDocumentMetadata"),
    ],
)
def test_get_dynamodb_table_name_success(set_env, enum_value, expected):
    assert str(enum_value) == f"{WORKSPACE}_{expected}"


def test_get_dynamodb_table_non_existent(set_env):
    with pytest.raises(InvalidDocTypeException) as exc:
        DynamoTables.FOO

    assert exc.value.status_code == 400
    assert exc.value.error == LambdaError.DocTypeInvalid


def test_dynamo_tables_no_workspace(monkeypatch):
    monkeypatch.delenv("WORKSPACE", raising=False)

    with pytest.raises(DocumentRefException) as exc:
        str(DynamoTables.CORE)

    assert exc.value.status_code == 500
    assert exc.value.error == LambdaError.EnvMissing
    monkeypatch.setenv("WORKSPACE", "dev")
