from enum import StrEnum


class DocumentReviewReason(StrEnum):
    UNKNOWN_NHS_NUMBER = "Unknown NHS number"
    DEMOGRAPHIC_MISMATCHES = "Demographic mismatches"
    DUPLICATE_RECORD = "Duplicate records error"
    FILE_COUNT_MISMATCH = "More or less files than we expected"
    FILE_NAME_MISMATCH = "Filename Naming convention error"
    GP2GP_ERROR = "GP2GP failure"
    GENERAL_ERROR = "General error"
