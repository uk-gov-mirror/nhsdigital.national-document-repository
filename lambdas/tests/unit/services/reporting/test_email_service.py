from unittest.mock import ANY

import pytest
from services.email_service import EmailService


@pytest.fixture
def email_service(mocker):
    mocker.patch("services.email_service.boto3.client", autospec=True)
    service = EmailService()
    service.ses = mocker.Mock()
    return service


def test_send_email_sends_raw_email_without_attachments(email_service, mocker):
    mocked_send_raw = mocker.patch.object(email_service, "_send_raw", autospec=True)

    email_service.send_email(
        to_address="to@example.com",
        subject="Hello",
        body_text="Body text",
        from_address="from@example.com",
        attachments=None,
    )

    mocked_send_raw.assert_called_once()
    call_kwargs = mocked_send_raw.call_args.kwargs

    assert set(call_kwargs.keys()) == {"msg", "to_address", "configuration_set", "tags"}
    assert call_kwargs["to_address"] == "to@example.com"
    assert call_kwargs["configuration_set"] is None
    assert call_kwargs["tags"] is None

    msg_arg = call_kwargs["msg"]
    assert msg_arg["Subject"] == "Hello"
    assert msg_arg["To"] == "to@example.com"
    assert msg_arg["From"] == "from@example.com"

    raw = msg_arg.as_string()
    assert "Body text" in raw


def test_send_email_uses_default_configuration_set_when_not_provided(mocker):
    mocker.patch("services.email_service.boto3.client", autospec=True)
    svc = EmailService(default_configuration_set="DEFAULT_CFG")
    svc.ses = mocker.Mock()

    mocked_send_raw = mocker.patch.object(svc, "_send_raw", autospec=True)

    svc.send_email(
        to_address="to@example.com",
        subject="Hello",
        body_text="Body text",
        from_address="from@example.com",
        attachments=None,
        configuration_set=None,
    )

    mocked_send_raw.assert_called_once()
    assert mocked_send_raw.call_args.kwargs["configuration_set"] == "DEFAULT_CFG"


def test_send_email_configuration_set_overrides_default(mocker):
    mocker.patch("services.email_service.boto3.client", autospec=True)
    svc = EmailService(default_configuration_set="DEFAULT_CFG")
    svc.ses = mocker.Mock()

    mocked_send_raw = mocker.patch.object(svc, "_send_raw", autospec=True)

    svc.send_email(
        to_address="to@example.com",
        subject="Hello",
        body_text="Body text",
        from_address="from@example.com",
        attachments=None,
        configuration_set="OVERRIDE_CFG",
    )

    mocked_send_raw.assert_called_once()
    assert mocked_send_raw.call_args.kwargs["configuration_set"] == "OVERRIDE_CFG"


def test_send_email_passes_tags_through_to_send_raw(email_service, mocker):
    mocked_send_raw = mocker.patch.object(email_service, "_send_raw", autospec=True)

    email_service.send_email(
        to_address="to@example.com",
        subject="Hello",
        body_text="Body text",
        from_address="from@example.com",
        tags={"k1": "v1", "k2": "v2"},
    )

    mocked_send_raw.assert_called_once()
    assert mocked_send_raw.call_args.kwargs["tags"] == {"k1": "v1", "k2": "v2"}


def test_send_email_attaches_files_and_sets_filenames(email_service, mocker):
    file_bytes_1 = b"zipbytes1"
    file_bytes_2 = b"zipbytes2"

    m1 = mocker.mock_open(read_data=file_bytes_1)
    m2 = mocker.mock_open(read_data=file_bytes_2)

    mocked_open = mocker.patch("services.email_service.open", create=True)
    mocked_open.side_effect = [m1.return_value, m2.return_value]

    mocked_send_raw = mocker.patch.object(email_service, "_send_raw", autospec=True)

    email_service.send_email(
        to_address="to@example.com",
        subject="With Attachments",
        body_text="See attached",
        from_address="from@example.com",
        attachments=["/tmp/a.zip", "/var/tmp/b.zip"],
    )

    assert mocked_open.call_count == 2
    mocked_open.assert_any_call("/tmp/a.zip", "rb")
    mocked_open.assert_any_call("/var/tmp/b.zip", "rb")

    mocked_send_raw.assert_called_once()
    msg = mocked_send_raw.call_args.kwargs["msg"]
    raw = msg.as_string()

    assert 'filename="a.zip"' in raw
    assert 'filename="b.zip"' in raw
    assert "See attached" in raw


