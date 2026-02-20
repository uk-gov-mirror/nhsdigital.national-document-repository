import importlib
import os

import pytest

MODULE_UNDER_TEST = "handlers.ses_feedback_monitor_handler"


@pytest.fixture
def handler_module():
    return importlib.import_module(MODULE_UNDER_TEST)


@pytest.fixture
def required_env(mocker):
    mocker.patch.dict(
        os.environ,
        {
            "SES_FEEDBACK_BUCKET_NAME": "my-feedback-bucket",
            "SES_FEEDBACK_PREFIX": "ses-feedback/",
            "PRM_MAILBOX_EMAIL": "prm@example.com",
            "SES_FROM_ADDRESS": "from@example.com",
            "ALERT_ON_EVENT_TYPES": "BOUNCE, REJECT",
        },
        clear=False,
    )


def test_lambda_handler_wires_dependencies_and_returns_service_result(
    mocker,
    handler_module,
    required_env,
):
    event = {"Records": []}
    context = mocker.Mock()
    context.aws_request_id = "req-123"

    s3_instance = mocker.Mock(name="S3ServiceInstance")
    email_instance = mocker.Mock(name="EmailServiceInstance")

    svc_instance = mocker.Mock(name="SesFeedbackMonitorServiceInstance")
    svc_instance.process_ses_feedback_event.return_value = {
        "status": "ok",
        "stored": 1,
        "alerted": 0,
    }

    mocked_s3_cls = mocker.patch.object(
        handler_module,
        "S3Service",
        autospec=True,
        return_value=s3_instance,
    )
    mocked_email_cls = mocker.patch.object(
        handler_module,
        "EmailService",
        autospec=True,
        return_value=email_instance,
    )
    mocked_svc_cls = mocker.patch.object(
        handler_module,
        "SesFeedbackMonitorService",
        autospec=True,
        return_value=svc_instance,
    )

    result = handler_module.lambda_handler(event, context)

    mocked_s3_cls.assert_called_once_with()
    mocked_email_cls.assert_called_once_with()

    mocked_svc_cls.assert_called_once()
    _, kwargs = mocked_svc_cls.call_args

    assert kwargs["s3_service"] is s3_instance
    assert kwargs["email_service"] is email_instance

    cfg = kwargs["config"]
    assert cfg.feedback_bucket == "my-feedback-bucket"
    assert cfg.feedback_prefix == "ses-feedback/"
    assert cfg.prm_mailbox == "prm@example.com"
    assert cfg.from_address == "from@example.com"
    assert cfg.alert_on_event_types == {"BOUNCE", "REJECT"}

    svc_instance.process_ses_feedback_event.assert_called_once_with(event)
    assert result == {"status": "ok", "stored": 1, "alerted": 0}


@pytest.mark.parametrize(
    "configured, expected",
    [
        ("BOUNCE,REJECT", {"BOUNCE", "REJECT"}),
        (" bounce , reject ", {"BOUNCE", "REJECT"}),
        ("BOUNCE,, ,REJECT,", {"BOUNCE", "REJECT"}),
        ("", set()),
        ("   ", set()),
        ("complaint", {"COMPLAINT"}),
    ],
)
def test_parse_alert_types(handler_module, configured, expected):
    assert handler_module.parse_alert_types(configured) == expected
