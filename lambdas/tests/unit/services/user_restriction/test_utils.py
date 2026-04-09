import pytest

from enums.feature_flags import FeatureFlags
from lambdas.services.user_restrictions.utilities import (
    get_healthcare_worker_api_service,
)
from services.feature_flags_service import FeatureFlagService
from services.user_restrictions.healthcare_worker_service import (
    HealthCareWorkerApiService,
)
from services.user_restrictions.mock_hwc_api_service import (
    MockHealthcareWorkerApiService,
)


@pytest.fixture
def mock_feature_flag(mocker, set_env):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    yield mock_function


@pytest.mark.parametrize(
    "enabled, instance_of",
    [
        (True, HealthCareWorkerApiService),
        (False, MockHealthcareWorkerApiService),
    ],
)
def test_get_get_healthcare_worker_api_service_returns_correct_service(
    instance_of,
    enabled,
    set_env,
    mock_feature_flag,
):
    mock_feature_flag.return_value = {
        FeatureFlags.USE_SMARTCARD_AUTH.value: enabled,
    }

    assert isinstance(get_healthcare_worker_api_service(), instance_of)


def test_get_healthcare_worker_api_service_does_not_return_mock_env_var_is_false(
    set_env,
    mock_feature_flag,
):
    mock_feature_flag.return_value = {
        FeatureFlags.USE_SMARTCARD_AUTH.value: True,
    }

    assert (
        isinstance(get_healthcare_worker_api_service(), MockHealthcareWorkerApiService)
        is False
    )
