from datetime import datetime, timezone

from enums.document_review_status import DocumentReviewStatus
from enums.lambda_error import LambdaError
from models.document_review import (
    PutDocumentReviewRequest,
)
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.lambda_exceptions import PutDocumentReviewException

logger = LoggingService(__name__)


class PutDocumentReviewService:
    """Service for updating document review status in DynamoDB."""

    def __init__(self):
        self.document_review_service = DocumentUploadReviewService()

    def update_document_review(
        self,
        patient_id: str,
        document_id: str,
        update_data: PutDocumentReviewRequest,
        reviewer_ods_code: str,
    ):
        """Update a document review with the provided review status and document reference ID.

        Fetches the document, validates NHS number and review status, then updates.

        Args:
            patient_id: The patient NHS number.
            document_id: The document review ID to update.
            update_data: The review data to update (status and optional document_reference_id).
            reviewer_ods_code: The ODS code of the user reviewing the document.

        Raises:
            PutDocumentReviewException: If validation fails or document not found.
        """
        logger.info(
            f"Updating document review for patient_id: {patient_id}, document_id: {document_id}"
        )

        document = self.document_review_service.get_item(document_id=document_id)

        if not document:
            logger.error(
                f"Document review not found for document_id: {document_id}",
                {"Result": "Failed to update document review"},
            )
            raise PutDocumentReviewException(
                404, LambdaError.DocumentReferenceMissingParameters
            )

        if document.nhs_number != patient_id:
            logger.error(
                f"NHS number mismatch for document_id: {document_id}. Expected: {patient_id}, Got: {document.nhs_number}",
                {"Result": "Failed to update document review"},
            )
            raise PutDocumentReviewException(
                400, LambdaError.DocumentReferenceMissingParameters
            )

        if document.review_status != DocumentReviewStatus.PENDING_REVIEW:
            logger.error(
                f"Invalid review status for document_id: {document_id}. Expected: PENDING_REVIEW, Got: {document.review_status}",
                {"Result": "Failed to update document review"},
            )
            raise PutDocumentReviewException(
                400, LambdaError.DocumentReferenceMissingParameters
            )

        review_date = int(datetime.now(timezone.utc).timestamp())
        document.review_status = update_data.review_status
        document.review_date = review_date
        document.reviewer = reviewer_ods_code
        update_fields = {
            "review_status",
            "review_date",
            "reviewer",
        }
        if update_data.document_reference_id:
            document.document_reference_id = update_data.document_reference_id
            update_fields.add("document_reference_id")

        try:
            self.document_review_service.update_document(
                document=document,
                update_fields_name=update_fields,
            )

            logger.info(
                f"Successfully updated document review for document_id: {document_id}"
            )

        except Exception as e:
            logger.error(
                f"Unexpected error updating document review: {str(e)}",
                {"Result": "Failed to update document review"},
            )
            raise PutDocumentReviewException(
                500, LambdaError.DocumentReferenceGeneralError
            )
