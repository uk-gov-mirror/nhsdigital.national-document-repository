from enums.document_review_reason import DocumentReviewReason
from enums.document_review_status import DocumentReviewStatus
from enums.snomed_codes import SnomedCodes
from tests.unit.conftest import (
    MOCK_STAGING_STORE_BUCKET,
    TEST_CURRENT_GP_ODS,
    TEST_NHS_NUMBER,
    TEST_UUID,
)

MOCK_PREVIOUS_ODS_CODE = "Z67890"

MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE = {
    "Items": [
        {
            "ID": "3d8683b9-1665-40d2-8499-6e8302d507ff",
            "Version": 1,
            "Files": [
                {
                    "FileLocation": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-123",
                    "FileName": "document.csv",
                },
                {
                    "FileLocation": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-223",
                    "FileName": "results.pdf",
                },
            ],
            "Author": MOCK_PREVIOUS_ODS_CODE,
            "Custodian": TEST_CURRENT_GP_ODS,
            "UploadDate": 1704110400,
            "NhsNumber": TEST_NHS_NUMBER,
            "ReviewReason": DocumentReviewReason.FILE_COUNT_MISMATCH,
            "ReviewStatus": DocumentReviewStatus.PENDING_REVIEW.value,
            "LastUpdated": 1704110400,  # Timestamp: 2024-01-01T12:00:00
            "DocumentSnomedCodeType": SnomedCodes.LLOYD_GEORGE.value.code,
        },
        {
            "ID": "4d8683b9-1665-40d2-8499-6e8302d507ff",
            "Version": 2,
            "Files": [
                {
                    "FileLocation": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-123",
                    "FileName": "document.csv",
                },
                {
                    "FileLocation": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-223",
                    "FileName": "results.pdf",
                },
            ],
            "Author": MOCK_PREVIOUS_ODS_CODE,
            "Custodian": TEST_CURRENT_GP_ODS,
            "UploadDate": 1704110400,
            "NhsNumber": TEST_NHS_NUMBER,
            "ReviewReason": DocumentReviewReason.FILE_COUNT_MISMATCH,
            "ReviewStatus": DocumentReviewStatus.PENDING_REVIEW.value,
            "LastUpdated": 1704110400,  # Timestamp: 2024-01-01T12:00:00
            "DocumentSnomedCodeType": SnomedCodes.LLOYD_GEORGE.value.code,
        },
        {
            "ID": "5d8683b9-1665-40d2-8499-6e8302d507ff",
            "Version": 3,
            "Files": [
                {
                    "FileLocation": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-123",
                    "FileName": "document.csv",
                },
                {
                    "FileLocation": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-223",
                    "FileName": "results.pdf",
                },
            ],
            "Author": MOCK_PREVIOUS_ODS_CODE,
            "Custodian": TEST_CURRENT_GP_ODS,
            "UploadDate": 1704110400,
            "NhsNumber": TEST_NHS_NUMBER,
            "ReviewReason": DocumentReviewReason.FILE_COUNT_MISMATCH,
            "ReviewStatus": DocumentReviewStatus.PENDING_REVIEW.value,
            "LastUpdated": 1704110400,  # Timestamp: 2024-01-01T12:00:00
            "DocumentSnomedCodeType": SnomedCodes.LLOYD_GEORGE.value.code,
        },
    ],
    "Count": 3,
    "ScannedCount": 3,
    "ResponseMetadata": {
        "RequestId": "JHJBP4GU007VMB2V8C9NEKUL8VVV4KQNSO5AEMVJF66Q9ASUAAJG",
        "HTTPStatusCode": 200,
        "HTTPHeaders": {
            "server": "Server",
            "date": "Tue, 29 Aug 2023 11:08:21 GMT",
            "content-type": "application/x-amz-json-1.0",
            "content-length": "510",
            "connection": "keep-alive",
            "x-amzn-requestid": "JHJBP4GU007VMB2V8C9NEKUL8VVV4KQNSO5AEMVJF66Q9ASUAAJG",
            "x-amz-crc32": "820258331",
        },
        "RetryAttempts": 0,
    },
    "LastEvaluatedKey": TEST_UUID,
}

