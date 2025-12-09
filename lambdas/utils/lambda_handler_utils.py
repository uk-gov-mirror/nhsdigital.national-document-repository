from enums.lambda_error import LambdaError
from enums.mtls import MtlsCommonNames

from utils.audit_logging_setup import LoggingService
from utils.lambda_header_utils import validate_common_name_in_mtls
from utils.lambda_exceptions import (
    GetFhirDocumentReferenceException,
    DocumentRefSearchException,
    DocumentRefException, DocumentReviewException,
)

logger = LoggingService(__name__)


def extract_bearer_token(event, context):
    """Extract and validate bearer token from event"""
    if (
        validate_common_name_in_mtls(event.get("requestContext", {}))
        != MtlsCommonNames.PDM
    ):
        bearer_token = event.get("headers", {}).get("Authorization", None)
        if not bearer_token or not bearer_token.startswith("Bearer "):
            logger.warning("No bearer token found in request")
            if "GetDocumentReference" in context.function_name:
                raise GetFhirDocumentReferenceException(
                    401, LambdaError.DocumentReferenceUnauthorised
                )
            elif "SearchDocumentReferencesFHIR" in context.function_name:
                raise DocumentRefSearchException(
                    401, LambdaError.DocumentReferenceUnauthorised
                )
            else:
                raise DocumentRefException(
                    401, LambdaError.DocumentReferenceUnauthorised
                )

        return bearer_token
    return None


def validate_review_path_parameters(event):
    path_parameters = event.get("pathParameters", {})
    document_id = path_parameters.get("id")
    document_version = path_parameters.get("version")
    if not document_id or not document_version:
        raise DocumentReviewException(
            400, LambdaError.DocumentReferenceMissingParameters
        )
    try:
        document_version = int(document_version)
    except ValueError:
        logger.error(f"Invalid document version: {document_version}")
        raise DocumentReviewException(
            400, LambdaError.DocumentReferenceMissingParameters
        )
    return document_id, document_version