import os
import shutil
import subprocess
import tempfile
import time

import pytest
import requests

from lambdas.tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()

PDM_SNOMED = 717391000000106
PDM_METADATA_TABLE = os.environ.get("PDM_METADATA_TABLE")
PDM_S3_BUCKET = os.environ.get("PDM_S3_BUCKET") or ""
MTLS_ENDPOINT = os.environ.get("MTLS_ENDPOINT")
CLIENT_CERT_PATH = os.environ.get("CLIENT_CERT_PATH")
CLIENT_KEY_PATH = os.environ.get("CLIENT_KEY_PATH")


@pytest.fixture
def test_data():
    test_records = []
    yield test_records
    for record in test_records:
        pdm_data_helper.tidyup(record)


def fetch_with_retry_mtls(
    session, url, headers, condition_func=None, max_retries=5, delay=10
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
    client_cert_path=CLIENT_CERT_PATH, client_key_path=CLIENT_KEY_PATH
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


def get_pdm_document_reference(record_id, client_cert_path=None, client_key_path=None):
    url = f"https://{MTLS_ENDPOINT}/DocumentReference/{PDM_SNOMED}~{record_id}"
    headers = {
        "X-Correlation-Id": "1234",
    }

    # Call with invalid or foobar certs
    if client_cert_path and client_key_path:
        session = create_mtls_session(client_cert_path, client_key_path)
    else:
        # Call with default valid certs
        session = create_mtls_session()

    response = session.get(url, headers=headers)
    return response
