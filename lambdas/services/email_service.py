import boto3
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Iterable, Optional, Dict, Any

from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


class EmailService:
    """
    General email sender via SES (AWS Simple Email Service) Raw Email (supports attachments).
    Higher-level methods prepare inputs and call send_email().
    """

    def __init__(self):
        self.ses = boto3.client("ses")

    def send_email(
        self,
        *,
        to_address: str,
        subject: str,
        body_text: str,
        from_address: str,
        attachments: Optional[Iterable[str]] = None,
    )->Dict[str, Any]:
        msg = MIMEMultipart()
        msg["Subject"] = subject
        msg["To"] = to_address
        msg["From"] = from_address

        msg.attach(MIMEText(body_text, "plain"))

        for attachment_path in attachments or []:
            with open(attachment_path, "rb") as f:
                part = MIMEApplication(f.read())
            part.add_header(
                "Content-Disposition",
                "attachment",
                filename=attachment_path.split("/")[-1],
            )
            msg.attach(part)
        logger.info(
            f"Sending email: from={from_address!r}, to={to_address!r}, subject={subject!r}, "
            f"attachments={len(list(attachments or []))}"
        )
        return self._send_raw(msg, to_address)

    def _send_raw(self, msg: MIMEMultipart, to_address: str)->Dict[str, Any]:
        subject = msg.get("Subject", "")
        from_address = msg.get("From", "")
        logger.info(f"Sending SES raw email: subject={subject!r}, from={from_address!r}, to={to_address!r}")
        resp = self.ses.send_raw_email(
            Source=from_address,
            RawMessage={"Data": msg.as_string()},
            Destinations=[to_address],
        )

        logger.info(f"SES accepted email: subject={subject!r}, message_id={resp.get('MessageId')}")
        return resp

    def send_report_email(
        self,
        *,
        to_address: str,
        from_address: str,
        attachment_path: str,
    ):
        self.send_email(
            to_address=to_address,
            from_address=from_address,
            subject="Daily Upload Report",
            body_text="Please find your encrypted daily upload report attached.",
            attachments=[attachment_path],
        )

    def send_password_email(
        self,
        *,
        to_address: str,
        from_address: str,
        password: str,
    ):
        self.send_email(
            to_address=to_address,
            from_address=from_address,
            subject="Daily Upload Report Password",
            body_text=f"Password for your report:\n\n{password}",
        )

    def send_prm_missing_contact_email(
        self,
        *,
        prm_mailbox: str,
        from_address: str,
        ods_code: str,
        attachment_path: str,
        password: str,
    ):
        self.send_email(
            to_address=prm_mailbox,
            from_address=from_address,
            subject=f"Missing contact for ODS {ods_code}",
            body_text=(
                f"No contact found for ODS {ods_code}.\n\n"
                f"Password: {password}\n\n"
                f"Please resolve the contact and forward the report."
            ),
            attachments=[attachment_path],
        )
