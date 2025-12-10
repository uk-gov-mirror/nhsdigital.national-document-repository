import json
import os
from typing import Optional

from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCodes
from enums.supported_document_types import SupportedDocumentTypes
from models.document_reference import DocumentReference, UploadRequestDocument
from models.fhir.R4.fhir_document_reference import Attachment, DocumentReferenceInfo
from pydantic import ValidationError
from services.base.ssm_service import SSMService
from services.post_fhir_document_reference_service import (
    PostFhirDocumentReferenceService,
)
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import NotDeleted, UploadIncomplete
from utils.constants.ssm import UPLOAD_PILOT_ODS_ALLOWED_LIST
from utils.exceptions import (
    InvalidNhsNumberException,
    LGInvalidFilesException,
    PatientNotFoundException,
    PdsTooManyRequestsException,
)
from utils.lambda_exceptions import DocumentRefException
from utils.lloyd_george_validator import (
    getting_patient_info_from_pds,
    validate_lg_files_for_access_and_store,
)
from utils.request_context import request_context
from utils.utilities import create_reference_id

FAILED_CREATE_REFERENCE_MESSAGE = "Create document reference failed"
PROVIDED_DOCUMENT_SUPPORTED_MESSAGE = "Provided document is supported"
UPLOAD_REFERENCE_SUCCESS_MESSAGE = "Upload reference creation was successful"
UPLOAD_REFERENCE_FAILED_MESSAGE = "Upload reference creation was unsuccessful"
PRESIGNED_URL_ERROR_MESSAGE = (
    "An error occurred when creating pre-signed url for document reference"
)

logger = LoggingService(__name__)


