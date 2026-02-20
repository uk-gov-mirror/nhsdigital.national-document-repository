import os
import re
import secrets
import tempfile
from typing import Dict, List

from repositories.reporting.report_contact_repository import ReportContactRepository
from services.base.s3_service import S3Service
from services.email_service import EmailService
from utils.audit_logging_setup import LoggingService
from utils.zip_utils import zip_encrypt_file

logger = LoggingService(__name__)

_SES_TAG_VALUE_ALLOWED = re.compile(r"[^A-Za-z0-9_\-\.@]")


def _sanitize_ses_tag_value(value: str) -> str:
    return _SES_TAG_VALUE_ALLOWED.sub("_", str(value))


class ReportDistributionService:
    def __init__(
        self,
        *,
        bucket: str,
    ):
        self.s3_service = S3Service()
        self.contact_repo = ReportContactRepository()
        self.email_service = EmailService(
            default_configuration_set=os.environ["SES_CONFIGURATION_SET"],
        )
        self.bucket = bucket
        self.from_address = os.environ["SES_FROM_ADDRESS"]
        self.prm_mailbox = os.environ["PRM_MAILBOX_EMAIL"]

    @staticmethod
    def extract_ods_code_from_key(key: str) -> str:
        filename = key.split("/")[-1]
        return filename[:-5] if filename.lower().endswith(".xlsx") else filename

    def list_xlsx_keys(self, prefix: str) -> List[str]:
        keys = self.s3_service.list_object_keys(bucket_name=self.bucket, prefix=prefix)
        return [k for k in keys if k.endswith(".xlsx")]

    def process_one_report(self, *, ods_code: str, key: str) -> None:
        base_tags: Dict[str, str] = {
            "ods_code": _sanitize_ses_tag_value(ods_code),
            "report_key": _sanitize_ses_tag_value(key),
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            local_xlsx = f"{tmpdir}/{ods_code}.xlsx"
            local_zip = f"{tmpdir}/{ods_code}.zip"

            self.s3_service.download_file(self.bucket, key, local_xlsx)

            password = secrets.token_urlsafe(16)
            zip_encrypt_file(
                input_path=local_xlsx,
                output_zip=local_zip,
                password=password,
            )

            self.send_report_emails(
                ods_code=ods_code,
                attachment_path=local_zip,
                password=password,
                base_tags=base_tags,
            )

    def send_report_emails(
        self,
        *,
        ods_code: str,
        attachment_path: str,
        password: str,
        base_tags: Dict[str, str],
    ) -> None:
        try:
            contact_email = self.contact_repo.get_contact_email(ods_code)
        except Exception:
            logger.exception(
                f"Contact lookup failed for ODS={ods_code}; falling back to PRM.",
            )
            contact_email = None

        if contact_email:
            logger.info(f"Contact found for ODS={ods_code}, emailing {contact_email}")
            self.email_contact(
                to_address=contact_email,
                attachment_path=attachment_path,
                password=password,
                base_tags=base_tags,
            )
            return

        logger.info(f"No contact found for ODS={ods_code}, sending to PRM mailbox")
        self.email_prm_missing_contact(
            ods_code=ods_code,
            attachment_path=attachment_path,
            password=password,
            base_tags=base_tags,
        )

    def email_contact(
        self,
        *,
        to_address: str,
        attachment_path: str,
        password: str,
        base_tags: Dict[str, str],
    ) -> None:
        tags = {**base_tags, "email": to_address}

        logger.info(f"Sending report email to {to_address}")
        self.email_service.send_report_email(
            to_address=to_address,
            from_address=self.from_address,
            attachment_path=attachment_path,
            tags=tags,
        )

        logger.info(f"Sending password email to {to_address}")
        self.email_service.send_password_email(
            to_address=to_address,
            from_address=self.from_address,
            password=password,
            tags=tags,
        )

    def email_prm_missing_contact(
        self,
        *,
        ods_code: str,
        attachment_path: str,
        password: str,
        base_tags: Dict[str, str],
    ) -> None:
        tags = {**base_tags, "email": self.prm_mailbox}

        self.email_service.send_prm_missing_contact_email(
            prm_mailbox=self.prm_mailbox,
            from_address=self.from_address,
            ods_code=ods_code,
            attachment_path=attachment_path,
            password=password,
            tags=tags,
        )
