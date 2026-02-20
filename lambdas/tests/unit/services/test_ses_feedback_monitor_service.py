import json
from datetime import datetime, timezone

import pytest
from services.ses_feedback_monitor_service import (
    SesFeedbackMonitorConfig,
    SesFeedbackMonitorService,
)


@pytest.fixture
def config():
    return SesFeedbackMonitorConfig(
        feedback_bucket="feedback-bucket",
        feedback_prefix="ses/feedback",
        prm_mailbox="prm@example.com",
        from_address="from@example.com",
        alert_on_event_types={"BOUNCE", "REJECT"},
    )


@pytest.fixture
def s3_service(mocker):
    return mocker.Mock()


@pytest.fixture
def email_service(mocker):
    return mocker.Mock()


@pytest.fixture
def svc(s3_service, email_service, config):
    return SesFeedbackMonitorService(
        s3_service=s3_service,
        email_service=email_service,
        config=config,
    )


def test_parse_sns_message_parses_json_string():
    record = {"Sns": {"Message": json.dumps({"a": 1, "eventType": "bounce"})}}
    payload = SesFeedbackMonitorService.parse_sns_message(record)
    assert payload == {"a": 1, "eventType": "bounce"}


def test_parse_sns_message_returns_non_string_message_as_is():
    record = {"Sns": {"Message": {"a": 1}}}
    payload = SesFeedbackMonitorService.parse_sns_message(record)
    assert payload == {"a": 1}


@pytest.mark.parametrize(
    "payload, expected",
    [
        ({"eventType": "bounce"}, "BOUNCE"),
        ({"notificationType": "complaint"}, "COMPLAINT"),
        ({"eventType": None, "notificationType": None}, "UNKNOWN"),
        ({}, "UNKNOWN"),
    ],
)
def test_event_type(payload, expected):
    assert SesFeedbackMonitorService.event_type(payload) == expected


@pytest.mark.parametrize(
    "payload, expected",
    [
        ({"mail": {"messageId": "m1"}}, "m1"),
        ({"mailMessageId": "legacy"}, "legacy"),
        ({}, "unknown-message-id"),
        ({"mail": {}}, "unknown-message-id"),
    ],
)
def test_message_id(payload, expected):
    assert SesFeedbackMonitorService.message_id(payload) == expected


def test_extract_tags_returns_dict_or_empty():
    assert SesFeedbackMonitorService.extract_tags({"mail": {"tags": {"k": ["v"]}}}) == {
        "k": ["v"],
    }
    assert (
        SesFeedbackMonitorService.extract_tags({"mail": {"tags": ["not-a-dict"]}}) == {}
    )
    assert SesFeedbackMonitorService.extract_tags({"mail": {}}) == {}
    assert SesFeedbackMonitorService.extract_tags({}) == {}


def test_extract_recipients_and_diagnostic_for_bounce_uses_diagnostic_code_first():
    payload = {
        "bounce": {
            "bouncedRecipients": [
                {"emailAddress": "a@example.com", "diagnosticCode": "550 5.1.1 bad"},
                {"emailAddress": "b@example.com"},
            ],
            "smtpResponse": "fallback smtp",
        },
    }
    recipients, diagnostic = (
        SesFeedbackMonitorService.extract_recipients_and_diagnostic(payload)
    )
    assert recipients == ["a@example.com", "b@example.com"]
    assert diagnostic == "550 5.1.1 bad"


def test_extract_recipients_and_diagnostic_for_bounce_falls_back_to_smtp_response():
    payload = {
        "bounce": {
            "bouncedRecipients": [{"emailAddress": "a@example.com"}],
            "smtpResponse": "smtp fallback",
        },
    }
    recipients, diagnostic = (
        SesFeedbackMonitorService.extract_recipients_and_diagnostic(payload)
    )
    assert recipients == ["a@example.com"]
    assert diagnostic == "smtp fallback"


