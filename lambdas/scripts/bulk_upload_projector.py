import csv as csv_module
import os
from collections import defaultdict
from datetime import datetime

from models.staging_metadata import (
    BulkUploadQueueMetadata,
    MetadataFile,
    StagingSqsMetadata,
)
from services.bulk_upload.metadata_general_preprocessor import (
    MetadataGeneralPreprocessor,
)
from services.bulk_upload_metadata_processor_service import MetadataPreprocessorService
from services.metadata_mapping_validator_service import MetadataMappingValidatorService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import InvalidFileNameException

logger = LoggingService(__name__)


def _output_filenames(input_csv_path: str) -> tuple[str, str]:
    stem = os.path.splitext(os.path.basename(input_csv_path))[0]
    date_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    return (
        f"{stem}_projection_rows_{date_str}.csv",
        f"{stem}_projection_summary_{date_str}.txt",
    )


ROW_FIELDS = [
    "nhs_number",
    "gp_practice_code",
    "file_path",
    "stored_file_name",
    "status",
    "reason",
]


class BulkUploadProjector:
    """
    Emulates BulkUploadMetadataProcessorService against a local CSV file
    without making any AWS calls (no S3, SQS, or DynamoDB interactions).
    """

    def __init__(
        self,
        metadata_formatter_service: MetadataPreprocessorService = None,
        metadata_heading_remap: dict = None,
        fixed_values: dict = None,
        format_type: str = "general",
    ):
        self.metadata_formatter_service = (
            metadata_formatter_service
            or MetadataGeneralPreprocessor(practice_directory="")
        )
        self.metadata_heading_remap = metadata_heading_remap or {}
        self.fixed_values = fixed_values or {}
        self.format_type = format_type
        self.metadata_mapping_validator_service = MetadataMappingValidatorService()

    def run(self, local_csv_path: str) -> list[StagingSqsMetadata]:
        logger.info(f"Running BulkUploadProjector on: {local_csv_path}")

        staging_metadata_list, review_patients, row_results, file_paths = (
            self.csv_to_sqs_metadata(local_csv_path)
        )

        output_dir = os.path.dirname(os.path.abspath(local_csv_path))
        hard_rejected_count = sum(
            1 for r in row_results if r["status"] == "hard_rejected"
        )
        rows_filename, summary_filename = _output_filenames(local_csv_path)

        self._write_rows_file(output_dir, rows_filename, row_results)
        self._write_summary_file(
            output_dir,
            summary_filename,
            staging_metadata_list,
            review_patients,
            hard_rejected_count,
            file_paths,
        )
        self._log_summary(
            staging_metadata_list,
            review_patients,
            hard_rejected_count,
            file_paths,
        )

        return staging_metadata_list

    def csv_to_sqs_metadata(self, csv_file_path: str):
        logger.info("Parsing bulk upload metadata")
        patients: defaultdict[tuple[str, str], list[BulkUploadQueueMetadata]] = (
            defaultdict(list)
        )
        failed_files: defaultdict[tuple[str, str], list[BulkUploadQueueMetadata]] = (
            defaultdict(list)
        )
        all_file_paths: list[str] = []
        row_results: list[dict] = []

        with open(
            csv_file_path,
            mode="r",
            encoding="utf-8-sig",
            errors="replace",
        ) as csv_file:
            csv_reader = csv_module.DictReader(csv_file)
            if csv_reader.fieldnames is None:
                raise ValueError("Metadata file is empty or missing headers.")
            records = list(csv_reader)

        validated_rows, rejected_rows, rejected_reasons = (
            self.metadata_mapping_validator_service.validate_and_normalize_metadata(
                records,
                self.fixed_values,
                self.metadata_heading_remap,
            )
        )

        for reason in rejected_reasons:
            logger.warning(f"Rejected due to: {reason['REASON']}")
            row_results.append(
                {
                    "nhs_number": "",
                    "gp_practice_code": "",
                    "file_path": reason.get("FILEPATH", ""),
                    "stored_file_name": "",
                    "status": "hard_rejected",
                    "reason": reason["REASON"],
                },
            )

        logger.info(
            f"There are {len(validated_rows)} valid rows, and {len(rejected_rows)} rejected rows",
        )

        for row in validated_rows:
            self._process_metadata_row(
                row,
                patients,
                failed_files,
                all_file_paths,
                row_results,
            )

        if failed_files:
            for (nhs_number, _), files in failed_files.items():
                logger.info(
                    f"[Dry run] Would send {len(files)} failed file(s) to review queue for NHS {nhs_number}",
                )

        staging_metadata_list = [
            StagingSqsMetadata(nhs_number=nhs_number, files=files)
            for (nhs_number, _), files in patients.items()
        ]

        return staging_metadata_list, failed_files, row_results, all_file_paths

    def _process_metadata_row(
        self,
        row: dict,
        patients: dict,
        failed_files: dict,
        all_file_paths: list,
        row_results: list,
    ) -> None:
        file_metadata = MetadataFile.model_validate(row)

        if self.fixed_values:
            file_metadata = self._apply_fixed_values(file_metadata)

        nhs_number = file_metadata.nhs_number
        ods_code = file_metadata.gp_practice_code
        all_file_paths.append(file_metadata.file_path)

        try:
            correct_file_name = self._validate_and_correct_filename(file_metadata)
        except InvalidFileNameException as error:
            logger.error(f"Invalid filename {file_metadata.file_path}: {error}")
            failed_file = BulkUploadQueueMetadata(
                **file_metadata.model_dump(),
                stored_file_name=file_metadata.file_path,
            )
            failed_files[(nhs_number, ods_code)].append(failed_file)
            row_results.append(
                {
                    "nhs_number": nhs_number,
                    "gp_practice_code": ods_code,
                    "file_path": file_metadata.file_path,
                    "stored_file_name": "",
                    "status": "sent_for_review",
                    "reason": str(error),
                },
            )
            return

        sqs_metadata = BulkUploadQueueMetadata(
            **file_metadata.model_dump(),
            stored_file_name=correct_file_name,
        )
        patients[(nhs_number, ods_code)].append(sqs_metadata)
        row_results.append(
            {
                "nhs_number": nhs_number,
                "gp_practice_code": ods_code,
                "file_path": file_metadata.file_path,
                "stored_file_name": (
                    correct_file_name
                    if correct_file_name != file_metadata.file_path
                    else ""
                ),
                "status": "to_be_ingested",
                "reason": "",
            },
        )

    def _apply_fixed_values(self, file_metadata: MetadataFile) -> MetadataFile:
        metadata_dict = file_metadata.model_dump(by_alias=True)
        for field_name, fixed_value in self.fixed_values.items():
            metadata_dict[field_name] = fixed_value
        return MetadataFile.model_validate(metadata_dict)

    def _validate_and_correct_filename(self, file_metadata: MetadataFile) -> str:
        from utils.exceptions import LGInvalidFilesException
        from utils.lloyd_george_validator import validate_file_name

        try:
            validate_file_name(file_metadata.file_path.split("/")[-1])
            return file_metadata.file_path
        except LGInvalidFilesException:
            return self.metadata_formatter_service.validate_record_filename(
                file_metadata.file_path,
                file_metadata.nhs_number,
            )

    def _write_rows_file(
        self,
        output_dir: str,
        filename: str,
        row_results: list[dict],
    ) -> None:
        path = os.path.join(output_dir, filename)
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv_module.DictWriter(f, fieldnames=ROW_FIELDS)
            writer.writeheader()
            writer.writerows(row_results)
        logger.info(f"Row results written to: {path}")

    def _write_summary_file(
        self,
        output_dir: str,
        filename: str,
        staging_metadata_list: list[StagingSqsMetadata],
        review_patients: dict,
        hard_rejected_count: int,
        file_paths: list[str],
    ) -> None:
        all_top_level_folders = sorted(
            {p.lstrip("/").split("/")[0] for p in file_paths if "/" in p.lstrip("/")},
        )
        top_level_folders = all_top_level_folders[:5]
        extra_folders = len(all_top_level_folders) - len(top_level_folders)

        import json

        payload = {
            "inputFileLocation": "<S3_KEY_FOR_METADATA_FILE>",
            "preFormatType": self.format_type,
        }
        if self.metadata_heading_remap:
            payload["metadataFieldRemappings"] = self.metadata_heading_remap
        if self.fixed_values:
            payload["fixedValues"] = self.fixed_values

        lines = [
            "PROJECTION SUMMARY",
            "=" * 60,
            f"Patients to be ingested : {len(staging_metadata_list)}",
            f"Patients sent for review: {len(review_patients)}",
            f"Hard rejected rows      : {hard_rejected_count}",
            "",
            "Where to place metadata file in S3:",
            "  Place your metadata file one level above these folder(s):",
        ]
        for folder in top_level_folders:
            lines.append(f"    {folder}/")
        if extra_folders:
            lines.append(f"    ... and {extra_folders} more folder(s)")

        lines += [
            "",
            "Lambda payload JSON:",
            json.dumps(payload, indent=2),
        ]

        path = os.path.join(output_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        logger.info(f"Summary written to: {path}")

    def _log_summary(
        self,
        staging_metadata_list: list[StagingSqsMetadata],
        review_patients: dict,
        hard_rejected_count: int,
        file_paths: list[str],
    ) -> None:
        all_top_level_folders = sorted(
            {p.lstrip("/").split("/")[0] for p in file_paths if "/" in p.lstrip("/")},
        )
        top_level_folders = all_top_level_folders[:5]
        extra_folders = len(all_top_level_folders) - len(top_level_folders)

        logger.info("=" * 60)
        logger.info("PROJECTION SUMMARY")
        logger.info(f"  Patients to be ingested : {len(staging_metadata_list)}")
        logger.info(f"  Patients sent for review: {len(review_patients)}")
        logger.info(f"  Hard rejected rows      : {hard_rejected_count}")
        import json

        payload = {
            "inputFileLocation": "<S3_KEY_FOR_METADATA_FILE>",
            "preFormatType": self.format_type,
        }
        if self.metadata_heading_remap:
            payload["metadataFieldRemappings"] = self.metadata_heading_remap
        if self.fixed_values:
            payload["fixedValues"] = self.fixed_values

        logger.info("  Where to place metadata file in S3:")
        logger.info("    Place your metadata file one level above these folder(s):")
        for folder in top_level_folders:
            logger.info(f"      {folder}/")
        if extra_folders:
            logger.info(f"      ... and {extra_folders} more folder(s)")

        logger.info("  Lambda payload JSON:")
        logger.info(json.dumps(payload, indent=2))
        logger.info("=" * 60)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Project a bulk upload metadata CSV without AWS interaction.",
    )
    parser.add_argument("csv_path", help="Path to the local metadata CSV file")
    parser.add_argument(
        "--format-type",
        choices=["general", "usb"],
        default="general",
        help="Preprocessor format type (default: general)",
    )
    parser.add_argument(
        "--remap",
        nargs="*",
        metavar="ORIGINAL=MAPPED",
        default=[],
        help='Column remappings e.g. --remap "NHS-NO=nhsnumber" "FILEPATH=file"',
    )
    parser.add_argument(
        "--fixed",
        nargs="*",
        metavar="KEY=VALUE",
        default=[],
        help='Fixed values e.g. --fixed "GP-PRACTICE-CODE=M85143" "SCAN-DATE=01/01/2022"',
    )
    args = parser.parse_args()

    def parse_kv(pairs):
        result = {}
        for pair in pairs:
            k, _, v = pair.partition("=")
            result[k.strip()] = v.strip()
        return result

    remappings = parse_kv(args.remap)
    fixed_values = parse_kv(args.fixed)

    if args.format_type == "usb":
        from services.bulk_upload.metadata_usb_preprocessor import (
            MetadataUsbPreprocessorService,
        )

        formatter = MetadataUsbPreprocessorService(practice_directory="")
    else:
        formatter = MetadataGeneralPreprocessor(practice_directory="")

    projector = BulkUploadProjector(
        metadata_formatter_service=formatter,
        metadata_heading_remap=remappings,
        fixed_values=fixed_values,
        format_type=args.format_type,
    )
    projector.run(args.csv_path)
