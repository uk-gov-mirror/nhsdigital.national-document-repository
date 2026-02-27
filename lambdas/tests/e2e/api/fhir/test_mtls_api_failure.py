import os
import uuid

import pytest

from tests.e2e.api.fhir.conftest import (
    MTLS_ENDPOINT,
    create_and_store_pdm_record,
    create_mtls_session,
    get_pdm_document_reference,
)
from tests.e2e.helpers.data_helper import PdmDataHelper

UNAUTHORISED_CLIENT_CERT_PATH = os.environ.get("UNAUTHORISED_CLIENT_CERT_PATH")
UNAUTHORISED_CLIENT_KEY_PATH = os.environ.get("UNAUTHORISED_CLIENT_KEY_PATH")

pdm_data_helper = PdmDataHelper()


def test_forbidden_with_invalid_cert(test_data, temp_cert_and_key):
    pdm_record = create_and_store_pdm_record(test_data)

    # Use an invalid cert that is trusted by TLS but fails truststore validation
    cert_path, key_path = temp_cert_and_key

    response = get_pdm_document_reference(
        pdm_record["id"],
        client_cert_path=cert_path,
        client_key_path=key_path,
    )

    assert response.status_code == 403
    body = response.json()
    assert body["resourceType"] == "OperationOutcome"
    assert len(body["issue"]) > 0
    issue = body["issue"][0]
    assert issue["severity"] == "error"
    assert issue["code"] == "security"
    assert "Forbidden" in issue["diagnostics"]


def test_invalid_resource_type_returns_fhir_error(test_data):
    pdm_record = create_and_store_pdm_record(test_data)

    response = get_pdm_document_reference(pdm_record["id"], resource_type="FooBar")
    assert response.status_code == 404

    body = response.json()
    assert body["resourceType"] == "OperationOutcome"
    assert len(body["issue"]) > 0
    issue = body["issue"][0]
    assert issue["severity"] == "error"
    assert issue["code"] == "not-found"
    assert (
        "The requested resource or HTTP method is not supported" in issue["diagnostics"]
    )


@pytest.mark.parametrize(
    "http_method",
    [
        "PATCH",
        "PUT",
    ],
)
def test_unsupported_http_method_returns_fhir_error(http_method):
    """Unsupported HTTP method triggers DEFAULT_4XX → OperationOutcome."""
    url = f"https://{MTLS_ENDPOINT}/DocumentReference/test-id"
    headers = {"X-Correlation-Id": "1234"}
    session = create_mtls_session()

    response = session.request(http_method, url, headers=headers)

    assert response.status_code == 404
    body = response.json()
    assert body["resourceType"] == "OperationOutcome"
    assert len(body["issue"]) > 0
    issue = body["issue"][0]
    assert issue["severity"] == "error"
    assert issue["code"] == "not-found"
    assert (
        "The requested resource or HTTP method is not supported" in issue["diagnostics"]
    )


# Commented this out for now as this will no longer retunr a 500 but now a 400
# invalid and I can't think of a way to get it to return a 500. Definietly something that needs to be tested though.
#
# def test_5xx_response_is_fhir_compliant(test_data):
#     """Verify that a Lambda error returns a FHIR-compliant OperationOutcome via DEFAULT_5XX."""
#
#     reversed_id = f"{str(uuid.uuid4())}~{pdm_data_helper.snomed_code}"
#
#     response = get_pdm_document_reference(
#         endpoint_override=reversed_id,
#     )
#
#     assert response.status_code == 500
#     body = response.json()
#     assert body["resourceType"] == "OperationOutcome"
#     assert len(body["issue"]) > 0
#     issue = body["issue"][0]
#     assert issue["severity"] == "error"


def test_mtls_invalid_common_name():
    record_id = str(uuid.uuid4())
    response = get_pdm_document_reference(
        record_id,
        UNAUTHORISED_CLIENT_CERT_PATH,
        UNAUTHORISED_CLIENT_KEY_PATH,
    )
    assert response.status_code == 400

    data = response.json()
    diagnostics = data.get("issue", [{}])[0].get("diagnostics", "")
    assert diagnostics == "Invalid document type requested"