def test_send_raw_calls_ses_send_raw_email_minimal(email_service):
    from email.mime.multipart import MIMEMultipart

    msg = MIMEMultipart()
    msg["Subject"] = "S"
    msg["To"] = "to@example.com"
    msg["From"] = "from@example.com"

    email_service.ses.send_raw_email.return_value = {"MessageId": "abc123"}

    resp = email_service._send_raw(msg=msg, to_address="to@example.com")

    assert resp == {"MessageId": "abc123"}
    email_service.ses.send_raw_email.assert_called_once()
    call_kwargs = email_service.ses.send_raw_email.call_args.kwargs

    assert call_kwargs["Source"] == "from@example.com"
    assert call_kwargs["Destinations"] == ["to@example.com"]
    assert "RawMessage" in call_kwargs
    assert "Data" in call_kwargs["RawMessage"]
    assert isinstance(call_kwargs["RawMessage"]["Data"], str)
    assert "Subject: S" in call_kwargs["RawMessage"]["Data"]

    assert "ConfigurationSetName" not in call_kwargs
    assert "Tags" not in call_kwargs


def test_send_raw_includes_configuration_set_and_tags(email_service):
    from email.mime.multipart import MIMEMultipart

    msg = MIMEMultipart()
    msg["Subject"] = "S"
    msg["To"] = "to@example.com"
    msg["From"] = "from@example.com"

    email_service.ses.send_raw_email.return_value = {"MessageId": "abc123"}

    email_service._send_raw(
        msg=msg,
        to_address="to@example.com",
        configuration_set="CFG",
        tags={"env": "test", "team": "data"},
    )

    call_kwargs = email_service.ses.send_raw_email.call_args.kwargs
    assert call_kwargs["ConfigurationSetName"] == "CFG"
    assert call_kwargs["Tags"] == [
        {"Name": "env", "Value": "test"},
        {"Name": "team", "Value": "data"},
    ]


def test_send_report_email_calls_send_email_with_expected_inputs(email_service, mocker):
    mocked_send_email = mocker.patch.object(email_service, "send_email", autospec=True)

    email_service.send_report_email(
        to_address="to@example.com",
        from_address="from@example.com",
        attachment_path="/tmp/report.zip",
        tags={"ods_code": "Y12345", "k": "v"},
    )

    mocked_send_email.assert_called_once_with(
        to_address="to@example.com",
        from_address="from@example.com",
        subject="Y12345 - National Document Repository bulk upload reports",
        body_text=ANY,
        attachments=["/tmp/report.zip"],
        tags={"ods_code": "Y12345", "k": "v"},
    )


def test_send_password_email_calls_send_email_with_expected_inputs(
    email_service,
    mocker,
):
    mocked_send_email = mocker.patch.object(email_service, "send_email", autospec=True)

    email_service.send_password_email(
        to_address="to@example.com",
        from_address="from@example.com",
        password="pw123",
        tags={"ods_code": "Y12345", "k": "v"},
    )

    mocked_send_email.assert_called_once_with(
        to_address="to@example.com",
        from_address="from@example.com",
        subject="Y12345 - National Document Repository bulk upload reports password",
        body_text=ANY,
        tags={"ods_code": "Y12345", "k": "v"},
    )

    body = mocked_send_email.call_args.kwargs["body_text"]
    assert "pw123" in body
    assert body.startswith("Dear Y12345")


def test_send_prm_missing_contact_email_calls_send_email_with_expected_inputs(
    email_service,
    mocker,
):
    mocked_send_email = mocker.patch.object(email_service, "send_email", autospec=True)

    email_service.send_prm_missing_contact_email(
        prm_mailbox="prm@example.com",
        from_address="from@example.com",
        ods_code="Y12345",
        attachment_path="/tmp/report.zip",
        password="pw123",
        tags={"k": "v"},
    )

    mocked_send_email.assert_called_once_with(
        to_address="prm@example.com",
        from_address="from@example.com",
        subject="Missing contact for ODS Y12345",
        body_text=(
            "No contact found for ODS Y12345.\n\n"
            "Password: pw123\n\n"
            "Please resolve the contact and forward the report."
        ),
        attachments=["/tmp/report.zip"],
        tags={"k": "v"},
    )
