"""
Tests for SSH Key Management Service
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

import pytest
from models.ssh_key import KeyExpiryReport, SSHKey
from services.ssh_key_management_service import SSHKeyManagementService
from utils.exceptions import SSHKeyManagementException


class TestSSHKeyManagementServiceInit:
    """Test SSH Key Management Service initialization"""

    @patch("services.ssh_key_management_service.boto3.client")
    def test_service_initialization(self, mock_boto3):
        """Test service initialization creates required clients"""
        SSHKeyManagementService()

        assert mock_boto3.call_count == 3
        mock_boto3.assert_any_call("transfer")
        mock_boto3.assert_any_call("ses")
        mock_boto3.assert_any_call("cloudwatch")


class TestGetAllSSHKeys:
    """Test get_all_ssh_keys functionality"""

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_all_ssh_keys_success(self, mock_boto3):
        """Test successful retrieval of SSH keys"""
        mock_transfer = Mock()
        mock_boto3.return_value = mock_transfer

        mock_transfer.list_servers.return_value = {"Servers": [{"ServerId": "s-123"}]}
        mock_transfer.list_users.return_value = {"Users": [{"UserName": "test-user"}]}
        mock_transfer.describe_user.return_value = {
            "User": {
                "UserName": "test-user",
                "SshPublicKeys": [
                    {
                        "SshPublicKeyId": "key-123",
                        "SshPublicKeyBody": "ssh-rsa AAAAB3...",
                        "DateImported": datetime.now(timezone.utc),
                    }
                ],
                "Tags": [{"Key": "email", "Value": "test@example.com"}],
            }
        }

        service = SSHKeyManagementService()
        keys = service.get_all_ssh_keys()

        assert len(keys) == 1
        assert keys[0].ssh_public_key_id == "key-123"
        assert keys[0].user_name == "test-user"
        assert keys[0].server_id == "s-123"
        assert keys[0].user_email == "test@example.com"

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_all_ssh_keys_no_servers(self, mock_boto3):
        """Test retrieval when no servers exist"""
        mock_transfer = Mock()
        mock_boto3.return_value = mock_transfer

        mock_transfer.list_servers.return_value = {"Servers": []}

        service = SSHKeyManagementService()
        keys = service.get_all_ssh_keys()

        assert len(keys) == 0

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_all_ssh_keys_no_users(self, mock_boto3):
        """Test retrieval when server has no users"""
        mock_transfer = Mock()
        mock_boto3.return_value = mock_transfer

        mock_transfer.list_servers.return_value = {"Servers": [{"ServerId": "s-123"}]}
        mock_transfer.list_users.return_value = {"Users": []}

        service = SSHKeyManagementService()
        keys = service.get_all_ssh_keys()

        assert len(keys) == 0

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_all_ssh_keys_user_no_keys(self, mock_boto3):
        """Test retrieval when user has no SSH keys"""
        mock_transfer = Mock()
        mock_boto3.return_value = mock_transfer

        mock_transfer.list_servers.return_value = {"Servers": [{"ServerId": "s-123"}]}
        mock_transfer.list_users.return_value = {"Users": [{"UserName": "test-user"}]}
        mock_transfer.describe_user.return_value = {
            "User": {"UserName": "test-user", "SshPublicKeys": [], "Tags": []}
        }

        service = SSHKeyManagementService()
        keys = service.get_all_ssh_keys()

        assert len(keys) == 0

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_all_ssh_keys_error(self, mock_boto3):
        """Test error handling in SSH key retrieval"""
        mock_transfer = Mock()
        mock_boto3.return_value = mock_transfer

        mock_transfer.list_servers.side_effect = Exception("API Error")

        service = SSHKeyManagementService()

        with pytest.raises(SSHKeyManagementException) as exc_info:
            service.get_all_ssh_keys()

        assert "Failed to retrieve SSH keys" in str(exc_info.value)

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_all_ssh_keys_multiple_servers_and_users(self, mock_boto3):
        """Test retrieval from multiple servers with multiple users"""
        mock_transfer = Mock()
        mock_boto3.return_value = mock_transfer

        mock_transfer.list_servers.return_value = {
            "Servers": [{"ServerId": "s-123"}, {"ServerId": "s-456"}]
        }
        mock_transfer.list_users.side_effect = [
            {"Users": [{"UserName": "user1"}, {"UserName": "user2"}]},
            {"Users": [{"UserName": "user3"}]},
        ]
        mock_transfer.describe_user.side_effect = [
            {
                "User": {
                    "UserName": "user1",
                    "SshPublicKeys": [
                        {
                            "SshPublicKeyId": "key-1",
                            "SshPublicKeyBody": "ssh-rsa AAA...",
                            "DateImported": datetime.now(timezone.utc),
                        }
                    ],
                    "Tags": [],
                }
            },
            {
                "User": {
                    "UserName": "user2",
                    "SshPublicKeys": [
                        {
                            "SshPublicKeyId": "key-2",
                            "SshPublicKeyBody": "ssh-rsa BBB...",
                            "DateImported": datetime.now(timezone.utc),
                        }
                    ],
                    "Tags": [],
                }
            },
            {
                "User": {
                    "UserName": "user3",
                    "SshPublicKeys": [
                        {
                            "SshPublicKeyId": "key-3",
                            "SshPublicKeyBody": "ssh-rsa CCC...",
                            "DateImported": datetime.now(timezone.utc),
                        }
                    ],
                    "Tags": [],
                }
            },
        ]

        service = SSHKeyManagementService()
        keys = service.get_all_ssh_keys()

        assert len(keys) == 3


class TestGetUserEmailFromTags:
    """Test get_user_email_from_tags functionality"""

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_user_email_from_tags_found(self, mock_boto3):
        """Test email extraction when tag exists"""
        service = SSHKeyManagementService()
        user_data = {"Tags": [{"Key": "email", "Value": "user@example.com"}]}

        email = service.get_user_email_from_tags(user_data)

        assert email == "user@example.com"

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_user_email_from_tags_case_insensitive(self, mock_boto3):
        """Test email extraction is case insensitive"""
        service = SSHKeyManagementService()
        user_data = {"Tags": [{"Key": "Email", "Value": "user@example.com"}]}

        email = service.get_user_email_from_tags(user_data)

        assert email == "user@example.com"

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_user_email_from_tags_not_found(self, mock_boto3):
        """Test email extraction when tag doesn't exist"""
        service = SSHKeyManagementService()
        user_data = {"Tags": [{"Key": "other", "Value": "value"}]}

        email = service.get_user_email_from_tags(user_data)

        assert email is None

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_user_email_from_tags_empty_tags(self, mock_boto3):
        """Test email extraction with empty tags"""
        service = SSHKeyManagementService()
        user_data = {"Tags": []}

        email = service.get_user_email_from_tags(user_data)

        assert email is None

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_user_email_from_tags_no_tags_key(self, mock_boto3):
        """Test email extraction when Tags key is missing"""
        service = SSHKeyManagementService()
        user_data = {}

        email = service.get_user_email_from_tags(user_data)

        assert email is None

    @patch("services.ssh_key_management_service.boto3.client")
    def test_get_user_email_from_tags_exception(self, mock_boto3):
        """Test email extraction handles exceptions gracefully"""
        service = SSHKeyManagementService()
        # Pass something that will cause an exception when iterating
        user_data = {"Tags": None}

        email = service.get_user_email_from_tags(user_data)

        assert email is None


