from unittest.mock import MagicMock

import pytest
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
from enums.document_review_status import DocumentReviewStatus
from enums.metadata_field_names import DocumentReferenceMetadataFields
from models.document_review import DocumentUploadReviewReference
from services.document_upload_review_service import DocumentUploadReviewService
from tests.unit.conftest import (
    MOCK_DOCUMENT_REVIEW_BUCKET,
    MOCK_DOCUMENT_REVIEW_TABLE,
    TEST_NHS_NUMBER,
    TEST_UUID,
)
from tests.unit.helpers.data.dynamo.dynamo_responses import MOCK_SEARCH_RESPONSE
from tests.unit.helpers.data.search_document_review.dynamo_response import (
    MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE,
)
from utils.exceptions import DocumentReviewException

TEST_ODS_CODE = "Y12345"
NEW_ODS_CODE = "Z98765"
TEST_QUERY_LIMIT = 50


@pytest.fixture
def mock_service(set_env, mocker):
    """Fixture to create a DocumentUploadReviewService with mocked dependencies."""
    mocker.patch("services.document_service.S3Service")
    mocker.patch("services.document_service.DynamoDBService")
    service = DocumentUploadReviewService()
    yield service


@pytest.fixture
def mock_document_review_references():
    """Create a list of mock document review references."""
    reviews = []
    for i in range(3):
        review = MagicMock(spec=DocumentUploadReviewReference)
        review.id = f"review-id-{i}"
        review.version = i
        review.nhs_number = TEST_NHS_NUMBER
        review.custodian = TEST_ODS_CODE
        reviews.append(review)
    return reviews


@pytest.fixture
def mock_review_update():
    """Fixture to create a mock review update object."""
    review_update = MagicMock(spec=DocumentUploadReviewReference)
    review_update.id = "test-review-id"
    review_update.version = 1
    review_update.nhs_number = TEST_NHS_NUMBER
    review_update.review_status = DocumentReviewStatus.APPROVED
    review_update.document_reference_id = "test-doc-ref-id"
    return review_update


def test_table_name(mock_service):
    """Test that table_name property returns correct environment variable."""

    assert mock_service.table_name == MOCK_DOCUMENT_REVIEW_TABLE


def test_model_class(mock_service):
    """Test that the model_class property returns DocumentUploadReviewReference."""
    assert mock_service.model_class == DocumentUploadReviewReference


def test_s3_bucket(mock_service, monkeypatch):
    """Test that s3_bucket property returns the correct environment variable."""

    assert mock_service.s3_bucket == MOCK_DOCUMENT_REVIEW_BUCKET


def test_update_document_review_custodian_updates_all_documents(
    mock_service, mock_document_review_references, mocker
):
    """Test that update_document_review_custodian updates all documents with different custodian."""
    mock_update_document = mocker.patch.object(mock_service, "update_document")

    mock_service.update_document_review_custodian(
        mock_document_review_references, NEW_ODS_CODE
    )

    # Verify that all documents were updated
    assert mock_update_document.call_count == 3

    # Verify each document's custodian was changed
    for review in mock_document_review_references:
        assert review.custodian == NEW_ODS_CODE

    # Verify update_document was called with the correct parameters
    for review in mock_document_review_references:
        mock_update_document.assert_any_call(
            document=review,
            update_fields_name={"custodian"},
            update_key={"ID": review.id, "Version": review.version},
        )


def test_update_document_review_custodian_empty_list(mock_service, mocker):
    """Test that update_document_review_custodian handles an empty list gracefully."""
    mock_update_document = mocker.patch.object(mock_service, "update_document")

    mock_service.update_document_review_custodian([], NEW_ODS_CODE)

    # Verify that update_document was not called
    mock_update_document.assert_not_called()


def test_update_document_review_custodian_no_changes_needed(
    mock_service, mock_document_review_references, mocker
):
    """Test that update_document_review_custodian skips documents that already have the correct custodian."""
    mock_update_document = mocker.patch.object(mock_service, "update_document")

    # Set all reviews to already have the target custodian
    for review in mock_document_review_references:
        review.custodian = NEW_ODS_CODE

    mock_service.update_document_review_custodian(
        mock_document_review_references, NEW_ODS_CODE
    )

    # Verify that update_document was not called since no changes needed
    mock_update_document.assert_not_called()


