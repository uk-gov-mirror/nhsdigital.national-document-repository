from pydantic import BaseModel, Field


class ReviewMessageFile(BaseModel):
    """Model for individual file in SQS message body from the document review queue."""

    file_name: str
    file_path: str = Field(description="Location in the staging bucket")
    """Location in the staging bucket"""

class ReviewMessageBody(BaseModel):
    """Model for SQS message body from the document review queue."""
    upload_id: str
    files: list[ReviewMessageFile]
    nhs_number: str
    failure_reason: str
    upload_date: str
    uploader_ods: str
    current_gp: str
