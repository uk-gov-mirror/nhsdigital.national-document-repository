from unittest.mock import MagicMock

import pytest
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
from enums.document_review_status import DocumentReviewStatus
from enums.metadata_field_names import DocumentReferenceMetadataFields
from freezegun import freeze_time
from models.document_review import (
    DocumentUploadReviewReference,
)
from services.document_upload_review_service import DocumentUploadReviewService
from tests.unit.conftest import (
    MOCK_DOCUMENT_REVIEW_BUCKET,
    MOCK_DOCUMENT_REVIEW_TABLE,
    TEST_NHS_NUMBER,
    TEST_UUID,
)
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
        review.review_status = "APPROVED"
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
    review_update.reviewer = TEST_ODS_CODE
    return review_update


def test_table_name(mock_service):
    assert mock_service.table_name == MOCK_DOCUMENT_REVIEW_TABLE


def test_model_class(mock_service):
    assert mock_service.model_class == DocumentUploadReviewReference


def test_s3_bucket(mock_service, monkeypatch):
    assert mock_service.s3_bucket == MOCK_DOCUMENT_REVIEW_BUCKET


def test_update_document_review_custodian_updates_all_documents(
    mock_service, mock_document_review_references, mocker
):
    mock_handle_standard = mocker.patch.object(
        mock_service, "_handle_standard_custodian_update"
    )

    mock_service.update_document_review_custodian(
        mock_document_review_references, NEW_ODS_CODE
    )

    assert mock_handle_standard.call_count == 3

    for review in mock_document_review_references:
        mock_handle_standard.assert_any_call(review, NEW_ODS_CODE, {"custodian"})


def test_update_document_review_custodian_empty_list(mock_service, mocker):
    mock_handle_standard = mocker.patch.object(
        mock_service, "_handle_standard_custodian_update"
    )
    mock_handle_pending = mocker.patch.object(
        mock_service, "_handle_pending_review_custodian_update"
    )

    mock_service.update_document_review_custodian([], NEW_ODS_CODE)

    mock_handle_standard.assert_not_called()
    mock_handle_pending.assert_not_called()


def test_update_document_review_custodian_no_changes_needed(
    mock_service, mock_document_review_references, mocker
):
    mock_handle_standard = mocker.patch.object(
        mock_service, "_handle_standard_custodian_update"
    )
    mock_handle_pending = mocker.patch.object(
        mock_service, "_handle_pending_review_custodian_update"
    )

    for review in mock_document_review_references:
        review.custodian = NEW_ODS_CODE

    mock_service.update_document_review_custodian(
        mock_document_review_references, NEW_ODS_CODE
    )

    mock_handle_standard.assert_not_called()
    mock_handle_pending.assert_not_called()


def test_update_document_review_custodian_mixed_custodians(
    mock_service, mock_document_review_references, mocker
):
    mock_handle_standard = mocker.patch.object(
        mock_service, "_handle_standard_custodian_update"
    )
    mock_document_review_references[0].custodian = NEW_ODS_CODE

    mock_service.update_document_review_custodian(
        mock_document_review_references, NEW_ODS_CODE
    )
    assert mock_handle_standard.call_count == 2


def test_update_document_review_custodian_continues_on_error(
    mock_service, mock_document_review_references, mocker
):
    mock_handle_standard = mocker.patch.object(
        mock_service, "_handle_standard_custodian_update"
    )

    mock_handle_standard.side_effect = [
        DocumentReviewException("Test error"),
        ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException"}}, "UpdateItem"
        ),
        None,
    ]

    mock_service.update_document_review_custodian(
        mock_document_review_references, NEW_ODS_CODE
    )
    assert mock_handle_standard.call_count == 3


