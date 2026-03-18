import os
import uuid

import requests
from pydantic import ValidationError

from models.user_restrictions.practitioner import Practitioner
from services.base.nhs_oauth_service import NhsOauthService
from services.base.ssm_service import SSMService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import (
    HealthcareWorkerAPIException,
    HealthcareWorkerPractitionerModelException,
)

logger = LoggingService(__name__)


class HealthCareWorkerApiService:
    def __init__(self):
        self.ssm_service = SSMService()
        self.oauth_service = NhsOauthService(self.ssm_service)
        self.base_url = os.environ["HEALTHCARE_WORKER_API_URL"]

    def get_practitioner(self, identifier: str) -> Practitioner:

        try:
            logger.info("Fetching token.")
            auth_token = self.oauth_service.get_active_access_token()
            headers = {
                "Authorization": f"Bearer {auth_token}",
                "X-Correlation-Id": str(uuid.uuid4()),
                "X-Request-Id": str(uuid.uuid4()),
            }
            params = {
                "identifier": identifier,
            }

            logger.info(f"Fetching practitioner information for {identifier}.")
            response = requests.get(
                url=f"{self.base_url}/Practitioner",
                params=params,
                headers=headers,
            )

            response.raise_for_status()

            body = response.json()
            return self.build_practitioner(body)

        except requests.exceptions.HTTPError as e:
            raise HealthcareWorkerAPIException(
                status_code=e.response.status_code,
            )
        except (ValidationError, KeyError) as e:
            logger.error(e)
            raise HealthcareWorkerPractitionerModelException

    def build_practitioner(self, response: dict) -> Practitioner:
        if response["total"] > 1:
            logger.info("Received more than on entry for practitioner.")
            raise HealthcareWorkerPractitionerModelException

        logger.info("Creating practitioner model with user information.")
        entry = response["entry"][0]

        practitioner_id = entry["resource"]["id"]

        names = entry["resource"]["name"]
        first_name = names[0]["given"][0]
        last_name = names[0]["family"]

        return Practitioner(
            smartcard_id=practitioner_id,
            first_name=first_name,
            last_name=last_name,
        )
