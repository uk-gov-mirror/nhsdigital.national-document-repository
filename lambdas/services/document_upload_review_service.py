import os

from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
from enums.document_review_status import DocumentReviewStatus
from enums.metadata_field_names import DocumentReferenceMetadataFields
from models.document_review import DocumentUploadReviewReference
from pydantic import BaseModel
from services.document_service import DocumentService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import DocumentServiceException

logger = LoggingService(__name__)


class DocumentUploadReviewService(DocumentService):
    """Service for handling DocumentUploadReviewReference operations."""

    @property
    def table_name(self) -> str:
        return os.environ.get("DOCUMENT_REVIEW_DYNAMODB_NAME")

    @property
    def model_class(self) -> type:
        return DocumentUploadReviewReference

    @property
    def s3_bucket(self) -> str:
        return os.environ.get("DOCUMENT_REVIEW_S3_BUCKET_NAME")

    def update_document_review_custodian(
        self,
        patient_documents: list[DocumentUploadReviewReference],
        updated_ods_code: str,
    ) -> None:
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

    def update_document_review_for_patient(
        self, review_update: BaseModel, field_names: set[str]
    ):

        condition_expression = (
            Attr(DocumentReferenceMetadataFields.ID.value).exists()
            & Attr("NhsNumber").eq(review_update.nhs_number)
            & Attr("ReviewStatus").eq(DocumentReviewStatus.PENDING_REVIEW)
        )

        try:
            return self.update_document(
                document=review_update,
                update_fields_name=field_names,
                condition_expression=condition_expression,
            )
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")

            if error_code == "ConditionalCheckFailedException":
                logger.error(
                    f"Condition check failed: Document ID {review_update.id} and "
                    f"NHS number {review_update.nhs_number} do not match",
                    {"Result": "Failed to update document review"},
                )
                raise DocumentServiceException(
                    f"Document ID {review_update.id} does not exist or NHS number does not match"
                )

            logger.error(
                f"DynamoDB error updating document review: {str(e)}",
                {"Result": "Failed to update document review"},
            )
            raise DocumentServiceException(
                f"Failed to update document review: {str(e)}"
            )
