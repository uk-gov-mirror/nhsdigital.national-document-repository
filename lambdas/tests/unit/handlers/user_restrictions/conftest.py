import pytest

from enums.feature_flags import FeatureFlags
from services.feature_flags_service import FeatureFlagService


@pytest.fixture
def mock_user_restriction_enabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_feature_flag = mock_function.return_value = {
        FeatureFlags.USER_RESTRICTION_ENABLED: True,
    }
    yield mock_feature_flag


@pytest.fixture
def mock_user_restriction_disabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_feature_flag = mock_function.return_value = {
        FeatureFlags.USER_RESTRICTION_ENABLED: False,
    }
    yield mock_feature_flag
