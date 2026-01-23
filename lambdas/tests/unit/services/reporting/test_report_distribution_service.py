import os
import pytest

from services.reporting.report_distribution_service import ReportDistributionService

@pytest.fixture
def mock_s3_service(mocker):
    return mocker.Mock()


@pytest.fixture
def mock_contact_repo(mocker):
    repo = mocker.Mock()
    repo.get_contact_email.return_value = None
    return repo


@pytest.fixture
def mock_email_service(mocker):
    return mocker.Mock()


@pytest.fixture
def service(mocker, mock_s3_service, mock_contact_repo, mock_email_service):
    mocker.patch("services.reporting.report_distribution_service.boto3.client", autospec=True)

    return ReportDistributionService(
        s3_service=mock_s3_service,
        contact_repo=mock_contact_repo,
        email_service=mock_email_service,
        bucket="my-bucket",
        from_address="from@example.com",
        prm_mailbox="prm@example.com",
    )

def test_extract_ods_code_from_key_strips_xlsx_extension():
    assert ReportDistributionService.extract_ods_code_from_key(
        "Report-Orchestration/2026-01-01/Y12345.xlsx"
    ) == "Y12345"


def test_extract_ods_code_from_key_is_case_insensitive():
    assert ReportDistributionService.extract_ods_code_from_key("a/b/C789.XLSX") == "C789"


def test_extract_ods_code_from_key_keeps_non_xlsx_filename():
    assert ReportDistributionService.extract_ods_code_from_key("a/b/report.csv") == "report.csv"

def test_list_xlsx_keys_filters_only_xlsx(service, mocker):
    paginator = mocker.Mock()
    paginator.paginate.return_value = [
        {
            "Contents": [
                {"Key": "Report-Orchestration/2026-01-01/A123.xlsx"},
                {"Key": "Report-Orchestration/2026-01-01/readme.txt"},
                {"Key": "Report-Orchestration/2026-01-01/B456.xls"},
                {"Key": "Report-Orchestration/2026-01-01/C789.xlsx"},
            ]
        },
        {"Contents": [{"Key": "Report-Orchestration/2026-01-01/D000.xlsx"}]},
        {},
    ]

    service._s3_client.get_paginator.return_value = paginator

    keys = service.list_xlsx_keys(prefix="Report-Orchestration/2026-01-01/")

    assert keys == [
        "Report-Orchestration/2026-01-01/A123.xlsx",
        "Report-Orchestration/2026-01-01/C789.xlsx",
        "Report-Orchestration/2026-01-01/D000.xlsx",
    ]

    service._s3_client.get_paginator.assert_called_once_with("list_objects_v2")
    paginator.paginate.assert_called_once_with(
        Bucket="my-bucket",
        Prefix="Report-Orchestration/2026-01-01/",
    )


def test_list_xlsx_keys_returns_empty_when_no_objects(service, mocker):
    paginator = mocker.Mock()
    paginator.paginate.return_value = [{"Contents": []}, {}]
    service._s3_client.get_paginator.return_value = paginator

    keys = service.list_xlsx_keys(prefix="Report-Orchestration/2026-01-01/")

    assert keys == []


def test_list_xlsx_keys_skips_pages_without_contents(service, mocker):
    paginator = mocker.Mock()
    paginator.paginate.return_value = [{}, {"Contents": [{"Key": "p/X.xlsx"}]}]
    service._s3_client.get_paginator.return_value = paginator

    keys = service.list_xlsx_keys(prefix="p/")

    assert keys == ["p/X.xlsx"]


