import base64
import json
import logging
import os

import pytest

from tests.e2e.api.fhir.conftest import (
    TEST_NHS_NUMBER,
    retrieve_document_with_retry,
    upload_document,
)
from tests.e2e.conftest import APIM_ENDPOINT
from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


def test_create_document_presign_fails():
    record = {
        "ods": "H81109",
        "nhs_number": TEST_NHS_NUMBER,
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "big-dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(record)

    upload_response = upload_document(payload)
    assert upload_response.status_code == 413
    assert "Location" not in upload_response.headers
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

    raw_upload_response = upload_document(payload)

    assert raw_upload_response.status_code == 201
    upload_response = raw_upload_response.json()
    record["id"] = upload_response["id"]
    test_data.append(record)

    assert "Location" in raw_upload_response.headers
    expected_location = f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{upload_response['id']}"
    assert raw_upload_response.headers["Location"] == expected_location

    # Poll until processing/scan completes
    def condition(response_json):
        logging.info(response_json)
        return response_json.get("docStatus") in (
            "cancelled",
            "final",
        )

    raw_retrieve_response = retrieve_document_with_retry(
        upload_response["id"],
        condition,
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
    nhs_number,
    expected_status,
    expected_code,
    expected_diagnostics,
):
    record = {
        "ods": "H81109",
        "nhs_number": f"{nhs_number}",
    }

    sample_pdf_bytes = b"Sample PDF Content"
    record["data"] = base64.b64encode(sample_pdf_bytes).decode("utf-8")

    payload = pdm_data_helper.create_upload_payload(record)
    response = upload_document(payload)
    assert response.status_code == expected_status
    assert "Location" not in response.headers

    body = response.json()
    issue = body["issue"][0]
    details = issue.get("details", {})
    coding = details.get("coding", [{}])[0]
    assert coding.get("code") == expected_code
    assert issue.get("diagnostics") == expected_diagnostics


@pytest.mark.parametrize(
    "author_payload",
    [({}), {"identifier": {"system": "https://fhir.nhs.uk/Id/ods-organization-code"}}],
)
def test_create_document_with_invalid_author_returns_error(test_data, author_payload):
    record = {
        "ods": "H81109",
        "nhs_number": TEST_NHS_NUMBER,
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(record=record, return_json=True)
    payload["author"][0] = author_payload
    payload = json.dumps(payload)

    raw_upload_response = upload_document(payload)
    assert raw_upload_response.status_code == 400
    assert "Location" not in raw_upload_response.headers
    response_json = raw_upload_response.json()
    assert response_json["resourceType"] == "OperationOutcome"
    assert (
        response_json["issue"][0]["details"]["coding"][0]["code"] == "VALIDATION_ERROR"
    )


def test_create_document_password_protected_docx(test_data):
    record = {
        "ods": "H81109",
        "nhs_number": "9730241708",
    }

    sample_docx_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "files",
            "password-protected.docx",
        ),
    )
    if not os.path.exists(sample_docx_path):
        pytest.skip("Password-protected DOCX fixture not found.")

    with open(sample_docx_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")

    payload = pdm_data_helper.create_upload_payload(
        record,
        content_type=(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        title=(
            "1of1_Lloyd_George_Record_[Paula Esme VESEY]_[9730154261]_[22-01-1960].docx"
        ),
    )

    raw_upload_response = upload_document(payload)
    assert raw_upload_response.status_code == 201
    upload_response = raw_upload_response.json()
    record["id"] = upload_response["id"].split("~")[1]
    test_data.append(record)

    def condition(response_json):
        logging.info(response_json)
        return response_json.get("docStatus") in (
            "cancelled",
            "final",
        )

    raw_retrieve_response = retrieve_document_with_retry(
        upload_response["id"],
        condition,
    )
    retrieve_response = raw_retrieve_response.json()

    assert retrieve_response["docStatus"] == "cancelled"
