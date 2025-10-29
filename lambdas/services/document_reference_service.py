from datetime import datetime

from enums.supported_document_types import SupportedDocumentTypes
from models.document_reference import DocumentReference
from services.document_service import DocumentService
from utils.audit_logging_setup import LoggingService
from utils.dynamo_utils import filter_uploaded_docs_and_recently_uploading_docs
from utils.exceptions import FileUploadInProgress, NoAvailableDocument

logger = LoggingService(__name__)


class DocumentReferenceService(DocumentService):
    """Service for handling DocumentReference operations."""

    def __init__(self, doc_type: SupportedDocumentTypes = SupportedDocumentTypes.LG):
        super().__init__()
        self.doc_type = doc_type

    @property
    def table_name(self) -> str:
        return self.doc_type.get_dynamodb_table_name()

    @property
    def model_class(self) -> type:
        return DocumentReference

    @property
    def s3_bucket(self) -> str:
        return self.doc_type.get_s3_bucket_name()

    def get_available_lloyd_george_record_for_patient(
        self, nhs_number: str
    ) -> list[DocumentReference]:
        """Get available Lloyd George records for a patient, checking for upload status."""
        filter_expression = filter_uploaded_docs_and_recently_uploading_docs()
        available_docs = self.fetch_documents_from_table_with_nhs_number(
            nhs_number,
            query_filter=filter_expression,
        )

        file_in_progress_message = (
            "The patients Lloyd George record is in the process of being uploaded"
        )
        if not available_docs:
            raise NoAvailableDocument()
        for document in available_docs:
            if document.uploading and not document.uploaded:
                raise FileUploadInProgress(file_in_progress_message)
        return available_docs

    def update_patient_ods_code(
        self,
        patient_documents: list[DocumentReference],
        updated_ods_code: str,
    ) -> None:
        update_field = {"current_gp_ods", "custodian", "last_updated"}
        if not patient_documents:
            return

        for reference in patient_documents:
            logger.info("Updating patient document reference...")

            if (
                reference.current_gp_ods != updated_ods_code
                or reference.custodian != updated_ods_code
            ):
                reference.current_gp_ods = updated_ods_code
                reference.custodian = updated_ods_code
                reference.last_updated = int(datetime.now().timestamp())

                self.update_document(
                    document=reference, update_fields_name=update_field
                )
