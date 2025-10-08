import json

from pydantic import Field, ValidationError
from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCodes
from enums.supported_document_types import SupportedDocumentTypes
from models.document_reference import DocumentReference, UploadRequestDocument
from models.fhir.R4.fhir_document_reference import Attachment, DocumentReferenceInfo
from services.base.ssm_service import SSMService
from services.document_service import DocumentService
from services.put_fhir_document_reference_service import PutFhirDocumentReferenceService
from utils.request_context import request_context
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import NotDeleted
from utils.constants.ssm import UPLOAD_PILOT_ODS_ALLOWED_LIST
from utils.exceptions import InvalidNhsNumberException, LGInvalidFilesException, PatientNotFoundException, PdsTooManyRequestsException
from utils.lambda_exceptions import DocumentRefException
from utils.lloyd_george_validator import getting_patient_info_from_pds, validate_lg_files


FAILED_UPDATE_REFERENCE_MESSAGE = "Update document reference failed"
UPDATE_REFERENCE_FAILED_MESSAGE = "Update reference was unsuccessful"

logger = LoggingService(__name__)

class UpdateDocumentReferenceService:
    def __init__(self):
        self.fhir_doc_ref_service = PutFhirDocumentReferenceService()
        self.document_service = DocumentService()
        self.ssm_service = SSMService()

    def update_document_reference_request(
        self, nhs_number: str, documents_list: list[dict], doc_ref_id: str
    ):
        lg_documents: list[UploadRequestDocument] = []
        url_responses = {}
        update_request_documents = self.parse_documents_list(documents_list)

        has_lg_document = any(
            document.docType == SupportedDocumentTypes.LG
            for document in update_request_documents
        )

        try:
            snomed_code_type = None
            patient_ods_code = ""
            if has_lg_document:
                pds_patient_details = getting_patient_info_from_pds(nhs_number)
                patient_ods_code = (
                    pds_patient_details.get_ods_code_or_inactive_status_for_gp()
                )
                ods_allowed = self.check_if_ods_code_is_in_pilot(patient_ods_code)
                if not ods_allowed:
                    raise DocumentRefException(
                        404, LambdaError.DocRefOdsCodeNotAllowed
                    )

                if isinstance(request_context.authorization, dict):
                    user_ods_code = request_context.authorization.get(
                        "selected_organisation", {}
                    ).get("org_ods_code", "")

            for validated_doc in update_request_documents:

                match validated_doc.docType:
                    case SupportedDocumentTypes.LG:
                        lg_documents.append(validated_doc)
                        snomed_code_type = SnomedCodes.LLOYD_GEORGE.value
                    case _:
                        logger.error(
                            f"{LambdaError.DocRefInvalidType.to_str()}",
                            {"Result": UPDATE_REFERENCE_FAILED_MESSAGE},
                        )
                        raise DocumentRefException(
                            400, LambdaError.DocRefInvalidType
                        )

                attachment_details = Attachment(
                    title = validated_doc.fileName,
                )

                doc_ref_info = DocumentReferenceInfo(
                    nhs_number = nhs_number,
                    snomed_code_doc_type = snomed_code_type,
                    attachment = attachment_details,
                    author = user_ods_code
                )

                logger.info(f"Updating document reference for client id: {doc_ref_id}")

                validate_doc_version = validated_doc.versionId

                fhir_doc_ref = doc_ref_info.create_fhir_document_reference_object_basic(doc_ref_id, validate_doc_version)

                fhir_response = self.fhir_doc_ref_service.process_fhir_document_reference(
                    fhir_doc_ref.model_dump_json()
                )
                fhir_response_data = json.loads(fhir_response)
                url_responses[validated_doc.clientId] = fhir_response_data["content"][0]["attachment"]["url"]

            if lg_documents:
                validate_lg_files(lg_documents, pds_patient_details)
                self.check_if_upload_is_in_progress_for_previous_records(nhs_number)

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
                {"Result": FAILED_UPDATE_REFERENCE_MESSAGE},
            )
            raise DocumentRefException(400, LambdaError.DocRefInvalidFiles)

    def check_if_ods_code_is_in_pilot(self, ods_code) -> bool:
        pilot_ods_codes = self.get_allowed_list_of_ods_codes_for_upload_pilot()
        return ods_code in pilot_ods_codes

    def parse_documents_list(
        self, document_list: list[dict]
    ) -> list[UploadRequestDocument]:
        update_request_document_list = []
        for document in document_list:
            try:
                validated_doc: UploadRequestDocument = (
                    UploadRequestDocument.model_validate(document)
                )
                update_request_document_list.append(validated_doc)
            except ValidationError as e:
                logger.error(
                    f"{LambdaError.DocRefNoParse.to_str()} :{str(e)}",
                    {"Result": FAILED_UPDATE_REFERENCE_MESSAGE},
                )
                raise DocumentRefException(400, LambdaError.DocRefNoParse)

        return update_request_document_list

    def check_if_upload_is_in_progress_for_previous_records(
        self,
        nhs_number: str,
    ) -> None:
        logger.info("Looking for previous records for this patient...")

        previous_records = (
            self.document_service.fetch_available_document_references_by_type(
                nhs_number=nhs_number,
                doc_type=SupportedDocumentTypes.LG,
                query_filter=NotDeleted,
            )
        )
        if not previous_records:
            logger.info(
                "No record was found for this patient. Will continue to create doc ref."
            )
            return

        self.stop_if_upload_is_in_progress(previous_records)

    def stop_if_upload_is_in_progress(self, previous_records: list[DocumentReference]):
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