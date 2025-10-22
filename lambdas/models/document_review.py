from typing import Optional

from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_pascal

from enums.document_review_status import DocumentReviewStatus
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.snomed_codes import SnomedCodes


class DocumentReview(BaseModel):
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
    id: str = Field(..., alias=str(DocumentReferenceMetadataFields.ID.value))
    author: str
    custodian: str
    review_status: DocumentReviewStatus = Field(default=DocumentReviewStatus.PENDING)
    review_reason: str
    review_date: int = Field(default=None)
    reviewer: str = Field(default=None)
    upload_date: int
    files: list[DocumentReview]
    nhs_number: str
    ttl: Optional[int] = Field(
        alias=str(DocumentReferenceMetadataFields.TTL.value), default=None
    )
    document_reference_id: str = Field(default=None)
    document_snomed_code_type: str = Field(
        default=SnomedCodes.LLOYD_GEORGE.value.code
    )