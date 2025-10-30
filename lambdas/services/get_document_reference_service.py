import os
from services.get_fhir_document_reference_service import (
    GetFhirDocumentReferenceService,
    GetFhirDocumentReferenceException
)
from utils.audit_logging_setup import LoggingService
from services.base.s3_service import S3Service
from services.base.dynamo_service import DynamoDBService
from utils.lambda_exceptions import GetDocumentRefException
from enums.lambda_error import LambdaError

logger = LoggingService(__name__)

class GetDocumentReferenceService:
    def __init__(self):
        self.fhir_doc_service = GetFhirDocumentReferenceService()
        get_document_presign_url_aws_role_arn = os.getenv("PRESIGNED_ASSUME_ROLE")
        self.s3_service = S3Service(get_document_presign_url_aws_role_arn)

    def get_document_url_by_id(self, document_id: str, snomed_code: str, nhs_number: str):
        document_reference = self.fhir_doc_service.handle_get_document_reference_request(
            snomed_code,
            document_id)
        
        if document_reference.nhs_number != nhs_number:
            raise GetDocumentRefException(404, LambdaError.NHSNumberMismatch) #is 404 correct?
        
        presigned_s3_url = self.s3_service.create_download_presigned_url(
            document_reference.s3_bucket_name,
            document_reference.s3_file_key
            )
        
        if presigned_s3_url is None:
            raise GetDocumentRefException(500, LambdaError.InternalServerError)
        
        return presigned_s3_url