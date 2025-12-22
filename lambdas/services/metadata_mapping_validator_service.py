from typing import Type

from models.staging_metadata import MetadataFile
from pydantic import BaseModel, ConfigDict, Field, create_model
from utils.audit_logging_setup import LoggingService
from utils.exceptions import BulkUploadMetadataException

logger = LoggingService(__name__)


class MetadataMappingValidatorService:
    model_aliases = {f.alias for f in MetadataFile.model_fields.values() if f.alias}
    # Fields that should never be set as fixed by the user
    PROTECTED_FIELDS = {"FILEPATH", "NHS-NO"}

    def create_metadata_model(self, alias_map) -> Type[BaseModel]:
        if not alias_map:
            logger.info("Empty or no alias map provided")
        else:
            logger.info(f"Alias map provided as {alias_map}")
        new_fields = {}

        for name, model_field in MetadataFile.model_fields.items():
            has_alias = alias_map.get(model_field.alias) is not None
            alias_name = alias_map.get(model_field.alias, model_field.alias)

            if has_alias:
                field_def = Field(alias=alias_name)
            else:
                field_def = Field(default=None, alias=alias_name)

            new_fields[name] = (model_field.annotation, field_def)

        model_config = ConfigDict(
            populate_by_name=True, from_attributes=True, extra="allow"
        )
        dynamic_model = create_model(
            "Metadata",
            __config__=model_config,
            **new_fields,
        )

        logger.info(
            f"Dynamic metadata model created from interpreted fields: {new_fields}"
        )
        return dynamic_model

    def validate_and_normalize_metadata(self, records: list[dict],fixed_values: dict, remappings: dict):
        model = self.create_metadata_model(remappings)
        validated_rows, rejected_rows, rejected_reasons = [], [], []
        required_fields = [
            name
            for name, field in MetadataFile.model_fields.items()
            if field.is_required()
        ]

        for row in records:
            try:
                # Merge fixed values into the row before validation to account for these.
                row_with_fixed = {**row, **fixed_values} if fixed_values else row
                
                instance = model.model_validate(row_with_fixed)
                data = instance.model_dump(by_alias=False)
                
                empty_required_fields = self.get_empty_required_fields(
                    data, required_fields
                )

                if empty_required_fields:
                    raise ValueError(
                        f"Missing or empty required fields: {', '.join(empty_required_fields)}"
                    )

                validated_rows.append(data)
            except ValueError as e:
                rejected_rows.append(row)
                rejected_reasons.append(
                    {"FILEPATH": row.get("FILEPATH", "N/A"), "REASON": str(e)}
                )

        return validated_rows, rejected_rows, rejected_reasons

    def get_empty_required_fields(
        self, data: dict, required_fields: list[str]
    ) -> list[str]:
        return [
            field
            for field in required_fields
            if data.get(field) is None
            or (isinstance(data.get(field), str) and not data.get(field).strip())
        ]

    def validate_fixed_values(
        self, fixed_values: dict, remappings: dict
    ) -> tuple[bool, list[str]]:

        if not fixed_values:
            logger.info("No fixed values provided")
            return True, []

        errors = []

        errors.extend(self.check_for_protected_fields(fixed_values))

        errors.extend(self.check_for_remapped_field_names(fixed_values, remappings))

        errors.extend(self.check_for_remapping_conflicts(fixed_values, remappings))

        errors.extend(self.check_for_valid_aliases(fixed_values, remappings))

        if errors:
            logger.error(f"Fixed values validation failed: {errors}")
            raise BulkUploadMetadataException(errors)
        else:
            logger.info("Fixed values validation passed")

        return len(errors) == 0, errors

    def check_for_protected_fields(self, fixed_values: dict) -> list[str]:
        errors = []
        protected_in_fixed = set(fixed_values.keys()) & self.PROTECTED_FIELDS

        if protected_in_fixed:
            protected_list = ", ".join(sorted(protected_in_fixed))
            errors.append(
                f"Protected fields cannot have fixed values: {protected_list}. "
                f"These are critical identifiers that must come from the source data."
            )
        return errors

    def check_for_remapped_field_names(
        self, fixed_values: dict, remappings: dict
    ) -> list[str]:
        errors = []
        remapped_values = set(remappings.values())

        for field_name in fixed_values.keys():
            if field_name in remapped_values:
                errors.append(
                    f"Fixed value field '{field_name}' is a remapped value."
                    f"Use the original field name instead."
                )
        return errors

    def check_for_remapping_conflicts(
        self, fixed_values: dict, remappings: dict
    ) -> list[str]:
        errors = []
        conflicting_fields = set(fixed_values.keys()) & set(remappings.keys())

        if conflicting_fields:
            conflicting_list = ", ".join(sorted(conflicting_fields))
            errors.append(
                f"Fixed values cannot be applied to remapped fields: {conflicting_list}"
            )
        return errors

    def check_for_valid_aliases(
        self, fixed_values: dict, remappings: dict
    ) -> list[str]:
        errors = []
        remapped_values = set(remappings.values())

        for field_name in fixed_values.keys():
            if field_name not in remapped_values and field_name not in self.model_aliases:
                errors.append(
                    f"Fixed value field '{field_name}' is not a valid metadata field alias. "
                    f"Valid aliases are: {', '.join(sorted(self.model_aliases))}"
                )
        return errors





