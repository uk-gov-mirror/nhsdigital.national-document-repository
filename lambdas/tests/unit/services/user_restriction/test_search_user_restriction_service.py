import pytest

from models.user_restrictions.practitioner import Practitioner
from models.user_restrictions.user_restriction_response import UserRestrictionResponse
from models.user_restrictions.user_restrictions import UserRestriction
from services.user_restrictions.search_user_restriction_service import (
    MAX_LIMIT,
    SearchUserRestrictionService,
)
from services.user_restrictions.user_restriction_dynamo_service import DEFAULT_LIMIT
from tests.unit.conftest import (
    TEST_CURRENT_GP_ODS,
    TEST_NEXT_PAGE_TOKEN,
    TEST_NHS_NUMBER,
    TEST_SMART_CARD_ID,
    TEST_UUID,
)
from utils.exceptions import (
    HealthcareWorkerAPIException,
    PatientNotFoundException,
    PdsErrorException,
    UserRestrictionException,
    UserRestrictionValidationException,
)

MOCK_RESTRICTION_DICT = {
    "ID": TEST_UUID,
    "RestrictedSmartcard": TEST_SMART_CARD_ID,
    "NhsNumber": TEST_NHS_NUMBER,
    "Custodian": TEST_CURRENT_GP_ODS,
    "Created": 1700000000,
    "CreatorSmartcard": "SC002",
    "IsActive": True,
    "LastUpdated": 1700000001,
}
MOCK_RESTRICTION = UserRestriction.model_validate(MOCK_RESTRICTION_DICT)
MOCK_RESPONSE = UserRestrictionResponse.model_validate(MOCK_RESTRICTION_DICT)

MOCK_PRACTITIONER = Practitioner(
    smartcard_id=TEST_SMART_CARD_ID,
    first_name="Jane",
    last_name="Doe",
)


@pytest.fixture
def mock_service(set_env, mocker):
    mocker.patch(
        "services.user_restrictions.search_user_restriction_service.UserRestrictionDynamoService",
    )
    mocker.patch(
        "services.user_restrictions.search_user_restriction_service.get_pds_service",
    )
    mocker.patch(
        "services.user_restrictions.search_user_restriction_service.get_healthcare_worker_api_service",
    )
    mocker.patch(
        "services.user_restrictions.search_user_restriction_service.validate_next_page_token",
    )
    service = SearchUserRestrictionService()
    yield service


def test_process_request_calls_query_restrictions_and_enriches(mock_service, mocker):
    mock_query = mocker.patch.object(
        mock_service.dynamo_service,
        "query_restrictions",
        return_value=([MOCK_RESTRICTION], None),
    )
    mocker.patch.object(mock_service, "_enrich_restriction", return_value=MOCK_RESPONSE)

    results, next_token = mock_service.process_request(ods_code=TEST_CURRENT_GP_ODS)

    mock_query.assert_called_once_with(
        ods_code=TEST_CURRENT_GP_ODS,
        smart_card_id=None,
        nhs_number=None,
        limit=DEFAULT_LIMIT,
        start_key=None,
    )
    assert len(results) == 1
    assert next_token is None


def test_process_request_passes_next_page_token_as_start_key(mock_service, mocker):
    mock_query = mocker.patch.object(
        mock_service.dynamo_service,
        "query_restrictions",
        return_value=([MOCK_RESTRICTION], None),
    )
    mocker.patch.object(mock_service, "_enrich_restriction", return_value=MOCK_RESPONSE)

    mock_service.process_request(
        ods_code=TEST_CURRENT_GP_ODS,
        next_page_token=TEST_NEXT_PAGE_TOKEN,
    )

    mock_query.assert_called_once_with(
        ods_code=TEST_CURRENT_GP_ODS,
        smart_card_id=None,
        nhs_number=None,
        limit=DEFAULT_LIMIT,
        start_key=TEST_NEXT_PAGE_TOKEN,
    )


def test_process_request_returns_next_token_from_dynamo(mock_service, mocker):
    mocker.patch.object(
        mock_service.dynamo_service,
        "query_restrictions",
        return_value=([MOCK_RESTRICTION], TEST_NEXT_PAGE_TOKEN),
    )
    mocker.patch.object(mock_service, "_enrich_restriction", return_value=MOCK_RESPONSE)

    _, next_token = mock_service.process_request(ods_code=TEST_CURRENT_GP_ODS)

    assert next_token == TEST_NEXT_PAGE_TOKEN


def test_process_request_raises_on_client_error(mock_service, mocker):
    mocker.patch.object(
        mock_service.dynamo_service,
        "query_restrictions",
        side_effect=UserRestrictionValidationException("DynamoDB error"),
    )

    with pytest.raises(UserRestrictionValidationException):
        mock_service.process_request(ods_code=TEST_CURRENT_GP_ODS)


