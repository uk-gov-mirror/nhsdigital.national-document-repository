"""
Tests for SSH Key model functionality
"""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

from models.ssh_key import SSHKey, KeyExpiryReport


class TestSSHKeyModel:
    """Test SSH Key model functionality"""

    def test_ssh_key_age_calculation(self):
        """Test age calculation for SSH keys"""
        upload_date = datetime.now(timezone.utc) - timedelta(days=30)
        key = SSHKey(
            user_name="test-user",
            ssh_public_key_id="key-123",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=upload_date,
            server_id="s-123",
        )

        assert key.age_in_days == 30
        assert not key.is_expired
        assert not key.expires_soon
        assert key.days_until_expiry == 60

    def test_ssh_key_expiring_soon(self):
        """Test key expiring soon detection"""
        upload_date = datetime.now(timezone.utc) - timedelta(days=85)
        key = SSHKey(
            user_name="test-user",
            ssh_public_key_id="key-123",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=upload_date,
            server_id="s-123",
        )

        assert key.age_in_days == 85
        assert not key.is_expired
        assert key.expires_soon
        assert key.days_until_expiry == 5

    def test_ssh_key_expired(self):
        """Test expired key detection"""
        upload_date = datetime.now(timezone.utc) - timedelta(days=95)
        key = SSHKey(
            user_name="test-user",
            ssh_public_key_id="key-123",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=upload_date,
            server_id="s-123",
        )

        assert key.age_in_days == 95
        assert key.is_expired
        assert not key.expires_soon
        assert key.days_until_expiry == -5

    def test_ssh_key_at_expiry_boundary(self):
        """Test key exactly at 90 days (expired)"""
        upload_date = datetime.now(timezone.utc) - timedelta(days=90)
        key = SSHKey(
            user_name="test-user",
            ssh_public_key_id="key-123",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=upload_date,
            server_id="s-123",
        )

        assert key.age_in_days == 90
        assert key.is_expired
        assert not key.expires_soon
        assert key.days_until_expiry == 0

    def test_ssh_key_at_warning_boundary_lower(self):
        """Test key exactly at 83 days (start of warning period)"""
        upload_date = datetime.now(timezone.utc) - timedelta(days=83)
        key = SSHKey(
            user_name="test-user",
            ssh_public_key_id="key-123",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=upload_date,
            server_id="s-123",
        )

        assert key.age_in_days == 83
        assert not key.is_expired
        assert key.expires_soon
        assert key.days_until_expiry == 7

    def test_ssh_key_just_before_warning_period(self):
        """Test key at 82 days (not yet in warning period)"""
        upload_date = datetime.now(timezone.utc) - timedelta(days=82)
        key = SSHKey(
            user_name="test-user",
            ssh_public_key_id="key-123",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=upload_date,
            server_id="s-123",
        )

        assert key.age_in_days == 82
        assert not key.is_expired
        assert not key.expires_soon
        assert key.days_until_expiry == 8

    def test_ssh_key_with_user_email(self):
        """Test SSH key with optional user email"""
        upload_date = datetime.now(timezone.utc) - timedelta(days=30)
        key = SSHKey(
            user_name="test-user",
            ssh_public_key_id="key-123",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=upload_date,
            server_id="s-123",
            user_email="test@example.com",
        )

        assert key.user_email == "test@example.com"

    def test_ssh_key_without_user_email(self):
        """Test SSH key without optional user email"""
        upload_date = datetime.now(timezone.utc) - timedelta(days=30)
        key = SSHKey(
            user_name="test-user",
            ssh_public_key_id="key-123",
            ssh_public_key_body="ssh-rsa AAAAB3...",
            date_imported=upload_date,
            server_id="s-123",
        )

        assert key.user_email is None


class TestKeyExpiryReport:
    """Test Key Expiry Report functionality"""

    def test_empty_report(self):
        """Test empty expiry report"""
        report = KeyExpiryReport(
            expiring_soon=[], expired_keys=[], total_keys_checked=0
        )

        assert not report.has_expiring_keys
        assert not report.has_expired_keys
        assert report.total_keys_checked == 0

    def test_report_with_expiring_keys_only(self):
        """Test report with only expiring keys"""
        expiring_key = Mock()

        report = KeyExpiryReport(
            expiring_soon=[expiring_key], expired_keys=[], total_keys_checked=5
        )

        assert report.has_expiring_keys
        assert not report.has_expired_keys
        assert report.total_keys_checked == 5

    def test_report_with_expired_keys_only(self):
        """Test report with only expired keys"""
        expired_key = Mock()

        report = KeyExpiryReport(
            expiring_soon=[], expired_keys=[expired_key], total_keys_checked=5
        )

        assert not report.has_expiring_keys
        assert report.has_expired_keys
        assert report.total_keys_checked == 5

    def test_report_with_both_expiring_and_expired_keys(self):
        """Test report with both expiring and expired keys"""
        expiring_key = Mock()
        expired_key = Mock()

        report = KeyExpiryReport(
            expiring_soon=[expiring_key],
            expired_keys=[expired_key],
            total_keys_checked=10,
        )

        assert report.has_expiring_keys
        assert report.has_expired_keys
        assert report.total_keys_checked == 10

    def test_report_with_multiple_keys(self):
        """Test report with multiple keys in each category"""
        expiring_keys = [Mock(), Mock(), Mock()]
        expired_keys = [Mock(), Mock()]

        report = KeyExpiryReport(
            expiring_soon=expiring_keys,
            expired_keys=expired_keys,
            total_keys_checked=20,
        )

        assert len(report.expiring_soon) == 3
        assert len(report.expired_keys) == 2
        assert report.total_keys_checked == 20
