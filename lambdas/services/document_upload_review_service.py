import os

from botocore.exceptions import ClientError
from enums.lambda_error import LambdaError
from models.document_review import DocumentUploadReviewReference
from pydantic import ValidationError
from services.document_service import DocumentService
from utils.audit_logging_setup import LoggingService
from utils.lambda_exceptions import DocumentReviewException

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

    def query_review_documents_by_custodian(
        self, ods_code: str, limit: int | None = None, start_key: dict | None = None
    ) -> tuple[list[DocumentUploadReviewReference], dict | None]:
        logger.info(f"Getting review document references for custodian: {ods_code}")

        if not limit:
            limit = 50

        try:
            response = self.dynamo_service.query_table_single(
                table_name=self.table_name,
                search_key="Custodian",
                search_condition=ods_code,
                index_name="CustodianIndex",
                limit=limit,
                start_key=start_key,
            )

            references = self._validate_review_references(response["Items"])

            last_evaluated_key = response.get("LastEvaluatedKey", None)

            return references, last_evaluated_key

        except ClientError as e:
            logger.error(e)
            raise DocumentReviewException(500, LambdaError.DocumentReviewDB)

    def _validate_review_references(
        self, items: list[dict]
    ) -> list[DocumentUploadReviewReference]:
        try:
            logger.info("Validating document review search response")
            review_references = [
                DocumentUploadReviewReference.model_validate(item) for item in items
            ]
            return review_references
        except ValidationError as e:
            logger.error(e)
            raise DocumentReviewException(
                500, LambdaError.DocumentReviewValidation
            )

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