def test_process_one_report_downloads_encrypts_and_delegates_email(
    service, mocker, mock_s3_service
):
    mocker.patch(
        "services.reporting.report_distribution_service.secrets.token_urlsafe",
        return_value="fixed-password",
    )

    fake_tmp = "/tmp/fake_tmpdir"
    td = mocker.MagicMock()
    td.__enter__.return_value = fake_tmp
    td.__exit__.return_value = False
    mocker.patch(
        "services.reporting.report_distribution_service.tempfile.TemporaryDirectory",
        return_value=td,
    )

    mocked_zip = mocker.patch(
        "services.reporting.report_distribution_service.zip_encrypt_file",
        autospec=True,
    )
    mocked_send = mocker.patch.object(service, "send_report_emails", autospec=True)

    service.process_one_report(
        ods_code="Y12345",
        key="Report-Orchestration/2026-01-01/Y12345.xlsx",
    )

    local_xlsx = os.path.join(fake_tmp, "Y12345.xlsx")
    local_zip = os.path.join(fake_tmp, "Y12345.zip")

    mock_s3_service.download_file.assert_called_once_with(
        "my-bucket",
        "Report-Orchestration/2026-01-01/Y12345.xlsx",
        local_xlsx,
    )

    mocked_zip.assert_called_once_with(
        input_path=local_xlsx,
        output_zip=local_zip,
        password="fixed-password",
    )

    mocked_send.assert_called_once_with(
        ods_code="Y12345",
        attachment_path=local_zip,
        password="fixed-password",
    )


def test_process_one_report_propagates_download_errors(service, mocker, mock_s3_service):
    mock_s3_service.download_file.side_effect = RuntimeError("download failed")

    td = mocker.MagicMock()
    td.__enter__.return_value = "/tmp/fake_tmpdir"
    td.__exit__.return_value = False
    mocker.patch(
        "services.reporting.report_distribution_service.tempfile.TemporaryDirectory",
        return_value=td,
    )

    mocked_zip = mocker.patch("services.reporting.report_distribution_service.zip_encrypt_file", autospec=True)
    mocked_send = mocker.patch.object(service, "send_report_emails", autospec=True)

    with pytest.raises(RuntimeError, match="download failed"):
        service.process_one_report(ods_code="Y12345", key="k.xlsx")

    mocked_zip.assert_not_called()
    mocked_send.assert_not_called()


def test_process_one_report_does_not_send_email_if_zip_fails(service, mocker, mock_s3_service):
    mocker.patch(
        "services.reporting.report_distribution_service.secrets.token_urlsafe",
        return_value="pw",
    )

    td = mocker.MagicMock()
    td.__enter__.return_value = "/tmp/fake_tmpdir"
    td.__exit__.return_value = False
    mocker.patch(
        "services.reporting.report_distribution_service.tempfile.TemporaryDirectory",
        return_value=td,
    )

    mocker.patch(
        "services.reporting.report_distribution_service.zip_encrypt_file",
        side_effect=RuntimeError("zip failed"),
        autospec=True,
    )
    mocked_send = mocker.patch.object(service, "send_report_emails", autospec=True)

    with pytest.raises(RuntimeError, match="zip failed"):
        service.process_one_report(ods_code="Y12345", key="k.xlsx")

    mocked_send.assert_not_called()


def test_process_one_report_does_not_zip_or_send_email_if_password_generation_fails(
    service, mocker, mock_s3_service
):
    mocker.patch(
        "services.reporting.report_distribution_service.secrets.token_urlsafe",
        side_effect=RuntimeError("secrets failed"),
    )

    fake_tmp = "/tmp/fake_tmpdir"
    td = mocker.MagicMock()
    td.__enter__.return_value = fake_tmp
    td.__exit__.return_value = False
    mocker.patch(
        "services.reporting.report_distribution_service.tempfile.TemporaryDirectory",
        return_value=td,
    )

    mocked_zip = mocker.patch(
        "services.reporting.report_distribution_service.zip_encrypt_file",
        autospec=True,
    )
    mocked_send = mocker.patch.object(service, "send_report_emails", autospec=True)

    with pytest.raises(RuntimeError, match="secrets failed"):
        service.process_one_report(ods_code="Y12345", key="k.xlsx")

    mock_s3_service.download_file.assert_called_once_with(
        "my-bucket",
        "k.xlsx",
        os.path.join(fake_tmp, "Y12345.xlsx"),
    )

    mocked_zip.assert_not_called()
    mocked_send.assert_not_called()

