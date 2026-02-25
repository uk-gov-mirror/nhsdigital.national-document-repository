import pytest
from pydantic import ValidationError
from requests import Response

from models.user_restrictions.practitioner import Practitioner
from services.mock_data.user_restrictions.build_mock_data import (
    build_mock_response_and_practitioner,
)
from services.user_restrictions.healthcare_worker_service import (
    HealthCareWorkerApiService,
)
from tests.unit.conftest import HEALTHCARE_WORKER_API_URL, TEST_UUID
from tests.unit.services.user_restriction.conftest import MOCK_IDENTIFIER, MOCK_TOKEN
from utils.exceptions import (
    HealthcareWorkerAPIException,
    HealthcareWorkerPractitionerModelException,
)


@pytest.fixture
def mock_get(mocker):
    yield mocker.patch("requests.get")


@pytest.fixture
def mock_service(set_env, mocker):
    mocker.patch("services.user_restrictions.healthcare_worker_service.SSMService")
    mocker.patch("services.user_restrictions.healthcare_worker_service.NhsOauthService")
    service = HealthCareWorkerApiService()

    yield service


def test_get_practitioner_calls_endpoint_with_correct_args(
    mock_service,
    mock_get,
    mocker,
    mock_uuid,
):
    mock_service.oauth_service.get_active_access_token.return_value = MOCK_TOKEN
    _, _, practitioner = build_mock_response_and_practitioner(MOCK_IDENTIFIER)

    mocker.patch.object(
        HealthCareWorkerApiService,
        "build_practitioner",
    ).return_value = practitioner

    params = {"identifier": MOCK_IDENTIFIER}
    headers = {
        "Authorization": f"Bearer {MOCK_TOKEN}",
        "X-Correlation-Id": TEST_UUID,
        "X-Request-Id": TEST_UUID,
    }

    mock_service.get_practitioner(MOCK_IDENTIFIER)

    mock_get.assert_called_with(
        url=f"{HEALTHCARE_WORKER_API_URL}/Practitioner",
        params=params,
        headers=headers,
    )


def test_get_practitioner_200_response_returns_practitioner(mock_service, mock_get):
    mock_service.oauth_service.get_active_access_token.return_value = MOCK_TOKEN

    mock_json, mock_response, expected = build_mock_response_and_practitioner(
        MOCK_IDENTIFIER,
    )

    response = Response()
    response.status_code = 200
    response._content = mock_json.encode("utf-8")

    mock_get.return_value = response

    actual = mock_service.get_practitioner(MOCK_IDENTIFIER)

    assert type(actual) is Practitioner
    assert actual.first_name == expected.first_name
    assert actual.last_name == expected.last_name
    assert actual.smartcard_id == expected.smartcard_id


def test_get_practitioner_handles_500_response(mock_service, mock_get):
    mock_service.oauth_service.get_active_access_token.return_value = MOCK_TOKEN

    response = Response()
    response.status_code = 500

    mock_get.return_value = response

    with pytest.raises(HealthcareWorkerAPIException) as e:
        mock_service.get_practitioner(MOCK_IDENTIFIER)

    assert e.value.status_code == 500
    assert e.value.message == "Healthcare Worker API returned internal server error"


def test_get_practitioner_handles_404_response(mock_service, mock_get):
    mock_service.oauth_service.get_active_access_token.return_value = MOCK_TOKEN

    with open(
        "services/mock_data/user_restrictions/healthcare_worker_api/hcw_api_practitioner_404_response_body.json",
    ) as file:
        mock_json = file.read()

    response = Response()
    response.status_code = 404
    response._content = mock_json.encode("utf-8")

    mock_get.return_value = response
    with pytest.raises(HealthcareWorkerAPIException) as e:
        mock_service.get_practitioner(MOCK_IDENTIFIER)

    assert e.value.status_code == 404
    assert e.value.message == "Healthcare Worker API unable to find practitioner"


def test_get_practitioner_handles_401_response(mock_service, mock_get):

    response = Response()
    response.status_code = 401

    mock_get.return_value = response

    with pytest.raises(HealthcareWorkerAPIException) as e:
        mock_service.get_practitioner(MOCK_IDENTIFIER)

    assert e.value.status_code == 401
    assert e.value.message == "Healthcare Worker API returned unauthenticated"


def test_get_practitioner_handles_403_response(mock_service, mock_get):
    response = Response()
    response.status_code = 403

    mock_get.return_value = response

    with pytest.raises(HealthcareWorkerAPIException) as e:
        mock_service.get_practitioner(MOCK_IDENTIFIER)

    assert e.value.status_code == 403
    assert e.value.message == "Healthcare Worker API returned unauthorized"


def test_get_practitioner_handles_validation_error(mock_service, mocker, mock_get):
    mock_build_practitioner = mocker.patch.object(mock_service, "build_practitioner")

    mock_build_practitioner.side_effect = ValidationError("", [])

    with pytest.raises(HealthcareWorkerPractitionerModelException):
        mock_service.get_practitioner(MOCK_IDENTIFIER)


def test_get_practitioner_handles_key_error(mocker, mock_service, mock_get):
    mock_build_practitioner = mocker.patch.object(mock_service, "build_practitioner")

    mock_build_practitioner.side_effect = KeyError

    with pytest.raises(HealthcareWorkerPractitionerModelException):
        mock_service.get_practitioner(MOCK_IDENTIFIER)


def test_service_calls_ssm_for_token_each_call_to_api(mock_service):
    pass


def test_build_practitioner_returns_practitioner_model_instance(mock_service):
    _, mock_response, expected = build_mock_response_and_practitioner(MOCK_IDENTIFIER)

    actual = mock_service.build_practitioner(mock_response)

    assert type(actual) is Practitioner
    assert actual.first_name == expected.first_name
    assert actual.last_name == expected.last_name
    assert actual.smartcard_id == expected.smartcard_id


def test_build_practitioner_throws_error_more_than_one_response(mock_service):
    invalid_response_more_than_one_entry = {
        "entry": [
            {"firstEntry": "Entry one"},
            {"secondEntry": "Entry two"},
        ],
        "total": 2,
    }

    with pytest.raises(HealthcareWorkerPractitionerModelException):
        mock_service.build_practitioner(invalid_response_more_than_one_entry)
