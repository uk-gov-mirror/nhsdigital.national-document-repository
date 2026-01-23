import os
import secrets
import tempfile
from typing import List

import boto3

from repositories.reporting.report_contact_repository import ReportContactRepository
from services.base.s3_service import S3Service
from services.email_service import EmailService
from utils.audit_logging_setup import LoggingService
from utils.zip_utils import zip_encrypt_file

logger = LoggingService(__name__)


class ReportDistributionService:
    def __init__(
        self,
        *,
        s3_service: S3Service,
        contact_repo: ReportContactRepository,
        email_service: EmailService,
        bucket: str,
        from_address: str,
        prm_mailbox: str,
    ):
        self.s3_service = s3_service
        self.contact_repo = contact_repo
        self.email_service = email_service
        self.bucket = bucket
        self.from_address = from_address
        self.prm_mailbox = prm_mailbox
        self._s3_client = boto3.client("s3")

    @staticmethod
    def extract_ods_code_from_key(key: str) -> str:
        filename = key.split("/")[-1]
        return filename[:-5] if filename.lower().endswith(".xlsx") else filename

    def list_xlsx_keys(self, prefix: str) -> List[str]:
        paginator = self._s3_client.get_paginator("list_objects_v2")
        keys: List[str] = []

        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if key.endswith(".xlsx"):
                    keys.append(key)

        return keys

    def process_one_report(self, *, ods_code: str, key: str) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            local_xlsx = os.path.join(tmpdir, f"{ods_code}.xlsx")
            local_zip = os.path.join(tmpdir, f"{ods_code}.zip")

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
            )

    def send_report_emails(self, *, ods_code: str, attachment_path: str, password: str) -> None:
        try:
            contact_email = self.contact_repo.get_contact_email(ods_code)
        except Exception:
            logger.exception(
                f"Contact lookup failed for ODS={ods_code}; falling back to PRM."
            )
            contact_email = None

        if contact_email:
            logger.info(f"Contact found for ODS={ods_code}, emailing {contact_email}")
            self.email_contact(
                to_address=contact_email,
                attachment_path=attachment_path,
                password=password,
            )
            return

        logger.info(f"No contact found for ODS={ods_code}, sending to PRM mailbox")
        self.email_prm_missing_contact(
            ods_code=ods_code,
            attachment_path=attachment_path,
            password=password,
        )

    def email_contact(self, *, to_address: str, attachment_path: str, password: str) -> None:
        logger.info(f"Sending report email to {to_address}")
        self.email_service.send_report_email(
            to_address=to_address,
            from_address=self.from_address,
            attachment_path=attachment_path,
        )
        logger.info(f"Sending password email to {to_address}")
        self.email_service.send_password_email(
            to_address=to_address,
            from_address=self.from_address,
            password=password,
        )

    def email_prm_missing_contact(
        self, *, ods_code: str, attachment_path: str, password: str
    ) -> None:
        self.email_service.send_prm_missing_contact_email(
            prm_mailbox=self.prm_mailbox,
            from_address=self.from_address,
            ods_code=ods_code,
            attachment_path=attachment_path,
            password=password,
        )
