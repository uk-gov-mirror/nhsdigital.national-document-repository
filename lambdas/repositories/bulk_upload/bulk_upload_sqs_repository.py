import os
import uuid

from enums.document_review_reason import DocumentReviewReason
from models.sqs.pdf_stitching_sqs_message import PdfStitchingSqsMessage
from models.sqs.review_message_body import ReviewMessageBody, ReviewMessageFile
from models.staging_metadata import StagingSqsMetadata
from services.base.sqs_service import SQSService
from utils.audit_logging_setup import LoggingService
from utils.request_context import request_context

logger = LoggingService(__name__)


class BulkUploadSqsRepository:
    def __init__(self):
        self.sqs_repository = SQSService()
        self.metadata_queue_url = os.getenv("METADATA_SQS_QUEUE_URL")
        self.review_queue_url = os.getenv("REVIEW_SQS_QUEUE_URL")

    def put_staging_metadata_back_to_queue(self, staging_metadata: StagingSqsMetadata):
        request_context.patient_nhs_no = staging_metadata.nhs_number
        setattr(staging_metadata, "retries", (staging_metadata.retries + 1))
        logger.info("Returning message to sqs queue...")
        self.sqs_repository.send_message_with_nhs_number_attr_fifo(
            queue_url=self.metadata_queue_url,
            message_body=staging_metadata.model_dump_json(by_alias=True),
            nhs_number=staging_metadata.nhs_number,
            group_id=f"back_to_queue_bulk_upload_{uuid.uuid4()}",
        )

    def send_message_to_review_queue(
        self,
        staging_metadata: StagingSqsMetadata,
        uploader_ods: str,
        failure_reason: DocumentReviewReason,
    ):
        request_context.patient_nhs_no = staging_metadata.nhs_number
        review_files = [
            ReviewMessageFile(
                file_name=file.stored_file_name.split("/")[-1],
                file_path=file.file_path.lstrip("/"),
            )
            for file in staging_metadata.files
        ]

        upload_id = f"{uuid.uuid4()}"

        review_message = ReviewMessageBody(
            upload_id=upload_id,
            files=review_files,
            nhs_number=staging_metadata.nhs_number,
            failure_reason=failure_reason,
            uploader_ods=uploader_ods,
        )

        logger.info(
            f"Sending message to review queue for NHS number {staging_metadata.nhs_number} "
            f"with failure reason: {failure_reason}"
        )

        self.sqs_repository.send_message_standard(
            queue_url=self.review_queue_url,
            message_body=review_message.model_dump_json(),
        )

    def put_sqs_message_back_to_queue(self, sqs_message: dict):
        try:
            nhs_number = sqs_message["messageAttributes"]["NhsNumber"]["stringValue"]
            request_context.patient_nhs_no = nhs_number
        except KeyError:
            nhs_number = ""

        logger.info("Returning message to sqs queue...")
        self.sqs_repository.send_message_with_nhs_number_attr_fifo(
            queue_url=self.metadata_queue_url,
            message_body=sqs_message["body"],
            nhs_number=nhs_number,
            group_id=f"back_to_queue_bulk_upload_{uuid.uuid4()}",
        )

    def send_message_to_pdf_stitching_queue(
        self, queue_url: str, message: PdfStitchingSqsMessage
    ):
        self.sqs_repository.send_message_standard(
            queue_url=queue_url,
            message_body=message.model_dump_json(),
        )
