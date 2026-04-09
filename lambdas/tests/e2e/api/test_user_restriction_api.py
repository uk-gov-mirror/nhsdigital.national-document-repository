import logging
import os
import uuid

import pytest
import requests
from syrupy.filters import props

from tests.e2e.helpers.data_helper import UserRestrictionDataHelper
from tests.e2e.helpers.mockcis2_helper import MockCis2Helper

TEST_ODS_CODE = "H81109"
ANOTHER_ODS_CODE = "M85143"
TEST_NHS_NUMBER = "9449305943"
ANOTHER_NHS_NUMBER = "9730153760"

RESTRICTED_SMARTCARD_ID = "123456789012"
ADMIN_SMARTCARD_ID = "323456789033"

MOCK_HCW_API_ERROR_SMARTCARD_ID = "333333333333"

pytestmark = pytest.mark.skipif(
    os.environ.get("AWS_WORKSPACE") == "pre-prod",
    reason="CIS2 login is not mocked in pre-prod",
)

EXCLUDE_IDS = props("id", "interaction_id")


@pytest.fixture
def data_helper():
    return UserRestrictionDataHelper()


@pytest.fixture
def get_token():
    def _make_token(smartcard_id: str, ods: str = TEST_ODS_CODE) -> str:
        helper = MockCis2Helper(
            ods=ods,
            repository_role="gp_admin",
            smartcard_id=smartcard_id,
        )
        helper.generate_mockcis2_token()
        return helper.user_token

    return _make_token


def _headers(token: str) -> dict:
    return {"Authorization": f"{token}"}


def _search_patient(api_endpoint: str, token: str, nhs_number: str = TEST_NHS_NUMBER):
    url = f"https://{api_endpoint}/SearchPatient"
    return requests.get(url, headers=_headers(token), params={"patientId": nhs_number})


def _create_restriction(
    api_endpoint: str,
    token: str,
    smartcard_id: str = RESTRICTED_SMARTCARD_ID,
    nhs_number: str = TEST_NHS_NUMBER,
):
    """Call POST /UserRestriction to create a new active restriction."""
    url = f"https://{api_endpoint}/UserRestriction"
    body = {"smartcardId": smartcard_id, "nhsNumber": nhs_number}
    return requests.post(
        url,
        headers=_headers(token),
        params={"patientId": nhs_number},
        json=body,
    )


def _remove_restriction(
    api_endpoint: str,
    token: str,
    restriction_id: str,
    nhs_number: str = TEST_NHS_NUMBER,
):
    """Call PATCH /UserRestriction/{id}?patientId={nhs_number} to deactivate a restriction."""
    url = f"https://{api_endpoint}/UserRestriction/{restriction_id}"
    return requests.patch(
        url,
        headers=_headers(token),
        params={"patientId": nhs_number},
    )


def _list_restrictions(
    api_endpoint: str,
    token: str,
    smartcard_id: str | None = None,
    nhs_number: str | None = None,
    limit: int | None = None,
    next_page_token: str | None = None,
):
    """Call GET /UserRestriction with any combination of supported query parameters."""
    url = f"https://{api_endpoint}/UserRestriction"
    params = {}
    if smartcard_id is not None:
        params["smartcardId"] = smartcard_id
    if nhs_number is not None:
        params["nhsNumber"] = nhs_number
    if limit is not None:
        params["limit"] = limit
    if next_page_token is not None:
        params["nextPageToken"] = next_page_token
    return requests.get(url, headers=_headers(token), params=params)


def _get_user_info(
    api_endpoint: str,
    token: str,
    identifier: str = RESTRICTED_SMARTCARD_ID,
):
    """Call GET /UserRestriction/UserSearch to look up a practitioner by smartcard identifier."""
    url = f"https://{api_endpoint}/UserRestriction/SearchUser"
    return requests.get(url, headers=_headers(token), params={"identifier": identifier})


