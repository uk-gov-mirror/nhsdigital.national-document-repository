from unittest.mock import call

import pytest
from enums.snomed_codes import SnomedCodes
from requests import Response
from requests.exceptions import HTTPError
from services.nrl_api_service import NrlApiService
from tests.unit.conftest import FAKE_URL, TEST_NHS_NUMBER
from tests.unit.helpers.mock_services import FakeSSMService, FakOAuthService
from utils.exceptions import NrlApiException

ACCESS_TOKEN = "Sr5PGv19wTEHJdDr2wx2f7IGd0cw"


@pytest.fixture
def nrl_service(set_env, mocker):
    fake_ssm_service = FakeSSMService()
    fake_auth_service = FakOAuthService(fake_ssm_service)
    nrl_service = NrlApiService(fake_ssm_service, fake_auth_service)
    mocker.patch.object(nrl_service, "session")
    yield nrl_service


@pytest.fixture
def mock_session_post(nrl_service, mocker):
    nrl_service.session.post = mocker.MagicMock()
    nrl_service.session.post.return_value.status_code = 201
    nrl_service.session.post.return_value.json = mocker.MagicMock(return_value={})
    yield nrl_service.session.post


@pytest.fixture
def mock_get_pointer(nrl_service, mocker):
    nrl_service.get_pointer = mocker.MagicMock()
    yield nrl_service.get_pointer


@pytest.fixture
def mock_search_url():
    yield "https://example.com/search_url"


@pytest.fixture
def mock_pointer_id():
    yield "222"


@pytest.fixture
def mock_nrl_pointer_entry(mock_search_url, mock_pointer_id):
    mock_nrl_entry = {
        "resource": {
            "resourceType": "DocumentReference",
            "id": mock_pointer_id,
        },
        "content": [{"attachment": {"url": mock_search_url}}],
    }

    yield mock_nrl_entry


@pytest.fixture
def mock_multi_doc_nrl_pointer_entry(mock_search_url, mock_pointer_id):
    mock_nrl_entry = {
        "resource": {
            "resourceType": "DocumentReference",
            "id": mock_pointer_id,
        },
        "content": [
            {"attachment": {"url": "https://example.com/other_doc_url"}},
            {"attachment": {"url": "https://example.com/other_doc_url"}},
            {"attachment": {"url": mock_search_url}},
        ],
    }

    yield mock_nrl_entry


@pytest.fixture
def mock_nrl_multiple_entry_response(mock_nrl_pointer_entry):
    mock_nrl_response = {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": 3,
        "entry": [
            {
                "resource": {
                    "resourceType": "DocumentReference",
                    "id": "222",
                },
                "content": [
                    {"attachment": {"url": "https://example.com/other_mock_url"}}
                ],
            },
            mock_nrl_pointer_entry,
            {
                "resource": {
                    "resourceType": "DocumentReference",
                    "id": "222",
                },
                "content": [
                    {"attachment": {"url": "https://example.com/other_mock_url"}}
                ],
            },
        ],
    }

    yield mock_nrl_response


def test_create_new_pointer(nrl_service, mock_session_post, mock_get_pointer):
    mock_get_pointer.return_value = {}

    nrl_service.create_new_pointer("123456789", {}, SnomedCodes.LLOYD_GEORGE.value)

    mock_session_post.assert_called_once_with(
        url=nrl_service.endpoint, headers=nrl_service.headers, json={}
    )


def test_create_new_pointer_already_exists(nrl_service, mock_get_pointer):
    mock_get_pointer.return_value = {"entry": [{}]}

    with pytest.raises(NrlApiException, match="Pointer already exists"):
        nrl_service.create_new_pointer("123456789", {}, SnomedCodes.LLOYD_GEORGE.value)
    nrl_service.session.post.assert_not_called()


def test_create_new_pointer_raise_error(nrl_service, mock_get_pointer):
    mock_body = {"test": "tests"}
    mock_get_pointer.return_value = {}
    response = Response()
    response._content = b"{}"
    response.status_code = 400
    nrl_service.session.post.return_value = response
    with pytest.raises(NrlApiException, match="Error while creating new NRL Pointer"):
        nrl_service.create_new_pointer(
            "123456789", mock_body, SnomedCodes.LLOYD_GEORGE.value
        )
    nrl_service.session.post.assert_called_once()


