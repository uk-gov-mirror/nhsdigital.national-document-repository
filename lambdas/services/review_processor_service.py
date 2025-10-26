import os
from datetime import datetime, timezone

from enums.review_status import ReviewStatus
from models.document_review import DocumentReviewFileDetails, DocumentsUploadReview
from models.sqs.review_message_body import ReviewMessageBody
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service
from utils.audit_logging_setup import LoggingService
from utils.exceptions import S3FileNotFoundException
from utils.request_context import request_context

logger = LoggingService(__name__)


class ReviewProcessorService:
    """
    Service for processing single SQS messages from the document review queue.
    """

    def __init__(self):
        """Initialize the review processor service with required AWS services."""
        self.dynamo_service = DynamoDBService()
        self.s3_service = S3Service()

        self.review_table_name = os.environ["DOCUMENT_REVIEW_DYNAMODB_NAME"]
        self.staging_bucket_name = os.environ["STAGING_STORE_BUCKET_NAME"]
        self.review_bucket_name = os.environ["PENDING_REVIEW_BUCKET_NAME"]

    def process_review_message(self, review_message: ReviewMessageBody) -> None:
        """
        Process a single SQS message from the review queue.

        Args:
            sqs_message: SQS message record containing file and failure information

        Raises:
            InvalidMessageException: If message format is invalid or required fields missing
            S3FileNotFoundException: If file doesn't exist in staging bucket
            ClientError: For AWS service errors (DynamoDB, S3)
        """
        logger.info("Processing review queue message")

        request_context.patient_nhs_no = review_message.nhs_number

        logger.info(f"Processing review for NHS: {review_message.nhs_number}, File: {review_message.file_name}")

        self._verify_file_exists_in_staging(review_message.file_path)
        document_upload_review = self._create_review_record(review_message)

        new_file_key = self._move_file_to_review_bucket(review_message, document_upload_review.id)
        self._update_review_record_with_file_location(document_upload_review.id, new_file_key)

        logger.info(
            f"Successfully processed review for {review_message.nhs_number}",
            {"Result": "Review record created and file moved"},
        )

    def _verify_file_exists_in_staging(self, file_path: str) -> None:
        """
        Verify the file exists in the staging bucket.

        Args:
            file_path: S3 key of the file in staging bucket

        Raises:
            S3FileNotFoundException: If file does not exist in staging bucket
        """
        try:
            file_exists = self.s3_service.file_exist_on_s3(s3_bucket_name=self.staging_bucket_name, file_key=file_path)

            if not file_exists:
                raise S3FileNotFoundException(f"File not found in staging bucket: {file_path}")

            logger.info(f"Verified file exists in staging: {file_path}")

        except S3FileNotFoundException:
            raise
        except Exception as e:
            logger.error(f"Error checking file in staging bucket: {str(e)}")
            raise

    def _create_review_record(self, message_data: ReviewMessageBody) -> DocumentsUploadReview:
        """
        Create a new review record in DynamoDB.

        Args:
            message_data: Validated review queue message data

        Returns:
            Created DocumentsUploadReview object

        Raises:
            ClientError: If DynamoDB create operation fails
        """
        try:
            files = [DocumentReviewFileDetails(
                file_name=message_data.file_name,
                file_location=message_data.file_path
            )]

            document_review = DocumentsUploadReview(
                nhs_number=message_data.nhs_number,
                upload_date=int(datetime.fromisoformat(message_data.upload_date).replace(tzinfo=timezone.utc).timestamp()),
                review_status=ReviewStatus.PENDING_REVIEW,
                review_reason=message_data.failure_reason,
                author=message_data.uploader_ods,
                custodian=message_data.current_gp,
                files=files,
            )

            self.dynamo_service.create_item(
                table_name=self.review_table_name,
                item=document_review.model_dump(by_alias=True, exclude_none=True),
            )

            logger.info(
                f"Created review record in DynamoDB with ID: {document_review.id}",
                {"Result": "DynamoDB record created"},
            )

            return document_review

        except Exception as e:
            logger.error(f"Failed to create DynamoDB record: {str(e)}")
            raise

    def _move_file_to_review_bucket(self, message_data: ReviewMessageBody, review_record_id: str) -> str:
        """
        Move file from staging to review bucket.

        Args:
            message_data: Review queue message data
            review_record_id: ID of the review record (used in destination path)

        Returns:
            New file key in review bucket

        Raises:
            ClientError: If S3 copy or delete operations fail
        """
        try:
            new_file_key = f"{message_data.nhs_number}/{review_record_id}/{message_data.file_name}"

            logger.info(f"Copying file from ({message_data.file_path}) in staging to review bucket: {new_file_key}")

            self.s3_service.copy_across_bucket(
                source_bucket=self.staging_bucket_name,
                source_file_key=message_data.file_path,
                dest_bucket=self.review_bucket_name,
                dest_file_key=new_file_key,
            )

            logger.info("File successfully copied to review bucket")
            logger.info(f"Deleting file from staging bucket: {message_data.file_path}")

            self._delete_from_staging(message_data.file_path)
            logger.info(f"Successfully moved file to: {new_file_key}")

            return new_file_key

        except Exception as e:
            logger.error(f"Failed to move file: {str(e)}")
            raise

    def _delete_from_staging(self, file_key: str) -> None:
        try:
            self.s3_service.delete_object(s3_bucket_name=self.staging_bucket_name, file_key=file_key)

            logger.info(f"Deleted file from staging bucket: {file_key}")

        except Exception as e:
            logger.error(f"Error deleting file from staging: {str(e)}")
            raise

    def _update_review_record_with_file_location(self, review_record_id: str, review_bucket_path: str) -> None:
        try:
            self.dynamo_service.update_item(
                table_name=self.review_table_name,
                key_pair={"ID": review_record_id},
                updated_fields={"ReviewBucketPath": review_bucket_path},
            )

            logger.info(f"Updated review record {review_record_id} with file location: {review_bucket_path}")

        except Exception as e:
            logger.error(f"Failed to update review record with file location: {str(e)}")
            logger.warning("Review record created but file location not updated in DynamoDB")
