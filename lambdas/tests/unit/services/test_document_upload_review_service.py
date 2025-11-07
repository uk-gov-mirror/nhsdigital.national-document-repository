from unittest.mock import MagicMock

import pytest
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
from enums.document_review_status import DocumentReviewStatus
from enums.metadata_field_names import DocumentReferenceMetadataFields
from models.document_review import DocumentUploadReviewReference
from pydantic import BaseModel
from services.document_upload_review_service import DocumentUploadReviewService
from tests.unit.conftest import (
    MOCK_DOCUMENT_REVIEW_BUCKET,
    MOCK_DOCUMENT_REVIEW_TABLE,
    TEST_NHS_NUMBER,
)
from utils.exceptions import DocumentServiceException, DynamoServiceException

TEST_ODS_CODE = "Y12345"
NEW_ODS_CODE = "Z98765"


@pytest.fixture
def mock_service(set_env, mocker):
    """Fixture to create a DocumentUploadReviewService with mocked dependencies."""

    mocker.patch(
        "services.document_upload_review_service.DocumentService.__init__",
        return_value=None,
    )
    service = DocumentUploadReviewService()
    service.s3_service = MagicMock()
    service.dynamo_service = MagicMock()
    yield service


@pytest.fixture
def mock_document_review_references():
    """Create a list of mock document review references."""
    reviews = []
    for i in range(3):
        review = MagicMock(spec=DocumentUploadReviewReference)
        review.id = f"review-id-{i}"
        review.nhs_number = TEST_NHS_NUMBER
        review.custodian = TEST_ODS_CODE
        reviews.append(review)
    return reviews


@pytest.fixture
def mock_review_update():
    """Fixture to create a mock review update object."""
    review_update = MagicMock(spec=BaseModel)
    review_update.id = "test-review-id"
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
            document=review, update_fields_name={"custodian"}
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

    # Verify that update_document was only called twice (for the 2 documents that needed updating)
    assert mock_update_document.call_count == 2

    # Verify all documents now have the new custodian
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

    # Verify logging was called for each document
    assert mock_logger.info.call_count == 3
    mock_logger.info.assert_any_call("Updating document review custodian...")


def test_update_document_review_custodian_single_document(mock_service, mocker):
    """Test update_document_review_custodian with a single document."""
    mock_update_document = mocker.patch.object(mock_service, "update_document")

    single_review = MagicMock(spec=DocumentUploadReviewReference)
    single_review.id = "single-review-id"
    single_review.custodian = TEST_ODS_CODE

    mock_service.update_document_review_custodian([single_review], NEW_ODS_CODE)

    assert single_review.custodian == NEW_ODS_CODE
    mock_update_document.assert_called_once_with(
        document=single_review, update_fields_name={"custodian"}
    )


def test_update_document_review_for_patient_success(
    mock_service, mock_review_update, mocker
):
    """Test successful update of document review for patient."""
    mock_update_document = mocker.patch.object(mock_service, "update_document")
    mock_update_document.return_value = {"Attributes": {"ID": "test-review-id"}}

    field_names = {"review_status", "document_reference_id"}

    result = mock_service.update_document_review_for_patient(
        review_update=mock_review_update,
        field_names=field_names,
    )

    mock_update_document.assert_called_once()
    call_args = mock_update_document.call_args

    assert call_args.kwargs["document"] == mock_review_update
    assert call_args.kwargs["update_fields_name"] == field_names

    condition_expr = call_args.kwargs["condition_expression"]
    assert condition_expr is not None

    assert result == {"Attributes": {"ID": "test-review-id"}}


def test_update_document_review_for_patient_builds_correct_condition_expression(
    mock_service, mock_review_update, mocker
):
    """Test that the condition expression is built correctly."""

    mock_update_document = mocker.patch.object(mock_service, "update_document")

    field_names = {"review_status"}

    mock_service.update_document_review_for_patient(
        review_update=mock_review_update,
        field_names=field_names,
    )

    call_args = mock_update_document.call_args
    condition_expr = call_args.kwargs["condition_expression"]

    assert condition_expr is not None

    expected_condition = (
        Attr(DocumentReferenceMetadataFields.ID.value).exists()
        & Attr("NhsNumber").eq(mock_review_update.nhs_number)
        & Attr("ReviewStatus").eq(DocumentReviewStatus.PENDING_REVIEW)
    )

    assert condition_expr == expected_condition


def test_update_document_review_for_patient_conditional_check_failed(
    mock_service, mock_review_update, mocker
):
    """Test handling of ConditionalCheckFailedException when document doesn't exist or NHS number doesn't match."""
    client_error = ClientError(
        {"Error": {"Code": "ConditionalCheckFailedException"}}, "UpdateItem"
    )
    mock_update_document = mocker.patch.object(mock_service, "update_document")
    mock_update_document.side_effect = client_error

    field_names = {"review_status"}

    with pytest.raises(DocumentServiceException):
        mock_service.update_document_review_for_patient(
            review_update=mock_review_update,
            field_names=field_names,
        )


def test_update_document_review_for_patient_other_client_error(
    mock_service, mock_review_update, mocker
):
    """Test handling of other ClientError exceptions."""
    client_error = ClientError(
        {"Error": {"Code": "ResourceNotFoundException", "Message": "Table not found"}},
        "UpdateItem",
    )
    mock_update_document = mocker.patch.object(mock_service, "update_document")
    mock_update_document.side_effect = client_error

    field_names = {"review_status"}

    with pytest.raises(DynamoServiceException):
        mock_service.update_document_review_for_patient(
            review_update=mock_review_update,
            field_names=field_names,
        )


def test_update_document_review_for_patient_with_multiple_fields(
    mock_service, mock_review_update, mocker
):
    """Test update with multiple field names."""
    mock_update_document = mocker.patch.object(mock_service, "update_document")
    mock_update_document.return_value = {"Attributes": {"ID": "test-review-id"}}

    field_names = {"review_status", "document_reference_id", "review_date", "reviewer"}

    result = mock_service.update_document_review_for_patient(
        review_update=mock_review_update,
        field_names=field_names,
    )

    call_args = mock_update_document.call_args
    assert call_args.kwargs["update_fields_name"] == field_names
    assert result is not None
