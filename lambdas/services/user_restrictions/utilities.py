import os

from services.user_restrictions.healthcare_worker_service import (
    HealthCareWorkerApiService,
)
from services.user_restrictions.mock_hwc_api_service import (
    MockHealthcareWorkerApiService,
)


def get_healthcare_worker_api_service() -> HealthCareWorkerApiService:
    if os.getenv("USE_MOCK_HEALTHCARE_SERVICE", True) in ["False", "false"]:
        return HealthCareWorkerApiService()
    return MockHealthcareWorkerApiService()
