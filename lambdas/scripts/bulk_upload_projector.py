import csv as csv_module
import os
from collections import Counter, defaultdict
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

    def run(self, local_csv_path: str, expected_count: int) -> list[StagingSqsMetadata]:
        logger.info(f"Running BulkUploadProjector on: {local_csv_path}")

        staging_metadata_list, review_patients, row_results = (
            self.csv_to_sqs_metadata(local_csv_path)
        )

        output_dir = os.path.dirname(os.path.abspath(local_csv_path))
        hard_rejected_count = sum(
            1 for r in row_results if r["status"] == "hard_rejected"
        )
        preprocessed_count = sum(1 for r in row_results if r["stored_file_name"])
        ods_ingested, ods_review = self._count_patients_per_ods(row_results)
        actual_count = len(staging_metadata_list) + len(review_patients) + hard_rejected_count
        count_mismatch = actual_count != expected_count
        rows_filename, summary_filename = _output_filenames(local_csv_path)

        self._write_rows_file(output_dir, rows_filename, row_results)
        self._write_summary_file(
            output_dir,
            summary_filename,
            staging_metadata_list,
            review_patients,
            hard_rejected_count,
            preprocessed_count,
            ods_ingested,
            ods_review,
            expected_count=expected_count,
            actual_count=actual_count,
            count_mismatch=count_mismatch,
        )
        self._log_summary(
            staging_metadata_list,
            review_patients,
            hard_rejected_count,
            preprocessed_count,
            ods_ingested,
            ods_review,
            expected_count=expected_count,
            actual_count=actual_count,
            count_mismatch=count_mismatch,
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

        return staging_metadata_list, failed_files, row_results

    def _process_metadata_row(
        self,
        row: dict,
        patients: dict,
        failed_files: dict,
        row_results: list,
    ) -> None:
        file_metadata = MetadataFile.model_validate(row)

        if self.fixed_values:
            file_metadata = self._apply_fixed_values(file_metadata)

        nhs_number = file_metadata.nhs_number
        ods_code = file_metadata.gp_practice_code

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

    def _count_patients_per_ods(
        self, row_results: list[dict]
    ) -> tuple[Counter, Counter]:
        ods_ingested: Counter = Counter()
        ods_review: Counter = Counter()
        seen_ingested: set = set()
        seen_review: set = set()
        for r in row_results:
            nhs = r["nhs_number"]
            ods = r["gp_practice_code"]
            if not nhs or not ods:
                continue
            key = (nhs, ods)
            if r["status"] == "to_be_ingested" and key not in seen_ingested:
                ods_ingested[ods] += 1
                seen_ingested.add(key)
            elif r["status"] == "sent_for_review" and key not in seen_review:
                ods_review[ods] += 1
                seen_review.add(key)
        return ods_ingested, ods_review

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
        preprocessed_count: int,
        ods_ingested: Counter = None,
        ods_review: Counter = None,
        expected_count: int = None,
        actual_count: int = None,
        count_mismatch: bool = False,
    ) -> None:
        import json

        payload = {
            "inputFileLocation": "<S3_KEY_FOR_METADATA_FILE>",
            "preFormatType": self.format_type,
        }
        if self.metadata_heading_remap:
            payload["metadataFieldRemappings"] = self.metadata_heading_remap
        if self.fixed_values:
            payload["fixedValues"] = self.fixed_values

        ods_ingested = ods_ingested or Counter()
        ods_review = ods_review or Counter()
        all_ods_codes = sorted(set(ods_ingested) | set(ods_review))

        lines = [
            "METADATA PROJECTION SUMMARY",
            "=" * 60,
            f"Patients to be ingested : {len(staging_metadata_list)}",
            f"Patients sent for review: {len(review_patients)}",
            f"Hard rejected rows      : {hard_rejected_count}",
            f"Files pre-processed     : {preprocessed_count}",
        ]
        if count_mismatch:
            lines.append(f"*** COUNT MISMATCH: expected {expected_count}, got {actual_count} ***")
        else:
            lines.append(f"Expected count check    : PASSED ({actual_count})")
        lines += [
            "",
            "Per ODS code:",
        ]
        for ods in all_ods_codes:
            ingested = ods_ingested.get(ods, 0)
            review = ods_review.get(ods, 0)
            parts = []
            if ingested:
                parts.append(f"{ingested} to be ingested")
            if review:
                parts.append(f"{review} for review")
            lines.append(f"  {ods}: {', '.join(parts)}")
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
        preprocessed_count: int,
        ods_ingested: Counter = None,
        ods_review: Counter = None,
        expected_count: int = None,
        actual_count: int = None,
        count_mismatch: bool = False,
    ) -> None:
        ods_ingested = ods_ingested or Counter()
        ods_review = ods_review or Counter()
        all_ods_codes = sorted(set(ods_ingested) | set(ods_review))

        logger.info("=" * 60)
        logger.info("METADATA PROJECTION SUMMARY")
        logger.info(f"  Patients to be ingested : {len(staging_metadata_list)}")
        logger.info(f"  Patients sent for review: {len(review_patients)}")
        logger.info(f"  Hard rejected rows      : {hard_rejected_count}")
        logger.info(f"  Files pre-processed     : {preprocessed_count}")
        if count_mismatch:
            logger.warning(f"  *** COUNT MISMATCH: expected {expected_count}, got {actual_count} ***")
        else:
            logger.info(f"  Expected count check    : PASSED ({actual_count})")
        logger.info("  Per ODS code:")
        for ods in all_ods_codes:
            ingested = ods_ingested.get(ods, 0)
            review = ods_review.get(ods, 0)
            parts = []
            if ingested:
                parts.append(f"{ingested} to be ingested")
            if review:
                parts.append(f"{review} for review")
            logger.info(f"    {ods}: {', '.join(parts)}")
        import json

        payload = {
            "inputFileLocation": "<S3_KEY_FOR_METADATA_FILE>",
            "preFormatType": self.format_type,
        }
        if self.metadata_heading_remap:
            payload["metadataFieldRemappings"] = self.metadata_heading_remap
        if self.fixed_values:
            payload["fixedValues"] = self.fixed_values

        logger.info("  Lambda payload JSON:")
        logger.info(json.dumps(payload, indent=2))
        logger.info("=" * 60)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Project a bulk upload metadata CSV without AWS interaction.",
    )
    parser.add_argument("csv_path", help="Path to the local metadata CSV file")
    parser.add_argument("expected_count", type=int, help="Expected total number of patients to be processed (ingested + review + hard rejected)")
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
    projector.run(args.csv_path, args.expected_count)
