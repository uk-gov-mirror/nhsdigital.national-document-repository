from dataclasses import dataclass

from enums.cloudwatch_logs_reporting_message import CloudwatchLogsReportingMessage


@dataclass
class CloudwatchLogsQueryParams:
    lambda_name: str
    query_string: str


LloydGeorgeRecordsViewed = CloudwatchLogsQueryParams(
    lambda_name="GetDocRefLambda",
    query_string=f"""
        fields @timestamp, Message, Authorisation.selected_organisation.org_ods_code AS ods_code 
        | filter Message = '{CloudwatchLogsReportingMessage.RECORDS_RETRIEVED}' 
        | stats count() AS daily_count_viewed BY ods_code
    """,
)

LloydGeorgeRecordsDownloaded = CloudwatchLogsQueryParams(
    lambda_name="DocumentManifestJobLambda",
    query_string=f"""
        fields @timestamp, Message, Authorisation.selected_organisation.org_ods_code AS ods_code 
        | filter Message = '{CloudwatchLogsReportingMessage.LG_RECORDS_DOWNLOADED}' 
        | stats count() AS daily_count_downloaded BY ods_code
    """,
)

LloydGeorgeRecordsDeleted = CloudwatchLogsQueryParams(
    lambda_name="DeleteDocRefLambda",
    query_string=f"""
        fields @timestamp, Message, Authorisation.selected_organisation.org_ods_code AS ods_code 
        | filter Message like "{CloudwatchLogsReportingMessage.RECORDS_DELETED}"
        | stats count() AS daily_count_deleted BY ods_code
    """,
)


CountUsersLloydGeorgeRecordsUploaded = CloudwatchLogsQueryParams(
    lambda_name="DocumentStatusCheckLambda",
    query_string=f"""
        fields @timestamp, Message, Authorisation.nhs_user_id AS user_id, 
        Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message = '{CloudwatchLogsReportingMessage.UPLOAD_STATUS_CHECKED}' 
        | stats count_distinct(user_id) AS daily_count_users_uploaded BY ods_code
    """,
)

UniqueActiveUserIdsUploaded = CloudwatchLogsQueryParams(
    lambda_name="DocumentStatusCheckLambda",
    query_string=f"""
        fields @timestamp, Message, Authorisation.nhs_user_id AS user_id, 
        Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message = '{CloudwatchLogsReportingMessage.UPLOAD_STATUS_CHECKED}' 
        | dedup user_id, ods_code
    """,
)

LloydGeorgeRecordsSearched = CloudwatchLogsQueryParams(
    lambda_name="SearchPatientDetailsLambda",
    query_string=f"""
        fields @timestamp, Message, Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message = '{CloudwatchLogsReportingMessage.PATIENT_SEARCHED}' 
        | stats count() AS daily_count_searched BY ods_code
    """,
)

CountUsersAccessedReview = CloudwatchLogsQueryParams(
    lambda_name="GetDocumentReview",
    query_string=f"""
        fields @timestamp, Message, Authorisation.nhs_user_id AS user_id, 
        Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message like /{CloudwatchLogsReportingMessage.USERS_ACCESSED_REVIEW}/
        | stats count_distinct(user_id) AS daily_count_users_accessing_review BY ods_code
    """,
)

UniqueActiveUserIdsAccessedReview = CloudwatchLogsQueryParams(
    lambda_name="GetDocumentReview",
    query_string=f"""
        fields @timestamp, Message, Authorisation.nhs_user_id AS user_id, 
        Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message like /{CloudwatchLogsReportingMessage.USERS_ACCESSED_REVIEW}/
        | dedup user_id, ods_code
    """,
)

CountUsersAccessedDeceasedPatient = CloudwatchLogsQueryParams(
    lambda_name="AccessAuditLambda",
    query_string=f"""
        fields @timestamp, Message, Authorisation.nhs_user_id AS user_id, 
        Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message = '{CloudwatchLogsReportingMessage.USERS_ACCESSED_DECEASED_PATIENT}' 
        | stats count_distinct(user_id) AS daily_count_users_accessing_deceased BY ods_code
    """,
)

UniqueActiveUserIdsAccessedDeceasedPatient = CloudwatchLogsQueryParams(
    lambda_name="AccessAuditLambda",
    query_string=f"""
        fields @timestamp, Message, Authorisation.nhs_user_id AS user_id, 
        Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message = '{CloudwatchLogsReportingMessage.USERS_ACCESSED_DECEASED_PATIENT}' 
        | dedup user_id, ods_code
    """,
)

