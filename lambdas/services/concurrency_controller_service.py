import boto3
from botocore.exceptions import ClientError
from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


class ConcurrencyControllerService:
    def __init__(self):
        self.lambda_client = boto3.client("lambda")

    def update_function_concurrency(self, target_function, reserved_concurrency):
        logger.info(
            f"Updating reserved concurrency for function '{target_function}' to {reserved_concurrency}"
        )

        try:
            response = self.lambda_client.put_function_concurrency(
                FunctionName=target_function,
                ReservedConcurrentExecutions=reserved_concurrency
            )
            
            updated_concurrency = response.get("ReservedConcurrentExecutions")
            
            if updated_concurrency is None:
                logger.error("Response did not contain ReservedConcurrentExecutions")
                raise ValueError("Failed to confirm concurrency update from AWS response")
            
            if updated_concurrency != reserved_concurrency:
                logger.error(
                    f"Concurrency mismatch: requested {reserved_concurrency}, "
                    f"AWS returned {updated_concurrency}"
                )
                raise ValueError("Concurrency update verification failed")
            
            logger.info(
                f"Successfully updated concurrency for '{target_function}'. "
                f"Reserved concurrency set to: {updated_concurrency}"
            )
            
            return updated_concurrency
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "ResourceNotFoundException":
                logger.error(f"Lambda function '{target_function}' not found")
            else:
                logger.error(f"Failed to update concurrency: {str(e)}")
            raise
