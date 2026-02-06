from unittest.mock import MagicMock, patch

import pytest
from enums.snomed_codes import SnomedCodes
from enums.supported_document_types import SupportedDocumentTypes
from models.document_reference import DocumentReference
from services.delete_fhir_document_reference_service import (
    DeleteFhirDocumentReferenceService,
)
from tests.unit.helpers.data.dynamo.dynamo_responses import MOCK_SEARCH_RESPONSE

MOCK_DOCUMENT_REFERENCE = DocumentReference.model_validate(
    MOCK_SEARCH_RESPONSE["Items"][0]
)


@pytest.fixture
def service():
    return DeleteFhirDocumentReferenceService()


def test_process_calls_handle_reference_delete_for_non_pdm(service):
    event = {"requestContext": {}}
    deletion_identifiers = ["3d8683b9-1665-40d2-8499-6e8302d507ff", "9000000009"]

    with patch(
        "services.delete_fhir_document_reference_service.validate_common_name_in_mtls",
        return_value="CN",
    ), patch.object(
        service,
        "extract_parameters",
        return_value=deletion_identifiers,
    ), patch.object(
        service,
        "_determine_document_type_based_on_common_name",
        return_value=SnomedCodes.LLOYD_GEORGE.value,
    ), patch.object(
        service,
        "is_uuid",
        return_value=True,
    ), patch(
        "services.delete_fhir_document_reference_service.DocumentDeletionService"
    ) as mock_deletion_service_cls:

        mock_deletion_service = MagicMock()
        mock_deletion_service.handle_reference_delete.return_value = [
            MOCK_DOCUMENT_REFERENCE
        ]
        mock_deletion_service_cls.return_value = mock_deletion_service

        result = service.process_fhir_document_reference(event)

    assert result == [MOCK_DOCUMENT_REFERENCE]

    mock_deletion_service.handle_reference_delete.assert_called_once_with(
        deletion_identifiers[1],
        [SupportedDocumentTypes.LG],
        document_id=deletion_identifiers[0],
        fhir=True,
    )
