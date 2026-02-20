import json
import os

import requests
from botocore.exceptions import ClientError
from requests.models import HTTPError

from enums.lambda_error import LambdaError
from enums.pds_ssm_parameters import SSMParameter
from enums.virus_scan_result import VirusScanResult
from services.base.ssm_service import SSMService
from utils.audit_logging_setup import LoggingService
from utils.lambda_exceptions import VirusScanResultException

logger = LoggingService(__name__)

FAIL_SCAN = "Virus scan result failed"
SCAN_ENDPOINT = "/api/Scan/Existing"
TOKEN_ENDPOINT = "/api/Token"


class VirusScanService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "_initialized") and self._initialized:
            return
        self.staging_s3_bucket_name = os.getenv("STAGING_STORE_BUCKET_NAME")
        self.ssm_service = SSMService()
        self.username = ""
        self.password = ""
        self.base_url = ""
        self.access_token = ""
        self._initialized = True

    def scan_file(self, file_ref: str, *args, **kwargs) -> VirusScanResult:
        try:
            if not self.base_url:
                self.get_ssm_parameters_for_request_access_token()

            result = self.request_virus_scan(file_ref, retry_on_expired=True)

            if result == VirusScanResult.CLEAN:
                logger.info(
                    "Virus scan request succeeded",
                    {"Result": "Virus scan request succeeded"},
                )
            else:
                logger.info(
                    "File scan result was not 'clean'",
                    {"Result": FAIL_SCAN},
                )
            return result
        except ClientError as e:
            logger.error(
                f"{LambdaError.VirusScanAWSFailure.to_str()}: {str(e)}",
                {"Result": FAIL_SCAN},
            )
            return VirusScanResult.ERROR
        except Exception as e:
            logger.error(
                "Virus scan failed due to unexpected error: ",
                str(e),
                {"Result": FAIL_SCAN},
            )
            return VirusScanResult.ERROR

    def request_virus_scan(self, file_ref: str, retry_on_expired: bool):
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + self.access_token,
            }
            scan_url = self.base_url + SCAN_ENDPOINT
            json_data_request = {
                "container": self.staging_s3_bucket_name,
                "objectPath": file_ref,
            }
            logger.info(f"Json data request: {json_data_request}")

            response = requests.post(
                url=scan_url,
                data=json.dumps(json_data_request),
                headers=headers,
            )
            if response.status_code == 401 and retry_on_expired:
                self.get_new_access_token()
                return self.request_virus_scan(file_ref, retry_on_expired=False)
            response.raise_for_status()

            parsed = response.json()
            return parsed["result"]

        except HTTPError:
            logger.info(
                "Virus scan request failed",
                {"Result": FAIL_SCAN},
            )
            raise VirusScanResultException(400, LambdaError.VirusScanTokenRequest)

    def get_new_access_token(self):
        try:
            logger.info("Fetching new virus scan token")
            json_login = json.dumps(
                {"username": self.username, "password": self.password},
            )
            token_url = self.base_url + TOKEN_ENDPOINT

            response = requests.post(
                url=token_url,
                headers={"Content-type": "application/json"},
                data=json_login,
            )

            response.raise_for_status()
            self.access_token = response.json()["accessToken"]

            self.update_ssm_access_token(self.access_token)
            logger.info("Successfully updated access token in SSM")
        except ClientError as e:
            # ignore SSM errors as it will be handled by the retry mechanism in request_virus_scan
            # this is to prevent a scenario where multiple concurrent executions attempt to refresh the token at the same time,
            # resulting in a flood of requests to update the token in SSM potentially causing an exception.
            # By ignoring the exception, we allow the retry mechanism to handle the situation gracefully without
            # overwhelming SSM.
            logger.info(f"Failed to store token in SSM: {str(e)}")

        except Exception as e:
            logger.error(
                f"{LambdaError.VirusScanNoToken.to_str()}: {str(e)}",
                {"Result": FAIL_SCAN},
            )
            raise VirusScanResultException(500, LambdaError.VirusScanTokenRequest)

    def update_ssm_access_token(self, access_token):
        parameter_key = SSMParameter.VIRUS_API_ACCESS_TOKEN.value
        self.ssm_service.update_ssm_parameter(
            parameter_key=parameter_key,
            parameter_value=access_token,
            parameter_type="SecureString",
        )

    def get_ssm_parameters_for_request_access_token(self):
        access_token_key = SSMParameter.VIRUS_API_ACCESS_TOKEN.value
        username_key = SSMParameter.VIRUS_API_USER.value
        password_key = SSMParameter.VIRUS_API_PASSWORD.value
        url_key = SSMParameter.VIRUS_API_BASE_URL.value

        parameters = [username_key, password_key, url_key, access_token_key]

        ssm_response = self.ssm_service.get_ssm_parameters(
            parameters,
            with_decryption=True,
        )
        self.username = ssm_response[username_key]
        self.password = ssm_response[password_key]
        self.base_url = ssm_response[url_key]
        self.access_token = ssm_response[access_token_key]
