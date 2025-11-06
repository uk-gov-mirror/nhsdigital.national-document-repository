import base64
import os

from botocore.exceptions import ClientError
from enums.lambda_error import LambdaError
from models.document_review import DocumentUploadReviewReference
from pydantic import ValidationError
from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService
from utils.lambda_exceptions import SearchDocumentReviewReferenceException

logger = LoggingService(__name__)


class SearchDocumentReviewService:

    def __init__(self):
        self.dynamo_service = DynamoDBService()

    def process_request(
        self, ods_code: str, encoded_start_key: str | None, limit: int | None
    ) -> (list[dict], str | None):
        try:

            decoded_start_key = self.decode_start_key(encoded_start_key)

            references, last_evaluated_key = self.get_review_document_references(
                start_key=decoded_start_key, ods_code=ods_code, limit=limit
            )
            output_refs = [
                reference.model_dump(
                    exclude_none=True,
                    include={"id", "nhs_number", "review_reason"},
                    mode="json",
                )
                for reference in references
            ]

            encoded_exclusive_start_key = self.encode_start_key(last_evaluated_key)

            return output_refs, encoded_exclusive_start_key

        except ValidationError as e:
            logger.error(e)
            raise SearchDocumentReviewReferenceException(
                500, LambdaError.SearchDocumentReviewValidation
            )

        except Exception as e:
            logger.error(e)
            raise e

    def get_review_document_references(
        self, ods_code: str, limit: int | None = None, start_key: str | None = None
    ) -> tuple[list[DocumentUploadReviewReference], str | None]:
        logger.info(f"Getting review document references for {ods_code}")

        try:
            response = self.dynamo_service.query_table(
                table_name=os.environ["DOCUMENT_REVIEW_DYNAMODB_NAME"],
                search_key="Custodian",
                search_condition=ods_code,
                index_name="CustodianIndex",
                limit=limit,
                start_key=start_key,
            )

            references = (
                self.validate_search_response_items(response["Items"])
                if limit
                else self.validate_search_response_items(response)
            )
            last_evaluated_key = (
                response.get("LastEvaluatedKey", None) if limit else None
            )

            return references, last_evaluated_key

        except ClientError as e:
            logger.error(e)
            raise SearchDocumentReviewReferenceException(
                500, LambdaError.SearchDocumentReviewDB
            )

    def validate_search_response_items(
        self, items: list[dict]
    ) -> list[DocumentUploadReviewReference]:
        try:
            logger.info("Validating document review search response")
            review_references = [
                DocumentUploadReviewReference.model_validate(item) for item in items
            ]
            return review_references
        except ValidationError as e:
            logger.error(e)
            raise SearchDocumentReviewReferenceException(
                500, LambdaError.SearchDocumentReviewValidation
            )

    def decode_start_key(self, encoded_start_key: str | None) -> str:
        return (
            base64.b64decode(encoded_start_key.encode("ascii")).decode("utf-8")
            if encoded_start_key
            else None
        )

    def encode_start_key(self, start_key: str) -> str:
        return (
            base64.b64encode(start_key.encode("ascii")).decode("utf-8")
            if start_key
            else None
        )
