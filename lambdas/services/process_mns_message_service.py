import os

from botocore.exceptions import ClientError
from enums.death_notification_status import DeathNotificationStatus
from enums.mns_notification_types import MNSNotificationTypes
from enums.patient_ods_inactive_status import PatientOdsInactiveStatus
from models.document_reference import DocumentReference
from models.document_review import DocumentUploadReviewReference
from models.sqs.mns_sqs_message import MNSSQSMessage
from services.base.sqs_service import SQSService
from services.document_reference_service import DocumentReferenceService
from services.document_upload_review_service import DocumentUploadReviewService
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

    def handle_mns_notification(self, message: MNSSQSMessage):
        try:
            match message.type:
                case MNSNotificationTypes.CHANGE_OF_GP:
                    logger.info("Handling GP change notification.")
                    self.handle_gp_change_notification(message)
                case MNSNotificationTypes.DEATH_NOTIFICATION:
                    logger.info("Handling death status notification.")
                    self.handle_death_notification(message)

        except PdsErrorException as e:
            logger.info("An error occurred when calling PDS")
            logger.info(
                f"Unable to process message: {message.id}, of type: {message.type}"
            )
            logger.info(f"{e}")
            raise e

        except ClientError as e:
            logger.info(
                f"Unable to process message: {message.id}, of type: {message.type}"
            )
            logger.info(f"{e}")
            raise e

    def handle_gp_change_notification(self, message: MNSSQSMessage) -> None:
        lg_documents, review_documents = self.get_all_patient_documents(
            message.subject.nhs_number
        )

        if not lg_documents and not review_documents:
            return

        updated_ods_code = self.get_updated_gp_ods(message.subject.nhs_number)
        self.update_all_patient_documents(
            lg_documents, review_documents, updated_ods_code
        )
        logger.info("Update complete for change of GP")

    def handle_death_notification(self, message: MNSSQSMessage) -> None:
        death_notification_type = message.data["deathNotificationStatus"]
        nhs_number = message.subject.nhs_number

        match death_notification_type:
            case DeathNotificationStatus.INFORMAL:
                logger.info(
                    "Patient is deceased - INFORMAL, moving on to the next message."
                )

            case DeathNotificationStatus.REMOVED:
                lg_documents, review_documents = self.get_all_patient_documents(
                    nhs_number
                )

                if lg_documents or review_documents:
                    updated_ods_code = self.get_updated_gp_ods(nhs_number)
                    self.update_all_patient_documents(
                        lg_documents, review_documents, updated_ods_code
                    )
                    logger.info("Update complete for death notification change.")

            case DeathNotificationStatus.FORMAL:
                lg_documents, review_documents = self.get_all_patient_documents(
                    nhs_number
                )

                if lg_documents or review_documents:
                    self.update_all_patient_documents(
                        lg_documents,
                        review_documents,
                        PatientOdsInactiveStatus.DECEASED,
                    )
                    logger.info(
                        f"Update complete, patient marked {PatientOdsInactiveStatus.DECEASED}."
                    )

    def get_updated_gp_ods(self, nhs_number: str) -> str:
        patient_details = self.pds_service.fetch_patient_details(nhs_number)
        return patient_details.general_practice_ods

    def get_all_patient_documents(
        self, nhs_number: str
    ) -> tuple[list[DocumentReference], list[DocumentUploadReviewReference]]:
        """Fetch patient documents from both LG and document review tables."""
        lg_documents = (
            self.lg_document_service.fetch_documents_from_table_with_nhs_number(
                nhs_number
            )
        )
        review_documents = (
            self.document_review_service.fetch_documents_from_table_with_nhs_number(
                nhs_number
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
                lg_documents, updated_ods_code
            )
        if review_documents:
            self.document_review_service.update_document_review_custodian(
                review_documents, updated_ods_code
            )
