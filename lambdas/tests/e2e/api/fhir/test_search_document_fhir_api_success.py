from datetime import datetime, timezone

import pytest

from enums.document_retention import DocumentRetentionDays
from tests.e2e.api.fhir.conftest import (
    PDM_SNOMED,
    TEST_NHS_NUMBER,
    UNKNOWN_TEST_NHS_NUMBER,
    create_and_store_pdm_record,
    search_document_reference,
)
from tests.e2e.conftest import APIM_ENDPOINT
from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


@pytest.mark.parametrize(
    "extra_params",
    [
        {},
        {"custodian:identifier": "https://fhir.nhs.uk/Id/ods-organization-code|H81109"},
    ],
)
def test_search_nonexistent_document_references_for_valid_patient_details(extra_params):
    response = search_document_reference(
        UNKNOWN_TEST_NHS_NUMBER,
        extra_params=extra_params,
    )
    assert response.status_code == 200

    bundle = response.json()
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "searchset"
    assert bundle["total"] == 0
    assert "entry" in bundle
    assert bundle["entry"] == []


def test_search_document_reference_for_valid_patient_details(test_data):
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


def test_search_multiple_document_references_for_valid_patient_details(test_data):
    expected_record_ids = [
        create_and_store_pdm_record(test_data)["id"] for _ in range(3)
    ]

    response = search_document_reference(TEST_NHS_NUMBER)
    assert response.status_code == 200

    bundle = response.json()
    entries = bundle.get("entry", [])
    assert entries

    # Find the entries with the matching record_id's
    for record_id in expected_record_ids:
        matching_entry = next(
            (
                e
                for e in entries
                if e["resource"].get("id") == f"{PDM_SNOMED}~{record_id}"
            ),
            None,
        )
        assert matching_entry

        attachment_url = matching_entry["resource"]["content"][0]["attachment"]["url"]
        assert (
            f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{PDM_SNOMED}~{record_id}"
            in attachment_url
        )


def test_search_document_reference_filters_by_custodian(test_data):
    rec1 = create_and_store_pdm_record(
        test_data,
        nhs_number=TEST_NHS_NUMBER,
        ods="A11111",
    )
    rec2 = create_and_store_pdm_record(
        test_data,
        nhs_number=TEST_NHS_NUMBER,
        ods="A11111",
    )
    rec3 = create_and_store_pdm_record(test_data, nhs_number=TEST_NHS_NUMBER)

    response = search_document_reference(
        TEST_NHS_NUMBER,
        extra_params={
            "custodian:identifier": "https://fhir.nhs.uk/Id/ods-organization-code|A11111",
        },
    )
    assert response.status_code == 200

    bundle = response.json()
    entries = bundle.get("entry", [])
    assert entries

    returned_ids = {e["resource"]["id"] for e in entries}

    # Only records with custodian A11111 should be returned
    expected_ids = {
        f"{PDM_SNOMED}~{rec1['id']}",
        f"{PDM_SNOMED}~{rec2['id']}",
    }

    unexpected_id = f"{PDM_SNOMED}~{rec3['id']}"

    assert expected_ids.issubset(returned_ids)
    assert unexpected_id not in returned_ids


@pytest.mark.parametrize(
    "extra_params",
    [
        (
            {
                "custodian:identifier": "https://fhir.nhs.uk/Id/ods-organization-code|foo|bar|baz",
            }
        ),
        (
            {
                "custodian:identifier": "https://fhir.nhs.uk/Id/ods-organization-code|ZZ9999",
            }
        ),
    ],
)
def test_search_document_reference_filters_by_valid_but_unmatched_custodian(
    test_data,
    extra_params,
):
    create_and_store_pdm_record(test_data)

    response = search_document_reference(TEST_NHS_NUMBER, extra_params=extra_params)
    assert response.status_code == 200

    bundle = response.json()
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "searchset"
    assert bundle["total"] == 0
    assert "entry" in bundle
    assert bundle["entry"] == []


def test_search_multiple_cancelled_document_references_for_valid_patient_details(
    test_data,
):
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


def test_search_deleted_document_references_are_not_returned(test_data):
    deletion_date = datetime.now(timezone.utc)
    document_ttl_days = DocumentRetentionDays.SOFT_DELETE
    ttl_seconds = document_ttl_days * 24 * 60 * 60
    document_reference_ttl = int(deletion_date.timestamp() + ttl_seconds)

    create_and_store_pdm_record(
        test_data,
        doc_status="deprecated",
        Deleted=deletion_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        ttl=document_reference_ttl,
    )

    create_and_store_pdm_record(
        test_data,
        doc_status="deprecated",
        Deleted=deletion_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        ttl=document_reference_ttl,
    )

    response = search_document_reference(TEST_NHS_NUMBER)
    assert response.status_code == 200

    bundle = response.json()
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "searchset"
    assert bundle["total"] == 0
    assert "entry" in bundle
    assert bundle["entry"] == []


def test_search_mixed_deleted_and_not_deleted_document_references(test_data):
    non_deleted_record = create_and_store_pdm_record(test_data)
    expected_non_deleted_id = non_deleted_record["id"]

    deletion_date = datetime.now(timezone.utc)
    document_ttl_days = DocumentRetentionDays.SOFT_DELETE
    ttl_seconds = document_ttl_days * 24 * 60 * 60
    document_reference_ttl = int(deletion_date.timestamp() + ttl_seconds)

    deleted_record = create_and_store_pdm_record(
        test_data,
        doc_status="deprecated",
        Deleted=deletion_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        ttl=document_reference_ttl,
    )
    deleted_record_id = deleted_record["id"]

    response = search_document_reference(TEST_NHS_NUMBER)
    assert response.status_code == 200

    bundle = response.json()
    entries = bundle.get("entry", [])

    # Assert the non-deleted record is returned
    matching_non_deleted = next(
        (
            e
            for e in entries
            if e["resource"].get("id") == f"{PDM_SNOMED}~{expected_non_deleted_id}"
        ),
        None,
    )
    assert matching_non_deleted

    # Assert the deleted record isn't returned
    matching_deleted = next(
        (
            e
            for e in entries
            if e["resource"].get("id") == f"{PDM_SNOMED}~{deleted_record_id}"
        ),
        None,
    )
    assert matching_deleted is None


@pytest.mark.parametrize(
    "extra_params",
    [
        {"next-page-token": "123"},
        {"next-page-token": "abc"},
    ],
)
def test_search_ignores_next_page_token(test_data, extra_params):
    create_and_store_pdm_record(test_data)

    response = search_document_reference(TEST_NHS_NUMBER, extra_params=extra_params)

    assert response.status_code == 200
    entries = response.json().get("entry", [])
    assert entries
