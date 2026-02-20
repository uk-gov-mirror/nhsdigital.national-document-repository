import json
import os
from typing import Optional

from pydantic import ValidationError

from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCodes
from enums.supported_document_types import SupportedDocumentTypes
from enums.upload_forbidden_file_extensions import is_file_type_allowed
from models.document_reference import DocumentReference, UploadRequestDocument
from models.fhir.R4.fhir_document_reference import Attachment, DocumentReferenceInfo
from services.base.ssm_service import SSMService
from services.feature_flags_service import FeatureFlagService
from services.post_fhir_document_reference_service import (
    PostFhirDocumentReferenceService,
)
from utils import upload_file_configs
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import get_document_type_filter
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.exceptions import (
    ConfigNotFoundException,
    InvalidNhsNumberException,
    LGInvalidFilesException,
    OdsErrorException,
    PatientNotFoundException,
    PdsTooManyRequestsException,
)
from utils.lambda_exceptions import DocumentRefException
from utils.lloyd_george_validator import (
    check_for_duplicate_files,
    getting_patient_info_from_pds,
)
from utils.ods_utils import extract_ods_code_from_request_context
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
        self.feature_flag_service = FeatureFlagService()

        self.lg_dynamo_table = os.getenv("LLOYD_GEORGE_DYNAMODB_NAME")
        self.staging_bucket_name = os.getenv("STAGING_STORE_BUCKET_NAME")
        self.upload_sub_folder = "user_upload"

    def create_document_reference_request(
        self,
        nhs_number: str,
        documents_list: list[dict],
    ):
        upload_document_names = []
        url_responses = {}
        upload_request_documents = self.parse_documents_list(documents_list)

        try:
            user_ods_code = extract_ods_code_from_request_context()

            pds_patient_details = getting_patient_info_from_pds(nhs_number)
            patient_ods_code = (
                pds_patient_details.get_ods_code_or_inactive_status_for_gp()
            )
            self.validate_patient_user_ods_codes_match(user_ods_code, patient_ods_code)
            self.check_if_user_ods_code_is_in_pilot(user_ods_code)

            for validated_doc in upload_request_documents:
                snomed_code = validated_doc.doc_type
                config = upload_file_configs.get_config_by_snomed_code(snomed_code)

                if config.single_file_only:
                    self.check_existing_records_and_remove_failed_upload(
                        nhs_number,
                        snomed_code,
                    )

                document_reference = self.create_document_reference(
                    nhs_number,
                    user_ods_code,
                    validated_doc,
                    snomed_code,
                )

                self.validate_document_file_type(validated_doc, config)

                upload_document_names.append(validated_doc.file_name)

                fhir_response, _ = self.build_and_process_fhir_doc_ref(
                    nhs_number,
                    user_ods_code,
                    validated_doc,
                    snomed_code,
                    document_reference,
                )
                fhir_response_data = json.loads(fhir_response)
                url_responses[validated_doc.client_id] = fhir_response_data["content"][
                    0
                ]["attachment"]["url"]

            check_for_duplicate_files(upload_document_names)

            return url_responses

        except PatientNotFoundException:
            raise DocumentRefException(404, LambdaError.SearchPatientNoPDS)

        except OdsErrorException:
            raise DocumentRefException(404, LambdaError.DocRefOdsCodeNotAllowed)

        except (
            InvalidNhsNumberException,
            LGInvalidFilesException,
            PdsTooManyRequestsException,
            ConfigNotFoundException,
        ) as e:
            logger.error(
                f"{LambdaError.DocRefInvalidFiles.to_str()} :{str(e)}",
                {"Result": FAILED_CREATE_REFERENCE_MESSAGE},
            )
            raise DocumentRefException(400, LambdaError.DocRefInvalidFiles)

    def validate_document_file_type(self, validated_doc, document_config):
        if not is_file_type_allowed(
            validated_doc.file_name,
            document_config.accepted_file_types,
        ):
            raise LGInvalidFilesException(
                f"Unsupported file type for file: {validated_doc.file_name}",
            )

    def build_and_process_fhir_doc_ref(
        self,
        nhs_number,
        user_ods_code,
        validated_doc,
        snomed_code,
        document_reference,
    ):
        doc_ref_info = self.build_doc_ref_info(
            validated_doc,
            nhs_number,
            snomed_code,
            user_ods_code,
        )

        fhir_doc_ref = doc_ref_info.create_fhir_document_reference_object(
            document_reference,
        )

        fhir_response, document_id = (
            self.post_fhir_doc_ref_service.process_fhir_document_reference(
                fhir_doc_ref.model_dump_json(),
            )
        )

        return fhir_response, document_id

    def validate_patient_user_ods_codes_match(self, user_ods_code, patient_ods_code):
        if user_ods_code != patient_ods_code:
            logger.error(
                f"{LambdaError.DocRefUnauthorizedOdsCode.to_str()}",
            )
            raise DocumentRefException(401, LambdaError.DocRefUnauthorizedOdsCode)

    def build_doc_ref_info(
        self,
        validated_doc,
        nhs_number,
        snomed_code,
        user_ods_code,
    ) -> DocumentReferenceInfo:
        attachment_details = Attachment(
            title=validated_doc.file_name,
            contentType=validated_doc.content_type,
        )

        doc_ref_info = DocumentReferenceInfo(
            nhs_number=nhs_number,
            snomed_code_doc_type=SnomedCodes.find_by_code(snomed_code),
            attachment=attachment_details,
            author=user_ods_code,
        )

        return doc_ref_info

    def check_if_user_ods_code_is_in_pilot(self, ods_code) -> bool:
        pilot_ods_codes = (
            self.feature_flag_service.get_allowed_list_of_ods_codes_for_upload_pilot()
        )
        if ods_code in pilot_ods_codes or pilot_ods_codes == []:
            return True
        raise OdsErrorException()

    def parse_documents_list(
        self,
        document_list: list[dict],
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
        if len(upload_request_document_list) == 0:
            raise DocumentRefException(400, LambdaError.DocRefInvalidFiles)
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

    def check_existing_records_and_remove_failed_upload(
        self,
        nhs_number: str,
        doc_type: str,
    ) -> None:
        logger.info("Looking for previous records for this patient...")

        query_filter = get_document_type_filter(DynamoQueryFilterBuilder(), doc_type)

        previous_records = self.post_fhir_doc_ref_service.document_service.fetch_available_document_references_by_type(
            nhs_number=nhs_number,
            doc_type=SupportedDocumentTypes(doc_type),
            query_filter=query_filter,
        )
        if not previous_records:
            logger.info(
                "No record was found for this patient. Will continue to create doc ref.",
            )
            return

        self.stop_if_all_records_uploaded(previous_records)
        self.stop_if_upload_is_in_process(previous_records)
        self.remove_records_of_failed_upload(self.lg_dynamo_table, previous_records)

    def stop_if_upload_is_in_process(self, previous_records: list[DocumentReference]):
        if any(
            self.post_fhir_doc_ref_service.document_service.is_upload_in_process(
                document,
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
                "We should not be processing the new Lloyd George record upload.",
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
            "Will delete those records before creating new document references.",
        )

        logger.info("Deleting files from s3...")
        for record in failed_upload_records:
            s3_bucket_name, s3_file_key = record._parse_s3_location(
                record.file_location,
            )
            self.post_fhir_doc_ref_service.s3_service.delete_object(
                s3_bucket_name,
                s3_file_key,
            )

        logger.info("Deleting dynamodb record...")
        self.post_fhir_doc_ref_service.document_service.hard_delete_metadata_records(
            table_name=table_name,
            document_references=failed_upload_records,
        )

        logger.info("Previous failed records are deleted.")
