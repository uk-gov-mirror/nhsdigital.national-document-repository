from enum import StrEnum


class DocumentReviewReason(StrEnum):
    NEW_DOCUMENT = "New document to review"
    UNSUCCESSFUL_UPLOAD = "Unsuccessful upload"
