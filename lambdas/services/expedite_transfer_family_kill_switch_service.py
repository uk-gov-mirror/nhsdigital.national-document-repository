import json
import os

import boto3
from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)

EXPECTED_SCAN_RESULTS = {"Infected", "Error", "Unscannable", "Suspicious"}


def response(message: str):
    return {
        "statusCode": 200,
        "body": json.dumps({"message": message}),
    }


class ExpediteKillSwitchService:
    def __init__(self):
        self.transfer_client = boto3.client("transfer")
        self.cloudwatch = boto3.client("cloudwatch")

        self.staging_bucket = os.environ.get("STAGING_STORE_BUCKET_NAME", "")
        self.workspace = os.environ.get("WORKSPACE", "")

    def handle_sns_event(self, event: dict):
        logger.info("Received SNS virus scan notification event", {"event": event})

        server_id = self.get_transfer_server_id()
        if not server_id:
            logger.warning(
                "No Transfer Family server ID resolved from AWS – kill switch disabled."
            )
            return {
                "statusCode": 200,
                "body": json.dumps(
                    {
                        "message": (
                            "Transfer family kill switch disabled – no Transfer server ID discovered"
                        )
                    }
                ),
            }

        logger.warning(
            "Initiating Transfer Family shutdown.",
            {
                "server_id": server_id,
                "workspace": self.workspace,
            },
        )

        return self.stop_transfer_family_server(server_id)

    def handle_scan_message(self, server_id: str, message: dict):
        scan_result = message.get("scanResult")
        bucket = message.get("bucket")
        key = message.get("key")

        if not self.is_relevant_scan_result(scan_result):
            logger.info(
                f"Ignoring scan result '{scan_result}' – not one of {EXPECTED_SCAN_RESULTS}"
            )
            return response("Scan result not relevant, no action taken")

        if not self.has_required_fields(bucket, key):
            logger.error("SNS payload missing required 'bucket' or 'key' fields")
            return response("Invalid payload (missing bucket/key)")

        if not self.is_quarantine_expedite(bucket, key):
            logger.info(
                "Scan notification is not for an expedite file – no kill switch action",
                {
                    "bucket": bucket,
                    "key": key,
                    "staging_bucket": self.staging_bucket,
                    "workspace": self.workspace,
                },
            )
            return response("Not an expedite file, no action taken")

        if scan_result != "Infected":
            logger.warning(
                "Non-clean scan result for expedite file, but not 'Infected' – no kill switch action",
                {
                    "scanResult": scan_result,
                    "bucket": bucket,
                    "key": key,
                    "workspace": self.workspace,
                },
            )
            return response(
                "Non-infected result for expedite file, no kill switch action"
            )

        logger.warning(
            "Initiating Transfer Family shutdown.",
            {
                "server_id": server_id,
                "bucket": bucket,
                "key": key,
                "scanResult": scan_result,
                "workspace": self.workspace,
            },
        )

        return self.stop_transfer_family_server(server_id)

    def is_relevant_scan_result(self, scan_result: str) -> bool:
        return scan_result in EXPECTED_SCAN_RESULTS

    def has_required_fields(self, bucket: str, key: str) -> bool:
        return bool(bucket and key)

    def is_quarantine_expedite(self, bucket: str, key: str) -> bool:
        """
        Example quarantine:
          bucket = cloudstoragesecquarantine-...
          key    = "pre-prod-staging-bulk-store/expedite/..."
        Where key starts with "<workspace>-staging-bulk-store/expedite/"
        """
        if not self.staging_bucket:
            return False

        quarantine_prefix = f"{self.staging_bucket}/expedite/"
        return bucket.startswith("cloudstoragesecquarantine-") and key.startswith(
            quarantine_prefix
        )

    def get_transfer_server_id(self) -> str:
        """
        Discover Transfer Family servers in this account/region and return
        the first ServerId, or "" if none exist or an error occurs.
        """
        try:
            resp = self.transfer_client.list_servers(MaxResults=1)
            servers = resp.get("Servers", [])
            if not servers:
                logger.warning(
                    "No AWS Transfer Family servers found in account/region "
                    "– kill switch disabled."
                )
                return ""

            server_id = servers[0]["ServerId"].strip()
            logger.info(
                "Resolved Transfer server ID via list_servers",
                {"server_id": server_id},
            )
            return server_id

        except Exception as exc:
            logger.error(f"Failed to list Transfer Family servers: {exc}")
            return ""

    def extract_sns_message(self, event):
        try:
            records = event.get("Records")
            if not records:
                return None

            sns_record = records[0].get("Sns")
            if not sns_record:
                return None

            raw_message = sns_record.get("Message")
            if not raw_message:
                return None

            return json.loads(raw_message)

        except Exception as exc:
            logger.error(f"Failed to parse SNS message: {exc}")
            return None

    def stop_transfer_family_server(self, server_id: str):
        try:
            desc = self.transfer_client.describe_server(ServerId=server_id)
            logger.info(
                "Transfer Family server found",
                {"server_id": server_id, "state": desc["Server"]["State"]},
            )

            self.transfer_client.stop_server(ServerId=server_id)
            logger.warning(
                f"Transfer Family server {server_id} STOPPED due to virus scan trigger"
            )
            try:
                self.report_kill_switch_activated(server_id=server_id)
            except Exception as metric_exc:
                logger.error(
                    f"Failed to publish kill switch metric: {metric_exc},"
                    f" leading to failing to inform that kill switch has been activated"
                )
                return response(
                    f"Server {server_id} stopped, but failed to alert the team"
                )
            return response(f"Server {server_id} stopped")

        except self.transfer_client.exceptions.ResourceNotFoundException:
            logger.error(f"Transfer Family server '{server_id}' not found")
            return response("Server not found")

        except Exception as exc:
            logger.error(f"Failed to stop Transfer Family server: {exc}")
            return response("Failed to stop server")

    def report_kill_switch_activated(self, server_id: str):
        try:
            self.cloudwatch.put_metric_data(
                Namespace="Custom/TransferFamilyKillSwitch",
                MetricData=[
                    {
                        "MetricName": "ServerStopped",
                        "Dimensions": [
                            {"Name": "Workspace", "Value": self.workspace or "unknown"},
                        ],
                        "Value": 1.0,
                        "Unit": "Count",
                    }
                ],
            )
        except Exception as metric_exc:
            logger.error(
                f"Failed to publish kill switch metric: {metric_exc},"
                f" leading to failing to inform that kill switch has been activated"
            )

        logger.warning(
            f"Transfer Family server {server_id} STOPPED due to infected expedite upload"
        )
