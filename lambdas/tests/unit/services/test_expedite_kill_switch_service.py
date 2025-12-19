import json
import pytest

from services.expedite_transfer_family_kill_switch_service import (
    ExpediteKillSwitchService,
    EXPECTED_SCAN_RESULTS,
    response,
)


@pytest.fixture
def mock_transfer_client(mocker):
    transfer_client = mocker.Mock()
    cloudwatch_client = mocker.Mock()
    class ResourceNotFoundException(Exception):
        pass

    transfer_client.exceptions = mocker.Mock(
        ResourceNotFoundException=ResourceNotFoundException
    )

    def _client(service_name, *_, **__):
        if service_name == "transfer":
            return transfer_client
        if service_name == "cloudwatch":
            return cloudwatch_client
        raise AssertionError(f"Unexpected boto3 client requested: {service_name}")

    mocker.patch(
        "services.expedite_transfer_family_kill_switch_service.boto3.client",
        side_effect=_client,
    )
    return transfer_client


@pytest.fixture
def service(mock_transfer_client, monkeypatch):
    monkeypatch.setenv("STAGING_STORE_BUCKET_NAME", "pre-prod-staging-bulk-store")
    monkeypatch.setenv("WORKSPACE", "pre-prod")
    return ExpediteKillSwitchService()


@pytest.fixture
def sns_event():
    message = {
        "scanResult": "Infected",
        "bucket": "cloudstoragesecquarantine-abc",
        "key": "pre-prod-staging-bulk-store/expedite/folder/file.pdf",
    }
    return {
        "Records": [
            {
                "Sns": {
                    "Message": json.dumps(message),
                }
            }
        ]
    }


def extract_message(resp):
    return json.loads(resp["body"])["message"]

def test_response_builds_expected_http_shape():
    msg = "hello world"
    resp = response(msg)

    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body == {"message": msg}


def test_handle_sns_event_happy_path_infected_expedite(
    service, sns_event, mock_transfer_client
):
    mock_transfer_client.list_servers.return_value = {
        "Servers": [{"ServerId": "srv-12345"}]
    }
    mock_transfer_client.describe_server.return_value = {"Server": {"State": "ONLINE"}}

    resp = service.handle_sns_event(sns_event)

    mock_transfer_client.list_servers.assert_called_once_with(MaxResults=1)
    mock_transfer_client.describe_server.assert_called_once_with(ServerId="srv-12345")
    mock_transfer_client.stop_server.assert_called_once_with(ServerId="srv-12345")
    assert extract_message(resp) == "Server srv-12345 stopped"


def test_handle_sns_event_no_servers_disables_kill_switch(
    service, sns_event, mock_transfer_client
):
    mock_transfer_client.list_servers.return_value = {"Servers": []}

    resp = service.handle_sns_event(sns_event)

    assert (
        extract_message(resp)
        == "Transfer family kill switch disabled – no Transfer server ID discovered"
    )
    mock_transfer_client.describe_server.assert_not_called()
    mock_transfer_client.stop_server.assert_not_called()


def test_get_transfer_server_id_happy_path_reads_from_list_servers(
    service, mock_transfer_client
):
    mock_transfer_client.list_servers.return_value = {
        "Servers": [{"ServerId": " srv-9999 "}]
    }

    server_id = service.get_transfer_server_id()

    mock_transfer_client.list_servers.assert_called_once_with(MaxResults=1)
    assert server_id == " srv-9999 ".strip()


def test_get_transfer_server_id_returns_empty_when_no_servers(
    service, mock_transfer_client
):
    mock_transfer_client.list_servers.return_value = {"Servers": []}

    server_id = service.get_transfer_server_id()

    assert server_id == ""


def test_get_transfer_server_id_returns_empty_on_generic_error(
    service, mock_transfer_client
):
    mock_transfer_client.list_servers.side_effect = Exception("boom")

    server_id = service.get_transfer_server_id()

    assert server_id == ""

