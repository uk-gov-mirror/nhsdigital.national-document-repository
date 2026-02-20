import os

import pytest
from services.reporting.report_distribution_service import (
    ReportDistributionService,
    _sanitize_ses_tag_value,
)


@pytest.fixture
def required_report_distribution_env(monkeypatch):
    monkeypatch.setenv("SES_FROM_ADDRESS", "from@example.com")
    monkeypatch.setenv("PRM_MAILBOX_EMAIL", "prm@example.com")
    monkeypatch.setenv("SES_CONFIGURATION_SET", "my-config-set")


@pytest.fixture
def mock_s3_service(mocker):
    return mocker.Mock(name="S3ServiceInstance")


@pytest.fixture
def mock_contact_repo(mocker):
    repo = mocker.Mock(name="ReportContactRepositoryInstance")
    repo.get_contact_email.return_value = None
    return repo


@pytest.fixture
def mock_email_service(mocker):
    return mocker.Mock(name="EmailServiceInstance")


@pytest.fixture
def service(
    required_report_distribution_env,
    mocker,
    mock_s3_service,
    mock_contact_repo,
    mock_email_service,
):
    mocker.patch(
        "services.reporting.report_distribution_service.S3Service",
        autospec=True,
        return_value=mock_s3_service,
    )
    mocker.patch(
        "services.reporting.report_distribution_service.ReportContactRepository",
        autospec=True,
        return_value=mock_contact_repo,
    )
    mocker.patch(
        "services.reporting.report_distribution_service.EmailService",
        autospec=True,
        return_value=mock_email_service,
    )

    return ReportDistributionService(bucket="my-bucket")


@pytest.fixture
def patch_password(mocker):
    return mocker.patch(
        "services.reporting.report_distribution_service.secrets.token_urlsafe",
        return_value="pw",
    )


@pytest.fixture
def patch_send_report_emails(mocker, service):
    return mocker.patch.object(service, "send_report_emails")


@pytest.fixture
def patch_zip_encrypt(mocker):
    return mocker.patch(
        "services.reporting.report_distribution_service.zip_encrypt_file",
    )


def test_sanitize_ses_tag_value_replaces_disallowed_chars():
    assert _sanitize_ses_tag_value("A B/C") == "A_B_C"
    assert _sanitize_ses_tag_value("x@y.com") == "x@y.com"
    assert _sanitize_ses_tag_value("a.b-c_d") == "a.b-c_d"


@pytest.mark.parametrize(
    "key, expected",
    [
        ("Report-Orchestration/2026-01-01/Y12345.xlsx", "Y12345"),
        ("a/b/C789.XLSX", "C789"),
        ("a/b/report.csv", "report.csv"),
        ("just-a-name", "just-a-name"),
        ("a/b/noext", "noext"),
    ],
)
def test_extract_ods_code_from_key(key, expected):
    assert ReportDistributionService.extract_ods_code_from_key(key) == expected


def test_init_reads_env_and_wires_dependencies(
    required_report_distribution_env,
    mocker,
):
    mock_s3 = mocker.Mock(name="S3ServiceInstance")
    mock_repo = mocker.Mock(name="ReportContactRepositoryInstance")
    mock_email = mocker.Mock(name="EmailServiceInstance")

    mocked_s3_cls = mocker.patch(
        "services.reporting.report_distribution_service.S3Service",
        autospec=True,
        return_value=mock_s3,
    )
    mocked_repo_cls = mocker.patch(
        "services.reporting.report_distribution_service.ReportContactRepository",
        autospec=True,
        return_value=mock_repo,
    )
    mocked_email_cls = mocker.patch(
        "services.reporting.report_distribution_service.EmailService",
        autospec=True,
        return_value=mock_email,
    )

    svc = ReportDistributionService(bucket="bucket-1")

    mocked_s3_cls.assert_called_once_with()
    mocked_repo_cls.assert_called_once_with()
    mocked_email_cls.assert_called_once_with(default_configuration_set="my-config-set")

    assert svc.bucket == "bucket-1"
    assert svc.from_address == "from@example.com"
    assert svc.prm_mailbox == "prm@example.com"
    assert svc.s3_service is mock_s3
    assert svc.contact_repo is mock_repo
    assert svc.email_service is mock_email


