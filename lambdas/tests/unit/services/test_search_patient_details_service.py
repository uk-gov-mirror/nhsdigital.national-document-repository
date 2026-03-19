from unittest.mock import MagicMock, patch

import pytest

from enums.repository_role import RepositoryRole
from models.pds_models import PatientDetails
from services.search_patient_details_service import SearchPatientDetailsService
from tests.unit.conftest import TEST_UUID
from utils.exceptions import (
    InvalidResourceIdException,
    PatientNotFoundException,
    PdsErrorException,
    UserNotAuthorisedException,
)
from utils.lambda_exceptions import SearchPatientException
from utils.request_context import request_context

MOCK_USER_ID = "test-user-id"

USER_VALID_ODS_CODE = "X12345"
USER_INVALID_ODS_CODE = "X54321"
EMPTY_ODS_CODE = ""
NHS_NUMBER = "9000000009"


@pytest.fixture
def mock_patient_details():
    return PatientDetails(
        givenName=["John"],
        familyName="Doe",
        birthDate="1980-01-01",
        postalCode="AB1 2CD",
        nhsNumber=NHS_NUMBER,
        superseded=False,
        restricted=False,
        generalPracticeOds=USER_VALID_ODS_CODE,
        active=True,
        deceased=False,
        deathNotificationStatus=None,
    )


@pytest.fixture
def mock_deceased_patient_details():
    return PatientDetails(
        givenName=["John"],
        familyName="Doe",
        birthDate="1980-01-01",
        postalCode="AB1 2CD",
        nhsNumber=NHS_NUMBER,
        superseded=False,
        restricted=False,
        generalPracticeOds=USER_VALID_ODS_CODE,
        active=True,
        deceased=True,
    )


@pytest.fixture
def setup_request_context():
    request_context.authorization = {
        "ndr_session_id": TEST_UUID,
        "nhs_user_id": MOCK_USER_ID,
        "selected_organisation": {"org_ods_code": "test-ods-code"},
    }
    yield
    request_context.authorization = {}


@pytest.fixture
def mock_check_user_restriction():
    with patch.object(
        SearchPatientDetailsService,
        "_check_user_restriction",
    ) as mock_check:
        yield mock_check


@pytest.fixture
def mock_pds_service_fetch(mock_patient_details):
    with patch("services.search_patient_details_service.get_pds_service") as mock:
        mock_pds = MagicMock()
        mock_pds.fetch_patient_details.return_value = mock_patient_details
        mock.return_value = mock_pds
        yield mock_pds.fetch_patient_details


@pytest.fixture
def mock_check_if_user_authorise():
    with patch.object(
        SearchPatientDetailsService,
        "_check_authorization",
    ) as mock_check:
        yield mock_check


@pytest.fixture
def mock_update_session():
    with patch.object(SearchPatientDetailsService, "_update_session") as mock_update:
        yield mock_update


@pytest.fixture
def mock_restriction_service(mocker):
    mock_restriction_cls = mocker.patch(
        "services.search_patient_details_service.UserRestrictionDynamoService",
    )
    mock_restriction_cls.return_value.check_user_restriction.return_value = False
    yield mock_restriction_cls.return_value


@pytest.fixture
def mock_service(request, mocker, setup_request_context, mock_restriction_service):
    role, ods_code = (
        request.param
        if hasattr(request, "param")
        else (
            "GP_ADMIN",
            USER_VALID_ODS_CODE,
        )
    )
    mocker.patch("services.search_patient_details_service.ManageUserSessionAccess")
    yield SearchPatientDetailsService(role, ods_code)


@pytest.mark.parametrize(
    "mock_service",
    (("GP_ADMIN", USER_VALID_ODS_CODE),),
    indirect=True,
)
def test_handle_search_patient_request_returns_patient_details(
    mock_service,
    mock_patient_details,
    mock_pds_service_fetch,
    mock_check_if_user_authorise,
    mock_check_user_restriction,
    mock_update_session,
):
    # Act
    result = mock_service.handle_search_patient_request(NHS_NUMBER)

    # Assert
    mock_pds_service_fetch.assert_called_with(NHS_NUMBER)
    mock_check_user_restriction.assert_called_once_with(NHS_NUMBER)
    mock_check_if_user_authorise.assert_called_once()
    mock_update_session.assert_called_once()
    assert result == mock_patient_details


