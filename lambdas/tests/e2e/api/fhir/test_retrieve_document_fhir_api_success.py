import base64

from lambdas.models.document_reference import DocumentReference
import pytest
from tests.e2e.api.fhir.conftest import (
    PDM_S3_BUCKET,
    create_and_store_pdm_record,
    get_pdm_document_reference,
    PDM_SNOMED,
)
from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


def assert_returned_document_reference(pdm_record, response):
    assert response.get("resourceType") == "DocumentReference"
    assert response["type"]["coding"][0]["code"] == PDM_SNOMED
    assert response["subject"]["identifier"]["value"] == "9912003071"


@pytest.mark.parametrize(
    "doc_status, response_status",
    [
        ("registered", 200),
        ("partial", 200),
        ("preliminary", 200),
        ("final", 200),
        ("amended", 200),
        ("corrected", 200),
        ("appended", 200),
        ("cancelled", 200),
        ("entered-in-error", 200),
        ("unknown", 200),
    ],
)
def test_successful_retrieval_of_document_reference(
    test_data, doc_status, response_status
):
    pdm_record = create_and_store_pdm_record(test_data, doc_status=doc_status)

    response = get_pdm_document_reference(pdm_record["id"])
    assert response.status_code == response_status

    response_json = response.json()
    assert_returned_document_reference(pdm_record, response_json)
    assert response_json.get("docStatus") == doc_status


@pytest.mark.parametrize("file_size", [None, 10 * 1024 * 1024])
def test_file_retrieval(test_data, file_size):
    """Test retrieval for small and large files."""
    pdm_record = create_and_store_pdm_record(
        test_data, size=file_size if file_size else None
    )
    response = get_pdm_document_reference(pdm_record["id"])
    assert response.status_code == 200

    json = response.json()

    if not file_size:
        data = json["content"][0]["attachment"]["data"]
        decoded_data = base64.b64decode(data)
        expected_bytes = b"Sample PDF Content"
        assert decoded_data == expected_bytes
    else:
        expected_presign_uri = f"https://{PDM_S3_BUCKET}.s3.eu-west-2.amazonaws.com/{pdm_record['nhs_number']}/{pdm_record['id']}"
        assert expected_presign_uri in json["content"][0]["attachment"]["url"]