def test_extract_recipients_and_diagnostic_for_complaint():
    payload = {
        "complaint": {"complainedRecipients": [{"emailAddress": "x@example.com"}]},
    }
    recipients, diagnostic = (
        SesFeedbackMonitorService.extract_recipients_and_diagnostic(payload)
    )
    assert recipients == ["x@example.com"]
    assert diagnostic is None


def test_extract_recipients_and_diagnostic_for_reject():
    payload = {"reject": {"reason": "Bad content"}}
    recipients, diagnostic = (
        SesFeedbackMonitorService.extract_recipients_and_diagnostic(payload)
    )
    assert recipients == []
    assert diagnostic == "Bad content"


def test_extract_recipients_and_diagnostic_unknown_payload():
    recipients, diagnostic = (
        SesFeedbackMonitorService.extract_recipients_and_diagnostic({"eventType": "x"})
    )
    assert recipients == []
    assert diagnostic is None


def test_build_s3_key_uses_prefix_and_date_and_message_id(mocker):
    fixed_now = datetime(2026, 1, 15, 12, 34, 56, tzinfo=timezone.utc)

    module = __import__(SesFeedbackMonitorService.__module__, fromlist=["datetime"])
    mock_dt = mocker.patch.object(module, "datetime", autospec=True)
    mock_dt.now.return_value = fixed_now

    key = SesFeedbackMonitorService.build_s3_key(
        prefix="ses/feedback/",
        event_type="BOUNCE",
        message_id="mid123",
    )

    assert key == "ses/feedback/BOUNCE/2026/01/15/mid123.json"


def test_build_s3_key_strips_trailing_slash(mocker):
    fixed_now = datetime(2026, 1, 15, 0, 0, 0, tzinfo=timezone.utc)

    module = __import__(SesFeedbackMonitorService.__module__, fromlist=["datetime"])
    mock_dt = mocker.patch.object(module, "datetime", autospec=True)
    mock_dt.now.return_value = fixed_now

    key = SesFeedbackMonitorService.build_s3_key(
        prefix="pfx////",
        event_type="REJECT",
        message_id="m",
    )

    assert key == "pfx/REJECT/2026/01/15/m.json"


def test_build_prm_email_includes_expected_fields(svc):
    payload = {
        "eventType": "bounce",
        "mail": {
            "messageId": "m-1",
            "tags": {
                "ods_code": ["Y12345"],
                "report_key": ["Report-Orchestration/2026-01-01/Y12345.xlsx"],
                "email": ["contact@example.com"],
            },
        },
        "bounce": {
            "bouncedRecipients": [
                {"emailAddress": "a@example.com", "diagnosticCode": "550 bad"},
            ],
        },
    }

    subject, body = svc.build_prm_email(
        payload,
        s3_key="ses/feedback/BOUNCE/2026/01/15/m-1.json",
    )

    assert subject == "SES BOUNCE: messageId=m-1"
    assert "Event type: BOUNCE" in body
    assert "Message ID: m-1" in body
    assert "Affected recipients: a@example.com" in body
    assert "Diagnostic: 550 bad" in body
    assert "ODS code tag: Y12345" in body
    assert "Email tag: contact@example.com" in body
    assert "Report key tag: Report-Orchestration/2026-01-01/Y12345.xlsx" in body
    assert (
        "Stored at: s3://feedback-bucket/ses/feedback/BOUNCE/2026/01/15/m-1.json"
        in body
    )
    assert "Raw event JSON:" in body
    assert '"eventType": "bounce"' in body