def test_handle_scan_message_calls_stop_server_for_infected_expedite(
    service, sns_event, mocker
):
    message = json.loads(sns_event["Records"][0]["Sns"]["Message"])
    server_id = "srv-abc"

    mock_stop = mocker.patch.object(
        service,
        "stop_transfer_family_server",
        return_value=response("Server stopped"),
    )

    resp = service.handle_scan_message(server_id=server_id, message=message)

    mock_stop.assert_called_once_with(server_id)
    assert extract_message(resp) == "Server stopped"

def test_is_relevant_scan_result_true_for_expected_values(service):
    for value in EXPECTED_SCAN_RESULTS:
        assert service.is_relevant_scan_result(value) is True


def test_is_relevant_scan_result_false_for_other_values(service):
    assert service.is_relevant_scan_result("CLEAN") is False
    assert service.is_relevant_scan_result("") is False
    assert service.is_relevant_scan_result(None) is False

def test_has_required_fields_true_when_bucket_and_key_present(service):
    assert service.has_required_fields("bucket", "key") is True


def test_has_required_fields_false_when_bucket_or_key_missing(service):
    assert service.has_required_fields("", "key") is False
    assert service.has_required_fields("bucket", "") is False
    assert service.has_required_fields(None, "key") is False
    assert service.has_required_fields("bucket", None) is False

def test_is_quarantine_expedite_true_for_valid_quarantine_key(service):
    bucket = "cloudstoragesecquarantine-xyz"
    key = "pre-prod-staging-bulk-store/expedite/path/file.pdf"

    assert service.is_quarantine_expedite(bucket, key) is True


def test_is_quarantine_expedite_false_for_non_quarantine_bucket(service):
    bucket = "some-other-bucket"
    key = "pre-prod-staging-bulk-store/expedite/path/file.pdf"

    assert service.is_quarantine_expedite(bucket, key) is False


def test_is_quarantine_expedite_false_if_staging_bucket_not_set(
    mock_transfer_client, monkeypatch
):
    monkeypatch.delenv("STAGING_STORE_BUCKET_NAME", raising=False)
    monkeypatch.setenv("WORKSPACE", "pre-prod")

    service = ExpediteKillSwitchService()

    bucket = "cloudstoragesecquarantine-xyz"
    key = "pre-prod-staging-bulk-store/expedite/path/file.pdf"

    assert service.is_quarantine_expedite(bucket, key) is False


def test_extract_sns_message_parses_valid_event(service, sns_event):
    msg = service.extract_sns_message(sns_event)

    assert isinstance(msg, dict)
    assert msg["scanResult"] == "Infected"
    assert msg["bucket"].startswith("cloudstoragesecquarantine-")
    assert msg["key"].startswith("pre-prod-staging-bulk-store/expedite/")


def test_extract_sns_message_returns_none_for_invalid_shapes(service):
    assert service.extract_sns_message({}) is None
    assert service.extract_sns_message({"Records": []}) is None
    assert service.extract_sns_message({"Records": [{}]}) is None
    assert service.extract_sns_message({"Records": [{"Sns": {}}]}) is None

def test_stop_transfer_family_server_happy_path_stops_server(
    service, mock_transfer_client
):
    mock_transfer_client.describe_server.return_value = {"Server": {"State": "ONLINE"}}

    resp = service.stop_transfer_family_server("srv-abc")

    mock_transfer_client.describe_server.assert_called_once_with(ServerId="srv-abc")
    mock_transfer_client.stop_server.assert_called_once_with(ServerId="srv-abc")
    assert extract_message(resp) == "Server srv-abc stopped"


def test_stop_transfer_family_server_returns_not_found_if_server_missing(
    service, mock_transfer_client
):
    NotFound = mock_transfer_client.exceptions.ResourceNotFoundException
    mock_transfer_client.describe_server.side_effect = NotFound()

    resp = service.stop_transfer_family_server("srv-missing")

    mock_transfer_client.stop_server.assert_not_called()
    assert extract_message(resp) == "Server not found"