def test_list_xlsx_keys_filters_only_xlsx(service, mock_s3_service):
    mock_s3_service.list_object_keys.return_value = [
        "Report-Orchestration/2026-01-01/A123.xlsx",
        "Report-Orchestration/2026-01-01/readme.txt",
        "Report-Orchestration/2026-01-01/B456.xls",
        "Report-Orchestration/2026-01-01/C789.xlsx",
        "Report-Orchestration/2026-01-01/D000.xlsx",
        "Report-Orchestration/2026-01-01/E111.xlsx.tmp",
    ]

    keys = service.list_xlsx_keys(prefix="Report-Orchestration/2026-01-01/")

    mock_s3_service.list_object_keys.assert_called_once_with(
        bucket_name="my-bucket",
        prefix="Report-Orchestration/2026-01-01/",
    )
    assert keys == [
        "Report-Orchestration/2026-01-01/A123.xlsx",
        "Report-Orchestration/2026-01-01/C789.xlsx",
        "Report-Orchestration/2026-01-01/D000.xlsx",
    ]


def test_list_xlsx_keys_returns_empty_when_no_objects(service, mock_s3_service):
    mock_s3_service.list_object_keys.return_value = []

    keys = service.list_xlsx_keys(prefix="Report-Orchestration/2026-01-01/")

    mock_s3_service.list_object_keys.assert_called_once_with(
        bucket_name="my-bucket",
        prefix="Report-Orchestration/2026-01-01/",
    )
    assert keys == []


def test_process_one_report_downloads_encrypts_and_delegates_email(
    service,
    mocker,
    mock_s3_service,
    fixed_tmpdir,
    patch_zip_encrypt,
    patch_send_report_emails,
):
    mocker.patch(
        "services.reporting.report_distribution_service.secrets.token_urlsafe",
        return_value="fixed-password",
    )

    service.process_one_report(
        ods_code="Y12345",
        key="Report-Orchestration/2026-01-01/Y12345.xlsx",
    )

    local_xlsx = os.path.join(fixed_tmpdir, "Y12345.xlsx")
    local_zip = os.path.join(fixed_tmpdir, "Y12345.zip")

    mock_s3_service.download_file.assert_called_once_with(
        "my-bucket",
        "Report-Orchestration/2026-01-01/Y12345.xlsx",
        local_xlsx,
    )

    patch_zip_encrypt.assert_called_once_with(
        input_path=local_xlsx,
        output_zip=local_zip,
        password="fixed-password",
    )

    patch_send_report_emails.assert_called_once()
    call_kwargs = patch_send_report_emails.call_args.kwargs
    assert call_kwargs["ods_code"] == "Y12345"
    assert call_kwargs["attachment_path"] == local_zip
    assert call_kwargs["password"] == "fixed-password"
    assert call_kwargs["base_tags"] == {
        "ods_code": "Y12345",
        "report_key": "Report-Orchestration_2026-01-01_Y12345.xlsx",
    }


def test_process_one_report_sanitizes_tags_in_base_tags(
    service,
    patch_password,
    patch_zip_encrypt,
    patch_send_report_emails,
):
    service.process_one_report(
        ods_code="Y 12/345",
        key="prefix/2026-01-01/Y 12/345.xlsx",
    )

    assert patch_send_report_emails.call_args.kwargs["base_tags"] == {
        "ods_code": "Y_12_345",
        "report_key": "prefix_2026-01-01_Y_12_345.xlsx",
    }


def test_process_one_report_propagates_download_errors(
    service,
    mock_s3_service,
    mocker,
):
    mock_s3_service.download_file.side_effect = RuntimeError("download failed")

    mocked_zip = mocker.patch(
        "services.reporting.report_distribution_service.zip_encrypt_file",
    )
    mocked_send = mocker.patch.object(service, "send_report_emails")

    with pytest.raises(RuntimeError, match="download failed"):
        service.process_one_report(ods_code="Y12345", key="k.xlsx")

    mocked_zip.assert_not_called()
    mocked_send.assert_not_called()


def test_process_one_report_does_not_send_email_if_zip_fails(
    service,
    mocker,
    patch_password,
):
    mocker.patch(
        "services.reporting.report_distribution_service.zip_encrypt_file",
        side_effect=RuntimeError("zip failed"),
    )
    mocked_send = mocker.patch.object(service, "send_report_emails")

    with pytest.raises(RuntimeError, match="zip failed"):
        service.process_one_report(ods_code="Y12345", key="k.xlsx")

    mocked_send.assert_not_called()