def test_update_document_review_custodian_mixed_custodians(
    mock_service, mock_document_review_references, mocker
):
    """Test that update_document_review_custodian only updates documents that need updating."""
    mock_update_document = mocker.patch.object(mock_service, "update_document")

    # Set the first review to already have the new custodian
    mock_document_review_references[0].custodian = NEW_ODS_CODE
    # Keep the other two with the old custodian

    mock_service.update_document_review_custodian(
        mock_document_review_references, NEW_ODS_CODE
    )

    assert mock_update_document.call_count == 2

    for review in mock_document_review_references:
        assert review.custodian == NEW_ODS_CODE


def test_update_document_review_custodian_logging(
    mock_service, mock_document_review_references, mocker
):
    """Test that update_document_review_custodian logs appropriately."""
    mocker.patch.object(mock_service, "update_document")
    mock_logger = mocker.patch("services.document_upload_review_service.logger")

    mock_service.update_document_review_custodian(
        mock_document_review_references, NEW_ODS_CODE
    )

    assert mock_logger.info.call_count == 3
    mock_logger.info.assert_any_call("Updating document review custodian...")


def test_update_document_review_custodian_single_document(mock_service, mocker):
    mock_update_document = mocker.patch.object(mock_service, "update_document")

    single_review = MagicMock(spec=DocumentUploadReviewReference)
    single_review.id = "single-review-id"
    single_review.version = 1
    single_review.custodian = TEST_ODS_CODE

    mock_service.update_document_review_custodian([single_review], NEW_ODS_CODE)

    assert single_review.custodian == NEW_ODS_CODE
    mock_update_document.assert_called_once_with(
        document=single_review,
        update_fields_name={"custodian"},
        update_key={"ID": single_review.id, "Version": single_review.version},
    )


def test_get_document_review_by_id(
    mock_service, mock_document_review_references, mocker
):
    mock_get_item = mocker.patch.object(mock_service, "get_item")
    mock_get_item.side_effect = mock_document_review_references

    mock_review = mock_service.get_document_review_by_id("review-id-0", 34)

    assert mock_review == mock_document_review_references[0]
    mock_get_item.assert_called_once_with("review-id-0", {"Version": 34})


def test_update_document_review_for_patient_success(
    mock_service, mock_review_update, mocker
):
    mock_update_document = mocker.patch.object(mock_service, "update_document")
    mock_update_document.return_value = {"Attributes": {"ID": "test-review-id"}}

    field_names = {"review_status", "document_reference_id"}

    result = mock_service.update_document_review_for_patient(
        review_update=mock_review_update,
        field_names=field_names,
        condition_expression="test condition expression",
    )

    mock_update_document.assert_called_once()
    call_args = mock_update_document.call_args

    assert call_args.kwargs["document"] == mock_review_update
    assert call_args.kwargs["update_fields_name"] == field_names

    condition_expr = call_args.kwargs["condition_expression"]
    assert condition_expr == "test condition expression"

    assert result == {"Attributes": {"ID": "test-review-id"}}


def test_update_document_review_for_patient_builds_correct_condition_expression(
    mock_service, mock_review_update, mocker
):
    mock_update_document = mocker.patch.object(mock_service, "update_document")

    field_names = {"review_status"}

    mock_service.update_pending_review_status(
        review_update=mock_review_update,
        field_names=field_names,
    )

    call_args = mock_update_document.call_args
    condition_expr = call_args.kwargs["condition_expression"]

    expected_condition = (
        Attr(DocumentReferenceMetadataFields.ID.value).exists()
        & Attr("NhsNumber").eq(mock_review_update.nhs_number)
        & Attr("ReviewStatus").eq(DocumentReviewStatus.PENDING_REVIEW)
    )

    assert condition_expr == expected_condition
    assert call_args.kwargs["update_fields_name"] == field_names
    assert call_args.kwargs["document"] == mock_review_update
    assert call_args.kwargs["update_key"] == {
        "ID": mock_review_update.id,
        "Version": mock_review_update.version,
    }


