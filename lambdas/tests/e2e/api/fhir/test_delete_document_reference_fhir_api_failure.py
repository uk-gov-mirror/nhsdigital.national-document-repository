import uuid
import pytest
from lambdas.enums.snomed_codes import SnomedCodes
from tests.e2e.api.fhir.conftest import (
    delete_document_reference,
)
from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


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


@pytest.mark.parametrize(
    "doc_id",
    [
        ("1234"),
        (f"{SnomedCodes.PATIENT_DATA.value.code}~1234"),
    ],
)
def test_malformatted_document_id(test_data, doc_id):
    response = delete_document_reference(
        f"?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|9912003071&_id={doc_id}"
    )
    assert response.status_code == 400
    response_json = response.json()
    assert response_json["resourceType"] == "OperationOutcome"
    assert response_json["issue"][0]["details"]["coding"][0]["code"] == "invalid"


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