def _build_restriction(
    restriction_id: str | None = None,
    ods_code: str = TEST_ODS_CODE,
    nhs_number: str = TEST_NHS_NUMBER,
    smartcard_id: str = RESTRICTED_SMARTCARD_ID,
    creator: str = ADMIN_SMARTCARD_ID,
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


@pytest.fixture(autouse=True)
def clean_restrictions_before_test(data_helper):
    data_helper.delete_all_restrictions_for_ods(TEST_ODS_CODE)
    yield


@pytest.fixture
def test_restrictions(data_helper):
    created = []
    yield created
    for record in created:
        try:
            data_helper.tidyup(record)
        except Exception as e:
            logging.warning(f"Failed to clean up restriction {record.get('ID')}: {e}")


@pytest.fixture
def api_created_restrictions(data_helper):
    created_ids = []
    yield created_ids
    for restriction_id in created_ids:
        try:
            data_helper.delete_restriction(restriction_id)
        except Exception as e:
            logging.warning(
                f"Failed to clean up API-created restriction {restriction_id}: {e}",
            )


def test_search_user_restriction_returns_200_with_restrictions(
    test_restrictions,
    get_token,
    data_helper,
    snapshot_json,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    restriction = _build_restriction()
    data_helper.create_restriction(restriction)
    test_restrictions.append(restriction)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(url, headers=_headers(auth_token))

    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json(exclude=EXCLUDE_IDS)


def test_search_user_restriction_filters_by_smartcard_id(
    test_restrictions,
    get_token,
    data_helper,
    snapshot_json,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    target_restriction = _build_restriction(smartcard_id=RESTRICTED_SMARTCARD_ID)
    other_restriction = _build_restriction(smartcard_id=ADMIN_SMARTCARD_ID)

    data_helper.create_restriction(target_restriction)
    data_helper.create_restriction(other_restriction)
    test_restrictions.append(target_restriction)
    test_restrictions.append(other_restriction)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(
        url,
        headers=_headers(auth_token),
        params={"smartcardId": RESTRICTED_SMARTCARD_ID},
    )

    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json(exclude=EXCLUDE_IDS)


def test_search_user_restriction_filters_by_nhs_number(
    test_restrictions,
    get_token,
    data_helper,
    snapshot_json,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    target_nhs = TEST_NHS_NUMBER
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

    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json(exclude=EXCLUDE_IDS)


def test_search_user_restriction_returns_empty_list_when_no_matches(
    test_restrictions,
    get_token,
    data_helper,
    snapshot_json,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    non_existent_smartcard = f"NONEXISTENT_{uuid.uuid4().hex[:8]}"

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(
        url,
        headers=_headers(auth_token),
        params={"smartcardId": non_existent_smartcard},
    )

    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json(exclude=EXCLUDE_IDS)


def test_search_user_restriction_does_not_return_inactive_restrictions(
    test_restrictions,
    get_token,
    data_helper,
    snapshot_json,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    inactive_restriction = _build_restriction(is_active=False)
    data_helper.create_restriction(inactive_restriction)
    test_restrictions.append(inactive_restriction)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(
        url,
        headers=_headers(auth_token),
        params={"smartcardId": RESTRICTED_SMARTCARD_ID},
    )

    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json(exclude=EXCLUDE_IDS)


def test_search_user_restriction_paginates_with_limit_and_next_page_token(
    test_restrictions,
    get_token,
    snapshot_json,
    data_helper,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    restrictions = [_build_restriction() for _ in range(3)]
    for r in restrictions:
        data_helper.create_restriction(r)
        test_restrictions.append(r)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"

    response = requests.get(url, headers=_headers(auth_token), params={"limit": "2"})
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


def test_search_user_restriction_returns_401_without_auth(data_helper):
    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(url)

    assert response.status_code == 401


def test_search_user_restriction_filters_by_both_smartcard_id_and_nhs_number(
    test_restrictions,
    get_token,
    data_helper,
    snapshot_json,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    matching = _build_restriction(
        smartcard_id=RESTRICTED_SMARTCARD_ID,
        nhs_number=TEST_NHS_NUMBER,
    )
    non_matching = _build_restriction(
        smartcard_id=RESTRICTED_SMARTCARD_ID,
        nhs_number=ANOTHER_NHS_NUMBER,
    )

    data_helper.create_restriction(matching)
    data_helper.create_restriction(non_matching)
    test_restrictions.append(matching)
    test_restrictions.append(non_matching)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(
        url,
        headers=_headers(auth_token),
        params={"smartcardId": RESTRICTED_SMARTCARD_ID, "nhsNumber": TEST_NHS_NUMBER},
    )

    assert response.status_code == 200

    body = response.json()
    assert body == snapshot_json(exclude=EXCLUDE_IDS)

    restrictions = body.get("restrictions", [])
    returned_ids = [r.get("id") for r in restrictions]

    assert (
        matching["ID"] in returned_ids
    ), "The restriction matching both filters should be returned."
    assert (
        non_matching["ID"] not in returned_ids
    ), "The restriction matching only smartcardId should be excluded by the nhsNumber filter."


def test_search_user_restriction_returns_400_for_invalid_limit(
    get_token,
    data_helper,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)
    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    under_range_response = requests.get(
        url,
        headers=_headers(auth_token),
        params={"limit": "0"},
    )
    assert under_range_response.status_code == 400
    assert under_range_response.json()["err_code"] == "UR_4001"

    over_range_response = requests.get(
        url,
        headers=_headers(auth_token),
        params={"limit": "200"},
    )
    assert over_range_response.status_code == 400
    assert over_range_response.json()["err_code"] == "UR_4001"


def test_search_user_restriction_returns_400_for_invalid_next_page_token(
    get_token,
    data_helper,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(
        url,
        headers=_headers(auth_token),
        params={"nextPageToken": "not-valid-base64!!!"},
    )

    assert response.status_code == 400
    assert response.json()["err_code"] == "UR_4001"


def test_search_user_restriction_is_scoped_to_caller_ods(
    test_restrictions,
    get_token,
    data_helper,
):
    other_ods_token = get_token(RESTRICTED_SMARTCARD_ID, ods=ANOTHER_ODS_CODE)

    restriction = _build_restriction(ods_code=TEST_ODS_CODE)
    data_helper.create_restriction(restriction)
    test_restrictions.append(restriction)

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.get(
        url,
        headers=_headers(other_ods_token),
        params={"smartcardId": RESTRICTED_SMARTCARD_ID},
    )

    assert response.status_code == 200

    returned_ids = [r.get("id") for r in response.json().get("restrictions", [])]
    assert (
        restriction["ID"] not in returned_ids
    ), "A user from a different ODS must not see another organisation's restrictions."


def test_remove_restriction_returns_204(
    test_restrictions,
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    restriction = _build_restriction()
    data_helper.create_restriction(restriction)
    test_restrictions.append(restriction)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200, (
        f"Admin patient search failed: "
        f"{search_response.status_code} {search_response.text}"
    )

    response = _remove_restriction(
        data_helper.api_endpoint,
        admin_token,
        restriction["ID"],
    )

    assert response.status_code == 204

    list_response = _list_restrictions(data_helper.api_endpoint, admin_token)
    assert list_response.status_code == 200

    restriction_ids = [
        r.get("id") for r in list_response.json().get("restrictions", [])
    ]
    assert (
        restriction["ID"] not in restriction_ids
    ), "Deactivated restriction should not appear in the active restrictions list."


def test_remove_restriction_returns_401_without_auth(data_helper):
    restriction_id = str(uuid.uuid4())
    url = f"https://{data_helper.api_endpoint}/UserRestriction/{restriction_id}"
    response = requests.patch(url, params={"patientId": TEST_NHS_NUMBER})

    assert response.status_code == 401


def test_remove_already_inactive_restriction_returns_400(
    test_restrictions,
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    inactive_restriction = _build_restriction(is_active=False)
    data_helper.create_restriction(inactive_restriction)
    test_restrictions.append(inactive_restriction)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200

    response = _remove_restriction(
        data_helper.api_endpoint,
        admin_token,
        inactive_restriction["ID"],
    )

    assert response.status_code == 400
    assert response.json()["err_code"] == "UR_4002"


def test_remove_restriction_with_wrong_nhs_number_returns_400(
    test_restrictions,
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    restriction = _build_restriction(nhs_number=TEST_NHS_NUMBER)
    data_helper.create_restriction(restriction)
    test_restrictions.append(restriction)

    search_response = _search_patient(
        data_helper.api_endpoint,
        admin_token,
        nhs_number=ANOTHER_NHS_NUMBER,
    )
    assert search_response.status_code == 200

    response = _remove_restriction(
        data_helper.api_endpoint,
        admin_token,
        restriction["ID"],
        nhs_number=ANOTHER_NHS_NUMBER,
    )

    assert response.status_code == 400
    assert response.json()["err_code"] == "UR_4002"


def test_remove_nonexistent_restriction_returns_400(
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200

    non_existent_id = str(uuid.uuid4())
    response = _remove_restriction(
        data_helper.api_endpoint,
        admin_token,
        non_existent_id,
    )

    assert response.status_code == 400
    assert response.json()["err_code"] == "UR_4002"


def test_restricted_user_cannot_remove_own_restriction(
    test_restrictions,
    get_token,
    data_helper,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    search_response = _search_patient(data_helper.api_endpoint, auth_token)
    assert search_response.status_code == 200

    restriction = _build_restriction(smartcard_id=RESTRICTED_SMARTCARD_ID)
    data_helper.create_restriction(restriction)
    test_restrictions.append(restriction)

    response = _remove_restriction(
        data_helper.api_endpoint,
        auth_token,
        restriction["ID"],
    )

    assert (
        response.status_code == 400
    ), "The restricted user must not be able to remove their own restriction."
    assert response.json()["err_code"] == "UR_4002"


def test_access_is_restored_after_restriction_removed(
    test_restrictions,
    get_token,
    data_helper,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    restriction = _build_restriction()
    data_helper.create_restriction(restriction)
    test_restrictions.append(restriction)

    blocked_response = _search_patient(data_helper.api_endpoint, auth_token)
    assert (
        blocked_response.status_code == 403
    ), "Expected 403 while the restriction is active."

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert (
        search_response.status_code == 200
    ), f"Admin patient search failed: {search_response.status_code}"

    remove_response = _remove_restriction(
        data_helper.api_endpoint,
        admin_token,
        restriction["ID"],
    )
    assert (
        remove_response.status_code == 204
    ), f"Expected 204 from PATCH, got {remove_response.status_code}: {remove_response.text}"

    restored_response = _search_patient(data_helper.api_endpoint, auth_token)
    assert (
        restored_response.status_code == 200
    ), "Expected 200 after the restriction has been removed."


def test_restriction_only_affects_restricted_user_not_others(
    test_restrictions,
    get_token,
    data_helper,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    restriction = _build_restriction(smartcard_id=RESTRICTED_SMARTCARD_ID)
    data_helper.create_restriction(restriction)
    test_restrictions.append(restriction)

    restricted_response = _search_patient(data_helper.api_endpoint, auth_token)
    unrestricted_response = _search_patient(data_helper.api_endpoint, admin_token)

    assert restricted_response.status_code == 403
    assert unrestricted_response.status_code == 200


def test_create_restriction_returns_201_with_id(
    api_created_restrictions,
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200

    response = _create_restriction(data_helper.api_endpoint, admin_token)

    assert response.status_code == 201

    body = response.json()
    assert "id" in body, "Response body should contain the new restriction 'id'"

    api_created_restrictions.append(body["id"])

    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    blocked_response = _search_patient(data_helper.api_endpoint, auth_token)
    assert blocked_response.status_code == 403

    list_response = _list_restrictions(data_helper.api_endpoint, admin_token)
    assert list_response.status_code == 200
    restriction_ids = [
        r.get("id") for r in list_response.json().get("restrictions", [])
    ]
    assert body["id"] in restriction_ids


def test_create_restriction_returns_409_when_restriction_already_exists(
    test_restrictions,
    api_created_restrictions,
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    existing_restriction = _build_restriction()
    data_helper.create_restriction(existing_restriction)
    test_restrictions.append(existing_restriction)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200

    response = _create_restriction(data_helper.api_endpoint, admin_token)

    assert response.status_code == 409
    assert response.json()["err_code"] == "UR_4091"


def test_create_restriction_returns_400_without_body(
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.post(
        url,
        headers=_headers(admin_token),
        params={"patientId": TEST_NHS_NUMBER},
    )

    assert response.status_code == 400
    assert response.json()["err_code"] == "UR_4001"


def test_create_restriction_returns_400_with_missing_smartcard_id(
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.post(
        url,
        headers=_headers(admin_token),
        params={"patientId": TEST_NHS_NUMBER},
        json={"nhsNumber": TEST_NHS_NUMBER},
    )

    assert response.status_code == 400
    assert response.json()["err_code"] == "UR_4001"


def test_create_restriction_returns_400_with_missing_nhs_number(
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.post(
        url,
        headers=_headers(admin_token),
        params={"patientId": TEST_NHS_NUMBER},
        json={"smartcardId": RESTRICTED_SMARTCARD_ID},
    )

    assert response.status_code == 400
    assert response.json()["err_code"] == "UR_4001"


def test_create_restriction_returns_403_when_patient_id_mismatch(
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.post(
        url,
        headers=_headers(admin_token),
        params={"patientId": ANOTHER_NHS_NUMBER},
        json={"smartcardId": RESTRICTED_SMARTCARD_ID, "nhsNumber": TEST_NHS_NUMBER},
    )

    assert response.status_code == 403


def test_create_restriction_returns_401_without_auth(data_helper):

    url = f"https://{data_helper.api_endpoint}/UserRestriction"
    response = requests.post(
        url,
        params={"patientId": TEST_NHS_NUMBER},
        json={"smartcardId": RESTRICTED_SMARTCARD_ID, "nhsNumber": TEST_NHS_NUMBER},
    )

    assert response.status_code == 401


def test_create_restriction_returns_400_for_self_restriction(
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200

    response = _create_restriction(
        data_helper.api_endpoint,
        admin_token,
        smartcard_id=ADMIN_SMARTCARD_ID,
    )

    assert response.status_code == 400
    assert response.json()["err_code"] == "UR_4031"


def test_create_restriction_can_be_recreated_after_removal(
    test_restrictions,
    api_created_restrictions,
    get_token,
    data_helper,
):
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    existing = _build_restriction()
    data_helper.create_restriction(existing)
    test_restrictions.append(existing)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200

    remove_response = _remove_restriction(
        data_helper.api_endpoint,
        admin_token,
        existing["ID"],
    )
    assert remove_response.status_code == 204

    recreate_response = _create_restriction(data_helper.api_endpoint, admin_token)

    assert recreate_response.status_code == 201

    api_created_restrictions.append(recreate_response.json()["id"])


def test_full_restriction_lifecycle_create_block_remove_restore(
    api_created_restrictions,
    get_token,
    data_helper,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)
    admin_token = get_token(ADMIN_SMARTCARD_ID)

    search_response = _search_patient(data_helper.api_endpoint, admin_token)
    assert search_response.status_code == 200

    create_response = _create_restriction(data_helper.api_endpoint, admin_token)
    assert create_response.status_code == 201

    restriction_id = create_response.json()["id"]
    api_created_restrictions.append(restriction_id)

    blocked_response = _search_patient(data_helper.api_endpoint, auth_token)
    assert blocked_response.status_code == 403

    remove_response = _remove_restriction(
        data_helper.api_endpoint,
        admin_token,
        restriction_id,
    )
    assert remove_response.status_code == 204

    restored_response = _search_patient(data_helper.api_endpoint, auth_token)
    assert (
        restored_response.status_code == 200
    ), "Expected 200 after the restriction has been removed."


def test_get_user_information_returns_200_with_practitioner_details(
    get_token,
    data_helper,
    snapshot_json,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    response = _get_user_info(
        data_helper.api_endpoint,
        auth_token,
        identifier=RESTRICTED_SMARTCARD_ID,
    )

    assert response.status_code == 200
    assert response.json() == snapshot_json(exclude=EXCLUDE_IDS)


def test_get_user_information_returns_400_without_identifier(
    get_token,
    data_helper,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    url = f"https://{data_helper.api_endpoint}/UserRestriction/SearchUser"
    response = requests.get(url, headers=_headers(auth_token))

    assert response.status_code == 400
    assert response.json()["err_code"] == "UR_4001"


def test_get_user_information_returns_401_without_auth(data_helper):

    url = f"https://{data_helper.api_endpoint}/UserRestriction/SearchUser"
    response = requests.get(url, params={"identifier": RESTRICTED_SMARTCARD_ID})

    assert response.status_code == 401


def test_get_user_information_returns_500_when_healthcare_worker_api_fails(
    get_token,
    data_helper,
):
    auth_token = get_token(RESTRICTED_SMARTCARD_ID)

    response = _get_user_info(
        data_helper.api_endpoint,
        auth_token,
        identifier=MOCK_HCW_API_ERROR_SMARTCARD_ID,
    )

    assert response.status_code == 500
