import pytest
from enums.supported_document_types import SupportedDocumentTypes
from utils.document_type_utils import extract_document_type_to_enum


@pytest.mark.parametrize(
    "value",
    [
        "16521000000101, ARF",
        "ARF,16521000000101",
        " ARF, 16521000000101",
        "16521000000101 , ARF",
    ],
)
def test_extract_document_type_both(value):
    expected = [SupportedDocumentTypes.ARF, SupportedDocumentTypes.LG]

    actual = extract_document_type_to_enum(value)

    assert set(expected) == set(actual)


@pytest.mark.parametrize(
    "value",
    [
        "16521000000101 ",
        " 16521000000101",
    ],
)
def test_extract_document_type_lg(value):
    expected = [SupportedDocumentTypes.LG]

    actual = extract_document_type_to_enum(value)

    assert expected == actual


@pytest.mark.parametrize(
    "value",
    [
        "ARF ",
        " ARF",
    ],
)
def test_extract_document_type_arf(value):
    expected = [SupportedDocumentTypes.ARF]

    actual = extract_document_type_to_enum(value)

    assert expected == actual


@pytest.mark.parametrize(
    ["value", "expected"],
    [
        ("ARF", [SupportedDocumentTypes.ARF]),
        ("ARF ", [SupportedDocumentTypes.ARF]),
        (" ARF", [SupportedDocumentTypes.ARF]),
        ("16521000000101", [SupportedDocumentTypes.LG]),
        ("16521000000101 ", [SupportedDocumentTypes.LG]),
        (" 16521000000101", [SupportedDocumentTypes.LG]),
        (" ARF, 16521000000101 ", [SupportedDocumentTypes.ARF, SupportedDocumentTypes.LG]),
        (" 16521000000101  , ARF ", [SupportedDocumentTypes.LG, SupportedDocumentTypes.ARF]),
    ],
)
def test_extract_document_type_as_enum(value, expected):
    actual = extract_document_type_to_enum(value)

    assert expected == actual
