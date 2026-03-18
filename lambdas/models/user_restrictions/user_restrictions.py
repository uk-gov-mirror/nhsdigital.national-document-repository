import uuid
from datetime import datetime, timezone
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel, to_pascal


class UserRestrictionsFields(StrEnum):
    ID = "ID"
    CREATOR = "CreatorSmartcard"
    RESTRICTED_USER = "RestrictedSmartcard"
    REMOVED_BY = "RemoverSmartCard"
    IS_ACTIVE = "IsActive"
    LAST_UPDATED = "LastUpdated"
    NHS_NUMBER = "NhsNumber"


class UserRestriction(BaseModel):
    model_config = ConfigDict(
        validate_by_alias=True,
        validate_by_name=True,
        alias_generator=to_pascal,
    )

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        alias=UserRestrictionsFields.ID,
    )
    restricted_user: str = Field(alias=UserRestrictionsFields.RESTRICTED_USER)
    nhs_number: str
    custodian: str
    created: int = Field(
        default_factory=lambda: int(datetime.now(timezone.utc).timestamp()),
    )
    creator: str = Field(
        alias=UserRestrictionsFields.CREATOR,
    )
    removed_by: str | None = Field(
        alias=UserRestrictionsFields.REMOVED_BY,
        default=None,
    )
    is_active: bool = Field(default=True)
    last_updated: int = Field(
        default_factory=lambda: int(datetime.now(timezone.utc).timestamp()),
    )

    def model_dump_camel_case(self, *args, **kwargs):
        model_dump_results = self.model_dump(*args, **kwargs)
        camel_case_model_dump_results = {}
        for key in model_dump_results:
            camel_case_model_dump_results[to_camel(key)] = model_dump_results[key]
        return camel_case_model_dump_results
