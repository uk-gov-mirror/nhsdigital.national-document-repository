from copy import deepcopy
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError
from enums.patient_ods_inactive_status import PatientOdsInactiveStatus
from enums.snomed_codes import SnomedCodes
from freezegun import freeze_time
from models.document_review import (
    DocumentReviewFileDetails,
    DocumentReviewUploadEvent,
    DocumentUploadReviewReference,
)
from pydantic import ValidationError
from services.post_document_review_service import PostDocumentReviewService
from tests.unit.conftest import (
    EXPECTED_PARSED_PATIENT_BASE_CASE,
    MOCK_EDGE_REFERENCE_TABLE,
    MOCK_STAGING_STORE_BUCKET,
    TEST_CURRENT_GP_ODS,
    TEST_NHS_NUMBER,
    TEST_UUID,
)
from utils.exceptions import (
    DocumentReviewException,
    OdsErrorException,
    PatientNotFoundException,
)
from utils.lambda_exceptions import DocumentReviewLambdaException

VALID_EVENT = DocumentReviewUploadEvent(
    nhs_number=TEST_NHS_NUMBER,
    snomed_code=SnomedCodes.LLOYD_GEORGE.value.code,
    documents=["testFile.pdf"],
)

MOCK_EVENT_WITH_MULITPLE_FILES = deepcopy(VALID_EVENT)
MOCK_EVENT_WITH_MULITPLE_FILES.documents = ["testFile.pdf", "testFile2.pdf"]

MOCK_DECEASED_PATIENT_DETAILS = deepcopy(EXPECTED_PARSED_PATIENT_BASE_CASE)
MOCK_DECEASED_PATIENT_DETAILS.general_practice_ods = PatientOdsInactiveStatus.DECEASED
MOCK_DECEASED_PATIENT_DETAILS.active = False
MOCK_DECEASED_PATIENT_DETAILS.deceased = True

TEST_PRESIGNED_URL_1 = "https://s3.amazonaws.com/presigned1?signature=abc123"
TEST_PRESIGNED_URL_2 = "https://s3.amazonaws.com/presigned2?signature=def456"

FROZEN_TIMESTAMP = 1704110400


@pytest.fixture
def mock_service(set_env, mocker):
    mocker.patch("services.post_document_review_service.S3Service")
    mocker.patch("services.post_document_review_service.DocumentUploadReviewService")

    service = PostDocumentReviewService()
    service.s3_service = MagicMock()
    service.s3_service.presigned_url_expiry = 1800  # 30 minutes

    service.review_document_service = MagicMock()
    mocker.patch.object(service, "pds_service")

    yield service


@pytest.fixture
def mock_extract_ods(mocker):
    return mocker.patch(
        "services.post_document_review_service.extract_ods_code_from_request_context"
    )


@freeze_time("2024-01-01 12:00:00")
def test_process_event_happy_path(mock_extract_ods, mock_service, mock_uuid, mocker):
    mock_extract_ods.return_value = TEST_CURRENT_GP_ODS
    mock_service.pds_service.fetch_patient_details.return_value = (
        EXPECTED_PARSED_PATIENT_BASE_CASE
    )
    mocker.patch.object(mock_service, "create_response")
    mock_create_url = mocker.patch.object(
        mock_service, "create_review_document_upload_presigned_url"
    )
    mock_create_url.return_value = TEST_PRESIGNED_URL_1

    mock_service.process_event(VALID_EVENT)

    mock_extract_ods.assert_called()
    mock_service.pds_service.fetch_patient_details.assert_called_with(TEST_NHS_NUMBER)
    mock_create_url.assert_called_with(
        file_key=f"review/{TEST_UUID}/{TEST_UUID}",
        upload_id=TEST_UUID,
    )

    mock_service.review_document_service.create_dynamo_entry.assert_called()
    mock_service.create_response.assert_called()


@freeze_time("2024-01-01 12:00:00")
def test_process_event_multi_file_event(
    mock_service, mock_extract_ods, mock_uuid, mocker
):
    mock_extract_ods.return_value = TEST_CURRENT_GP_ODS
    mock_service.pds_service.fetch_patient_details.return_value = (
        EXPECTED_PARSED_PATIENT_BASE_CASE
    )
    mock_create_url = mocker.patch.object(
        mock_service, "create_review_document_upload_presigned_url"
    )
    mock_create_url.side_effect = [
        TEST_PRESIGNED_URL_1,
        TEST_PRESIGNED_URL_2,
    ]

    expected = {
        "id": TEST_UUID,
        "uploadDate": FROZEN_TIMESTAMP,
        "files": [
            {
                "fileName": MOCK_EVENT_WITH_MULITPLE_FILES.documents[0],
                "presignedUrl": TEST_PRESIGNED_URL_1,
            },
            {
                "fileName": MOCK_EVENT_WITH_MULITPLE_FILES.documents[1],
                "presignedUrl": TEST_PRESIGNED_URL_2,
            },
        ],
        "documentSnomedCodeType": SnomedCodes.LLOYD_GEORGE.value.code,
        "version": 1,
    }

    actual = mock_service.process_event(MOCK_EVENT_WITH_MULITPLE_FILES)

    assert actual == expected


def test_process_event_throws_error_failure_to_extract_ods_from_request_context(
    mock_extract_ods, mock_service
):
    mock_extract_ods.side_effect = OdsErrorException()

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.process_event(VALID_EVENT)

    assert e.value.status_code == 400
    assert e.value.err_code == "UDR_4001"


