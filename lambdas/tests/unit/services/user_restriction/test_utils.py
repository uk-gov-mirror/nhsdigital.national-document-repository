import pytest

from services.user_restrictions.healthcare_worker_service import (
    HealthCareWorkerApiService,
)
from services.user_restrictions.mock_hwc_api_service import (
    MockHealthcareWorkerApiService,
)
from services.user_restrictions.utilites import get_healthcare_worker_api_service


@pytest.mark.parametrize(
    "is_mocked, instance_of",
    [
        ("False", HealthCareWorkerApiService),
        ("false", HealthCareWorkerApiService),
        ("true", MockHealthcareWorkerApiService),
    ],
)
def test_get_get_healthcare_worker_api_service_returns_correct_service(
    set_env,
    is_mocked,
    instance_of,
    monkeypatch,
):
    monkeypatch.setenv("USE_MOCK_HEALTHCARE_SERVICE", is_mocked)

    assert isinstance(get_healthcare_worker_api_service(), instance_of)


def test_get_healthcare_worker_api_service_does_not_return_mock_env_var_is_false(
    set_env,
    monkeypatch,
):
    monkeypatch.setenv("USE_MOCK_HEALTHCARE_SERVICE", "false")

    assert (
        isinstance(get_healthcare_worker_api_service(), MockHealthcareWorkerApiService)
        is False
    )
