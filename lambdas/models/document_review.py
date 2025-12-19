import uuid
from datetime import datetime, timezone

from enums.document_review_status import DocumentReviewStatus
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.snomed_codes import SnomedCodes
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel, to_pascal
from utils.exceptions import InvalidNhsNumberException
from utils.utilities import validate_nhs_number


class DocumentReviewFileDetails(BaseModel):
    model_config = ConfigDict(
        validate_by_alias=True,
        validate_by_name=True,
        alias_generator=to_pascal,
    )

    file_name: str
    file_location: str | None = None
    presigned_url: str | None = None


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
    review_reason: str | None = None
    review_date: int | None = Field(default=None)
    reviewer: str | None = Field(default=None)
    upload_date: int = Field(
        default_factory=lambda: int(datetime.now(timezone.utc).timestamp()),
    )
    files: list[DocumentReviewFileDetails] = Field(min_length=1)
    nhs_number: str
    version: int = Field(default=1)
    document_reference_id: str = Field(default=None)
    document_snomed_code_type: str = Field(default=SnomedCodes.LLOYD_GEORGE.value.code)

    def model_dump_camel_case(self, *args, **kwargs):
        model_dump_results = self.model_dump(*args, **kwargs)
        camel_case_model_dump_results = self.camelize(model_dump_results)

        return camel_case_model_dump_results

    def camelize(self, model: dict) -> dict:
        camel_case_dict = {}
        for key, value in model.items():
            if isinstance(value, dict):
                return self.camelize(value)
            if isinstance(value, list):
                result = []
                for item in value:
                    result.append(self.camelize(item))
                value = result
            camel_case_dict[to_camel(key)] = value

        return camel_case_dict


class PatchDocumentReviewRequest(BaseModel):
    model_config = ConfigDict(
        validate_by_alias=True,
        populate_by_name=True,
        alias_generator=to_camel,
        use_enum_values=True,
    )

    review_status: DocumentReviewStatus = Field(..., description="Review outcome")
    document_reference_id: str | None = Field(
        default=None,
        description="Document reference ID (required when status is APPROVED)",
    )
    nhs_number: str | None = Field(
        default=None,
        description="New NHS number (required when status is REASSIGNED)",
    )

    @model_validator(mode="after")
    def validate_document_reference_id(self):
        """Ensure document_reference_id is provided when review_status is APPROVED."""
        if (
            self.review_status == DocumentReviewStatus.APPROVED
            and not self.document_reference_id
        ):
            raise ValueError(
                "document_reference_id is required when review_status is APPROVED"
            )
        elif (
            self.review_status != DocumentReviewStatus.APPROVED
            and self.document_reference_id
        ):
            raise ValueError(
                "document_reference_id is not required when review_status is not APPROVED"
            )
        return self

    @model_validator(mode="after")
    def validate_reassign_nhs_number(self):
        """
        Validate the reassignment of the NHS number after the input data model has been populated.

        Checks whether the `reassigned_nhs_number` field has been provided and is valid when the
        `review_status` reflects a reassigned state. Raises an error if validation fails.
        """
        if (
            self.review_status == DocumentReviewStatus.REASSIGNED
            and not self.nhs_number
        ):
            raise ValueError(
                "reassigned_nhs_number is required when review_status is REASSIGNED or REASSIGNED_PATIENT_UNKNOWN"
            )
        elif self.review_status == DocumentReviewStatus.REASSIGNED and self.nhs_number:
            try:
                validate_nhs_number(self.nhs_number)
            except InvalidNhsNumberException:
                raise ValueError("Invalid NHS number")
        return self


class DocumentReviewUploadEvent(BaseModel):
    model_config = ConfigDict(
        validate_by_alias=True,
        populate_by_name=True,
        validate_by_name=True,
        alias_generator=to_camel,
        use_enum_values=True,
        extra="forbid",
    )

    nhs_number: str
    snomed_code: SnomedCodes
    documents: list = Field(min_length=1, max_length=1)

    @field_validator("snomed_code", mode="before")
    @classmethod
    def check_snomed_code(cls, value) -> SnomedCodes | None:
        return SnomedCodes.find_by_code(value)

    @field_validator("nhs_number", mode="before")
    @classmethod
    def verify_nhs_number(cls, value) -> str | None:
        if validate_nhs_number(value):
            return value
