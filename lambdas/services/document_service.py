import os
from datetime import datetime, timezone
from typing import Optional

from boto3.dynamodb.conditions import Attr, ConditionBase
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.supported_document_types import SupportedDocumentTypes
from models.document_reference import DocumentReference
from pydantic import BaseModel, ValidationError
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import NotDeleted
from utils.exceptions import DocumentServiceException

logger = LoggingService(__name__)


class DocumentService:
    """Service for document operations."""

    def __init__(self):
        self.s3_service = S3Service()
        self.dynamo_service = DynamoDBService()

    @property
    def table_name(self) -> str:
        """DynamoDB table name. Can be overridden by child classes."""
        return os.getenv("LLOYD_GEORGE_DYNAMODB_NAME")

    @property
    def s3_bucket(self) -> str:
        """S3 bucket name. Can be overridden by child classes."""
        return os.getenv("LLOYD_GEORGE_BUCKET_NAME")

    @property
    def model_class(self) -> type[BaseModel]:
        """Pydantic model class. Can be overridden by child classes."""
        return DocumentReference

    def fetch_available_document_references_by_type(
        self,
        nhs_number: str,
        doc_type: SupportedDocumentTypes,
        query_filter: Attr | ConditionBase,
    ) -> list[DocumentReference]:
        table_name = doc_type.get_dynamodb_table_name()

        return self.fetch_documents_from_table_with_nhs_number(
            nhs_number,
            table_name,
            query_filter=query_filter,
        )

    def fetch_documents_from_table_with_nhs_number(
        self,
        nhs_number: str,
        table: str = None,
        query_filter: Attr | ConditionBase = None,
        model_class: type[BaseModel] = None,
    ) -> list:
        """Fetch documents by NHS number from specified or configured table."""
        table_to_use = table or self.table_name

        documents = self.fetch_documents_from_table(
            index_name="NhsNumberIndex",
            search_key="NhsNumber",
            search_condition=nhs_number,
            query_filter=query_filter,
            table_name=table_to_use,
            model_class=model_class,
        )
        return documents

    def fetch_documents_from_table(
        self,
        search_condition: str,
        search_key: str,
        index_name: str = None,
        query_filter: Attr | ConditionBase = None,
        table_name: str = None,
        model_class: type[BaseModel] = None,
    ) -> list:
        """Fetch documents from specified or configured table using model_class."""
        documents = []
        table_to_use = table_name or self.table_name
        model_to_use = model_class or self.model_class

        response = self.dynamo_service.query_table(
            table_name=table_to_use,
            index_name=index_name,
            search_key=search_key,
            search_condition=search_condition,
            query_filter=query_filter,
        )
        for item in response:
            try:
                document = model_to_use.model_validate(item)
                documents.append(document)
            except ValidationError as e:
                logger.error(f"Validation error on document: {item}")
                logger.error(f"{e}")
                continue
        return documents

    def get_item(
        self,
        document_id: str,
        table_name: str = None,
        model_class: type[BaseModel] = None,
    ) -> Optional[BaseModel]:
        """Fetch a single document by ID from specified or configured table.

        Args:
            document_id: The document ID to retrieve.
            table_name: Optional table name, defaults to self.table_name.
            model_class: Optional model class, defaults to self.model_class.

        Returns:
            Document object if found, None otherwise.
        """
        table_to_use = table_name or self.table_name
        model_to_use = model_class or self.model_class

        try:
            response = self.dynamo_service.get_item(
                table_name=table_to_use, key={"ID": document_id}
            )

            if "Item" not in response:
                logger.info(f"No document found for document_id: {document_id}")
                return None

            document = model_to_use.model_validate(response["Item"])
            return document

        except ValidationError as e:
            logger.error(f"Validation error on document: {response.get('Item')}")
            logger.error(f"{e}")
            return None

    def get_nhs_numbers_based_on_ods_code(
        self, ods_code: str, table_name: str = None
    ) -> list[str]:
        """Get unique NHS numbers for patients with given ODS code."""
        table_to_use = table_name or self.table_name

        documents = self.fetch_documents_from_table(
            index_name="OdsCodeIndex",
            search_key=DocumentReferenceMetadataFields.CURRENT_GP_ODS.value,
            search_condition=ods_code,
            query_filter=NotDeleted,
            table_name=table_to_use,
        )
        nhs_numbers = list({document.nhs_number for document in documents})
        return nhs_numbers

    def delete_document_references(
        self,
        table_name: str,
        document_references: list[DocumentReference],
        document_ttl_days: int,
    ):
        deletion_date = datetime.now(timezone.utc)

        ttl_seconds = document_ttl_days * 24 * 60 * 60
        document_reference_ttl = int(deletion_date.timestamp() + ttl_seconds)

        logger.info(f"Deleting items in table: {table_name}")

        for reference in document_references:
            reference.doc_status = "deprecated"
            reference.deleted = deletion_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            reference.ttl = document_reference_ttl

            update_fields = reference.model_dump(
                by_alias=True,
                exclude_none=True,
                include={"doc_status", "deleted", "ttl"},
            )
            self.dynamo_service.update_item(
                table_name=table_name,
                key_pair={DocumentReferenceMetadataFields.ID.value: reference.id},
                updated_fields=update_fields,
            )

    def delete_document_object(self, bucket: str, key: str):
        file_exists = self.s3_service.file_exist_on_s3(
            s3_bucket_name=bucket, file_key=key
        )

        if not file_exists:
            raise DocumentServiceException("Document does not exist in S3")

        logger.info(
            f"Located file `{key}` in `{bucket}`, attempting S3 object deletion"
        )
        self.s3_service.delete_object(s3_bucket_name=bucket, file_key=key)

        file_exists = self.s3_service.file_exist_on_s3(
            s3_bucket_name=bucket, file_key=key
        )

        if file_exists:
            raise DocumentServiceException("Document located in S3 after deletion")

    def update_document(
        self,
        table_name: str = None,
        document: BaseModel = None,
        update_fields_name: set[str] = None,
        condition_expression: str | Attr | ConditionBase = None,
        expression_attribute_values: dict = None,
    ):
        """Update document in specified or configured table.

        By default, this method ensures the document exists before updating (prevents creating new items).
        If you need different behaviour, provide your own condition_expression.

        Args:
            table_name: Optional table name, defaults to self.table_name.
            document: The document model to update.
            update_fields_name: Set of field names to include in the update.
            condition_expression: Optional DynamoDB condition expression (string or Attr/ConditionBase).
                                 If None, defaults to checking that the ID exists.
            expression_attribute_values: Optional expression attribute values for the condition.

        Returns:
            DynamoDB update response.

        Raises:
            ClientError: If the condition check fails (e.g. a document doesn't exist).
        """
        table_to_use = table_name or self.table_name

        update_kwargs = {
            "table_name": table_to_use,
            "key_pair": {DocumentReferenceMetadataFields.ID.value: document.id},
            "updated_fields": document.model_dump(
                exclude_none=True, by_alias=True, include=update_fields_name
            ),
        }

        # If no condition provided, default to ensuring the document exists
        # This prevents accidentally creating new items when updating
        if condition_expression is None:
            condition_expression = Attr(
                DocumentReferenceMetadataFields.ID.value
            ).exists()

        update_kwargs["condition_expression"] = condition_expression

        if expression_attribute_values:
            update_kwargs["expression_attribute_values"] = expression_attribute_values

        return self.dynamo_service.update_item(**update_kwargs)

    def hard_delete_metadata_records(
        self, table_name: str, document_references: list[BaseModel]
    ):
        """Permanently delete metadata from specified or configured table."""
        table_to_use = table_name or self.table_name

        logger.info(f"Deleting items in table: {table_to_use} (HARD DELETE)")
        primary_key_name = DocumentReferenceMetadataFields.ID.value
        for reference in document_references:
            primary_key_value = reference.id
            deletion_key = {primary_key_name: primary_key_value}
            self.dynamo_service.delete_item(table_to_use, deletion_key)

    @staticmethod
    def is_upload_in_process(record: DocumentReference) -> bool:
        """Check if a document upload is currently in progress."""
        return (
            not record.uploaded
            and record.uploading
            and record.last_updated_within_three_minutes()
            and record.doc_status != "final"
        )

    def get_batch_document_references_by_id(
        self, document_ids: list[str], doc_type: SupportedDocumentTypes
    ) -> list:
        table_name = doc_type.get_dynamodb_table_name()

        table_to_use = table_name or self.table_name
        model_to_use = self.model_class

        response = self.dynamo_service.batch_get_items(
            table_name=table_to_use, key_list=document_ids
        )

        found_docs = [model_to_use.model_validate(item) for item in response]
        return found_docs
