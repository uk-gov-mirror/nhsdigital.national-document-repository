import os

from boto3.dynamodb.conditions import Attr, ConditionBase
from botocore.exceptions import ClientError
from enums.document_review_status import DocumentReviewStatus
from enums.dynamo_filter import AttributeOperator
from enums.metadata_field_names import DocumentReferenceMetadataFields
from models.document_reference import S3_PREFIX
from models.document_review import DocumentUploadReviewReference
from pydantic import ValidationError
from services.document_service import DocumentService
from utils.audit_logging_setup import LoggingService
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.dynamo_utils import build_transaction_item
from utils.exceptions import DocumentReviewException

logger = LoggingService(__name__)


class DocumentUploadReviewService(DocumentService):
    """Service for handling DocumentUploadReviewReference operations."""

    DEFAULT_QUERY_LIMIT = 50

    def __init__(self):
        super().__init__()
        self._table_name = os.environ.get("DOCUMENT_REVIEW_DYNAMODB_NAME")
        self._s3_bucket = os.environ.get("PENDING_REVIEW_BUCKET_NAME")

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
            raise DocumentReviewException("Failed to query document reviews")

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
            raise DocumentReviewException(
                "Failed to validate document review references"
            )

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
                    update_key={"ID": review.id, "Version": review.version},
                    update_fields_name=review_update_field,
                )

    def get_document_review_by_id(self, document_id: str, document_version: int):
        return self.get_item(document_id, {"Version": document_version})

    def update_pending_review_status(
        self, review_update: DocumentUploadReviewReference, field_names: set[str]
    ) -> None:
        self.update_review_document_with_status_filter(
            review_update,
            field_names,
            DocumentReviewStatus.PENDING_REVIEW,
        )

    def update_approved_pending_review_status(
        self, review_update: DocumentUploadReviewReference, field_names: set[str]
    ) -> None:
        self.update_review_document_with_status_filter(
            review_update,
            field_names,
            DocumentReviewStatus.APPROVED_PENDING_DOCUMENTS,
        )

    def update_review_document_with_status_filter(
        self,
        review_update: DocumentUploadReviewReference,
        field_names: set[str],
        status: DocumentReviewStatus,
    ):
        condition_expression = (
            Attr(DocumentReferenceMetadataFields.ID.value).exists()
            & Attr("NhsNumber").eq(review_update.nhs_number)
            & Attr("ReviewStatus").eq(status)
        )
        self.update_document_review_for_patient(
            review_update, field_names, condition_expression
        )

    def update_document_review_for_patient(
        self,
        review_update: DocumentUploadReviewReference,
        field_names: set[str],
        condition_expression,
    ):
        try:
            return self.update_document(
                document=review_update,
                update_key={"ID": review_update.id, "Version": review_update.version},
                update_fields_name=field_names,
                condition_expression=condition_expression,
            )
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")

            if error_code == "ConditionalCheckFailedException":
                logger.error(
                    f"Condition check failed: Document ID {review_update.id}",
                    {"Result": "Failed to update document review"},
                )
                raise DocumentReviewException(
                    f"Document ID {review_update.id} does not meet the required conditions for update"
                )

            logger.error(
                f"DynamoDB error updating document review: {str(e)}",
                {"Result": "Failed to update document review"},
            )
            raise DocumentReviewException(f"Failed to update document review: {str(e)}")

    def update_document_review_with_transaction(
        self, new_review_item, existing_review_item
    ):
        transact_items = []
        try:
            new_doc_transaction = build_transaction_item(
                table_name=self.table_name,
                action="Update",
                key={"ID": new_review_item.id, "Version": new_review_item.version},
                update_fields=new_review_item.model_dump(
                    exclude_none=True, by_alias=True, exclude={"version", "id"}
                ),
                conditions=[{"field": "ID", "operator": "attribute_not_exists"}],
            )
            transact_items.append(new_doc_transaction)

            existing_update_fields = {
                "review_status",
                "review_date",
                "reviewer",
            }
            existing_doc_transaction = build_transaction_item(
                table_name=self.table_name,
                action="Update",
                key={
                    "ID": existing_review_item.id,
                    "Version": existing_review_item.version,
                },
                update_fields=existing_review_item.model_dump(
                    exclude_none=True, by_alias=True, include=existing_update_fields
                ),
                conditions=[
                    {
                        "field": "ReviewStatus",
                        "operator": "=",
                        "value": DocumentReviewStatus.PENDING_REVIEW,
                    },
                    {
                        "field": "NhsNumber",
                        "operator": "=",
                        "value": existing_review_item.nhs_number,
                    },
                    {
                        "field": "Custodian",
                        "operator": "=",
                        "value": existing_review_item.custodian,
                    },
                ],
            )
        except ValueError as e:
            logger.error(f"Failed to build transaction item: {str(e)}")
            raise DocumentReviewException(f"Failed to build transaction item: {str(e)}")
        transact_items.append(existing_doc_transaction)

        try:
            response = self.dynamo_service.transact_write_items(transact_items)
            logger.info("Transaction completed successfully")
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "TransactionCanceledException":
                logger.error(
                    f"Condition check failed: Document ID {existing_review_item.id}  ",
                    {"Result": "Failed to update document review"},
                )
            raise DocumentReviewException(f"Failed to update document review: {str(e)}")
        return response

    def delete_document_review_files(
        self, document_review: DocumentUploadReviewReference
    ):
        for file in document_review.files:
            location_without_prefix = file.file_location.replace(S3_PREFIX, "")
            bucket, file_key = location_without_prefix.split("/", 1)
            try:
                self.s3_service.delete_object(bucket, file_key)
            except ClientError as e:
                logger.warning(
                    f"Unable to delete file {file.file_name} from S3 due to error: {e}"
                )
                logger.warning(f"Skipping file deletion for {file.file_name}")
                continue

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
