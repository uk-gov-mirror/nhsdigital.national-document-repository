import os

from botocore.exceptions import ClientError
from pydantic import ValidationError

from models.document_review import DocumentUploadReviewReference
from services.base.dynamo_service import DynamoDBService
from utils.audit_logging_setup import LoggingService
from utils.exceptions import SearchDocumentReviewReferenceException

logger = LoggingService(__name__)

class SearchDocumentReviewService:

    def __init__(self):
        self.dynamo_service = DynamoDBService()

    def get_review_document_references(self, ods_code, limit):
        logger.info(f"Getting review document references for {ods_code}")

        try:
            response = self.dynamo_service.query_table(
                table_name=os.environ["DOCUMENT_REVIEW_DYNAMODB_NAME"],
                search_key="Custodian",
                search_condition=ods_code,
                index_name="CustodianIndex",
                limit=limit,
            )

            references = self.validate_search_response_items(response["Items"])
            last_evaluated_key = response.get("LastEvaluatedKey", None)

            return references, last_evaluated_key

        except ClientError as e:
            logger.error(e)
            raise SearchDocumentReviewReferenceException()

    def validate_search_response_items(self, items):
        try:
            review_references = [DocumentUploadReviewReference.model_validate(item) for item in items]
            return review_references
        except ValidationError as e:
            logger.error(e)
            raise SearchDocumentReviewReferenceException()