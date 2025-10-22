import json

import pytest
from handlers.im_alerting_handler import is_virus_scanner_topic, lambda_handler
from tests.unit.helpers.data.alerting.mock_sns_alerts import (
    MOCK_LAMBDA_ALERT_MESSAGE,
    MOCK_VIRUS_SCANNER_ALERT_SNS_MESSAGE,
)


@pytest.fixture
def mock_service_with_alarm_alert(mocker):
    mocked_class = mocker.patch("handlers.im_alerting_handler.IMAlertingService")
    mocked_instance = mocked_class.return_value
    mocker.patch.object(mocked_instance, "dynamo_service")
    mocked_class.return_value.message = MOCK_LAMBDA_ALERT_MESSAGE
    return mocked_instance


@pytest.fixture
def mock_service_with_virus_scanner_alert(mocker):
    mocked_class = mocker.patch("handlers.im_alerting_handler.IMAlertingService")
    mocked_instance = mocked_class.return_value
    mocker.patch.object(mocked_instance, "dynamo_service")
    mocked_class.return_value.message = MOCK_VIRUS_SCANNER_ALERT_SNS_MESSAGE
    return mocked_instance


def test_handler_calls_handle_alarm_message_lambda_triggered_by_alarm_message(
    mock_service_with_alarm_alert, context, set_env
):

    event = {"Records": [{"Sns": {"Message": json.dumps(MOCK_LAMBDA_ALERT_MESSAGE)}}]}
    lambda_handler(event, context)

    mock_service_with_alarm_alert.handle_virus_scanner_alert.assert_not_called()
    mock_service_with_alarm_alert.handle_alarm_alert.assert_called()


def test_handler_calls_handle_virus_scanner_alert_lambda_triggered_by_virus_scanner_sns(
    mock_service_with_virus_scanner_alert, context, set_env
):

    event = {
        "Records": [
            {
                "Sns": {
                    "TopicArn": MOCK_VIRUS_SCANNER_ALERT_SNS_MESSAGE["TopicArn"],
                    "Message": json.dumps(
                        MOCK_VIRUS_SCANNER_ALERT_SNS_MESSAGE["Message"]
                    ),
                }
            }
        ]
    }
    lambda_handler(event, context)
    mock_service_with_virus_scanner_alert.handle_virus_scanner_alert.assert_called()
    mock_service_with_virus_scanner_alert.handle_alarm_alert.assert_not_called()


def test_is_virus_scanner_topic(set_env):

    assert is_virus_scanner_topic(MOCK_VIRUS_SCANNER_ALERT_SNS_MESSAGE)
    assert not is_virus_scanner_topic(MOCK_LAMBDA_ALERT_MESSAGE)