def test_create_new_pointer_existing_pointer(nrl_service, mock_get_pointer):
    nhs_number = "123456789"
    body = {
        "resourceType": "DocumentReference",
        "status": "current",
        "content": [{"attachment": {"contentType": "application/pdf"}}],
    }
    existing_pointer = {
        "resourceType": "DocumentReference",
        "status": "current",
        "content": [{"attachment": {"contentType": "application/pdf"}}],
    }
    mock_get_pointer.return_value = {"entry": [{"resource": existing_pointer}]}

    with pytest.raises(NrlApiException, match="Pointer already exists"):
        nrl_service.create_new_pointer(nhs_number, body, SnomedCodes.LLOYD_GEORGE.value)

    mock_get_pointer.assert_called_once_with(nhs_number, SnomedCodes.LLOYD_GEORGE.value)


def test_create_new_pointer_success(nrl_service, mock_get_pointer, mock_session_post):
    nhs_number = "123456789"
    body = {
        "resourceType": "DocumentReference",
        "status": "current",
        "content": [{"attachment": {"contentType": "application/pdf"}}],
    }
    mock_get_pointer.return_value = {}

    nrl_service.create_new_pointer(nhs_number, body, SnomedCodes.LLOYD_GEORGE.value)

    mock_session_post.assert_called_once_with(
        url=nrl_service.endpoint, headers=nrl_service.headers, json=body
    )


def test_create_new_pointer_retry_on_expired_token(
    nrl_service, mock_get_pointer, mock_session_post, mocker
):
    nhs_number = "123456789"
    body = {
        "resourceType": "DocumentReference",
        "status": "current",
        "content": [{"attachment": {"contentType": "application/pdf"}}],
    }
    mock_get_pointer.return_value = {}
    response = Response()
    response.status_code = 401
    response._content = b"{}"
    mock_session_post.side_effect = [
        response,
        mocker.MagicMock(status_code=201, json=mocker.MagicMock(return_value={})),
    ]

    nrl_service.create_new_pointer(nhs_number, body, SnomedCodes.LLOYD_GEORGE.value)

    assert mock_session_post.call_count == 2
    mock_session_post.assert_called_with(
        url=nrl_service.endpoint, headers=nrl_service.headers, json=body
    )


def test_get_end_user_ods_code(nrl_service):
    actual = nrl_service.get_end_user_ods_code()
    assert actual == "test_value_test_nrl_user_ods_ssm_key"


def test_get_pointer_with_record_type(mocker, nrl_service):
    mock_type = SnomedCodes.LLOYD_GEORGE.value
    mocker.patch("uuid.uuid4", return_value="test_uuid")
    mock_params = {
        "subject:identifier": f"https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}",
        "type": f"http://snomed.info/sct|{mock_type.code}",
    }
    mock_headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "NHSD-End-User-Organisation-ODS": "test_value_test_nrl_user_ods_ssm_key",
        "Accept": "application/json",
        "X-Request-ID": "test_uuid",
    }
    nrl_service.get_pointer(TEST_NHS_NUMBER, mock_type)
    nrl_service.session.get.assert_called_with(
        params=mock_params, url=FAKE_URL, headers=mock_headers
    )


def test_get_pointer_without_record_type(mocker, nrl_service):
    mocker.patch("uuid.uuid4", return_value="test_uuid")
    mock_params = {
        "subject:identifier": f"https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}",
    }
    mock_headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "NHSD-End-User-Organisation-ODS": "test_value_test_nrl_user_ods_ssm_key",
        "Accept": "application/json",
        "X-Request-ID": "test_uuid",
    }
    nrl_service.get_pointer(TEST_NHS_NUMBER)
    nrl_service.session.get.assert_called_with(
        params=mock_params, url=FAKE_URL, headers=mock_headers
    )


