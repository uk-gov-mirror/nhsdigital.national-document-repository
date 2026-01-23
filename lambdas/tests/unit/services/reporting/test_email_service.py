import pytest

from services.email_service import EmailService


@pytest.fixture
def email_service(mocker):
    mocker.patch("services.email_service.boto3.client", autospec=True)
    svc = EmailService()
    svc.ses = mocker.Mock()
    return svc

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

    call_args, call_kwargs = mocked_send_raw.call_args
    assert call_kwargs == {}

    msg_arg = call_args[0]
    to_arg = call_args[1]

    assert to_arg == "to@example.com"
    assert msg_arg["Subject"] == "Hello"
    assert msg_arg["To"] == "to@example.com"
    assert msg_arg["From"] == "from@example.com"

    raw = msg_arg.as_string()
    assert "Body text" in raw



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

    call_args, call_kwargs = mocked_send_raw.call_args
    assert call_kwargs == {}
    msg = call_args[0]
    raw = msg.as_string()

    assert 'filename="a.zip"' in raw
    assert 'filename="b.zip"' in raw
    assert "See attached" in raw



def test_send_raw_calls_ses_send_raw_email(email_service, mocker):
    from email.mime.multipart import MIMEMultipart
    msg = MIMEMultipart()
    msg["Subject"] = "S"
    msg["To"] = "to@example.com"
    msg["From"] = "from@example.com"

    email_service._send_raw(msg, "to@example.com")

    email_service.ses.send_raw_email.assert_called_once()
    call_kwargs = email_service.ses.send_raw_email.call_args.kwargs

    assert call_kwargs["Destinations"] == ["to@example.com"]
    assert "RawMessage" in call_kwargs
    assert "Data" in call_kwargs["RawMessage"]
    assert isinstance(call_kwargs["RawMessage"]["Data"], str)
    assert "Subject: S" in call_kwargs["RawMessage"]["Data"]


def test_send_report_email_calls_send_email_with_expected_inputs(email_service, mocker):
    mocked_send_email = mocker.patch.object(email_service, "send_email", autospec=True)

    email_service.send_report_email(
        to_address="to@example.com",
        from_address="from@example.com",
        attachment_path="/tmp/report.zip",
    )

    mocked_send_email.assert_called_once_with(
        to_address="to@example.com",
        from_address="from@example.com",
        subject="Daily Upload Report",
        body_text="Please find your encrypted daily upload report attached.",
        attachments=["/tmp/report.zip"],
    )


def test_send_password_email_calls_send_email_with_expected_inputs(email_service, mocker):
    mocked_send_email = mocker.patch.object(email_service, "send_email", autospec=True)

    email_service.send_password_email(
        to_address="to@example.com",
        from_address="from@example.com",
        password="pw123",
    )

    mocked_send_email.assert_called_once_with(
        to_address="to@example.com",
        from_address="from@example.com",
        subject="Daily Upload Report Password",
        body_text="Password for your report:\n\npw123",
    )


def test_send_prm_missing_contact_email_calls_send_email_with_expected_inputs(email_service, mocker):
    mocked_send_email = mocker.patch.object(email_service, "send_email", autospec=True)

    email_service.send_prm_missing_contact_email(
        prm_mailbox="prm@example.com",
        from_address="from@example.com",
        ods_code="Y12345",
        attachment_path="/tmp/report.zip",
        password="pw123",
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
    )
