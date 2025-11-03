import uuid
from typing import Optional

from enums.document_review_status import DocumentReviewStatus
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.snomed_codes import SnomedCodes
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_pascal


class DocumentReviewFileDetails(BaseModel):
    model_config = ConfigDict(
        validate_by_alias=True,
        validate_by_name=True,
        alias_generator=to_pascal,
    )

    file_name: str
    file_location: str
    presigned_url: Optional[str] = None


class DocumentUploadReviewReference(BaseModel):
    model_config = ConfigDict(
        validate_by_alias=True,
        validate_by_name=True,
        alias_generator=to_pascal,
        use_enum_values=True,
    )
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        alias=str(DocumentReferenceMetadataFields.ID.value),
    )
    author: str
    custodian: str
    review_status: DocumentReviewStatus = Field(
        default=DocumentReviewStatus.PENDING_REVIEW
    )
    review_reason: str
    review_date: int = Field(default=None)
    reviewer: str = Field(default=None)
    upload_date: int
    files: list[DocumentReviewFileDetails] = Field(min_length=1)
    nhs_number: str
    ttl: Optional[int] = Field(
        alias=str(DocumentReferenceMetadataFields.TTL.value), default=None
    )
    document_reference_id: str = Field(default=None)
    document_snomed_code_type: str = Field(default=SnomedCodes.LLOYD_GEORGE.value.code)


class PutDocumentReviewRequest(BaseModel):
    """Model for validating PUT document review request body.

    Contains the review outcome and optional document reference ID.
    """

    model_config = ConfigDict(
        validate_by_alias=True,
        validate_by_name=True,
        alias_generator=to_pascal,
        use_enum_values=True,
    )

    review_status: DocumentReviewStatus = Field(
        ..., description="Review outcome: APPROVED or REJECTED"
    )
    document_reference_id: Optional[str] = Field(
        default=None,
        description="Document reference ID (required when status is APPROVED)",
    )

    @field_validator("document_reference_id", mode="before")
    @classmethod
    def validate_document_reference_id(cls, v, info):
        """Ensure document_reference_id is provided when review_status is APPROVED."""
        review_status = info.data.get("review_status")
        if review_status == DocumentReviewStatus.APPROVED and not v:
            raise ValueError(
                "document_reference_id is required when review_status is APPROVED"
            )
        return v


