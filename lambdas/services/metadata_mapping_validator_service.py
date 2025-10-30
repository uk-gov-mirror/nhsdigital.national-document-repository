import json
from pathlib import Path
from typing import Type

from models.staging_metadata import MetadataFile
from pydantic import BaseModel, ConfigDict, Field, ValidationError, create_model
from services.base.s3_service import S3Service
from utils.audit_logging_setup import LoggingService
from utils.exceptions import BulkUploadMetadataException

logger = LoggingService(__name__)


class MetadataMappingValidationService:
    def __init__(
        self,
        alias_folder: str = "configs/metadata_aliases",
        alias_bucket: str = None,
        alias_prefix: str = None,
    ):
        self.alias_folder = alias_folder  # fallback in case of not finding json in S3
        self.alias_bucket = alias_bucket
        self.alias_prefix = alias_prefix
        self.s3_service = S3Service()
        self.logger = LoggingService(__name__)

    def detect_best_alias_config(self, csv_headers: list[str]) -> str:
        header_set = {h.strip().lower() for h in csv_headers if h}
        best_match = None
        best_score = 0.0
        alias_maps = {}

        # --- Try loading alias configs from S3 first ---
        if self.alias_bucket:
            try:
                self.logger.info(f"Listing alias configs from S3 prefix: {self.alias_prefix}")
                s3_objects = self.s3_service.list_all_objects(self.alias_bucket)
                for obj in s3_objects:
                    key = obj["Key"]
                    # Skip unrelated or non-json files
                    if not key.startswith(self.alias_prefix) or not key.endswith(".json"):
                        continue

                    # Read the JSON from S3
                    s3_buffer = self.s3_service.stream_s3_object_to_memory(self.alias_bucket, key)
                    alias_map = json.load(s3_buffer)
                    source_name = Path(key).stem
                    alias_maps[source_name] = alias_map
            except Exception as e:
                self.logger.warning(f"Failed to load alias configs from S3: {e}")

        # --- Fallback to local configs ---
        if not alias_maps:
            for path in Path(self.alias_folder).glob("*.json"):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        alias_maps[path.stem] = json.load(f)
                except json.JSONDecodeError as e:
                    self.logger.warning(f"Skipping invalid JSON '{path.name}': {e}")

        # --- Pick best match ---
        for source_name, alias_map in alias_maps.items():
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
        """Builds a dynamic Pydantic model based on an alias mapping (S3 or local)."""
        alias_map = self.load_alias_map(source_name)
        self.validate_alias_map(alias_map, source_name)
        return self.create_dynamic_model(alias_map, source_name)

    def load_alias_map(self, source_name: str) -> dict:
        alias_filename = f"{source_name}.json"

        # Try to get the jsons from S3
        if self.alias_bucket:
            s3_key = f"{self.alias_prefix}{alias_filename}"
            try:
                self.logger.info(
                    f"Trying to load alias config from S3: s3://{self.alias_bucket}/{s3_key}"
                )
                s3_buffer = self.s3_service.stream_s3_object_to_memory(
                    self.alias_bucket, s3_key
                )
                alias_map = json.load(s3_buffer)
                self.logger.info(f"Loaded alias config from S3: {alias_filename}")
                if alias_map:
                    return alias_map
            except Exception as e:
                self.logger.warning(
                    f"Could not load alias from S3 ({e}), falling back to local files"
                )

        # Uses local files as fallback
        alias_path = Path(self.alias_folder) / alias_filename
        if not alias_path.exists():
            raise FileNotFoundError(f"No alias config found for source: {source_name}")

        self.logger.info(f"Loading alias config locally: {alias_path}")
        with open(alias_path, "r", encoding="utf-8") as f:
            alias_map = json.load(f)

        # Log owner if present
        owner = alias_map.get("owner")
        if owner:
            self.logger.info(f"Alias '{alias_filename}' owned by: {owner}")

        if not alias_map:
            raise BulkUploadMetadataException(
                f"Alias file '{alias_filename}' is empty or invalid."
            )

        return alias_map

    def validate_alias_map(self, alias_map: dict, source_name: str) -> None:
        """Ensure alias mapping covers all required MetadataFile fields."""
        alias_field_keys = {k for k in alias_map.keys() if k in MetadataFile.model_fields}
        missing_keys = set(MetadataFile.model_fields.keys()) - alias_field_keys
        if missing_keys:
            raise BulkUploadMetadataException(
                f"Alias config '{source_name}' is missing mappings for: {', '.join(sorted(missing_keys))}"
            )

    def create_dynamic_model(
        self, alias_map: dict, source_name: str
    ) -> Type[BaseModel]:
        """Create a Pydantic model using alias mapping."""
        new_fields = {
            name: (field.annotation, Field(alias=alias_map.get(name)))
            for name, field in MetadataFile.model_fields.items()
        }

        model_config = ConfigDict(
            populate_by_name=True, from_attributes=True, extra="allow"
        )

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
            name
            for name, field in MetadataFile.model_fields.items()
            if field.is_required()
        ]

        for row in records:
            try:
                instance = model.model_validate(row)
                data = instance.model_dump(by_alias=False)

                empty_required_fields = self.get_empty_required_fields(
                    data, required_fields
                )
                if empty_required_fields:
                    raise ValueError(
                        f"Missing or empty required fields: {', '.join(empty_required_fields)}"
                    )

                validated_rows.append(data)

            except (ValidationError, ValueError) as e:
                rejected_rows.append(row)
                rejected_reasons.append(
                    {
                        "FILEPATH": row.get("FILEPATH", "N/A"),
                        "REASON": str(e),
                    }
                )

        return validated_rows, rejected_rows, rejected_reasons

    def get_empty_required_fields(
        self, data: dict, required_fields: list[str]
    ) -> list[str]:
        """Return a list of required fields that are missing or empty."""
        return [
            field
            for field in required_fields
            if data.get(field) is None
            or (isinstance(data.get(field), str) and not data.get(field).strip())
        ]
