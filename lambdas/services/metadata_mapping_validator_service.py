import json
from pathlib import Path
from typing import Type

from models.staging_metadata import MetadataFile
from pydantic import BaseModel, ConfigDict, Field, ValidationError, create_model
from services.base.s3_service import S3Service
from utils.audit_logging_setup import LoggingService
from utils.exceptions import BulkUploadMetadataException


class MetadataMappingValidatorService:
    def __init__(self, configs_bucket_name: str, alias_prefix: str):
        self.configs_bucket_name = configs_bucket_name
        self.alias_prefix = alias_prefix.rstrip("/") + "/"
        self.s3_service = S3Service()
        self.logger = LoggingService(__name__)

    def detect_best_alias_config(self, csv_headers: list[str]) -> str:
        header_set = {h.strip().lower() for h in csv_headers if h}

        alias_maps = self.list_alias_configs_from_s3()
        if not alias_maps:
            raise BulkUploadMetadataException("No alias configurations found in S3.")

        match_results = self.evaluate_alias_matches(alias_maps, header_set)
        best_match, best_info = self.select_best_match(match_results)

        if not best_match:
            raise BulkUploadMetadataException(
                "No alias configuration matches the CSV headers."
            )

        self.log_best_match(best_match, best_info, alias_maps)
        return best_match

    def list_alias_configs_from_s3(self) -> dict[str, dict]:
        if not self.configs_bucket_name:
            raise BulkUploadMetadataException(
                "Alias config bucket not configured for validator."
            )

        alias_maps = {}
        try:
            self.logger.info(
                f"Listing alias configs from S3 prefix: {self.alias_prefix}"
            )
            s3_objects = self.s3_service.list_all_objects(self.configs_bucket_name)

            for obj in s3_objects:
                key = obj["Key"]
                if not key.startswith(self.alias_prefix) or not key.endswith(".json"):
                    continue

                s3_buffer = self.s3_service.stream_s3_object_to_memory(
                    self.configs_bucket_name, key
                )
                alias_map = json.load(s3_buffer)
                source_name = Path(key).stem
                alias_maps[source_name] = alias_map

        except Exception as e:
            raise BulkUploadMetadataException(
                f"Failed to load alias configs from S3: {e}"
            )

        return alias_maps

    def evaluate_alias_matches(
        self, alias_maps: dict[str, dict], header_set: set[str]
    ) -> dict[str, dict]:
        results = {}

        for source_name, alias_map in alias_maps.items():
            alias_fields = {
                str(v).strip().lower()
                for k, v in alias_map.items()
                if k != "owner" and v
            }
            matched_fields = alias_fields & header_set
            missing_fields = alias_fields - header_set
            total_fields = len(alias_fields)
            match_count = len(matched_fields)

            if total_fields == 0:
                continue

            score = match_count / total_fields
            results[source_name] = {
                "score": score,
                "match_count": match_count,
                "total_fields": total_fields,
                "matched_fields": sorted(matched_fields),
                "missing_fields": sorted(missing_fields),
            }

        return results

    def select_best_match(
        self, match_results: dict[str, dict]
    ) -> tuple[str | None, dict | None]:
        if not match_results:
            return None, None

        best_match = max(match_results, key=lambda k: match_results[k]["score"])
        best_info = match_results[best_match]
        return best_match, best_info

    def log_best_match(
        self, best_match: str, best_info: dict, alias_maps: dict[str, dict]
    ):
        info = best_info
        self.logger.info(
            f"Detected alias config '{best_match}': "
            f"matched {info['match_count']} of {info['total_fields']} fields."
        )
        self.logger.info(
            f"Matched fields: {', '.join(info['matched_fields']) or 'None'}"
        )
        self.logger.info(
            f"Missing fields: {', '.join(info['missing_fields']) or 'None'}"
        )

        owner = alias_maps[best_match].get("owner")
        if owner:
            self.logger.info(f"Alias file '{best_match}' owned by '{owner}'")

    def build_model_for_alias(self, source_name: str) -> Type[BaseModel]:
        alias_map = self.load_alias_map(source_name)
        self.validate_alias_map(alias_map, source_name)
        return self.create_dynamic_model(alias_map, source_name)

    def load_alias_map(self, source_name: str) -> dict:
        alias_filename = f"{source_name}.json"
        s3_key = f"{self.alias_prefix}{alias_filename}"

        try:
            self.logger.info(
                f"Loading alias config from S3: s3://{self.configs_bucket_name}/{s3_key}"
            )
            s3_buffer = self.s3_service.stream_s3_object_to_memory(
                self.configs_bucket_name, s3_key
            )
            alias_map = json.load(s3_buffer)
            self.logger.info(f"Loaded alias config from S3: {alias_filename}")
        except Exception as e:
            raise BulkUploadMetadataException(
                f"Could not load alias file '{alias_filename}' from S3: {e}"
            )

        if not alias_map:
            raise BulkUploadMetadataException(
                f"Alias file '{alias_filename}' is empty or invalid."
            )
        return alias_map

    def validate_alias_map(self, alias_map: dict, source_name: str) -> None:
        alias_field_keys = {
            k for k in alias_map.keys() if k in MetadataFile.model_fields
        }
        missing_keys = set(MetadataFile.model_fields.keys()) - alias_field_keys
        if missing_keys:
            raise BulkUploadMetadataException(
                f"Alias config '{source_name}' is missing mappings for: {', '.join(sorted(missing_keys))}"
            )

    def create_dynamic_model(
        self, alias_map: dict, source_name: str
    ) -> Type[BaseModel]:
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
