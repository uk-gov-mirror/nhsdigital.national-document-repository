import logging

from botocore.exceptions import ClientError
from services.dynamodb_migration_service import DynamoDBMigrationService

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def extract_table_info(event):
    """
    Extracts table_name and environment either from tableArn or from separate fields.
    Supports both formats:
      - tableArn
      - tableName + environment
    """
    if "tableArn" in event:
        table_arn = str(event["tableArn"]).strip()
        if not table_arn.startswith("arn:aws:dynamodb:"):
            raise ValueError(
                "Invalid DynamoDB ARN format — must start with 'arn:aws:dynamodb:'"
            )

        # Example: "arn:aws:dynamodb:eu-west-2:533825906475:table/dev_prmp562_LloydGeorgeReferenceMetadata"
        try:
            arn_parts = table_arn.split(":")
            region = arn_parts[3]
            table_name = table_arn.split(":table/")[-1]

            # Derive environment prefix if the table is named like "dev_MyTable"
            environment = table_name.split("_")[0] if "_" in table_name else "unknown"

            return table_name, environment, region
        except Exception as e:
            raise ValueError(f"Unable to parse tableArn: {e}")

    # Fallback to option of receiving tableName and environment as variables
    elif "tableName" in event and "environment" in event:
        return str(event["tableName"]).strip(), str(event["environment"]).strip(), None

    else:
        raise ValueError(
            "Event must include either 'tableArn' or both 'tableName' and 'environment'"
        )


def validate_event_input(event):
    required_fields = ["segment", "totalSegments", "migrationScript"]
    for field in required_fields:
        if field not in event:
            raise ValueError(f"Missing required field: '{field}' in event")

    try:
        segment = int(event["segment"])
        total_segments = int(event["totalSegments"])
    except (ValueError, TypeError):
        raise ValueError("'segment' and 'totalSegments' must be integers")

    if segment < 0:
        raise ValueError("'segment' must be >= 0")
    if total_segments <= 0:
        raise ValueError("'totalSegments' must be positive")
    if segment >= total_segments:
        raise ValueError("'segment' must be less than 'totalSegments'")

    migration_script = str(event["migrationScript"]).strip()
    if not migration_script:
        raise ValueError("'migrationScript' cannot be empty")

    run_migration = bool(event.get("run_migration", False))

    table_name, environment, region = extract_table_info(event)

    return (
        segment,
        total_segments,
        table_name,
        environment,
        region,
        run_migration,
        migration_script,
    )


def lambda_handler(event, context):
    try:
        (
            segment,
            total_segments,
            table_name,
            environment,
            region,
            run_migration,
            migration_script,
        ) = validate_event_input(event)

        logger.info(
            f"Starting DynamoDB migration for table: {table_name} (env={environment}, region={region})"
        )

        service = DynamoDBMigrationService(
            segment=segment,
            total_segments=total_segments,
            table_name=table_name,
            environment=environment,
            run_migration=run_migration,
            migration_script=migration_script,
        )

        result = service.execute_migration()
        logger.info(
            f"Migration completed: status={result.get('status')}, "
            f"scanned={result.get('scannedCount')}, updated={result.get('updatedCount')}, "
            f"errors={result.get('errorCount')}"
        )
        return result

    except ClientError as aws_error:
        logger.error(f"AWS error while processing segment: {aws_error}", exc_info=True)
        raise
    except Exception as e:
        logger.error(
            f"Unexpected error in dynamodb_migration_handler: {e}", exc_info=True
        )
        raise
