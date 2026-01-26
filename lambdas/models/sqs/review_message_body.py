from enums.document_review_reason import DocumentReviewReason
from pydantic import BaseModel, ConfigDict, Field


class ReviewMessageFile(BaseModel):
    """Model for an individual file in the SQS message body from the document review queue"""

    file_name: str
    file_path: str = Field(description="Location in the staging bucket")
    """Location in the staging bucket"""


class ReviewMessageBody(BaseModel):
    """Model for SQS message body from the document review queue"""

    model_config = ConfigDict(
        use_enum_values=True,
    )
    upload_id: str
    files: list[ReviewMessageFile]
    nhs_number: str
    failure_reason: DocumentReviewReason = Field(
        default=DocumentReviewReason.UNSUCCESSFUL_UPLOAD
    )
    uploader_ods: str