class CreateDocumentReferenceService:
    def __init__(self):
        self.post_fhir_doc_ref_service = PostFhirDocumentReferenceService()
        self.ssm_service = SSMService()

        self.lg_dynamo_table = os.getenv("LLOYD_GEORGE_DYNAMODB_NAME")
        self.arf_dynamo_table = os.getenv("DOCUMENT_STORE_DYNAMODB_NAME")
        self.staging_bucket_name = os.getenv("STAGING_STORE_BUCKET_NAME")
        self.upload_sub_folder = "user_upload"

    def create_document_reference_request(
        self, nhs_number: str, documents_list: list[dict]
    ):
        arf_documents: list[DocumentReference] = []
        upload_lg_documents: list[UploadRequestDocument] = []
        url_responses = {}
        upload_request_documents = self.parse_documents_list(documents_list)

        has_lg_document = any(
            document.doc_type == SupportedDocumentTypes.LG
            for document in upload_request_documents
        )

        try:
            snomed_code_type = SnomedCodes.LLOYD_GEORGE.value
            current_gp_ods = ""
            if has_lg_document:
                pds_patient_details = getting_patient_info_from_pds(nhs_number)
                current_gp_ods = (
                    pds_patient_details.get_ods_code_or_inactive_status_for_gp()
                )
                ods_allowed = self.check_if_ods_code_is_in_pilot(current_gp_ods)
                if not ods_allowed:
                    raise DocumentRefException(404, LambdaError.DocRefOdsCodeNotAllowed)
                self.check_existing_lloyd_george_records_and_remove_failed_upload(
                    nhs_number
                )

            if isinstance(request_context.authorization, dict):
                user_ods_code = request_context.authorization.get(
                    "selected_organisation", {}
                ).get("org_ods_code", "")

            for validated_doc in upload_request_documents:
                document_reference = self.create_document_reference(
                    nhs_number, current_gp_ods, validated_doc, snomed_code_type.code
                )

                match document_reference.doc_type:
                    case SupportedDocumentTypes.ARF:
                        # change snomed_code_type to ARF when available
                        arf_documents.append(document_reference)
                    case SupportedDocumentTypes.LG:
                        upload_lg_documents.append(validated_doc)
                    case _:
                        logger.error(
                            f"{LambdaError.DocRefInvalidType.to_str()}",
                            {"Result": UPLOAD_REFERENCE_FAILED_MESSAGE},
                        )
                        raise DocumentRefException(400, LambdaError.DocRefInvalidType)

                attachment_details = Attachment(
                    title=validated_doc.file_name,
                )

                doc_ref_info = DocumentReferenceInfo(
                    nhs_number=nhs_number,
                    snomed_code_doc_type=snomed_code_type,
                    attachment=attachment_details,
                    author=user_ods_code,
                )

                fhir_doc_ref = doc_ref_info.create_fhir_document_reference_object(
                    document_reference
                )

                fhir_response = (
                    self.post_fhir_doc_ref_service.process_fhir_document_reference(
                        fhir_doc_ref.model_dump_json()
                    )
                )
                fhir_response_data = json.loads(fhir_response)
                url_responses[validated_doc.client_id] = fhir_response_data["content"][
                    0
                ]["attachment"]["url"]

            if upload_lg_documents:
                validate_lg_files_for_access_and_store(
                    upload_lg_documents, pds_patient_details
                )

            if arf_documents:
                self.check_existing_arf_record_and_remove_failed_upload(nhs_number)

            return url_responses

        except PatientNotFoundException:
            raise DocumentRefException(404, LambdaError.SearchPatientNoPDS)

        except (
            InvalidNhsNumberException,
            LGInvalidFilesException,
            PdsTooManyRequestsException,
        ) as e:
            logger.error(
                f"{LambdaError.DocRefInvalidFiles.to_str()} :{str(e)}",
                {"Result": FAILED_CREATE_REFERENCE_MESSAGE},
            )
            raise DocumentRefException(400, LambdaError.DocRefInvalidFiles)

    def check_if_ods_code_is_in_pilot(self, ods_code) -> bool:
        pilot_ods_codes = self.get_allowed_list_of_ods_codes_for_upload_pilot()
        return ods_code in pilot_ods_codes

    def check_existing_arf_record_and_remove_failed_upload(self, nhs_number):
        incomplete_arf_upload_records = self.fetch_incomplete_arf_upload_records(
            nhs_number
        )
        self.stop_if_upload_is_in_process(incomplete_arf_upload_records)
        self.remove_records_of_failed_upload(
            self.arf_dynamo_table, incomplete_arf_upload_records
        )

    def parse_documents_list(
        self, document_list: list[dict]
    ) -> list[UploadRequestDocument]:
        upload_request_document_list = []
        for document in document_list:
            try:
                validated_doc: UploadRequestDocument = (
                    UploadRequestDocument.model_validate(document)
                )
                upload_request_document_list.append(validated_doc)
            except ValidationError as e:
                logger.error(
                    f"{LambdaError.DocRefNoParse.to_str()} :{str(e)}",
                    {"Result": FAILED_CREATE_REFERENCE_MESSAGE},
                )
                raise DocumentRefException(400, LambdaError.DocRefNoParse)

        return upload_request_document_list

    def create_document_reference(
        self,
        nhs_number: str,
        current_gp_ods: str,
        validated_doc: UploadRequestDocument,
        snomed_code_type: Optional[str] = None,
    ) -> DocumentReference:

        s3_bucket_name = self.staging_bucket_name
        sub_folder = self.upload_sub_folder

        logger.info(PROVIDED_DOCUMENT_SUPPORTED_MESSAGE)

        s3_object_key = create_reference_id()

        document_reference = DocumentReference(
            id=s3_object_key,
            nhs_number=nhs_number,
            author=current_gp_ods,
            current_gp_ods=current_gp_ods,
            custodian=current_gp_ods,
            content_type=validated_doc.content_type,
            file_name=validated_doc.file_name,
            doc_type=validated_doc.doc_type,
            document_snomed_code_type=snomed_code_type,
            s3_bucket_name=s3_bucket_name,
            sub_folder=sub_folder,
            uploading=True,
            doc_status="preliminary",
        )
        return document_reference

    def check_existing_lloyd_george_records_and_remove_failed_upload(
        self,
        nhs_number: str,
    ) -> None:
        logger.info("Looking for previous records for this patient...")

        previous_records = self.post_fhir_doc_ref_service.document_service.fetch_available_document_references_by_type(
            nhs_number=nhs_number,
            doc_type=SupportedDocumentTypes.LG,
            query_filter=NotDeleted,
        )
        if not previous_records:
            logger.info(
                "No record was found for this patient. Will continue to create doc ref."
            )
            return

        self.stop_if_all_records_uploaded(previous_records)
        self.stop_if_upload_is_in_process(previous_records)
        self.remove_records_of_failed_upload(self.lg_dynamo_table, previous_records)

    def stop_if_upload_is_in_process(self, previous_records: list[DocumentReference]):
        if any(
            self.post_fhir_doc_ref_service.document_service.is_upload_in_process(
                document
            )
            for document in previous_records
        ):
            logger.error(
                "Records are in the process of being uploaded. Will not process the new upload.",
                {"Result": UPLOAD_REFERENCE_FAILED_MESSAGE},
            )
            raise DocumentRefException(423, LambdaError.UploadInProgressError)

    def stop_if_all_records_uploaded(self, previous_records: list[DocumentReference]):
        all_records_uploaded = all(record.uploaded for record in previous_records)
        if all_records_uploaded:
            logger.info(
                "The patient already has a full set of record. "
                "We should not be processing the new Lloyd George record upload."
            )
            logger.error(
                f"{LambdaError.DocRefRecordAlreadyInPlace.to_str()}",
                {"Result": UPLOAD_REFERENCE_FAILED_MESSAGE},
            )
            raise DocumentRefException(422, LambdaError.DocRefRecordAlreadyInPlace)

    def remove_records_of_failed_upload(
        self,
        table_name: str,
        failed_upload_records: list[DocumentReference],
    ):
        logger.info(
            "Found previous records of failed upload. "
            "Will delete those records before creating new document references."
        )

        logger.info("Deleting files from s3...")
        for record in failed_upload_records:
            s3_bucket_name, s3_file_key = record._parse_s3_location(
                record.file_location
            )
            self.post_fhir_doc_ref_service.s3_service.delete_object(
                s3_bucket_name, s3_file_key
            )

        logger.info("Deleting dynamodb record...")
        self.post_fhir_doc_ref_service.document_service.hard_delete_metadata_records(
            table_name=table_name, document_references=failed_upload_records
        )

        logger.info("Previous failed records are deleted.")

    def fetch_incomplete_arf_upload_records(
        self, nhs_number
    ) -> list[DocumentReference]:
        return self.post_fhir_doc_ref_service.document_service.fetch_available_document_references_by_type(
            nhs_number=nhs_number,
            doc_type=SupportedDocumentTypes.ARF,
            query_filter=UploadIncomplete,
        )

    def get_allowed_list_of_ods_codes_for_upload_pilot(self) -> list[str]:
        logger.info(
            "Starting ssm request to retrieve allowed list of ODS codes for Upload Pilot"
        )
        response = self.ssm_service.get_ssm_parameter(UPLOAD_PILOT_ODS_ALLOWED_LIST)
        if not response:
            logger.warning("No ODS codes found in allowed list for Upload Pilot")
        return response