def test_get_pointer_with_record_type_no_retry(mocker, nrl_service):
    mock_type = SnomedCodes.LLOYD_GEORGE.value
    mocker.patch("uuid.uuid4", return_value="test_uuid")
    mock_params = {
        "subject:identifier": f"https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}",
        "type": f"http://snomed.info/sct|{mock_type.code}",
    }
    mock_headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "NHSD-End-User-Organisation-ODS": "test_value_test_nrl_user_ods_ssm_key",
        "Accept": "application/json",
        "X-Request-ID": "test_uuid",
    }
    response = Response()
    response.status_code = 401
    response._content = b"{}"
    nrl_service.session.get.return_value = response
    with pytest.raises(NrlApiException):
        nrl_service.get_pointer(TEST_NHS_NUMBER, mock_type, retry_on_expired=False)
    nrl_service.session.get.assert_called_with(
        params=mock_params, url=FAKE_URL, headers=mock_headers
    )
    nrl_service.session.get.assert_called_once()


def test_get_pointer_with_record_type_with_retry(mocker, nrl_service):
    mock_type = SnomedCodes.LLOYD_GEORGE.value
    mocker.patch("uuid.uuid4", return_value="test_uuid")
    mock_params = {
        "subject:identifier": f"https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}",
        "type": f"http://snomed.info/sct|{mock_type.code}",
    }
    mock_headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "NHSD-End-User-Organisation-ODS": "test_value_test_nrl_user_ods_ssm_key",
        "Accept": "application/json",
        "X-Request-ID": "test_uuid",
    }
    response = Response()
    response.status_code = 401
    response._content = b"{}"
    nrl_service.session.get.return_value = response
    with pytest.raises(NrlApiException):
        nrl_service.get_pointer(TEST_NHS_NUMBER, mock_type, retry_on_expired=True)
    nrl_service.session.get.assert_called_with(
        params=mock_params, url=FAKE_URL, headers=mock_headers
    )
    assert nrl_service.session.get.call_count == 2


def test_get_pointer_raise_error(nrl_service):
    response = Response()
    response.status_code = 400
    response._content = b"{}"
    mock_type = SnomedCodes.LLOYD_GEORGE.value
    nrl_service.session.get.return_value = response
    pytest.raises(NrlApiException, nrl_service.get_pointer, TEST_NHS_NUMBER, mock_type)
    nrl_service.session.get.assert_called_once()


def test_delete_pointer_with_record_type_no_record(
    mocker, nrl_service, mock_get_pointer
):
    mock_type = SnomedCodes.LLOYD_GEORGE.value
    mocker.patch("uuid.uuid4", return_value="test_uuid")
    nrl_response = {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": 0,
        "entry": [],
    }
    mock_get_pointer.return_value = nrl_response
    nrl_service.delete_pointer(TEST_NHS_NUMBER, mock_type)
    nrl_service.session.delete.assert_not_called()


def test_delete_pointer_with_record_type_one_record(
    mocker, nrl_service, mock_get_pointer
):
    mock_type = SnomedCodes.LLOYD_GEORGE.value
    mocker.patch("uuid.uuid4", return_value="test_uuid")
    mock_pointer_id = "ODSCODE-1111bfb1-1111-2222-3333-4444555c666f"
    mock_headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "NHSD-End-User-Organisation-ODS": "test_value_test_nrl_user_ods_ssm_key",
        "Accept": "application/json",
        "X-Request-ID": "test_uuid",
    }
    nrl_response = {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": 1,
        "entry": [
            {
                "resource": {
                    "resourceType": "DocumentReference",
                    "id": mock_pointer_id,
                }
            }
        ],
    }
    mock_get_pointer.return_value = nrl_response
    nrl_service.delete_pointer(TEST_NHS_NUMBER, mock_type)
    nrl_service.session.delete.assert_called_with(
        url=FAKE_URL + "/" + mock_pointer_id, headers=mock_headers
    )


