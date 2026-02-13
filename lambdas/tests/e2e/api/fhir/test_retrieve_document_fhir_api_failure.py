import uuid
from datetime import datetime, timezone

import pytest
from enums.document_retention import DocumentRetentionDays
from tests.e2e.api.fhir.conftest import (
    create_and_store_pdm_record,
)
from tests.e2e.helpers.data_helper import PdmDataHelper
from tests.e2e.helpers.rest_helper import get_pdm_document_reference

pdm_data_helper = PdmDataHelper()


def _assert_operation_outcome(body, code):
    assert body["resourceType"] == "OperationOutcome"
    assert body["issue"][0]["details"]["coding"][0]["code"] == code


@pytest.mark.parametrize(
    "doc_status, response_status",
    [
        ("deprecated", 404),
    ],
)
def test_retrieval_of_deleted_document_reference(
    test_data,
    doc_status,
    response_status,
):
    deletion_date = datetime.now(timezone.utc)
    document_ttl_days = DocumentRetentionDays.SOFT_DELETE
    ttl_seconds = document_ttl_days * 24 * 60 * 60
    document_reference_ttl = int(deletion_date.timestamp() + ttl_seconds)
    pdm_record = create_and_store_pdm_record(
        test_data,
        doc_status=doc_status,
        Deleted=deletion_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        ttl=document_reference_ttl,
    )

    response = get_pdm_document_reference(record_id=pdm_record["id"])
    assert response.status_code == response_status

    response_json = response.json()
    _assert_operation_outcome(body=response_json, code="RESOURCE_NOT_FOUND")


@pytest.mark.parametrize(
    "record_id,expected_status,expected_code,expected_diagnostics",
    [
        (str(uuid.uuid4()), 404, "RESOURCE_NOT_FOUND", "Document reference not found"),
    ],
)
def test_retrieve_non_existant_document_reference(
    record_id,
    expected_status,
    expected_code,
    expected_diagnostics,
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
        pdm_record["id"],
        client_cert_path=cert_path,
        client_key_path=key_path,
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


# This is not a helpful error message. Update this in ticket NDR-394
@pytest.mark.parametrize(
    "param,expected_status,expected_code",
    [
        (f"{pdm_data_helper.snomed_code}-{str(uuid.uuid4())}", 400, "MISSING_VALUE"),
        (f"{pdm_data_helper.snomed_code}+{str(uuid.uuid4())}", 400, "MISSING_VALUE"),
        (f"{pdm_data_helper.snomed_code}&{str(uuid.uuid4())}", 400, "MISSING_VALUE"),
        (f"{pdm_data_helper.snomed_code}{str(uuid.uuid4())}", 400, "MISSING_VALUE"),
        (f"{str(uuid.uuid4())}~{pdm_data_helper.snomed_code}", 500, "exception"),
    ],
)
def test_incorrectly_formatted_path_param_id(
    test_data,
    param,
    expected_status,
    expected_code,
):
    response = get_pdm_document_reference(
        endpoint_override=param,
    )

    body = response.json()
    assert response.status_code == expected_status
    _assert_operation_outcome(body=body, code=expected_code)


def test_no_snomed_code_in_path_param_id(test_data):
    pdm_record = create_and_store_pdm_record(test_data)
    response = get_pdm_document_reference(
        record_id=pdm_record["id"],
        pdm_snomed="",
    )

    body = response.json()
    assert response.status_code == 400
    _assert_operation_outcome(body=body, code="MISSING_VALUE")


def test_no_document_id_in_path_param_id():
    response = get_pdm_document_reference()

    body = response.json()
    assert response.status_code == 400
    _assert_operation_outcome(body=body, code="MISSING_VALUE")


def test_no_snomed_or_document_id_in_path_param_id():
    response = get_pdm_document_reference(
        pdm_snomed="",
    )

    body = response.json()
    assert response.status_code == 400
    _assert_operation_outcome(body=body, code="MISSING_VALUE")


# This is not a helpful error message. Update this in ticket NDR-394
def test_extra_parameter_in_id_in_path_param_id(test_data):
    pdm_record = create_and_store_pdm_record(test_data)
    response = get_pdm_document_reference(
        endpoint_override=f"{pdm_data_helper.snomed_code}~{pdm_record['id']}~thisshouldnotbehere",
    )

    body = response.json()
    assert response.status_code == 400
    _assert_operation_outcome(body=body, code="MISSING_VALUE")
