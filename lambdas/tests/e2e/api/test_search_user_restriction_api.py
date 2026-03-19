import logging
import uuid

import pytest
import requests
from syrupy.filters import props

from tests.e2e.helpers.data_helper import UserRestrictionDataHelper
from tests.e2e.helpers.mockcis2_helper import MockCis2Helper

data_helper = UserRestrictionDataHelper()

TEST_ODS_CODE = "H81109"
TEST_NHS_NUMBER = "9449305943"
TEST_SMARTCARD_ID = "123456789012"
ANOTHER_SMARTCARD_ID = "323456789033"

EXCLUDE_IDS = props("id")


@pytest.fixture(scope="module")
def auth_token():
    login_helper = MockCis2Helper(ods=TEST_ODS_CODE, repository_role="gp_admin")
    login_helper.generate_mockcis2_token()
    return login_helper.user_token


def _headers(token: str) -> dict:
    return {"Authorization": f"{token}"}


def _build_restriction(
    restriction_id: str | None = None,
    ods_code: str = TEST_ODS_CODE,
    nhs_number: str = TEST_NHS_NUMBER,
    smartcard_id: str = TEST_SMARTCARD_ID,
    creator: str = ANOTHER_SMARTCARD_ID,
    is_active: bool = True,
) -> dict:
    return {
        "ID": restriction_id or str(uuid.uuid4()),
        "Custodian": ods_code,
        "NhsNumber": nhs_number,
        "RestrictedSmartcard": smartcard_id,
        "CreatorSmartcard": creator,
        "IsActive": is_active,
        "Created": 1700000000,
        "LastUpdated": 1700000001,
    }


@pytest.fixture
def test_restrictions():
    created = []
    yield created
    for record in created:
        data_helper.tidyup(record)


def test_search_user_restriction_returns_200_with_restrictions(
    test_restrictions,
    auth_token,
    snapshot_json,
):
    restriction = _build_restriction()
    data_helper.create_restriction(restriction)
    test_restrictions.append(restriction)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(url, headers=_headers(auth_token))

    logging.info(response.json())
    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json(exclude=EXCLUDE_IDS)


def test_search_user_restriction_filters_by_smartcard_id(
    test_restrictions,
    auth_token,
    snapshot_json,
):
    target_restriction = _build_restriction(smartcard_id=TEST_SMARTCARD_ID)
    other_restriction = _build_restriction(smartcard_id=ANOTHER_SMARTCARD_ID)

    data_helper.create_restriction(target_restriction)
    data_helper.create_restriction(other_restriction)
    test_restrictions.append(target_restriction)
    test_restrictions.append(other_restriction)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(
        url,
        headers=_headers(auth_token),
        params={"smartcardId": TEST_SMARTCARD_ID},
    )

    logging.info(response.json())
    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json(exclude=EXCLUDE_IDS)


def test_search_user_restriction_filters_by_nhs_number(
    test_restrictions,
    auth_token,
    snapshot_json,
):
    target_nhs = "9449305943"
    other_nhs = "9730136912"

    target_restriction = _build_restriction(nhs_number=target_nhs)
    other_restriction = _build_restriction(nhs_number=other_nhs)

    data_helper.create_restriction(target_restriction)
    data_helper.create_restriction(other_restriction)
    test_restrictions.append(target_restriction)
    test_restrictions.append(other_restriction)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(
        url,
        headers=_headers(auth_token),
        params={"nhsNumber": target_nhs},
    )

    logging.info(response.json())
    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json(exclude=EXCLUDE_IDS)


def test_search_user_restriction_returns_empty_list_when_no_matches(
    test_restrictions,
    auth_token,
    snapshot_json,
):
    non_existent_smartcard = f"NONEXISTENT_{uuid.uuid4().hex[:8]}"

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(
        url,
        headers=_headers(auth_token),
        params={"smartcardId": non_existent_smartcard},
    )

    logging.info(response.json())
    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json


def test_search_user_restriction_does_not_return_inactive_restrictions(
    test_restrictions,
    auth_token,
    snapshot_json,
):
    inactive_restriction = _build_restriction(is_active=False)
    data_helper.create_restriction(inactive_restriction)
    test_restrictions.append(inactive_restriction)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(
        url,
        headers=_headers(auth_token),
        params={"smartcardId": TEST_SMARTCARD_ID},
    )

    logging.info(response.json())
    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json


def test_search_user_restriction_paginates_with_limit_and_next_page_token(
    test_restrictions,
    auth_token,
    snapshot_json,
):
    restrictions = [_build_restriction() for _ in range(3)]
    for r in restrictions:
        data_helper.create_restriction(r)
        test_restrictions.append(r)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"

    response = requests.get(url, headers=_headers(auth_token), params={"limit": "2"})
    logging.info(response.json())
    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json(exclude=props("id", "nextPageToken"))

    if "nextPageToken" in body:
        next_response = requests.get(
            url,
            headers=_headers(auth_token),
            params={"limit": "2", "nextPageToken": body["nextPageToken"]},
        )
        assert next_response.status_code == 200
        next_body = next_response.json()
        assert next_body == snapshot_json(exclude=EXCLUDE_IDS)


def test_search_user_restriction_returns_401_without_auth(snapshot_json):
    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(url)

    logging.info(response.json())
    assert response.status_code == 401
    assert response.json() == snapshot_json
