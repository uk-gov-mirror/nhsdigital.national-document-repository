import pytest
from repositories.reporting.report_contact_repository import ReportContactRepository


@pytest.fixture
def required_contact_repo_env(monkeypatch):
    monkeypatch.setenv("CONTACT_TABLE_NAME", "report-contacts")


@pytest.fixture
def mock_dynamo(mocker):
    dynamo = mocker.Mock(name="DynamoDBServiceInstance")
    mocker.patch(
        "repositories.reporting.report_contact_repository.DynamoDBService",
        autospec=True,
        return_value=dynamo,
    )
    return dynamo


@pytest.fixture
def repo(required_contact_repo_env, mock_dynamo):
    return ReportContactRepository()


@pytest.mark.parametrize(
    "dynamo_response, expected_email",
    [
        (
            {
                "Item": {
                    "OdsCode": "Y12345",
                    "Email": "contact@example.com",
                },
            },
            "contact@example.com",
        ),
        ({}, None),
        ({"Item": {"OdsCode": "Y12345"}}, None),
        (None, None),
    ],
)
def test_get_contact_email(repo, mock_dynamo, dynamo_response, expected_email):
    mock_dynamo.get_item.return_value = dynamo_response

    result = repo.get_contact_email("Y12345")

    mock_dynamo.get_item.assert_called_once_with(
        table_name="report-contacts",
        key={"OdsCode": "Y12345"},
    )
    assert result == expected_email


def test_init_reads_table_name_from_env(repo):
    assert repo.table_name == "report-contacts"