@pytest.mark.parametrize(
    "mock_service",
    (("GP_ADMIN", USER_VALID_ODS_CODE),),
    indirect=True,
)
def test_handle_search_patient_request_with_update_session_false(
    mock_service,
    mock_patient_details,
    mock_pds_service_fetch,
    mock_check_if_user_authorise,
    mock_check_user_restriction,
    mock_update_session,
):
    # Act
    result = mock_service.handle_search_patient_request(
        NHS_NUMBER,
        update_session=False,
    )

    # Assert
    mock_pds_service_fetch.assert_called_with(NHS_NUMBER)
    mock_check_if_user_authorise.assert_called_once()
    mock_update_session.assert_not_called()
    assert result == mock_patient_details


@pytest.mark.parametrize(
    "mock_service",
    (("GP_ADMIN", USER_VALID_ODS_CODE),),
    indirect=True,
)
def test_handle_search_patient_deceased_skips_authorization_check(
    mock_service,
    mock_deceased_patient_details,
    mock_pds_service_fetch,
    mock_check_if_user_authorise,
    mock_check_user_restriction,
    mock_update_session,
):
    # Arrange
    mock_pds_service_fetch.return_value = mock_deceased_patient_details

    # Act
    result = mock_service.handle_search_patient_request(NHS_NUMBER)

    # Assert
    mock_pds_service_fetch.assert_called_with(NHS_NUMBER)
    mock_check_if_user_authorise.assert_not_called()
    mock_update_session.assert_called_once()
    assert result == mock_deceased_patient_details


@pytest.mark.parametrize(
    "mock_service",
    (("GP_ADMIN", USER_VALID_ODS_CODE), ("GP_ADMIN", EMPTY_ODS_CODE)),
    indirect=True,
)
def test_handle_search_patient_request_raise_error_when_patient_not_found(
    mock_service,
    mock_pds_service_fetch,
    mock_check_if_user_authorise,
    mock_check_user_restriction,
    mock_update_session,
):
    # Arrange
    mock_pds_service_fetch.side_effect = PatientNotFoundException()

    # Act & Assert
    with pytest.raises(SearchPatientException):
        mock_service.handle_search_patient_request(NHS_NUMBER)

    mock_pds_service_fetch.assert_called_with(NHS_NUMBER)
    mock_check_user_restriction.assert_called_once_with(NHS_NUMBER)
    mock_check_if_user_authorise.assert_not_called()
    mock_update_session.assert_not_called()


@pytest.mark.parametrize(
    "mock_service",
    (("GP_ADMIN", USER_VALID_ODS_CODE), ("GP_ADMIN", EMPTY_ODS_CODE)),
    indirect=True,
)
def test_handle_search_patient_request_raise_error_when_invalid_patient(
    mock_service,
    mock_pds_service_fetch,
    mock_check_if_user_authorise,
    mock_check_user_restriction,
    mock_update_session,
):
    # Arrange
    mock_pds_service_fetch.side_effect = InvalidResourceIdException()

    # Act & Assert
    with pytest.raises(SearchPatientException):
        mock_service.handle_search_patient_request(NHS_NUMBER)

    mock_pds_service_fetch.assert_called_with(NHS_NUMBER)
    mock_check_user_restriction.assert_called_once_with(NHS_NUMBER)
    mock_check_if_user_authorise.assert_not_called()
    mock_update_session.assert_not_called()


@pytest.mark.parametrize(
    "mock_service",
    (("GP_ADMIN", USER_VALID_ODS_CODE), ("GP_ADMIN", EMPTY_ODS_CODE)),
    indirect=True,
)
def test_handle_search_patient_request_raise_error_when_pds_error(
    mock_service,
    mock_pds_service_fetch,
    mock_check_if_user_authorise,
    mock_check_user_restriction,
    mock_update_session,
):
    # Arrange
    mock_pds_service_fetch.side_effect = PdsErrorException("PDS Error")

    # Act & Assert
    with pytest.raises(SearchPatientException):
        mock_service.handle_search_patient_request(NHS_NUMBER)

    mock_pds_service_fetch.assert_called_with(NHS_NUMBER)
    mock_check_user_restriction.assert_called_once_with(NHS_NUMBER)
    mock_check_if_user_authorise.assert_not_called()
    mock_update_session.assert_not_called()


