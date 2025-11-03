from datetime import datetime, timezone

from enums.lambda_error import LambdaError
from models.document_review import DocumentUploadReviewReference, PutDocumentReviewRequest
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import DynamoServiceException
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
    ) :
        """Update a document review with the provided review status and document reference ID.

        Only updates if the document_id and nhs_number match the existing record in DynamoDB.

        Args:
            patient_id: The patient NHS number.
            document_id: The document review ID to update.
            update_data: The review data to update (status and optional document_reference_id).
            reviewer_ods_code: The ODS code of the user reviewing the document.

        Raises:
            PutDocumentReviewException: If validation fails or update conditions are not met.
        """
        logger.info(
            f"Updating document review for patient_id: {patient_id}, document_id: {document_id}"
        )

        review_date = int(datetime.now(timezone.utc).timestamp())

        update_fields = DocumentUploadReviewReference.model_construct(
            review_status=update_data.review_status,
            review_date=review_date,
            document_reference_id=update_data.document_reference_id,
            reviewer=reviewer_ods_code,
        )

        try:
            self.document_review_service.update_document_review_for_patient(
                document_review_id=document_id,
                patient_nhs_number=patient_id,
                review_update_fields=update_fields,
            )

            logger.info(
                f"Successfully updated document review for document_id: {document_id}"
            )


        except DynamoServiceException as e:
            logger.error(
                f"DynamoDB service error: {str(e)}",
                {"Result": "Failed to update document review"},
            )
            raise PutDocumentReviewException(
                400, LambdaError.DocumentReferenceMissingParameters
            )
        except Exception as e:
            logger.error(
                f"Unexpected error updating document review: {str(e)}",
                {"Result": "Failed to update document review"},
            )
            raise PutDocumentReviewException(
                500, LambdaError.DocumentReferenceGeneralError
            )

