import os

from botocore.exceptions import ClientError

from enums.death_notification_status import DeathNotificationStatus
from enums.mns_notification_types import MNSNotificationTypes
from enums.patient_ods_inactive_status import PatientOdsInactiveStatus
from models.document_reference import DocumentReference
from models.document_review import DocumentUploadReviewReference
from models.sqs.mns_sqs_message import MNSSQSMessage
from models.user_restrictions.user_restrictions import UserRestriction
from services.base.sqs_service import SQSService
from services.document_reference_service import DocumentReferenceService
from services.document_upload_review_service import DocumentUploadReviewService
from services.user_restrictions.user_restriction_dynamo_service import (
    UserRestrictionDynamoService,
)
from utils.audit_logging_setup import LoggingService
from utils.exceptions import PdsErrorException
from utils.utilities import get_pds_service

logger = LoggingService(__name__)


class MNSNotificationService:
    def __init__(self):
        self.document_review_service = DocumentUploadReviewService()
        self.lg_document_service = DocumentReferenceService()
        self.pds_service = get_pds_service()
        self.sqs_service = SQSService()
        self.queue = os.getenv("MNS_NOTIFICATION_QUEUE_URL")
        self.restrictions_dynamo_service = UserRestrictionDynamoService()

    def handle_mns_notification(self, message: MNSSQSMessage):
        try:
            match message.type:
                case MNSNotificationTypes.CHANGE_OF_GP:
                    logger.info("Handling GP change notification.")
                    self.handle_gp_change_notification(message)
                case MNSNotificationTypes.DEATH_NOTIFICATION:
                    logger.info("Handling death status notification.")
                    self.handle_death_notification(message)
        except (PdsErrorException, ClientError) as e:
            logger.error(
                f"Unable to process message: {message.id}, of type: {message.type}",
            )
            logger.error(str(e))
            raise

    def handle_gp_change_notification(self, message: MNSSQSMessage) -> None:
        nhs_number = message.subject.nhs_number
        lg_documents, review_documents, restrictions = self._fetch_patient_data(
            nhs_number,
        )

        if not (lg_documents or review_documents or restrictions):
            return

        updated_ods_code = self.get_updated_gp_ods(nhs_number)
        self._apply_ods_update(
            nhs_number,
            lg_documents,
            review_documents,
            restrictions,
            updated_ods_code,
        )
        logger.info("Update complete for change of GP.")

    def handle_death_notification(self, message: MNSSQSMessage) -> None:
        death_notification_type = message.data["deathNotificationStatus"]
        nhs_number = message.subject.nhs_number

        match death_notification_type:
            case DeathNotificationStatus.INFORMAL:
                logger.info(
                    "Patient is deceased - INFORMAL, moving on to the next message.",
                )

            case DeathNotificationStatus.REMOVED:
                lg_documents, review_documents, restrictions = self._fetch_patient_data(
                    nhs_number,
                )

                if not (lg_documents or review_documents or restrictions):
                    return

                updated_ods_code = self.get_updated_gp_ods(nhs_number)
                self._apply_ods_update(
                    nhs_number,
                    lg_documents,
                    review_documents,
                    restrictions,
                    updated_ods_code,
                )
                logger.info("Update complete for death notification change.")

            case DeathNotificationStatus.FORMAL:
                lg_documents, review_documents, restrictions = self._fetch_patient_data(
                    nhs_number,
                )
                self._apply_ods_update(
                    nhs_number,
                    lg_documents,
                    review_documents,
                    restrictions,
                    PatientOdsInactiveStatus.DECEASED,
                )
                logger.info(
                    f"Update complete, patient marked {PatientOdsInactiveStatus.DECEASED}.",
                )

    def _fetch_patient_data(
        self,
        nhs_number: str,
    ) -> tuple[
        list[DocumentReference],
        list[DocumentUploadReviewReference],
        list[UserRestriction],
    ]:
        lg_documents, review_documents = self.get_all_patient_documents(nhs_number)
        restrictions = (
            self.restrictions_dynamo_service.query_restrictions_by_nhs_number(
                nhs_number=nhs_number,
            )
        )
        return lg_documents, review_documents, restrictions

    def _apply_ods_update(
        self,
        nhs_number: str,
        lg_documents: list[DocumentReference],
        review_documents: list[DocumentUploadReviewReference],
        restrictions: list[UserRestriction],
        ods_code: str,
    ) -> None:
        if lg_documents or review_documents:
            self.update_all_patient_documents(lg_documents, review_documents, ods_code)
        if restrictions:
            self.update_restrictions(
                nhs_number=nhs_number,
                custodian=ods_code,
                restrictions=restrictions,
            )

    def get_updated_gp_ods(self, nhs_number: str) -> str:
        patient_details = self.pds_service.fetch_patient_details(nhs_number)
        return patient_details.general_practice_ods

    def get_all_patient_documents(
        self,
        nhs_number: str,
    ) -> tuple[list[DocumentReference], list[DocumentUploadReviewReference]]:
        lg_documents = (
            self.lg_document_service.fetch_documents_from_table_with_nhs_number(
                nhs_number,
            )
        )
        review_documents = (
            self.document_review_service.fetch_documents_from_table_with_nhs_number(
                nhs_number,
            )
        )

        return lg_documents, review_documents

    def update_all_patient_documents(
        self,
        lg_documents: list[DocumentReference],
        review_documents: list[DocumentUploadReviewReference],
        updated_ods_code: str,
    ) -> None:
        """Update documents in both tables if they exist."""
        if lg_documents:
            self.lg_document_service.update_patient_ods_code(
                lg_documents,
                updated_ods_code,
            )
        if review_documents:
            self.document_review_service.update_document_review_custodian(
                review_documents,
                updated_ods_code,
            )

    def update_restrictions(
        self,
        nhs_number: str,
        custodian: str,
        restrictions: list[UserRestriction],
    ) -> None:
        for restriction in restrictions:
            logger.info(f"Updating restriction {restriction.id}")
            self.restrictions_dynamo_service.update_restriction_custodian(
                restriction_id=restriction.id,
                updated_custodian=custodian,
            )

        logger.info(f"All restrictions for patient {nhs_number} updated.")
