import os
import uuid
from typing import Literal, Optional
from urllib.parse import urlparse

from botocore.exceptions import ClientError
from enums.document_retention import DocumentRetentionDays
from enums.lambda_error import LambdaError
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.nrl_sqs_upload import NrlActionTypes
from enums.snomed_codes import SnomedCode, SnomedCodes
from enums.supported_document_types import SupportedDocumentTypes
from inflection import underscore
from models.document_reference import DocumentReference
from models.fhir.R4.fhir_document_reference import Attachment
from models.sqs.nrl_sqs_message import NrlSqsMessage
from services.base.sqs_service import SQSService
from services.document_service import DocumentService
from services.lloyd_george_stitch_job_service import LloydGeorgeStitchJobService
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import NotDeleted, get_document_type_filter
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.exceptions import DocumentServiceException, DynamoServiceException
from utils.lambda_exceptions import DocumentDeletionServiceException

logger = LoggingService(__name__)


class DocumentDeletionService:
    def __init__(self):
        self.document_service = DocumentService()
        self.stitch_service = LloydGeorgeStitchJobService()
        self.sqs_service = SQSService()

    def handle_reference_delete(
        self,
        nhs_number: str,
        doc_types: list[SupportedDocumentTypes],
        document_id: str | None = None,
    ) -> list[DocumentReference]:
        if document_id:
            self.delete_document_by_id(nhs_number, document_id)
            return [document_id]
        else:
            return self.delete_documents_by_types(nhs_number, doc_types)

    def delete_document_by_id(self, nhs_number: str, document_id: str):
        doc_ref_list: DocumentReference = (
            self.document_service.fetch_documents_from_table(
                search_condition=document_id,
                search_key="ID",
                model_class=DocumentReference,
            )
        )

        if len(doc_ref_list) == 0:
            raise DocumentDeletionServiceException(404, LambdaError.DocDelNull)

        document_ref: DocumentReference = doc_ref_list[0]

        self.document_service.delete_document_references(
            table_name=self.document_service.table_name,
            document_references=[document_ref],
            document_ttl_days=DocumentRetentionDays.SOFT_DELETE,
        )

        self.send_sqs_message_to_remove_pointer(
            nhs_number,
            snomed=SnomedCodes.find_by_code(document_ref.document_snomed_code_type),
            doc_ref=document_ref,
        )

    def delete_documents_by_types(
        self, nhs_number: str, doc_types: list[SupportedDocumentTypes]
    ):
        files_deleted = []

        for doc_type in doc_types:
            snomed = SnomedCodes.find_by_code(doc_type)
            files_deleted += self.delete_specific_doc_type(nhs_number, doc_type)
            self.send_sqs_message_to_remove_pointer(nhs_number, snomed)

        if SupportedDocumentTypes.LG in doc_types:
            self.delete_documents_references_in_stitch_table(nhs_number)
            self.delete_unstitched_document_reference(nhs_number)

        return files_deleted

    def handle_object_delete(self, deleted_reference: DocumentReference):
        try:
            s3_uri = deleted_reference.file_location

            parsed_uri = urlparse(s3_uri)
            bucket_name = parsed_uri.netloc
            object_key = parsed_uri.path.lstrip("/")

            if not bucket_name or not object_key:
                raise DocumentDeletionServiceException(
                    400, LambdaError.DocDelObjectFailure
                )

            self.document_service.delete_document_object(
                bucket=bucket_name, key=object_key
            )

            logger.info(
                "Successfully deleted Document Reference S3 Object",
                {"Result": "Successful deletion"},
            )
        except DocumentServiceException as e:
            logger.error(
                str(e),
                {"Results": "Failed to delete document"},
            )
            raise DocumentDeletionServiceException(400, LambdaError.DocDelObjectFailure)

    def get_documents_references_in_storage(
        self,
        nhs_number: str,
        doc_type: Literal[SupportedDocumentTypes.ARF, SupportedDocumentTypes.LG],
    ) -> list[DocumentReference]:
        query_filter = get_document_type_filter(
            DynamoQueryFilterBuilder(), doc_type.value
        )

        results = self.document_service.fetch_documents_from_table_with_nhs_number(
            nhs_number=nhs_number,
            query_filter=query_filter,
            model_class=DocumentReference,
        )
        return results

    def delete_documents_references_in_stitch_table(self, nhs_number: str):
        documents_in_stitch_table = (
            self.stitch_service.query_stitch_trace_with_nhs_number(nhs_number) or []
        )

        for record in documents_in_stitch_table:
            record.deleted = True
            self.document_service.dynamo_service.update_item(
                table_name=self.stitch_service.stitch_trace_table,
                key_pair={DocumentReferenceMetadataFields.ID.value: record.id},
                updated_fields=record.model_dump(
                    by_alias=True,
                    include={underscore(DocumentReferenceMetadataFields.DELETED.value)},
                ),
            )

    def delete_specific_doc_type(
        self,
        nhs_number: str,
        doc_type: Literal[SupportedDocumentTypes.ARF, SupportedDocumentTypes.LG],
    ) -> list[DocumentReference]:
        try:
            results = self.get_documents_references_in_storage(nhs_number, doc_type)
            if results:
                self.document_service.delete_document_references(
                    table_name=doc_type.get_dynamodb_table_name(),
                    document_references=results,
                    document_ttl_days=DocumentRetentionDays.SOFT_DELETE,
                )

            logger.info(
                f"Deleted document of type {doc_type.value}",
                {"Result": "Successful deletion"},
            )
            return results
        except (ClientError, DynamoServiceException) as e:
            logger.error(
                f"{LambdaError.DocDelClient.to_str()}: {str(e)}",
                {"Results": "Failed to delete documents"},
            )
            raise DocumentDeletionServiceException(500, LambdaError.DocDelClient)

    def send_sqs_message_to_remove_pointer(
        self,
        nhs_number: str,
        snomed: SnomedCode,
        doc_ref: Optional[DocumentReference] = None,
    ):
        delete_nrl_message = NrlSqsMessage(
            nhs_number=nhs_number,
            action=NrlActionTypes.DELETE,
            snomed_code_doc_type=snomed,
            snomed_code_category=SnomedCodes.CARE_PLAN.value,
        )

        if doc_ref:
            attachment = Attachment(url=doc_ref.file_location)
            delete_nrl_message.attachment = attachment

        sqs_group_id = f"NRL_delete_{uuid.uuid4()}"
        nrl_queue_url = os.environ["NRL_SQS_QUEUE_URL"]
        self.sqs_service.send_message_fifo(
            queue_url=nrl_queue_url,
            message_body=delete_nrl_message.model_dump_json(exclude_unset=True),
            group_id=sqs_group_id,
        )

    def delete_unstitched_document_reference(self, nhs_number: str):
        try:
            unstitched_document_references = (
                self.document_service.fetch_documents_from_table_with_nhs_number(
                    nhs_number=nhs_number,
                    table=os.environ["UNSTITCHED_LLOYD_GEORGE_DYNAMODB_NAME"],
                    query_filter=NotDeleted,
                )
            )

            if unstitched_document_references:
                self.document_service.delete_document_references(
                    table_name=os.environ["UNSTITCHED_LLOYD_GEORGE_DYNAMODB_NAME"],
                    document_references=unstitched_document_references,
                    document_ttl_days=DocumentRetentionDays.SOFT_DELETE,
                )
        except (ClientError, DynamoServiceException) as e:
            logger.error(
                f"{LambdaError.DocDelClient.to_str()}: {str(e)}",
                {"Results": "Failed to delete documents"},
            )
            raise DocumentDeletionServiceException(500, LambdaError.DocDelClient)
