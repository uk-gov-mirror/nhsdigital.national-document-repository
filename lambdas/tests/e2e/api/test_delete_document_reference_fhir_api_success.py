import io
import uuid

import requests
from tests.e2e.conftest import API_ENDPOINT, API_KEY
from tests.e2e.helpers.data_helper import LloydGeorgeDataHelper

data_helper = LloydGeorgeDataHelper()


def _search_document_status(body, expected):
    assert body["resourceType"] == "Bundle"
    for entry in body["entry"]:
        assert entry["resource"]["docStatus"] == expected


def test_delete_record_by_patient_details(test_data):
    lloyd_george_record = {}
    test_data.append(lloyd_george_record)

    lloyd_george_record["id"] = str(uuid.uuid4())
    lloyd_george_record["nhs_number"] = "9449305943"
    lloyd_george_record["data"] = io.BytesIO(b"Sample PDF Content")

    data_helper.create_metadata(lloyd_george_record)
    data_helper.create_resource(lloyd_george_record)

    url = f"https://{API_ENDPOINT}/FhirDocumentReference?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{lloyd_george_record['nhs_number']}&_id={lloyd_george_record['id']}"
    headers = {
        "Authorization": "Bearer 123",
        "X-Api-Key": API_KEY,
        "X-Correlation-Id": "1234",
    }
    get_response = requests.request("GET", url, headers=headers)
    assert get_response.status_code == 200
    _search_document_status(get_response.json(), "final")

    delete_response = requests.request("DELETE", url, headers=headers)
    assert delete_response.status_code == 204

    get_response_final = requests.request("GET", url, headers=headers)
    assert get_response_final.status_code == 200
    _search_document_status(get_response_final.json(), "deprecated")


def test_delete_record_by_patient_details_and_get_by_id(test_data):
    lloyd_george_record = {}
    test_data.append(lloyd_george_record)

    lloyd_george_record["id"] = str(uuid.uuid4())
    lloyd_george_record["nhs_number"] = "9449305943"
    lloyd_george_record["data"] = io.BytesIO(b"Sample PDF Content")

    data_helper.create_metadata(lloyd_george_record)
    data_helper.create_resource(lloyd_george_record)

    url = f"https://{API_ENDPOINT}/FhirDocumentReference/{lloyd_george_record['id']}"
    headers = {
        "Authorization": "Bearer 123",
        "X-Api-Key": API_KEY,
        "X-Correlation-Id": "1234",
    }
    get_response = requests.request("GET", url, headers=headers)
    assert get_response.status_code == 200

    delete_url = f"https://{API_ENDPOINT}/FhirDocumentReference?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{lloyd_george_record['nhs_number']}&_id={lloyd_george_record['id']}"
    delete_response = requests.request("DELETE", delete_url, headers=headers)
    assert delete_response.status_code == 204

    get_response_final = requests.request("GET", url, headers=headers)
    assert get_response_final.status_code == 404