def test_update_document_review_for_patient_conditional_check_failed(
    mock_service, mock_review_update, mocker
):
    client_error = ClientError(
        {"Error": {"Code": "ConditionalCheckFailedException"}}, "UpdateItem"
    )
    mock_update_document = mocker.patch.object(mock_service, "update_document")
    mock_update_document.side_effect = client_error

    field_names = {"review_status"}

    with pytest.raises(DocumentReviewException):
        mock_service.update_approved_pending_review_status(
            review_update=mock_review_update,
            field_names=field_names,
        )

    call_args = mock_update_document.call_args
    condition_expr = call_args.kwargs["condition_expression"]

    expected_condition = (
        Attr(DocumentReferenceMetadataFields.ID.value).exists()
        & Attr("NhsNumber").eq(mock_review_update.nhs_number)
        & Attr("ReviewStatus").eq(DocumentReviewStatus.APPROVED_PENDING_DOCUMENTS)
    )

    assert condition_expr == expected_condition
    assert call_args.kwargs["update_fields_name"] == field_names
    assert call_args.kwargs["document"] == mock_review_update
    assert call_args.kwargs["update_key"] == {
        "ID": mock_review_update.id,
        "Version": mock_review_update.version,
    }


def test_update_document_review_for_patient_other_client_error(
    mock_service, mock_review_update, mocker
):
    client_error = ClientError(
        {"Error": {"Code": "ResourceNotFoundException", "Message": "Table not found"}},
        "UpdateItem",
    )
    mock_update_document = mocker.patch.object(mock_service, "update_document")
    mock_update_document.side_effect = client_error

    field_names = {"review_status"}

    with pytest.raises(DocumentReviewException):
        mock_service.update_approved_pending_review_status(
            review_update=mock_review_update,
            field_names=field_names,
        )


def test_update_document_review_with_transaction_builds_correct_items(
    mock_service, mock_review_update, mocker
):
    """Test that transaction items are built correctly for new and existing reviews."""
    mock_transact_write = mocker.patch.object(
        mock_service.dynamo_service, "transact_write_items"
    )
    mock_transact_item_builder = mocker.patch(
        "services.document_upload_review_service.build_transaction_item"
    )
    new_review = MagicMock(spec=DocumentUploadReviewReference)
    new_review.id = "new-review-id"
    new_review.version = 2

    existing_review = mock_review_update
    existing_review.custodian = TEST_ODS_CODE

    mock_service.update_document_review_with_transaction(new_review, existing_review)

    new_review.model_dump.assert_called_with(
        exclude_none=True, by_alias=True, exclude={"version", "id"}
    )

    existing_review.model_dump.assert_called_with(
        exclude_none=True,
        by_alias=True,
        include={"review_status", "review_date", "reviewer"},
    )

    mock_transact_write.assert_called_once()
    assert mock_transact_item_builder.call_count == 2
    call_args = mock_transact_write.call_args[0][0]
    assert len(call_args) == 2

    first_call = mock_transact_item_builder.call_args_list[0]
    assert first_call.kwargs["conditions"] == [
        {"field": "ID", "operator": "attribute_not_exists"}
    ]
    # Verify second call (existing review) has proper conditions
    second_call = mock_transact_item_builder.call_args_list[1]
    expected_conditions = [
        {
            "field": "ReviewStatus",
            "operator": "=",
            "value": DocumentReviewStatus.PENDING_REVIEW,
        },
        {"field": "NhsNumber", "operator": "=", "value": TEST_NHS_NUMBER},
        {"field": "Custodian", "operator": "=", "value": TEST_ODS_CODE},
    ]
    assert second_call.kwargs["conditions"] == expected_conditions