MOCK_DOCUMENT_REVIEW_PAGINATOR_RESPONSE = {
    "Items": [
        {
            "ID": {"S": "3d8683b9-1665-40d2-8499-6e8302d507ff"},
            "Version": {"N": "1"},
            "Files": {
                "L": [
                    {
                        "M": {
                            "FileLocation": {
                                "S": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-123"
                            },
                            "FileName": {"S": "document.csv"},
                        }
                    },
                    {
                        "M": {
                            "FileLocation": {
                                "S": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-223"
                            },
                            "FileName": {"S": "results.pdf"},
                        }
                    },
                ]
            },
            "Author": {"S": MOCK_PREVIOUS_ODS_CODE},
            "Custodian": {"S": TEST_CURRENT_GP_ODS},
            "UploadDate": {"N": "1704110400"},
            "NhsNumber": {"S": TEST_NHS_NUMBER},
            "ReviewReason": {"S": DocumentReviewReason.FILE_COUNT_MISMATCH},
            "ReviewStatus": {"S": DocumentReviewStatus.PENDING_REVIEW.value},
            "LastUpdated": {"N": "1704110400"},
            "DocumentSnomedCodeType": {"S": SnomedCodes.LLOYD_GEORGE.value.code},
        },
        {
            "ID": {"S": "4d8683b9-1665-40d2-8499-6e8302d507ff"},
            "Version": {"N": "2"},
            "Files": {
                "L": [
                    {
                        "M": {
                            "FileLocation": {
                                "S": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-123"
                            },
                            "FileName": {"S": "document.csv"},
                        }
                    },
                    {
                        "M": {
                            "FileLocation": {
                                "S": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-223"
                            },
                            "FileName": {"S": "results.pdf"},
                        }
                    },
                ]
            },
            "Author": {"S": MOCK_PREVIOUS_ODS_CODE},
            "Custodian": {"S": TEST_CURRENT_GP_ODS},
            "UploadDate": {"N": "1704110400"},
            "NhsNumber": {"S": TEST_NHS_NUMBER},
            "ReviewReason": {"S": DocumentReviewReason.FILE_COUNT_MISMATCH},
            "ReviewStatus": {"S": DocumentReviewStatus.PENDING_REVIEW.value},
            "LastUpdated": {"N": "1704110400"},
            "DocumentSnomedCodeType": {"S": SnomedCodes.LLOYD_GEORGE.value.code},
        },
        {
            "ID": {"S": "5d8683b9-1665-40d2-8499-6e8302d507ff"},
            "Version": {"N": "3"},
            "Files": {
                "L": [
                    {
                        "M": {
                            "FileLocation": {
                                "S": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-123"
                            },
                            "FileName": {"S": "document.csv"},
                        }
                    },
                    {
                        "M": {
                            "FileLocation": {
                                "S": f"s3://{MOCK_STAGING_STORE_BUCKET}/{TEST_NHS_NUMBER}/test-key-223"
                            },
                            "FileName": {"S": "results.pdf"},
                        }
                    },
                ]
            },
            "Author": {"S": MOCK_PREVIOUS_ODS_CODE},
            "Custodian": {"S": TEST_CURRENT_GP_ODS},
            "UploadDate": {"N": "1704110400"},
            "NhsNumber": {"S": TEST_NHS_NUMBER},
            "ReviewReason": {"S": DocumentReviewReason.FILE_COUNT_MISMATCH},
            "ReviewStatus": {"S": DocumentReviewStatus.PENDING_REVIEW.value},
            "LastUpdated": {"N": "1704110400"},
            "DocumentSnomedCodeType": {"S": SnomedCodes.LLOYD_GEORGE.value.code},
        },
    ],
    "NextToken": TEST_UUID,
}
