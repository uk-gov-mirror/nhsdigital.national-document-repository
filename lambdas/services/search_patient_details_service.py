from pydantic import ValidationError
from pydantic_core import PydanticSerializationError

from enums.cloudwatch_logs_reporting_message import CloudwatchLogsReportingMessage
from enums.lambda_error import LambdaError
from enums.repository_role import RepositoryRole
from services.manage_user_session_access import ManageUserSessionAccess
from services.user_restrictions.user_restriction_dynamo_service import (
    UserRestrictionDynamoService,
)
from utils.audit_logging_setup import LoggingService
from utils.exceptions import (
    InvalidResourceIdException,
    PatientNotFoundException,
    PdsErrorException,
    UserNotAuthorisedException,
)
from utils.lambda_exceptions import SearchPatientException
from utils.ods_utils import is_ods_code_active
from utils.request_context import request_context
from utils.utilities import get_pds_service

logger = LoggingService(__name__)


class SearchPatientDetailsService:
    def __init__(self, user_role, user_ods_code):
        self.user_role = user_role
        self.user_ods_code = user_ods_code
        self.manage_user_session_service = ManageUserSessionAccess()

    def handle_search_patient_request(
        self,
        nhs_number,
        update_session=True,
        can_access_not_my_record=False,
    ):
        """
        Handle search patient request and return patient details if authorised.

        Args:
            nhs_number: The NHS number to search for
            update_session: Flag to control whether to update the session (default: True)

        Returns:
            PatientDetails object if found and the user is authorised

        Raises:
            SearchPatientException: With appropriate error code and message
        """
        try:
            self._check_user_restriction(nhs_number)

            patient_details = self._fetch_patient_details(nhs_number)

            can_manage_record = patient_details.deceased

            if not patient_details.deceased:
                can_manage_record = self._check_authorization(
                    patient_details.general_practice_ods,
                    can_access_not_my_record,
                )

            logger.info(
                CloudwatchLogsReportingMessage.PATIENT_SEARCHED,
                {"Result": "Patient found"},
            )

            if update_session and can_manage_record:
                self._update_session(nhs_number, patient_details.deceased)

            patient_details.can_manage_record = can_manage_record

            return patient_details

        except PatientNotFoundException as e:
            self._handle_error(
                e,
                LambdaError.SearchPatientNoPDS,
                404,
                "Patient not found",
            )
            return None

        except UserNotAuthorisedException as e:
            self._handle_error(
                e,
                LambdaError.SearchPatientNoAuth,
                404,
                "Patient found, User not authorised to view patient",
            )
            return None

        except (InvalidResourceIdException, PdsErrorException) as e:
            self._handle_error(
                e,
                LambdaError.SearchPatientNoId,
                400,
                "Patient not found",
            )
            return None

        except (ValidationError, PydanticSerializationError) as e:
            self._handle_error(
                e,
                LambdaError.SearchPatientNoParse,
                400,
                "Patient not found",
            )
            return None

    def _check_user_restriction(self, nhs_number: str) -> None:
        """Raise SearchPatientException (403) if the current user is restricted from this patient."""
        user_id = (
            request_context.authorization.get("nhs_user_id")
            if isinstance(request_context.authorization, dict)
            else None
        )
        if not user_id:
            logger.error(
                f"{LambdaError.SearchPatientRestricted.to_str()}",
                {"Result": "Unable to identify user for restriction check"},
            )
            raise SearchPatientException(403, LambdaError.SearchPatientRestricted)

        restriction_service = UserRestrictionDynamoService()
        is_restricted = restriction_service.check_user_restriction(
            nhs_number=nhs_number,
            smartcard_id=user_id,
        )
        if is_restricted:
            logger.error(
                f"{LambdaError.SearchPatientRestricted.to_str()}",
                {"Result": "User is restricted from accessing this patient"},
            )
            raise SearchPatientException(403, LambdaError.SearchPatientRestricted)

    def _fetch_patient_details(self, nhs_number):
        """Fetch patient details from PDS service"""
        pds_service = get_pds_service()
        return pds_service.fetch_patient_details(nhs_number)

    def _check_authorization(
        self,
        gp_ods_for_patient,
        can_access_not_my_record,
    ) -> bool:
        """
        Check if the current user is authorised to view the patient details.

        Args:
            gp_ods_for_patient: The ODS code of the patient's GP practice

        Raises:
            UserNotAuthorisedException: If the user is not authorised
        """
        patient_is_active = is_ods_code_active(gp_ods_for_patient)
        user_is_data_controller = gp_ods_for_patient == self.user_ods_code

        match self.user_role:
            case RepositoryRole.GP_ADMIN.value | RepositoryRole.GP_CLINICAL.value:
                if user_is_data_controller or can_access_not_my_record:
                    return user_is_data_controller

            case RepositoryRole.PCSE.value:
                if not patient_is_active:
                    return True

        raise UserNotAuthorisedException

    def _update_session(self, nhs_number, is_deceased):
        """Update the user session with permitted search information"""
        self.manage_user_session_service.update_auth_session_with_permitted_search(
            user_role=self.user_role,
            nhs_number=nhs_number,
            write_to_deceased_column=is_deceased,
        )

    def _handle_error(self, exception, error_code, status_code, result_message):
        """
        Handle error logging and raise the appropriate exception

        Args:
            exception: The caught exception
            error_code: Lambda error code to use
            status_code: HTTP status code to use
            result_message: Message to log as a result

        Raises:
            SearchPatientException: With appropriate error details
        """
        logger.error(
            f"{error_code.to_str()}: {str(exception)}",
            {"Result": result_message},
        )
        raise SearchPatientException(status_code, error_code)
