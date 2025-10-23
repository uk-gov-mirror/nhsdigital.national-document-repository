import io
import logging
import uuid

import pytest

from lambdas.tests.e2e.api.fhir.conftest import MTLS_ENDPOINT, create_mtls_session
from lambdas.tests.e2e.helpers.pdm_data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


def build_pdm_record(nhs_number="9912003071", data=None, doc_status=None):
    """Helper to create a PDM record dictionary."""
    record = {
        "id": str(uuid.uuid4()),
        "nhs_number": nhs_number,
        "data": data or io.BytesIO(b"Sample PDF Content"),
    }
    if doc_status:
        record["doc_status"] = doc_status
    return record


def search_document_reference(nhs_number):
    """Helper to perform search by NHS number."""
    url = (
        f"https://{MTLS_ENDPOINT}/DocumentReference?"
        f"subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{nhs_number}"
    )
    headers = {
        "Authorization": "Bearer 123",
        "X-Correlation-Id": "1234",
    }
    session = create_mtls_session()
    return session.get(url, headers=headers)


def create_and_store_record(test_data, nhs_number="9912003071", doc_status=None):
    """Helper to create metadata and resource for a record."""
    record = build_pdm_record(nhs_number=nhs_number, doc_status=doc_status)
    test_data.append(record)
    pdm_data_helper.create_metadata(record)
    pdm_data_helper.create_resource(record)
    return record


def test_search_patient_details(test_data):
    """Search for a patient with one record."""
    create_and_store_record(test_data)
    response = search_document_reference("9912003071")
    assert response.status_code == 200
    bundle = response.json()
    logging.info(bundle)
    assert "entry" in bundle  # Basic validation


def test_multiple_cancelled_search_patient_details(test_data):
    """Search for a patient with multiple cancelled records."""
    create_and_store_record(test_data, doc_status="cancelled")
    create_and_store_record(test_data, doc_status="cancelled")
    response = search_document_reference("9912003071")
    assert response.status_code == 200
    bundle = response.json()
    assert len(bundle.get("entry", [])) >= 2


@pytest.mark.parametrize(
    "nhs_number,expected_status",
    [
        ("9912003071", 404),  # No records
        ("9999999993", 400),  # Invalid patient
    ],
)
def test_search_edge_cases(nhs_number, expected_status):
    """Test search for no records and invalid patient."""
    response = search_document_reference(nhs_number)
    assert response.status_code == expected_status