class TestAnalyzeKeyExpiry:
    """Test analyze_key_expiry functionality"""

    @patch("services.ssh_key_management_service.boto3.client")
    def test_analyze_key_expiry(self, mock_boto3):
        """Test key expiry analysis"""
        service = SSHKeyManagementService()

        normal_key = SSHKey(
            user_name="user1",
            ssh_public_key_id="key-1",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=datetime.now(timezone.utc) - timedelta(days=30),
            server_id="s-123",
        )

        expiring_key = SSHKey(
            user_name="user2",
            ssh_public_key_id="key-2",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=datetime.now(timezone.utc) - timedelta(days=85),
            server_id="s-123",
        )

        expired_key = SSHKey(
            user_name="user3",
            ssh_public_key_id="key-3",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=datetime.now(timezone.utc) - timedelta(days=95),
            server_id="s-123",
        )

        keys = [normal_key, expiring_key, expired_key]
        report = service.analyze_key_expiry(keys)

        assert report.total_keys_checked == 3
        assert len(report.expiring_soon) == 1
        assert len(report.expired_keys) == 1
        assert report.expiring_soon[0].ssh_public_key_id == "key-2"
        assert report.expired_keys[0].ssh_public_key_id == "key-3"

    @patch("services.ssh_key_management_service.boto3.client")
    def test_analyze_key_expiry_empty_list(self, mock_boto3):
        """Test key expiry analysis with empty list"""
        service = SSHKeyManagementService()

        report = service.analyze_key_expiry([])

        assert report.total_keys_checked == 0
        assert len(report.expiring_soon) == 0
        assert len(report.expired_keys) == 0

    @patch("services.ssh_key_management_service.boto3.client")
    def test_analyze_key_expiry_all_normal(self, mock_boto3):
        """Test key expiry analysis when all keys are normal"""
        service = SSHKeyManagementService()

        keys = [
            SSHKey(
                user_name=f"user{i}",
                ssh_public_key_id=f"key-{i}",
                ssh_public_key_body="ssh-rsa AAAAB3...",
                date_imported=datetime.now(timezone.utc) - timedelta(days=30),
                server_id="s-123",
            )
            for i in range(5)
        ]

        report = service.analyze_key_expiry(keys)

        assert report.total_keys_checked == 5
        assert len(report.expiring_soon) == 0
        assert len(report.expired_keys) == 0


