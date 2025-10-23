import io
import uuid

import pytest
import requests
from tests.e2e.helpers.pdm_data_helper import PdmDataHelper

from lambdas.tests.e2e.api.fhir.conftest import (
    MTLS_ENDPOINT,
    PDM_S3_BUCKET,
    PDM_SNOMED,
    create_mtls_session,
)

pdm_data_helper = PdmDataHelper()


def build_pdm_record(nhs_number="9912003071", data=None, doc_status=None, size=None):
    """Helper to create a PDM record dictionary."""
    record = {
        "id": str(uuid.uuid4()),
        "nhs_number": nhs_number,
        "data": data or io.BytesIO(b"Sample PDF Content"),
    }
    if doc_status:
        record["doc_status"] = doc_status
    if size:
        record["size"] = size
    return record


def get_document_reference(record_id):
    """Helper to perform GET request for DocumentReference."""
    url = f"https://{MTLS_ENDPOINT}/DocumentReference/{PDM_SNOMED}~{record_id}"
    print("url:", url)
    headers = {
        "Authorization": "Bearer 123",
        "X-Correlation-Id": "1234",
    }
    session = create_mtls_session()
    return session.get(url, headers=headers)


@pytest.mark.parametrize("file_size", [None, 10 * 1024 * 1024])
def test_file_retrieval(test_data, file_size):
    """Test retrieval for small and large files."""
    pdm_record = build_pdm_record(
        data=io.BytesIO(b"A" * file_size) if file_size else None,
        size=file_size * 1024 if file_size else None,
    )
    test_data.append(pdm_record)

    pdm_data_helper.create_metadata(pdm_record)
    pdm_data_helper.create_resource(pdm_record)

    response = get_document_reference(pdm_record["id"])
    assert response.status_code == 200

    if file_size:
        json = response.json()
        expected_presign_uri = (
            f"https://{PDM_S3_BUCKET}.s3.eu-west-2.amazonaws.com/"
            f"{pdm_record['nhs_number']}/{pdm_record['id']}"
        )
        assert expected_presign_uri in json["content"][0]["attachment"]["url"]


def test_no_file_found():
    """Test retrieval when file does not exist."""
    pdm_record = build_pdm_record()
    response = get_document_reference(pdm_record["id"])
    assert response.status_code == 404


def test_preliminary_file(test_data):
    """Test retrieval for preliminary document status."""
    pdm_record = build_pdm_record(doc_status="preliminary")
    test_data.append(pdm_record)

    pdm_data_helper.create_metadata(pdm_record)
    pdm_data_helper.create_resource(pdm_record)

    response = get_document_reference(pdm_record["id"])
    assert response.status_code == 200


# the error is about the auth token not mtls?
def test_forbidden_without_mtls(test_data):
    pdm_record = build_pdm_record()
    test_data.append(pdm_record)

    pdm_data_helper.create_metadata(pdm_record)
    pdm_data_helper.create_resource(pdm_record)

    url = (
        f"https://{MTLS_ENDPOINT}/FhirDocumentReference/{PDM_SNOMED}~{pdm_record['id']}"
    )
    headers = {
        "Authorization": "Bearer 123",
        "X-Correlation-Id": "1234",
    }
    response = requests.request("GET", url, headers=headers)
    print("inital response:", response)
    json = response.json()
    print("response:", json)

    assert response.status_code == 403
