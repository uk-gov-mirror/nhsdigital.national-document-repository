import base64
import json

from enums.lambda_error import LambdaError
from pydantic import ValidationError
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.lambda_exceptions import DocumentReviewException

logger = LoggingService(__name__)


class SearchDocumentReviewService:

    def __init__(self):
        self.document_service = DocumentUploadReviewService()

    def process_request(
        self, ods_code: str, encoded_start_key: str | None, limit: int | None
    ) -> tuple[list[str], str | None]:
        try:

            decoded_start_key = self.decode_start_key(encoded_start_key)

            references, last_evaluated_key = self.get_review_document_references(
                start_key=decoded_start_key, ods_code=ods_code, limit=limit
            )
            output_refs = [
                reference.model_dump_json(
                    exclude_none=True,
                    include={"id", "nhs_number", "review_reason"},
                )
                for reference in references
            ]

            encoded_exclusive_start_key = self.encode_start_key(last_evaluated_key)

            return output_refs, encoded_exclusive_start_key

        except ValidationError as e:
            logger.error(e)
            raise DocumentReviewException(
                500, LambdaError.DocumentReviewValidation
            )

    def get_review_document_references(
        self, ods_code: str, limit: int | None = None, start_key: dict | None = None
    ):
        return self.document_service.query_review_documents_by_custodian(
            ods_code=ods_code, limit=limit, start_key=start_key
        )

    def decode_start_key(self, encoded_start_key: str | None) -> dict:
        return (
            json.loads(
                base64.b64decode(encoded_start_key.encode("ascii")).decode("utf-8")
            )
            if encoded_start_key
            else None
        )

    def encode_start_key(self, start_key: dict) -> str:
        return (
            base64.b64encode(json.dumps(start_key).encode("ascii")).decode("utf-8")
            if start_key
            else None
        )
