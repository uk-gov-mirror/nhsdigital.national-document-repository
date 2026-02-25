import pytest

from services.mock_data.user_restrictions.build_mock_data import (
    build_mock_response_and_practitioner,
)
from services.user_restrictions.mock_hwc_api_service import (
    MockErrorIdentifiers,
    MockHealthcareWorkerApiService,
)
from tests.unit.services.user_restriction.conftest import MOCK_IDENTIFIER
from utils.exceptions import HealthcareWorkerAPIException


@pytest.fixture
def mock_service():
    return MockHealthcareWorkerApiService()


def test_mock_healthcare_worker_api_service_returns_practitioner(set_env, mock_service):
    _, _, test_practitioner = build_mock_response_and_practitioner(MOCK_IDENTIFIER)

    assert mock_service.get_practitioner(MOCK_IDENTIFIER) == test_practitioner


@pytest.mark.parametrize(
    "identifier, status_code",
    [
        (MockErrorIdentifiers.MOCK_USER_NOT_FOUND_ID, 404),
        (MockErrorIdentifiers.MOCK_INVALID_ID, 404),
        (MockErrorIdentifiers.MOCK_API_ERROR_ID, 500),
    ],
)
def test_mock_healthcare_worker_mocks_out_errors(
    identifier,
    status_code,
    set_env,
    mock_service,
):

    with pytest.raises(HealthcareWorkerAPIException) as exception:
        mock_service.get_practitioner(identifier)

    assert exception.value.status_code == status_code


def test_mock_healthcare_worker_api_service_does_not_use_real_services(
    set_env,
    mock_service,
):

    assert mock_service.ssm_service is None
    assert mock_service.oauth_service is None