class TestDeleteExpiredKeys:
    """Test delete_expired_keys functionality"""

    @patch("services.ssh_key_management_service.boto3.client")
    def test_delete_expired_keys_success(self, mock_boto3):
        """Test successful deletion of expired keys"""
        mock_transfer = Mock()
        mock_boto3.return_value = mock_transfer

        service = SSHKeyManagementService()

        expired_key = SSHKey(
            user_name="user1",
            ssh_public_key_id="key-1",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=datetime.now(timezone.utc) - timedelta(days=95),
            server_id="s-123",
        )

        results = service.delete_expired_keys([expired_key], dry_run=False)

        assert len(results["successful"]) == 1
        assert results["successful"][0] == "key-1"
        assert len(results["failed"]) == 0
        mock_transfer.delete_ssh_public_key.assert_called_once_with(
            ServerId="s-123", SshPublicKeyId="key-1", UserName="user1"
        )

    @patch("services.ssh_key_management_service.boto3.client")
    def test_delete_expired_keys_dry_run(self, mock_boto3):
        """Test dry run mode doesn't actually delete keys"""
        mock_transfer = Mock()
        mock_boto3.return_value = mock_transfer

        service = SSHKeyManagementService()

        expired_key = SSHKey(
            user_name="user1",
            ssh_public_key_id="key-1",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=datetime.now(timezone.utc) - timedelta(days=95),
            server_id="s-123",
        )

        results = service.delete_expired_keys([expired_key], dry_run=True)

        assert len(results["successful"]) == 1
        assert results["successful"][0] == "key-1"
        assert len(results["failed"]) == 0
        mock_transfer.delete_ssh_public_key.assert_not_called()

    @patch("services.ssh_key_management_service.boto3.client")
    def test_delete_expired_keys_with_failures(self, mock_boto3):
        """Test deletion with some failures"""
        mock_transfer = Mock()
        mock_boto3.return_value = mock_transfer

        mock_transfer.delete_ssh_public_key.side_effect = [
            None,
            Exception("Access denied"),
        ]

        service = SSHKeyManagementService()

        key1 = SSHKey(
            user_name="user1",
            ssh_public_key_id="key-1",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=datetime.now(timezone.utc) - timedelta(days=95),
            server_id="s-123",
        )

        key2 = SSHKey(
            user_name="user2",
            ssh_public_key_id="key-2",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=datetime.now(timezone.utc) - timedelta(days=95),
            server_id="s-123",
        )

        results = service.delete_expired_keys([key1, key2], dry_run=False)

        assert len(results["successful"]) == 1
        assert results["successful"][0] == "key-1"
        assert len(results["failed"]) == 1
        assert results["failed"][0]["key_id"] == "key-2"
        assert "Access denied" in results["failed"][0]["error"]

    @patch("services.ssh_key_management_service.boto3.client")
    def test_delete_expired_keys_empty_list(self, mock_boto3):
        """Test deletion with empty list"""
        mock_transfer = Mock()
        mock_boto3.return_value = mock_transfer

        service = SSHKeyManagementService()

        results = service.delete_expired_keys([], dry_run=False)

        assert len(results["successful"]) == 0
        assert len(results["failed"]) == 0
        mock_transfer.delete_ssh_public_key.assert_not_called()


