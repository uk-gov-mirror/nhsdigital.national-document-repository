import uuid
from typing import Dict, Optional

from botocore.exceptions import ClientError
from pydantic import ValidationError

from enums.document_retention import DocumentRetentionDays
from enums.lambda_error import LambdaError
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.mtls import MtlsCommonNames
from enums.snomed_codes import SnomedCode, SnomedCodes
from enums.supported_document_types import SupportedDocumentTypes
from models.document_reference import DocumentReference
from services.document_deletion_service import DocumentDeletionService
from services.document_service import DocumentService
from services.fhir_document_reference_service_base import (
    FhirDocumentReferenceServiceBase,
)
from utils.audit_logging_setup import LoggingService
from utils.exceptions import DynamoServiceException, InvalidNhsNumberException
from utils.lambda_exceptions import (
    DocumentDeletionServiceException,
    DocumentRefException,
)
from utils.lambda_header_utils import validate_common_name_in_mtls
from utils.request_context import request_context
from utils.utilities import validate_nhs_number

PARAM_SUBJECT_IDENTIFIER = "subject:identifier"
DOCUMENT_REFERENCE_IDENTIFIER = "_id"

logger = LoggingService(__name__)


class DeleteFhirDocumentReferenceService(FhirDocumentReferenceServiceBase):
    def __init__(self):
        super().__init__()

    def process_fhir_document_reference(
        self,
        event: dict = {},
    ) -> list[DocumentReference]:
        """
        Process a FHIR Document Reference DELETE request

        Returns:
            FHIR Document Reference response
        """
        try:
            common_name = validate_common_name_in_mtls(event.get("requestContext", {}))
            deletion_identifiers = self.extract_parameters(event=event)
            if any(v is None for v in deletion_identifiers):
                logger.error("FHIR document validation error: NhsNumber/id")
                raise DocumentRefException(
                    400,
                    LambdaError.DocumentReferenceMissingParameters,
                )

            if len(deletion_identifiers) < 2:
                return []

            if not self.is_uuid(deletion_identifiers[0]):
                logger.error("FHIR document validation error: Id")
                raise DocumentRefException(
                    400,
                    LambdaError.DocumentReferenceMissingParameters,
                )

            doc_type = self._determine_document_type_based_on_common_name(common_name)

            if not validate_nhs_number(deletion_identifiers[1]):
                logger.error("FHIR document validation error: NhsNumber")
                raise DocumentRefException(
                    400,
                    LambdaError.DocumentReferenceMissingParameters,
                )

            request_context.patient_nhs_no = deletion_identifiers[1]
            if doc_type.code != SnomedCodes.PATIENT_DATA.value.code:
                deletion_service = DocumentDeletionService()

                document_types = [SupportedDocumentTypes.LG]
                files_deleted = deletion_service.handle_reference_delete(
                    deletion_identifiers[1],
                    document_types,
                    document_id=deletion_identifiers[0],
                    fhir=True,
                )
            else:
                files_deleted = self.delete_fhir_document_reference_by_doc_id(
                    doc_id=deletion_identifiers[0],
                    doc_type=doc_type,
                )
            return files_deleted

        except (ValidationError, InvalidNhsNumberException) as e:
            logger.error(f"FHIR document validation error: {str(e)}")
            raise DocumentRefException(400, LambdaError.DocRefNoParse)
        except ClientError as e:
            logger.error(f"AWS client error: {str(e)}")
            raise DocumentRefException(500, LambdaError.InternalServerError)

    def delete_fhir_document_reference_by_doc_id(
        self,
        doc_id: str,
        doc_type: SnomedCode,
    ) -> DocumentReference | None:
        dynamo_table = self._get_dynamo_table_for_doc_type(doc_type)
        document_service = DocumentService()
        document = document_service.get_item_agnostic(
            partition_key={DocumentReferenceMetadataFields.ID.value: doc_id},
            table_name=dynamo_table,
        )
        if not document:
            return None
        try:
            document_service.delete_document_reference(
                table_name=dynamo_table,
                document_reference=document,
                document_ttl_days=DocumentRetentionDays.SOFT_DELETE,
                key_pair={
                    DocumentReferenceMetadataFields.ID.value: doc_id,
                },
            )
            logger.info(
                f"Deleted document of type {doc_type.display_name}",
                {"Result": "Successful deletion"},
            )
            return document
        except (ClientError, DynamoServiceException) as e:
            logger.error(
                f"{LambdaError.DocDelClient.to_str()}: {str(e)}",
                {"Results": "Failed to delete documents"},
            )
            raise DocumentDeletionServiceException(500, LambdaError.DocDelClient)

    def delete_fhir_document_reference_by_nhs_id_and_doc_id(
        self,
        nhs_number: str,
        doc_id: str,
        doc_type: SnomedCode,
    ) -> DocumentReference | None:
        dynamo_table = self._get_dynamo_table_for_doc_type(doc_type)
        document_service = DocumentService()
        document = document_service.get_item_agnostic(
            partition_key={
                DocumentReferenceMetadataFields.NHS_NUMBER.value: nhs_number,
            },
            sort_key={DocumentReferenceMetadataFields.ID.value: doc_id},
            table_name=dynamo_table,
        )
        if not document:
            return None
        try:
            document_service.delete_document_reference(
                table_name=dynamo_table,
                document_reference=document,
                document_ttl_days=DocumentRetentionDays.SOFT_DELETE,
                key_pair={
                    DocumentReferenceMetadataFields.ID.value: doc_id,
                    DocumentReferenceMetadataFields.NHS_NUMBER.value: nhs_number,
                },
            )
            logger.info(
                f"Deleted document of type {doc_type.display_name}",
                {"Result": "Successful deletion"},
            )
            return document
        except (ClientError, DynamoServiceException) as e:
            logger.error(
                f"{LambdaError.DocDelClient.to_str()}: {str(e)}",
                {"Results": "Failed to delete documents"},
            )
            raise DocumentDeletionServiceException(500, LambdaError.DocDelClient)

    def _determine_document_type_based_on_common_name(
        self,
        common_name: MtlsCommonNames | None,
    ) -> SnomedCode:
        if not common_name:
            """Determine the document type based on common_name"""
            return SnomedCodes.LLOYD_GEORGE.value
        if common_name not in MtlsCommonNames:
            logger.error(f"mTLS common name {common_name} - is not supported")
            raise DocumentRefException(400, LambdaError.DocRefInvalidType)

        return SnomedCodes.PATIENT_DATA.value

    def is_uuid(self, value: str) -> bool:
        try:
            uuid.UUID(value)
            return True
        except (ValueError, TypeError):
            return False

    def extract_parameters(self, event) -> list[str]:
        nhs_id, document_reference_id = self.extract_document_query_parameters(
            event.get("queryStringParameters") or {},
        )

        if not nhs_id or not document_reference_id:
            logger.error("FHIR document validation error: Missing query parameters.")
            raise DocumentRefException(400, LambdaError.DocRefNoParse)

        return [document_reference_id, nhs_id]

    def extract_document_path_parameters(self, event):
        """Extract DocumentReference ID from path parameters"""
        doc_ref_id = (event.get("pathParameters") or {}).get("id")
        return doc_ref_id

    def extract_document_query_parameters(
        self,
        query_string: Dict[str, str],
    ) -> tuple[Optional[str], Optional[str]]:
        nhs_number = None
        document_reference_id = None

        for key, value in query_string.items():
            if key == PARAM_SUBJECT_IDENTIFIER:
                nhs_number = value.split("|")[-1]
            elif key == DOCUMENT_REFERENCE_IDENTIFIER:
                document_reference_id = value
            else:
                logger.warning(f"Unknown query parameter: {key}")

        return nhs_number, document_reference_id
