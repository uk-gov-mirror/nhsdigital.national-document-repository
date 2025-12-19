import json

from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCodes
from enums.supported_document_types import SupportedDocumentTypes
from models.document_reference import UploadRequestDocument
from models.fhir.R4.fhir_document_reference import Attachment, DocumentReferenceInfo
from pydantic import ValidationError
from services.base.ssm_service import SSMService
from services.document_service import DocumentService
from services.put_fhir_document_reference_service import PutFhirDocumentReferenceService
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import CurrentStatusFile, NotDeleted
from utils.constants.ssm import UPLOAD_PILOT_ODS_ALLOWED_LIST
from utils.dynamo_utils import DocTypeTableRouter
from utils.exceptions import (
    InvalidNhsNumberException,
    LGInvalidFilesException,
    OdsErrorException,
    PatientNotFoundException,
    PdsTooManyRequestsException,
)
from utils.lambda_exceptions import DocumentRefException
from utils.lloyd_george_validator import (
    getting_patient_info_from_pds,
    validate_files_for_access_and_store,
)
from utils.ods_utils import extract_ods_code_from_request_context

FAILED_UPDATE_REFERENCE_MESSAGE = "Update document reference failed"
UPDATE_REFERENCE_FAILED_MESSAGE = "Update reference was unsuccessful"

logger = LoggingService(__name__)


