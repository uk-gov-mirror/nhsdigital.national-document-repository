import pytest

from services.search_document_review_service import SearchDocumentReviewService


@pytest.fixture
def search_document_review_service(mocker, set_env):
    service = SearchDocumentReviewService()
    mocker.patch.object(service, 'dynamo_service')
    yield service


def test_service_queries_document_review_table_with_ods_code(search_document_review_service):

    pass