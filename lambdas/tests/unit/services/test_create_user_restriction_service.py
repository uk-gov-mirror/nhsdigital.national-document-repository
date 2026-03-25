from unittest.mock import MagicMock

import pytest
from freezegun import freeze_time

from models.pds_models import PatientDetails
from models.user_restrictions.practitioner import Practitioner
from services.user_restrictions.create_user_restriction_service import (
    CreateUserRestrictionService,
)
from tests.unit.conftest import (
    MOCK_CREATOR_ID,
    MOCK_SMART_CARD_ID,
    TEST_CURRENT_GP_ODS,
    TEST_NHS_NUMBER,
)
from utils.exceptions import (
    HealthcareWorkerAPIException,
    HealthcareWorkerPractitionerModelException,
    UserRestrictionAlreadyExistsException,
)

MOCK_PRACTITIONER = Practitioner(
    smartcard_id=MOCK_SMART_CARD_ID,
    first_name="Jane",
    last_name="Doe",
)

MOCK_PATIENT = PatientDetails(
    nhsNumber=TEST_NHS_NUMBER,
    givenName=["John"],
    familyName="Doe",
    birthDate="1990-01-01",
    postalCode="LS1 6AE",
    superseded=False,
    restricted=False,
    generalPracticeOds=TEST_CURRENT_GP_ODS,
    active=True,
)


@pytest.fixture
def mock_service(set_env, mocker):
    mocker.patch(
        "services.user_restrictions.create_user_restriction_service.UserRestrictionDynamoService",
    )
    mocker.patch(
        "services.user_restrictions.create_user_restriction_service.get_healthcare_worker_api_service",
    )
    mocker.patch(
        "services.user_restrictions.create_user_restriction_service.get_pds_service",
    )

    service = CreateUserRestrictionService()
    service.dynamo_service = MagicMock()
    service.dynamo_service.get_active_restriction.return_value = None
    service.healthcare_service = MagicMock()
    service.pds_service = MagicMock()
    service.pds_service.fetch_patient_details.return_value = MOCK_PATIENT

    yield service


@freeze_time("2024-01-01 12:00:00")
def test_create_restriction_happy_path(mock_service):
    mock_service.healthcare_service.get_practitioner.return_value = MOCK_PRACTITIONER

    result = mock_service.create_restriction(
        restricted_smartcard_id=MOCK_SMART_CARD_ID,
        nhs_number=TEST_NHS_NUMBER,
        custodian=TEST_CURRENT_GP_ODS,
        creator=MOCK_CREATOR_ID,
    )

    assert isinstance(result, str)
    assert len(result) > 0


@freeze_time("2024-01-01 12:00:00")
def test_create_restriction_calls_get_practitioner(mock_service):
    mock_service.healthcare_service.get_practitioner.return_value = MOCK_PRACTITIONER

    mock_service.create_restriction(
        restricted_smartcard_id=MOCK_SMART_CARD_ID,
        nhs_number=TEST_NHS_NUMBER,
        custodian=TEST_CURRENT_GP_ODS,
        creator=MOCK_CREATOR_ID,
    )

    mock_service.healthcare_service.get_practitioner.assert_called_once_with(
        MOCK_SMART_CARD_ID,
    )


@freeze_time("2024-01-01 12:00:00")
def test_create_restriction_writes_to_dynamo(mock_service):
    mock_service.healthcare_service.get_practitioner.return_value = MOCK_PRACTITIONER

    mock_service.create_restriction(
        restricted_smartcard_id=MOCK_SMART_CARD_ID,
        nhs_number=TEST_NHS_NUMBER,
        custodian=TEST_CURRENT_GP_ODS,
        creator=MOCK_CREATOR_ID,
    )

    mock_service.dynamo_service.create_restriction_item.assert_called_once()
    restriction = mock_service.dynamo_service.create_restriction_item.call_args.args[0]
    assert restriction.restricted_user == MOCK_SMART_CARD_ID
    assert restriction.nhs_number == TEST_NHS_NUMBER


def test_create_restriction_raises_when_restriction_already_exists(mock_service):
    mock_service.dynamo_service.get_active_restriction.return_value = {
        "ID": "existing-id",
    }

    with pytest.raises(
        UserRestrictionAlreadyExistsException,
        match="A restriction already exists for this user and patient",
    ):
        mock_service.create_restriction(
            restricted_smartcard_id=MOCK_SMART_CARD_ID,
            nhs_number=TEST_NHS_NUMBER,
            custodian=TEST_CURRENT_GP_ODS,
            creator=MOCK_CREATOR_ID,
        )

    mock_service.healthcare_service.get_practitioner.assert_not_called()
    mock_service.dynamo_service.create_restriction_item.assert_not_called()


def test_create_restriction_propagates_healthcare_worker_api_exception(mock_service):
    mock_service.healthcare_service.get_practitioner.side_effect = (
        HealthcareWorkerAPIException(status_code=404)
    )

    with pytest.raises(HealthcareWorkerAPIException):
        mock_service.create_restriction(
            restricted_smartcard_id=MOCK_SMART_CARD_ID,
            nhs_number=TEST_NHS_NUMBER,
            custodian=TEST_CURRENT_GP_ODS,
            creator=MOCK_CREATOR_ID,
        )

    mock_service.dynamo_service.create_restriction_item.assert_not_called()


def test_create_restriction_propagates_practitioner_model_exception(mock_service):
    mock_service.healthcare_service.get_practitioner.side_effect = (
        HealthcareWorkerPractitionerModelException()
    )

    with pytest.raises(HealthcareWorkerPractitionerModelException):
        mock_service.create_restriction(
            restricted_smartcard_id=MOCK_SMART_CARD_ID,
            nhs_number=TEST_NHS_NUMBER,
            custodian=TEST_CURRENT_GP_ODS,
            creator=MOCK_CREATOR_ID,
        )

    mock_service.dynamo_service.create_restriction_item.assert_not_called()