def test_process_event_calls_pds_for_patient_status_with_nhs_number(
    mock_service, mock_extract_ods
):
    mock_extract_ods.return_value = TEST_CURRENT_GP_ODS
    mock_service.pds_service.fetch_patient_details.return_value = (
        EXPECTED_PARSED_PATIENT_BASE_CASE
    )
    mock_service.process_event(VALID_EVENT)

    mock_service.pds_service.fetch_patient_details.assert_called_with(TEST_NHS_NUMBER)


def test_process_event_throws_error_patient_is_DECE(mock_service, mock_extract_ods):
    mock_service.pds_service.fetch_patient_details.return_value = (
        MOCK_DECEASED_PATIENT_DETAILS
    )

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.process_event(VALID_EVENT)

    assert e.value.status_code == 403
    assert e.value.err_code == "UDR_4031"


def test_process_event_handles_pds_patient_not_found(mock_service, mock_extract_ods):
    mock_service.pds_service.fetch_patient_details.side_effect = (
        PatientNotFoundException()
    )

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.process_event(VALID_EVENT)

    assert e.value.status_code == 400
    assert e.value.err_code == "UDR_4003"


def test_process_event_handles_client_error(mock_service, mock_extract_ods):
    mock_service.review_document_service.create_dynamo_entry.side_effect = ClientError(
        {"error": "test error message"}, "test"
    )

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.process_event(VALID_EVENT)

    assert e.value.status_code == 500
    assert e.value.err_code == "UDR_5002"


def test_process_event_handles_validation_error_creating_new_dynamo_entry(
    mock_service, mock_extract_ods
):
    mock_service.review_document_service.create_dynamo_entry.side_effect = (
        ValidationError("", [])
    )

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.process_event(VALID_EVENT)

    assert e.value.status_code == 500
    assert e.value.err_code == "UDR_5002"


@freeze_time("2024-01-01 12:00:00")
def test_create_presigned_urls_for_review_reference_files_creates_presign_writes_to_table(
    mock_service, mock_uuid
):

    document_review_reference = mock_service.create_review_reference_from_event(
        VALID_EVENT, TEST_CURRENT_GP_ODS, EXPECTED_PARSED_PATIENT_BASE_CASE
    )
    mock_service.s3_service.create_put_presigned_url.return_value = TEST_PRESIGNED_URL_1

    mock_service.create_presigned_urls_for_review_reference_files(
        document_review_reference
    )

    mock_service.s3_service.create_put_presigned_url.assert_called_once()
    mock_service.s3_service.create_put_presigned_url.assert_called_with(
        s3_bucket_name=MOCK_STAGING_STORE_BUCKET,
        file_key=f"review/{document_review_reference.id}/{TEST_UUID}",
    )

    mock_service.review_document_service.dynamo_service.create_item.assert_called_once()
    mock_service.review_document_service.dynamo_service.create_item.assert_called_with(
        table_name=MOCK_EDGE_REFERENCE_TABLE,
        item={
            "ID": f"upload/{TEST_UUID}",
            "TTL": FROZEN_TIMESTAMP + mock_service.s3_service.presigned_url_expiry,
            "presignedUrl": TEST_PRESIGNED_URL_1,
        },
    )


def test_create_review_document_upload_presigned_url_handles_errors(mock_service):
    mock_service.s3_service.create_put_presigned_url.side_effect = ClientError(
        {"Error": {"Code": "UDR_4031"}}, "Put"
    )

    with pytest.raises(DocumentReviewException):
        mock_service.create_review_document_upload_presigned_url("file_key", TEST_UUID)


def test_create_presigned_urls_for_review_reference_files_handles_error(
    mock_service, mock_extract_ods, mocker
):
    mocker.patch.object(
        mock_service, "create_review_document_upload_presigned_url"
    ).side_effect = DocumentReviewException("Failed to create presigned url")
    document_review_reference = mock_service.create_review_reference_from_event(
        VALID_EVENT, TEST_CURRENT_GP_ODS, EXPECTED_PARSED_PATIENT_BASE_CASE
    )

    with pytest.raises(DocumentReviewLambdaException) as e:
        mock_service.create_presigned_urls_for_review_reference_files(
            document_review_reference
        )

    assert e.value.status_code == 500
    assert e.value.err_code == "UDR_5003"


def test_create_response(mock_service):
    expected = {
        "id": TEST_UUID,
        "uploadDate": FROZEN_TIMESTAMP,
        "files": [
            {"fileName": VALID_EVENT.documents[0], "presignedUrl": TEST_PRESIGNED_URL_1}
        ],
        "documentSnomedCodeType": SnomedCodes.LLOYD_GEORGE.value.code,
        "version": 1,
    }
    actual = mock_service.create_response(
        DocumentUploadReviewReference(
            id=TEST_UUID,
            upload_date=FROZEN_TIMESTAMP,
            files=[
                DocumentReviewFileDetails(
                    file_name=VALID_EVENT.documents[0],
                    presigned_url=TEST_PRESIGNED_URL_1,
                )
            ],
            document_snomed_code_type=SnomedCodes.LLOYD_GEORGE.value.code,
            version=1,
            author=TEST_CURRENT_GP_ODS,
            custodian=TEST_CURRENT_GP_ODS,
            nhs_number=TEST_NHS_NUMBER,
        )
    )
    assert actual == expected