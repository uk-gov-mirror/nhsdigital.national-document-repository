import os
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Attr, ConditionBase
from botocore.exceptions import ClientError
from enums.document_review_status import DocumentReviewStatus
from enums.dynamo_filter import AttributeOperator
from enums.lambda_error import ErrorMessage
from enums.metadata_field_names import DocumentReferenceMetadataFields
from models.document_review import DocumentUploadReviewReference
from pydantic import ValidationError
from services.document_service import DocumentService
from utils.audit_logging_setup import LoggingService
from utils.aws_transient_error_check import is_transient_error
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.dynamo_utils import build_mixed_condition_expression, build_transaction_item
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

    def query_docs_pending_review_with_paginator(
        self,
        ods_code: str,
        limit: int = DEFAULT_QUERY_LIMIT,
        start_key: str | None = None,
        nhs_number: str | None = None,
        uploader: str | None = None,
    ) -> tuple[list[DocumentUploadReviewReference], str | None]:

        try:
            logger.info(f"Getting review document references for custodian: {ods_code}")

            filter_expression, condition_attribute_names, condition_attribute_values = (
                self.build_paginator_query_filter(
                    nhs_number=nhs_number, uploader=uploader
                )
            )
            references, last_evaluated_key = self.query_table_with_paginator(
                index_name="CustodianIndex",
                search_key="Custodian",
                search_condition=ods_code,
                filter_expression=filter_expression,
                expression_attribute_names=condition_attribute_names,
                expression_attribute_values=condition_attribute_values,
                limit=limit,
                start_key=start_key,
            )

            return references, last_evaluated_key

        except ClientError as e:
            logger.error(e)
            raise DocumentReviewException(ErrorMessage.FAILED_TO_QUERY_DYNAMO)

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
            raise DocumentReviewException(ErrorMessage.FAILED_TO_VALIDATE.value)

    def build_paginator_query_filter(
        self, nhs_number: str | None = None, uploader: str | None = None
    ):
        conditions = [
            {
                "field": "ReviewStatus",
                "operator": "=",
                "value": DocumentReviewStatus.PENDING_REVIEW.value,
            }
        ]
        if nhs_number:
            conditions.append(
                {
                    "field": "NhsNumber",
                    "operator": "=",
                    "value": nhs_number,
                }
            )

        if uploader:
            conditions.append(
                {
                    "field": "Author",
                    "operator": "=",
                    "value": uploader,
                }
            )

        return build_mixed_condition_expression(conditions)

    def get_document(
        self, document_id: str, version: int | None
    ) -> DocumentUploadReviewReference | None:
        try:
            sort_key = {"Version": version}
            response = self.get_item(
                table_name=self.table_name, document_id=document_id, sort_key=sort_key
            )

            return response
        except ClientError as e:
            logger.error(e)
            raise DocumentReviewException("500, LambdaError.DocumentReviewDB")

    def update_document_review_custodian(
        self,
        patient_documents: list[DocumentUploadReviewReference],
        updated_ods_code: str,
    ):
        if not patient_documents:
            logger.info("No documents to update")
            return
        review_update_field = {"custodian"}

        for review in patient_documents:
            if review.custodian == updated_ods_code:
                logger.info(
                    f"Custodian {updated_ods_code} already assigned to review ID: {review.id}"
                )
                continue

            try:
                logger.info(
                    f"Updating document review custodian for review ID: {review.id}",
                    {
                        "current_custodian": review.custodian,
                        "new_custodian": updated_ods_code,
                    },
                )

                if review.review_status == DocumentReviewStatus.PENDING_REVIEW:
                    self._handle_pending_review_custodian_update(
                        review, updated_ods_code, review_update_field
                    )
                else:
                    self._handle_standard_custodian_update(
                        review, updated_ods_code, review_update_field
                    )

            except (ClientError, DocumentReviewException) as e:
                logger.error(
                    f"Failed to update custodian for review ID: {review.id}",
                    {"error": str(e)},
                )
                continue

    def _handle_pending_review_custodian_update(
        self,
        review: DocumentUploadReviewReference,
        updated_ods_code: str,
        review_update_field: set[str],
    ) -> None:
        new_document_review = review.model_copy(deep=True)
        new_document_review.version = review.version + 1
        new_document_review.custodian = updated_ods_code

        review_date = int(datetime.now(timezone.utc).timestamp())
        review.review_status = DocumentReviewStatus.NEVER_REVIEWED
        review.review_date = review_date
        review.reviewer = review.custodian
        review.custodian = updated_ods_code

        self.update_document_review_with_transaction(
            new_review_item=new_document_review,
            existing_review_item=review,
            additional_update_fields=review_update_field,
        )

    def _handle_standard_custodian_update(
        self,
        review: DocumentUploadReviewReference,
        updated_ods_code: str,
        update_fields: set[str],
    ) -> None:
        review.custodian = updated_ods_code

        self.update_document(
            document=review,
            key_pair={"ID": review.id, "Version": review.version},
            update_fields_name=update_fields,
        )

    def update_document_review_status(
        self,
        review_document: DocumentUploadReviewReference,
        condition_expression: str | ConditionBase | None = None,
    ):
        review_update_field = {"review_status", "files"}
        try:
            self.update_document(
                document=review_document,
                key_pair={"ID": review_document.id, "Version": review_document.version},
                update_fields_name=review_update_field,
                condition_expression=condition_expression,
            )
        except ClientError as e:
            logger.error(e)
            if is_transient_error(e):
                raise e
            raise DocumentReviewException("Error updating document review status")

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
                key_pair={"ID": review_update.id, "Version": review_update.version},
                update_fields_name=field_names,
                condition_expression=condition_expression,
            )
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            logger.error(e)
            if error_code == "ConditionalCheckFailedException":
                logger.error(
                    f"Condition check failed: Document ID {review_update.id}",
                    {"Result": "Failed to update document review"},
                )
                raise DocumentReviewException(ErrorMessage.FAILED_TO_UPDATE_DYNAMO)

            logger.error(
                f"DynamoDB error updating document review: {str(e)}",
                {"Result": "Failed to update document review"},
            )
            raise DocumentReviewException(ErrorMessage.FAILED_TO_UPDATE_DYNAMO)

    def update_document_review_with_transaction(
        self, new_review_item, existing_review_item, additional_update_fields=None
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
            if additional_update_fields:
                existing_update_fields.update(additional_update_fields)
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
                        "value": existing_review_item.reviewer,
                    },
                ],
            )
        except ValueError as e:
            logger.error(f"Failed to build transaction item: {str(e)}")
            raise DocumentReviewException(ErrorMessage.FAILED_TO_CREATE_TRANSACTION)
        transact_items.append(existing_doc_transaction)

        try:
            response = self.dynamo_service.transact_write_items(transact_items)
            logger.info("Transaction completed successfully")
        except ClientError as e:
            logger.error(f"Transaction failed: {str(e)}")
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "TransactionCanceledException":
                logger.error(
                    f"Condition check failed: Document ID {existing_review_item.id}  ",
                    {"Result": "Failed to update document review"},
                )
            raise DocumentReviewException(ErrorMessage.FAILED_TO_UPDATE_DYNAMO)
        return response

    def delete_document_review_files(
        self, document_review: DocumentUploadReviewReference
    ):
        for file in document_review.files:
            location_without_prefix = file.file_location.replace(
                self.s3_service.S3_PREFIX, ""
            )
            bucket, file_key = location_without_prefix.split("/", 1)
            try:
                self.s3_service.delete_object(bucket, file_key)
            except ClientError as e:
                logger.warning(
                    f"Unable to delete file {file.file_name} from S3 due to error: {e}"
                )
                logger.warning(f"Skipping file deletion for {file.file_name}")
                continue

    def build_review_dynamo_filter(
        self,
        nhs_number: str | None = None,
        uploader: str | None = None,
        status: DocumentReviewStatus | None = DocumentReviewStatus.PENDING_REVIEW,
    ) -> Attr | ConditionBase:
        filter_builder = DynamoQueryFilterBuilder()
        if status:
            filter_builder.add_condition(
                "ReviewStatus", AttributeOperator.EQUAL, status
            )

        if nhs_number:
            filter_builder.add_condition(
                "NhsNumber", AttributeOperator.EQUAL, nhs_number
            )

        if uploader:
            filter_builder.add_condition("Author", AttributeOperator.EQUAL, uploader)

        return filter_builder.build()
