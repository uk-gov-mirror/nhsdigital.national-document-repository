import os
from datetime import datetime

from botocore.exceptions import ClientError
from enums.death_notification_status import DeathNotificationStatus
from enums.mns_notification_types import MNSNotificationTypes
from enums.patient_ods_inactive_status import PatientOdsInactiveStatus
from models.document_reference import DocumentReference
from models.document_review import DocumentUploadReview
from models.sqs.mns_sqs_message import MNSSQSMessage
from services.base.sqs_service import SQSService
from services.document_service import DocumentService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import PdsErrorException
from utils.ods_utils import PCSE_ODS_CODE
from utils.utilities import get_pds_service

logger = LoggingService(__name__)


class MNSNotificationService:
    def __init__(self):
        self.document_service = DocumentService()
        self.lg_table = os.getenv("LLOYD_GEORGE_DYNAMODB_NAME")
        self.document_review_table = os.getenv("DOCUMENT_REVIEW_DYNAMODB_NAME")
        self.pds_service = get_pds_service()
        self.sqs_service = SQSService()
        self.queue = os.getenv("MNS_NOTIFICATION_QUEUE_URL")
        self.DOCUMENT_UPDATE_FIELDS = {"current_gp_ods", "custodian", "last_updated"}
        self.DOCUMENT_REVIEW_UPDATE_FIELDS = {"custodian"}
        self.PCSE_ODS = PCSE_ODS_CODE

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

    def update_patient_ods_code(
        self,
        patient_documents: list[DocumentReference],
        updated_ods_code: str,
    ) -> None:
        if not patient_documents:
            return
        updated_custodian = updated_ods_code
        if updated_ods_code in [
            PatientOdsInactiveStatus.DECEASED,
            PatientOdsInactiveStatus.SUSPENDED,
        ]:
            updated_custodian = self.PCSE_ODS

        for reference in patient_documents:
            logger.info("Updating patient document reference...")

            if (
                reference.current_gp_ods != updated_ods_code
                or reference.custodian != updated_ods_code
            ):

                reference.current_gp_ods = updated_ods_code
                reference.custodian = updated_custodian
                reference.last_updated = int(datetime.now().timestamp())

                self.document_service.update_document(
                    self.lg_table,
                    reference,
                    self.DOCUMENT_UPDATE_FIELDS,
                )

    def update_document_review_custodian(
        self, patient_documents: list[DocumentUploadReview], updated_ods_code: str
    ) -> None:
        if not patient_documents:
            return

        if updated_ods_code in [
            PatientOdsInactiveStatus.DECEASED,
            PatientOdsInactiveStatus.SUSPENDED,
        ]:
            updated_ods_code = self.PCSE_ODS

        for review in patient_documents:
            logger.info("Updating document review custodian...")

            if review.custodian != updated_ods_code:
                review.custodian = updated_ods_code

                self.document_service.update_document(
                    self.document_review_table,
                    review,
                    self.DOCUMENT_REVIEW_UPDATE_FIELDS,
                )

    def get_updated_gp_ods(self, nhs_number: str) -> str:
        patient_details = self.pds_service.fetch_patient_details(nhs_number)
        return patient_details.general_practice_ods

    def get_patient_documents(
        self, nhs_number: str, table: str, model_class: type
    ) -> list[DocumentReference] | list[DocumentUploadReview]:
        """Fetch patient documents and return them if they exist."""
        return self.document_service.fetch_documents_from_table_with_nhs_number(
            nhs_number, table, model_class=model_class
        )

    def get_all_patient_documents(
        self, nhs_number: str
    ) -> tuple[list[DocumentReference], list[DocumentUploadReview]]:
        """Fetch patient documents from both LG and document review tables."""
        lg_documents = self.get_patient_documents(
            nhs_number, self.lg_table, DocumentReference
        )
        review_documents = self.get_patient_documents(
            nhs_number, self.document_review_table, DocumentUploadReview
        )
        return lg_documents, review_documents

    def update_all_patient_documents(
        self,
        lg_documents: list[DocumentReference],
        review_documents: list[DocumentUploadReview],
        updated_ods_code: str,
    ) -> None:
        """Update documents in both tables if they exist."""
        if lg_documents:
            self.update_patient_ods_code(lg_documents, updated_ods_code)
        if review_documents:
            self.update_document_review_custodian(review_documents, updated_ods_code)
