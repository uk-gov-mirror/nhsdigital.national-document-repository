from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError
from enums.patient_ods_inactive_status import PatientOdsInactiveStatus
from models.document_reference import DocumentReference
from models.document_review import DocumentUploadReviewReference
from models.sqs.mns_sqs_message import MNSSQSMessage
from services.process_mns_message_service import MNSNotificationService
from tests.unit.conftest import TEST_CURRENT_GP_ODS, TEST_NHS_NUMBER
from tests.unit.handlers.test_mns_notification_handler import (
    MOCK_DEATH_MESSAGE_BODY,
    MOCK_GP_CHANGE_MESSAGE_BODY,
    MOCK_INFORMAL_DEATH_MESSAGE_BODY,
    MOCK_REMOVED_DEATH_MESSAGE_BODY,
)
from utils.exceptions import PdsErrorException


@pytest.fixture
def mns_service(mocker, set_env, monkeypatch):
    monkeypatch.setenv("PDS_FHIR_IS_STUBBED", "False")
    service = MNSNotificationService()
    mocker.patch.object(service, "pds_service")
    mocker.patch.object(service, "document_review_service")
    mocker.patch.object(service, "lg_document_service")
    mocker.patch.object(service, "sqs_service")
    yield service


@pytest.fixture
def mock_handle_gp_change(mocker, mns_service):
    service = mns_service
    mocker.patch.object(service, "handle_gp_change_notification")
    yield service


@pytest.fixture
def mock_handle_death_notification(mocker, mns_service):
    service = mns_service
    mocker.patch.object(service, "handle_death_notification")
    yield service


@pytest.fixture
def mock_document_references(mocker):
    # Create a list of mock document references
    docs = []
    for i in range(3):
        doc = MagicMock(spec=DocumentReference)
        doc.id = f"doc-id-{i}"
        doc.nhs_number = TEST_NHS_NUMBER
        doc.current_gp_ods = TEST_CURRENT_GP_ODS
        doc.custodian = TEST_CURRENT_GP_ODS
        docs.append(doc)
    return docs


@pytest.fixture
def mock_document_review_references(mocker):
    # Create a list of mock document review references
    reviews = []
    for i in range(2):
        review = MagicMock(spec=DocumentUploadReviewReference)
        review.id = f"review-id-{i}"
        review.nhs_number = TEST_NHS_NUMBER
        review.custodian = TEST_CURRENT_GP_ODS
        reviews.append(review)
    return reviews


MOCK_UPDATE_TIME = "2024-01-01 12:00:00"
NEW_ODS_CODE = "NEW123"

gp_change_message = MNSSQSMessage(**MOCK_GP_CHANGE_MESSAGE_BODY)
death_notification_message = MNSSQSMessage(**MOCK_DEATH_MESSAGE_BODY)
informal_death_notification_message = MNSSQSMessage(**MOCK_INFORMAL_DEATH_MESSAGE_BODY)
removed_death_notification_message = MNSSQSMessage(**MOCK_REMOVED_DEATH_MESSAGE_BODY)


def test_handle_gp_change_message_called_message_type_gp_change(
    mns_service, mock_handle_gp_change, mock_handle_death_notification
):
    mns_service.handle_mns_notification(gp_change_message)

    mns_service.handle_death_notification.assert_not_called()
    mns_service.handle_gp_change_notification.assert_called_with(gp_change_message)


def test_handle_gp_change_message_not_called_message_death_message(
    mns_service, mock_handle_death_notification, mock_handle_gp_change
):
    mns_service.handle_mns_notification(death_notification_message)

    mns_service.handle_gp_change_notification.assert_not_called()
    mns_service.handle_death_notification.assert_called_with(death_notification_message)


def test_handle_mns_notification_error_handling_pds_error(mns_service, mocker):
    mocker.patch.object(
        mns_service,
        "handle_gp_change_notification",
        side_effect=PdsErrorException("PDS error"),
    )

    with pytest.raises(PdsErrorException):
        mns_service.handle_mns_notification(gp_change_message)


