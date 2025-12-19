import pytest
from enums.patient_ods_inactive_status import PatientOdsInactiveStatus
from tests.unit.conftest import TEST_CURRENT_GP_ODS
from utils.exceptions import OdsErrorException
from utils.ods_utils import (
    extract_ods_code_from_request_context,
    extract_ods_role_code_with_r_prefix_from_role_codes_string,
    is_ods_code_active,
)


@pytest.fixture()
def mocked_request_context_with_ods(mocker):
    mocked_context = mocker.MagicMock()
    mocked_context.authorization = {
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS},
    }
    yield mocker.patch("utils.ods_utils.request_context", mocked_context)


@pytest.mark.parametrize(
    "ods_code,expected",
    [
        ["H81109", True],
        [PatientOdsInactiveStatus.SUSPENDED, False],
        [PatientOdsInactiveStatus.DECEASED, False],
        ["", False],
        [None, False],
    ],
)
def test_is_ods_code_active(ods_code, expected):
    actual = is_ods_code_active(ods_code)

    assert actual == expected


@pytest.mark.parametrize(
    "role_code, expected",
    [
        ("S8001:G8005:R8000", "R8000"),
        ("S8001:G8005:R8015", "R8015"),
        ("S8001:G8005:R8008", "R8008"),
    ],
)
def test_process_role_code_returns_correct_role(role_code, expected):
    assert (
        extract_ods_role_code_with_r_prefix_from_role_codes_string(role_code)
        == expected
    )


def test_get_ods_code_from_request(mocked_request_context_with_ods):

    assert extract_ods_code_from_request_context() == TEST_CURRENT_GP_ODS


def test_get_ods_code_from_request_throws_exception_no_auth(mocker):
    mocker.patch("utils.ods_utils.request_context", {})

    with pytest.raises(OdsErrorException):
        extract_ods_code_from_request_context()