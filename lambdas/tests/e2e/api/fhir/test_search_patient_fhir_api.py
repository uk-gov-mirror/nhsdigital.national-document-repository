import pytest

from lambdas.tests.e2e.api.fhir.conftest import (
    MTLS_ENDPOINT,
    create_and_store_pdm_record,
    create_mtls_session,
)
from lambdas.tests.e2e.conftest import APIM_ENDPOINT, PDM_SNOMED
from lambdas.tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


def search_document_reference(nhs_number, client_cert_path=None, client_key_path=None):
    """Helper to perform search by NHS number with optional mTLS certs."""
    url = (
        f"https://{MTLS_ENDPOINT}/DocumentReference?"
        f"subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{nhs_number}"
    )
    headers = {
        "X-Correlation-Id": "1234",
    }

    # Use provided certs if available, else defaults
    if client_cert_path and client_key_path:
        session = create_mtls_session(client_cert_path, client_key_path)
    else:
        session = create_mtls_session()

    return session.get(url, headers=headers)


def test_search_patient_details(test_data):
    create_and_store_pdm_record(test_data)

    response = search_document_reference("9912003071")
    assert response.status_code == 200

    bundle = response.json()
    assert "entry" in bundle

    attachment_url = bundle["entry"][0]["resource"]["content"][0]["attachment"]["url"]
    assert (
        f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{PDM_SNOMED}~"
        in attachment_url
    )


def test_multiple_cancelled_search_patient_details(test_data):
    create_and_store_pdm_record(test_data, doc_status="cancelled")
    create_and_store_pdm_record(test_data, doc_status="cancelled")

    response = search_document_reference("9912003071")
    assert response.status_code == 200

    bundle = response.json()
    entries = bundle.get("entry", [])
    assert len(entries) >= 2

    # Assert that all entries have status "cancelled"
    for entry in entries:
        resource = entry.get("resource", {})
        assert resource.get("docStatus") == "cancelled"


@pytest.mark.parametrize(
    "nhs_number,expected_status,expected_code,expected_diagnostics",
    [
        ("9912003071", 404, "RESOURCE_NOT_FOUND", "Document reference not found"),
        ("9999999993", 400, "INVALID_SEARCH_DATA", "Invalid patient number 9999999993"),
        ("123", 400, "INVALID_SEARCH_DATA", "Invalid patient number 123"),
    ],
)
def test_search_edge_cases(
    nhs_number, expected_status, expected_code, expected_diagnostics
):
    response = search_document_reference(nhs_number)
    assert response.status_code == expected_status

    body = response.json()
    issue = body["issue"][0]
    details = issue.get("details", {})
    coding = details.get("coding", [{}])[0]
    assert coding.get("code") == expected_code
    assert issue.get("diagnostics") == expected_diagnostics


def test_search_patient_unauthorized_mtls(test_data, temp_cert_and_key):
    """Search should return 403 when mTLS certificate is invalid or missing."""
    create_and_store_pdm_record(test_data)

    # Use an invalid cert that is trusted by TLS but fails truststore validation
    cert_path, key_path = temp_cert_and_key

    response = search_document_reference(
        "9912003071", client_cert_path=cert_path, client_key_path=key_path
    )

    body = response.json()
    assert response.status_code == 403
    assert body["message"] == "Forbidden"
