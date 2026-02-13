import base64
import json
import logging
import os

import pytest
import requests
from tests.e2e.api.fhir.conftest import (
    MTLS_ENDPOINT,
    retrieve_document_with_retry,
)
from tests.e2e.helpers.data_helper import PdmDataHelper
from tests.e2e.helpers.rest_helper import upload_document_reference

pdm_data_helper = PdmDataHelper()


def test_create_document_presign_fails():
    record = {
        "ods": "H81109",
        "nhs_number": "9912003071",
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "big-dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(record)

    upload_response = upload_document_reference(payload)
    assert upload_response.status_code == 413
    assert upload_response.text == "HTTP content length exceeded 10485760 bytes."


def test_create_document_virus(test_data):
    record = {
        "ods": "H81109",
        "nhs_number": "9730154260",
    }

    # Attach EICAR data
    eicar_string = (
        r"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    )
    record["data"] = base64.b64encode(eicar_string.encode()).decode()
    payload = pdm_data_helper.create_upload_payload(record)

    raw_upload_response = upload_document_reference(payload)
    assert raw_upload_response.status_code == 201
    upload_response = raw_upload_response.json()
    record["id"] = upload_response["id"].split("~")[1]
    test_data.append(record)

    # Poll until processing/scan completes
    def condition(response_json):
        logging.info(response_json)
        return response_json.get("docStatus") in (
            "cancelled",
            "final",
        )

    raw_retrieve_response = retrieve_document_with_retry(
        upload_response["id"], condition
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
            "Failed to parse document upload request data: Invalid NHS number format",
        ),
        (
            "123",
            400,
            "VALIDATION_ERROR",
            "Failed to parse document upload request data: Invalid NHS number length",
        ),
    ],
)
def test_search_edge_cases(
    nhs_number, expected_status, expected_code, expected_diagnostics
):
    record = {
        "ods": "H81109",
        "nhs_number": f"{nhs_number}",
    }

    sample_pdf_bytes = b"Sample PDF Content"
    record["data"] = base64.b64encode(sample_pdf_bytes).decode("utf-8")

    payload = pdm_data_helper.create_upload_payload(record)
    response = upload_document_reference(payload)
    assert response.status_code == expected_status

    body = response.json()
    issue = body["issue"][0]
    details = issue.get("details", {})
    coding = details.get("coding", [{}])[0]
    assert coding.get("code") == expected_code
    assert issue.get("diagnostics") == expected_diagnostics


def test_forbidden_with_invalid_cert(temp_cert_and_key):
    record = {
        "ods": "H81109",
        "nhs_number": "9912003071",
    }

    sample_pdf_bytes = b"Sample PDF Content"
    record["data"] = base64.b64encode(sample_pdf_bytes).decode("utf-8")

    payload = pdm_data_helper.create_upload_payload(record)

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


@pytest.mark.parametrize(
    "author_payload",
    [({}), {"identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code"}}],
)
def test_create_document_with_invalid_author_returns_error(test_data, author_payload):
    record = {
        "ods": "H81109",
        "nhs_number": "9912003071",
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(record=record, return_json=True)
    payload["author"][0] = author_payload
    payload = json.dumps(payload)

    raw_upload_response = upload_document_reference(payload)
    response_json = raw_upload_response.json()
    assert raw_upload_response.status_code == 400
    assert response_json["resourceType"] == "OperationOutcome"
    assert (
        response_json["issue"][0]["details"]["coding"][0]["code"] == "VALIDATION_ERROR"
    )


def test_upload_invalid_resource_type(test_data):
    record = {
        "ods": "H81109",
        "nhs_number": "9912003071",
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(record=record, return_json=True)
    payload = json.dumps(payload)

    raw_upload_response = upload_document_reference(payload, resource_type="FooBar")
    assert raw_upload_response.status_code == 403

    response_json = raw_upload_response.json()
    assert response_json["message"] == "Missing Authentication Token"
