import os
import shutil
import subprocess
import tempfile
import time

import pytest
import requests

from lambdas.tests.e2e.helpers.pdm_data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()

PDM_SNOMED = 717391000000106
PDM_METADATA_TABLE = os.environ.get("PDM_METADATA_TABLE")
PDM_S3_BUCKET = os.environ.get("PDM_S3_BUCKET") or ""
MTLS_ENDPOINT = os.environ["MTLS_ENDPOINT"]
CLIENT_CERT_PATH = os.environ["CLIENT_CERT_PATH"]
CLIENT_KEY_PATH = os.environ["CLIENT_KEY_PATH"]


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


def create_mtls_session():
    session = requests.Session()
    session.cert = (CLIENT_CERT_PATH, CLIENT_KEY_PATH)
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
