from enum import StrEnum


class DocumentReviewStatus(StrEnum):
    PENDING = "pending"
    REJECTED = "rejected"
    REVIEWED = "reviewed"