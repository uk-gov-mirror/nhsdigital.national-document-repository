import json
from enum import StrEnum

from models.user_restrictions.practitioner import Practitioner
from utils.exceptions import HealthcareWorkerAPIException


class MockValidIdentifier(StrEnum):
    MULTIPLE_NAME_RESPOSNE = "777777777777"
    SIMPLE_RESPOSNE = "123456789012"


def build_mock_response_and_practitioner(identifier: str):

    match identifier:
        case MockValidIdentifier.MULTIPLE_NAME_RESPOSNE:
            file = "hcw_api_multiple_names_response.json"
        case MockValidIdentifier.SIMPLE_RESPOSNE:
            file = "hcw_api_practitioner_response.json"
        case _:
            raise HealthcareWorkerAPIException(status_code=404)

    with open(
        f"services/mock_data/user_restrictions/healthcare_worker_api/{file}",
    ) as file:
        mock_json = file.read()
        mock_response = json.loads(mock_json)

    test_practitioner = Practitioner(
        last_name=mock_response["entry"][0]["resource"]["name"][0]["family"],
        first_name=mock_response["entry"][0]["resource"]["name"][0]["given"][0],
        smartcard_id=mock_response["entry"][0]["resource"]["id"],
    )
    return mock_json, mock_response, test_practitioner
