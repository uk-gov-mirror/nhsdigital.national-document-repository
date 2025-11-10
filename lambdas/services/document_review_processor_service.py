import os
from datetime import datetime, timezone

from enums.review_status import ReviewStatus
from models.document_reference import DocumentReferenceMetadataFields
from models.document_review import DocumentReviewFileDetails, DocumentsUploadReview
from models.sqs.review_message_body import ReviewMessageBody
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service
from utils.audit_logging_setup import LoggingService
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

        review_id = review_message.upload_id
        review_files = self._move_files_to_review_bucket(review_message, review_id)
        document_upload_review = self._build_review_record(
            review_message, review_id, review_files
        )
        self.dynamo_service.create_item(
            table_name=self.review_table_name,
            item=document_upload_review.model_dump(by_alias=True, exclude_none=True),
            key_name=DocumentReferenceMetadataFields.ID.value,
        )

        logger.info(f"Created review record {document_upload_review.id}")
        self._delete_files_from_staging(review_message)

    def _build_review_record(
        self,
        message_data: ReviewMessageBody,
        review_id: str,
        review_files: list[DocumentReviewFileDetails],
    ) -> DocumentsUploadReview:
        return DocumentsUploadReview(
            id=review_id,
            nhs_number=message_data.nhs_number,
            review_status=ReviewStatus.PENDING_REVIEW,
            review_reason=message_data.failure_reason,
            author=message_data.uploader_ods,
            custodian=message_data.current_gp,
            files=review_files,
            upload_date=int(datetime.now(tz=timezone.utc).timestamp()),
        )

    def _move_files_to_review_bucket(
        self, message_data: ReviewMessageBody, review_record_id: str
    ) -> list[DocumentReviewFileDetails]:
        """
        Move file from staging to review bucket.

        Args:
            message_data: Review queue message data
            review_record_id: ID of the review record being created

        Returns:
            List of DocumentReviewFileDetails with new file locations in review bucket
        """
        new_file_keys: list[DocumentReviewFileDetails] = []
        for file in message_data.files:
            new_file_key = (
                f"{message_data.nhs_number}/{review_record_id}/{file.file_name}"
            )

            logger.info(
                f"Copying file from ({file.file_path}) in staging to review bucket: {new_file_key}"
            )

            self.s3_service.copy_across_bucket(
                source_bucket=self.staging_bucket_name,
                source_file_key=file.file_path,
                dest_bucket=self.review_bucket_name,
                dest_file_key=new_file_key,
                if_none_match="*",
            )

            new_file_keys.append(
                DocumentReviewFileDetails(
                    file_name=file.file_name,
                    file_location=new_file_key,
                )
            )

            logger.info("File successfully copied to review bucket")
            logger.info(f"Successfully moved file to: {new_file_key}")
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
