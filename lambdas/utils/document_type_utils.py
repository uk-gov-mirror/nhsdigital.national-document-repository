from enums.supported_document_types import SupportedDocumentTypes

def extract_document_type_to_enum(value: str) -> list[SupportedDocumentTypes]:
    received_document_types = value.replace(" ", "").split(",")
    converted_document_types = []
    for document_type in received_document_types:
        converted_document_types.append(SupportedDocumentTypes(document_type))

    return converted_document_types