def test_delete_pointer_with_record_type_more_than_one_record(
    mocker, nrl_service, mock_get_pointer
):
    mock_type = SnomedCodes.LLOYD_GEORGE.value
    mocker.patch("uuid.uuid4", return_value="test_uuid")
    mock_pointer_id = "ODSCODE-1111bfb1-1111-2222-3333-4444555c666"
    nrl_response = {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": 1,
        "entry": [
            {
                "resource": {
                    "resourceType": "DocumentReference",
                    "id": mock_pointer_id + "1",
                }
            },
            {
                "resource": {
                    "resourceType": "DocumentReference",
                    "id": mock_pointer_id + "2",
                }
            },
        ],
    }
    mock_get_pointer.return_value = nrl_response
    nrl_service.delete_pointer(TEST_NHS_NUMBER, mock_type)
    assert nrl_service.session.delete.call_count == 2


def test_delete_pointer_not_raise_error(mock_get_pointer, nrl_service):
    response = Response()
    response.status_code = 400
    response._content = b"{}"
    mock_type = SnomedCodes.LLOYD_GEORGE.value
    nrl_response = {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": 1,
        "entry": [
            {
                "resource": {
                    "resourceType": "DocumentReference",
                    "id": "222",
                }
            }
        ],
    }
    mock_get_pointer.return_value = nrl_response
    nrl_service.session.delete.return_value = response
    try:
        nrl_service.delete_pointer(TEST_NHS_NUMBER, mock_type)
    except Exception:
        assert False
    nrl_service.session.delete.assert_called_once()


def test_update_pointer_success(nrl_service, mocker):
    mock_pointer_id = "222"
    mock_pointer = {
        "resource": {"resourceType": "DocumentReference", "id": mock_pointer_id}
    }

    mock_response = Response()
    mock_response.status_code = 200
    mock_response._content = b"{}"

    nrl_service.session.put.return_value = mock_response

    nrl_service.update_pointer(mock_pointer, TEST_NHS_NUMBER)

    nrl_service.session.put.assert_called_once_with(
        url=nrl_service.endpoint + f"/{mock_pointer_id}",
        headers=nrl_service.headers,
        json=mock_pointer,
    )


def test_update_pointer_nrl_token_expired_retries(nrl_service):
    mock_pointer_id = "222"
    mock_pointer = {
        "resource": {"resourceType": "DocumentReference", "id": mock_pointer_id}
    }

    mock_token_expired_response = Response()
    mock_token_expired_response.status_code = 401
    mock_token_expired_response._content = b"{}"
    mock_http_error = HTTPError(response=mock_token_expired_response)

    mock_successful_response = Response()
    mock_successful_response.status_code = 200
    mock_successful_response._content = b"{}"

    nrl_service.session.put.side_effect = [mock_http_error, mock_successful_response]

    nrl_service.update_pointer(mock_pointer, TEST_NHS_NUMBER)

    assert nrl_service.session.put.call_count == 2

    nrl_service.session.put.assert_has_calls(
        [
            call(
                url=nrl_service.endpoint + f"/{mock_pointer_id}",
                headers=nrl_service.headers,
                json=mock_pointer,
            ),
            call(
                url=nrl_service.endpoint + f"/{mock_pointer_id}",
                headers=nrl_service.headers,
                json=mock_pointer,
            ),
        ]
    )


def test_update_pointer_not_raise_error(nrl_service):
    response = Response()
    response.status_code = 400
    response._content = b"{}"
    mock_pointer_id = "222"
    mock_pointer = {
        "resource": {"resourceType": "DocumentReference", "id": mock_pointer_id}
    }
    nrl_service.session.put.return_value = response

    nrl_service.update_pointer(mock_pointer, TEST_NHS_NUMBER)

    nrl_service.session.put.assert_called_once()


def test_get_pointer_by_url_returns_correct_entry(
    nrl_service,
    mock_get_pointer,
    mock_search_url,
    mock_nrl_multiple_entry_response,
    mock_nrl_pointer_entry,
):
    mock_get_pointer.return_value = mock_nrl_multiple_entry_response
    mock_type = SnomedCodes.LLOYD_GEORGE.value

    result = nrl_service.get_pointer_by_url(TEST_NHS_NUMBER, mock_type, mock_search_url)

    assert result == mock_nrl_pointer_entry