def test_handle_mns_notification_error_handling_client_error(mns_service, mocker):
    client_error = ClientError(
        {"Error": {"Code": "TestException", "Message": "Test exception"}}, "operation"
    )
    mocker.patch.object(
        mns_service, "handle_gp_change_notification", side_effect=client_error
    )

    with pytest.raises(ClientError):
        mns_service.handle_mns_notification(gp_change_message)


def test_handle_gp_change_notification_with_patient_documents(
    mns_service, mock_document_references, mock_document_review_references, mocker
):
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = (
        mock_document_references,
        mock_document_review_references,
    )
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mns_service.get_updated_gp_ods.return_value = NEW_ODS_CODE
    mocker.patch.object(mns_service, "update_all_patient_documents")

    mns_service.handle_gp_change_notification(gp_change_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        gp_change_message.subject.nhs_number
    )
    mns_service.get_updated_gp_ods.assert_called_once_with(
        gp_change_message.subject.nhs_number
    )
    mns_service.update_all_patient_documents.assert_called_once_with(
        mock_document_references, mock_document_review_references, NEW_ODS_CODE
    )


def test_handle_gp_change_notification_no_patient_documents(mns_service, mocker):
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = ([], [])
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mocker.patch.object(mns_service, "update_all_patient_documents")

    mns_service.handle_gp_change_notification(gp_change_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        gp_change_message.subject.nhs_number
    )
    mns_service.get_updated_gp_ods.assert_not_called()
    mns_service.update_all_patient_documents.assert_not_called()


def test_handle_death_notification_informal(mns_service, mocker):
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mocker.patch.object(mns_service, "update_all_patient_documents")

    mns_service.handle_death_notification(informal_death_notification_message)

    mns_service.get_all_patient_documents.assert_not_called()
    mns_service.get_updated_gp_ods.assert_not_called()
    mns_service.update_all_patient_documents.assert_not_called()


def test_handle_death_notification_removed_with_documents(
    mns_service, mock_document_references, mock_document_review_references, mocker
):
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mocker.patch.object(mns_service, "update_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = (
        mock_document_references,
        mock_document_review_references,
    )
    mns_service.get_updated_gp_ods.return_value = NEW_ODS_CODE

    mns_service.handle_death_notification(removed_death_notification_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        removed_death_notification_message.subject.nhs_number
    )
    mns_service.get_updated_gp_ods.assert_called_once_with(
        removed_death_notification_message.subject.nhs_number
    )
    mns_service.update_all_patient_documents.assert_called_once_with(
        mock_document_references, mock_document_review_references, NEW_ODS_CODE
    )


