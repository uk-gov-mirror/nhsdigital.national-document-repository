import base64
import json
import os

import pytest
import requests

from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()
PDM_SNOMED = pdm_data_helper.snomed_code


def test_ping(nhsd_apim_proxy_url):
    resp = requests.get(f"{nhsd_apim_proxy_url}/_ping")
    assert resp.status_code == 200


@pytest.mark.nhsd_apim_authorization(access="application", level="level3")
def test_app_level3_access_search(test_data, nhsd_apim_proxy_url, nhsd_apim_auth_headers):
    # Put PDM record
    pdm_record = pdm_data_helper.build_record()
    test_data.append(pdm_record)

    pdm_data_helper.create_metadata(pdm_record)
    pdm_data_helper.create_resource(pdm_record)

    # Search record via APIM
    resp = requests.get(
        nhsd_apim_proxy_url + "/DocumentReference?subject:identifier=https://fhir.nhs.uk/Id/nhs-number%7C9912003071",
        headers=nhsd_apim_auth_headers,
    )
    assert resp.status_code == 200

    output_dir = "tests/e2e/apim"
    for doc in json.loads(resp.content)["entry"]:
        doc_endpoint = doc["resource"]["content"][0]["attachment"]["url"]
        resp = requests.get(doc_endpoint, headers=nhsd_apim_auth_headers)
        assert resp.status_code == 200

        title = doc["resource"]["content"][0]["attachment"]["title"]
        file_path = os.path.join(output_dir, title)
        with open(file_path, "wb") as file:
            binary_data = json.loads(resp.content)
            b = base64.b64decode(binary_data["content"][0]["attachment"]["data"])
            file.write(b)


@pytest.mark.nhsd_apim_authorization(access="application", level="level3")
def test_app_level3_access_retrieve(test_data, nhsd_apim_proxy_url, nhsd_apim_auth_headers):
    # Put PDM record
    pdm_record = pdm_data_helper.build_record()
    test_data.append(pdm_record)

    pdm_data_helper.create_metadata(pdm_record)
    pdm_data_helper.create_resource(pdm_record)

    record_id = pdm_record["id"]

    # Retrieve record via APIM
    resp = requests.get(
        nhsd_apim_proxy_url + f"/DocumentReference/{PDM_SNOMED}~{record_id}",
        headers=nhsd_apim_auth_headers,
    )
    assert resp.status_code == 200

    output_dir = "tests/e2e/apim"
    file_path = os.path.join(output_dir, "file_path.pdf")
    with open(file_path, "wb") as file:
        binary_data = json.loads(resp.content)
        b = base64.b64decode(binary_data["content"][0]["attachment"]["data"])
        file.write(b)


@pytest.mark.nhsd_apim_authorization(access="application", level="level3")
def test_app_level3_access_upload(test_data, nhsd_apim_proxy_url, nhsd_apim_auth_headers):
    # Build PDM record
    sample_pdf_path = os.path.join(os.path.dirname(__file__), "files", "dummy.pdf")
    with open(sample_pdf_path, "rb") as f:
        encoded_data = base64.b64encode(f.read()).decode("utf-8")

    pdm_record = pdm_data_helper.build_record(data=encoded_data)

    payload = pdm_data_helper.create_upload_payload(pdm_record)

    # Upload via APIM
    resp = requests.post(
        nhsd_apim_proxy_url + "/DocumentReference",
        headers=nhsd_apim_auth_headers,
        data=payload,
    )
    assert resp.status_code == 200
    pdm_record["id"] = resp.json()["id"].split("~")[1]
    test_data.append(pdm_record)

    upload_response = resp.json()
    assert upload_response["docStatus"] == "preliminary"

    attachment_url = upload_response["content"][0]["attachment"]["url"]
    assert f"{nhsd_apim_proxy_url}/DocumentReference/{PDM_SNOMED}~" in attachment_url
