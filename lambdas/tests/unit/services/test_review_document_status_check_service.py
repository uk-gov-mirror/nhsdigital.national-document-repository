import pytest
from models.document_review import DocumentUploadReviewReference
from services.review_document_status_check_service import (
    ReviewDocumentStatusCheckService,
)
from tests.unit.conftest import TEST_CURRENT_GP_ODS, TEST_UUID
from tests.unit.helpers.data.search_document_review.dynamo_response import (
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE,
    MOCK_PREVIOUS_ODS_CODE,
)
from utils.lambda_exceptions import DocumentReviewLambdaException

MOCK_DOCUMENT_REVIEW_REFERENCE = DocumentUploadReviewReference.model_validate(
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0]
)


@pytest.fixture
def mock_service(mocker):
    service = ReviewDocumentStatusCheckService()
    mocker.patch.object(service, "review_document_service")
    yield service


@pytest.fixture
def mock_service_user_is_author(mock_service, mocker):
    service = mock_service
    mocker.patch.object(service, "user_is_author").return_value = True
    yield service


def test_get_document_status_uses_doc_upload_review_service_to_query_dynamo(
    mock_service_user_is_author,
):
    mock_service_user_is_author.get_document_review_status(
        TEST_CURRENT_GP_ODS, TEST_UUID, 1
    )
    mock_service_user_is_author.review_document_service.get_document.assert_called_with(
        document_id=TEST_UUID, version=1
    )


def test_get_document_status_calls_user_is_author_with_correct_args(
    mock_service, mocker
):
    mocker.patch.object(mock_service, "user_is_author")
    mock_service.review_document_service.get_document.return_value = (
        MOCK_DOCUMENT_REVIEW_REFERENCE
    )
    mock_service.get_document_review_status(MOCK_PREVIOUS_ODS_CODE, TEST_UUID, 1)

    mock_service.user_is_author.assert_called_with(
        MOCK_PREVIOUS_ODS_CODE, MOCK_DOCUMENT_REVIEW_REFERENCE
    )


def test_get_document_status_throws_error_if_user_is_not_author(mock_service):
    mock_service.review_document_service.get_document.return_value = (
        MOCK_DOCUMENT_REVIEW_REFERENCE
    )

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.get_document_review_status(TEST_CURRENT_GP_ODS, TEST_UUID, 1)
    assert e.value.status_code == 403
    assert e.value.err_code == "UDR_4031"


def test_get_document_review_status_returns_document_review_status(
    mock_service_user_is_author,
):
    mock_service_user_is_author.review_document_service.get_document.return_value = (
        MOCK_DOCUMENT_REVIEW_REFERENCE
    )

    expected = {
        "id": MOCK_DOCUMENT_REVIEW_REFERENCE.id,
        "version": MOCK_DOCUMENT_REVIEW_REFERENCE.version,
        "reviewStatus": MOCK_DOCUMENT_REVIEW_REFERENCE.review_status,
    }
    assert (
        mock_service_user_is_author.get_document_review_status(
            MOCK_PREVIOUS_ODS_CODE, TEST_UUID, 1
        )
        == expected
    )


def test_user_is_author(mock_service):
    assert mock_service.user_is_author(
        MOCK_PREVIOUS_ODS_CODE, MOCK_DOCUMENT_REVIEW_REFERENCE
    )
    assert not (
        mock_service.user_is_author(TEST_CURRENT_GP_ODS, MOCK_DOCUMENT_REVIEW_REFERENCE)
    )


def test_get_document_review_status_throws_404_no_document_reference_found(
    mock_service_user_is_author,
):
    mock_service_user_is_author.review_document_service.get_document.return_value = None

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service_user_is_author.get_document_review_status(
            MOCK_PREVIOUS_ODS_CODE, TEST_UUID, 1
        )

    assert e.value.status_code == 404
    assert e.value.err_code == "DRV_4041"
