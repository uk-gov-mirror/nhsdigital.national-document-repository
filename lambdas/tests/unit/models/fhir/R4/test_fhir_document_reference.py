import pytest
from models.fhir.R4.base_models import Reference
from models.fhir.R4.fhir_document_reference import (
    DocumentReference as FhirDocumentReference,
)
from tests.unit.helpers.data.test_documents import create_valid_fhir_doc_json
from utils.exceptions import FhirDocumentReferenceException


@pytest.fixture
def valid_nhs_number():
    return "9000000009"


@pytest.fixture
def valid_fhir_doc_json(valid_nhs_number):
    return create_valid_fhir_doc_json(valid_nhs_number)


@pytest.fixture
def valid_fhir_doc_object(valid_fhir_doc_json):
    return FhirDocumentReference.model_validate_json(valid_fhir_doc_json)


def test_extract_nhs_number_from_fhir_with_invalid_system(valid_fhir_doc_object):
    """Test _extract_nhs_number_from_fhir method with an invalid NHS number system."""

    valid_fhir_doc_object.subject.identifier.system = "invalid-system"

    with pytest.raises(FhirDocumentReferenceException):
        valid_fhir_doc_object.extract_nhs_number_from_fhir()


def test_extract_nhs_number_from_fhir_with_missing_identifier(valid_fhir_doc_object):
    """Test _extract_nhs_number_from_fhir method when identifier is missing."""
    valid_fhir_doc_object.subject = Reference(identifier=None)

    with pytest.raises(FhirDocumentReferenceException):
        valid_fhir_doc_object.extract_nhs_number_from_fhir()


def test_extract_nhs_number_from_fhir_returns_nhs_number(
    valid_fhir_doc_object, valid_nhs_number
):
    """Test that extract_nhs_number_from_fhir returns the correct nhs number"""
    result = valid_fhir_doc_object.extract_nhs_number_from_fhir()

    assert result == valid_nhs_number
