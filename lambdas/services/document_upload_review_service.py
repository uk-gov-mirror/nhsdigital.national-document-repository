import os

from models.document_review import DocumentUploadReviewReference
from services.document_service import DocumentService
from utils.audit_logging_setup import LoggingService

logger = LoggingService(__name__)


class DocumentUploadReviewService(DocumentService):
    """Service for handling DocumentUploadReviewReference operations."""
    def __init__(self):
        super().__init__()
        self._table_name = os.environ.get("DOCUMENT_REVIEW_DYNAMODB_NAME")
        self._s3_bucket = os.environ.get("DOCUMENT_REVIEW_S3_BUCKET_NAME")

    @property
    def table_name(self) -> str:
        return self._table_name

    @property
    def model_class(self) -> type:
        return DocumentUploadReviewReference

    @property
    def s3_bucket(self) -> str:
        return self._s3_bucket

    def update_document_review_custodian(
        self,
        patient_documents: list[DocumentUploadReviewReference],
        updated_ods_code: str,
    ):
        review_update_field = {"custodian"}
        if not patient_documents:
            return

        for review in patient_documents:
            logger.info("Updating document review custodian...")

            if review.custodian != updated_ods_code:
                review.custodian = updated_ods_code

                self.update_document(
                    document=review,
                    update_fields_name=review_update_field,
                )
