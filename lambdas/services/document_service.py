import os
from datetime import datetime, timezone
from typing import Optional

from boto3.dynamodb.conditions import Attr, ConditionBase
from botocore.exceptions import ClientError
from pydantic import BaseModel, ValidationError

from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.supported_document_types import SupportedDocumentTypes
from models.document_reference import DocumentReference
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service
from utils.audit_logging_setup import LoggingService
from utils.exceptions import DocumentServiceException

logger = LoggingService(__name__)


class DocumentService:
    """Service for document operations."""

    def __init__(self):
        self.s3_service = S3Service()
        self.dynamo_service = DynamoDBService()
        self._lg_table_name = os.getenv("LLOYD_GEORGE_DYNAMODB_NAME")
        self._lg_s3_bucket = os.getenv("LLOYD_GEORGE_BUCKET_NAME")

    @property
    def table_name(self) -> str:
        """DynamoDB table name. Can be overridden by child classes."""
        return self._lg_table_name

    @property
    def s3_bucket(self) -> str:
        """S3 bucket name. Can be overridden by child classes."""
        return self._lg_s3_bucket

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
        table: str | None = None,
        query_filter: Attr | ConditionBase = None,
        model_class: type[BaseModel] = None,
    ) -> list:
        """Fetch documents by NHS number from specified or configured table."""
        table_name = table or self.table_name

        documents = self.fetch_documents_from_table(
            index_name="NhsNumberIndex",
            search_key="NhsNumber",
            search_condition=nhs_number,
            query_filter=query_filter,
            table_name=table_name,
            model_class=model_class,
        )
        return documents

    def fetch_documents_from_table(
        self,
        search_condition: str | list[str],
        search_key: str | list[str],
        index_name: str | None = None,
        query_filter: Attr | ConditionBase = None,
        table_name: str | None = None,
        model_class: type[BaseModel] = None,
    ) -> list:
        """Fetch documents from specified or configured table using model_class."""
        documents = []
        table_name = table_name or self.table_name
        model_class = model_class or self.model_class

        response = self.dynamo_service.query_table(
            table_name=table_name,
            index_name=index_name,
            search_key=search_key,
            search_condition=search_condition,
            query_filter=query_filter,
        )
        for item in response:
            try:
                document = model_class.model_validate(item)
                documents.append(document)
            except ValidationError as e:
                logger.error(f"Validation error on document: {item}")
                logger.error(f"{e}")
                continue
        return documents

    def _get_item(self, table_name, key, model_class, return_deleted=False):
        try:
            response = self.dynamo_service.get_item(table_name=table_name, key=key)
            if "Item" not in response:
                logger.info("No document found")
                return None

            if not return_deleted:
                deleted = response.get("Item").get("Deleted", None)
                if deleted in (None, ""):
                    document = model_class.model_validate(response["Item"])
                    return document

                return None

            document = model_class.model_validate(response["Item"])
            return document

        except ValidationError as e:
            logger.error(f"Validation error on document: {response.get('Item')}")
            logger.error(f"{e}")
            return None

    def get_item_agnostic(
        self,
        partition_key: dict,
        sort_key: dict | None = None,
        table_name: str | None = None,
        model_class: type[BaseModel] | None = None,
    ) -> Optional[BaseModel]:
        table_name = table_name or self.table_name
        model_class = model_class or self.model_class

        return self._get_item(
            table_name=table_name,
            key=(partition_key or {}) | (sort_key or {}),
            model_class=model_class,
        )

    def get_item(
        self,
        document_id: str,
        sort_key: dict | None = None,
        table_name: str = None,
        model_class: type[BaseModel] = None,
        return_deleted: bool = False,
    ) -> Optional[BaseModel]:
        """Fetch a single document by ID from a specified or configured table.

        Args:
            document_id: The document ID to retrieve.
            sort_key: Optional sort key, defaults to None.
            table_name: Optional table name, defaults to self.table_name.
            model_class: Optional model class, defaults to self.model_class.

        Returns:
            Document object if found, None otherwise.
        """
        table_to_use = table_name or self.table_name
        model_to_use = model_class or self.model_class
        document_key = {"ID": document_id}
        if sort_key:
            document_key.update(sort_key)
        return self._get_item(
            table_name=table_to_use,
            key=document_key,
            model_class=model_to_use,
            return_deleted=return_deleted,
        )

    def get_nhs_numbers_based_on_ods_code(
        self,
        ods_code: str,
        table_name: str | None = None,
    ) -> list[str]:
        """Get unique NHS numbers for patients with given ODS code."""
        table_name = table_name or self.table_name
        projection_expression = "NhsNumber"
        if ods_code == "ALL":
            filter_expression = Attr("FileName").begins_with(
                "2of",
            )
        else:
            filter_expression = Attr("Author").eq(ods_code) & Attr(
                "FileName",
            ).begins_with(
                "2of",
            )

        logger.info("Starting scan of table for NHS numbers based on ODS code...")
        results = self.dynamo_service.scan_whole_table(
            table_name=table_name,
            project_expression=projection_expression,
            filter_expression=filter_expression,
        )
        unique_nhs_numbers = {
            item["NhsNumber"] for item in results if "NhsNumber" in item
        }

        logger.info(
            f"Retrieved {len(results)} records, found {len(unique_nhs_numbers)} unique NHS numbers.",
        )
        return list(unique_nhs_numbers)

    def delete_document_reference(
        self,
        table_name: str,
        document_reference: DocumentReference,
        document_ttl_days: int,
        key_pair: dict,
        deletion_date: datetime | None = None,
    ):
        if not deletion_date:
            deletion_date = datetime.now(timezone.utc)

        ttl_seconds = document_ttl_days * 24 * 60 * 60
        document_reference_ttl = int(deletion_date.timestamp() + ttl_seconds)

        logger.info(f"Deleting document reference in table: {table_name}")

        document_reference.doc_status = "deprecated"
        document_reference.deleted = deletion_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        document_reference.ttl = document_reference_ttl

        update_fields = document_reference.model_dump(
            by_alias=True,
            exclude_none=True,
            include={"doc_status", "deleted", "ttl"},
        )
        self.dynamo_service.update_item(
            table_name=table_name,
            key_pair=key_pair,
            updated_fields=update_fields,
        )

    def delete_document_references(
        self,
        table_name: str,
        document_references: list[DocumentReference],
        document_ttl_days: int,
    ):
        deletion_date = datetime.now(timezone.utc)

        logger.info(f"Deleting items in table: {table_name}")

        for reference in document_references:
            self.delete_document_reference(
                table_name=table_name,
                document_reference=reference,
                document_ttl_days=document_ttl_days,
                key_pair={DocumentReferenceMetadataFields.ID.value: reference.id},
                deletion_date=deletion_date,
            )

    def delete_document_object(self, bucket: str, key: str):
        file_exists = self.s3_service.file_exist_on_s3(
            s3_bucket_name=bucket,
            file_key=key,
        )

        if not file_exists:
            raise DocumentServiceException("Document does not exist in S3")

        logger.info(
            f"Located file `{key}` in `{bucket}`, attempting S3 object deletion",
        )
        self.s3_service.delete_object(s3_bucket_name=bucket, file_key=key)

        file_exists = self.s3_service.file_exist_on_s3(
            s3_bucket_name=bucket,
            file_key=key,
        )

        if file_exists:
            raise DocumentServiceException("Document located in S3 after deletion")

    def update_document(
        self,
        table_name: str | None = None,
        document: BaseModel = None,
        update_fields_name: set[str] | None = None,
        condition_expression: str | Attr | ConditionBase = None,
        expression_attribute_values: dict = None,
        key_pair: dict | None = None,
    ):
        """Update document in specified or configured table."""
        table_name = table_name or self.table_name

        update_kwargs = {
            "table_name": table_name,
            "updated_fields": document.model_dump(
                exclude_none=True,
                by_alias=True,
                include=update_fields_name,
            ),
            "key_pair": key_pair
            or {DocumentReferenceMetadataFields.ID.value: document.id},
        }

        if condition_expression:
            update_kwargs["condition_expression"] = condition_expression

        if expression_attribute_values:
            update_kwargs["expression_attribute_values"] = expression_attribute_values

        return self.dynamo_service.update_item(**update_kwargs)

    def hard_delete_metadata_records(
        self,
        table_name: str,
        document_references: list[BaseModel],
    ):
        """Permanently delete metadata from specified or configured table."""
        table_name = table_name or self.table_name

        logger.info(f"Deleting items in table: {table_name} (HARD DELETE)")
        primary_key_name = DocumentReferenceMetadataFields.ID.value
        for reference in document_references:
            primary_key_value = reference.id
            deletion_key = {primary_key_name: primary_key_value}
            self.dynamo_service.delete_item(table_name, deletion_key)

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
        self,
        document_ids: list[str],
        doc_type: SupportedDocumentTypes,
    ) -> list:
        table_name = doc_type.get_dynamodb_table_name()

        table_name = table_name or self.table_name
        model_class = self.model_class

        response = self.dynamo_service.batch_get_items(
            table_name=table_name,
            key_list=document_ids,
        )

        found_docs = [model_class.model_validate(item) for item in response]
        return found_docs

    def create_dynamo_entry(
        self,
        item: BaseModel,
        table_name: str | None = None,
        model_class: BaseModel | None = None,
    ):
        try:
            table_name = table_name or self.table_name
            model_class = model_class or self.model_class

            model_class.model_validate(item)
            entry = item.model_dump(by_alias=True, exclude_none=True)
            self.dynamo_service.create_item(table_name=table_name, item=entry)
        except (ValidationError, ClientError) as e:
            logger.error(e)
            raise e

    def query_table_with_paginator(
        self,
        index_name: str,
        search_key: str,
        search_condition: str,
        table_name: str | None = None,
        filter_expression: str | None = None,
        expression_attribute_names: dict | None = None,
        expression_attribute_values: dict | None = None,
        limit: int | None = None,
        page_size: int = 1,
        start_key: str | None = None,
        model_class: BaseModel | None = None,
    ) -> tuple[list[BaseModel], str | None]:

        try:
            table_name = table_name or self.table_name
            model_class = model_class or self.model_class

            response = self.dynamo_service.query_table_with_paginator(
                table_name=table_name,
                index_name=index_name,
                key=search_key,
                condition=search_condition,
                filter_expression=filter_expression,
                expression_attribute_names=expression_attribute_names,
                expression_attribute_values=expression_attribute_values,
                limit=limit,
                page_size=page_size,
                start_key=start_key,
            )

            references = [
                model_class.model_validate(item) for item in response["Items"]
            ]

            return references, response.get("NextToken")

        except (ValidationError, ClientError) as e:
            logger.error(e)
            raise e
