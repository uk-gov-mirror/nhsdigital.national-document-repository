import re

from enums.patient_ods_inactive_status import PatientOdsInactiveStatus
from utils.exceptions import OdsErrorException
from utils.request_context import request_context

"""
On PDS, GP ODS codes must be 6 characters long, see the 'epraccur' document here for info:
https://digital.nhs.uk/services/organisation-data-service/export-data-files/csv-downloads/gp-and-gp-practice-related-data

Sometimes, a patient will not have a generalPractitioner on PDS. Internally, we can also add codes to mark inactive
patients for reporting purposes. The only values that should be considered 'active' are valid ODS codes.
"""
PCSE_ODS_CODE = "8JD29"
ODS_CODE_REGEX = r"^[A-Z\d]{6}$"


def is_ods_code_active(gp_ods) -> bool:
    if gp_ods in PatientOdsInactiveStatus.list():
        return False

    return len(gp_ods or "") == 6


def extract_ods_role_code_with_r_prefix_from_role_codes_string(role_codes) -> str:
    for role_code in role_codes.split(":"):
        if role_code.startswith("R"):
            return role_code


def extract_ods_code_from_request_context() -> str:
    try:
        ods_code = request_context.authorization.get("selected_organisation", {}).get(
            "org_ods_code",
        )
        if not ods_code:
            raise OdsErrorException()

        return ods_code

    except AttributeError:
        raise OdsErrorException("No ODS code found in request context")


def extract_creator_and_ods_code_from_request_context() -> tuple[str, str]:
    try:
        authorization = request_context.authorization or {}
        creator = authorization.get("nhs_user_id")
        ods_code = extract_ods_code_from_request_context()
        if not creator or not ods_code:
            raise OdsErrorException()

        return creator, ods_code

    except (AttributeError, OdsErrorException):
        raise OdsErrorException()


def is_valid_ods_code(value: str) -> bool:
    return bool(re.fullmatch(ODS_CODE_REGEX, value or ""))
