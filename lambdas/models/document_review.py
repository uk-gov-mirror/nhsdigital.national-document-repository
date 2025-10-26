from typing import Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_pascal

from lambdas.enums.review_status import ReviewStatus
from lambdas.enums.snomed_codes import SnomedCodes
from lambdas.models.document_reference import DocumentReferenceMetadataFields


class DocumentReviewFileDetails(BaseModel):
    model_config = ConfigDict(
        validate_by_alias=True,
        validate_by_name=True,
        alias_generator=to_pascal,
    )

    file_name: str
    file_location: str


class DocumentsUploadReview(BaseModel):
    model_config = ConfigDict(
        validate_by_alias=True,
        validate_by_name=True,
        alias_generator=to_pascal,
        use_enum_values=True,
    )
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        alias=str(DocumentReferenceMetadataFields.ID.value)
    ) # id differse to nogas version
    author: str
    custodian: str
    review_status: ReviewStatus = Field(default=ReviewStatus.PENDING_REVIEW) 
    review_reason: str
    review_date: int | None = Field(default=None)
    reviewer: str | None = Field(default=None)
    upload_date: int
    files: list[DocumentReviewFileDetails] = Field(default=[]) # differs to nogas version
    nhs_number: str
    ttl: Optional[int] = Field(
        alias=str(DocumentReferenceMetadataFields.TTL.value), default=None
    )
    document_reference_id: str | None = Field(default=None)
    document_snomed_code_type: str = Field(
        default=SnomedCodes.LLOYD_GEORGE.value.code
    ) 
