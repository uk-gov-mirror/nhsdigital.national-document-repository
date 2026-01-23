from typing import Dict, List

from boto3.dynamodb.conditions import Attr
from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


class ReportingDynamoRepository:
    def __init__(self, table_name: str):
        self.table_name = table_name
        self.dynamo_service = DynamoDBService()

    def get_records_for_time_window(
        self,
        start_timestamp: int,
        end_timestamp: int,
    ) -> List[Dict]:
        logger.info(
            f"Querying reporting table for window, "
            f"table_name: {self.table_name}, "
            f"start_timestamp: {start_timestamp}, "
            f"end_timestamp: {end_timestamp}",
        )

        filter_expression = Attr("Timestamp").between(
            start_timestamp,
            end_timestamp,
        )

        return self.dynamo_service.scan_whole_table(
            table_name=self.table_name,
            filter_expression=filter_expression,
        )
