import pytest

from services.get_document_reference_history_service import (
    GetDocumentReferenceHistoryService,
)
from tests.unit.conftest import TEST_CURRENT_GP_ODS
from utils.exceptions import UserIsNotCustodianException


@pytest.fixture
def mock_get_fhir_doc_reference_history_service(mocker):
    mocker.patch(
        "services.get_fhir_document_reference_history_service.DynamoDBService",
    )
    mock_service = mocker.patch(
        "services.get_document_reference_history_service.GetFhirDocumentReferenceHistoryService",
    )
    return mock_service


@pytest.fixture
def mock_extract_ods_code_from_request_context(mocker):
    return mocker.patch(
        "services.get_document_reference_history_service.extract_ods_code_from_request_context",
    )


def test_check_if_user_is_custodian_of_item_exception(
    mock_get_fhir_doc_reference_history_service,
    mock_extract_ods_code_from_request_context,
):
    item = {"CurrentGpOds": TEST_CURRENT_GP_ODS}
    mock_extract_ods_code_from_request_context.return_value = "ANOTHER_ODS_CODE"

    service = GetDocumentReferenceHistoryService()
    with pytest.raises(UserIsNotCustodianException) as exc_info:
        service.check_if_user_is_custodian_of_item(item)

    assert str(exc_info.value) == "User is not the custodian of this document reference"
