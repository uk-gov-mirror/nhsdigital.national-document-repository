from typing import Any, List

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class DocumentConfig(BaseModel):
    model_config = ConfigDict(
        validate_by_alias=True,
        validate_by_name=True,
        populate_by_name=True,
        alias_generator=to_camel,
    )
    snomed_code: str
    display_name: str
    can_be_updated: bool
    associated_snomed: str
    multifile_upload: bool
    multifile_zipped: bool
    multifile_review: bool
    can_be_discarded: bool
    single_file_only: bool
    stitched: bool
    accepted_file_types: List[str]
    content: List[Any]