def test_send_report_emails_with_contact_calls_email_contact(service, mock_contact_repo, mocker):
    mock_contact_repo.get_contact_email.return_value = "contact@example.com"

    mocked_email_contact = mocker.patch.object(service, "email_contact", autospec=True)
    mocked_email_prm = mocker.patch.object(service, "email_prm_missing_contact", autospec=True)

    service.send_report_emails(
        ods_code="Y12345",
        attachment_path="/tmp/Y12345.zip",
        password="pw",
    )

    mock_contact_repo.get_contact_email.assert_called_once_with("Y12345")
    mocked_email_contact.assert_called_once_with(
        to_address="contact@example.com",
        attachment_path="/tmp/Y12345.zip",
        password="pw",
    )
    mocked_email_prm.assert_not_called()


def test_send_report_emails_without_contact_calls_email_prm(service, mock_contact_repo, mocker):
    mock_contact_repo.get_contact_email.return_value = None

    mocked_email_contact = mocker.patch.object(service, "email_contact", autospec=True)
    mocked_email_prm = mocker.patch.object(service, "email_prm_missing_contact", autospec=True)

    service.send_report_emails(
        ods_code="A99999",
        attachment_path="/tmp/A99999.zip",
        password="pw",
    )

    mock_contact_repo.get_contact_email.assert_called_once_with("A99999")
    mocked_email_prm.assert_called_once_with(
        ods_code="A99999",
        attachment_path="/tmp/A99999.zip",
        password="pw",
    )
    mocked_email_contact.assert_not_called()


def test_send_report_emails_contact_lookup_exception_falls_back_to_prm(service, mock_contact_repo, mocker):
    mock_contact_repo.get_contact_email.side_effect = RuntimeError("ddb down")

    mocked_email_contact = mocker.patch.object(service, "email_contact", autospec=True)
    mocked_email_prm = mocker.patch.object(service, "email_prm_missing_contact", autospec=True)

    service.send_report_emails(
        ods_code="A99999",
        attachment_path="/tmp/A99999.zip",
        password="pw",
    )

    mocked_email_contact.assert_not_called()
    mocked_email_prm.assert_called_once_with(
        ods_code="A99999",
        attachment_path="/tmp/A99999.zip",
        password="pw",
    )


def test_email_contact_sends_report_and_password(service, mock_email_service):
    service.email_contact(
        to_address="contact@example.com",
        attachment_path="/tmp/file.zip",
        password="pw",
    )

    mock_email_service.send_report_email.assert_called_once_with(
        to_address="contact@example.com",
        from_address="from@example.com",
        attachment_path="/tmp/file.zip",
    )
    mock_email_service.send_password_email.assert_called_once_with(
        to_address="contact@example.com",
        from_address="from@example.com",
        password="pw",
    )


def test_email_contact_sends_password_even_if_report_email_fails(service, mock_email_service):
    mock_email_service.send_report_email.side_effect = RuntimeError("SES down")

    with pytest.raises(RuntimeError, match="SES down"):
        service.email_contact(
            to_address="contact@example.com",
            attachment_path="/tmp/file.zip",
            password="pw",
        )

    mock_email_service.send_password_email.assert_not_called()


def test_email_prm_missing_contact_sends_prm_missing_contact_email(service, mock_email_service):
    service.email_prm_missing_contact(
        ods_code="X11111",
        attachment_path="/tmp/file.zip",
        password="pw",
    )

    mock_email_service.send_prm_missing_contact_email.assert_called_once_with(
        prm_mailbox="prm@example.com",
        from_address="from@example.com",
        ods_code="X11111",
        attachment_path="/tmp/file.zip",
        password="pw",
    )