@pytest.mark.parametrize(
    "mock_service",
    (("GP_ADMIN", USER_VALID_ODS_CODE), ("GP_ADMIN", EMPTY_ODS_CODE)),
    indirect=True,
)
def test_handle_search_patient_request_raise_error_when_validation_error(
    mock_service,
    mock_pds_service_fetch,
    mock_check_if_user_authorise,
    mock_check_user_restriction,
    mock_update_session,
    validation_error,
):
    # Arrange
    mock_pds_service_fetch.side_effect = validation_error

    # Act & Assert
    with pytest.raises(SearchPatientException):
        mock_service.handle_search_patient_request(NHS_NUMBER)

    mock_pds_service_fetch.assert_called_with(NHS_NUMBER)
    mock_check_user_restriction.assert_called_once_with(NHS_NUMBER)
    mock_check_if_user_authorise.assert_not_called()
    mock_update_session.assert_not_called()


@pytest.mark.parametrize(
    "mock_service",
    (("GP_ADMIN", USER_VALID_ODS_CODE),),
    indirect=True,
)
def test_handle_search_patient_request_raise_error_when_user_not_authorised(
    mock_service,
    mock_patient_details,
    mock_pds_service_fetch,
    mock_check_if_user_authorise,
    mock_check_user_restriction,
    mock_update_session,
):
    # Arrange
    mock_check_if_user_authorise.side_effect = UserNotAuthorisedException()

    # Act & Assert
    with pytest.raises(SearchPatientException):
        mock_service.handle_search_patient_request(NHS_NUMBER)

    mock_pds_service_fetch.assert_called_with(NHS_NUMBER)
    mock_check_if_user_authorise.assert_called_once()
    mock_update_session.assert_not_called()


@pytest.mark.parametrize(
    "user_role, user_ods, patient_ods, patient_active, can_access_not_my_record, exception_expected",
    [
        # GP_ADMIN tests / can access not my record flag true
        (
            # ods code match, active patient // no exception
            RepositoryRole.GP_ADMIN.value,
            USER_VALID_ODS_CODE,
            USER_VALID_ODS_CODE,
            True,
            True,
            False,
        ),
        (
            # ods code mismatch, active patient // no exception
            RepositoryRole.GP_ADMIN.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            True,
            True,
            False,
        ),
        (
            # ods code mismatch, inactive patient // no exception
            RepositoryRole.GP_ADMIN.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            False,
            True,
            False,
        ),
        # GP_ADMIN tests / can access not my record flag false
        (
            # ods code match, active patient // no exception
            RepositoryRole.GP_ADMIN.value,
            USER_VALID_ODS_CODE,
            USER_VALID_ODS_CODE,
            True,
            False,
            False,
        ),
        (
            # ods code mismatch, active patient // exception
            RepositoryRole.GP_ADMIN.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            True,
            False,
            True,
        ),
        (
            # ods code mismatch, inactive patient // exception
            RepositoryRole.GP_ADMIN.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            False,
            False,
            True,
        ),
        # GP_CLINICAL tests / can access not my record flag true
        (
            # ods code match, active patient // no exception
            RepositoryRole.GP_CLINICAL.value,
            USER_VALID_ODS_CODE,
            USER_VALID_ODS_CODE,
            True,
            True,
            False,
        ),
        (
            # ods code mismatch, active patient // no exception
            RepositoryRole.GP_CLINICAL.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            True,
            True,
            False,
        ),
        (
            # ods code mismatch, inactive patient // no exception
            RepositoryRole.GP_CLINICAL.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            False,
            True,
            False,
        ),
        # GP_CLINICAL tests / can access not my record flag false
        (
            # ods code match, active patient // no exception
            RepositoryRole.GP_CLINICAL.value,
            USER_VALID_ODS_CODE,
            USER_VALID_ODS_CODE,
            True,
            False,
            False,
        ),
        (
            # ods code mismatch, active patient // exception
            RepositoryRole.GP_CLINICAL.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            True,
            False,
            True,
        ),
        (
            # ods code mismatch, inactive patient // exception
            RepositoryRole.GP_CLINICAL.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            False,
            False,
            True,
        ),
        # PCSE tests // can access not my record flag true
        (
            # ods mismatch, active patient // exception
            RepositoryRole.PCSE.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            True,
            True,
            True,
        ),
        (
            # ods mismatch, inactive patient // no exception
            RepositoryRole.PCSE.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            False,
            True,
            False,
        ),
        # PCSE tests // can access not my record flag false
        (
            # ods mismatch, active patient // exception
            RepositoryRole.PCSE.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            True,
            False,
            True,
        ),
        (
            # ods mismatch, inactive patient // no exception
            RepositoryRole.PCSE.value,
            USER_VALID_ODS_CODE,
            USER_INVALID_ODS_CODE,
            False,
            False,
            False,
        ),
        # Unknown role
        ("UNKNOWN_ROLE", USER_VALID_ODS_CODE, USER_VALID_ODS_CODE, True, True, True),
    ],
)
def test_check_authorization(
    user_role,
    user_ods,
    patient_ods,
    patient_active,
    exception_expected,
    can_access_not_my_record,
):
    with patch(
        "services.search_patient_details_service.ManageUserSessionAccess",
    ), patch(
        "services.search_patient_details_service.is_ods_code_active",
    ) as mock_is_active:
        mock_is_active.return_value = patient_active
        service = SearchPatientDetailsService(user_role, user_ods)
        if exception_expected:
            with pytest.raises(UserNotAuthorisedException):
                service._check_authorization(patient_ods, can_access_not_my_record)
        else:
            service._check_authorization(patient_ods, can_access_not_my_record)


