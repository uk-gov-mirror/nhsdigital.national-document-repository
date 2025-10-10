import pytest



@pytest.fixture
def mock_service_with_alarm_alert(mocker):
    mocked_class = mocker.patch("handlers.im_alerting_handler.IMAlertingService")
    mocked_instance = mocked_class.return_value
    mocked_class.return_value.message = MOCK_ALARM_SNS_ALERT
    return mocked_instance

