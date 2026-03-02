import base64
import json
import logging
import os

from tests.e2e.api.fhir.conftest import (
    PDM_SNOMED,
    TEST_NHS_NUMBER,
    retrieve_document_with_retry,
    upload_document,
)
from tests.e2e.conftest import APIM_ENDPOINT
from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


def strip_attachment_data(payload: str) -> str:
    """Strip base64 data from content attachments to match stored raw_request."""
    parsed = json.loads(payload)
    for content_item in parsed.get("content", []):
        content_item.get("attachment", {}).pop("data", None)
    return json.dumps(parsed)


def test_create_document_base64(test_data):
    record = {
        "ods": "H81109",
        "nhs_number": TEST_NHS_NUMBER,
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(record)

    raw_upload_response = upload_document(payload)
    assert raw_upload_response.status_code == 201
    upload_response = raw_upload_response.json()
    record["id"] = upload_response["id"].split("~")[1]
    test_data.append(record)

    assert "Location" in raw_upload_response.headers
    expected_location = f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{upload_response['id']}"
    assert raw_upload_response.headers["Location"] == expected_location

    # Validate attachment URL
    attachment_url = upload_response["content"][0]["attachment"]["url"]
    assert (
        f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{PDM_SNOMED}~"
        in attachment_url
    )

    def condition(response_json):
        logging.info(response_json)
        return response_json["content"][0]["attachment"].get("data", False)

    raw_retrieve_response = retrieve_document_with_retry(
        upload_response["id"],
        condition,
    )
    retrieve_response = raw_retrieve_response.json()

    # Validate base64 data
    base64_data = retrieve_response["content"][0]["attachment"]["data"]
    assert base64.b64decode(base64_data, validate=True)


def test_create_document_base64_medium_file(test_data):
    """Test uploading a ~1.5MB PDF file via base64 succeeds."""
    record = {
        "ods": "H81109",
        "nhs_number": TEST_NHS_NUMBER,
    }

    sample_pdf_path = os.path.join(
        os.path.dirname(__file__),
        "files",
        "medium-dummy.pdf",
    )
    with open(sample_pdf_path, "rb") as f:
        file_content = f.read()
        record["data"] = base64.b64encode(file_content).decode("utf-8")

    payload = pdm_data_helper.create_upload_payload(record)

    raw_upload_response = upload_document(payload)
    assert raw_upload_response.status_code == 201
    upload_response = raw_upload_response.json()
    record["id"] = upload_response["id"].split("~")[1]
    test_data.append(record)

    assert "Location" in raw_upload_response.headers
    expected_location = f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{upload_response['id']}"
    assert raw_upload_response.headers["Location"] == expected_location

    attachment_url = upload_response["content"][0]["attachment"]["url"]
    assert (
        f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{PDM_SNOMED}~"
        in attachment_url
    )

    def condition(response_json):
        logging.info(response_json)
        return response_json["content"][0]["attachment"].get("data", False)

    raw_retrieve_response = retrieve_document_with_retry(
        upload_response["id"],
        condition,
    )
    retrieve_response = raw_retrieve_response.json()

    base64_data = retrieve_response["content"][0]["attachment"]["data"]
    decoded = base64.b64decode(base64_data, validate=True)
    assert decoded == file_content


def test_create_document_saves_raw(test_data):
    record = {
        "ods": "H81109",
        "nhs_number": TEST_NHS_NUMBER,
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(record)

    raw_upload_response = upload_document(payload)
    assert raw_upload_response.status_code == 201
    upload_response = raw_upload_response.json()
    record["id"] = upload_response["id"].split("~")[1]
    test_data.append(record)

    assert "Location" in raw_upload_response.headers
    expected_location = f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{upload_response['id']}"
    assert raw_upload_response.headers["Location"] == expected_location

    doc_ref = pdm_data_helper.retrieve_document_reference(record=record)
    assert "Item" in doc_ref
    assert "RawRequest" in doc_ref["Item"]
    assert "Author" in doc_ref["Item"]
    assert doc_ref["Item"]["RawRequest"]
    assert doc_ref["Item"]["RawRequest"] == strip_attachment_data(payload)


def test_create_document_without_author_or_type(test_data):
    record = {
        "ods": "H81109",
        "nhs_number": TEST_NHS_NUMBER,
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(
        record=record,
        exclude=["type", "author"],
    )

    for field in ["type", "author"]:
        assert field not in payload
    raw_upload_response = upload_document(payload)
    assert raw_upload_response.status_code == 201
    upload_response = raw_upload_response.json()
    record["id"] = upload_response["id"].split("~")[1]
    test_data.append(record)

    assert "Location" in raw_upload_response.headers
    expected_location = f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{upload_response['id']}"
    assert raw_upload_response.headers["Location"] == expected_location

    doc_ref = pdm_data_helper.retrieve_document_reference(record=record)
    assert "Item" in doc_ref
    assert "RawRequest" in doc_ref["Item"]
    assert "Author" not in doc_ref["Item"]
    assert doc_ref["Item"]["RawRequest"]
    assert doc_ref["Item"]["RawRequest"] == strip_attachment_data(payload)
    for field in ["type", "author"]:
        assert field not in doc_ref["Item"]["RawRequest"]


def test_create_document_without_title(test_data):
    record = {
        "ods": "H81109",
        "nhs_number": TEST_NHS_NUMBER,
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(record=record, exclude=["title"])
    assert "title" not in payload

    raw_upload_response = upload_document(payload)
    assert raw_upload_response.status_code == 201
    upload_response = raw_upload_response.json()
    record["id"] = upload_response["id"].split("~")[1]
    test_data.append(record)

    assert "Location" in raw_upload_response.headers
    expected_location = f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{upload_response['id']}"
    assert raw_upload_response.headers["Location"] == expected_location

    doc_ref = pdm_data_helper.retrieve_document_reference(record=record)
    assert "Item" in doc_ref
    assert "RawRequest" in doc_ref["Item"]

    assert doc_ref["Item"]["RawRequest"] == strip_attachment_data(payload)

    raw_request = json.loads(doc_ref["Item"]["RawRequest"])
    assert "content" in raw_request
    content = raw_request["content"]
    assert "attachment" in content[0]
    attachment = raw_request["content"][0]["attachment"]
    assert "title" not in attachment
