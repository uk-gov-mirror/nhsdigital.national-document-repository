import os
import requests
import uuid

from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()

PDM_SNOMED = pdm_data_helper.snomed_code
PDM_METADATA_TABLE = pdm_data_helper.dynamo_table
PDM_S3_BUCKET = pdm_data_helper.s3_bucket
MTLS_ENDPOINT = pdm_data_helper.mtls_endpoint
CLIENT_CERT_PATH = os.environ.get("CLIENT_CERT_PATH")
CLIENT_KEY_PATH = os.environ.get("CLIENT_KEY_PATH")


def _create_mtls_session(
    client_cert_path=CLIENT_CERT_PATH,
    client_key_path=CLIENT_KEY_PATH,
) -> requests.Session:
    session = requests.Session()

    session.cert = (client_cert_path, client_key_path)
    return session


def _define_request_headers() -> dict[str, str]:
    default_headers = {
        "X-Correlation-Id": str(uuid.uuid4()),
    }
    return default_headers


def search_document_reference(
    nhs_number,
    resource_type="DocumentReference",
    client_cert_path=CLIENT_CERT_PATH,
    client_key_path=CLIENT_KEY_PATH,
):
    
    """Helper to perform search by NHS number with optional mTLS certs."""
    url = f"https://{MTLS_ENDPOINT}/{resource_type}?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{nhs_number}"
    headers = _define_request_headers()
    session = _create_mtls_session(client_cert_path, client_key_path)
    return session.get(url, headers=headers)


def get_pdm_document_reference(
    record_id="",
    client_cert_path=CLIENT_CERT_PATH,
    client_key_path=CLIENT_KEY_PATH,
    resource_type="DocumentReference",
    pdm_snomed=PDM_SNOMED,
    endpoint_override=None,
):
    
    if not endpoint_override:
        url = f"https://{MTLS_ENDPOINT}/{resource_type}/{pdm_snomed}~{record_id}"
    else:
        url = f"https://{MTLS_ENDPOINT}/{resource_type}/{endpoint_override}"

    headers = _define_request_headers()
    session = _create_mtls_session(client_cert_path, client_key_path)
    response = session.get(url, headers=headers)
    return response


def delete_document_reference(
    endpoint,  
    client_cert_path=CLIENT_CERT_PATH,
    client_key_path=CLIENT_KEY_PATH,):

    """Helper to perform a DELETE by NHS number."""
    url = f"https://{ MTLS_ENDPOINT}/DocumentReference{endpoint}"
    headers = _define_request_headers()
    session = _create_mtls_session(client_cert_path, client_key_path)
    return session.delete(url=url, headers=headers)


def upload_document_reference(payload, resource_type="DocumentReference"):

    """Helper to upload DocumentReference."""
    url = f"https://{MTLS_ENDPOINT}/{resource_type}"
    headers = _define_request_headers()
    session = _create_mtls_session()
    return session.post(url, headers=headers, data=payload)
