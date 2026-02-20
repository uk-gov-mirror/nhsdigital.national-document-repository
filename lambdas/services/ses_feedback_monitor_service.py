import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from services.base.s3_service import S3Service
from services.email_service import EmailService
from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


@dataclass(frozen=True)
class SesFeedbackMonitorConfig:
    feedback_bucket: str
    feedback_prefix: str
    prm_mailbox: str
    from_address: str
    alert_on_event_types: set[str]  # {"BOUNCE","REJECT"}


class SesFeedbackMonitorService:
    def __init__(
        self,
        *,
        s3_service: S3Service,
        email_service: EmailService,
        config: SesFeedbackMonitorConfig,
    ):
        self.s3 = s3_service
        self.email_service = email_service
        self.config = config

    @staticmethod
    def parse_sns_message(record: Dict[str, Any]) -> Dict[str, Any]:
        msg = record["Sns"]["Message"]
        return json.loads(msg) if isinstance(msg, str) else msg

    @staticmethod
    def event_type(payload: Dict[str, Any]) -> str:
        return (
            payload.get("eventType") or payload.get("notificationType") or "UNKNOWN"
        ).upper()

    @staticmethod
    def message_id(payload: Dict[str, Any]) -> str:
        mail = payload.get("mail") or {}
        return (
            mail.get("messageId")
            or payload.get("mailMessageId")
            or "unknown-message-id"
        )

    @staticmethod
    def extract_tags(payload: Dict[str, Any]) -> Dict[str, List[str]]:
        mail = payload.get("mail") or {}
        tags = mail.get("tags") or {}
        return tags if isinstance(tags, dict) else {}

    @staticmethod
    def _parse_bounce(payload: Dict[str, Any]) -> Tuple[List[str], Optional[str]]:
        recipients: List[str] = []
        b = payload.get("bounce") or {}
        bounced = b.get("bouncedRecipients") or []

        for r in bounced:
            email_addr = (r or {}).get("emailAddress")
            if email_addr:
                recipients.append(email_addr)

        diagnostic = None
        if bounced:
            diagnostic = (bounced[0] or {}).get("diagnosticCode")
        diagnostic = diagnostic or b.get("smtpResponse")

        return recipients, diagnostic

    @staticmethod
    def _parse_complaint(payload: Dict[str, Any]) -> Tuple[List[str], Optional[str]]:
        recipients: List[str] = []
        c = payload.get("complaint") or {}
        complained = c.get("complainedRecipients") or []

        for r in complained:
            email_addr = (r or {}).get("emailAddress")
            if email_addr:
                recipients.append(email_addr)

        return recipients, None

    @staticmethod
    def _parse_reject(payload: Dict[str, Any]) -> Tuple[List[str], Optional[str]]:
        r = payload.get("reject") or {}
        diagnostic = r.get("reason") or r.get("message")
        return [], diagnostic

    @staticmethod
    def extract_recipients_and_diagnostic(
        payload: Dict[str, Any],
    ) -> Tuple[List[str], Optional[str]]:
        if "bounce" in payload:
            return SesFeedbackMonitorService._parse_bounce(payload)

        if "complaint" in payload:
            return SesFeedbackMonitorService._parse_complaint(payload)

        if "reject" in payload:
            return SesFeedbackMonitorService._parse_reject(payload)

        return [], None

    @staticmethod
    def build_s3_key(prefix: str, event_type: str, message_id: str) -> str:
        now = datetime.now(timezone.utc)
        return f"{prefix.rstrip('/')}/{event_type}/{now:%Y/%m/%d}/{message_id}.json"

    def process_ses_feedback_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        stored = 0
        alerted = 0

        for record in event.get("Records") or []:
            payload = self.parse_sns_message(record)
            event_type = self.event_type(payload)
            message_id = self.message_id(payload)

            s3_key = self.build_s3_key(
                self.config.feedback_prefix,
                event_type,
                message_id,
            )

            self.s3.put_json(
                self.config.feedback_bucket,
                s3_key,
                payload,
            )
            stored += 1
            logger.info(
                f"Stored SES feedback event: type={event_type}, message_id={message_id}, "
                f"s3=s3://{self.config.feedback_bucket}/{s3_key}",
            )

            if event_type in self.config.alert_on_event_types:
                subject, body = self.build_prm_email(payload, s3_key)
                self.email_service.send_email(
                    to_address=self.config.prm_mailbox,
                    from_address=self.config.from_address,
                    subject=subject,
                    body_text=body,
                )
                alerted += 1
                logger.info(
                    f"Emailed PRM for SES feedback event: type={event_type}, message_id={message_id}",
                )

        return {"status": "ok", "stored": stored, "alerted": alerted}

    def build_prm_email(self, payload: Dict[str, Any], s3_key: str) -> Tuple[str, str]:
        et = self.event_type(payload)
        mid = self.message_id(payload)
        tags = self.extract_tags(payload)
        recipients, diagnostic = self.extract_recipients_and_diagnostic(payload)

        ods_code = (tags.get("ods_code") or [None])[0]
        report_key = (tags.get("report_key") or [None])[0]
        email_tag = (tags.get("email") or [None])[0]

        subject = f"SES {et}: messageId={mid}"
        body_lines = [
            f"Event type: {et}",
            f"Message ID: {mid}",
            f"Affected recipients: {', '.join(recipients) if recipients else '(none parsed)'}",
            f"Diagnostic: {diagnostic or '(none parsed)'}",
            "",
            f"ODS code tag: {ods_code or '(none)'}",
            f"Email tag: {email_tag or '(none)'}",
            f"Report key tag: {report_key or '(none)'}",
            "",
            f"Stored at: s3://{self.config.feedback_bucket}/{s3_key}",
            "",
            "Raw event JSON:",
            json.dumps(payload, indent=2, sort_keys=True),
        ]
        return subject, "\n".join(body_lines)