def test_delete_pointer_with_url_single_document_deletes_pointer(
    nrl_service, mock_nrl_pointer_entry, mocker, mock_search_url
):
    mocker.patch.object(
        nrl_service, "get_pointer_by_url", return_value=mock_nrl_pointer_entry
    )

    mock_type = SnomedCodes.LLOYD_GEORGE.value

    mocker.patch.object(nrl_service, "update_pointer")
    mocker.patch.object(nrl_service, "delete_pointer_by_id")
    mocker.patch.object(nrl_service, "delete_pointer_by_record_type")

    nrl_service.delete_pointer(TEST_NHS_NUMBER, mock_type, mock_search_url)

    nrl_service.delete_pointer_by_record_type.assert_not_called()
    nrl_service.update_pointer.assert_not_called()

    nrl_service.delete_pointer_by_id.assert_called_once_with(
        mock_nrl_pointer_entry, TEST_NHS_NUMBER
    )


def test_delete_pointer_with_url_multiple_documents_deletes_pointer(
    nrl_service, mock_multi_doc_nrl_pointer_entry, mocker, mock_search_url
):
    mocker.patch.object(
        nrl_service, "get_pointer_by_url", return_value=mock_multi_doc_nrl_pointer_entry
    )

    mock_type = SnomedCodes.LLOYD_GEORGE.value

    mocker.patch.object(nrl_service, "update_pointer")
    mocker.patch.object(nrl_service, "delete_pointer_by_id")
    mocker.patch.object(nrl_service, "delete_pointer_by_record_type")

    nrl_service.delete_pointer(TEST_NHS_NUMBER, mock_type, mock_search_url)

    nrl_service.delete_pointer_by_record_type.assert_not_called()
    nrl_service.delete_pointer_by_id.assert_not_called()

    nrl_service.update_pointer.assert_called_once_with(
        mock_multi_doc_nrl_pointer_entry, TEST_NHS_NUMBER
    )


def test_delete_pointer_with_url_no_pointers_found_no_error(
    nrl_service, mocker, mock_search_url
):
    mocker.patch.object(nrl_service, "get_pointer_by_url", return_value=None)

    mock_type = SnomedCodes.LLOYD_GEORGE.value

    mocker.patch.object(nrl_service, "update_pointer")
    mocker.patch.object(nrl_service, "delete_pointer_by_id")
    mocker.patch.object(nrl_service, "delete_pointer_by_record_type")

    nrl_service.delete_pointer(TEST_NHS_NUMBER, mock_type, mock_search_url)

    nrl_service.delete_pointer_by_record_type.assert_not_called()
    nrl_service.delete_pointer_by_id.assert_not_called()
    nrl_service.update_pointer.assert_not_called()


def test_delete_pointer_by_id_refresh_expired_token(
    nrl_service, mock_nrl_pointer_entry, mock_pointer_id
):
    mock_token_expired_response = Response()
    mock_token_expired_response.status_code = 401
    mock_token_expired_response._content = b"{}"
    mock_http_error = HTTPError(response=mock_token_expired_response)

    mock_successful_response = Response()
    mock_successful_response.status_code = 200
    mock_successful_response._content = b"{}"

    nrl_service.session.delete.side_effect = [mock_http_error, mock_successful_response]

    nrl_service.delete_pointer_by_id(mock_nrl_pointer_entry, TEST_NHS_NUMBER)

    assert nrl_service.session.delete.call_count == 2

    nrl_service.session.delete.assert_has_calls(
        [
            call(
                url=nrl_service.endpoint + f"/{mock_pointer_id}",
                headers=nrl_service.headers,
            ),
            call(
                url=nrl_service.endpoint + f"/{mock_pointer_id}",
                headers=nrl_service.headers,
            ),
        ]
    )


def test_get_pointer_by_url_no_results_returns_none(
    nrl_service, mock_get_pointer, mock_search_url
):
    mock_get_pointer.return_result = {"entry": []}

    mock_type = SnomedCodes.LLOYD_GEORGE.value

    result = nrl_service.get_pointer_by_url(TEST_NHS_NUMBER, mock_type, mock_search_url)

    assert result is None
