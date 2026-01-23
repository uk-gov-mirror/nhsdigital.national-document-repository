import pytest

from repositories.reporting.report_contact_repository import ReportContactRepository


@pytest.fixture
def mock_dynamo(mocker):
    mock = mocker.Mock()
    mocker.patch(
        "repositories.reporting.report_contact_repository.DynamoDBService",
        return_value=mock,
    )
    return mock


@pytest.fixture
def repo(mock_dynamo):
    return ReportContactRepository(table_name="report-contacts")


def test_get_contact_email_returns_email_when_item_exists(repo, mock_dynamo):
    mock_dynamo.get_item.return_value = {
        "Item": {
            "OdsCode": "Y12345",
            "Email": "contact@example.com",
        }
    }

    result = repo.get_contact_email("Y12345")

    mock_dynamo.get_item.assert_called_once_with(
        table_name="report-contacts",
        key={"OdsCode": "Y12345"},
    )
    assert result == "contact@example.com"


def test_get_contact_email_returns_none_when_item_missing(repo, mock_dynamo):
    mock_dynamo.get_item.return_value = {}  # or None

    result = repo.get_contact_email("Y12345")

    mock_dynamo.get_item.assert_called_once_with(
        table_name="report-contacts",
        key={"OdsCode": "Y12345"},
    )
    assert result is None


def test_get_contact_email_returns_none_when_email_missing(repo, mock_dynamo):
    mock_dynamo.get_item.return_value = {
        "Item": {
            "OdsCode": "Y12345",
        }
    }

    result = repo.get_contact_email("Y12345")

    mock_dynamo.get_item.assert_called_once_with(
        table_name="report-contacts",
        key={"OdsCode": "Y12345"},
    )
    assert result is None
