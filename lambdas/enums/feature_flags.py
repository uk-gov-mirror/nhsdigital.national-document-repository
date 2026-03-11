from enum import StrEnum


class FeatureFlags(StrEnum):
    UPLOAD_LLOYD_GEORGE_WORKFLOW_ENABLED = "uploadLloydGeorgeWorkflowEnabled"
    UPLOAD_LAMBDA_ENABLED = "uploadLambdaEnabled"
    UPLOAD_ARF_WORKFLOW_ENABLED = "uploadArfWorkflowEnabled"
    USE_SMARTCARD_AUTH = "useSmartcardAuth"
    LLOYD_GEORGE_VALIDATION_STRICT_MODE_ENABLED = (
        "lloydGeorgeValidationStrictModeEnabled"
    )
    UPLOAD_DOCUMENT_ITERATION_2_ENABLED = "uploadDocumentIteration2Enabled"
    UPLOAD_DOCUMENT_ITERATION_3_ENABLED = "uploadDocumentIteration3Enabled"
    BULK_UPLOAD_SEND_TO_REVIEW_ENABLED = "bulkUploadSendToReviewEnabled"
    VERSION_HISTORY_ENABLED = "versionHistoryEnabled"
