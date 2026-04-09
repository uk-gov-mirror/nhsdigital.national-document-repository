import csv
import os
import shutil
import tempfile
import urllib.parse
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import pydantic
from botocore.exceptions import ClientError

from enums.document_review_reason import DocumentReviewReason
from enums.lloyd_george_pre_process_format import LloydGeorgePreProcessFormat
from enums.upload_status import UploadStatus
from enums.virus_scan_result import VirusScanResult
from models.staging_metadata import (
    BulkUploadQueueMetadata,
    MetadataFile,
    StagingSqsMetadata,
)
from repositories.bulk_upload.bulk_upload_dynamo_repository import (
    BulkUploadDynamoRepository,
)
from repositories.bulk_upload.bulk_upload_s3_repository import BulkUploadS3Repository
from repositories.bulk_upload.bulk_upload_sqs_repository import BulkUploadSqsRepository
from services.base.s3_service import S3Service
from services.base.sqs_service import SQSService
from services.bulk_upload.metadata_general_preprocessor import (
    MetadataGeneralPreprocessor,
)
from services.bulk_upload.metadata_usb_preprocessor import (
    MetadataUsbPreprocessorService,
)
from services.bulk_upload_metadata_preprocessor_service import (
    MetadataPreprocessorService,
)
from services.metadata_mapping_validator_service import MetadataMappingValidatorService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import (
    BulkUploadMetadataException,
    InvalidFileNameException,
    LGInvalidFilesException,
    OdsErrorException,
    VirusScanFailedException,
)
from utils.filename_utils import extract_nhs_number_from_bulk_upload_file_name
from utils.lloyd_george_validator import validate_file_name
from utils.ods_utils import is_valid_ods_code
from utils.utilities import get_virus_scan_service

logger = LoggingService(__name__)
UNSUCCESSFUL = "Unsuccessful bulk upload"
EXPEDITE_UPLOAD_VALIDATION_FAILED_LOG_MARKER = "EXPEDITE_UPLOAD_VALIDATION_FAILED"


