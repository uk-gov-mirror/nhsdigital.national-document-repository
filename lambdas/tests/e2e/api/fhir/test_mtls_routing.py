import os
import uuid

from lambdas.tests.e2e.api.fhir.conftest import get_pdm_document_reference

UNAUTHORISED_CLIENT_CERT_PATH = os.environ.get("UNAUTHORISED_CLIENT_CERT_PATH")
UNAUTHORISED_CLIENT_KEY_PATH = os.environ.get("UNAUTHORISED_CLIENT_KEY_PATH")


def test_mtls_invalid_common_name():
    record_id = str(uuid.uuid4())
    response = get_pdm_document_reference(
        record_id, UNAUTHORISED_CLIENT_CERT_PATH, UNAUTHORISED_CLIENT_KEY_PATH
    )
    assert response.status_code == 400

    data = response.json()
    diagnostics = data.get("issue", [{}])[0].get("diagnostics", "")
    assert diagnostics == "Invalid document type requested"