def test_handle_standard_custodian_update_updates_document(mock_service, mocker):
    mock_update_document = mocker.patch.object(mock_service, "update_document")

    review = DocumentUploadReviewReference.model_construct()
    review.id = "test-id"
    review.version = 1
    review.custodian = TEST_ODS_CODE

    update_fields = {"custodian"}

    mock_service._handle_standard_custodian_update(review, NEW_ODS_CODE, update_fields)

    assert review.custodian == NEW_ODS_CODE

    mock_update_document.assert_called_once_with(
        document=review,
        key_pair={"ID": review.id, "Version": review.version},
        update_fields_name=update_fields,
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
    assert call_args.kwargs["key_pair"] == {
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
    assert call_args.kwargs["key_pair"] == {
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
        mock_service.update_pending_review_status(
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
    mock_service.s3_service.S3_PREFIX = "s3://"
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
    mock_service.s3_service.S3_PREFIX = "string"
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

    with pytest.raises(DocumentReviewException):
        mock_service.update_document_review_with_transaction(
            new_review, existing_review
        )


def test_handle_standard_custodian_update_with_client_error(mock_service, mocker):
    mock_update_document = mocker.patch.object(mock_service, "update_document")
    mock_update_document.side_effect = ClientError(
        {"Error": {"Code": "ConditionalCheckFailedException"}}, "UpdateItem"
    )

    review = DocumentUploadReviewReference.model_construct()
    review.id = "test-id"
    review.version = 1
    review.custodian = TEST_ODS_CODE

    with pytest.raises(ClientError):
        mock_service._handle_standard_custodian_update(
            review, NEW_ODS_CODE, {"custodian"}
        )


@freeze_time("2024-01-15 10:30:00")
def test_handle_pending_review_custodian_update_creates_new_version(
    mock_service, mocker
):
    mock_transaction_update = mocker.patch.object(
        mock_service, "update_document_review_with_transaction"
    )

    expected_timestamp = 1705314600

    review = DocumentUploadReviewReference.model_construct()
    review.id = "pending-review-id"
    review.custodian = TEST_ODS_CODE
    review.version = 1
    review.review_status = DocumentReviewStatus.PENDING_REVIEW

    new_review_copy = review.model_copy(deep=True)
    new_review_copy.version = 2
    new_review_copy.custodian = NEW_ODS_CODE

    mock_service._handle_pending_review_custodian_update(
        review, NEW_ODS_CODE, {"custodian"}
    )

    assert review.review_status == DocumentReviewStatus.NEVER_REVIEWED
    assert review.review_date == expected_timestamp
    assert review.reviewer == TEST_ODS_CODE
    assert review.custodian == NEW_ODS_CODE

    mock_transaction_update.assert_called_once_with(
        new_review_item=new_review_copy,
        existing_review_item=review,
        additional_update_fields={"custodian"},
    )


def test_handle_pending_review_custodian_update_with_transaction_failure(
    mock_service, mocker
):
    mock_transaction_update = mocker.patch.object(
        mock_service, "update_document_review_with_transaction"
    )
    mock_transaction_update.side_effect = DocumentReviewException("Transaction failed")

    review = MagicMock(spec=DocumentUploadReviewReference)
    review.id = "test-id"
    review.custodian = TEST_ODS_CODE
    review.version = 1
    review.review_status = DocumentReviewStatus.PENDING_REVIEW

    with pytest.raises(DocumentReviewException):
        mock_service._handle_pending_review_custodian_update(
            review, NEW_ODS_CODE, {"custodian"}
        )


def test_build_review_dynamo_filter_creates_filter_from_nhs_number(mock_service):
    expected = Attr("ReviewStatus").eq("PENDING_REVIEW") & Attr("NhsNumber").eq(
        TEST_NHS_NUMBER
    )
    actual = mock_service.build_review_dynamo_filter(nhs_number=TEST_NHS_NUMBER)

    assert actual == expected


def test_build_review_dynamo_filter_creates_filter_from_uploader_ods_code(mock_service):
    expected = Attr("ReviewStatus").eq("PENDING_REVIEW") & Attr("Author").eq(
        TEST_ODS_CODE
    )
    actual = mock_service.build_review_dynamo_filter(uploader=TEST_ODS_CODE)

    assert actual == expected


def test_build_filter_handles_both_nhs_number_and_uploader(mock_service):
    expected = (
        Attr("ReviewStatus").eq("PENDING_REVIEW")
        & Attr("NhsNumber").eq(TEST_NHS_NUMBER)
        & Attr("Author").eq(TEST_ODS_CODE)
    )
    actual = mock_service.build_review_dynamo_filter(
        nhs_number=TEST_NHS_NUMBER, uploader=TEST_ODS_CODE
    )

    assert actual == expected


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


@pytest.mark.parametrize(
    "nhs_number, uploader, expected",
    [
        (
            None,
            None,
            (
                "#ReviewStatus_attr = :ReviewStatus_condition_val",
                {"#ReviewStatus_attr": "ReviewStatus"},
                {":ReviewStatus_condition_val": DocumentReviewStatus.PENDING_REVIEW},
            ),
        ),
        (
            TEST_NHS_NUMBER,
            None,
            (
                "#ReviewStatus_attr = :ReviewStatus_condition_val AND #NhsNumber_attr = :NhsNumber_condition_val",
                {"#ReviewStatus_attr": "ReviewStatus", "#NhsNumber_attr": "NhsNumber"},
                {
                    ":ReviewStatus_condition_val": DocumentReviewStatus.PENDING_REVIEW,
                    ":NhsNumber_condition_val": TEST_NHS_NUMBER,
                },
            ),
        ),
        (
            TEST_NHS_NUMBER,
            TEST_ODS_CODE,
            (
                (
                    "#ReviewStatus_attr = :ReviewStatus_condition_val AND #NhsNumber_attr = :NhsNumber_condition_val AND "
                    "#Author_attr = :Author_condition_val"
                ),
                {
                    "#ReviewStatus_attr": "ReviewStatus",
                    "#NhsNumber_attr": "NhsNumber",
                    "#Author_attr": "Author",
                },
                {
                    ":ReviewStatus_condition_val": DocumentReviewStatus.PENDING_REVIEW,
                    ":NhsNumber_condition_val": TEST_NHS_NUMBER,
                    ":Author_condition_val": TEST_ODS_CODE,
                },
            ),
        ),
        (
            None,
            TEST_ODS_CODE,
            (
                "#ReviewStatus_attr = :ReviewStatus_condition_val AND #Author_attr = :Author_condition_val",
                {"#ReviewStatus_attr": "ReviewStatus", "#Author_attr": "Author"},
                {
                    ":ReviewStatus_condition_val": DocumentReviewStatus.PENDING_REVIEW,
                    ":Author_condition_val": TEST_ODS_CODE,
                },
            ),
        ),
    ],
)
def test_build_paginator_query_filter(mock_service, nhs_number, uploader, expected):
    actual = mock_service.build_paginator_query_filter(
        nhs_number=nhs_number, uploader=uploader
    )

    assert actual == expected


def test_query_docs_pending_review_with_paginator(mock_service):
    filter_expression, condition_attribute_names, condition_attribute_values = (
        mock_service.build_paginator_query_filter()
    )

    mock_service.dynamo_service.query_table_with_paginator.return_value = {
        "Items": MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"],
        "NextToken": TEST_UUID,
    }

    expected = (
        [
            DocumentUploadReviewReference(**item)
            for item in MOCK_DOCUMENT_REVIEW_SEARCH_RESPONSE["Items"]
        ],
        TEST_UUID,
    )

    actual = mock_service.query_docs_pending_review_with_paginator(TEST_ODS_CODE)

    mock_service.dynamo_service.query_table_with_paginator.assert_called_with(
        table_name=MOCK_DOCUMENT_REVIEW_TABLE,
        index_name="CustodianIndex",
        key="Custodian",
        condition=TEST_ODS_CODE,
        filter_expression=filter_expression,
        expression_attribute_names=condition_attribute_names,
        expression_attribute_values=condition_attribute_values,
        limit=50,
        start_key=None,
        page_size=1,
    )

    assert actual == expected
