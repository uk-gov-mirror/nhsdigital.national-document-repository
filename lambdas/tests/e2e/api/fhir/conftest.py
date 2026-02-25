import os
import shutil
import subprocess
import tempfile
import time
from urllib.parse import urlencode

import pytest
import requests

from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()

PDM_SNOMED = pdm_data_helper.snomed_code
PDM_METADATA_TABLE = pdm_data_helper.dynamo_table
PDM_S3_BUCKET = pdm_data_helper.s3_bucket
MTLS_ENDPOINT = pdm_data_helper.mtls_endpoint
CLIENT_CERT_PATH = os.environ.get("CLIENT_CERT_PATH")
CLIENT_KEY_PATH = os.environ.get("CLIENT_KEY_PATH")
TEST_NHS_NUMBER = "9730136912"
UNKNOWN_TEST_NHS_NUMBER = "9730136939"


@pytest.fixture
def test_data():
    test_records = []
    yield test_records
    for record in test_records:
        pdm_data_helper.tidyup(record)


def fetch_with_retry_mtls(
    session,
    url,
    headers,
    condition_func=None,
    max_retries=5,
    delay=10,
):
    retries = 0
    while retries < max_retries:
        response = session.get(url, headers=headers)
        try:
            response_json = response.json()
        except ValueError:
            response_json = {}

        if condition_func is None or condition_func(response_json):
            return response

        time.sleep(delay)
        retries += 1

    raise Exception("Condition not met within retry limit")


def create_mtls_session(
    client_cert_path=CLIENT_CERT_PATH,
    client_key_path=CLIENT_KEY_PATH,
):
    session = requests.Session()
    session.cert = (client_cert_path, client_key_path)
    return session


@pytest.fixture
def temp_cert_and_key():
    import os

    temp_dir = tempfile.mkdtemp()
    key_path = os.path.join(temp_dir, "temp_key.pem")
    cert_path = os.path.join(temp_dir, "temp_cert.pem")

    try:
        subprocess.run(["openssl", "genrsa", "-out", key_path, "2048"], check=True)
        subprocess.run(
            [
                "openssl",
                "req",
                "-new",
                "-x509",
                "-key",
                key_path,
                "-out",
                cert_path,
                "-days",
                "1",
                "-subj",
                "/C=GB/O=Test Org/CN=localhost",
            ],
            check=True,
        )
        yield cert_path, key_path
    finally:
        shutil.rmtree(temp_dir)


def get_pdm_document_reference(
    record_id="",
    client_cert_path=None,
    client_key_path=None,
    resource_type="DocumentReference",
    pdm_snomed=PDM_SNOMED,
    endpoint_override=None,
):
    if not endpoint_override:
        url = f"https://{MTLS_ENDPOINT}/{resource_type}/{record_id}"
    else:
        url = f"https://{MTLS_ENDPOINT}/{resource_type}/{endpoint_override}"
    headers = {
        "X-Correlation-Id": "1234",
    }

    # Call with invalid or unauthorised certs
    if client_cert_path and client_key_path:
        session = create_mtls_session(client_cert_path, client_key_path)
    else:
        # Call with default valid certs
        session = create_mtls_session()

    response = session.get(url, headers=headers)
    return response


def delete_document_reference(endpoint, client_cert_path=None, client_key_path=None):
    """Helper to perform a DELETE by NHS number."""
    url = f"https://{MTLS_ENDPOINT}/DocumentReference{endpoint}"
    headers = {
        "X-Correlation-Id": "1234",
    }

    # Use provided certs if available, else defaults
    if client_cert_path and client_key_path:
        session = create_mtls_session(client_cert_path, client_key_path)
    else:
        session = create_mtls_session()

    return session.delete(url=url, headers=headers)


def create_and_store_pdm_record(
    test_data,
    nhs_number: str = TEST_NHS_NUMBER,
    doc_status: str | None = None,
    size: int | None = None,
    ods: str = "H81109",
    **dynamo_kwargs,
):
    """Helper to create metadata and resource for a record."""
    record = pdm_data_helper.build_record(
        nhs_number=nhs_number,
        doc_status=doc_status,
        size=size,
        ods=ods,
    )
    test_data.append(record)
    pdm_data_helper.create_metadata(record, **dynamo_kwargs)
    pdm_data_helper.create_resource(record)
    return record


def upload_document(payload, resource_type="DocumentReference"):
    """Helper to upload DocumentReference."""
    url = f"https://{MTLS_ENDPOINT}/{resource_type}"
    headers = {
        "X-Correlation-Id": "1234",
    }
    session = create_mtls_session()
    return session.post(url, headers=headers, data=payload)


def retrieve_document_with_retry(doc_id, condition):
    """Poll until condition is met on DocumentReference retrieval."""
    retrieve_url = f"https://{MTLS_ENDPOINT}/DocumentReference/{doc_id}"
    headers = {
        "X-Correlation-Id": "1234",
    }
    session = create_mtls_session()
    return fetch_with_retry_mtls(session, retrieve_url, headers, condition)


def search_document_reference(
    nhs_number,
    client_cert_path=None,
    client_key_path=None,
    resource_type="DocumentReference",
    extra_params: dict | None = None,
):
    """Helper to perform search by NHS number with optional additional query params and mTLS certs."""
    base_params = {
        "subject:identifier": f"https://fhir.nhs.uk/Id/nhs-number|{nhs_number}",
    }

    # Merge any additional params (e.g. custodian:identifier)
    if extra_params:
        base_params.update(extra_params)

    query = urlencode(base_params, doseq=True)
    url = f"https://{MTLS_ENDPOINT}/{resource_type}?{query}"
    print(f"Search URL: {url}")
    headers = {
        "X-Correlation-Id": "1234",
    }

    # Use provided certs if available, else defaults
    if client_cert_path and client_key_path:
        session = create_mtls_session(client_cert_path, client_key_path)
    else:
        session = create_mtls_session()

    return session.get(url, headers=headers)