def test_handle_death_notification_removed_no_documents(mns_service, mocker):
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mocker.patch.object(mns_service, "update_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = ([], [])

    mns_service.handle_death_notification(removed_death_notification_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        removed_death_notification_message.subject.nhs_number
    )
    mns_service.get_updated_gp_ods.assert_not_called()
    mns_service.update_all_patient_documents.assert_not_called()


def test_handle_death_notification_formal_with_documents(
    mns_service, mock_document_references, mock_document_review_references, mocker
):
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mocker.patch.object(mns_service, "update_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = (
        mock_document_references,
        mock_document_review_references,
    )

    mns_service.handle_death_notification(death_notification_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        death_notification_message.subject.nhs_number
    )
    mns_service.update_all_patient_documents.assert_called_once_with(
        mock_document_references,
        mock_document_review_references,
        PatientOdsInactiveStatus.DECEASED,
    )
    mns_service.get_updated_gp_ods.assert_not_called()


def test_handle_death_notification_formal_no_documents(mns_service, mocker):
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mocker.patch.object(mns_service, "update_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = ([], [])

    mns_service.handle_death_notification(death_notification_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        death_notification_message.subject.nhs_number
    )
    mns_service.update_all_patient_documents.assert_not_called()



def test_get_updated_gp_ods(mns_service):
    expected_ods = NEW_ODS_CODE
    patient_details_mock = MagicMock()
    patient_details_mock.general_practice_ods = expected_ods
    mns_service.pds_service.fetch_patient_details.return_value = patient_details_mock

    result = mns_service.get_updated_gp_ods(TEST_NHS_NUMBER)

    assert result == expected_ods
    mns_service.pds_service.fetch_patient_details.assert_called_once_with(
        TEST_NHS_NUMBER
    )


def test_pds_is_called_death_notification_removed(
    mns_service, mocker, mock_document_references, mock_document_review_references
):
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mocker.patch.object(mns_service, "update_all_patient_documents")
    mocker.patch.object(mns_service, "get_all_patient_documents")

    mns_service.get_all_patient_documents.return_value = (
        mock_document_references,
        mock_document_review_references,
    )
    mns_service.handle_mns_notification(removed_death_notification_message)

    mns_service.get_updated_gp_ods.assert_called()
    mns_service.update_all_patient_documents.assert_called()


def test_get_all_patient_documents(mns_service, mocker):
    expected_lg_docs = [MagicMock(spec=DocumentReference)]
    expected_review_docs = [MagicMock(spec=DocumentUploadReviewReference)]

    mns_service.lg_document_service.fetch_documents_from_table_with_nhs_number.return_value = (
        expected_lg_docs
    )
    mns_service.document_review_service.fetch_documents_from_table_with_nhs_number.return_value = (
        expected_review_docs
    )

    lg_docs, review_docs = mns_service.get_all_patient_documents(TEST_NHS_NUMBER)

    assert lg_docs == expected_lg_docs
    assert review_docs == expected_review_docs
    mns_service.lg_document_service.fetch_documents_from_table_with_nhs_number.assert_called_once_with(
        TEST_NHS_NUMBER
    )
    mns_service.document_review_service.fetch_documents_from_table_with_nhs_number.assert_called_once_with(
        TEST_NHS_NUMBER
    )


def test_update_all_patient_documents_with_both_types(
    mns_service, mock_document_references, mock_document_review_references, mocker
):
    mns_service.update_all_patient_documents(
        mock_document_references, mock_document_review_references, NEW_ODS_CODE
    )

    mns_service.lg_document_service.update_patient_ods_code.assert_called_once_with(
        mock_document_references, NEW_ODS_CODE
    )
    mns_service.document_review_service.update_document_review_custodian.assert_called_once_with(
        mock_document_review_references, NEW_ODS_CODE
    )


def test_update_all_patient_documents_with_only_lg_documents(
    mns_service, mock_document_references, mocker
):
    mns_service.update_all_patient_documents(mock_document_references, [], NEW_ODS_CODE)

    mns_service.lg_document_service.update_patient_ods_code.assert_called_once_with(
        mock_document_references, NEW_ODS_CODE
    )
    mns_service.document_review_service.update_document_review_custodian.assert_not_called()


def test_update_all_patient_documents_with_only_review_documents(
    mns_service, mock_document_review_references, mocker
):
    mns_service.update_all_patient_documents(
        [], mock_document_review_references, NEW_ODS_CODE
    )

    mns_service.lg_document_service.update_patient_ods_code.assert_not_called()
    mns_service.document_review_service.update_document_review_custodian.assert_called_once_with(
        mock_document_review_references, NEW_ODS_CODE
    )



def test_handle_gp_change_notification_with_only_lg_documents(
    mns_service, mock_document_references, mocker
):
    """Test GP change when only LG documents exist (no review documents)"""
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = (
        mock_document_references,
        [],
    )
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mns_service.get_updated_gp_ods.return_value = NEW_ODS_CODE
    mocker.patch.object(mns_service, "update_all_patient_documents")

    mns_service.handle_gp_change_notification(gp_change_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        gp_change_message.subject.nhs_number
    )
    mns_service.get_updated_gp_ods.assert_called_once_with(
        gp_change_message.subject.nhs_number
    )
    mns_service.update_all_patient_documents.assert_called_once_with(
        mock_document_references, [], NEW_ODS_CODE
    )


def test_handle_gp_change_notification_with_only_review_documents(
    mns_service, mock_document_review_references, mocker
):
    """Test GP change when only review documents exist (no LG documents)"""
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = (
        [],
        mock_document_review_references,
    )
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mns_service.get_updated_gp_ods.return_value = NEW_ODS_CODE
    mocker.patch.object(mns_service, "update_all_patient_documents")

    mns_service.handle_gp_change_notification(gp_change_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        gp_change_message.subject.nhs_number
    )
    mns_service.get_updated_gp_ods.assert_called_once_with(
        gp_change_message.subject.nhs_number
    )
    mns_service.update_all_patient_documents.assert_called_once_with(
        [], mock_document_review_references, NEW_ODS_CODE
    )


def test_handle_death_notification_formal_with_only_lg_documents(
    mns_service, mock_document_references, mocker
):
    """Test formal death notification when only LG documents exist"""
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mocker.patch.object(mns_service, "update_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = (
        mock_document_references,
        [],
    )

    mns_service.handle_death_notification(death_notification_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        death_notification_message.subject.nhs_number
    )
    mns_service.update_all_patient_documents.assert_called_once_with(
        mock_document_references,
        [],
        PatientOdsInactiveStatus.DECEASED,
    )
    mns_service.get_updated_gp_ods.assert_not_called()


def test_handle_death_notification_formal_with_only_review_documents(
    mns_service, mock_document_review_references, mocker
):
    """Test formal death notification when only review documents exist"""
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mocker.patch.object(mns_service, "update_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = (
        [],
        mock_document_review_references,
    )

    mns_service.handle_death_notification(death_notification_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        death_notification_message.subject.nhs_number
    )
    mns_service.update_all_patient_documents.assert_called_once_with(
        [],
        mock_document_review_references,
        PatientOdsInactiveStatus.DECEASED,
    )
    mns_service.get_updated_gp_ods.assert_not_called()


def test_handle_death_notification_removed_with_only_lg_documents(
    mns_service, mock_document_references, mocker
):
    """Test removed death notification when only LG documents exist"""
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mocker.patch.object(mns_service, "update_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = (
        mock_document_references,
        [],
    )
    mns_service.get_updated_gp_ods.return_value = NEW_ODS_CODE

    mns_service.handle_death_notification(removed_death_notification_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        removed_death_notification_message.subject.nhs_number
    )
    mns_service.get_updated_gp_ods.assert_called_once_with(
        removed_death_notification_message.subject.nhs_number
    )
    mns_service.update_all_patient_documents.assert_called_once_with(
        mock_document_references, [], NEW_ODS_CODE
    )


def test_handle_death_notification_removed_with_only_review_documents(
    mns_service, mock_document_review_references, mocker
):
    """Test removed death notification when only review documents exist"""
    mocker.patch.object(mns_service, "get_all_patient_documents")
    mocker.patch.object(mns_service, "get_updated_gp_ods")
    mocker.patch.object(mns_service, "update_all_patient_documents")
    mns_service.get_all_patient_documents.return_value = (
        [],
        mock_document_review_references,
    )
    mns_service.get_updated_gp_ods.return_value = NEW_ODS_CODE

    mns_service.handle_death_notification(removed_death_notification_message)

    mns_service.get_all_patient_documents.assert_called_once_with(
        removed_death_notification_message.subject.nhs_number
    )
    mns_service.get_updated_gp_ods.assert_called_once_with(
        removed_death_notification_message.subject.nhs_number
    )
    mns_service.update_all_patient_documents.assert_called_once_with(
        [], mock_document_review_references, NEW_ODS_CODE
    )
