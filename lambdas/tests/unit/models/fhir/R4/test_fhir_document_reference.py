import pytest

from enums.snomed_codes import SnomedCodes
from models.fhir.R4.base_models import Reference
from models.fhir.R4.fhir_document_reference import (
    DocumentReference as FhirDocumentReference,
)
from models.fhir.R4.fhir_document_reference import (
    DocumentReferenceInfo,
)
from tests.unit.helpers.data.test_documents import (
    create_test_doc_refs,
    create_valid_fhir_doc_json,
)
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
    valid_fhir_doc_object,
    valid_nhs_number,
):
    """Test that extract_nhs_number_from_fhir returns the correct nhs number"""
    result = valid_fhir_doc_object.extract_nhs_number_from_fhir()

    assert result == valid_nhs_number


@pytest.mark.parametrize(
    ["exclude", "include_author_and_custodian", "snomed"],
    [
        (
            ["author", "custodian"],
            False,
            SnomedCodes.PATIENT_DATA.value,
        ),
        (
            [],
            False,
            SnomedCodes.PATIENT_DATA.value,
        ),
        (
            [],
            True,
            SnomedCodes.PATIENT_DATA.value,
        ),
        (
            ["author", "custodian"],
            False,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
        (
            [],
            False,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
        (
            [],
            True,
            SnomedCodes.LLOYD_GEORGE.value,
        ),
    ],
)
def test_create_fhir_document_reference_object(
    exclude,
    include_author_and_custodian,
    snomed,
):
    doc_refs = create_test_doc_refs()
    doc_ref = doc_refs[0]
    doc_ref_info = DocumentReferenceInfo(
        nhs_number=doc_ref.nhs_number,
        snomed_code_doc_type=snomed,
    )
    for key in exclude:
        if key in doc_ref:
            doc_ref.pop(key)

    if include_author_and_custodian:
        setattr(doc_ref, "author", "foobar")
        setattr(doc_ref, "custodian", "foobar")

        doc_ref_info = DocumentReferenceInfo(
            nhs_number=doc_ref.nhs_number,
            snomed_code_doc_type=snomed,
            custodian=doc_ref.custodian,
            author=doc_ref.author,
        )

    fhir_doc = doc_ref_info.create_fhir_document_reference_object(
        doc_ref,
    ).model_dump_json(
        exclude_none=True,
    )

    for key in exclude:
        assert key not in fhir_doc

    if include_author_and_custodian:
        assert "author" in fhir_doc
        assert "custodian" in fhir_doc