class BulkUploadMetadataProcessorService:

    def __init__(
        self,
        metadata_formatter_service: MetadataPreprocessorService,
        metadata_heading_remap: dict,
        input_file_location: str = "",
        fixed_values: dict = None,
        send_to_review_enabled: bool = False,
    ):
        self.staging_bucket_name = os.getenv("STAGING_STORE_BUCKET_NAME")
        self.metadata_queue_url = os.getenv("METADATA_SQS_QUEUE_URL")
        self.expedite_queue_url = os.getenv("EXPEDITE_SQS_QUEUE_URL")
        self.s3_service = S3Service()
        self.sqs_service = SQSService()
        self.dynamo_repository = BulkUploadDynamoRepository()
        self.sqs_repository = BulkUploadSqsRepository()
        self.s3_repo = BulkUploadS3Repository()
        self.virus_scan_service = get_virus_scan_service()

        self.metadata_heading_remap = metadata_heading_remap
        self.fixed_values = fixed_values or {}

        self.temp_download_dir = tempfile.mkdtemp()
        self.file_key = input_file_location

        self.metadata_mapping_validator_service = MetadataMappingValidatorService()

        self.metadata_formatter_service = metadata_formatter_service
        self.send_to_review_enabled = send_to_review_enabled

    def download_metadata_from_s3(self) -> str:
        local_file_path = f"{self.temp_download_dir}/{self.file_key.split('/')[-1]}"

        logger.info(
            f"Fetching {local_file_path} from bucket {self.staging_bucket_name}",
        )

        try:
            self.s3_service.download_file(
                s3_bucket_name=self.staging_bucket_name,
                file_key=self.file_key,
                download_path=local_file_path,
            )
        except ClientError:
            raise BulkUploadMetadataException(
                f"Could not retrieve the following metadata file: {self.file_key}",
            )
        return local_file_path

    def process_metadata(self):
        try:
            metadata_file = self.download_metadata_from_s3()
            staging_metadata_list = self.csv_to_sqs_metadata(metadata_file)
            logger.info("Finished parsing metadata")

            self.send_metadata_to_fifo_sqs(staging_metadata_list)

            self.copy_metadata_to_dated_folder()
            self.clear_temp_storage()

        except pydantic.ValidationError as e:
            failure_msg = (
                f"Failed to parse {self.file_key} due to validation error: {str(e)}"
            )
            logger.error(failure_msg, {"Result": UNSUCCESSFUL})
            raise BulkUploadMetadataException(failure_msg)

        except KeyError as e:
            failure_msg = f"Failed due to missing key: {str(e)}"
            logger.error(failure_msg, {"Result": UNSUCCESSFUL})
            raise BulkUploadMetadataException(failure_msg)

        except ClientError as e:
            if "HeadObject" in str(e):
                failure_msg = (
                    f'No metadata file could be found with the name {self.file_key}"'
                )
            else:
                failure_msg = str(e)
            logger.error(failure_msg, {"Result": UNSUCCESSFUL})
            raise BulkUploadMetadataException(failure_msg)

    def csv_to_sqs_metadata(self, csv_file_path: str) -> list[StagingSqsMetadata]:
        logger.info("Parsing bulk upload metadata")
        patients: defaultdict[tuple[str, str], list[BulkUploadQueueMetadata]] = (
            defaultdict(list)
        )
        failed_files: defaultdict[tuple[str, str], list[BulkUploadQueueMetadata]] = (
            defaultdict(list)
        )

        with open(
            csv_file_path,
            mode="r",
            encoding="utf-8-sig",
            errors="replace",
        ) as csv_file:
            csv_reader = csv.DictReader(csv_file)
            if csv_reader.fieldnames is None:
                raise BulkUploadMetadataException(
                    "Metadata file is empty or missing headers.",
                )

            headers = [h.strip() for h in csv_reader.fieldnames]
            records = list(csv_reader)

        if not headers:
            raise BulkUploadMetadataException(f"{self.file_key} has no headers.")

        validated_rows, rejected_rows, rejected_reasons = (
            self.metadata_mapping_validator_service.validate_and_normalize_metadata(
                records,
                self.fixed_values,
                self.metadata_heading_remap,
            )
        )
        if rejected_reasons:
            for reason in rejected_reasons:
                logger.warning(f"Rejected due to: {reason['REASON']}")

        logger.info(
            f"There are {len(validated_rows)} valid rows, and {len(rejected_rows)} rejected rows",
        )

        if not validated_rows:
            raise BulkUploadMetadataException(
                "No valid metadata rows found after alias validation.",
            )

        for row in validated_rows:
            self.process_metadata_row(row, patients, failed_files)

        if self.send_to_review_enabled:
            self.send_failed_files_to_review_queue(failed_files)
        else:
            logger.info(
                f"Send to review is disabled. Skipping review queue for {len(failed_files)} failed file",
            )

        return [
            StagingSqsMetadata(nhs_number=nhs_number, files=files)
            for (nhs_number, _), files in patients.items()
        ]

    def process_metadata_row(
        self,
        row: dict,
        patients: dict[tuple[str, str], list[BulkUploadQueueMetadata]],
        failed_files: dict[tuple[str, str], list[BulkUploadQueueMetadata]],
    ) -> None:
        """Validate individual file metadata and attach to a patient group."""
        file_metadata = MetadataFile.model_validate(row)

        if self.fixed_values:
            file_metadata = self.apply_fixed_values(file_metadata)

        nhs_number, ods_code = self.extract_patient_info(file_metadata)

        try:
            correct_file_name = self.validate_and_correct_filename(file_metadata)
        except InvalidFileNameException as error:
            self.handle_invalid_filename(
                file_metadata,
                error,
                nhs_number,
                ods_code,
                failed_files,
            )
            return

        sqs_metadata = self.convert_to_sqs_metadata(file_metadata, correct_file_name)

        sqs_metadata.file_path = self.add_directory_path_to_file_path(file_metadata)

        patients[(nhs_number, ods_code)].append(sqs_metadata)

    def add_directory_path_to_file_path(self, file_metadata):
        if "/" in self.file_key:
            directory_path = self.file_key.rsplit("/", 1)[0]
            return directory_path + "/" + file_metadata.file_path.lstrip("/")
        return file_metadata.file_path.lstrip("/")

    def apply_fixed_values(self, file_metadata: MetadataFile) -> MetadataFile:
        metadata_dict = file_metadata.model_dump(by_alias=True)

        for field_name, fixed_value in self.fixed_values.items():
            metadata_dict[field_name] = fixed_value
            logger.info(
                f"Applied fixed value for field '{field_name}': '{fixed_value}'",
            )

        return MetadataFile.model_validate(metadata_dict)

    @staticmethod
    def convert_to_sqs_metadata(
        file: MetadataFile,
        stored_file_name: str,
    ) -> BulkUploadQueueMetadata:
        """Convert a MetadataFile into BulkUploadQueueMetadata."""
        return BulkUploadQueueMetadata(
            **file.model_dump(),
            stored_file_name=stored_file_name,
        )

    def create_expedite_sqs_metadata(self, key) -> StagingSqsMetadata:
        """Build a single-patient SQS metadata payload for an expedited upload."""
        nhs_number, file_path, ods_code, scan_date = self.validate_expedite_file(key)
        return StagingSqsMetadata(
            nhs_number=nhs_number,
            files=[
                BulkUploadQueueMetadata(
                    file_path=file_path,
                    stored_file_name=file_path,
                    gp_practice_code=ods_code,
                    scan_date=scan_date,
                ),
            ],
        )

    @staticmethod
    def extract_patient_info(file_metadata: MetadataFile) -> tuple[str, str]:
        """Extract key patient identifiers."""
        return file_metadata.nhs_number, file_metadata.gp_practice_code

    def validate_and_correct_filename(self, file_metadata: MetadataFile) -> str:
        """Validate and normalise file name."""
        try:
            validate_file_name(file_metadata.file_path.split("/")[-1])
            return file_metadata.file_path
        except LGInvalidFilesException:
            return self.metadata_formatter_service.validate_record_filename(
                file_metadata.file_path,
                file_metadata.nhs_number,
            )

    def validate_expedite_file(self, s3_object_key: str):
        """Validate and extract fields from an expedite S3 key.
        This ensures the file represents a single document (1of1) and derives
        the key fields required to build SQS metadata."""
        file_path = os.path.basename(s3_object_key)

        if not file_path.startswith("1of1_"):
            failure_msg = (
                "Failed processing expedite event due to file not being a 1of1"
            )
            logger.error(failure_msg)
            raise InvalidFileNameException(failure_msg)

        nhs_number = extract_nhs_number_from_bulk_upload_file_name(file_path)[0]
        file_name = self.metadata_formatter_service.validate_record_filename(
            s3_object_key,
        )
        ods_code = Path(s3_object_key).parent.name
        scan_date = datetime.now().strftime("%Y-%m-%d")
        return nhs_number, file_name, ods_code, scan_date

    def validate_ods_code_format_in_expedite_folder(self, s3_object_key: str) -> None:
        """Ensure the parent directory of the expedite file is a valid ODS code."""
        ods_code = Path(s3_object_key).parent.name

        if not is_valid_ods_code(ods_code):
            failure_msg = f"Invalid ODS code folder '{ods_code}' in expedite path: {s3_object_key}"
            logger.error(failure_msg)
            raise OdsErrorException(failure_msg)

    def handle_expedite_event(self, event):
        """Process S3 EventBridge expedite uploads: enforce virus scan, ensure 1of1, extract identifiers,
        and send metadata to SQS."""
        try:
            unparsed_s3_object_key = event["detail"]["object"]["key"]
            s3_object_key = urllib.parse.unquote_plus(
                unparsed_s3_object_key,
                encoding="utf-8",
            )

            if s3_object_key.startswith("expedite/"):
                logger.info("Processing file from expedite folder")
                try:
                    self.validate_ods_code_format_in_expedite_folder(s3_object_key)

                    self.enforce_virus_scanner(s3_object_key)
                    self.check_file_status(s3_object_key)

                    sqs_metadata = self.create_expedite_sqs_metadata(s3_object_key)

                    self.send_metadata_to_expedite_sqs(sqs_metadata)
                    logger.info("Successfully processed expedite event")

                except (InvalidFileNameException, OdsErrorException) as error:
                    logger.info(EXPEDITE_UPLOAD_VALIDATION_FAILED_LOG_MARKER)
                    failure_msg = f"Expedite upload validation failed for '{s3_object_key}': {error}"
                    raise BulkUploadMetadataException(failure_msg)

            else:
                failure_msg = f"Unexpected directory or file location received from EventBridge: {s3_object_key}"
                logger.error(failure_msg)
                raise BulkUploadMetadataException(failure_msg)
        except KeyError as e:
            failure_msg = f"Failed due to missing key: {str(e)}"
            logger.error(failure_msg)
            raise BulkUploadMetadataException(failure_msg)

    def handle_invalid_filename(
        self,
        file_metadata: MetadataFile,
        error: InvalidFileNameException,
        nhs_number: str,
        ods_code: str,
        failed_files: dict[tuple[str, str], list[BulkUploadQueueMetadata]],
    ) -> None:
        """Handle invalid filenames by logging, storing failure in Dynamo, and tracking for review.
        Files that do not exist on the staging bucket are marked as failed only —
        they are never added to the review queue since they cannot be reviewed.
        """
        logger.error(
            f"Failed to process {file_metadata.file_path} due to error: {error}",
        )
        failed_file = self.convert_to_sqs_metadata(
            file_metadata,
            file_metadata.file_path,
        )
        failed_file.file_path = self.add_directory_path_to_file_path(file_metadata)

        file_exists = self.s3_repo.file_exists_on_staging_bucket(failed_file.file_path)
        if not file_exists:
            logger.info(
                f"File {failed_file.file_path} not found on staging bucket. Will not send to review.",
            )
        else:
            failed_files[(nhs_number, ods_code)].append(failed_file)

        failed_entry = StagingSqsMetadata(nhs_number=nhs_number, files=[failed_file])
        failed_entry.nhs_number = nhs_number
        self.dynamo_repository.write_report_upload_to_dynamo(
            failed_entry,
            UploadStatus.FAILED,
            str(error),
            sent_to_review=self.send_to_review_enabled and file_exists,
        )

    def send_failed_files_to_review_queue(
        self,
        failed_files: dict[tuple[str, str], list[BulkUploadQueueMetadata]],
    ) -> None:
        for (nhs_number, ods_code), files in failed_files.items():
            staging_metadata = StagingSqsMetadata(nhs_number=nhs_number, files=files)
            logger.info(
                f"Sending {len(files)} failed file(s) to review queue for NHS number: {nhs_number}",
            )
            self.sqs_repository.send_message_to_review_queue(
                staging_metadata=staging_metadata,
                uploader_ods=ods_code,
                failure_reason=DocumentReviewReason.UNSUCCESSFUL_UPLOAD,
            )

    def send_metadata_to_fifo_sqs(
        self,
        staging_sqs_metadata_list: list[StagingSqsMetadata],
    ) -> None:
        """Send validated metadata entries to SQS FIFO queue."""
        for staging_sqs_metadata in staging_sqs_metadata_list:
            nhs_number = staging_sqs_metadata.nhs_number
            logger.info(f"Sending metadata for patientId: {nhs_number}")
            self.sqs_service.send_message_with_nhs_number_attr_fifo(
                queue_url=self.metadata_queue_url,
                message_body=staging_sqs_metadata.model_dump_json(by_alias=True),
                nhs_number=nhs_number,
                group_id=f"bulk_upload_{nhs_number}",
            )
        logger.info("Sent bulk upload metadata to sqs queue")

    def send_metadata_to_expedite_sqs(
        self,
        staging_sqs_metadata: StagingSqsMetadata,
    ) -> None:
        """Send validated metadata entries to SQS expedite queue."""
        sqs_group_id = f"bulk_upload_{uuid.uuid4()}"
        nhs_number = staging_sqs_metadata.nhs_number
        logger.info(f"Sending metadata for patientId: {nhs_number}")
        self.sqs_service.send_message_with_nhs_number_attr_fifo(
            queue_url=self.expedite_queue_url,
            message_body=staging_sqs_metadata.model_dump_json(by_alias=True),
            nhs_number=nhs_number,
            group_id=sqs_group_id,
        )

    def copy_metadata_to_dated_folder(self):
        """Copy processed metadata CSV into a dated archive folder in S3."""
        logger.info("Copying metadata CSV to dated folder")
        current_datetime = datetime.now().strftime("%Y-%m-%d_%H-%M")
        original_path_directory = str(Path(self.file_key).parent)
        logger.info(f"Original file key is {self.file_key}")
        destination_key = f"metadata/{original_path_directory}_{current_datetime}.csv"
        self.s3_service.copy_across_bucket(
            self.staging_bucket_name,
            self.file_key,
            self.staging_bucket_name,
            destination_key,
        )
        self.s3_service.delete_object(self.staging_bucket_name, self.file_key)

    def clear_temp_storage(self):
        """Delete the temporary working directory."""
        logger.info("Clearing temp storage directory")
        try:
            shutil.rmtree(self.temp_download_dir)
        except FileNotFoundError:
            pass

    def check_file_status(self, file_key: str):
        scan_result = self.s3_repo.check_file_tag_status_on_staging_bucket(file_key)
        if scan_result != VirusScanResult.CLEAN:
            logger.info(f"Found an issue with the file {file_key}.")
            raise VirusScanFailedException(
                f"Encountered an issue when scanning the file {file_key}, scan result was {scan_result}",
            )

    def enforce_virus_scanner(self, file_key: str):
        logger.info(
            f"Checking virus scan result for file: {file_key} in {self.staging_bucket_name}",
        )

        try:
            result = self.s3_repo.check_file_tag_status_on_staging_bucket(file_key)
            if result != "":
                logger.info("The file has been scanned before")
                return
            logger.info(f"Virus scan tag missing for {file_key}.")
            self.virus_scan_service.scan_file(file_ref=file_key)

        except ClientError as e:
            error_message = str(e)
            if "NoSuchKey" in error_message or "AccessDenied" in error_message:
                logger.error(f"S3 access error when checking tag for {file_key}.")
                raise BulkUploadMetadataException(
                    f"Failed to access S3 file {file_key} during tag check.",
                )
            else:
                raise


def get_formatter_service(raw_pre_format_type):
    try:
        pre_format_type = LloydGeorgePreProcessFormat(raw_pre_format_type)
        if pre_format_type == LloydGeorgePreProcessFormat.GENERAL:
            logger.info("Using general preFormatType")
            return MetadataGeneralPreprocessor
        if pre_format_type == LloydGeorgePreProcessFormat.USB:
            logger.info("Using usb preFormatType")
            return MetadataUsbPreprocessorService
    except ValueError:
        logger.warning(
            f"Invalid preFormatType: '{raw_pre_format_type}', defaulting to {LloydGeorgePreProcessFormat.GENERAL}.",
        )
        return MetadataGeneralPreprocessor
