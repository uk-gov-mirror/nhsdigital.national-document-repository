from services.get_fhir_document_reference_history_service import (
    GetFhirDocumentReferenceHistoryService,
)
from utils.audit_logging_setup import LoggingService
from utils.exceptions import UserIsNotCustodianException
from utils.ods_utils import extract_ods_code_from_request_context

logger = LoggingService(__name__)


class GetDocumentReferenceHistoryService(GetFhirDocumentReferenceHistoryService):
    def __init__(self):
        super().__init__()

    def check_if_user_is_custodian_of_item(self, item: dict):
        user_ods = extract_ods_code_from_request_context()
        if item.get("CurrentGpOds") != user_ods:
            logger.error(
                "Current user's ODS code does not match the document reference's custodian ODS code",
            )
            raise UserIsNotCustodianException(
                "User is not the custodian of this document reference",
            )

    def get_item(self, document_id: str, combined_filter) -> str:
        item = super().get_item(document_id, combined_filter)
        self.check_if_user_is_custodian_of_item(item)
        return item
