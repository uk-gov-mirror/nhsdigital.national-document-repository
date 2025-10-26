from pydantic import BaseModel


class ReviewMessageBody(BaseModel):
    """Model for SQS message body from the document review queue."""

    file_name: str
    file_path: str
    """Location in the staging bucket"""
    nhs_number: str
    failure_reason: str
    upload_date: str
    uploader_ods: str
    current_gp: str