def test_stop_transfer_family_server_handles_generic_exception(
    service, mock_transfer_client
):
    mock_transfer_client.describe_server.side_effect = Exception("boom")

    resp = service.stop_transfer_family_server("srv-error")

    mock_transfer_client.stop_server.assert_not_called()
    assert extract_message(resp) == "Failed to stop server"

def test_handle_scan_message_ignores_irrelevant_scan_result(service, mocker):
    message = {
        "scanResult": "Clean",
        "bucket": "cloudstoragesecquarantine-abc",
        "key": "pre-prod-staging-bulk-store/expedite/folder/file.pdf",
    }

    mock_stop = mocker.patch.object(
        service, "stop_transfer_family_server", autospec=True
    )

    resp = service.handle_scan_message(server_id="srv-abc", message=message)

    assert extract_message(resp) == "Scan result not relevant, no action taken"
    mock_stop.assert_not_called()


def test_handle_scan_message_returns_invalid_payload_when_bucket_missing(service, mocker):
    message = {
        "scanResult": "Infected",
        "key": "pre-prod-staging-bulk-store/expedite/folder/file.pdf",
    }

    mock_stop = mocker.patch.object(
        service, "stop_transfer_family_server", autospec=True
    )

    resp = service.handle_scan_message(server_id="srv-abc", message=message)

    assert extract_message(resp) == "Invalid payload (missing bucket/key)"
    mock_stop.assert_not_called()


def test_handle_scan_message_returns_invalid_payload_when_key_missing(service, mocker):
    message = {
        "scanResult": "Infected",
        "bucket": "cloudstoragesecquarantine-abc",
    }

    mock_stop = mocker.patch.object(
        service, "stop_transfer_family_server", autospec=True
    )

    resp = service.handle_scan_message(server_id="srv-abc", message=message)

    assert extract_message(resp) == "Invalid payload (missing bucket/key)"
    mock_stop.assert_not_called()


def test_handle_scan_message_not_quarantine_expedite(service, mocker):
    message = {
        "scanResult": "Infected",
        "bucket": "some-other-bucket",
        "key": "pre-prod-staging-bulk-store/expedite/folder/file.pdf",
    }

    mock_stop = mocker.patch.object(
        service, "stop_transfer_family_server", autospec=True
    )

    resp = service.handle_scan_message(server_id="srv-abc", message=message)

    assert extract_message(resp) == "Not an expedite file, no action taken"
    mock_stop.assert_not_called()


def test_handle_scan_message_non_infected_expedite(service, mocker):
    message = {
        "scanResult": "Error",
        "bucket": "cloudstoragesecquarantine-abc",
        "key": "pre-prod-staging-bulk-store/expedite/folder/file.pdf",
    }

    mock_stop = mocker.patch.object(
        service, "stop_transfer_family_server", autospec=True
    )

    resp = service.handle_scan_message(server_id="srv-abc", message=message)

    assert (
        extract_message(resp)
        == "Non-infected result for expedite file, no kill switch action"
    )
    mock_stop.assert_not_called()

def test_extract_sns_message_returns_none_on_invalid_json(service):
    event = {
        "Records": [
            {
                "Sns": {
                    "Message": "not-json-at-all",
                }
            }
        ]
    }

    msg = service.extract_sns_message(event)

    assert msg is None

def test_stop_transfer_family_server_handles_metric_failure(
    service, mock_transfer_client, mocker
):
    mock_transfer_client.describe_server.return_value = {"Server": {"State": "ONLINE"}}

    mocker.patch.object(
        service,
        "report_kill_switch_activated",
        side_effect=Exception("metric failed"),
    )

    resp = service.stop_transfer_family_server("srv-xyz")

    mock_transfer_client.describe_server.assert_called_once_with(ServerId="srv-xyz")
    mock_transfer_client.stop_server.assert_called_once_with(ServerId="srv-xyz")
    assert (
        extract_message(resp)
        == "Server srv-xyz stopped, but failed to alert the team"
    )
