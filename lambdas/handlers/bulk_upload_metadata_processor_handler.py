from enums.lloyd_george_pre_process_format import LloydGeorgePreProcessFormat
from services.bulk_upload_metadata_processor_service import (
    BulkUploadMetadataProcessorService,
    get_formatter_service,
)
from services.metadata_mapping_validator_service import MetadataMappingValidatorService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.exceptions import BulkUploadMetadataException

logger = LoggingService(__name__)


@set_request_context_for_logging
@override_error_check
@ensure_environment_variables(
    names=["STAGING_STORE_BUCKET_NAME", "METADATA_SQS_QUEUE_URL"]
)
@handle_lambda_exceptions
def lambda_handler(event, _context):
    raw_pre_format_type = event.get(
        "preFormatType", LloydGeorgePreProcessFormat.GENERAL
    )
    formatter_service_class = get_formatter_service(raw_pre_format_type)
    practice_directory = event.get("practiceDirectory", "")

    remappings = event.get("metadataFieldRemappings", {})
    metadata_formatter_service = formatter_service_class(practice_directory)
    metadata_service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=metadata_formatter_service,
        metadata_heading_remap=remappings,
    )

    if "source" in event and event.get("source") == "aws.s3":
        logger.info("Handling EventBridge event from S3")

        metadata_service.handle_expedite_event(event)
        return

    if not practice_directory:
        logger.error(
            "Failed to start metadata processing due to missing practice directory"
        )
        return

    logger.info(
        f"Starting metadata processing for practice directory: {practice_directory}"
    )

    fixed_values = event.get("fixedValues", {})

    validator_service = MetadataMappingValidatorService()
    validator_service.validate_fixed_values(
        fixed_values, remappings)

    metadata_formatter_service = formatter_service_class(practice_directory)
    metadata_service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=metadata_formatter_service,
        metadata_heading_remap=remappings,
        fixed_values=fixed_values
    )
    metadata_service.process_metadata()
