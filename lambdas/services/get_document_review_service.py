from typing import Optional

from enums.lambda_error import LambdaError
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import DynamoServiceException
from utils.lambda_exceptions import GetDocumentReviewException

logger = LoggingService(__name__)


class GetDocumentReviewService:
    """
    Service for retrieving document reviews.
    """

    def __init__(self):
        self.document_review_service = DocumentUploadReviewService()

    def get_document_review(
        self, patient_id: str, document_id: str
    ) -> Optional[dict]:
        """
        Retrieve a document review for a given patient and document.

        :param patient_id: The patient ID (NHS number).
        :param document_id: The document ID to retrieve.
        :return: Dictionary containing the document review details, or None if not found.
        """
        try:
            logger.info(
                f"Fetching document review for patient_id: {patient_id}, document_id: {document_id}"
            )

            # Query DynamoDB directly by document ID using the service method
            document_review_item = self.document_review_service.get_item(document_id)

            # Check if item exists
            if not document_review_item:
                logger.info(
                    f"No document review found for document_id: {document_id}"
                )
                return None

            # Filter by NHS number to ensure patient owns this document
            if document_review_item.nhs_number != patient_id:
                logger.warning(
                    f"Document {document_id} does not belong to patient {patient_id}"
                )
                return None

            # Convert the model to a dictionary for the response
            document_review = document_review_item.model_dump(
                by_alias=True, exclude_none=True
            )

            logger.info(
                f"Successfully retrieved document review for document_id: {document_id}"
            )

            return document_review

        except DynamoServiceException as e:
            logger.error(
                f"{LambdaError.DocRefClient.to_str()}: {str(e)}",
                {"Result": "Failed to retrieve document review"},
            )
            raise GetDocumentReviewException(500, LambdaError.DocRefClient)
        except Exception as e:
            logger.error(
                f"Unexpected error retrieving document review: {str(e)}",
                {"Result": "Failed to retrieve document review"},
            )
            raise GetDocumentReviewException(500, LambdaError.DocRefClient)