class UpdateDocumentReferenceService:
    def __init__(self):
        self.fhir_doc_ref_service = PutFhirDocumentReferenceService()
        self.document_service = DocumentService()
        self.ssm_service = SSMService()
        self.doctype_table_router = DocTypeTableRouter()

    def update_document_reference_request(
        self, nhs_number: str, document: dict, doc_ref_id: str
    ):
        self.validate_doc_ref_exists(doc_ref_id)

        url_responses = {}
        update_request_document = self.parse_document(document)

        is_lg_document = update_request_document.doc_type == SupportedDocumentTypes.LG

        try:
            patient_ods_code = ""
            if is_lg_document:
                user_ods_code = extract_ods_code_from_request_context()

                pds_patient_details = getting_patient_info_from_pds(nhs_number)
                patient_ods_code = (
                    pds_patient_details.get_ods_code_or_inactive_status_for_gp()
                )
                self.check_if_ods_code_is_in_pilot(user_ods_code)

            self.validate_user_patient_ods_match(patient_ods_code, user_ods_code)

            validate_files_for_access_and_store(
                [update_request_document], pds_patient_details
            )
            self.stop_if_upload_is_in_progress(nhs_number)

            fhir_response = self.build_and_process_fhir_doc_ref(
                nhs_number, doc_ref_id, update_request_document, user_ods_code
            )

            fhir_response_data = json.loads(fhir_response)
            url_responses[update_request_document.client_id] = fhir_response_data[
                "content"
            ][0]["attachment"]["url"]

            return url_responses

        except PatientNotFoundException:
            raise DocumentRefException(404, LambdaError.SearchPatientNoPDS)

        except OdsErrorException:
            raise DocumentRefException(404, LambdaError.DocRefOdsCodeNotAllowed)

        except (
            InvalidNhsNumberException,
            LGInvalidFilesException,
            PdsTooManyRequestsException,
        ) as e:
            logger.error(
                f"{LambdaError.DocRefInvalidFiles.to_str()} :{str(e)}",
                {"Result": FAILED_UPDATE_REFERENCE_MESSAGE},
            )
            raise DocumentRefException(400, LambdaError.DocRefInvalidFiles)

    def build_and_process_fhir_doc_ref(
        self, nhs_number, doc_ref_id, update_request_document, user_ods_code
    ):
        snomed_code_type = self.get_snomed_code_from_doc(update_request_document)

        doc_ref_info = self.build_doc_ref_info(
            nhs_number, update_request_document, snomed_code_type, user_ods_code
        )

        logger.info(f"Updating document reference for client id: {doc_ref_id}")

        validate_doc_version = update_request_document.version_id

        fhir_doc_ref = doc_ref_info.create_fhir_document_reference_object_basic(
            doc_ref_id, validate_doc_version
        )

        fhir_response = self.fhir_doc_ref_service.process_fhir_document_reference(
            fhir_doc_ref.model_dump_json()
        )

        return fhir_response

    def validate_user_patient_ods_match(self, patient_ods_code, user_ods_code):
        if user_ods_code != patient_ods_code:
            logger.error(
                f"{LambdaError.DocRefUnauthorizedOdsCode.to_str()}",
            )
            raise DocumentRefException(401, LambdaError.DocRefUnauthorizedOdsCode)

    def validate_doc_ref_exists(self, doc_ref_id):
        existing_doc = self.document_service.fetch_documents_from_table(
            table_name=SupportedDocumentTypes.LG.get_dynamodb_table_name(),
            search_condition=doc_ref_id,
            search_key="ID",
            query_filter=CurrentStatusFile,
        )

        if not bool(existing_doc) or not isinstance(existing_doc, list):
            logger.error(
                f"Document reference ID {doc_ref_id} does not exist.",
                {"Result": UPDATE_REFERENCE_FAILED_MESSAGE},
            )
            raise DocumentRefException(404, LambdaError.DocumentReferenceNotFound)

    def get_snomed_code_from_doc(self, update_request_document):
        if update_request_document.doc_type == SupportedDocumentTypes.LG:
            snomed_code_type = SnomedCodes.LLOYD_GEORGE.value
        else:
            logger.error(
                f"{LambdaError.DocRefInvalidType.to_str()}",
                {"Result": UPDATE_REFERENCE_FAILED_MESSAGE},
            )
            raise DocumentRefException(400, LambdaError.DocRefInvalidType)
        return snomed_code_type

    def build_doc_ref_info(
        self, nhs_number, update_request_document, snomed_code_type, user_ods_code
    ):
        attachment_details = Attachment(
            title=update_request_document.file_name,
        )

        doc_ref_info = DocumentReferenceInfo(
            nhs_number=nhs_number,
            snomed_code_doc_type=snomed_code_type,
            attachment=attachment_details,
            author=user_ods_code,
        )

        return doc_ref_info

    def check_if_ods_code_is_in_pilot(self, ods_code) -> bool:
        pilot_ods_codes = self.get_allowed_list_of_ods_codes_for_upload_pilot()
        if ods_code in pilot_ods_codes:
            return True
        else:
            raise OdsErrorException()

    def parse_document(self, document: dict) -> UploadRequestDocument:
        try:
            validated_doc: UploadRequestDocument = UploadRequestDocument.model_validate(
                document
            )
        except ValidationError as e:
            logger.error(
                f"{LambdaError.DocRefNoParse.to_str()} :{str(e)}",
                {"Result": FAILED_UPDATE_REFERENCE_MESSAGE},
            )
            raise DocumentRefException(400, LambdaError.DocRefNoParse)

        return validated_doc

    def stop_if_upload_is_in_progress(self, nhs_number: str):
        previous_records = (
            self.document_service.fetch_available_document_references_by_type(
                nhs_number=nhs_number,
                doc_type=SupportedDocumentTypes.LG,
                query_filter=NotDeleted,
            )
        )

        if any(
            self.document_service.is_upload_in_process(document)
            for document in previous_records
        ):
            logger.error(
                "Records are in the process of being uploaded. Will not process the new upload.",
                {"Result": UPDATE_REFERENCE_FAILED_MESSAGE},
            )
            raise DocumentRefException(423, LambdaError.UploadInProgressError)

    def get_allowed_list_of_ods_codes_for_upload_pilot(self) -> list[str]:
        logger.info(
            "Starting ssm request to retrieve allowed list of ODS codes for Upload Pilot"
        )
        response = self.ssm_service.get_ssm_parameter(UPLOAD_PILOT_ODS_ALLOWED_LIST)
        if not response:
            logger.warning("No ODS codes found in allowed list for Upload Pilot")
        return response
