from enum import StrEnum

# WARNING: Do NOT modify these enum values unless explicitly asked to do so.
# These strings are used as CloudWatch Logs filter patterns for reporting and metrics.
# Changing them will break log queries and automated reports.


class CloudwatchLogsReportingMessage(StrEnum):
    LG_RECORDS_STITCHED = "User has viewed Lloyd George records"
    RECORDS_RETRIEVED = "Document fetch by ID process completed"
    LG_RECORDS_DOWNLOADED = "User has downloaded Lloyd George records"
    RECORDS_DELETED = "Documents were deleted successfully"
    PATIENT_SEARCHED = "Searched for patient details"
    USERS_ACCESSED_REVIEW = "Successfully retrieved document review for document_id"
    USERS_ACCESSED_DECEASED_PATIENT = (
        "Successful processed access request to view deceased patient"
    )
    ODS_REPORTS_REQUESTED = "Received a request to create a report for ODS code"
    ODS_REPORTS_CREATED = "A report has been successfully created."
    UPLOAD_REVIEW_PROCESSED = (
        "Successfully processed clean document for the review table"
    )
    UPLOAD_PROCESSED = "Successfully processed clean document for"
    UPLOAD_STATUS_CHECKED = "All documents processed successfully"
    UPLOAD_LG_REFERENCE = "LloydGeorgeReferenceMetadata"
    USERS_PATCH_REVIEW = "Successfully updated document review for document_id"
    USERS_REVIEW_REASSIGNED = "Document .* reassigned to patient .*"
