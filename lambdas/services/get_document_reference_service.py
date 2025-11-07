import os
import uuid
from datetime import datetime, timezone
from services.get_fhir_document_reference_service import (
    GetFhirDocumentReferenceService,
)
from utils.audit_logging_setup import LoggingService
from services.base.s3_service import S3Service
from services.base.dynamo_service import DynamoDBService
from utils.lambda_exceptions import GetDocumentRefException
from enums.lambda_error import LambdaError
from utils.utilities import format_cloudfront_url
from models.document_reference import DocumentReference
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from enums.dynamo_filter import AttributeOperator
from utils.common_query_filters import NotDeleted
from services.document_service import DocumentService

logger = LoggingService(__name__)

class GetDocumentReferenceService:
    def __init__(self):
        self.fhir_doc_service = GetFhirDocumentReferenceService()
        get_document_presign_url_aws_role_arn = os.getenv("PRESIGNED_ASSUME_ROLE")
        self.s3_service = S3Service(get_document_presign_url_aws_role_arn)
        self.dynamo_service = DynamoDBService()
        self.lg_table = os.environ.get("LLOYD_GEORGE_DYNAMODB_NAME")
        self.cloudfront_table_name = os.environ.get("EDGE_REFERENCE_TABLE")
        self.cloudfront_url = os.environ.get("CLOUDFRONT_URL")
        self.document_service = DocumentService()

    def get_document_url_by_id(self, document_id: str, nhs_number: str):
        document_reference = self.get_document_reference(document_id, nhs_number)
        
        presigned_s3_url = self.create_document_presigned_url(
            document_reference.s3_bucket_name,
            document_reference.s3_file_key
            )
        
        return {
            "url": presigned_s3_url,
            "contentType": document_reference.content_type
        }
    
    def create_document_presigned_url(self, bucket_name, file_location):
        presigned_url_response = self.s3_service.create_download_presigned_url(
            s3_bucket_name=bucket_name,
            file_key=file_location,
        )

        presigned_id = str(uuid.uuid4())
        deletion_date = datetime.now(timezone.utc)

        ttl_half_an_hour_in_seconds = self.s3_service.presigned_url_expiry
        dynamo_item_ttl = int(deletion_date.timestamp() + ttl_half_an_hour_in_seconds)
        self.dynamo_service.create_item(
            self.cloudfront_table_name,
            {
                "ID": presigned_id,
                "presignedUrl": presigned_url_response,
                "TTL": dynamo_item_ttl,
            },
        )
        return format_cloudfront_url(presigned_id, self.cloudfront_url)
    
    def get_document_reference(self, document_id: str, nhs_number: str) -> DocumentReference:
        filter_builder = DynamoQueryFilterBuilder()
        filter_builder.add_condition("DocStatus", AttributeOperator.EQUAL, "final")
        filter_builder.add_condition("NhsNumber", AttributeOperator.EQUAL, nhs_number)

        table_filter = filter_builder.build()

        table_filter = table_filter & NotDeleted

        documents = self.document_service.fetch_documents_from_table(
            table=self.lg_table,
            search_condition=document_id,
            search_key="ID",
            query_filter=table_filter,
        )
        if len(documents) > 0:
            logger.info("Document found for given id")
            return documents[0]
        else:
            raise GetDocumentRefException(
                404, LambdaError.DocumentReferenceNotFound
            )