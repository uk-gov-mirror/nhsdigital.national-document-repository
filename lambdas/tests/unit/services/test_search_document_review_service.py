import pytest

from services.search_document_review_service import SearchDocumentReviewService
from tests.unit.conftest import MOCK_DOCUMENT_REVIEW_TABLE, TEST_CURRENT_GP_ODS


@pytest.fixture
def search_document_review_service(mocker, set_env):
    service = SearchDocumentReviewService()
    mocker.patch.object(service, 'dynamo_service')
    yield service


def test_service_queries_document_review_table_with_correct_args(search_document_review_service):

    search_document_review_service.get_review_document_references(TEST_CURRENT_GP_ODS, 4)

    search_document_review_service.dynamo_service.query_table.assert_called_with(
        table_name=MOCK_DOCUMENT_REVIEW_TABLE,
        search_key='Custodian',
        search_condition=TEST_CURRENT_GP_ODS,
        index_name="CustodianIndex",
        limit=4
    )