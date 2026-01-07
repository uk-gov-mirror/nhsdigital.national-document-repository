import os
import uuid
from datetime import datetime, timezone

from botocore.exceptions import ClientError

from enums.document_review_reason import DocumentReviewReason
from enums.document_review_status import DocumentReviewStatus
from enums.lambda_error import LambdaError
from enums.patient_ods_inactive_status import PatientOdsInactiveStatus
from models.document_review import (
    DocumentReviewFileDetails,
    DocumentReviewUploadEvent,
    DocumentUploadReviewReference,
)
from pydantic import ValidationError
from services.base.s3_service import S3Service
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import (
    DocumentReviewException,
    OdsErrorException,
    PatientNotFoundException,
)
from utils.lambda_exceptions import DocumentReviewLambdaException
from utils.ods_utils import extract_ods_code_from_request_context
from utils.utilities import format_cloudfront_url, get_pds_service

logger = LoggingService(__name__)


class PostDocumentReviewService:
    def __init__(self):
        presigned_aws_role_arn = os.getenv("PRESIGNED_ASSUME_ROLE")
        self.pds_service = get_pds_service()
        self.s3_service = S3Service(custom_aws_role=presigned_aws_role_arn)
        self.review_document_service = DocumentUploadReviewService()
        self.staging_bucket = os.environ["STAGING_STORE_BUCKET_NAME"]
        self.cloudfront_url = os.environ["CLOUDFRONT_URL"]
        self.edge_reference_table = os.environ["EDGE_REFERENCE_TABLE"]

    def process_event(self, event: DocumentReviewUploadEvent) -> dict:
        try:
            author = extract_ods_code_from_request_context()
            patient_details = self.pds_service.fetch_patient_details(event.nhs_number)

            if (
                patient_details.general_practice_ods
                == PatientOdsInactiveStatus.DECEASED
            ):
                logger.info("Patient is deceased, upload will not proceed.")
                raise DocumentReviewLambdaException(
                    403, LambdaError.DocumentReviewUploadForbidden
                )

            document_review_reference = self.create_review_reference_from_event(
                event=event, author=author, patient_details=patient_details
            )

            logger.info("Creating entry in DynamoDB")
            self.review_document_service.create_dynamo_entry(
                item=document_review_reference
            )

            logger.info("Creating presigned URLs for files.")
            self.create_presigned_urls_for_review_reference_files(
                document_review_reference=document_review_reference
            )

            return self.create_response(
                document_review_reference=document_review_reference
            )

        except OdsErrorException:
            raise DocumentReviewLambdaException(
                400, LambdaError.DocumentReviewMissingODS
            )
        except PatientNotFoundException:
            raise DocumentReviewLambdaException(
                400, LambdaError.DocumentReviewUploadInvalidRequest
            )
        except ValidationError:
            raise DocumentReviewLambdaException(
                500, LambdaError.DocumentReviewValidation
            )
        except ClientError:
            raise DocumentReviewLambdaException(500, LambdaError.DocumentReviewDB)


    def create_response(
        self, document_review_reference: DocumentUploadReviewReference
    ) -> dict:
        logger.info("Creating response body.")
        return document_review_reference.model_dump_camel_case(
            exclude_none=True,
            mode="json",
            include={
                "id": True,
                "upload_date": True,
                "files": {"__all__": {"file_name": True, "presigned_url": True}},
                "document_snomed_code_type": True,
                "version": True,
            },
        )

    def create_review_reference_from_event(
        self, event, author, patient_details
    ) -> DocumentUploadReviewReference:
        logger.info(f"Creating DocumentUploadReviewReference from event: {event}")

        document_file_details = [
            DocumentReviewFileDetails(file_name=file) for file in event.documents
        ]

        document_review_reference = DocumentUploadReviewReference(
            author=author,
            custodian=patient_details.general_practice_ods,
            review_status=DocumentReviewStatus.REVIEW_PENDING_UPLOAD,
            files=document_file_details,
            nhs_number=event.nhs_number,
            document_snomed_code_type=event.snomed_code.code,
            review_reason=DocumentReviewReason.GP2GP_ERROR,
        )
        return document_review_reference

    def create_presigned_urls_for_review_reference_files(
        self, document_review_reference: DocumentUploadReviewReference
    ) -> None:
        try:
            for document_file in document_review_reference.files:
                upload_id = str(uuid.uuid4())
                document_file.presigned_url = (
                    self.create_review_document_upload_presigned_url(
                        file_key=f"review/{document_review_reference.id}/{upload_id}",
                        upload_id=upload_id,
                    )
                )
        except DocumentReviewException as e:
            logger.error(e)
            raise DocumentReviewLambdaException(
                500, LambdaError.DocumentReviewPresignedFailure
            )

    def create_review_document_upload_presigned_url(
        self, file_key: str, upload_id: str
    ) -> str:
        try:
            logger.info(f"Creating presigned URL for file: {file_key}")
            presign_url_response = self.s3_service.create_put_presigned_url(
                s3_bucket_name=self.staging_bucket,
                file_key=file_key,
            )
            presigned_id = f"upload/{upload_id}"
            deletion_date = datetime.now(timezone.utc)

            ttl_in_seconds = self.s3_service.presigned_url_expiry
            dynamo_item_ttl = int(deletion_date.timestamp() + ttl_in_seconds)
            self.review_document_service.dynamo_service.create_item(
                table_name=self.edge_reference_table,
                item={
                    "ID": presigned_id,
                    "presignedUrl": presign_url_response,
                    "TTL": dynamo_item_ttl,
                },
            )
            return format_cloudfront_url(presigned_id, self.cloudfront_url)
        except ClientError as e:
            logger.error(e)
            raise DocumentReviewException("Failed to create presigned url")
