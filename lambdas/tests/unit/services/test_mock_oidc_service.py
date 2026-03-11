import json
import time
from urllib.parse import quote

import pytest

from enums.repository_role import RepositoryRole
from models.oidc_models import AccessToken, IdTokenClaimSet
from services.mock_oidc_service import MockOidcService
from tests.unit.conftest import TEST_CURRENT_GP_ODS, TEST_UUID
from utils.exceptions import OidcApiException
from utils.request_context import request_context

MOCK_SSM_PREFIX = "/auth/mock/"
MOCK_KEY = "test_secret_key"
MOCK_ODS_CODE = TEST_CURRENT_GP_ODS
MOCK_REPOSITORY_ROLE = RepositoryRole.GP_ADMIN.value
MOCK_SMARTCARD_ID = TEST_UUID
MOCK_ROLE_CODE = "R8000"
MOCK_ROLE_CODE_STRING = f"{MOCK_ROLE_CODE},R8001"


def make_auth_code(key: str = MOCK_KEY, extra: dict = None) -> str:
    payload = {"key": key}
    if extra:
        payload.update(extra)
    return quote(json.dumps(payload))


def make_access_token(
    ods_code: str = MOCK_ODS_CODE,
    repository_role: str = MOCK_REPOSITORY_ROLE,
    smartcard_id: str = MOCK_SMARTCARD_ID,
) -> AccessToken:
    payload = {
        "odsCode": ods_code,
        "repositoryRole": repository_role,
        "smartcardId": smartcard_id,
    }
    return quote(json.dumps(payload))


@pytest.fixture(autouse=True)
def set_auth_ssm_prefix():
    request_context.auth_ssm_prefix = MOCK_SSM_PREFIX
    yield
    try:
        delattr(request_context, "auth_ssm_prefix")
    except AttributeError:
        pass


@pytest.fixture
def mock_service(mocker):
    mocker.patch("services.mock_oidc_service.SSMService")
    service = MockOidcService()
    service.ssm_service = mocker.MagicMock()
    yield service


def test_fetch_tokens_returns_access_token_and_id_token_claimset_when_key_matches(
    mock_service,
):
    mock_service.ssm_service.get_ssm_parameter.return_value = MOCK_KEY
    auth_code = make_auth_code(key=MOCK_KEY)

    access_token, id_token_claimset = mock_service.fetch_tokens(auth_code)

    assert access_token == auth_code
    assert isinstance(id_token_claimset, IdTokenClaimSet)
    assert id_token_claimset.sub == "MOCK_SUB"
    assert id_token_claimset.sid == "MOCK_SID"
    assert id_token_claimset.selected_roleid == "MOCK_SELECTED_ROLEID"


def test_fetch_tokens_expiry_is_roughly_30_minutes_in_the_future(mock_service):
    mock_service.ssm_service.get_ssm_parameter.return_value = MOCK_KEY
    auth_code = make_auth_code(key=MOCK_KEY)

    _, id_token_claimset = mock_service.fetch_tokens(auth_code)

    expected_expiry = int(time.time()) + 30 * 60
    assert abs(id_token_claimset.exp - expected_expiry) < 5


def test_fetch_tokens_looks_up_ssm_with_correct_key(mock_service):
    mock_service.ssm_service.get_ssm_parameter.return_value = MOCK_KEY
    auth_code = make_auth_code(key=MOCK_KEY)

    mock_service.fetch_tokens(auth_code)

    mock_service.ssm_service.get_ssm_parameter.assert_called_once_with(
        MOCK_SSM_PREFIX + "MOCK_KEY",
    )


def test_fetch_tokens_raises_oidc_exception_when_key_does_not_match(mock_service):
    mock_service.ssm_service.get_ssm_parameter.return_value = "wrong_key"
    auth_code = make_auth_code(key=MOCK_KEY)

    with pytest.raises(OidcApiException):
        mock_service.fetch_tokens(auth_code)


def test_fetch_tokens_url_decodes_auth_code_before_parsing(mock_service):
    mock_service.ssm_service.get_ssm_parameter.return_value = MOCK_KEY
    url_encoded_auth_code = quote(json.dumps({"key": MOCK_KEY}))

    access_token, _ = mock_service.fetch_tokens(url_encoded_auth_code)

    assert access_token == url_encoded_auth_code


def test_fetch_userinfo_returns_correct_user_info(mock_service):
    mock_service.ssm_service.get_ssm_parameter.return_value = MOCK_ROLE_CODE_STRING
    access_token = make_access_token()

    result = mock_service.fetch_userinfo(access_token)

    roles = result["nhsid_nrbac_roles"]
    assert "nhsid_nrbac_roles" in result
    assert "nhsid_useruid" in result
    assert len(roles) == 1
    assert roles[0]["org_code"] == MOCK_ODS_CODE
    assert roles[0]["role_code"] == MOCK_ROLE_CODE
    assert roles[0]["person_roleid"] == "MOCK_SELECTED_ROLEID"


def test_fetch_userinfo_uses_provided_smartcard_id(mock_service):
    mock_service.ssm_service.get_ssm_parameter.return_value = MOCK_ROLE_CODE_STRING
    access_token = make_access_token(smartcard_id=MOCK_SMARTCARD_ID)

    result = mock_service.fetch_userinfo(access_token)

    assert result["nhsid_useruid"] == MOCK_SMARTCARD_ID


def test_fetch_userinfo_generates_random_uid_when_smartcard_id_is_empty(mock_service):
    mock_service.ssm_service.get_ssm_parameter.return_value = MOCK_ROLE_CODE_STRING
    access_token = make_access_token(smartcard_id="")

    result = mock_service.fetch_userinfo(access_token)

    uid = result["nhsid_useruid"]
    assert uid != ""
    assert uid.isdigit()
    assert 100_000_000_000 <= int(uid) <= 999_999_999_999


def test_fetch_userinfo_looks_up_role_code_via_ssm(mock_service):
    mock_service.ssm_service.get_ssm_parameter.return_value = MOCK_ROLE_CODE_STRING
    access_token = make_access_token(repository_role=MOCK_REPOSITORY_ROLE)

    mock_service.fetch_userinfo(access_token)

    mock_service.ssm_service.get_ssm_parameter.assert_called_once_with(
        f"/auth/smartcard/role/{MOCK_REPOSITORY_ROLE}",
    )


def test_fetch_userinfo_uses_first_role_code_from_comma_separated_list(mock_service):
    mock_service.ssm_service.get_ssm_parameter.return_value = "R0001,R0002,R0003"
    access_token = make_access_token()

    result = mock_service.fetch_userinfo(access_token)

    assert result["nhsid_nrbac_roles"][0]["role_code"] == "R0001"


def test_fetch_userinfo_raises_oidc_exception_when_access_token_missing_key(
    mock_service,
):
    incomplete_payload = {"odsCode": MOCK_ODS_CODE}
    access_token = quote(json.dumps(incomplete_payload))

    with pytest.raises(OidcApiException):
        mock_service.fetch_userinfo(access_token)


def test_fetch_userinfo_url_decodes_access_token_before_parsing(mock_service):
    mock_service.ssm_service.get_ssm_parameter.return_value = MOCK_ROLE_CODE_STRING
    access_token = make_access_token()

    result = mock_service.fetch_userinfo(access_token)

    assert result is not None
