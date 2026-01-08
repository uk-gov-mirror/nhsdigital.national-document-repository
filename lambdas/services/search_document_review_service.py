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
            start_key = params.get("nextPageToken", None)

            str_limit = params.get("limit", self.document_service.DEFAULT_QUERY_LIMIT)
            limit = int(str_limit)

            references, last_evaluated_key = self.get_review_document_references(
                start_key=start_key,
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

            return output_refs, last_evaluated_key

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
        start_key: str | None = None,
        nhs_number: str | None = None,
        uploader: str | None = None,
    ):
        return self.document_service.query_docs_pending_review_with_paginator(
            ods_code=ods_code,
            limit=limit,
            start_key=start_key,
            nhs_number=nhs_number,
            uploader=uploader,
        )
