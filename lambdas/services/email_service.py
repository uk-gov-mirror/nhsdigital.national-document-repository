from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Iterable, Optional

import boto3
from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


class EmailService:
    """
    General email sender via SES (AWS Simple Email Service) Raw Email (supports attachments).
    Higher-level methods prepare inputs and call send_email().
    """

    def __init__(self, *, default_configuration_set: Optional[str] = None):
        self.ses = boto3.client("ses")
        self.default_configuration_set = default_configuration_set

    def send_email(
        self,
        *,
        to_address: str,
        subject: str,
        body_text: str,
        from_address: str,
        attachments: Optional[Iterable[str]] = None,
        configuration_set: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Sends an email using SES SendRawEmail.

        If configuration_set is not provided, self.default_configuration_set is used (if set).
        """
        msg = MIMEMultipart()
        msg["Subject"] = subject
        msg["To"] = to_address
        msg["From"] = from_address

        msg.attach(MIMEText(body_text, "plain"))

        attachment_list = list(attachments or [])
        for attachment_path in attachment_list:
            with open(attachment_path, "rb") as f:
                part = MIMEApplication(f.read())
            part.add_header(
                "Content-Disposition",
                "attachment",
                filename=attachment_path.split("/")[-1],
            )
            msg.attach(part)

        effective_config_set = configuration_set or self.default_configuration_set

        logger.info(
            f"Sending email: from={from_address!r}, to={to_address!r}, subject={subject!r}, "
            f"attachments={len(attachment_list)}, configuration_set={effective_config_set!r}, tags={tags!r}",
        )

        return self._send_raw(
            msg=msg,
            to_address=to_address,
            configuration_set=effective_config_set,
            tags=tags,
        )

    def _send_raw(
        self,
        *,
        msg: MIMEMultipart,
        to_address: str,
        configuration_set: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        subject = msg.get("Subject", "")
        from_address = msg.get("From", "")

        logger.info(
            f"Sending SES raw email: subject={subject!r}, from={from_address!r}, to={to_address!r}, "
            f"configuration_set={configuration_set!r}, tags={tags!r}",
        )

        kwargs: Dict[str, Any] = {
            "Source": from_address,
            "RawMessage": {"Data": msg.as_string()},
            "Destinations": [to_address],
        }

        if configuration_set:
            kwargs["ConfigurationSetName"] = configuration_set

        if tags:
            kwargs["Tags"] = [{"Name": k, "Value": v} for k, v in tags.items()]

        resp = self.ses.send_raw_email(**kwargs)

        logger.info(
            f"SES accepted email: subject={subject!r}, message_id={resp.get('MessageId')}",
        )
        return resp

    def send_report_email(
        self,
        *,
        to_address: str,
        from_address: str,
        attachment_path: str,
        tags: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        practice_ods = tags.get("ods_code", "")
        body_text = (
            f"Dear {practice_ods}, \n"
            f"We are pleased to share that the transfer of your patient records "
            f"to the National Document Repository has been successful.\n"
            f"Please find attached an encrypted summary of the transfer"
            f" and a report for successes and rejections.\n\n"
            f"Important update – new functionality coming in March\n"
            f"From March, you will have the ability to review rejected records directly on "
            f"the National Document Repository"
            f" and choose whether to accept them into the Access and Store service.\n"
            f"Our default position is that we will hold the rejected records "
            f"until this functionality is available, so you can review and act on them online.\n"
            f"If you would prefer not to wait and for us to return the rejected records to you now, "
            f"please let us know and we can arrange to do this via egress.\n\n"
            f"In the meantime, the attached report is for information only if you wish to use "
            f"the new review portal from March.\n\n"
            f"Guidance can be sent should you wish to review the rejected records manually before "
            f"the new functionality is released. \nIn summary, this involves:\n"
            f"Checking NHS numbers and patient demographic details are correct.\n"
            f"Confirming the correct number of files were sent.\nEnsuring file names follow "
            f"the required naming standard (see guidance attached).\n\n"
            f"Once the files have been successfully reviewed and renamed, they can be re-sent for upload.\n\n"
            f"If you have any questions, please don’t hesitate to contact us at england.prm@nhs.net.\n\n"
            f"Kind regards,\n"
            f"Patient Record Management Team"
        )

        return self.send_email(
            to_address=to_address,
            from_address=from_address,
            subject=f"{practice_ods} - National Document Repository bulk upload reports",
            body_text=body_text,
            attachments=[attachment_path],
            tags=tags,
        )

    def send_password_email(
        self,
        *,
        to_address: str,
        from_address: str,
        password: str,
        tags: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        practice_ods = tags.get("ods_code", "")
        body_text = (
            f"Dear {practice_ods},\n"
            f"You have been issued a temporary password to access your reports.\n\n"
            f"Temporary Password:\n"
            f"{password}\n\n"
            f"For security reasons, "
            f"please log in as soon as possible and change this password immediately.\n"
            f"If you did not request access, or if you experience any issues logging in, "
            f"please contact\n"
            f"england.prm@nhs.net."
        )
        return self.send_email(
            to_address=to_address,
            from_address=from_address,
            subject=f"{practice_ods} - National Document Repository bulk upload reports password",
            body_text=body_text,
            tags=tags,
        )

    def send_prm_missing_contact_email(
        self,
        *,
        prm_mailbox: str,
        from_address: str,
        ods_code: str,
        attachment_path: str,
        password: str,
        tags: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        return self.send_email(
            to_address=prm_mailbox,
            from_address=from_address,
            subject=f"Missing contact for ODS {ods_code}",
            body_text=(
                f"No contact found for ODS {ods_code}.\n\n"
                f"Password: {password}\n\n"
                f"Please resolve the contact and forward the report."
            ),
            attachments=[attachment_path],
            tags=tags,
        )
