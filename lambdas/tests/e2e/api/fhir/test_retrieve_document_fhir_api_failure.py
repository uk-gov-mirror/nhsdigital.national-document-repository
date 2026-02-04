from datetime import datetime, timezone
import uuid

import pytest
from enums.document_retention import DocumentRetentionDays
from tests.e2e.api.fhir.conftest import (
    create_and_store_pdm_record,
    get_pdm_document_reference,
)
from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


@pytest.mark.parametrize(
    "doc_status, response_status",
    [
        ("deprecated", 200),  # TODO Fix in NDR-363, this should return a 404
    ],
)
def test_retrieval_of_deleted_document_reference(
    test_data, doc_status, response_status
):
    deletion_date = datetime.now(timezone.utc)
    document_ttl_days = DocumentRetentionDays.SOFT_DELETE
    ttl_seconds = document_ttl_days * 24 * 60 * 60
    document_reference_ttl = int(deletion_date.timestamp() + ttl_seconds)
    pdm_record = create_and_store_pdm_record(
        test_data,
        doc_status=doc_status,
        deleted=deletion_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        ttl=document_reference_ttl,
    )

    response = get_pdm_document_reference(pdm_record["id"])
    assert response.status_code == response_status

    response_json = response.json()
    assert response_json.get("docStatus") == doc_status


@pytest.mark.parametrize(
    "record_id,expected_status,expected_code,expected_diagnostics",
    [
        (str(uuid.uuid4()), 404, "RESOURCE_NOT_FOUND", "Document reference not found"),
    ],
)
def test_retrieve_non_existant_document_reference(
    record_id, expected_status, expected_code, expected_diagnostics
):
    response = get_pdm_document_reference(record_id)
    assert response.status_code == expected_status

    body = response.json()
    issue = body["issue"][0]

    details = issue.get("details", {})
    coding = details.get("coding", [{}])[0]

    assert coding.get("code") == expected_code
    assert issue.get("diagnostics") == expected_diagnostics


def test_forbidden_with_invalid_cert(test_data, temp_cert_and_key):
    pdm_record = create_and_store_pdm_record(test_data)

    # Use an invalid cert that is trusted by TLS but fails truststore validation
    cert_path, key_path = temp_cert_and_key

    response = get_pdm_document_reference(
        pdm_record["id"], client_cert_path=cert_path, client_key_path=key_path
    )

    body = response.json()
    assert response.status_code == 403
    assert body["message"] == "Forbidden"


def test_retrieve_invalid_resource_type(test_data):
    pdm_record = create_and_store_pdm_record(test_data)

    response = get_pdm_document_reference(pdm_record["id"], resource_type="FooBar")
    assert response.status_code == 403

    response_json = response.json()
    assert response_json["message"] == "Missing Authentication Token"


# TODO
# test_retrieval_of_deleted_document_reference (should return 404)
# test_incorrectly_formatted_path_param_id 400
# test_no_snomed_code_in_path_param_id
# test_no_document_id_in_path_param_id
# test_no_snomed_or_document_id_in_path_param_id
# test_extra_parameter_in_id_in_path_param_id
# test_unknown_common_name
