import os

from enums.snomed_codes import SnomedCodes
from models.document_reference import DocumentReference
from models.fhir.R4.bundle import Bundle, BundleEntry
from models.fhir.R4.fhir_document_reference import Attachment, DocumentReferenceInfo
from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import FinalStatusFilter, patient_nhs_number_filter
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.exceptions import (
    InvalidDocumentReferenceException,
)

logger = LoggingService(__name__)


class GetFhirDocumentReferenceHistoryService:
    def __init__(self):
        self.dynamo_service = DynamoDBService()
        self.lg_table = os.environ.get("LLOYD_GEORGE_DYNAMODB_NAME")

    def get_document_reference_history(
        self,
        document_id: str,
        nhs_number: str,
    ) -> Bundle:
        index_name = "S3FileKeyIndex"
        search_key = "S3FileKey"
        query_filter_by_nhs_number = patient_nhs_number_filter(
            DynamoQueryFilterBuilder(),
            nhs_number,
        )
        combined_filter = FinalStatusFilter & query_filter_by_nhs_number

        s3_file_key = self.get_s3_file_key(document_id, combined_filter)

        items = self.dynamo_service.query_table(
            table_name=self.lg_table,
            search_key=search_key,
            search_condition=s3_file_key,
            index_name=index_name,
            query_filter=query_filter_by_nhs_number,
        )
        return self.create_fhir_history_bundle(items)

    def get_item(self, document_id: str, combined_filter) -> str:
        item = self.dynamo_service.query_table(
            table_name=self.lg_table,
            search_key="ID",
            search_condition=document_id,
            query_filter=combined_filter,
        )

        if len(item) < 1:
            error_message = "No document reference with final status found for the provided document ID"
            logger.error(error_message)
            raise InvalidDocumentReferenceException(error_message)

        return item[0]

    def get_s3_file_key(self, document_id: str, combined_filter) -> str:
        item = self.get_item(document_id, combined_filter)
        return item.get("S3FileKey")

    def create_fhir_history_bundle(self, items: list[dict]) -> Bundle:
        entries = []

        for doc_ref in items:
            bundle_entry = self.create_bundle_entry_from_doc_ref(
                DocumentReference.model_validate(doc_ref),
            )
            entries.append(bundle_entry)

        return Bundle(
            type="history",
            total=len(items),
            entry=entries,
        ).model_dump(exclude_none=True)

    def create_bundle_entry_from_doc_ref(
        self,
        doc_ref: DocumentReference,
    ) -> BundleEntry:
        attachment = Attachment(
            title=doc_ref.file_name,
            creation=doc_ref.document_scan_creation,
        )
        fhir_doc_ref = (
            DocumentReferenceInfo(
                nhs_number=doc_ref.nhs_number,
                attachment=attachment,
                custodian=doc_ref.current_gp_ods,
                snomed_code_doc_type=SnomedCodes.find_by_code(
                    doc_ref.document_snomed_code_type,
                ),
            )
            .create_fhir_document_reference_object(doc_ref)
            .model_dump(exclude_none=True)
        )
        return BundleEntry(resource=fhir_doc_ref)
