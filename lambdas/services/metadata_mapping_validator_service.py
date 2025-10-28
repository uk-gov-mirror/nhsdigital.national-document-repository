import json
from pathlib import Path
from typing import Type, Optional
from pydantic import BaseModel, Field, ValidationError, create_model, ConfigDict
from models.staging_metadata import MetadataFile
from utils.audit_logging_setup import LoggingService
from utils.exceptions import BulkUploadMetadataException

logger = LoggingService(__name__)

class MetadataMappingValidationService:
    def __init__(self, alias_folder: str = "configs/metadata_aliases"):
        self.alias_folder = alias_folder
        self.logger = LoggingService(__name__)

    def detect_best_alias_config(self, csv_headers: list[str]) -> str:
        header_set = {h.strip().lower() for h in csv_headers if h}
        best_match = None
        best_score = 0.0

        for path in Path(self.alias_folder).glob("*.json"):
            source_name = path.stem
            try:
                with open(path, "r", encoding="utf-8") as f:
                    alias_map = json.load(f)
            except json.JSONDecodeError as e:
                self.logger.warning(f"Skipping invalid JSON '{path.name}': {e}")
                continue

            alias_fields = {str(v).strip().lower() for v in alias_map.values() if v}
            matches = len(alias_fields & header_set)
            score = matches / len(alias_fields)

            if score > best_score:
                best_score = score
                best_match = source_name

        if not best_match:
            raise BulkUploadMetadataException("No alias configuration matches the CSV headers.")

        self.logger.info(f"Detected alias config '{best_match}' with score {best_score:.0%}")
        return best_match

    def build_model_for_alias(self, source_name: str) -> Type[BaseModel]:
        alias_path = Path(self.alias_folder) / f"{source_name}.json"
        if not alias_path.exists():
            raise FileNotFoundError(f"No alias config found for source: {source_name}")

        with open(alias_path, "r", encoding="utf-8") as f:
            alias_map = json.load(f)

        missing_keys = set(MetadataFile.model_fields.keys()) - set(alias_map.keys())

        if missing_keys:
            raise BulkUploadMetadataException(
                f"Alias config '{source_name}' is missing mappings for: {', '.join(sorted(missing_keys))}"
            )

        new_fields = {}
        for field_name, model_field in MetadataFile.model_fields.items():
            alias = alias_map.get(field_name)

            if alias is None:
                annotation = Optional[model_field.annotation]
                default = None
            else:
                annotation = model_field.annotation
                default = ...

            new_fields[field_name] = (annotation, Field(default=default, alias=alias))

        model_config = ConfigDict(populate_by_name=True, from_attributes=True, extra="allow")
        dynamic_model = create_model(
            f"Metadata_{source_name.title()}",
            __config__=model_config,
            **new_fields,
        )

        self.logger.info(f"Dynamic model created for source '{source_name}'")
        return dynamic_model

    def validate_and_normalize_metadata(self, records: list[dict], source_name: str):
        model = self.build_model_for_alias(source_name)
        validated_rows, rejected_rows, rejected_reasons = [], [], []

        required_fields = [
            name for name, field in MetadataFile.model_fields.items()
            if field.is_required()
        ]

        for row in records:
            try:
                instance = model.model_validate(row)
                data = instance.model_dump(by_alias=False)

                empty_required_fields = self.get_empty_required_fields(data, required_fields)
                if empty_required_fields:
                    raise ValueError(
                        f"Missing or empty required fields: {', '.join(empty_required_fields)}"
                    )

                validated_rows.append(data)

            except (ValidationError, ValueError) as e:
                rejected_rows.append(row)
                rejected_reasons.append({
                    "FILEPATH": row.get("FILEPATH", "N/A"),
                    "REASON": str(e),
                })

        return validated_rows, rejected_rows, rejected_reasons


    def get_empty_required_fields(self,data: dict, required_fields: list[str]) -> list[str]:
        """Return a list of required fields that are missing or empty."""
        return [
            field
            for field in required_fields
            if data.get(field) is None
            or (isinstance(data.get(field), str) and not data.get(field).strip())
        ]
