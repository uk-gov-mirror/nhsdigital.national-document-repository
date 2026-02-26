from datetime import datetime, timezone

import pytest

from enums.document_retention import DocumentRetentionDays
from tests.e2e.api.fhir.conftest import (
    MTLS_ENDPOINT,
    PDM_SNOMED,
    TEST_NHS_NUMBER,
    UNKNOWN_TEST_NHS_NUMBER,
    create_and_store_pdm_record,
    create_mtls_session,
)
from tests.e2e.conftest import APIM_ENDPOINT
from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


def search_document_reference(
    nhs_number,
    client_cert_path=None,
    client_key_path=None,
    resource_type="DocumentReference",
):
    """Helper to perform search by NHS number with optional mTLS certs."""
    url = f"https://{MTLS_ENDPOINT}/{resource_type}?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{nhs_number}"
    headers = {
        "X-Correlation-Id": "1234",
    }

    # Use provided certs if available, else defaults
    if client_cert_path and client_key_path:
        session = create_mtls_session(client_cert_path, client_key_path)
    else:
        session = create_mtls_session()

    return session.get(url, headers=headers)


def test_search_nonexistent_document_references_for_patient_details():
    response = search_document_reference(UNKNOWN_TEST_NHS_NUMBER)
    assert response.status_code == 200

    bundle = response.json()
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "searchset"
    assert bundle["total"] == 0
    assert "entry" in bundle
    assert bundle["entry"] == []


def test_search_patient_details(test_data):
    created_record = create_and_store_pdm_record(test_data)
    expected_record_id = created_record["id"]

    response = search_document_reference(TEST_NHS_NUMBER)
    assert response.status_code == 200

    bundle = response.json()
    entries = bundle.get("entry", [])
    assert entries

    # Find the entry with the matching record_id
    matching_entry = next(
        (
            e
            for e in entries
            if e["resource"].get("id") == f"{PDM_SNOMED}~{expected_record_id}"
        ),
        None,
    )
    assert matching_entry

    attachment_url = matching_entry["resource"]["content"][0]["attachment"]["url"]
    assert (
        f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{PDM_SNOMED}~{expected_record_id}"
        in attachment_url
    )


def test_multiple_cancelled_search_patient_details(test_data):
    record_ids = [
        create_and_store_pdm_record(test_data, doc_status="cancelled")["id"]
        for _ in range(2)
    ]

    response = search_document_reference(TEST_NHS_NUMBER)
    assert response.status_code == 200

    bundle = response.json()
    entries = bundle.get("entry", [])
    assert len(entries) >= 2

    # Validate all created records exist and have status cancelled
    for record_id in record_ids:
        entry = next(
            (
                e
                for e in entries
                if e["resource"].get("id") == f"{PDM_SNOMED}~{record_id}"
            ),
            None,
        )
        assert entry
        assert entry["resource"].get("docStatus") == "cancelled"


@pytest.mark.parametrize(
    "nhs_number,expected_status,expected_code,expected_diagnostics",
    [
        ("9999999993", 400, "INVALID_SEARCH_DATA", "Invalid patient number 9999999993"),
        ("123", 400, "INVALID_SEARCH_DATA", "Invalid patient number 123"),
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


def test_search_patient_unauthorized_mtls(test_data, temp_cert_and_key):
    """Search should return 403 when mTLS certificate is invalid or missing."""
    create_and_store_pdm_record(test_data)

    # Use an invalid cert that is trusted by TLS but fails truststore validation
    cert_path, key_path = temp_cert_and_key

    response = search_document_reference(
        TEST_NHS_NUMBER,
        client_cert_path=cert_path,
        client_key_path=key_path,
    )

    body = response.json()
    assert response.status_code == 403
    assert body["message"] == "Forbidden"


def test_search_invalid_resource_type(test_data):
    create_and_store_pdm_record(test_data)

    response = search_document_reference(TEST_NHS_NUMBER, resource_type="FooBar")
    assert response.status_code == 400


def test_search_patient_details_deleted_are_not_returned(test_data):
    created_record_1 = create_and_store_pdm_record(test_data)
    expected_record_id_1 = created_record_1["id"]

    deletion_date = datetime.now(timezone.utc)
    document_ttl_days = DocumentRetentionDays.SOFT_DELETE
    ttl_seconds = document_ttl_days * 24 * 60 * 60
    document_reference_ttl = int(deletion_date.timestamp() + ttl_seconds)
    created_record_2 = create_and_store_pdm_record(
        test_data,
        doc_status="deprecated",
        Deleted=deletion_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        ttl=document_reference_ttl,
    )
    expected_record_id_2 = created_record_2["id"]

    response = search_document_reference(TEST_NHS_NUMBER)
    assert response.status_code == 200

    bundle = response.json()
    assert bundle["total"] < 2
    entries = bundle.get("entry", [])
    assert entries

    # Find the entry with the matching record_id
    matching_entry = next(
        (
            e
            for e in entries
            if e["resource"].get("id") == f"{PDM_SNOMED}~{expected_record_id_1}"
        ),
        None,
    )
    assert matching_entry
    # Assert deleted item doesn't exist
    non_matching_entry = next(
        (
            e
            for e in entries
            if e["resource"].get("id") == f"{PDM_SNOMED}~{expected_record_id_2}"
        ),
        None,
    )
    assert non_matching_entry is None
