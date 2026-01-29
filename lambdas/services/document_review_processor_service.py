import os
import uuid
from datetime import datetime, timezone

from botocore.exceptions import ClientError
from enums.document_review_status import DocumentReviewStatus
from models.document_review import (
    DocumentReviewFileDetails,
    DocumentUploadReviewReference,
)
from models.sqs.review_message_body import ReviewMessageBody
from models.staging_metadata import NHS_NUMBER_PLACEHOLDER
from services.base.s3_service import S3Service
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import (
    InvalidNhsNumberException,
    InvalidResourceIdException,
    PatientNotFoundException,
    PdsErrorException,
)
from utils.request_context import request_context
from utils.utilities import get_pds_service, validate_nhs_number

logger = LoggingService(__name__)


class ReviewProcessorService:

    def __init__(self):
        self.s3_service = S3Service()
        self.document_review_service = DocumentUploadReviewService()
        self.review_table_name = os.environ["DOCUMENT_REVIEW_DYNAMODB_NAME"]
        self.staging_bucket_name = os.environ["STAGING_STORE_BUCKET_NAME"]
        self.review_bucket_name = os.environ["PENDING_REVIEW_BUCKET_NAME"]

    def process_review_message(self, review_message: ReviewMessageBody) -> None:
        logger.info("Processing review queue message")

        request_context.patient_nhs_no = review_message.nhs_number

        review_id = review_message.upload_id
        review_files = self._move_files_to_review_bucket(review_message, review_id)
        custodian = self._get_patient_custodian(review_message)
        document_upload_review = self._build_review_record(
            review_message, review_id, review_files, custodian
        )
        try:
            self.document_review_service.create_dynamo_entry(document_upload_review)

            logger.info(f"Created review record {document_upload_review.id}")
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                logger.info("Entry already exists on Document Review table")
            else:
                raise e

        self._delete_files_from_staging(review_message)

    def _get_patient_custodian(self, review_message: ReviewMessageBody) -> str:
        try:
            if (
                not review_message.nhs_number
                or review_message.nhs_number == NHS_NUMBER_PLACEHOLDER
            ):
                logger.info(
                    "No valid NHS number found in message. Using uploader ODS as custodian"
                )
                return review_message.uploader_ods
            validate_nhs_number(review_message.nhs_number)
            pds_service = get_pds_service()
            patient_details = pds_service.fetch_patient_details(
                review_message.nhs_number
            )
            return patient_details.general_practice_ods
        except PdsErrorException:
            logger.info("Error when searching PDS. Using uploader ODS as custodian")
            return review_message.uploader_ods
        except (
            PatientNotFoundException,
            InvalidResourceIdException,
            InvalidNhsNumberException,
        ):
            logger.info(
                "Patient not found in PDS. Using uploader ODS as custodian, and nhs number placeholder"
            )
            review_message.nhs_number = NHS_NUMBER_PLACEHOLDER
            return review_message.uploader_ods

    def _build_review_record(
        self,
        message_data: ReviewMessageBody,
        review_id: str,
        review_files: list[DocumentReviewFileDetails],
        custodian: str,
    ) -> DocumentUploadReviewReference:
        return DocumentUploadReviewReference(
            id=review_id,
            nhs_number=message_data.nhs_number,
            review_status=DocumentReviewStatus.PENDING_REVIEW,
            review_reason=message_data.failure_reason,
            author=message_data.uploader_ods,
            custodian=custodian,
            files=review_files,
            upload_date=int(datetime.now(tz=timezone.utc).timestamp()),
        )

    def _move_files_to_review_bucket(
        self, message_data: ReviewMessageBody, review_record_id: str
    ) -> list[DocumentReviewFileDetails]:
        new_file_keys: list[DocumentReviewFileDetails] = []

        for file in message_data.files:
            object_key = uuid.uuid4()
            new_file_key = f"{review_record_id}/{object_key}"

            logger.info(
                f"Copying file from ({file.file_path}) in staging to review bucket: {new_file_key}"
            )
            try:

                self.s3_service.copy_across_bucket(
                    source_bucket=self.staging_bucket_name,
                    source_file_key=file.file_path,
                    dest_bucket=self.review_bucket_name,
                    dest_file_key=new_file_key,
                    if_none_match=True,
                )
                logger.info("File successfully copied to review bucket")
                logger.info(f"Successfully moved file to: {new_file_key}")

            except ClientError as e:
                if e.response["Error"]["Code"] == "PreconditionFailed":
                    logger.info("File already exists in the Review Bucket")
                else:
                    raise e

            new_file_keys.append(
                DocumentReviewFileDetails(
                    file_name=file.file_name,
                    file_location=new_file_key,
                )
            )
        return new_file_keys

    def _delete_files_from_staging(self, message_data: ReviewMessageBody) -> None:
        for file in message_data.files:
            try:
                logger.info(f"Deleting file from staging bucket: {file.file_path}")
                self.s3_service.delete_object(
                    s3_bucket_name=self.staging_bucket_name, file_key=file.file_path
                )
            except Exception as e:
                logger.error(f"Error deleting files from staging: {str(e)}")
                # Continue processing as files
