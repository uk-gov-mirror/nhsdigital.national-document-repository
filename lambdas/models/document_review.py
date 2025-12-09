import uuid

from enums.document_review_status import DocumentReviewStatus
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.snomed_codes import SnomedCodes
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_pascal, to_camel


class DocumentReviewFileDetails(BaseModel):
    model_config = ConfigDict(
        validate_by_alias=True,
        validate_by_name=True,
        alias_generator=to_pascal,
    )

    file_name: str
    file_location: str
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
    review_reason: str
    review_date: int | None = Field(default=None)
    reviewer: str | None = Field(default=None)
    upload_date: int
    files: list[DocumentReviewFileDetails] = Field(min_length=1)
    nhs_number: str
    ttl: int | None = Field(
        alias=str(DocumentReferenceMetadataFields.TTL.value), default=None
    )
    document_reference_id: str | None = Field(default=None)
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