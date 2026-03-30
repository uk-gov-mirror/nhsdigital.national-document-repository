from enums.lambda_error import LambdaError
from models.user_restrictions.user_restrictions import UserRestriction
from services.user_restrictions.user_restriction_dynamo_service import (
    UserRestrictionDynamoService,
)
from services.user_restrictions.utilities import get_healthcare_worker_api_service
from utils.audit_logging_setup import LoggingService
from utils.exceptions import (
    UserRestrictionAlreadyExistsException,
)
from utils.lambda_exceptions import LambdaException
from utils.utilities import get_pds_service

logger = LoggingService(__name__)


class CreateUserRestrictionService:
    def __init__(self):
        self.dynamo_service = UserRestrictionDynamoService()
        self.healthcare_service = get_healthcare_worker_api_service()
        self.pds_service = get_pds_service()

    def create_restriction(
        self,
        restricted_smartcard_id: str,
        nhs_number: str,
        custodian: str,
        creator: str,
    ) -> str:
        if restricted_smartcard_id == creator:
            logger.error("You cannot create a restriction for yourself")
            raise LambdaException(
                400,
                LambdaError.UserRestrictionSelfRestriction,
            )

        patient = self.pds_service.fetch_patient_details(nhs_number)
        if not patient:
            logger.error("Patient not found in PDS")
            raise LambdaException(
                404,
                LambdaError.SearchPatientNoPDS,
            )
        if patient.general_practice_ods != custodian:
            logger.error(
                "Patient's general practice ODS does not match request context ODS",
            )
            raise LambdaException(
                403,
                LambdaError.SearchPatientNoAuth,
            )

        existing = self.dynamo_service.get_active_restriction(
            nhs_number=nhs_number,
            restricted_user=restricted_smartcard_id,
        )
        if existing:
            raise UserRestrictionAlreadyExistsException(
                "A restriction already exists for this user and patient",
            )

        self.healthcare_service.get_practitioner(restricted_smartcard_id)

        restriction = UserRestriction(
            restricted_user=restricted_smartcard_id,
            nhs_number=nhs_number,
            custodian=custodian,
            creator=creator,
        )

        self.dynamo_service.create_restriction_item(restriction)

        logger.info("Created user restriction")
        return restriction.id
