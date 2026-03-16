USER_ID_1 = "F4A6AF98-4800-4A8A-A6C0-8FE0AC4B994B"
USER_ID_2 = "9E7F1235-3DF1-4822-AFFB-C4FCC88C2690"
HASHED_USER_ID_1 = "3192b6cf7ef953cf1a1f0945a83b55ab2cb8bae95cac6548ae5412aaa4c67677"
HASHED_USER_ID_2 = "a89d1cb4ac0776e45131c65a69e8b1a48026e9b497c94409e480588418a016e4"
HASHED_USER_ID_1_WITH_ADMIN_ROLE = f"{HASHED_USER_ID_1} - GP_ADMIN - RO76"
HASHED_USER_ID_1_WITH_PCSE_ROLE = f"{HASHED_USER_ID_1} - PCSE - "
HASHED_USER_ID_2_WITH_CLINICAL_ROLE = f"{HASHED_USER_ID_2} - GP_CLINICAL - RO76"


MOCK_UNIQUE_ACTIVE_USER_IDS = [
    {"ods_code": "Y12345", "user_id": USER_ID_1, "role_code": "", "user_role": "PCSE"},
    {
        "ods_code": "H81109",
        "user_id": USER_ID_1,
        "role_code": "RO76",
        "user_role": "GP_ADMIN",
    },
    {
        "ods_code": "H81109",
        "user_id": USER_ID_2,
        "role_code": "RO76",
        "user_role": "GP_CLINICAL",
    },
]


MOCK_LG_VIEWED = [
    {
        "ods_code": "Y12345",
        "daily_count_viewed": "20",
    },
    {
        "ods_code": "H81109",
        "daily_count_viewed": "40",
    },
]

MOCK_LG_DOWNLOADED = [
    {
        "ods_code": "Y12345",
        "daily_count_downloaded": "10",
    },
    {
        "ods_code": "H81109",
        "daily_count_downloaded": "20",
    },
]

MOCK_LG_DELETED = [
    {
        "ods_code": "Y12345",
        "daily_count_deleted": "1",
    },
    {
        "ods_code": "H81109",
        "daily_count_deleted": "2",
    },
]

MOCK_LG_UPLOADED = [
    {
        "ods_code": "Y12345",
        "daily_count_upload": "2",
    },
    {
        "ods_code": "H81109",
        "daily_count_upload": "4",
    },
]

MOCK_USERS_LG_UPLOADED = [
    {
        "ods_code": "Y12345",
        "daily_count_users_uploaded": "2",
    },
    {
        "ods_code": "H81109",
        "daily_count_users_uploaded": "4",
    },
]

MOCK_USERS_LG_REVIEWED = [
    {"ods_code": "Y12345", "daily_count_users_reviewed": "1"},
    {"ods_code": "H81109", "daily_count_users_reviewed": "2"},
]

MOCK_USERS_LG_REASSIGNED = [
    {"ods_code": "Y12345", "daily_count_users_reassigned": "1"},
    {"ods_code": "H81109", "daily_count_users_reassigned": "2"},
]

MOCK_PATIENT_SEARCHED = [
    {
        "ods_code": "Y12345",
        "daily_count_searched": "50",
    },
    {
        "ods_code": "H81109",
        "daily_count_searched": "30",
    },
]

MOCK_USERS_ACCESSING_REVIEW = [
    {"ods_code": "Y12345", "daily_count_users_accessing_review": "2"},
    {"ods_code": "H81109", "daily_count_users_accessing_review": "3"},
]

MOCK_DECEASED_ACCESS = [
    {"ods_code": "Y12345", "daily_count_users_accessing_deceased": "2"},
    {"ods_code": "H81109", "daily_count_users_accessing_deceased": "13"},
]

MOCK_ODS_REPORT_REQUESTED = [
    {"ods_code": "Y12345", "daily_count_ods_report_requested": "10"},
    {"ods_code": "H81109", "daily_count_ods_report_requested": "20"},
]

MOCK_ODS_REPORT_CREATED = [
    {"ods_code": "Y12345", "daily_count_ods_report_created": "0"},
    {"ods_code": "H81109", "daily_count_ods_report_created": "13"},
]

MOCK_UPLOAD_REVIEW_COUNT_BY_ODS_CODE = [
    {"ods_code": "Y12345", "daily_count_upload_review": "3"},
    {"ods_code": "H81109", "daily_count_upload_review": "5"},
]

MOCK_UPLOAD_REVIEW_COUNT_BY_FILE_TYPE = [
    {
        "ods_code": "Y12345",
        "file_type": "16521000000101",
        "daily_count_upload_review": "2",
    },
    {"ods_code": "Y12345", "file_type": "734163000", "daily_count_upload_review": "1"},
    {
        "ods_code": "H81109",
        "file_type": "717301000000104",
        "daily_count_upload_review": "3",
    },
    {
        "ods_code": "H81109",
        "file_type": "24511000000107",
        "daily_count_upload_review": "2",
    },
]

MOCK_UPLOAD_COUNT_BY_FILE_TYPE = [
    {"ods_code": "Y12345", "file_type": "16521000000101", "daily_count_upload": "1"},
    {"ods_code": "Y12345", "file_type": "717301000000104", "daily_count_upload": "1"},
    {"ods_code": "H81109", "file_type": "162931000000103", "daily_count_upload": "2"},
    {"ods_code": "H81109", "file_type": "24511000000107", "daily_count_upload": "2"},
]
MOCK_RESPONSE_QUERY_IN_PROGRESS = {"status": "Running"}

MOCK_RESPONSE_QUERY_FAILED = {"status": "Failed"}

MOCK_RESPONSE_QUERY_COMPLETE = {
    "results": [
        [
            {"field": "ods_code", "value": "Y12345"},
            {"field": "daily_count_viewed", "value": "20"},
        ],
        [
            {"field": "ods_code", "value": "H81109"},
            {"field": "daily_count_viewed", "value": "40"},
        ],
    ],
    "statistics": {
        "recordsMatched": 123.0,
        "recordsScanned": 123.0,
        "bytesScanned": 123.0,
    },
    "status": "Complete",
}

EXPECTED_QUERY_RESULT = [
    {
        "ods_code": "Y12345",
        "daily_count_viewed": "20",
    },
    {
        "ods_code": "H81109",
        "daily_count_viewed": "40",
    },
]