def test_delete_document_review_files_success(mock_service, mocker):
    mock_delete_object = mocker.patch.object(mock_service.s3_service, "delete_object")

    document_review = MagicMock(spec=DocumentUploadReviewReference)
    mock_file_1 = MagicMock()
    mock_file_1.file_name = "file1.pdf"
    mock_file_1.file_location = "s3://test-bucket/folder/file1.pdf"

    mock_file_2 = MagicMock()
    mock_file_2.file_name = "file2.pdf"
    mock_file_2.file_location = "s3://test-bucket/folder/file2.pdf"

    document_review.files = [mock_file_1, mock_file_2]

    mock_service.delete_document_review_files(document_review)

    assert mock_delete_object.call_count == 2
    mock_delete_object.assert_any_call("test-bucket", "folder/file1.pdf")
    mock_delete_object.assert_any_call("test-bucket", "folder/file2.pdf")


def test_delete_document_review_files_handles_s3_error(mock_service, mocker):
    mock_delete_object = mocker.patch.object(mock_service.s3_service, "delete_object")

    client_error = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "Object not found"}},
        "DeleteObject",
    )
    mock_delete_object.side_effect = [client_error, None]

    document_review = MagicMock(spec=DocumentUploadReviewReference)
    mock_file_1 = MagicMock()
    mock_file_1.file_name = "file1.pdf"
    mock_file_1.file_location = "s3://test-bucket/folder/file1.pdf"

    mock_file_2 = MagicMock()
    mock_file_2.file_name = "file2.pdf"
    mock_file_2.file_location = "s3://test-bucket/folder/file2.pdf"

    document_review.files = [mock_file_1, mock_file_2]

    mock_service.delete_document_review_files(document_review)

    assert mock_delete_object.call_count == 2


def test_update_document_review_with_transaction_transaction_cancelled(
    mock_service, mock_review_update, mocker
):
    """Test handling of TransactionCanceledException."""
    client_error = ClientError(
        {"Error": {"Code": "TransactionCanceledException"}}, "TransactWriteItems"
    )
    mock_transact_write = mocker.patch.object(
        mock_service.dynamo_service, "transact_write_items"
    )
    mock_transact_write.side_effect = client_error

    new_review = MagicMock(spec=DocumentUploadReviewReference)
    new_review.id = "new-review-id"
    new_review.version = 2

    existing_review = mock_review_update
    existing_review.custodian = TEST_ODS_CODE

    with pytest.raises(DocumentReviewException) as exc_info:
        mock_service.update_document_review_with_transaction(
            new_review, existing_review
        )

    assert "Failed to update document review" in str(exc_info.value)


def test_build_review_query_filter_creates_filter_from_nhs_number(mock_service):
    expected = Attr("ReviewStatus").eq("PENDING_REVIEW") & Attr("NhsNumber").eq(
        TEST_NHS_NUMBER
    )
    actual = mock_service.build_review_query_filter(nhs_number=TEST_NHS_NUMBER)

    assert actual == expected


def test_build_review_query_filter_creates_filter_from_uploader_ods_code(mock_service):
    expected = Attr("ReviewStatus").eq("PENDING_REVIEW") & Attr("Author").eq(
        TEST_ODS_CODE
    )
    actual = mock_service.build_review_query_filter(uploader=TEST_ODS_CODE)

    assert actual == expected


def test_build_filter_handles_both_nhs_number_and_uploader(mock_service):
    expected = (
        Attr("ReviewStatus").eq("PENDING_REVIEW")
        & Attr("NhsNumber").eq(TEST_NHS_NUMBER)
        & Attr("Author").eq(TEST_ODS_CODE)
    )
    actual = mock_service.build_review_query_filter(
        nhs_number=TEST_NHS_NUMBER, uploader=TEST_ODS_CODE
    )

    assert actual == expected


