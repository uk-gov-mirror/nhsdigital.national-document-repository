from datetime import datetime
from typing import List, Optional

import boto3
from models.ssh_key import KeyExpiryReport, SSHKey
from utils.audit_logging_setup import LoggingService
from utils.exceptions import SSHKeyManagementException

logger = LoggingService(__name__)


class SSHKeyManagementService:
    def __init__(self):
        self.transfer_client = boto3.client("transfer")
        self.ses_client = boto3.client("ses")
        self.cloudwatch_client = boto3.client("cloudwatch")

    def process_ssh_key_expiry(self, prm_mailbox: str, dry_run: bool):
        """Main orchestration method - coordinates the SSH key management process"""
        all_keys = self.get_all_ssh_keys()

        if not all_keys:
            logger.info("No SSH keys found in Transfer Family")
            return

        expiry_report = self.analyze_key_expiry(all_keys)

        if not dry_run:
            self.send_expiry_notifications(expiry_report.expiring_soon, prm_mailbox)
        deletion_results = self.delete_expired_keys(expiry_report.expired_keys, dry_run)
        self.publish_metrics(expiry_report, deletion_results)
        self.log_summary(expiry_report, deletion_results)

    def log_summary(self, expiry_report: KeyExpiryReport, deletion_results: dict):
        """Log final summary of the SSH key management process"""
        logger.info(
            f"SSH Key Management completed: "
            f"{expiry_report.total_keys_checked} keys checked, "
            f"{len(expiry_report.expiring_soon)} expiring soon, "
            f"{len(deletion_results['successful'])} deleted, "
            f"{len(deletion_results['failed'])} failed"
        )

    def get_all_ssh_keys(self) -> List[SSHKey]:
        """Retrieve all SSH keys from AWS Transfer Family servers"""
        ssh_keys = []

        try:
            servers_response = self.transfer_client.list_servers()

            if not servers_response.get("Servers"):
                logger.info("No Transfer Family servers found")
                return ssh_keys

            for server in servers_response.get("Servers", []):
                server_id = server["ServerId"]
                ssh_keys.extend(self.get_ssh_keys_for_server(server_id))

        except Exception as e:
            logger.error(f"Error retrieving SSH keys: {str(e)}")
            raise SSHKeyManagementException(f"Failed to retrieve SSH keys: {str(e)}")

        logger.info(f"Retrieved {len(ssh_keys)} SSH keys from Transfer Family")
        return ssh_keys

    def get_ssh_keys_for_server(self, server_id: str) -> List[SSHKey]:
        """Get all SSH keys for a specific Transfer Family server"""
        ssh_keys = []

        users_response = self.transfer_client.list_users(ServerId=server_id)

        if not users_response.get("Users"):
            logger.info(f"No users found on server {server_id}")
            return ssh_keys

        for user in users_response.get("Users", []):
            user_name = user["UserName"]
            ssh_keys.extend(self.get_ssh_keys_for_user(server_id, user_name))

        return ssh_keys

    def get_ssh_keys_for_user(self, server_id: str, user_name: str) -> List[SSHKey]:
        """Get all SSH keys for a specific user on a server"""
        ssh_keys = []

        user_detail = self.transfer_client.describe_user(
            ServerId=server_id, UserName=user_name
        )

        user_data = user_detail.get("User", {})
        ssh_keys_data = user_data.get("SshPublicKeys", [])

        if not ssh_keys_data:
            logger.debug(
                f"No SSH keys found for user {user_name} on server {server_id}"
            )
            return ssh_keys

        for key_data in ssh_keys_data:
            ssh_key = SSHKey(
                user_name=user_name,
                ssh_public_key_id=key_data["SshPublicKeyId"],
                ssh_public_key_body=key_data["SshPublicKeyBody"],
                date_imported=key_data["DateImported"],
                server_id=server_id,
                user_email=self.get_user_email_from_tags(user_data),
            )
            ssh_keys.append(ssh_key)

        return ssh_keys

    def get_user_email_from_tags(self, user_data: dict) -> Optional[str]:
        """Get user email from Transfer Family user tags"""
        try:
            tags = user_data.get("Tags", [])
            for tag in tags:
                if tag.get("Key", "").lower() == "email":
                    return tag.get("Value")
            return None
        except Exception as e:
            logger.warning(f"Could not retrieve email from user tags: {str(e)}")
            return None

    def analyze_key_expiry(self, ssh_keys: List[SSHKey]) -> KeyExpiryReport:
        """Analyze SSH keys for expiry status"""
        expiring_soon = []
        expired_keys = []

        for key in ssh_keys:
            if key.is_expired:
                expired_keys.append(key)
            elif key.expires_soon:
                expiring_soon.append(key)

        report = KeyExpiryReport(
            expiring_soon=expiring_soon,
            expired_keys=expired_keys,
            total_keys_checked=len(ssh_keys),
        )

        logger.info(
            f"Key expiry analysis: {len(expired_keys)} expired, "
            f"{len(expiring_soon)} expiring soon, "
            f"{len(ssh_keys)} total keys checked"
        )

        return report

    def delete_expired_keys(
        self, expired_keys: List[SSHKey], dry_run: bool = False
    ) -> dict:
        """Delete expired SSH keys from AWS Transfer Family with error tracking"""
        results = {"successful": [], "failed": []}

        if not expired_keys:
            logger.info("No expired keys to delete")
            return results

        logger.info(f"Processing {len(expired_keys)} expired SSH keys")

        for key in expired_keys:
            self.delete_single_key(key, dry_run, results)

        logger.info(
            f"Key deletion complete: {len(results['successful'])} successful, "
            f"{len(results['failed'])} failed"
        )
        return results

    def delete_single_key(self, key: SSHKey, dry_run: bool, results: dict):
        """Delete a single SSH key and track the result"""
        try:
            if dry_run:
                logger.info(
                    f"DRY RUN: Would delete SSH key {key.ssh_public_key_id} "
                    f"for user {key.user_name} on server {key.server_id}"
                )
                results["successful"].append(key.ssh_public_key_id)
            else:
                self.transfer_client.delete_ssh_public_key(
                    ServerId=key.server_id,
                    SshPublicKeyId=key.ssh_public_key_id,
                    UserName=key.user_name,
                )
                results["successful"].append(key.ssh_public_key_id)
                logger.info(
                    f"Deleted expired SSH key {key.ssh_public_key_id} "
                    f"for user {key.user_name} on server {key.server_id}"
                )
        except Exception as e:
            error_detail = {
                "key_id": key.ssh_public_key_id,
                "user_name": key.user_name,
                "server_id": key.server_id,
                "error": str(e),
            }
            results["failed"].append(error_detail)
            logger.error(
                f"Failed to delete SSH key {key.ssh_public_key_id} "
                f"for user {key.user_name}: {str(e)}"
            )

    def send_expiry_notifications(
        self, expiring_keys: List[SSHKey], prm_mailbox: str
    ) -> bool:
        """Send email notifications for keys expiring soon"""
        if not expiring_keys:
            return True

        logger.info(f"Sending expiry notifications for {len(expiring_keys)} keys")

        try:
            keys_by_user = self.group_keys_by_user(expiring_keys)
            email_body = self.build_expiry_notification_email(keys_by_user)

            self.ses_client.send_email(
                Source=prm_mailbox,
                Destination={"ToAddresses": [prm_mailbox]},
                Message={
                    "Subject": {
                        "Data": f"SSH Key Expiry Warning - {len(expiring_keys)} keys expiring soon",
                        "Charset": "UTF-8",
                    },
                    "Body": {"Text": {"Data": email_body, "Charset": "UTF-8"}},
                },
            )

            logger.info(
                f"Sent expiry notification for {len(expiring_keys)} keys to {prm_mailbox}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to send expiry notifications: {str(e)}")
            return False

    def group_keys_by_user(self, keys: List[SSHKey]) -> dict:
        """Group SSH keys by user for consolidated notifications"""
        keys_by_user = {}
        for key in keys:
            user_key = f"{key.user_name}@{key.server_id}"
            if user_key not in keys_by_user:
                keys_by_user[user_key] = []
            keys_by_user[user_key].append(key)
        return keys_by_user

    def build_expiry_notification_email(self, keys_by_user: dict) -> str:
        """Build email body for expiry notifications"""
        email_lines = [
            "SSH Key Expiry Warning",
            "=" * 25,
            "",
            "The following SSH keys will expire within 7 days and require customer action:",
            "",
        ]

        for user_key, keys in keys_by_user.items():
            user_name, server_id = user_key.split("@")
            email_lines.append(f"User: {user_name} (Server: {server_id})")

            for key in keys:
                email_lines.append(f"  - Key ID: {key.ssh_public_key_id}")
                email_lines.append(f"    Days until expiry: {key.days_until_expiry}")
                email_lines.append(
                    f"    Uploaded: {key.date_imported.strftime('%Y-%m-%d')}"
                )
                if key.user_email:
                    email_lines.append(f"    User Email: {key.user_email}")
                email_lines.append("")

        email_lines.extend(
            [
                "Action Required:",
                "- Contact the customers to request new SSH public keys",
                "- Keys will be automatically deleted after 90 days",
                "",
                "This is an automated notification from the SSH Key Management System.",
            ]
        )

        return "\n".join(email_lines)

    def publish_metrics(self, expiry_report: KeyExpiryReport, deletion_results: dict):
        """Publish custom CloudWatch metrics for SSH key management"""
        try:
            timestamp = datetime.now()
            metric_data = [
                {
                    "MetricName": "TotalKeysChecked",
                    "Value": expiry_report.total_keys_checked,
                    "Unit": "Count",
                    "Timestamp": timestamp,
                },
                {
                    "MetricName": "KeysExpiringSoon",
                    "Value": len(expiry_report.expiring_soon),
                    "Unit": "Count",
                    "Timestamp": timestamp,
                },
                {
                    "MetricName": "ExpiredKeysFound",
                    "Value": len(expiry_report.expired_keys),
                    "Unit": "Count",
                    "Timestamp": timestamp,
                },
                {
                    "MetricName": "KeysDeleted",
                    "Value": len(deletion_results["successful"]),
                    "Unit": "Count",
                    "Timestamp": timestamp,
                },
                {
                    "MetricName": "DeletionFailures",
                    "Value": len(deletion_results["failed"]),
                    "Unit": "Count",
                    "Timestamp": timestamp,
                },
            ]

            self.cloudwatch_client.put_metric_data(
                Namespace="SSHKeyManagement", MetricData=metric_data
            )

            logger.info("Published CloudWatch metrics for SSH key management")

        except Exception as e:
            logger.warning(f"Failed to publish CloudWatch metrics: {str(e)}")
