from enums.feature_flags import FeatureFlags
from services.feature_flags_service import FeatureFlagService
from services.user_restrictions.healthcare_worker_service import (
    HealthCareWorkerApiService,
)
from services.user_restrictions.mock_hwc_api_service import (
    MockHealthcareWorkerApiService,
)


def get_healthcare_worker_api_service() -> HealthCareWorkerApiService:
    feature_flag_service = FeatureFlagService()

    smartcard_auth_flag_object = feature_flag_service.get_feature_flags_by_flag(
        FeatureFlags.USE_SMARTCARD_AUTH.value,
    )
    if smartcard_auth_flag_object[FeatureFlags.USE_SMARTCARD_AUTH.value]:
        return HealthCareWorkerApiService()
    return MockHealthcareWorkerApiService()