def test_updates_session_with_correct_parameters(mock_service):

    mock_service._update_session("1234567890", True)

    mock_service.manage_user_session_service.update_auth_session_with_permitted_search.assert_called_once_with(
        user_role="GP_ADMIN",
        nhs_number="1234567890",
        write_to_deceased_column=True,
    )


def test_check_user_restriction_passes_when_no_restriction_found(
    mock_service,
    mock_restriction_service,
):
    mock_service._check_user_restriction(NHS_NUMBER)

    mock_restriction_service.check_user_restriction.assert_called_once_with(
        nhs_number=NHS_NUMBER,
        smartcard_id=MOCK_USER_ID,
    )


def test_check_user_restriction_raises_exception_when_restriction_found(
    mock_service,
    mock_restriction_service,
):
    mock_restriction_service.check_user_restriction.return_value = True

    with pytest.raises(SearchPatientException):
        mock_service._check_user_restriction(NHS_NUMBER)


def test_check_user_restriction_raises_exception_when_nhs_user_id_missing(
    mocker,
    setup_request_context,
):
    request_context.authorization = {"ndr_session_id": TEST_UUID}
    mocker.patch("services.search_patient_details_service.ManageUserSessionAccess")
    mocker.patch("services.search_patient_details_service.UserRestrictionDynamoService")
    service = SearchPatientDetailsService("GP_ADMIN", USER_VALID_ODS_CODE)

    with pytest.raises(SearchPatientException):
        service._check_user_restriction(NHS_NUMBER)


@pytest.mark.parametrize(
    "mock_service",
    (("GP_ADMIN", USER_VALID_ODS_CODE),),
    indirect=True,
)
def test_handle_search_patient_request_raises_exception_when_user_is_restricted(
    mock_service,
    mock_restriction_service,
    mock_pds_service_fetch,
    mock_check_if_user_authorise,
    mock_update_session,
):
    mock_restriction_service.check_user_restriction.return_value = True

    with pytest.raises(SearchPatientException):
        mock_service.handle_search_patient_request(NHS_NUMBER)

    mock_pds_service_fetch.assert_not_called()
    mock_check_if_user_authorise.assert_not_called()
    mock_update_session.assert_not_called()