OdsReportsRequested = CloudwatchLogsQueryParams(
    lambda_name="GetReportByODS",
    query_string=f"""
        fields @timestamp, Message, Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message like /{CloudwatchLogsReportingMessage.ODS_REPORTS_REQUESTED}/
        | stats count() AS daily_count_ods_report_requested BY ods_code
    """,
)

OdsReportsCreated = CloudwatchLogsQueryParams(
    lambda_name="GetReportByODS",
    query_string=f"""
        fields @timestamp, Message, Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message = '{CloudwatchLogsReportingMessage.ODS_REPORTS_CREATED}'
        | stats count() AS daily_count_ods_report_created BY ods_code
    """,
)

UniqueActiveUserIds = CloudwatchLogsQueryParams(
    lambda_name="TokenRequestHandler",
    query_string="""
        fields @timestamp,
        Authorisation.selected_organisation.org_ods_code AS ods_code,
        Authorisation.nhs_user_id AS user_id,
        Authorisation.selected_organisation.role_code AS role_code,
        Authorisation.repository_role AS user_role
        | filter ispresent(ods_code) AND ispresent(user_id)
        | dedup(ods_code, user_id, user_role, role_code)
    """,
)

CountUsersLloydGeorgeRecordsReviewed = CloudwatchLogsQueryParams(
    lambda_name="PatchDocumentReview",
    query_string=f"""
        fields @timestamp, Message, Authorisation.nhs_user_id AS user_id, 
        Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message like /{CloudwatchLogsReportingMessage.USERS_PATCH_REVIEW}/
        | stats count_distinct(user_id) AS daily_count_users_reviewed BY ods_code
    """,
)

UniqueActiveUserIdsReviewed = CloudwatchLogsQueryParams(
    lambda_name="PatchDocumentReview",
    query_string=f"""
        fields @timestamp, Message, Authorisation.nhs_user_id AS user_id, 
        Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message like /{CloudwatchLogsReportingMessage.USERS_PATCH_REVIEW}/
        | dedup user_id, ods_code
    """,
)

CountUsersLloydGeorgeRecordsReassigned = CloudwatchLogsQueryParams(
    lambda_name="PatchDocumentReview",
    query_string=f"""
        fields @timestamp, Message, Authorisation.nhs_user_id AS user_id, 
        Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message like /{CloudwatchLogsReportingMessage.USERS_REVIEW_REASSIGNED}/
        | stats count_distinct(user_id) AS daily_count_users_reassigned BY ods_code
    """,
)

UniqueActiveUserIdsReassigned = CloudwatchLogsQueryParams(
    lambda_name="PatchDocumentReview",
    query_string=f"""
        fields @timestamp, Message, Authorisation.nhs_user_id AS user_id, 
        Authorisation.selected_organisation.org_ods_code AS ods_code
        | filter Message like /{CloudwatchLogsReportingMessage.USERS_REVIEW_REASSIGNED}/
        | dedup user_id, ods_code
    """,
)

UploadReviewCountByOdsCode = CloudwatchLogsQueryParams(
    lambda_name="DocumentReferenceVirusScanCheck",
    query_string=f"""
        fields @timestamp, Message, ods_code
        | filter Message like /{CloudwatchLogsReportingMessage.UPLOAD_REVIEW_PROCESSED}/
        | stats count() AS daily_count_upload_review BY ods_code
    """,
)

UploadReviewCountByFileType = CloudwatchLogsQueryParams(
    lambda_name="DocumentReferenceVirusScanCheck",
    query_string=f"""
        fields @timestamp, Message, ods_code, document_snomed_code_type AS file_type
        | filter Message like /{CloudwatchLogsReportingMessage.UPLOAD_REVIEW_PROCESSED}/
        | stats count() AS daily_count_upload_review BY ods_code, file_type
    """,
)

UploadCountByOdsCode = CloudwatchLogsQueryParams(
    lambda_name="DocumentReferenceVirusScanCheck",
    query_string=f"""
        fields @timestamp, Message, ods_code
        | filter Message like /{CloudwatchLogsReportingMessage.UPLOAD_PROCESSED}/
            and Message like /{CloudwatchLogsReportingMessage.UPLOAD_LG_REFERENCE}/
        | stats count() AS daily_count_upload BY ods_code
    """,
)

UploadCountByFileType = CloudwatchLogsQueryParams(
    lambda_name="DocumentReferenceVirusScanCheck",
    query_string=f"""
        fields @timestamp, Message, ods_code, document_snomed_code_type AS file_type
        | filter Message like /{CloudwatchLogsReportingMessage.UPLOAD_PROCESSED}/
            and Message like /{CloudwatchLogsReportingMessage.UPLOAD_LG_REFERENCE}/
        | stats count() AS daily_count_upload BY ods_code, file_type
    """,
)
