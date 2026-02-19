import base64
import binascii
import io
import os

from botocore.exceptions import ClientError
from enums.lambda_error import LambdaError
from enums.patient_ods_inactive_status import PatientOdsInactiveStatus
from enums.snomed_codes import SnomedCode, SnomedCodes
from models.document_reference import DocumentReference
from models.fhir.R4.fhir_document_reference import (
    SNOMED_URL,
    Attachment,
)
from models.fhir.R4.fhir_document_reference import (
    DocumentReference as FhirDocumentReference,
)
from models.fhir.R4.fhir_document_reference import (
    DocumentReferenceInfo,
)
from models.pds_models import PatientDetails
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service
from services.document_service import DocumentService
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import CurrentStatusFile
from utils.dynamo_utils import DocTypeTableRouter
from utils.exceptions import (
    FhirDocumentReferenceException,
    InvalidResourceIdException,
    PatientNotFoundException,
    PdsErrorException,
)
from utils.lambda_exceptions import DocumentRefException, InvalidDocTypeException
from utils.ods_utils import PCSE_ODS_CODE
from utils.utilities import create_reference_id, get_pds_service, validate_nhs_number

logger = LoggingService(__name__)


class FhirDocumentReferenceServiceBase:
    def __init__(self):
        presigned_aws_role_arn = os.getenv("PRESIGNED_ASSUME_ROLE")
        self.s3_service = S3Service(custom_aws_role=presigned_aws_role_arn)
        self.dynamo_service = DynamoDBService()
        self.staging_bucket_name = os.getenv("STAGING_STORE_BUCKET_NAME")
        self.document_service = DocumentService()
        self.doc_router = DocTypeTableRouter()

    def _store_binary_in_s3(
        self,
        document_reference: DocumentReference,
        binary_content: bytes,
    ) -> None:
        """Store binary content in S3"""
        try:
            binary_file = io.BytesIO(base64.b64decode(binary_content, validate=True))
            self.s3_service.upload_file_obj(
                file_obj=binary_file,
                s3_bucket_name=document_reference.s3_bucket_name,
                file_key=document_reference.s3_upload_key,
            )
            logger.info(
                f"Successfully stored binary content in S3: {document_reference.s3_upload_key}",
            )
        except (binascii.Error, ValueError) as e:
            logger.error(f"Failed to decode base64: {str(e)}")
            raise FhirDocumentReferenceException(f"Failed to decode base64: {str(e)}")
        except MemoryError as e:
            logger.error(f"File too large to process: {str(e)}")
            raise FhirDocumentReferenceException(f"File too large to process: {str(e)}")
        except ClientError as e:
            logger.error(f"Failed to store binary in S3: {str(e)}")
            raise FhirDocumentReferenceException(
                f"Failed to store binary in S3: {str(e)}",
            )
        except (OSError, IOError) as e:
            logger.error(f"I/O error when processing binary content: {str(e)}")
            raise FhirDocumentReferenceException(
                f"I/O error when processing binary content: {str(e)}",
            )

    def _create_s3_presigned_url(self, document_reference: DocumentReference) -> str:
        """Create a pre-signed URL for uploading a file"""
        try:
            response = self.s3_service.create_put_presigned_url(
                document_reference.s3_bucket_name,
                document_reference.s3_upload_key,
            )
            logger.info(
                f"Successfully created pre-signed URL for {document_reference.s3_upload_key}",
            )
            return response
        except ClientError as e:
            logger.error(f"Failed to create pre-signed URL: {str(e)}")
            raise FhirDocumentReferenceException(
                f"Failed to create pre-signed URL: {str(e)}",
            )

    def _create_document_reference(
        self,
        nhs_number: str,
        doc_type: SnomedCode,
        fhir_doc: FhirDocumentReference,
        current_gp_ods: str,
        version: str,
        s3_file_key: str,
    ) -> DocumentReference:
        """Create a document reference model"""
        document_id = create_reference_id()

        custodian = fhir_doc.custodian.identifier.value if fhir_doc.custodian else None
        if not custodian:
            custodian = (
                current_gp_ods
                if current_gp_ods not in PatientOdsInactiveStatus.list()
                else PCSE_ODS_CODE
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
            sub_folder="user_upload",
            version=version,
            s3_file_key=s3_file_key,
            uploading=True,
        )

        return document_reference

    def _get_document_reference(self, document_id: str, table) -> DocumentReference:
        documents = self.document_service.fetch_documents_from_table(
            table_name=table,
            search_condition=document_id,
            search_key="ID",
            query_filter=CurrentStatusFile,
        )
        if len(documents) > 0:
            logger.info("Document found for given id")
            return documents[0]
        raise FhirDocumentReferenceException(
            f"Did not find any documents for document ID {document_id}",
        )

    def _determine_document_type(self, fhir_doc: FhirDocumentReference) -> SnomedCode:
        """Determine the document type based on SNOMED code in the FHIR document"""
        if fhir_doc.type and fhir_doc.type.coding:
            for coding in fhir_doc.type.coding:
                if coding.system == SNOMED_URL:
                    if coding.code == SnomedCodes.LLOYD_GEORGE.value.code:
                        return SnomedCodes.LLOYD_GEORGE.value
        logger.error("SNOMED code not found in FHIR document")
        raise FhirDocumentReferenceException("SNOMED code not found in FHIR document")

    def _save_document_reference_to_dynamo(
        self,
        table_name: str,
        document_reference: DocumentReference,
    ) -> None:
        """Save document reference to DynamoDB"""
        try:
            self.dynamo_service.create_item(
                table_name,
                document_reference.model_dump(exclude_none=True, by_alias=True),
            )
            logger.info(f"Successfully created document reference in {table_name}")
        except ClientError as e:
            logger.error(f"Failed to create document reference: {str(e)}")
            raise FhirDocumentReferenceException(
                f"Failed to create document reference: {str(e)}",
            )

    def _check_nhs_number_with_pds(self, nhs_number: str) -> PatientDetails:
        try:
            validate_nhs_number(nhs_number)
            pds_service = get_pds_service()
            return pds_service.fetch_patient_details(nhs_number)
        except (
            PatientNotFoundException,
            InvalidResourceIdException,
            PdsErrorException,
        ) as e:
            logger.error(f"Error occurred when fetching patient details: {str(e)}")
            raise FhirDocumentReferenceException(
                f"Error occurred when fetching patient details: {str(e)}",
            )

    def _create_fhir_response(
        self,
        document_reference_ndr: DocumentReference,
        presigned_url: str,
    ) -> str:
        """Create a FHIR response document"""

        if presigned_url:
            attachment_url = presigned_url
        else:
            document_retrieve_endpoint = os.getenv(
                "DOCUMENT_RETRIEVE_ENDPOINT_APIM",
                "",
            )
            attachment_url = (
                document_retrieve_endpoint + "/" + document_reference_ndr.id
            )
        document_details = Attachment(
            title=document_reference_ndr.file_name,
            creation=document_reference_ndr.document_scan_creation
            or document_reference_ndr.created,
            url=attachment_url,
        )
        fhir_document_reference = (
            DocumentReferenceInfo(
                nhs_number=document_reference_ndr.nhs_number,
                attachment=document_details,
                custodian=document_reference_ndr.custodian,
                snomed_code_doc_type=SnomedCodes.find_by_code(
                    document_reference_ndr.document_snomed_code_type,
                ),
            )
            .create_fhir_document_reference_object(document_reference_ndr)
            .model_dump_json(exclude_none=True)
        )

        return fhir_document_reference

    def _get_dynamo_table_for_doc_type(self, doc_type: SnomedCode) -> str:
        try:
            return self.doc_router.resolve(doc_type)
        except InvalidDocTypeException:
            raise DocumentRefException(400, LambdaError.DocTypeDB)

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
                raise DocumentRefException(500, LambdaError.DocRefNoParse)
        else:
            # Create a pre-signed URL for uploading
            try:
                presigned_url = self._create_s3_presigned_url(document_reference)
            except FhirDocumentReferenceException:
                raise DocumentRefException(500, LambdaError.InternalServerError)
        try:
            # Save document reference to DynamoDB
            self._save_document_reference_to_dynamo(dynamo_table, document_reference)
        except FhirDocumentReferenceException:
            raise DocumentRefException(500, LambdaError.DocRefUploadInternalError)

        return presigned_url
