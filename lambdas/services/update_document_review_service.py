from datetime import datetime, timezone

from enums.document_review_status import DocumentReviewStatus
from enums.lambda_error import LambdaError
from models.document_review import (
    DocumentUploadReviewReference,
    PatchDocumentReviewRequest,
)
from services.base.s3_service import S3Service
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import PdsErrorException, DocumentReviewException, InvalidResourceIdException, \
    PatientNotFoundException
from utils.lambda_exceptions import UpdateDocumentReviewException
from utils.ods_utils import PCSE_ODS_CODE
from utils.utilities import get_pds_service

logger = LoggingService(__name__)


class UpdateDocumentReviewService:
    """Service for updating document review status in DynamoDB."""

    REJECTED_REVIEW_STATUSES = [
        DocumentReviewStatus.REJECTED,
        DocumentReviewStatus.REJECTED_DUPLICATE,
    ]

    REASSIGNMENT_STATUSES = [
        DocumentReviewStatus.REASSIGNED,
        DocumentReviewStatus.REASSIGNED_PATIENT_UNKNOWN,
    ]

    APPROVED_REVIEW_STATUSES = [
        DocumentReviewStatus.APPROVED,
    ]

    UNKNOWN_NHS_NUMBER = "0000000000"

    FAILED_LOG_MESSAGE = "Failed to update document review"

    def __init__(self):
        self.document_review_service = DocumentUploadReviewService()
        self.s3_service = S3Service()

    def update_document_review(
        self,
        patient_id: str,
        document_id: str,
        document_version: int,
        update_data: PatchDocumentReviewRequest,
        reviewer_ods_code: str,
    ):
        logger.info(
            f"Updating document review for patient_id: {patient_id}, document_id: {document_id}"
        )
        try:
            review_document = self._fetch_document(document_id, document_version)
            self._validate_document_for_update(
                review_document, patient_id, reviewer_ods_code
            )
            self._process_review_status_update(
                review_document, update_data, document_id, reviewer_ods_code
            )

            logger.info(
                f"Successfully updated document review for document_id: {document_id}"
            )
        except DocumentReviewException:
            raise UpdateDocumentReviewException(400, LambdaError.DocumentReviewGeneralError)

    def _fetch_document(self, document_id: str, document_version: int):
        review_document = self.document_review_service.get_document_review_by_id(
            document_id=document_id, document_version=document_version
        )

        if not review_document:
            logger.error(
                f"Document review not found for document_id: {document_id}",
                {"Result": self.FAILED_LOG_MESSAGE},
            )
            raise UpdateDocumentReviewException(
                404, LambdaError.DocumentReviewNotFound
            )

        return review_document

    def _validate_document_for_update(
        self,
        document,
        patient_id: str,
        reviewer_ods_code: str,
    ):
        logger.info(f"Validating document for update: {document.id}")
        self._validate_patient_id_match(document, patient_id)
        self._validate_review_status(document)
        self._validate_user_match_custodian(document, reviewer_ods_code)

    def _validate_patient_id_match(self, document, patient_id: str):
        if document.nhs_number != patient_id:
            logger.error(
                f"NHS number mismatch for document_id: {document.id}. "
                f"Expected: {patient_id}, Got: {document.nhs_number}",
                {"Result": self.FAILED_LOG_MESSAGE},
            )
            raise UpdateDocumentReviewException(
                400, LambdaError.UpdateDocNHSNumberMismatch
            )

    def _validate_review_status(self, document):
        if document.review_status not in [
            DocumentReviewStatus.PENDING_REVIEW,
        ]:
            logger.error(
                f"Invalid review status for document_id: {document.id}. "
                f"Expected: PENDING_REVIEW, Got: {document.review_status}",
                {"Result": self.FAILED_LOG_MESSAGE},
            )
            raise UpdateDocumentReviewException(
                400, LambdaError.UpdateDocStatusUnavailable
            )

    def _validate_user_match_custodian(self, document, reviewer_ods_code: str):
        if document.custodian != reviewer_ods_code:
            logger.error(
                f"Reviewer ODS code mismatch for document_id: {document.id}",
                {"Result": self.FAILED_LOG_MESSAGE},
            )
            raise UpdateDocumentReviewException(
                403, LambdaError.DocumentReferenceUnauthorised
            )

    def _process_review_status_update(
        self,
        document,
        update_data: PatchDocumentReviewRequest,
        document_id: str,
        reviewer_ods_code: str,
    ):
        self._set_review_metadata(document, update_data, reviewer_ods_code)
        self._execute_status_action(document, update_data, document_id)

    def _set_review_metadata(self, document, update_data, reviewer_ods_code):
        review_date = int(datetime.now(timezone.utc).timestamp())
        document.review_status = update_data.review_status
        document.review_date = review_date
        document.reviewer = reviewer_ods_code

    def _execute_status_action(self, document, update_data, document_id):
        update_fields = {"review_status", "review_date", "reviewer"}

        if document.review_status in self.REASSIGNMENT_STATUSES:
            self._handle_reassignment_status(document, update_data, document_id)
        elif document.review_status in self.APPROVED_REVIEW_STATUSES:
            document.document_reference_id = update_data.document_reference_id
            update_fields.add("document_reference_id")
            self._handle_rejection_or_approval(document, update_fields)
        elif document.review_status in self.REJECTED_REVIEW_STATUSES:
            self._handle_rejection_or_approval(document, update_fields)
        else:
            logger.error(
                f"Invalid status update attempted: {document.review_status}",
                {"Result": self.FAILED_LOG_MESSAGE},
            )
            raise UpdateDocumentReviewException(
                400, LambdaError.DocumentReviewGeneralError
            )

    def _handle_rejection_or_approval(self, document, update_fields):
        self.document_review_service.update_pending_review_status(
            review_update=document, field_names=update_fields
        )
        self._handle_soft_delete(document)

    def _handle_soft_delete(self, review_document: DocumentUploadReviewReference):
        logger.info(
            f"Deleting document review files for document_id: {review_document.id}"
        )
        self.document_review_service.delete_document_review_files(review_document)

    def _handle_reassignment_status(
        self, document, update_data: PatchDocumentReviewRequest, document_id: str
    ):
        new_document_review = self._create_reassigned_document(document, update_data)

        self.document_review_service.update_document_review_with_transaction(
            new_review_item=new_document_review, existing_review_item=document
        )

        logger.info(
            f"Document {document_id} reassigned to patient {update_data.nhs_number}"
        )

    def _create_reassigned_document(
        self, document, update_data: PatchDocumentReviewRequest
    ) -> DocumentUploadReviewReference:
        new_document_review = document.model_copy(deep=True)
        new_document_review.review_date = None
        new_document_review.reviewer = None
        if update_data.review_status == DocumentReviewStatus.REASSIGNED_PATIENT_UNKNOWN:
            new_document_review.nhs_number = self.UNKNOWN_NHS_NUMBER
            new_document_review.custodian = PCSE_ODS_CODE

        else:
            new_document_review.nhs_number = update_data.nhs_number
            new_document_review.custodian = self._get_patient_custodian(
                update_data.nhs_number
            )

        new_document_review.review_status = DocumentReviewStatus.PENDING_REVIEW
        new_document_review.version = new_document_review.version + 1

        return new_document_review

    def _get_patient_custodian(self, patient_nhs_number: str) -> str:
        try:
            pds_service = get_pds_service()
            patient_details = pds_service.fetch_patient_details(patient_nhs_number)
            return patient_details.general_practice_ods
        except (PdsErrorException, PatientNotFoundException, InvalidResourceIdException):
            logger.error(
                f"Failed to fetch patient details for NHS number: {patient_nhs_number}"
            )
            raise UpdateDocumentReviewException(
                400, LambdaError.DocumentReviewInvalidNhsNumber
            )
