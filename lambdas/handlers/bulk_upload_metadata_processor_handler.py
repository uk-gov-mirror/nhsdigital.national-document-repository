from enums.feature_flags import FeatureFlags
from enums.lloyd_george_pre_process_format import LloydGeorgePreProcessFormat
from enums.logging_app_interaction import LoggingAppInteraction
from services.bulk_upload_metadata_processor_service import (
    BulkUploadMetadataProcessorService,
    get_formatter_service,
)
from services.feature_flags_service import FeatureFlagService
from services.metadata_mapping_validator_service import MetadataMappingValidatorService
from utils.audit_logging_setup import LoggingService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.request_context import request_context

logger = LoggingService(__name__)


@set_request_context_for_logging
@override_error_check
@ensure_environment_variables(
    names=["STAGING_STORE_BUCKET_NAME", "METADATA_SQS_QUEUE_URL"],
)
@handle_lambda_exceptions
def lambda_handler(event, _context):
    request_context.app_interaction = LoggingAppInteraction.BULK_UPLOAD.value
    feature_flag_service = FeatureFlagService()
    send_to_review_flag_object = feature_flag_service.get_feature_flags_by_flag(
        FeatureFlags.BULK_UPLOAD_SEND_TO_REVIEW_ENABLED.value,
    )
    send_to_review_enabled = send_to_review_flag_object[
        FeatureFlags.BULK_UPLOAD_SEND_TO_REVIEW_ENABLED.value
    ]

    if send_to_review_enabled:
        logger.info(
            "Bulk upload send to review queue is enabled for metadata processor",
        )

    raw_pre_format_type = event.get(
        "preFormatType",
        LloydGeorgePreProcessFormat.GENERAL,
    )
    formatter_service_class = get_formatter_service(raw_pre_format_type)
    input_file_location = event.get("inputFileLocation", "")

    remappings = event.get("metadataFieldRemappings", {})
    metadata_formatter_service = formatter_service_class(input_file_location)
    metadata_service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=metadata_formatter_service,
        metadata_heading_remap=remappings,
        input_file_location=input_file_location,
        send_to_review_enabled=send_to_review_enabled,
    )

    if "source" in event and event.get("source") == "aws.s3":
        logger.info("Handling EventBridge event from S3")

        metadata_service.handle_expedite_event(event)
        return

    if not input_file_location:
        logger.error(
            "Failed to start metadata processing due to missing field: inputFileLocation",
        )
        return

    logger.info(
        f"Starting metadata processing for file location: {input_file_location}",
    )

    fixed_values = event.get("fixedValues", {})

    validator_service = MetadataMappingValidatorService()
    validator_service.validate_fixed_values(fixed_values, remappings)

    metadata_service = BulkUploadMetadataProcessorService(
        metadata_formatter_service=metadata_formatter_service,
        metadata_heading_remap=remappings,
        fixed_values=fixed_values,
        input_file_location=input_file_location,
        send_to_review_enabled=send_to_review_enabled,
    )
    metadata_service.process_metadata()