class TestSendExpiryNotifications:
    """Test send_expiry_notifications functionality"""

    @patch("services.ssh_key_management_service.boto3.client")
    def test_send_expiry_notifications_success(self, mock_boto3):
        """Test successful sending of expiry notifications"""
        mock_ses = Mock()
        mock_boto3.return_value = mock_ses

        service = SSHKeyManagementService()

        expiring_key = SSHKey(
            user_name="user1",
            ssh_public_key_id="key-1",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=datetime.now(timezone.utc) - timedelta(days=85),
            server_id="s-123",
            user_email="user@example.com",
        )

        success = service.send_expiry_notifications([expiring_key], "prm@example.com")

        assert success
        mock_ses.send_email.assert_called_once()

        call_args = mock_ses.send_email.call_args[1]
        assert call_args["Source"] == "prm@example.com"
        assert "prm@example.com" in call_args["Destination"]["ToAddresses"]
        assert "SSH Key Expiry Warning" in call_args["Message"]["Subject"]["Data"]

    @patch("services.ssh_key_management_service.boto3.client")
    def test_send_expiry_notifications_empty_list(self, mock_boto3):
        """Test notification with empty list returns True"""
        mock_ses = Mock()
        mock_boto3.return_value = mock_ses

        service = SSHKeyManagementService()

        success = service.send_expiry_notifications([], "prm@example.com")

        assert success
        mock_ses.send_email.assert_not_called()

    @patch("services.ssh_key_management_service.boto3.client")
    def test_send_expiry_notifications_failure(self, mock_boto3):
        """Test notification failure returns False"""
        mock_ses = Mock()
        mock_ses.send_email.side_effect = Exception("SES Error")
        mock_boto3.return_value = mock_ses

        service = SSHKeyManagementService()

        expiring_key = SSHKey(
            user_name="user1",
            ssh_public_key_id="key-1",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=datetime.now(timezone.utc) - timedelta(days=85),
            server_id="s-123",
        )

        success = service.send_expiry_notifications([expiring_key], "prm@example.com")

        assert not success


