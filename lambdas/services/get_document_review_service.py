import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from enums.lambda_error import LambdaError
from services.base.s3_service import S3Service
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import DynamoServiceException
from utils.lambda_exceptions import GetDocumentReviewException
from utils.utilities import format_cloudfront_url

logger = LoggingService(__name__)


class GetDocumentReviewService:
    """
    Service for retrieving document reviews.
    """

    def __init__(self):
        presigned_assume_role = os.getenv("PRESIGNED_ASSUME_ROLE")
        self.s3_service = S3Service(custom_aws_role=presigned_assume_role)
        self.document_review_service = DocumentUploadReviewService()
        self.cloudfront_table_name = os.environ.get("EDGE_REFERENCE_TABLE")
        self.cloudfront_url = os.environ.get("CLOUDFRONT_URL")

    def get_document_review(
        self, patient_id: str, document_id: str
    ) -> Optional[dict]:
        """
        Retrieve a document review for a given patient and document.

        :param patient_id: The patient ID (NHS number).
        :param document_id: The document ID to retrieve.
        :return: Dictionary containing the document review details, or None if not found.
        """
        try:
            logger.info(
                f"Fetching document review for patient_id: {patient_id}, document_id: {document_id}"
            )

            # Query DynamoDB directly by document ID using the service method
            document_review_item = self.document_review_service.get_item(document_id)

            # Check if item exists
            if not document_review_item:
                logger.info(
                    f"No document review found for document_id: {document_id}"
                )
                return None

            # Filter by NHS number to ensure the patient owns this document
            if document_review_item.nhs_number != patient_id:
                logger.warning(
                    f"Document {document_id} does not belong to patient {patient_id}"
                )
                return None

            # Generate pre-signed URLs for each file in the review
            if document_review_item.files:
                for file_detail in document_review_item.files:
                    presigned_url = self.create_cloudfront_presigned_url(
                        file_detail.file_location
                    )
                    file_detail.presigned_url = presigned_url

            # Use Pydantic's model_dump to serialize with only required fields
            document_review = document_review_item.model_dump(
                by_alias=True,
                include={
                    "id": True,
                    "upload_date": True,
                    "files": {"__all__": {"file_name": True, "presigned_url": True}},
                    "document_snomed_code_type": True,
                },
            )

            logger.info(
                f"Successfully retrieved document review for document_id: {document_id}"
            )

            return document_review

        except DynamoServiceException as e:
            logger.error(
                f"{LambdaError.DocRefClient.to_str()}: {str(e)}",
                {"Result": "Failed to retrieve document review"},
            )
            raise GetDocumentReviewException(500, LambdaError.DocRefClient)
        except Exception as e:
            logger.error(
                f"Unexpected error retrieving document review: {str(e)}",
                {"Result": "Failed to retrieve document review"},
            )
            raise GetDocumentReviewException(500, LambdaError.DocRefClient)

    def create_cloudfront_presigned_url(self, file_location: str) -> str:
        """
        Create a CloudFront obfuscated pre-signed URL for a file.

        :param file_location: The S3 file key/location.
        :return: CloudFront URL that obfuscates the actual pre-signed URL.
        """
        # Generate S3 pre-signed URL
        s3_bucket_name, file_key = file_location.removeprefix("s3://").split("/", 1)
        presign_url_response = self.s3_service.create_download_presigned_url(
            s3_bucket_name=s3_bucket_name,
            file_key=file_key,
        )

        # Create unique ID for CloudFront mapping
        presigned_id = 'review/' + str(uuid.uuid4())

        # Calculate TTL (same expiry as the pre-signed URL)
        deletion_date = datetime.now(timezone.utc)
        ttl_half_an_hour_in_seconds = self.s3_service.presigned_url_expiry
        dynamo_item_ttl = int(deletion_date.timestamp() + ttl_half_an_hour_in_seconds)

        # Store mapping in DynamoDB for CloudFront edge function to resolve
        self.document_review_service.dynamo_service.create_item(
            self.cloudfront_table_name,
            {
                "ID": f'{presigned_id}',
                "presignedUrl": presign_url_response,
                "TTL": dynamo_item_ttl,
            },
        )

        # Return obfuscated CloudFront URL
        return format_cloudfront_url(presigned_id, self.cloudfront_url)

