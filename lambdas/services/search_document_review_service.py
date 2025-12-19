import base64
import decimal
import json

from enums.lambda_error import LambdaError
from pydantic import ValidationError
from services.document_upload_review_service import DocumentUploadReviewService
from utils.audit_logging_setup import LoggingService
from utils.lambda_exceptions import DocumentReviewLambdaException

logger = LoggingService(__name__)


class SearchDocumentReviewService:

    def __init__(self):
        self.document_service = DocumentUploadReviewService()

    def process_request(
        self, ods_code: str, params: dict
    ) -> tuple[list[str], str | None]:
        try:

            decoded_start_key = self.decode_start_key(params.get("nextPageToken", None))

            str_limit = params.get("limit", self.document_service.DEFAULT_QUERY_LIMIT)
            limit = int(str_limit)

            references, last_evaluated_key = self.get_review_document_references(
                start_key=decoded_start_key,
                ods_code=ods_code,
                limit=limit,
                nhs_number=params.get("nhsNumber", None),
                uploader=params.get("uploader", None),
            )
            output_refs = [
                reference.model_dump_camel_case(
                    exclude_none=True,
                    include={
                        "id",
                        "version",
                        "nhs_number",
                        "review_reason",
                        "document_snomed_code_type",
                        "author",
                        "upload_date",
                    },
                    mode="json",
                )
                for reference in references
            ]

            encoded_exclusive_start_key = self.encode_start_key(last_evaluated_key)

            return output_refs, encoded_exclusive_start_key

        except ValidationError as e:
            logger.error(e)
            raise DocumentReviewLambdaException(
                500, LambdaError.DocumentReviewValidation
            )
        except ValueError as e:
            logger.error(e)
            raise DocumentReviewLambdaException(
                400, LambdaError.SearchDocumentInvalidQuerystring
            )

    def get_review_document_references(
        self,
        ods_code: str,
        limit: int | None = None,
        start_key: dict | None = None,
        nhs_number: str | None = None,
        uploader: str | None = None,
    ):
        return self.document_service.query_docs_pending_review_by_custodian_with_limit(
            ods_code=ods_code,
            limit=limit,
            start_key=start_key,
            nhs_number=nhs_number,
            uploader=uploader,
        )

    def decode_start_key(self, encoded_start_key: str | None) -> dict[str, str] | None:
        return (
            json.loads(
                base64.b64decode(encoded_start_key.encode("ascii")).decode("utf-8")
            )
            if encoded_start_key
            else None
        )

    def encode_start_key(self, start_key: dict) -> str | None:
        if start_key:
            for key, value in start_key.items():
                if isinstance(value, decimal.Decimal):
                    start_key[key] = int(value)
            return base64.b64encode(json.dumps(start_key).encode("ascii")).decode(
                "utf-8"
            )
        return None
