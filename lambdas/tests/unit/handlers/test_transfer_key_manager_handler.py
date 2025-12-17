"""
Tests for Transfer Key Manager Handler
"""
import pytest
from unittest.mock import patch, Mock

from handlers.transfer_key_manager_handler import lambda_handler


class TestTransferKeyManagerHandler:
    """Test Transfer Key Manager Lambda Handler"""

    def test_lambda_handler_success(self, set_env, mocker, context):
        """Test successful lambda handler execution"""
        mocker.patch.dict(
            "os.environ",
            {"PRM_MAILBOX_EMAIL": "prm@example.com", "DRY_RUN": "true"},
        )

        mock_service = mocker.patch(
            "handlers.transfer_key_manager_handler.SSHKeyManagementService"
        )
        mock_instance = Mock()
        mock_service.return_value = mock_instance

        lambda_handler({}, context)

        mock_service.assert_called_once()
        mock_instance.process_ssh_key_expiry.assert_called_once_with(
            "prm@example.com", True
        )

    def test_lambda_handler_dry_run_false(self, set_env, mocker, context):
        """Test lambda handler with dry_run=false"""
        mocker.patch.dict(
            "os.environ",
            {"PRM_MAILBOX_EMAIL": "prm@example.com", "DRY_RUN": "false"},
        )

        mock_service = mocker.patch(
            "handlers.transfer_key_manager_handler.SSHKeyManagementService"
        )
        mock_instance = Mock()
        mock_service.return_value = mock_instance

        lambda_handler({}, context)

        mock_instance.process_ssh_key_expiry.assert_called_once_with(
            "prm@example.com", False
        )

    def test_lambda_handler_dry_run_default(self, set_env, mocker, context):
        """Test lambda handler with no DRY_RUN env var defaults to false"""
        mocker.patch.dict(
            "os.environ",
            {"PRM_MAILBOX_EMAIL": "prm@example.com"},
            clear=False,
        )
        # Ensure DRY_RUN is not set
        import os
        if "DRY_RUN" in os.environ:
            del os.environ["DRY_RUN"]

        mock_service = mocker.patch(
            "handlers.transfer_key_manager_handler.SSHKeyManagementService"
        )
        mock_instance = Mock()
        mock_service.return_value = mock_instance

        lambda_handler({}, context)

        mock_instance.process_ssh_key_expiry.assert_called_once_with(
            "prm@example.com", False
        )

    def test_lambda_handler_dry_run_case_insensitive(self, set_env, mocker, context):
        """Test lambda handler dry_run is case insensitive"""
        mocker.patch.dict(
            "os.environ",
            {"PRM_MAILBOX_EMAIL": "prm@example.com", "DRY_RUN": "TRUE"},
        )

        mock_service = mocker.patch(
            "handlers.transfer_key_manager_handler.SSHKeyManagementService"
        )
        mock_instance = Mock()
        mock_service.return_value = mock_instance

        lambda_handler({}, context)

        mock_instance.process_ssh_key_expiry.assert_called_once_with(
            "prm@example.com", True
        )

    def test_lambda_handler_sets_app_interaction(self, set_env, mocker, context):
        """Test lambda handler sets correct app interaction for logging"""
        mocker.patch.dict(
            "os.environ",
            {"PRM_MAILBOX_EMAIL": "prm@example.com", "DRY_RUN": "false"},
        )

        mock_service = mocker.patch(
            "handlers.transfer_key_manager_handler.SSHKeyManagementService"
        )
        mock_instance = Mock()
        mock_service.return_value = mock_instance

        mock_request_context = mocker.patch(
            "handlers.transfer_key_manager_handler.request_context"
        )

        lambda_handler({}, context)

        assert mock_request_context.app_interaction == "SSH Key Management"

    def test_lambda_handler_missing_env_var(self, set_env, mocker, context):
        """Test lambda handler fails when PRM_MAILBOX_EMAIL is missing"""
        # Remove the env var if it exists
        import os
        if "PRM_MAILBOX_EMAIL" in os.environ:
            del os.environ["PRM_MAILBOX_EMAIL"]

        mock_service = mocker.patch(
            "handlers.transfer_key_manager_handler.SSHKeyManagementService"
        )

        response = lambda_handler({}, context)

        # The ensure_environment_variables decorator should return an error
        assert response is not None
        mock_service.return_value.process_ssh_key_expiry.assert_not_called()

    def test_lambda_handler_service_exception(self, set_env, mocker, context):
        """Test lambda handler handles service exceptions"""
        mocker.patch.dict(
            "os.environ",
            {"PRM_MAILBOX_EMAIL": "prm@example.com", "DRY_RUN": "false"},
        )

        mock_service = mocker.patch(
            "handlers.transfer_key_manager_handler.SSHKeyManagementService"
        )
        mock_instance = Mock()
        mock_instance.process_ssh_key_expiry.side_effect = Exception("Service error")
        mock_service.return_value = mock_instance

        # The handle_lambda_exceptions decorator should catch this
        response = lambda_handler({}, context)

        # Should return an error response, not raise
        assert response is not None
