import requests
import uuid
from tests.e2e.conftest import API_ENDPOINT, API_KEY
from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


def delete_document_reference(end_point):
    """Helper to perform a DELETE by NHS number with optional mTLS certs."""
    url = f"https://{API_ENDPOINT}/FhirDocumentReference{end_point}"
    headers = {
        "Authorization": "Bearer 123",
        "X-Api-Key": API_KEY,
        "X-Correlation-Id": "1234",
    }

    return requests.request("DELETE", url, headers=headers)


def test_no_documents_found(test_data):
    response = delete_document_reference(
        f"?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|9912003071&_id={uuid.uuid4()}"
    )
    assert response.status_code == 404
    response_json = response.json()
    assert response_json["resourceType"] == "OperationOutcome"
    assert response_json["issue"][0]["details"]["coding"][0]["code"] == "not-found"


def test_malformatted_nhs_id(test_data):
    response = delete_document_reference(
        f"?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|991200&_id={uuid.uuid4()}"
    )
    assert response.status_code == 400
    response_json = response.json()
    assert response_json["resourceType"] == "OperationOutcome"
    assert (
        response_json["issue"][0]["details"]["coding"][0]["code"] == "VALIDATION_ERROR"
    )


def test_malformatted_document_id(test_data):
    response = delete_document_reference(
        "?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|9912003071&_id=1234"
    )
    assert response.status_code == 400
    response_json = response.json()
    assert response_json["resourceType"] == "OperationOutcome"
    assert response_json["issue"][0]["details"]["coding"][0]["code"] == "MISSING_VALUE"


def test_no_query_params(test_data):
    response = delete_document_reference("")
    assert response.status_code == 400
    response_json = response.json()
    assert response_json["resourceType"] == "OperationOutcome"
    assert (
        response_json["issue"][0]["details"]["coding"][0]["code"] == "VALIDATION_ERROR"
    )


def test_incorrect_query_params(test_data):
    response = delete_document_reference(
        "?foo=https://fhir.nhs.uk/Id/nhs-number|9912003071"
    )
    assert response.status_code == 400
    response_json = response.json()
    assert response_json["resourceType"] == "OperationOutcome"
    assert (
        response_json["issue"][0]["details"]["coding"][0]["code"] == "VALIDATION_ERROR"
    )


def test_correct_query_params_with_incorrect_params(test_data):
    response = delete_document_reference(
        f"?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|9912003071&_id={uuid.uuid4()}&foo=1234"
    )
    assert response.status_code == 404
    response_json = response.json()
    assert response_json["resourceType"] == "OperationOutcome"
    assert response_json["issue"][0]["details"]["coding"][0]["code"] == "not-found"
