from pydantic import BaseModel, ConfigDict, Field, field_validator

from utils.lloyd_george_validator import validate_scan_date

METADATA_FILENAME = "metadata.csv"
NHS_NUMBER_FIELD_NAME = "NHS-NO"
ODS_CODE = "GP-PRACTICE-CODE"
NHS_NUMBER_PLACEHOLDER = "0000000000"


def to_upper_case_with_hyphen(field_name: str) -> str:
    return field_name.upper().replace("_", "-")


class MetadataBase(BaseModel):
    model_config = ConfigDict(
        validate_by_name=True,
        populate_by_name=True,
    )

    file_path: str
    gp_practice_code: str = Field(min_length=1)
    scan_date: str


class BulkUploadQueueMetadata(MetadataBase):
    stored_file_name: str


class MetadataFile(MetadataBase):
    model_config: ConfigDict = ConfigDict(
        alias_generator=to_upper_case_with_hyphen,
    )
    nhs_number: str = Field(alias=NHS_NUMBER_FIELD_NAME)
    file_path: str = Field(alias="FILEPATH")
    page_count: str | None = Field(default=None, alias="PAGE COUNT")
    section: str | None = None
    sub_section: str | None = None
    scan_id: str | None = None
    user_id: str | None = None
    upload: str | None = None

    @field_validator("scan_date")
    @classmethod
    def validate_scan_date_field(cls, scan_date: str) -> str:
        return validate_scan_date(scan_date)


class StagingSqsMetadata(BaseModel):
    nhs_number: str
    files: list[BulkUploadQueueMetadata]
    retries: int = 0

    @field_validator("nhs_number")
    @classmethod
    def validate_nhs_number(cls, nhs_number: str) -> str:
        if nhs_number and nhs_number.isdigit():
            return nhs_number

        return NHS_NUMBER_PLACEHOLDER
