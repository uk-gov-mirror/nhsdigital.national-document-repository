import pytest
from handlers.transfer_family_kill_switch_handler import lambda_handler


@pytest.fixture
def mock_service(mocker):
    service_instance = mocker.Mock()
    mocker.patch(
        "handlers.transfer_family_kill_switch_handler.ExpediteKillSwitchService",
        return_value=service_instance,
    )
    return service_instance


@pytest.fixture
def context(mocker):
    context = mocker.Mock()
    context.aws_request_id = "test-request-id"
    return context


def test_lambda_handler_delegates_to_service_handle_sns_event(mock_service, context):
    event = {"Records": []}
    expected_response = {"statusCode": 200, "body": '{"message": "ok"}'}

    mock_service.handle_sns_event.return_value = expected_response

    resp = lambda_handler(event, context)

    mock_service.handle_sns_event.assert_called_once_with(event)
    assert resp == expected_response
