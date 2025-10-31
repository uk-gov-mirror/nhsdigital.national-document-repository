from services.search_document_review_service import SearchDocumentReviewService
from utils.decorators.ensure_env_var import ensure_environment_variables
from utils.decorators.handle_lambda_exceptions import handle_lambda_exceptions
from utils.decorators.override_error_check import override_error_check
from utils.decorators.set_audit_arg import set_request_context_for_logging
from utils.exceptions import OdsErrorException
from utils.request_context import request_context



@ensure_environment_variables(
    names=[
        "DOCUMENT_REVIEW_DYNAMODB_NAME"
    ]
)
@override_error_check
@handle_lambda_exceptions
# @set_request_context_for_logging
def lambda_handler(event, context):

    osd_code = get_ods_code_from_request()
    limit = get_query_limit(event)

    service = SearchDocumentReviewService()

    service.get_review_document_references(ods_code=osd_code, limit=limit)



def get_ods_code_from_request():
    ods_code = request_context.authorization.get("selected_organisation", {}).get(
        "org_ods_code"
    )
    if not ods_code:
        raise OdsErrorException("No ODS code provided")

    return ods_code

def get_query_limit(event):
    return event.get("queryStringParameters", {}).get("limit", None)

