import pytest

from services.user_restrictions.update_status_user_restriction_service import (
    UpdateStatusUserRestrictionService,
)
from tests.unit.conftest import TEST_NHS_NUMBER, TEST_UUID
from tests.unit.handlers.user_restrictions.conftest import MOCK_SMARTCARD_ID


@pytest.fixture
def mock_service(mocker, set_env):
    service = UpdateStatusUserRestrictionService()
    mocker.patch.object(service, "dynamo_service")
    yield service


def test_handle_delete_restriction_calls_soft_delete(mock_service):

    mock_service.handle_delete_restriction(
        restriction_id=TEST_UUID,
        removed_by=MOCK_SMARTCARD_ID,
        nhs_number=TEST_NHS_NUMBER,
    )
    mock_service.dynamo_service.update_restriction_inactive.assert_called_with(
        restriction_id=TEST_UUID,
        removed_by=MOCK_SMARTCARD_ID,
        patient_id=TEST_NHS_NUMBER,
    )
