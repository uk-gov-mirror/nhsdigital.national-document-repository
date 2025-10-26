from enum import StrEnum


class ReviewStatus(StrEnum):
    """Status values for document review records."""

    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