def test_process_one_report_does_not_zip_or_send_email_if_password_generation_fails(
    service,
    mocker,
    mock_s3_service,
    fixed_tmpdir,
):
    mocker.patch(
        "services.reporting.report_distribution_service.secrets.token_urlsafe",
        side_effect=RuntimeError("secrets failed"),
    )

    mocked_zip = mocker.patch(
        "services.reporting.report_distribution_service.zip_encrypt_file",
    )
    mocked_send = mocker.patch.object(service, "send_report_emails")

    with pytest.raises(RuntimeError, match="secrets failed"):
        service.process_one_report(ods_code="Y12345", key="k.xlsx")

    mock_s3_service.download_file.assert_called_once_with(
        "my-bucket",
        "k.xlsx",
        os.path.join(fixed_tmpdir, "Y12345.xlsx"),
    )
    mocked_zip.assert_not_called()
    mocked_send.assert_not_called()


@pytest.mark.parametrize(
    "contact_lookup_result, contact_lookup_side_effect, expected_method",
    [
        ("contact@example.com", None, "email_contact"),
        (None, None, "email_prm_missing_contact"),
        (None, RuntimeError("ddb down"), "email_prm_missing_contact"),
    ],
)
def test_send_report_emails_routes_correctly(
    service,
    mock_contact_repo,
    mocker,
    contact_lookup_result,
    contact_lookup_side_effect,
    expected_method,
):
    if contact_lookup_side_effect is not None:
        mock_contact_repo.get_contact_email.side_effect = contact_lookup_side_effect
    else:
        mock_contact_repo.get_contact_email.return_value = contact_lookup_result

    mocked_email_contact = mocker.patch.object(service, "email_contact")
    mocked_email_prm = mocker.patch.object(service, "email_prm_missing_contact")

    base_tags = {"ods_code": "A99999", "report_key": "k.xlsx"}

    service.send_report_emails(
        ods_code="A99999",
        attachment_path="/tmp/A99999.zip",
        password="pw",
        base_tags=base_tags,
    )

    mock_contact_repo.get_contact_email.assert_called_once_with("A99999")

    if expected_method == "email_contact":
        assert mocked_email_contact.call_args.kwargs == {
            "to_address": "contact@example.com",
            "attachment_path": "/tmp/A99999.zip",
            "password": "pw",
            "base_tags": base_tags,
        }
        mocked_email_prm.assert_not_called()
    else:
        assert mocked_email_prm.call_args.kwargs == {
            "ods_code": "A99999",
            "attachment_path": "/tmp/A99999.zip",
            "password": "pw",
            "base_tags": base_tags,
        }
        mocked_email_contact.assert_not_called()


def test_email_contact_sends_report_and_password_with_tags(service, mock_email_service):
    base_tags = {"ods_code": "Y12345", "report_key": "k.xlsx"}

    service.email_contact(
        to_address="contact@example.com",
        attachment_path="/tmp/file.zip",
        password="pw",
        base_tags=base_tags,
    )

    expected_tags = {**base_tags, "email": "contact@example.com"}

    mock_email_service.send_report_email.assert_called_once_with(
        to_address="contact@example.com",
        from_address="from@example.com",
        attachment_path="/tmp/file.zip",
        tags=expected_tags,
    )
    mock_email_service.send_password_email.assert_called_once_with(
        to_address="contact@example.com",
        from_address="from@example.com",
        password="pw",
        tags=expected_tags,
    )


def test_email_contact_does_not_send_password_if_report_email_fails(
    service,
    mock_email_service,
):
    base_tags = {"ods_code": "Y12345", "report_key": "k.xlsx"}
    mock_email_service.send_report_email.side_effect = RuntimeError("SES down")

    with pytest.raises(RuntimeError, match="SES down"):
        service.email_contact(
            to_address="contact@example.com",
            attachment_path="/tmp/file.zip",
            password="pw",
            base_tags=base_tags,
        )

    mock_email_service.send_password_email.assert_not_called()


def test_email_prm_missing_contact_sends_prm_missing_contact_email_with_tags(
    service,
    mock_email_service,
):
    base_tags = {"ods_code": "X11111", "report_key": "k.xlsx"}

    service.email_prm_missing_contact(
        ods_code="X11111",
        attachment_path="/tmp/file.zip",
        password="pw",
        base_tags=base_tags,
    )

    expected_tags = {**base_tags, "email": "prm@example.com"}

    mock_email_service.send_prm_missing_contact_email.assert_called_once_with(
        prm_mailbox="prm@example.com",
        from_address="from@example.com",
        ods_code="X11111",
        attachment_path="/tmp/file.zip",
        password="pw",
        tags=expected_tags,
    )
