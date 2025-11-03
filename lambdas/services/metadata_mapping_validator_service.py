from typing import Type

from models.staging_metadata import MetadataFile
from pydantic import BaseModel, ConfigDict, Field, create_model
from utils.audit_logging_setup import LoggingService
from utils.exceptions import BulkUploadMetadataException

logger = LoggingService(__name__)


class MetadataMappingValidatorService:
    def build_model_for_alias(self, alias_map: dict) -> Type[BaseModel]:
        self.validate_alias_map(alias_map)
        return self.create_dynamic_model(alias_map)

    def validate_alias_map(self, alias_map: dict) -> None:
        alias_field_keys = {k for k in alias_map.keys() if k in MetadataFile.model_fields}
        missing_keys = set(MetadataFile.model_fields.keys()) - alias_field_keys
        if missing_keys:
            raise BulkUploadMetadataException(f"Alias config is missing mappings for: {', '.join(sorted(missing_keys))}")

    def create_dynamic_model(self, alias_map: dict) -> Type[BaseModel]:
        new_fields = {
            name: (field.annotation, Field(alias=alias_map.get(name))) for name, field in MetadataFile.model_fields.items()
        }

        model_config = ConfigDict(populate_by_name=True, from_attributes=True, extra="allow")
        dynamic_model = create_model(
            "Metadata",
            __config__=model_config,
            **new_fields,
        )

        logger.info("Dynamic model created from interpreted fields")
        return dynamic_model

    def validate_and_normalize_metadata(self, records: list[dict], remappings: dict):
        model = self.build_model_for_alias(remappings)
        validated_rows, rejected_rows, rejected_reasons = [], [], []

        required_fields = [name for name, field in MetadataFile.model_fields.items() if field.is_required()]

        for row in records:
            try:
                instance = model.model_validate(row)
                data = instance.model_dump(by_alias=False)
                empty_required_fields = self.get_empty_required_fields(data, required_fields)

                if empty_required_fields:
                    raise ValueError(f"Missing or empty required fields: {', '.join(empty_required_fields)}")

                validated_rows.append(data)
            except ValueError as e:
                rejected_rows.append(row)
                rejected_reasons.append({"FILEPATH": row.get("FILEPATH", "N/A"), "REASON": str(e)})

        return validated_rows, rejected_rows, rejected_reasons

    def get_empty_required_fields(self, data: dict, required_fields: list[str]) -> list[str]:
        return [
            field
            for field in required_fields
            if data.get(field) is None or (isinstance(data.get(field), str) and not data.get(field).strip())
        ]