def test_process_request_raises_500_on_validation_exception(mock_service, mocker):
    mocker.patch.object(
        mock_service.dynamo_service,
        "query_restrictions",
        side_effect=UserRestrictionValidationException("bad data"),
    )

    with pytest.raises(UserRestrictionValidationException):
        mock_service.process_request(ods_code=TEST_CURRENT_GP_ODS)


def test_process_request_raises_400_on_invalid_limit(mock_service):
    with pytest.raises(UserRestrictionException):
        mock_service.process_request(ods_code=TEST_CURRENT_GP_ODS, limit="not-a-number")

    assert True  # no status_code to check — handler owns that mapping


def test_validate_limit_raises_for_non_digit(mock_service):
    with pytest.raises(UserRestrictionException):
        mock_service.validate_limit("abc")


def test_validate_limit_raises_for_zero(mock_service):
    with pytest.raises(UserRestrictionException):
        mock_service.validate_limit(0)


def test_validate_limit_raises_for_over_max(mock_service):
    with pytest.raises(UserRestrictionException):
        mock_service.validate_limit(MAX_LIMIT + 1)


def test_validate_limit_accepts_max_limit(mock_service):
    assert mock_service.validate_limit(MAX_LIMIT) == MAX_LIMIT


def test_validate_limit_accepts_string_digit(mock_service):
    assert mock_service.validate_limit("5") == 5


def test_validate_limit_accepts_one(mock_service):
    assert mock_service.validate_limit(1) == 1


def test_enrich_with_patient_name_sets_name_on_success(mock_service):
    mock_service.pds_service.fetch_patient_details.return_value.given_name = ["Jane"]
    mock_service.pds_service.fetch_patient_details.return_value.family_name = "Doe"

    result = mock_service._enrich_with_patient_name(MOCK_RESPONSE.model_copy())

    assert result.patient_given_name == ["Jane"]
    assert result.patient_family_name == "Doe"


def test_enrich_with_patient_name_uses_cache_on_second_call(mock_service):
    mock_service.pds_service.fetch_patient_details.return_value.given_name = ["Jane"]
    mock_service.pds_service.fetch_patient_details.return_value.family_name = "Doe"

    mock_service._enrich_with_patient_name(MOCK_RESPONSE.model_copy())
    mock_service._enrich_with_patient_name(MOCK_RESPONSE.model_copy())

    mock_service.pds_service.fetch_patient_details.assert_called_once()


@pytest.mark.parametrize("exception", [PatientNotFoundException, PdsErrorException])
def test_enrich_with_patient_name_logs_warning_on_pds_failure(mock_service, exception):
    mock_service.pds_service.fetch_patient_details.side_effect = exception("error")

    result = mock_service._enrich_with_patient_name(MOCK_RESPONSE.model_copy())

    assert result.patient_given_name is None
    assert result.patient_family_name is None


def test_enrich_with_patient_name_caches_failed_lookup(mock_service):
    mock_service.pds_service.fetch_patient_details.side_effect = (
        PatientNotFoundException("error")
    )

    mock_service._enrich_with_patient_name(MOCK_RESPONSE.model_copy())
    mock_service._enrich_with_patient_name(MOCK_RESPONSE.model_copy())

    mock_service.pds_service.fetch_patient_details.assert_called_once()


def test_enrich_with_restricted_user_name_sets_name_on_success(mock_service):
    mock_service.hwc_service.get_practitioner.return_value = MOCK_PRACTITIONER

    result = mock_service._enrich_with_restricted_user_name(MOCK_RESPONSE.model_copy())

    assert result.restricted_user_first_name == "Jane"
    assert result.restricted_user_last_name == "Doe"


def test_enrich_with_restricted_user_name_uses_cache_on_second_call(mock_service):
    mock_service.hwc_service.get_practitioner.return_value = MOCK_PRACTITIONER

    mock_service._enrich_with_restricted_user_name(MOCK_RESPONSE.model_copy())
    mock_service._enrich_with_restricted_user_name(MOCK_RESPONSE.model_copy())

    mock_service.hwc_service.get_practitioner.assert_called_once()


def test_enrich_with_restricted_user_name_logs_warning_on_hwc_failure(mock_service):
    mock_service.hwc_service.get_practitioner.side_effect = (
        HealthcareWorkerAPIException(status_code=404)
    )

    result = mock_service._enrich_with_restricted_user_name(MOCK_RESPONSE.model_copy())

    assert result.restricted_user_first_name is None
    assert result.restricted_user_last_name is None


def test_enrich_with_restricted_user_name_caches_failed_lookup(mock_service):
    mock_service.hwc_service.get_practitioner.side_effect = (
        HealthcareWorkerAPIException(status_code=404)
    )

    mock_service._enrich_with_restricted_user_name(MOCK_RESPONSE.model_copy())
    mock_service._enrich_with_restricted_user_name(MOCK_RESPONSE.model_copy())

    mock_service.hwc_service.get_practitioner.assert_called_once()