class TestGroupKeysByUser:
    """Test group_keys_by_user functionality"""

    @patch("services.ssh_key_management_service.boto3.client")
    def test_group_keys_by_user(self, mock_boto3):
        """Test grouping keys by user"""
        service = SSHKeyManagementService()

        keys = [
            SSHKey(
                user_name="user1",
                ssh_public_key_id="key-1",
                ssh_public_key_body="ssh-rsa AAA...",
                date_imported=datetime.now(timezone.utc),
                server_id="s-123",
            ),
            SSHKey(
                user_name="user1",
                ssh_public_key_id="key-2",
                ssh_public_key_body="ssh-rsa BBB...",
                date_imported=datetime.now(timezone.utc),
                server_id="s-123",
            ),
            SSHKey(
                user_name="user2",
                ssh_public_key_id="key-3",
                ssh_public_key_body="ssh-rsa CCC...",
                date_imported=datetime.now(timezone.utc),
                server_id="s-456",
            ),
        ]

        grouped = service.group_keys_by_user(keys)

        assert len(grouped) == 2
        assert "user1@s-123" in grouped
        assert "user2@s-456" in grouped
        assert len(grouped["user1@s-123"]) == 2
        assert len(grouped["user2@s-456"]) == 1


class TestBuildExpiryNotificationEmail:
    """Test build_expiry_notification_email functionality"""

    @patch("services.ssh_key_management_service.boto3.client")
    def test_build_expiry_notification_email(self, mock_boto3):
        """Test email body generation"""
        service = SSHKeyManagementService()

        key = SSHKey(
            user_name="user1",
            ssh_public_key_id="key-1",
            ssh_public_key_body="ssh-rsa AAA...",
            date_imported=datetime.now(timezone.utc) - timedelta(days=85),
            server_id="s-123",
            user_email="user@example.com",
        )

        keys_by_user = {"user1@s-123": [key]}
        email_body = service.build_expiry_notification_email(keys_by_user)

        assert "SSH Key Expiry Warning" in email_body
        assert "user1" in email_body
        assert "s-123" in email_body
        assert "key-1" in email_body
        assert "user@example.com" in email_body
        assert "Action Required" in email_body


class TestPublishMetrics:
    """Test publish_metrics functionality"""

    @patch("services.ssh_key_management_service.boto3.client")
    def test_publish_metrics_success(self, mock_boto3):
        """Test successful metrics publishing"""
        mock_cloudwatch = Mock()
        mock_boto3.return_value = mock_cloudwatch

        service = SSHKeyManagementService()

        report = KeyExpiryReport(
            expiring_soon=[Mock()], expired_keys=[Mock(), Mock()], total_keys_checked=10
        )
        deletion_results = {"successful": ["key-1"], "failed": []}

        service.publish_metrics(report, deletion_results)

        mock_cloudwatch.put_metric_data.assert_called_once()
        call_args = mock_cloudwatch.put_metric_data.call_args[1]
        assert call_args["Namespace"] == "SSHKeyManagement"
        assert len(call_args["MetricData"]) == 5

    @patch("services.ssh_key_management_service.boto3.client")
    def test_publish_metrics_failure_logs_warning(self, mock_boto3):
        """Test metrics publishing failure doesn't raise exception"""
        mock_cloudwatch = Mock()
        mock_cloudwatch.put_metric_data.side_effect = Exception("CloudWatch Error")
        mock_boto3.return_value = mock_cloudwatch

        service = SSHKeyManagementService()

        report = KeyExpiryReport(
            expiring_soon=[], expired_keys=[], total_keys_checked=0
        )
        deletion_results = {"successful": [], "failed": []}

        # Should not raise exception
        service.publish_metrics(report, deletion_results)


