import pytest

from tests.e2e.api.fhir.conftest import (
    TEST_NHS_NUMBER,
    create_and_store_pdm_record,
    search_document_reference,
)
from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


@pytest.mark.parametrize(
    "nhs_number,expected_status,expected_code,expected_diagnostics",
    [
        ("9999999993", 400, "INVALID_SEARCH_DATA", "Invalid patient number 9999999993"),
        ("123", 400, "INVALID_SEARCH_DATA", "Invalid patient number 123"),
        ("", 400, "INVALID_SEARCH_DATA", "Invalid patient number "),
        ("   ", 400, "INVALID_SEARCH_DATA", "Invalid patient number    "),
    ],
)
def test_search_edge_cases(
    nhs_number,
    expected_status,
    expected_code,
    expected_diagnostics,
):
    response = search_document_reference(nhs_number)
    assert response.status_code == expected_status

    body = response.json()
    issue = body["issue"][0]
    details = issue.get("details", {})
    coding = details.get("coding", [{}])[0]
    assert coding.get("code") == expected_code
    assert issue.get("diagnostics") == expected_diagnostics


# The following tests should return 400 Bad Request for invalid query parameters.
# However they currently return 200 OK with an empty entry list instead.
# Ticket NDR-430 raised to investigate and fix this. Once fixed, these tests should be updated to expect a 400 Bad Request.
@pytest.mark.parametrize(
    "extra_params",
    [
        ({"custodian:identifier": "https://fhir.nhs.uk/Id/ods-organization-code|"}),
        ({"custodian:identifier": "https://fhir.nhs.uk/Id/ods-organization-code|   "}),
    ],
)
def test_search_custodian_edge_cases(test_data, extra_params):
    create_and_store_pdm_record(test_data)

    response = search_document_reference(TEST_NHS_NUMBER, extra_params=extra_params)
    assert response.status_code == 200

    entries = response.json().get("entry", [])
    assert entries == []


@pytest.mark.parametrize(
    "extra_params",
    [
        {"foo": "bar"},
        {"Custodian:Identifier": "https://fhir.nhs.uk/Id/ods-organization-code|H81109"},
    ],
)
def test_search_invalid_query_params(test_data, extra_params):
    create_and_store_pdm_record(test_data)

    response = search_document_reference(TEST_NHS_NUMBER, extra_params=extra_params)

    assert response.status_code == 200
    entries = response.json().get("entry", [])
    assert entries


@pytest.mark.parametrize(
    "extra_params",
    [
        {
            "custodian:identifier": "https://fhir.nhs.uk/Id/ods-organization-code|H81109",
            "foo": "bar",
        },
        {"custodian:identifier": "H81109", "abc": "123", "zzz": "999"},
    ],
)
def test_search_mixed_valid_and_invalid_query_params(test_data, extra_params):
    create_and_store_pdm_record(test_data)

    response = search_document_reference(TEST_NHS_NUMBER, extra_params=extra_params)

    assert response.status_code == 200
    entries = response.json().get("entry", [])
    assert entries


# type:identifier currently returns 500. Bug ticket NDR-431 raised to investigate and fix this.
# Once fixed, this test should be updated to expect a 400 Bad Request instead of 500 Internal Server Error
# @pytest.mark.parametrize(
#     "extra_params, expected_empty",
#     [
#         ({"type:identifier": "pdf"}, True),
#     ],
# )
# def test_search_file_type_edge_cases(test_data, extra_params, expected_empty):
#     create_and_store_pdm_record(test_data)

#     response = search_document_reference(
#         TEST_NHS_NUMBER, extra_params=extra_params)

#     assert response.status_code == 200
#     entries = response.json().get("entry", [])

#     if expected_empty:
#         assert entries == []
#     else:
#         assert entries
