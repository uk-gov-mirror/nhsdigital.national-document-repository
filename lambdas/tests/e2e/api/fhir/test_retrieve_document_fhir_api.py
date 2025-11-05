import base64
import io

import pytest
import requests
from tests.e2e.helpers.data_helper import PdmDataHelper

from lambdas.tests.e2e.api.fhir.conftest import (
    MTLS_ENDPOINT,
    PDM_S3_BUCKET,
    create_mtls_session,
)
from lambdas.tests.e2e.conftest import PDM_SNOMED

pdm_data_helper = PdmDataHelper()


def get_document_reference(record_id):
    """Helper to perform GET request for DocumentReference."""
    url = f"https://{MTLS_ENDPOINT}/DocumentReference/{PDM_SNOMED}~{record_id}"
    headers = {
        "X-Correlation-Id": "1234",
    }
    session = create_mtls_session()
    return session.get(url, headers=headers)


@pytest.mark.parametrize("file_size", [None, 10 * 1024 * 1024])
def test_file_retrieval(test_data, file_size):
    """Test retrieval for small and large files."""
    pdm_record = pdm_data_helper.build_record(
        data=io.BytesIO(b"A" * file_size) if file_size else None,
        size=file_size * 1024 if file_size else None,
    )
    test_data.append(pdm_record)

    pdm_data_helper.create_metadata(pdm_record)
    pdm_data_helper.create_resource(pdm_record)

    response = get_document_reference(pdm_record["id"])
    assert response.status_code == 200

    json = response.json()

    if not file_size:
        data = json["content"][0]["attachment"]["data"]
        decoded_data = base64.b64decode(data)
        expected_bytes = b"Sample PDF Content"
        assert decoded_data == expected_bytes
    else:
        expected_presign_uri = (
            f"https://{PDM_S3_BUCKET}.s3.eu-west-2.amazonaws.com/"
            f"{pdm_record['nhs_number']}/{pdm_record['id']}"
        )
        assert expected_presign_uri in json["content"][0]["attachment"]["url"]


@pytest.mark.parametrize(
    "nhs_id,expected_status,expected_code,expected_diagnostics",
    [
        ("9912003071", 404, "RESOURCE_NOT_FOUND", "Document reference not found"),
    ],
)
def test_retrieve_edge_cases(
    nhs_id, expected_status, expected_code, expected_diagnostics
):
    response = get_document_reference(nhs_id)
    assert response.status_code == expected_status

    body = response.json()
    issue = body["issue"][0]

    details = issue.get("details", {})
    coding = details.get("coding", [{}])[0]

    assert coding.get("code") == expected_code
    assert issue.get("diagnostics") == expected_diagnostics


def test_preliminary_file(test_data):
    pdm_record = pdm_data_helper.build_record(doc_status="preliminary")
    test_data.append(pdm_record)
    pdm_data_helper.create_metadata(pdm_record)
    pdm_data_helper.create_resource(pdm_record)

    response = get_document_reference(pdm_record["id"])
    assert response.status_code == 200

    response_json = response.json()
    assert response_json.get("docStatus") == "preliminary"


def test_forbidden_with_invalid_cert(test_data, temp_cert_and_key):
    pdm_record = pdm_data_helper.build_record()
    test_data.append(pdm_record)
    pdm_data_helper.create_metadata(pdm_record)
    pdm_data_helper.create_resource(pdm_record)

    # Use an invalid cert that is trusted by TLS but fails truststore validation
    cert_path, key_path = temp_cert_and_key
    url = f"https://{MTLS_ENDPOINT}/DocumentReference/{PDM_SNOMED}~{pdm_record['id']}"
    headers = {"Authorization": "Bearer 123", "X-Correlation-Id": "1234"}

    response = requests.get(url, headers=headers, cert=(cert_path, key_path))
    body = response.json()
    assert response.status_code == 403
    assert body["message"] == "Forbidden"
