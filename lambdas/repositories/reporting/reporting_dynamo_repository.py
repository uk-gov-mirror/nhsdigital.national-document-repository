from datetime import timedelta
from typing import Dict, List

from boto3.dynamodb.conditions import Key
from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService
from utils.utilities import utc_date_string, utc_date, utc_day_start_timestamp, utc_day_end_timestamp

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
        timestamp_index_name = "TimestampIndex"
        logger.info(
            "Querying reporting table via TimestampIndex for window, "
            f"table_name={self.table_name}, start_timestamp={start_timestamp}, end_timestamp={end_timestamp}",
        )

        start_date = utc_date(start_timestamp)
        end_date = utc_date(end_timestamp)

        records_for_window: List[Dict] = []
        current_date = start_date

        while current_date <= end_date:
            day_start_ts = utc_day_start_timestamp(current_date)
            day_end_ts = utc_day_end_timestamp(current_date)

            effective_start_ts = max(start_timestamp, day_start_ts)
            effective_end_ts = min(end_timestamp, day_end_ts)

            key_condition = (
                    Key("Date").eq(current_date.isoformat())
                    & Key("Timestamp").between(effective_start_ts, effective_end_ts)
            )

            records_for_day = self.dynamo_service.query_by_key_condition_expression(
                table_name=self.table_name,
                index_name=timestamp_index_name,
                key_condition_expression=key_condition,
            )

            records_for_window.extend(records_for_day)
            current_date += timedelta(days=1)

        return records_for_window