class TestProcessSSHKeyExpiry:
    """Test process_ssh_key_expiry orchestration"""

    @patch("services.ssh_key_management_service.boto3.client")
    def test_process_ssh_key_expiry_no_keys(self, mock_boto3):
        """Test process_ssh_key_expiry when no keys exist"""
        mock_transfer = Mock()
        mock_boto3.return_value = mock_transfer

        mock_transfer.list_servers.return_value = {"Servers": []}

        service = SSHKeyManagementService()
        service.process_ssh_key_expiry("prm@example.com", dry_run=True)

        # Should complete without error when no keys found

    @patch("services.ssh_key_management_service.boto3.client")
    def test_process_ssh_key_expiry_with_expiring_keys(self, mock_boto3):
        """Test process_ssh_key_expiry sends notifications for expiring keys"""
        mock_client = Mock()
        mock_boto3.return_value = mock_client

        mock_client.list_servers.return_value = {"Servers": [{"ServerId": "s-123"}]}
        mock_client.list_users.return_value = {"Users": [{"UserName": "test-user"}]}
        mock_client.describe_user.return_value = {
            "User": {
                "UserName": "test-user",
                "SshPublicKeys": [
                    {
                        "SshPublicKeyId": "key-123",
                        "SshPublicKeyBody": "ssh-rsa AAAAB3...",
                        "DateImported": datetime.now(timezone.utc) - timedelta(days=85),
                    }
                ],
                "Tags": [],
            }
        }

        service = SSHKeyManagementService()
        service.process_ssh_key_expiry("prm@example.com", dry_run=False)

        mock_client.send_email.assert_called_once()

    @patch("services.ssh_key_management_service.boto3.client")
    def test_process_ssh_key_expiry_with_expired_keys_dry_run(self, mock_boto3):
        """Test process_ssh_key_expiry doesn't delete in dry run mode"""
        mock_client = Mock()
        mock_boto3.return_value = mock_client

        mock_client.list_servers.return_value = {"Servers": [{"ServerId": "s-123"}]}
        mock_client.list_users.return_value = {"Users": [{"UserName": "test-user"}]}
        mock_client.describe_user.return_value = {
            "User": {
                "UserName": "test-user",
                "SshPublicKeys": [
                    {
                        "SshPublicKeyId": "key-123",
                        "SshPublicKeyBody": "ssh-rsa AAAAB3...",
                        "DateImported": datetime.now(timezone.utc) - timedelta(days=95),
                    }
                ],
                "Tags": [],
            }
        }

        service = SSHKeyManagementService()
        service.process_ssh_key_expiry("prm@example.com", dry_run=True)

        mock_client.delete_ssh_public_key.assert_not_called()

    @patch("services.ssh_key_management_service.boto3.client")
    def test_process_ssh_key_expiry_with_expired_keys_actual_delete(self, mock_boto3):
        """Test process_ssh_key_expiry deletes expired keys when not dry run"""
        mock_client = Mock()
        mock_boto3.return_value = mock_client

        mock_client.list_servers.return_value = {"Servers": [{"ServerId": "s-123"}]}
        mock_client.list_users.return_value = {"Users": [{"UserName": "test-user"}]}
        mock_client.describe_user.return_value = {
            "User": {
                "UserName": "test-user",
                "SshPublicKeys": [
                    {
                        "SshPublicKeyId": "key-123",
                        "SshPublicKeyBody": "ssh-rsa AAAAB3...",
                        "DateImported": datetime.now(timezone.utc) - timedelta(days=95),
                    }
                ],
                "Tags": [],
            }
        }

        service = SSHKeyManagementService()
        service.process_ssh_key_expiry("prm@example.com", dry_run=False)

        mock_client.delete_ssh_public_key.assert_called_once_with(
            ServerId="s-123", SshPublicKeyId="key-123", UserName="test-user"
        )


class TestLogSummary:
    """Test log_summary functionality"""

    @patch("services.ssh_key_management_service.boto3.client")
    def test_log_summary(self, mock_boto3, caplog):
        """Test log summary output"""
        service = SSHKeyManagementService()

        report = KeyExpiryReport(
            expiring_soon=[Mock()], expired_keys=[Mock(), Mock()], total_keys_checked=10
        )
        deletion_results = {
            "successful": ["key-1", "key-2"],
            "failed": [{"key_id": "key-3"}],
        }

        service.log_summary(report, deletion_results)

        assert "SSH Key Management completed" in caplog.text
        assert "10 keys checked" in caplog.text
        assert "1 expiring soon" in caplog.text
        assert "2 deleted" in caplog.text
        assert "1 failed" in caplog.text
