from botocore.exceptions import ClientError
from enums.lambda_error import LambdaError
from enums.mtls import MtlsCommonNames
from enums.snomed_codes import SnomedCode, SnomedCodes
from models.document_reference import DocumentReference
from models.fhir.R4.fhir_document_reference import SNOMED_URL
from models.fhir.R4.fhir_document_reference import (
    DocumentReference as FhirDocumentReference,
)
from pydantic import ValidationError
from services.fhir_document_reference_service_base import (
    FhirDocumentReferenceServiceBase,
)
from utils.audit_logging_setup import LoggingService
from utils.exceptions import FhirDocumentReferenceException, InvalidNhsNumberException
from utils.lambda_exceptions import DocumentRefException
from utils.lambda_header_utils import validate_common_name_in_mtls
from utils.utilities import create_reference_id

logger = LoggingService(__name__)


class PostFhirDocumentReferenceService(FhirDocumentReferenceServiceBase):
    def __init__(self):
        super().__init__()

    def process_fhir_document_reference(
        self, fhir_document: str, api_request_context: dict = {}
    ) -> str:
        """
        Process a FHIR Document Reference request

        Args:
            fhir_document: FHIR Document Reference object

        Returns:
            FHIR Document Reference response JSON object
        """
        try:
            common_name = validate_common_name_in_mtls(api_request_context)

            validated_fhir_doc = FhirDocumentReference.model_validate_json(
                fhir_document
            )

            # Extract NHS number from the FHIR document
            try:
                nhs_number = validated_fhir_doc.extract_nhs_number_from_fhir()
            except FhirDocumentReferenceException:
                raise DocumentRefException(400, LambdaError.DocRefNoParse)

            try:
                patient_details = self._check_nhs_number_with_pds(nhs_number)
            except FhirDocumentReferenceException:
                raise DocumentRefException(400, LambdaError.DocRefPatientSearchInvalid)

            # Extract document type
            doc_type = self._determine_document_type(validated_fhir_doc, common_name)

            # Determine which DynamoDB table to use based on the document type
            dynamo_table = self._get_dynamo_table_for_doc_type(doc_type)

            # Create a document reference model
            document_reference = self._create_document_reference(
                nhs_number,
                doc_type,
                validated_fhir_doc,
                patient_details.general_practice_ods,
                fhir_document,
            )

            presigned_url = self._handle_document_save(
                document_reference, validated_fhir_doc, dynamo_table
            )

            return self._create_fhir_response(document_reference, presigned_url)

        except (ValidationError, InvalidNhsNumberException) as e:
            logger.error(f"FHIR document validation error: {str(e)}")
            raise DocumentRefException(400, LambdaError.DocRefNoParse)
        except ClientError as e:
            logger.error(f"AWS client error: {str(e)}")
            raise DocumentRefException(500, LambdaError.InternalServerError)

    def _determine_document_type(
        self, fhir_doc: FhirDocumentReference, common_name: MtlsCommonNames | None
    ) -> SnomedCode:
        if not common_name:
            """Determine the document type based on SNOMED code in the FHIR document"""
            if fhir_doc.type and fhir_doc.type.coding:
                for coding in fhir_doc.type.coding:
                    if coding.system == SNOMED_URL:
                        if coding.code == SnomedCodes.LLOYD_GEORGE.value.code:
                            return SnomedCodes.LLOYD_GEORGE.value
                    else:
                        logger.error(
                            f"SNOMED code {coding.code} - {coding.display} is not supported"
                        )
                        raise DocumentRefException(400, LambdaError.DocRefInvalidType)
            logger.error("SNOMED code not found in FHIR document")
            raise DocumentRefException(400, LambdaError.DocRefInvalidType)

        if common_name not in MtlsCommonNames:
            logger.error(f"mTLS common name {common_name} - is not supported")
            raise DocumentRefException(400, LambdaError.DocRefInvalidType)

        return SnomedCodes.PATIENT_DATA.value

    def _create_document_reference(
        self,
        nhs_number: str,
        doc_type: SnomedCode,
        fhir_doc: FhirDocumentReference,
        current_gp_ods: str,
        raw_fhir_doc: str,
    ) -> DocumentReference:
        """Create a document reference model"""
        document_id = create_reference_id()

        custodian = fhir_doc.custodian.identifier.value if fhir_doc.custodian else None
        if not custodian:
            custodian = current_gp_ods

        sub_folder, raw_request = (
            ("user_upload", None)
            if doc_type != SnomedCodes.PATIENT_DATA.value
            else (f"fhir_upload/{doc_type.code}", raw_fhir_doc)
        )

        document_reference = DocumentReference(
            id=document_id,
            nhs_number=nhs_number,
            current_gp_ods=current_gp_ods,
            custodian=custodian,
            s3_bucket_name=self.staging_bucket_name,
            author=fhir_doc.author[0].identifier.value,
            content_type=fhir_doc.content[0].attachment.contentType,
            file_name=fhir_doc.content[0].attachment.title,
            document_snomed_code_type=doc_type.code,
            doc_status="preliminary",
            status="current",
            sub_folder=sub_folder,
            document_scan_creation=fhir_doc.content[0].attachment.creation,
            raw_request=raw_request,
        )

        return document_reference
