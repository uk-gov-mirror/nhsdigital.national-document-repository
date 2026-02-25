from enum import StrEnum

from models.user_restrictions.practitioner import Practitioner
from services.mock_data.user_restrictions.build_mock_data import (
    build_mock_response_and_practitioner,
)
from services.user_restrictions.healthcare_worker_service import (
    HealthCareWorkerApiService,
)
from utils.exceptions import HealthcareWorkerAPIException


class MockErrorIdentifiers(StrEnum):
    MOCK_USER_NOT_FOUND_ID = "2222222222222"
    MOCK_INVALID_ID = "9999"
    MOCK_API_ERROR_ID = "333333333333"


class MockHealthcareWorkerApiService(HealthCareWorkerApiService):
    def __init__(self):
        super().__init__()
        self.ssm_service = None
        self.oauth_service = None
        self.base_url = None

    def get_practitioner(self, identifier: str) -> Practitioner | None:

        match identifier:
            case [
                MockErrorIdentifiers.MOCK_USER_NOT_FOUND_ID,
                MockErrorIdentifiers.MOCK_INVALID_ID,
            ]:
                raise HealthcareWorkerAPIException(status_code=404)
            case MockErrorIdentifiers.MOCK_API_ERROR_ID:
                raise HealthcareWorkerAPIException(status_code=500)
            case _:
                _, _, test_practitioner = build_mock_response_and_practitioner(
                    identifier,
                )
                return test_practitioner
