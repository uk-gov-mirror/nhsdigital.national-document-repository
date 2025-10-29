import base64
import json
import logging
import os

import pytest
import requests

from lambdas.tests.e2e.api.fhir.conftest import (
    MTLS_ENDPOINT,
    PDM_SNOMED,
    create_mtls_session,
    fetch_with_retry_mtls,
)


def create_upload_payload(pdm_record):
    """Helper to build DocumentReference payload."""
    payload = {
        "resourceType": "DocumentReference",
        "type": {
            "coding": [
                {
                    "system": "https://snomed.info/sct",
                    "code": f"{PDM_SNOMED}",
                    "display": "Confidential patient data",
                }
            ]
        },
        "subject": {
            "identifier": {
                "system": "https://fhir.nhs.uk/Id/nhs-number",
                "value": pdm_record["nhs_number"],
            }
        },
        "author": [
            {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": pdm_record["ods"],
                }
            }
        ],
        "custodian": {
            "identifier": {
                "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                "value": pdm_record["ods"],
            }
        },
        "content": [
            {
                "attachment": {
                    "creation": "2023-01-01",
                    "contentType": "application/pdf",
                    "language": "en-GB",
                    "title": "1of1_pdm_record_[Paula Esme VESEY]_[9730153973]_[22-01-1960].pdf",
                }
            }
        ],
    }
    if "data" in pdm_record:
        payload["content"][0]["attachment"]["data"] = pdm_record["data"]
    return json.dumps(payload)


def upload_document(session, payload):
    """Helper to upload DocumentReference."""
    url = f"https://{MTLS_ENDPOINT}/DocumentReference"
    headers = {
        "Authorization": "Bearer 123",
        "X-Correlation-Id": "1234",
    }
    return session.post(url, headers=headers, data=payload)


def retrieve_document_with_retry(session, doc_id, condition):
    """Poll until condition is met on DocumentReference retrieval."""
    retrieve_url = f"https://{MTLS_ENDPOINT}/DocumentReference/{doc_id}"
    headers = {
        "Authorization": "Bearer 123",
        "X-Correlation-Id": "1234",
    }
    return fetch_with_retry_mtls(session, retrieve_url, headers, condition)


def test_create_document_base64(test_data):
    pdm_record = {
        "ods": "H81109",
        "nhs_number": "9912003071",
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        pdm_record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = create_upload_payload(pdm_record)

    session = create_mtls_session()
    raw_upload_response = upload_document(session, payload)
    assert raw_upload_response.status_code == 200

    # Validate attachment URL
    upload_response = raw_upload_response.json()
    attachment_url = upload_response["content"][0]["attachment"]["url"]
    assert f"/DocumentReference/{PDM_SNOMED}~" in attachment_url

    pdm_record["id"] = raw_upload_response.json()["id"].split("~")[1]
    test_data.append(pdm_record)

    def condition(response_json):
        logging.info(response_json)
        return response_json["content"][0]["attachment"].get("data", False)

    raw_retrieve_response = retrieve_document_with_retry(
        session, upload_response["id"], condition
    )
    retrieve_response = raw_retrieve_response.json()

    # Validate base64 data
    base64_data = retrieve_response["content"][0]["attachment"]["data"]
    assert base64.b64decode(base64_data, validate=True)


def test_create_document_presign_fails():
    pdm_record = {
        "ods": "H81109",
        "nhs_number": "9912003071",
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "big-dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        pdm_record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = create_upload_payload(pdm_record)

    session = create_mtls_session()
    upload_response = upload_document(session, payload)
    assert upload_response.status_code == 413
    assert upload_response.text == "HTTP content length exceeded 10485760 bytes."


def test_create_document_virus(test_data):
    pdm_record = {
        "ods": "H81109",
        "nhs_number": "9730154260",
    }
    payload = create_upload_payload(pdm_record)
    session = create_mtls_session()

    retrieve_response = upload_document(session, payload)
    upload_response = retrieve_response.json()

    pdm_record["id"] = upload_response["id"].split("~")[1]
    test_data.append(pdm_record)

    # Presigned upload
    presign_uri = upload_response["content"][0]["attachment"]["url"]
    del upload_response["content"][0]["attachment"]["url"]
    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        presign_response = requests.put(presign_uri, files={"file": f})
        assert presign_response.status_code == 200

    def condition(response_json):
        logging.info(response_json)
        return response_json.get("docStatus", False) == "cancelled"

    raw_retrieve_response = retrieve_document_with_retry(
        session, upload_response["id"], condition
    )
    retrieve_response = raw_retrieve_response.json()

    assert retrieve_response["docStatus"] == "cancelled"


@pytest.mark.parametrize(
    "nhs_number,expected_status,expected_code,expected_diagnostics",
    [
        (
            "9999999993",
            400,
            "VALIDATION_ERROR",
            "Failed to parse document upload request data",
        ),
        (
            "123",
            400,
            "VALIDATION_ERROR",
            "Failed to parse document upload request data",
        ),
    ],
)
def test_search_edge_cases(
    nhs_number, expected_status, expected_code, expected_diagnostics
):
    pdm_record = {
        "ods": "H81109",
        "nhs_number": f"{nhs_number}",
    }

    sample_pdf_bytes = b"Sample PDF Content"
    pdm_record["data"] = base64.b64encode(sample_pdf_bytes).decode("utf-8")

    payload = create_upload_payload(pdm_record)
    session = create_mtls_session()
    response = upload_document(session, payload)
    assert response.status_code == expected_status

    body = response.json()
    issue = body["issue"][0]
    details = issue.get("details", {})
    coding = details.get("coding", [{}])[0]
    assert coding.get("code") == expected_code
    assert issue.get("diagnostics") == expected_diagnostics


def test_forbidden_with_invalid_cert(temp_cert_and_key):
    pdm_record = {
        "ods": "H81109",
        "nhs_number": "9912003071",
    }

    sample_pdf_bytes = b"Sample PDF Content"
    pdm_record["data"] = base64.b64encode(sample_pdf_bytes).decode("utf-8")

    payload = create_upload_payload(pdm_record)

    # Use an invalid cert that is trusted by TLS but fails truststore validation
    cert_path, key_path = temp_cert_and_key
    url = f"https://{MTLS_ENDPOINT}/DocumentReference"
    headers = {"Authorization": "Bearer 123", "X-Correlation-Id": "1234"}

    response = requests.post(
        url, headers=headers, cert=(cert_path, key_path), data=payload
    )
    body = response.json()
    assert response.status_code == 403
    assert body["message"] == "Forbidden"
