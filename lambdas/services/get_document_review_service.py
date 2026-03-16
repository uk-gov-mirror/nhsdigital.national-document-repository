import os
import uuid
from datetime import datetime, timezone

from enums.cloudwatch_logs_reporting_message import CloudwatchLogsReportingMessage
from enums.document_review_status import DocumentReviewStatus
from enums.lambda_error import LambdaError
from services.base.s3_service import S3Service
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import (
    DocumentNotPendingReviewException,
    DynamoServiceException,
    OdsErrorException,
    UserNotAuthorisedException,
)
from utils.lambda_exceptions import DocumentReviewLambdaException
from utils.ods_utils import extract_ods_code_from_request_context
from utils.utilities import format_cloudfront_url

logger = LoggingService(__name__)


class GetDocumentReviewService:
    def __init__(self):
        presigned_assume_role = os.getenv("PRESIGNED_ASSUME_ROLE")
        self.s3_service = S3Service(custom_aws_role=presigned_assume_role)
        self.document_review_service = DocumentUploadReviewService()
        self.cloudfront_table_name = os.environ.get("EDGE_REFERENCE_TABLE")
        self.cloudfront_url = os.environ.get("CLOUDFRONT_URL")

    def get_document_review(
        self,
        patient_id: str,
        document_id: str,
        document_version: int,
    ) -> dict | None:
        try:

            reviewer_ods_code = extract_ods_code_from_request_context()

            logger.info(
                f"Fetching document review for patient_id: {patient_id}, document_id: {document_id}",
            )

            document_review_item = (
                self.document_review_service.get_document_review_by_id(
                    document_id=document_id,
                    document_version=document_version,
                )
            )

            if not document_review_item:
                logger.info(f"No document review found for document_id: {document_id}")
                return None

            if (
                document_review_item.review_status
                != DocumentReviewStatus.PENDING_REVIEW
            ):
                raise DocumentNotPendingReviewException(
                    "Document is not available for review",
                )

            if reviewer_ods_code != document_review_item.custodian:
                raise UserNotAuthorisedException(
                    f"{reviewer_ods_code} is not custodian of document.",
                )

            if document_review_item.nhs_number != patient_id:
                logger.warning(
                    f"Document {document_id} does not belong to patient {patient_id}",
                )
                return None

            if document_review_item.files:
                for file_detail in document_review_item.files:
                    presigned_url = self.create_cloudfront_presigned_url(
                        file_detail.file_location,
                    )
                    file_detail.presigned_url = presigned_url

            document_review = document_review_item.model_dump_camel_case(
                include={
                    "id": True,
                    "version": True,
                    "upload_date": True,
                    "files": {"__all__": {"file_name": True, "presigned_url": True}},
                    "document_snomed_code_type": True,
                },
            )

            logger.info(
                f"{CloudwatchLogsReportingMessage.USERS_ACCESSED_REVIEW}: {document_id}",
            )

            return document_review

        except DynamoServiceException as e:
            logger.error(
                f"{LambdaError.DocRefClient.to_str()}: {str(e)}",
                {"Result": "Failed to retrieve document review"},
            )
            raise DocumentReviewLambdaException(500, LambdaError.DocRefClient)
        except OdsErrorException as e:
            logger.error(e)
            raise DocumentReviewLambdaException(
                403,
                LambdaError.DocumentReviewMissingODS,
            )
        except UserNotAuthorisedException as e:
            logger.error(e)
            raise DocumentReviewLambdaException(
                403,
                LambdaError.DocumentReviewUploadForbidden,
            )
        except DocumentNotPendingReviewException as e:
            logger.error(e)
            raise DocumentReviewLambdaException(
                400,
                LambdaError.DocumentReviewNotPendingReview,
            )

        except Exception as e:
            logger.error(
                f"Unexpected error retrieving document review: {str(e)}",
                {"Result": "Failed to retrieve document review"},
            )
            raise DocumentReviewLambdaException(500, LambdaError.DocRefClient)

    def create_cloudfront_presigned_url(self, file_location: str) -> str:
        s3_bucket_name, file_key = file_location.removeprefix("s3://").split("/", 1)
        presign_url_response = self.s3_service.create_download_presigned_url(
            s3_bucket_name=s3_bucket_name,
            file_key=file_key,
        )

        presigned_id = "review/" + str(uuid.uuid4())

        deletion_date = datetime.now(timezone.utc)
        ttl_half_an_hour_in_seconds = self.s3_service.presigned_url_expiry
        dynamo_item_ttl = int(deletion_date.timestamp() + ttl_half_an_hour_in_seconds)

        self.document_review_service.dynamo_service.create_item(
            self.cloudfront_table_name,
            {
                "ID": f"{presigned_id}",
                "presignedUrl": presign_url_response,
                "TTL": dynamo_item_ttl,
            },
        )

        return format_cloudfront_url(presigned_id, self.cloudfront_url)
