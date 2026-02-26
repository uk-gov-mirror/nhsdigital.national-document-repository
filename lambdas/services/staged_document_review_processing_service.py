import io
import os

from botocore.exceptions import ClientError

from enums.document_review_status import DocumentReviewStatus
from enums.virus_scan_result import VirusScanResult
from models.document_reference import S3_PREFIX
from models.document_review import DocumentUploadReviewReference
from services.base.s3_service import S3Service
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.aws_transient_error_check import is_transient_error
from utils.exceptions import DocumentServiceException, FileProcessingException
from utils.file_integrity_check import check_file_locked_or_corrupt
from utils.utilities import get_virus_scan_service

logger = LoggingService(__name__)


class StagedDocumentReviewProcessingService:
    def __init__(self):
        self.review_document_service = DocumentUploadReviewService()
        self.virus_scan_service = get_virus_scan_service()
        self.s3_service = S3Service()
        self.staging_s3_bucket_name = os.getenv("STAGING_STORE_BUCKET_NAME")
        self.destination_bucket_name = os.getenv("PENDING_REVIEW_BUCKET_NAME")

    def handle_upload_document_reference_request(
        self,
        object_key: str,
        *args,
        **kwargs,
    ) -> None:
        try:
            upload_id = self._validate_object_key(object_key)
            logger.info(f"Processing document reference: {object_key}")

            document_reference = self._fetch_document_reference_by_id(upload_id)

            if self._is_review_pending_upload(
                document_reference,
            ) and self._is_file_at_expected_location(document_reference, object_key):
                logger.info(
                    f"Document {document_reference.id} is in pending upload state, processing",
                )
                self._process_document_if_ready(document_reference, object_key)
            else:
                logger.info(
                    f"Document {object_key} not in expected, deleting from staging",
                )
                self.delete_file_from_staging_bucket(object_key)

        except DocumentServiceException as e:
            logger.error(f"Document validation error for {object_key}: {str(e)}")
            return

        except (FileProcessingException, ClientError) as e:
            if is_transient_error(e):
                logger.error(
                    f"Transient error processing document {object_key}: {str(e)}",
                )
                raise e
            else:
                logger.error(
                    f"Permanent error processing document {object_key}: {str(e)}",
                )
                return

        except Exception as e:
            logger.error(f"Unexpected error processing document {object_key}: {str(e)}")
            logger.info("continue to trigger retry")
            raise e

    def _validate_object_key(self, object_key: str) -> str:
        """Validate and extract upload_id from object_key"""
        if not object_key:
            raise DocumentServiceException("Invalid or empty object_key provided")

        object_parts = object_key.split("/")
        return object_parts[-2]

    def _process_document_if_ready(
        self,
        document_reference: DocumentUploadReviewReference,
        object_key: str,
    ) -> None:
        virus_scan_result = self._perform_virus_scan(document_reference, object_key)

        if virus_scan_result == VirusScanResult.CLEAN.value:
            file_type_extension = (
                document_reference.files[0].file_name.split(".")[-1].lower()
            )
            is_file_invalid = self.is_file_invalid(
                object_key,
                file_type_extension,
            )

            if is_file_invalid:
                logger.warning(
                    f"Document {document_reference.id} is password protected or corrupt, "
                    f"marking as such in database",
                )
                document_reference.review_status = DocumentReviewStatus.UPLOAD_FAILED
            else:
                document_reference.review_status = DocumentReviewStatus.PENDING_REVIEW
                self._process_review_document_reference(document_reference, object_key)
                return
        else:
            document_reference.review_status = DocumentReviewStatus.VIRUS_SCAN_FAILED

            logger.warning(
                f"Virus scan failed for document {document_reference.id}, status updated",
            )

        self.review_document_service.update_document_review_status(
            document_reference,
        )

    def _fetch_document_reference_by_id(
        self,
        document_key: str,
    ) -> DocumentUploadReviewReference:
        documents = self.review_document_service.fetch_documents_from_table(
            search_key="ID",
            search_condition=document_key,
        )
        if not documents or len(documents) != 1:
            raise DocumentServiceException(
                f"Expected exactly one document reference for upload id, found {len(documents)}",
            )
        return documents[0]

    def _is_review_pending_upload(
        self,
        document_reference: DocumentUploadReviewReference,
    ) -> bool:
        return (
            document_reference.review_status
            == DocumentReviewStatus.REVIEW_PENDING_UPLOAD
        )

    def _is_file_at_expected_location(
        self,
        document_reference: DocumentUploadReviewReference,
        object_key: str,
    ) -> bool:
        expected_file_location = document_reference.files[0].file_location
        return expected_file_location.endswith(object_key)

    def _perform_virus_scan(
        self,
        document_reference: DocumentUploadReviewReference,
        object_key: str,
    ) -> str:
        result = self.virus_scan_service.scan_file(
            object_key,
            nhs_number=document_reference.nhs_number,
        )
        logger.info(
            f"Virus scan result: {result} for document reference: {document_reference.id}",
        )
        return result

    def _process_review_document_reference(
        self,
        document_reference: DocumentUploadReviewReference,
        object_key: str,
    ) -> None:
        self.copy_files_from_staging_bucket(document_reference, object_key)
        update_condition = self.review_document_service.build_review_dynamo_filter(
            status=DocumentReviewStatus.REVIEW_PENDING_UPLOAD,
        )
        self.review_document_service.update_document_review_status(
            document_reference,
            condition_expression=update_condition,
        )
        self.delete_file_from_staging_bucket(object_key)
        logger.info(f"Successfully processed clean document: {document_reference.id}")

    def copy_files_from_staging_bucket(
        self,
        document_reference: DocumentUploadReviewReference,
        source_file_key: str,
    ) -> None:
        try:
            logger.info(
                f"Copying file {source_file_key} from staging bucket for document {document_reference.id}",
            )

            self.s3_service.copy_across_bucket(
                source_bucket=self.staging_s3_bucket_name,
                source_file_key=source_file_key,
                dest_bucket=self.destination_bucket_name,
                dest_file_key=source_file_key,
                if_none_match=True,
            )
            document_reference.files[0].file_location = (
                f"{S3_PREFIX}{self.destination_bucket_name}/{source_file_key}"
            )

        except ClientError as e:
            logger.error("Error copying file from staging bucket")
            if e.response["ResponseMetadata"]["HTTPStatusCode"] == 412:
                logger.warning(
                    f"File already exists in destination bucket: {source_file_key}",
                )
                return
            raise e

    def delete_file_from_staging_bucket(self, source_file_key: str) -> None:
        try:
            logger.info(f"Deleting file from staging bucket: {source_file_key}")
            self.s3_service.delete_object(self.staging_s3_bucket_name, source_file_key)

        except ClientError as e:
            logger.error(f"Error deleting file from staging bucket: {str(e)}")
            raise e

    def is_file_invalid(self, object_key: str, file_type_extension: str) -> bool:
        entire_object = self.s3_service.get_object_stream(
            self.staging_s3_bucket_name,
            object_key,
        )
        file_stream = io.BytesIO(entire_object.read())
        return check_file_locked_or_corrupt(file_stream, file_type_extension)
