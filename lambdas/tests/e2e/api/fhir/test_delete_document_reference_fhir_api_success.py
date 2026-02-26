from tests.e2e.api.fhir.conftest import (
    TEST_NHS_NUMBER,
    create_and_store_pdm_record,
    delete_document_reference,
    get_pdm_document_reference,
)
from tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()


def test_delete_record_by_patient_details_and_doc_id(test_data):
    created_record = create_and_store_pdm_record(test_data)
    expected_record_id = created_record["id"]

    get_response_1 = get_pdm_document_reference(expected_record_id)
    assert get_response_1.status_code == 200

    response = delete_document_reference(
        f"?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}&_id={expected_record_id}",
    )
    assert response.status_code == 204

    get_response = get_pdm_document_reference(expected_record_id)
    assert get_response.status_code == 404


def test_delete_only_one_record_by_patient_details_and_doc_id(test_data):
    created_record_1 = create_and_store_pdm_record(test_data)
    expected_record_id_1 = created_record_1["id"]

    created_record_2 = create_and_store_pdm_record(test_data)
    expected_record_id_2 = created_record_2["id"]

    get_response_1 = get_pdm_document_reference(expected_record_id_1)
    assert get_response_1.status_code == 200

    get_response_2 = get_pdm_document_reference(expected_record_id_2)
    assert get_response_2.status_code == 200

    response = delete_document_reference(
        f"?subject:identifier=https://fhir.nhs.uk/Id/nhs-number|{TEST_NHS_NUMBER}&_id={expected_record_id_1}",
    )
    assert response.status_code == 204

    get_response_1_deleted = get_pdm_document_reference(expected_record_id_1)
    assert get_response_1_deleted.status_code == 404

    get_response_2_deleted = get_pdm_document_reference(expected_record_id_2)
    assert get_response_2_deleted.status_code == 200
