import os

from boto3.dynamodb.conditions import Attr, ConditionBase
from botocore.exceptions import ClientError
from enums.document_review_status import DocumentReviewStatus
from enums.dynamo_filter import AttributeOperator
from enums.lambda_error import LambdaError
from models.document_review import DocumentUploadReviewReference
from pydantic import ValidationError
from services.document_service import DocumentService
from utils.audit_logging_setup import LoggingService
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.lambda_exceptions import DocumentReviewException

logger = LoggingService(__name__)


class DocumentUploadReviewService(DocumentService):
    """Service for handling DocumentUploadReviewReference operations."""
    DEFAULT_QUERY_LIMIT = 50
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

    def query_docs_pending_review_by_custodian_with_limit(
        self,
        ods_code: str,
        limit: int = DEFAULT_QUERY_LIMIT,
        start_key: dict | None = None,
        nhs_number: str | None = None,
        uploader: str | None = None,
    ) -> tuple[list[DocumentUploadReviewReference], dict | None]:
        logger.info(f"Getting review document references for custodian: {ods_code}")

        filter_expression = self.build_review_query_filter(
            nhs_number=nhs_number, uploader=uploader
        )

        try:
            response = self.dynamo_service.query_table_single(
                table_name=self.table_name,
                search_key="Custodian",
                search_condition=ods_code,
                index_name="CustodianIndex",
                limit=limit,
                start_key=start_key,
                query_filter=filter_expression,
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
                self.model_class.model_validate(item) for item in items
            ]
            return review_references
        except ValidationError as e:
            logger.error(e)
            raise DocumentReviewException(500, LambdaError.DocumentReviewValidation)

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

    def build_review_query_filter(
        self, nhs_number: str | None = None, uploader: str | None = None
    ) -> Attr | ConditionBase:
        filter_builder = DynamoQueryFilterBuilder()
        filter_builder.add_condition(
            "ReviewStatus", AttributeOperator.EQUAL, DocumentReviewStatus.PENDING_REVIEW
        )

        if nhs_number:
            filter_builder.add_condition(
                "NhsNumber", AttributeOperator.EQUAL, nhs_number
            )

        if uploader:
            filter_builder.add_condition("Author", AttributeOperator.EQUAL, uploader)

        return filter_builder.build()