def test_process_ses_feedback_event_stores_each_record_and_alerts_only_configured_types(
    svc,
    s3_service,
    email_service,
    mocker,
):
    mocker.patch.object(
        SesFeedbackMonitorService,
        "build_s3_key",
        return_value="ses/feedback/BOUNCE/2026/01/15/m.json",
    )

    bounce_payload = {
        "eventType": "bounce",
        "mail": {"messageId": "m"},
        "bounce": {"bouncedRecipients": []},
    }
    complaint_payload = {
        "notificationType": "complaint",
        "mail": {"messageId": "c"},
        "complaint": {"complainedRecipients": []},
    }

    event = {
        "Records": [
            {"Sns": {"Message": json.dumps(bounce_payload)}},
            {"Sns": {"Message": json.dumps(complaint_payload)}},
        ],
    }

    mocker.patch.object(svc, "build_prm_email", return_value=("subj", "body"))

    resp = svc.process_ses_feedback_event(event)

    assert resp == {"status": "ok", "stored": 2, "alerted": 1}

    assert s3_service.put_json.call_count == 2

    first_call = s3_service.put_json.call_args_list[0]
    assert first_call.args[0] == "feedback-bucket"
    assert first_call.args[1] == "ses/feedback/BOUNCE/2026/01/15/m.json"
    assert first_call.args[2] == bounce_payload

    email_service.send_email.assert_called_once_with(
        to_address="prm@example.com",
        from_address="from@example.com",
        subject="subj",
        body_text="body",
    )


def test_process_ses_feedback_event_handles_empty_records(
    svc,
    s3_service,
    email_service,
):
    resp = svc.process_ses_feedback_event({"Records": []})
    assert resp == {"status": "ok", "stored": 0, "alerted": 0}
    s3_service.put_json.assert_not_called()
    email_service.send_email.assert_not_called()


def test_process_ses_feedback_event_message_can_be_dict_not_json_string(
    svc,
    s3_service,
    email_service,
    mocker,
):
    mocker.patch.object(
        SesFeedbackMonitorService,
        "build_s3_key",
        return_value="k.json",
    )
    mocker.patch.object(svc, "build_prm_email", return_value=("s", "b"))

    payload = {
        "eventType": "reject",
        "mail": {"messageId": "m"},
        "reject": {"reason": "nope"},
    }
    event = {"Records": [{"Sns": {"Message": payload}}]}

    resp = svc.process_ses_feedback_event(event)

    assert resp == {"status": "ok", "stored": 1, "alerted": 1}
    s3_service.put_json.assert_called_once_with("feedback-bucket", "k.json", payload)
    email_service.send_email.assert_called_once()


def test__parse_bounce_collects_recipients_and_prefers_first_diagnostic_code():
    payload = {
        "bounce": {
            "bouncedRecipients": [
                {"emailAddress": "a@example.com", "diagnosticCode": "550 5.1.1 bad"},
                {"emailAddress": "b@example.com"},
                {"emailAddress": None},
            ],
            "smtpResponse": "smtp fallback",
        },
    }

    recipients, diagnostic = SesFeedbackMonitorService._parse_bounce(payload)

    assert recipients == ["a@example.com", "b@example.com"]
    assert diagnostic == "550 5.1.1 bad"


def test__parse_bounce_falls_back_to_smtp_response_when_no_diagnostic_code():
    payload = {
        "bounce": {
            "bouncedRecipients": [{"emailAddress": "a@example.com"}],
            "smtpResponse": "smtp fallback",
        },
    }

    recipients, diagnostic = SesFeedbackMonitorService._parse_bounce(payload)

    assert recipients == ["a@example.com"]
    assert diagnostic == "smtp fallback"


def test__parse_complaint_collects_recipients_and_returns_no_diagnostic():
    payload = {
        "complaint": {
            "complainedRecipients": [
                {"emailAddress": "x@example.com"},
                {"emailAddress": "y@example.com"},
                {"emailAddress": None},
            ],
        },
    }

    recipients, diagnostic = SesFeedbackMonitorService._parse_complaint(payload)

    assert recipients == ["x@example.com", "y@example.com"]
    assert diagnostic is None


def test__parse_reject_returns_reason_or_message_as_diagnostic():
    payload_reason = {"reject": {"reason": "Bad content"}}
    recipients, diagnostic = SesFeedbackMonitorService._parse_reject(payload_reason)
    assert recipients == []
    assert diagnostic == "Bad content"

    payload_message = {"reject": {"message": "Rejected by policy"}}
    recipients, diagnostic = SesFeedbackMonitorService._parse_reject(payload_message)
    assert recipients == []
    assert diagnostic == "Rejected by policy"
