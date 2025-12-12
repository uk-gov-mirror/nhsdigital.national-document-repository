from enums.lambda_error import LambdaError
from models.document_review import DocumentUploadReviewReference
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import OdsErrorException
from utils.lambda_exceptions import DocumentReviewException

logger = LoggingService(__name__)


class ReviewDocumentStatusCheckService:
    def __init__(self):
        self.review_document_service = DocumentUploadReviewService()

    def get_document_review_status(
        self, ods_code: str, document_id: str, document_version: int
    ):
        try:

            logger.info("Extracting ODS code from request context.")

            logger.info("Retrieving document review reference from DynamoDB.")
            review_document_reference = self.review_document_service.get_document(
                document_id=document_id, version=document_version
            )
            if not review_document_reference:
                logger.info("No document review references found.")
                raise DocumentReviewException(404, LambdaError.DocumentReviewNotFound)

            logger.info("Checking user is author of review document.")
            if not self.user_is_author(ods_code, review_document_reference):
                raise DocumentReviewException(403, LambdaError.DocumentReviewForbidden)

            return review_document_reference.model_dump_camel_case(
                mode="json", include={"id", "version", "review_status"}
            )

        except OdsErrorException:
            logger.info("Failed to obtain ODS code from request context.")
            raise DocumentReviewException(401, LambdaError.DocumentReviewMissingODS)

    def user_is_author(
        self,
        user_ods_code: str,
        review_document_reference: DocumentUploadReviewReference,
    ) -> bool:
        return user_ods_code == review_document_reference.author
