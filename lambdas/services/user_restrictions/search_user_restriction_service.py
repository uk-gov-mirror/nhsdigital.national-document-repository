from models.user_restrictions.user_restriction_response import UserRestrictionResponse
from models.user_restrictions.user_restrictions import UserRestriction
from services.user_restrictions.user_restriction_dynamo_service import (
    DEFAULT_LIMIT,
    MAX_LIMIT,
    UserRestrictionDynamoService,
)
from services.user_restrictions.utilities import get_healthcare_worker_api_service
from utils.audit_logging_setup import LoggingService
from utils.exceptions import (
    HealthcareWorkerAPIException,
    HealthcareWorkerPractitionerModelException,
    InvalidResourceIdException,
    PatientNotFoundException,
    PdsErrorException,
    UserRestrictionException,
)
from utils.pagination_utils import validate_next_page_token
from utils.utilities import get_pds_service

logger = LoggingService(__name__)


class SearchUserRestrictionService:
    def __init__(self):
        self.dynamo_service = UserRestrictionDynamoService()
        self.pds_service = get_pds_service()
        self.hwc_service = get_healthcare_worker_api_service()
        self._patient_cache: dict = {}
        self._practitioner_cache: dict = {}

    def process_request(
        self,
        ods_code: str,
        smartcard_id: str | None = None,
        nhs_number: str | None = None,
        next_page_token: str | None = None,
        limit: int | str = DEFAULT_LIMIT,
    ) -> tuple[list[dict], str | None]:
        limit = self.validate_limit(limit)
        validate_next_page_token(next_page_token)

        logger.info(f"Querying user restrictions for ODS code {ods_code}")
        restrictions, next_token = self.dynamo_service.query_restrictions(
            ods_code=ods_code,
            smart_card_id=smartcard_id,
            nhs_number=nhs_number,
            limit=limit,
            start_key=next_page_token,
        )
        logger.info(f"Found {len(restrictions)} restriction(s)")

        enriched_response = [
            self._enrich_restriction(restriction) for restriction in restrictions
        ]

        serialised_response = [
            item.model_dump_camel_case(
                exclude_none=True,
                exclude={"last_updated", "is_active", "creator", "custodian"},
                mode="json",
            )
            for item in enriched_response
        ]

        return serialised_response, next_token

    def _enrich_restriction(
        self,
        restriction: UserRestriction,
    ) -> UserRestrictionResponse:
        response = UserRestrictionResponse.model_validate(
            restriction.model_dump(by_alias=True),
        )

        response = self._enrich_with_patient_name(response)
        response = self._enrich_with_restricted_user_name(response)
        return response

    def _enrich_with_patient_name(
        self,
        response: UserRestrictionResponse,
    ) -> UserRestrictionResponse:
        nhs_number = response.nhs_number
        if nhs_number not in self._patient_cache:
            logger.info(
                f"Fetching patient details for NHS number ending {nhs_number[-4:]}",
            )
            try:
                patient_details = self.pds_service.fetch_patient_details(nhs_number)
                self._patient_cache[nhs_number] = patient_details
            except (
                PatientNotFoundException,
                PdsErrorException,
                InvalidResourceIdException,
            ) as e:
                logger.warning(
                    f"Could not fetch patient name for NHS number ending "
                    f"{nhs_number[-4:]}: {e}",
                )
                self._patient_cache[nhs_number] = None
        else:
            logger.info(
                f"Using cached patient details for NHS number ending {nhs_number[-4:]}",
            )

        patient_details = self._patient_cache[nhs_number]
        if patient_details:
            response.patient_given_name = patient_details.given_name
            response.patient_family_name = patient_details.family_name
        return response

    def _enrich_with_restricted_user_name(
        self,
        response: UserRestrictionResponse,
    ) -> UserRestrictionResponse:
        smartcard_id = response.restricted_user
        if smartcard_id not in self._practitioner_cache:
            logger.info(f"Fetching practitioner details for smartcard {smartcard_id}")
            try:
                practitioner = self.hwc_service.get_practitioner(smartcard_id)
                self._practitioner_cache[smartcard_id] = practitioner
            except (
                HealthcareWorkerAPIException,
                HealthcareWorkerPractitionerModelException,
            ) as e:
                logger.warning(
                    f"Could not fetch practitioner name for smartcard "
                    f"{smartcard_id}: {e}",
                )
                self._practitioner_cache[smartcard_id] = None
        else:
            logger.info(
                f"Using cached practitioner details for smartcard {smartcard_id}",
            )

        practitioner = self._practitioner_cache[smartcard_id]
        if practitioner:
            response.restricted_user_first_name = practitioner.first_name
            response.restricted_user_last_name = practitioner.last_name
        return response

    @staticmethod
    def validate_limit(limit: int | str) -> int:
        try:
            limit = int(limit)
        except (TypeError, ValueError) as e:
            logger.error(f"Invalid limit value: {limit}")
            raise UserRestrictionException(f"Invalid limit value: {limit}") from e

        if limit < 1 or limit > MAX_LIMIT:
            logger.error(f"Limit {limit} is out of range (1–{MAX_LIMIT})")
            raise UserRestrictionException(
                f"Limit {limit} is out of range (1–{MAX_LIMIT})",
            )

        return limit
