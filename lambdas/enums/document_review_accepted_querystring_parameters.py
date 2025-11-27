from enum import StrEnum


class DocumentReviewQuerystringParameters(StrEnum):
    LIMIT = "limit"
    NEXT_PAGE_TOKEN = "nextPageToken"
    UPLOADER = "uploader"
    NHS_NUMBER = "nhsNumber"

