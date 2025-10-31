from services.search_document_review_service import SearchDocumentReviewService
from utils.exceptions import OdsErrorException
from utils.request_context import request_context


def get_ods_code_from_request():
    ods_code = request_context.authorization.get("selected_organisation", {}).get(
        "org_ods_code"
    )
    if not ods_code:
        raise OdsErrorException("No ODS code provided")

    return ods_code

def lambda_handler(event, context):

    service = SearchDocumentReviewService()
    pass