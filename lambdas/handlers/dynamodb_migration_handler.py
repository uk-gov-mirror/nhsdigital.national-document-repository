import logging
from botocore.exceptions import ClientError
from services.dynamodb_migration_service import DynamoDBMigrationService

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def validate_event_input(event):
    required_fields = ["segment", "totalSegments", "tableName", "environment", "migrationScript"]
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

    table_name = str(event["tableName"]).strip()
    environment = str(event["environment"]).strip()
    migration_script = str(event["migrationScript"]).strip()
    run_migration = bool(event.get("run_migration", False))

    if not table_name:
        raise ValueError("'tableName' cannot be empty")
    if not environment:
        raise ValueError("'environment' cannot be empty")
    if not migration_script:
        raise ValueError("'migrationScript' cannot be empty")

    return segment, total_segments, table_name, environment, run_migration, migration_script


def lambda_handler(event, context):
    try:
        segment, total_segments, table_name, environment, run_migration, migration_script = validate_event_input(event)

        service = DynamoDBMigrationService(
            segment=segment,
            total_segments=total_segments,
            table_name=table_name,
            environment=environment,
            run_migration=run_migration,
            migration_script=migration_script
        )

        return service.execute_migration()

    except ClientError as aws_error:
        logger.error(f"AWS error while processing segment: {aws_error}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Unexpected error in dynamodb_migration_handler: {e}", exc_info=True)
        raise
