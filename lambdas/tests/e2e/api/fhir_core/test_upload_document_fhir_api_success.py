import base64
import logging
import os

from tests.e2e.api.fhir.conftest import (
    PDM_SNOMED,
    retrieve_document_with_retry,
)
from tests.e2e.conftest import APIM_ENDPOINT
from tests.e2e.helpers.data_helper import PdmDataHelper
from tests.e2e.helpers.rest_helper import upload_document_reference

pdm_data_helper = PdmDataHelper()


def test_create_document_base64(test_data):
    record = {
        "ods": "H81109",
        "nhs_number": "9912003071",
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(record)

    raw_upload_response = upload_document_reference(payload)
    assert raw_upload_response.status_code == 201
    record["id"] = raw_upload_response.json()["id"].split("~")[1]
    test_data.append(record)

    # Validate attachment URL
    upload_response = raw_upload_response.json()
    attachment_url = upload_response["content"][0]["attachment"]["url"]
    assert (
        f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{PDM_SNOMED}~"
        in attachment_url
    )

    def condition(response_json):
        logging.info(response_json)
        return response_json["content"][0]["attachment"].get("data", False)

    raw_retrieve_response = retrieve_document_with_retry(
        upload_response["id"], condition
    )
    retrieve_response = raw_retrieve_response.json()

    # Validate base64 data
    base64_data = retrieve_response["content"][0]["attachment"]["data"]
    assert base64.b64decode(base64_data, validate=True)


def test_create_document_saves_raw(test_data):
    record = {
        "ods": "H81109",
        "nhs_number": "9912003071",
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(record)

    raw_upload_response = upload_document_reference(payload)
    assert raw_upload_response.status_code == 201
    record["id"] = raw_upload_response.json()["id"].split("~")[1]
    test_data.append(record)

    doc_ref = pdm_data_helper.retrieve_document_reference(record=record)
    assert "Item" in doc_ref
    assert "RawRequest" in doc_ref["Item"]
    assert "Author" in doc_ref["Item"]
    assert doc_ref["Item"]["RawRequest"]
    assert doc_ref["Item"]["RawRequest"] == payload


def test_create_document_without_author_or_type(test_data):
    record = {
        "ods": "H81109",
        "nhs_number": "9912003071",
    }

    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        record["data"] = base64.b64encode(f.read()).decode("utf-8")
    payload = pdm_data_helper.create_upload_payload(
        record=record, exclude=["type", "author"]
    )

    for field in ["type", "author"]:
        assert field not in payload
    raw_upload_response = upload_document_reference(payload)
    assert raw_upload_response.status_code == 201
    record["id"] = raw_upload_response.json()["id"].split("~")[1]
    test_data.append(record)

    doc_ref = pdm_data_helper.retrieve_document_reference(record=record)
    assert "Item" in doc_ref
    assert "RawRequest" in doc_ref["Item"]
    assert "Author" not in doc_ref["Item"]
    assert doc_ref["Item"]["RawRequest"]
    assert doc_ref["Item"]["RawRequest"] == payload
    for field in ["type", "author"]:
        assert field not in doc_ref["Item"]["RawRequest"]
