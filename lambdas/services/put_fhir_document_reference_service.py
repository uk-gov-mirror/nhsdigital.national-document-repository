from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCode
from models.document_reference import DocumentReference
from models.fhir.R4.fhir_document_reference import (
    DocumentReference as FhirDocumentReference,
)
from pydantic import ValidationError
from services.fhir_document_reference_service_base import (
    FhirDocumentReferenceServiceBase,
)
from utils.audit_logging_setup import LoggingService
from utils.dynamo_utils import DocTypeTableRouter
from utils.exceptions import FhirDocumentReferenceException, InvalidNhsNumberException
from utils.lambda_exceptions import (
    InvalidDocTypeException,
    UpdateFhirDocumentReferenceException,
)

logger = LoggingService(__name__)


class PutFhirDocumentReferenceService(FhirDocumentReferenceServiceBase):
    def __init__(self):
        self.doc_router = DocTypeTableRouter()

    def process_fhir_document_reference(self, fhir_document: str) -> str:
        try:
            validated_fhir_doc = FhirDocumentReference.model_validate_json(
                fhir_document
            )
        except ValidationError as e:
            logger.error(f"FHIR document validation error: {str(e)}")
            raise UpdateFhirDocumentReferenceException(
                400, LambdaError.UpdateDocNoParse
            )

        try:
            # Extract document type
            doc_type = self._determine_document_type(validated_fhir_doc)
        except FhirDocumentReferenceException:
            logger.error("Could not determine document type")
            raise UpdateFhirDocumentReferenceException(
                400, LambdaError.UpdateDocInvalidType
            )

        # Determine which DynamoDB table to use based on the document type
        dynamo_table = self._get_dynamo_table_for_doc_type(doc_type)

        # Get the current document from the database
        current_doc = self._get_current_doc(validated_fhir_doc, dynamo_table)

        # Check that the NHS number in the request matches the one in the stored document
        request_nhs_number = self._validate_nhs_number(validated_fhir_doc, current_doc)

        # Check that the version number matches the stored document
        self._validate_version_number(validated_fhir_doc, current_doc)

        # Create a new document reference with the new version number
        new_doc_reference = self._create_new_document_reference(
            validated_fhir_doc, current_doc, request_nhs_number, doc_type
        )

        # Handle binary content if present, otherwise create a pre-signed URL
        presigned_url = self._handle_document_save(
            new_doc_reference, validated_fhir_doc, dynamo_table
        )

        try:
            return self._create_fhir_response(new_doc_reference, presigned_url)
        except (ValidationError, InvalidNhsNumberException) as e:
            logger.error(f"FHIR document validation error: {str(e)}")
            raise UpdateFhirDocumentReferenceException(
                400, LambdaError.UpdateDocNoParse
            )

    def _get_current_doc(
        self, fhir_doc: FhirDocumentReference, dynamo_table: str
    ) -> DocumentReference:
        try:
            current_doc = self._get_document_reference(fhir_doc.id, dynamo_table)
        except FhirDocumentReferenceException:
            logger.error("No document found for the given document ID.")
            raise UpdateFhirDocumentReferenceException(
                404, LambdaError.DocumentReferenceNotFound
            )

        if current_doc.doc_status != "final":
            logger.error("Document is not the latest version.")
            raise UpdateFhirDocumentReferenceException(
                400, LambdaError.UpdateDocNotLatestVersion
            )

        return current_doc

    def _validate_nhs_number(
        self, fhir_doc: FhirDocumentReference, current_doc: DocumentReference
    ):
        try:
            request_nhs_number = fhir_doc.extract_nhs_number_from_fhir()
        except FhirDocumentReferenceException:
            logger.error("Could not find NHS number in request fhir document reference")
            raise UpdateFhirDocumentReferenceException(
                400, LambdaError.UpdateDocNoParse
            )

        if current_doc.nhs_number != request_nhs_number:
            logger.error("NHS numbers do not match.")
            raise UpdateFhirDocumentReferenceException(
                400, LambdaError.UpdateDocNHSNumberMismatch
            )

        return request_nhs_number

    def _validate_version_number(
        self, fhir_doc: FhirDocumentReference, current_doc: DocumentReference
    ):
        if fhir_doc.meta is None:
            logger.error("Missing version number")
            raise UpdateFhirDocumentReferenceException(
                400, LambdaError.DocumentReferenceMissingParameters
            )

        if current_doc.version != fhir_doc.meta.versionId:
            logger.error("Version does not match current version.")
            raise UpdateFhirDocumentReferenceException(
                400, LambdaError.UpdateDocVersionMismatch
            )

    def _create_new_document_reference(
        self,
        fhir_doc: FhirDocumentReference,
        current_doc: DocumentReference,
        nhs_number: str,
        doc_type: SnomedCode,
    ) -> DocumentReference:
        try:
            patient_details = self._check_nhs_number_with_pds(nhs_number)
        except FhirDocumentReferenceException:
            raise UpdateFhirDocumentReferenceException(
                400, LambdaError.UpdatePatientSearchInvalid
            )

        new_doc_version = int(current_doc.version) + 1

        # Create a document reference model
        document_reference = self._create_document_reference(
            nhs_number,
            doc_type,
            fhir_doc,
            patient_details.general_practice_ods,
            str(new_doc_version),
            current_doc.s3_file_key,
        )

        return document_reference

    def _handle_document_save(
        self,
        document_reference: DocumentReference,
        fhir_doc: FhirDocumentReference,
        dynamo_table: str,
    ) -> str:
        binary_content = fhir_doc.content[0].attachment.data

        presigned_url = None
        # Handle binary content if present, otherwise create a pre-signed URL
        if binary_content:
            try:
                self._store_binary_in_s3(document_reference, binary_content)
            except FhirDocumentReferenceException:
                raise UpdateFhirDocumentReferenceException(
                    500, LambdaError.UpdateDocNoParse
                )
        else:
            # Create a pre-signed URL for uploading
            try:
                presigned_url = self._create_s3_presigned_url(document_reference)
            except FhirDocumentReferenceException:
                raise UpdateFhirDocumentReferenceException(
                    500, LambdaError.InternalServerError
                )
        try:
            # Save document reference to DynamoDB
            self._save_document_reference_to_dynamo(dynamo_table, document_reference)
        except FhirDocumentReferenceException:
            raise UpdateFhirDocumentReferenceException(
                500, LambdaError.UpdateDocUploadInternalError
            )

        return presigned_url

    def _get_dynamo_table_for_doc_type(self, doc_type: SnomedCode) -> str:
        try:
            return self.doc_router.resolve(doc_type)
        except InvalidDocTypeException:
            logger.error("")
            raise UpdateFhirDocumentReferenceException(400, LambdaError.DocTypeInvalid)
