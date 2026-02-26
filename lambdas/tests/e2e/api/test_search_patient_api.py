import io
import logging
import uuid

import requests
from syrupy.filters import paths

from tests.e2e.conftest import API_ENDPOINT, API_KEY, APIM_ENDPOINT
from tests.e2e.helpers.data_helper import LloydGeorgeDataHelper

data_helper = LloydGeorgeDataHelper()


def test_search_patient_details(test_data, snapshot_json):
    lloyd_george_record = {}
    test_data.append(lloyd_george_record)

    lloyd_george_record["id"] = str(uuid.uuid4())
    lloyd_george_record["nhs_number"] = "9449305943"
    lloyd_george_record["data"] = io.BytesIO(b"Sample PDF Content")

    data_helper.create_metadata(lloyd_george_record)
    data_helper.create_resource(lloyd_george_record)

    url = f"https://{API_ENDPOINT}/FhirDocumentReference?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{lloyd_george_record['nhs_number']}"
    headers = {
        "Authorization": "Bearer 123",
        "X-Api-Key": API_KEY,
        "X-Correlation-Id": "1234",
    }
    response = requests.request("GET", url, headers=headers)
    bundle = response.json()
    logging.info(bundle)

    attachment_url = bundle["entry"][0]["resource"]["content"][0]["attachment"]["url"]
    assert (
        f"https://{APIM_ENDPOINT}/national-document-repository/FHIR/R4/DocumentReference/{lloyd_george_record['id']}"
        in attachment_url
    )

    assert bundle == snapshot_json(
        exclude=paths(
            "entry.0.resource.id",
            "entry.0.resource.date",
            "entry.0.resource.content.0.attachment.url",
            "timestamp",
        ),
    )


def test_multiple_cancelled_search_patient_details(test_data, snapshot_json):
    lloyd_george_record = {}
    test_data.append(lloyd_george_record)

    lloyd_george_record["id"] = str(uuid.uuid4())
    lloyd_george_record["nhs_number"] = "9449305943"
    lloyd_george_record["data"] = io.BytesIO(b"Sample PDF Content")
    lloyd_george_record["doc_status"] = "cancelled"

    data_helper.create_metadata(lloyd_george_record)
    data_helper.create_resource(lloyd_george_record)

    second_lloyd_george_record = {}
    test_data.append(second_lloyd_george_record)

    second_lloyd_george_record["id"] = str(uuid.uuid4())
    second_lloyd_george_record["nhs_number"] = "9449305943"
    second_lloyd_george_record["data"] = io.BytesIO(b"Sample PDF Content")
    second_lloyd_george_record["doc_status"] = "cancelled"

    data_helper.create_metadata(second_lloyd_george_record)
    data_helper.create_resource(second_lloyd_george_record)

    url = f"https://{API_ENDPOINT}/FhirDocumentReference?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{lloyd_george_record['nhs_number']}"
    headers = {
        "Authorization": "Bearer 123",
        "X-Api-Key": API_KEY,
        "X-Correlation-Id": "1234",
    }
    response = requests.request("GET", url, headers=headers)
    bundle = response.json()

    assert bundle["entry"][0] == snapshot_json(
        exclude=paths(
            "resource.id",
            "resource.date",
            "resource.content.0.attachment.url",
        ),
    )
    assert bundle["entry"][1] == snapshot_json(
        exclude=paths(
            "resource.id",
            "resource.date",
            "resource.content.0.attachment.url",
        ),
    )


def test_no_records(snapshot_json):
    lloyd_george_record = {}
    lloyd_george_record["nhs_number"] = "9449305943"

    url = f"https://{API_ENDPOINT}/FhirDocumentReference?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{lloyd_george_record['nhs_number']}"
    headers = {
        "Authorization": "Bearer 123",
        "X-Api-Key": API_KEY,
        "X-Correlation-Id": "1234",
    }
    response = requests.request("GET", url, headers=headers)
    bundle = response.json()

    assert bundle == snapshot_json(
        exclude=paths(
            "entry.0.resource.id",
            "entry.0.resource.date",
            "entry.0.resource.content.0.attachment.url",
            "timestamp",
        ),
    )


def test_invalid_patient(snapshot_json):
    lloyd_george_record = {}
    lloyd_george_record["nhs_number"] = "9999999993"

    url = f"https://{API_ENDPOINT}/FhirDocumentReference?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{lloyd_george_record['nhs_number']}"
    headers = {
        "Authorization": "Bearer 123",
        "X-Api-Key": API_KEY,
        "X-Correlation-Id": "1234",
    }
    response = requests.request("GET", url, headers=headers)
    bundle = response.json()

    assert bundle == snapshot_json


def test_search_patient_details_deleted_are_not_returned(test_data):
    lloyd_george_record = {}
    test_data.append(lloyd_george_record)

    lloyd_george_record["id"] = str(uuid.uuid4())
    lloyd_george_record["nhs_number"] = "9449305943"
    lloyd_george_record["data"] = io.BytesIO(b"Sample PDF Content")

    data_helper.create_metadata(lloyd_george_record)
    data_helper.create_resource(lloyd_george_record)

    second_lloyd_george_record = {}
    test_data.append(second_lloyd_george_record)

    second_lloyd_george_record["id"] = str(uuid.uuid4())
    second_lloyd_george_record["nhs_number"] = "9449305943"
    second_lloyd_george_record["data"] = io.BytesIO(b"Sample PDF Content")

    data_helper.create_metadata(second_lloyd_george_record)
    data_helper.create_resource(second_lloyd_george_record)

    url = f"https://{API_ENDPOINT}/FhirDocumentReference?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{lloyd_george_record['nhs_number']}&_id={second_lloyd_george_record['id']}"
    headers = {
        "Authorization": "Bearer 123",
        "X-Api-Key": API_KEY,
        "X-Correlation-Id": "1234",
    }

    delete_response = requests.request("DELETE", url, headers=headers)
    assert delete_response.status_code == 204

    url = f"https://{API_ENDPOINT}/FhirDocumentReference?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{lloyd_george_record['nhs_number']}"
    headers = {
        "Authorization": "Bearer 123",
        "X-Api-Key": API_KEY,
        "X-Correlation-Id": "1234",
    }
    response = requests.request("GET", url, headers=headers)
    bundle = response.json()
    assert bundle["total"] < 2
    entries = bundle.get("entry", [])
    assert entries

    # Find the entry with the matching record_id
    matching_entry = next(
        (
            e
            for e in entries
            if e["resource"].get("id") == f"{lloyd_george_record['id']}"
        ),
        None,
    )
    assert matching_entry
    # Assert deleted item doesn't exist
    non_matching_entry = next(
        (
            e
            for e in entries
            if e["resource"].get("id") == f"{second_lloyd_george_record['id']}"
        ),
        None,
    )
    assert non_matching_entry is None