def test_query_review_documents_queries_dynamodb_with_filter_expression_nhs_number_passed(
    mock_service, mocker
):
    mock_nhs_number_filter_builder = mocker.patch.object(
        mock_service, "build_review_query_filter"
    )
    mock_nhs_number_filter_builder.return_value = Attr("NhsNumber").eq(TEST_NHS_NUMBER)

    mock_service.query_docs_pending_review_by_custodian_with_limit(
        ods_code=TEST_ODS_CODE, nhs_number=TEST_NHS_NUMBER
    )

    mock_nhs_number_filter_builder.assert_called_with(
        nhs_number=TEST_NHS_NUMBER, uploader=None
    )
    mock_service.dynamo_service.query_table_single.assert_called_with(
        table_name=MOCK_DOCUMENT_REVIEW_TABLE,
        search_key="Custodian",
        search_condition=TEST_ODS_CODE,
        index_name="CustodianIndex",
        limit=TEST_QUERY_LIMIT,
        start_key=None,
        query_filter=mock_nhs_number_filter_builder.return_value,
    )


def test_query_review_documents_queries_dynamodb_with_filter_expression_uploader_passed(
    mock_service, mocker
):
    mock_uploader_filter_builder = mocker.patch.object(
        mock_service, "build_review_query_filter"
    )
    mock_uploader_filter_builder.return_value = Attr("Author").eq(NEW_ODS_CODE)
    mock_service.query_docs_pending_review_by_custodian_with_limit(
        ods_code=TEST_ODS_CODE, uploader=NEW_ODS_CODE
    )
    mock_uploader_filter_builder.assert_called_with(
        nhs_number=None, uploader=NEW_ODS_CODE
    )
    mock_service.dynamo_service.query_table_single.assert_called_with(
        table_name=MOCK_DOCUMENT_REVIEW_TABLE,
        search_key="Custodian",
        search_condition=TEST_ODS_CODE,
        index_name="CustodianIndex",
        limit=TEST_QUERY_LIMIT,
        start_key=None,
        query_filter=mock_uploader_filter_builder.return_value,
    )


def test_query_review_documents_by_custodian_handles_filtering_by_nhs_number_and_uploader(
    mock_service, mocker
):
    mock_uploader_filter_builder = mocker.patch.object(
        mock_service, "build_review_query_filter"
    )
    mock_uploader_filter_builder.return_value = Attr("Author").eq(NEW_ODS_CODE) & Attr(
        "NhsNumber"
    ).eq(TEST_NHS_NUMBER)
    mock_service.query_docs_pending_review_by_custodian_with_limit(
        ods_code=TEST_ODS_CODE, uploader=NEW_ODS_CODE, nhs_number=TEST_NHS_NUMBER
    )
    mock_uploader_filter_builder.assert_called_with(
        nhs_number=TEST_NHS_NUMBER, uploader=NEW_ODS_CODE
    )
    mock_service.dynamo_service.query_table_single.assert_called_with(
        table_name=MOCK_DOCUMENT_REVIEW_TABLE,
        search_key="Custodian",
        search_condition=TEST_ODS_CODE,
        index_name="CustodianIndex",
        limit=TEST_QUERY_LIMIT,
        start_key=None,
        query_filter=mock_uploader_filter_builder.return_value,
    )


def test_get_document_returns_review_document(mock_service):
    mock_service.dynamo_service.get_item.return_value = {
        "Item": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0]
    }
    expected = DocumentUploadReviewReference.model_validate(
        MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"][0]
    )

    actual = mock_service.get_document(TEST_UUID, 1)
    mock_service.dynamo_service.get_item.assert_called_with(
        table_name=MOCK_DOCUMENT_REVIEW_TABLE,
        key={"ID": TEST_UUID, "Version": 1},
    )

    assert actual == expected


def test_get_document_returns_none_no_documents_found(mock_service):
    mock_service.dynamo_service.get_item.return_value = {}

    expected = None
    actual = mock_service.get_document(TEST_UUID, 1)

    assert actual == expected



def test_get_document_by_id_raises_exception_client_error(mock_service):
    mock_service.dynamo_service.get_item.side_effect = ClientError(
        {"Error": {"Code": "500", "Message": "mocked error"}}, "get_item"
    )

    with pytest.raises(DocumentReviewException):
        mock_service.get_document(TEST_UUID, 1)