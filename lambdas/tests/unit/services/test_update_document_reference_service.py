import json
import pytest

from freezegun import freeze_time
from services.fhir_document_reference_service_base import FhirDocumentReferenceServiceBase
from services.update_document_reference_service import UpdateDocumentReferenceService
from tests.unit.helpers.data.create_document_reference import (
    LG_FILE_LIST
)
from tests.unit.conftest import (
    TEST_UUID
)
from tests.unit.helpers.data.test_documents import create_test_lloyd_george_doc_store_refs
from utils.exceptions import LGInvalidFilesException, PatientNotFoundException
from utils.lambda_exceptions import DocumentRefException
from utils.request_context import request_context
from lambdas.tests.unit.conftest import (
    TEST_CURRENT_GP_ODS,
    TEST_NHS_NUMBER,
)

@pytest.fixture
def mock_update_doc_ref_service(mocker, set_env):
    mocker.patch("services.update_document_reference_service.DocumentService")
    mocker.patch("services.update_document_reference_service.SSMService")
    update_doc_ref_service = UpdateDocumentReferenceService()
    yield update_doc_ref_service

@pytest.fixture
def mock_fhir_doc_ref_base_service(set_env, mocker, setup_request_context):
    mock_document_service = mocker.patch("services.fhir_document_reference_service_base.DocumentService")
    mock_s3_service = mocker.patch("services.fhir_document_reference_service_base.S3Service")
    mock_dynamo_service = mocker.patch("services.fhir_document_reference_service_base.DynamoDBService")
    service = FhirDocumentReferenceServiceBase()
    service.document_service = mock_document_service.return_value
    service.s3_service = mock_s3_service.return_value
    service.dynamo_service = mock_dynamo_service.return_value
    yield service

@pytest.fixture
def setup_request_context():
    request_context.authorization = {
        "ndr_session_id": TEST_UUID,
        "nhs_user_id": "test-user-id",
        "selected_organisation": {"org_ods_code": "test-ods-code"},
    }
    yield
    request_context.authorization = {}

@pytest.fixture()
def mock_check_if_upload_is_in_progress_for_previous_records(
    mock_update_doc_ref_service, mocker
):
    yield mocker.patch.object(
        mock_update_doc_ref_service,
        "check_if_upload_is_in_progress_for_previous_records",
    )


@pytest.fixture()
def mock_validate_lg_files(mocker, mock_getting_patient_info_from_pds):
    yield mocker.patch("services.update_document_reference_service.validate_lg_files")


@pytest.fixture()
def mock_getting_patient_info_from_pds(mocker):
    yield mocker.patch(
        "services.update_document_reference_service.getting_patient_info_from_pds",
    )

@pytest.fixture()
def mock_prepare_pre_signed_url(mock_update_doc_ref_service, mocker):
    yield mocker.patch.object(mock_update_doc_ref_service, "prepare_pre_signed_url")

@pytest.fixture()
def mock_process_fhir_document_reference(mocker):
    yield mocker.patch(
        "services.put_fhir_document_reference_service.PutFhirDocumentReferenceService.process_fhir_document_reference",
        return_value =
            json.dumps(
                {
                    "content": [
                        {
                            "attachment": {
                                "url": "https://test-bucket.s3.amazonaws.com/"
                            }
                        }
                    ]
                }
            )
    )

@pytest.fixture
def mock_get_allowed_list_of_ods_codes_for_upload_pilot(mock_update_doc_ref_service, mocker):
    return mocker.patch.object(
        mock_update_doc_ref_service, "get_allowed_list_of_ods_codes_for_upload_pilot"
    )

@pytest.fixture
def mock_check_if_ods_code_is_in_pilot(mock_update_doc_ref_service, mocker):
    return mocker.patch.object(
        mock_update_doc_ref_service, "check_if_ods_code_is_in_pilot"
    )

@pytest.fixture
def mock_fetch_document(mocker, mock_update_doc_ref_service):
    mock = mocker.patch.object(
        mock_update_doc_ref_service.document_service,
        "fetch_available_document_references_by_type",
    )
    mock.return_value = []
    yield mock

def test_update_document_reference_request_with_lg_list_happy_path(
    mock_update_doc_ref_service,
    mock_fhir_doc_ref_base_service,
    mock_getting_patient_info_from_pds,
    mock_check_if_upload_is_in_progress_for_previous_records,
    mock_get_allowed_list_of_ods_codes_for_upload_pilot,
    mock_process_fhir_document_reference,
    mock_validate_lg_files,
    mock_pds_patient
):
    mock_get_allowed_list_of_ods_codes_for_upload_pilot.return_value = [TEST_CURRENT_GP_ODS]
    mock_getting_patient_info_from_pds.return_value = mock_pds_patient

    mock_presigned_url_response = "https://test-bucket.s3.amazonaws.com/"

    mock_fhir_doc_ref_base_service.s3_service.create_put_presigned_url.return_value = (
        mock_presigned_url_response
    )

    url_references = mock_update_doc_ref_service.update_document_reference_request(
        TEST_NHS_NUMBER, LG_FILE_LIST, TEST_UUID
    )

    expected_response = {
        "uuid1": mock_presigned_url_response,
        "uuid2": mock_presigned_url_response,
        "uuid3": mock_presigned_url_response,
    }
    assert url_references == expected_response
    assert len(url_references) == len(LG_FILE_LIST)

    mock_check_if_upload_is_in_progress_for_previous_records.assert_called_with(
        TEST_NHS_NUMBER
    )

def test_ods_code_not_in_pilot_raises_exception(
    mock_update_doc_ref_service,
    mock_get_allowed_list_of_ods_codes_for_upload_pilot,
    mock_process_fhir_document_reference,
    mock_validate_lg_files,
    mock_check_if_upload_is_in_progress_for_previous_records,
    mock_getting_patient_info_from_pds,
    mock_pds_patient
):
    mock_get_allowed_list_of_ods_codes_for_upload_pilot.return_value = ["DISALLOWED"]
    mock_getting_patient_info_from_pds.return_value = mock_pds_patient

    with pytest.raises(DocumentRefException) as exc_info:
        mock_update_doc_ref_service.update_document_reference_request(
            TEST_NHS_NUMBER, LG_FILE_LIST, TEST_UUID
        )

    # create_fhir_document_reference_object_basic.assert_not_called()
    mock_process_fhir_document_reference.assert_not_called()
    mock_validate_lg_files.assert_not_called()
    mock_check_if_upload_is_in_progress_for_previous_records.assert_not_called()

    exception = exc_info.value
    assert isinstance(exception, DocumentRefException)
    assert exception.status_code == 404
    assert exception.message == "ODS code does not match any of the allowed."

def test_nhs_number_not_found_raises_exception(
    mock_getting_patient_info_from_pds,
    mock_update_doc_ref_service,
    mock_check_if_ods_code_is_in_pilot,
    mock_process_fhir_document_reference
):
    mock_getting_patient_info_from_pds.side_effect = PatientNotFoundException

    with pytest.raises(DocumentRefException) as exc_info:
        mock_update_doc_ref_service.update_document_reference_request(
            TEST_NHS_NUMBER, LG_FILE_LIST, TEST_UUID
        )

    exception = exc_info.value
    assert isinstance(exception, DocumentRefException)
    assert exception.status_code == 404
    assert exception.message == "Patient does not exist for given NHS number"

    mock_check_if_ods_code_is_in_pilot.assert_not_called()
    mock_process_fhir_document_reference.assert_not_called()

# covers for number of files expected, non-pdf files, incorrect file name format, duplicate files
def test_invalid_files_raises_exception(
    mock_update_doc_ref_service,
    mock_validate_lg_files,
    mock_getting_patient_info_from_pds,
    mock_pds_patient,
    mock_get_allowed_list_of_ods_codes_for_upload_pilot,
    mock_fhir_doc_ref_base_service,
    mock_process_fhir_document_reference,
    mock_check_if_upload_is_in_progress_for_previous_records
):
    mock_getting_patient_info_from_pds.return_value = mock_pds_patient
    mock_get_allowed_list_of_ods_codes_for_upload_pilot.return_value = [TEST_CURRENT_GP_ODS]
    mock_validate_lg_files.side_effect = LGInvalidFilesException

    with pytest.raises(DocumentRefException) as exc_info:
        mock_update_doc_ref_service.update_document_reference_request(
            TEST_NHS_NUMBER, LG_FILE_LIST, TEST_UUID
        )

    exception = exc_info.value
    assert isinstance(exception, DocumentRefException)
    assert exception.status_code == 400
    assert exception.message == "Invalid files or id"

    mock_check_if_upload_is_in_progress_for_previous_records.assert_not_called()

@freeze_time("2023-10-30T10:25:00")
def test_upload_already_in_progress_raises_exception(
    mock_update_doc_ref_service,
    mock_fetch_document,
    mock_get_allowed_list_of_ods_codes_for_upload_pilot,
    mock_getting_patient_info_from_pds,
    mock_pds_patient,
    mock_fhir_doc_ref_base_service,
    mock_process_fhir_document_reference,
    mock_validate_lg_files
):  
    mock_getting_patient_info_from_pds.return_value = mock_pds_patient
    mock_get_allowed_list_of_ods_codes_for_upload_pilot.return_value = [TEST_CURRENT_GP_ODS]
    two_minutes_ago = 1698661380  # 2023-10-30T10:23:00
    mock_records_upload_in_process = create_test_lloyd_george_doc_store_refs(
        override={"uploaded": False, "uploading": True, "last_updated": two_minutes_ago}
    )
    mock_fetch_document.return_value = mock_records_upload_in_process
    with pytest.raises(DocumentRefException) as exc_info:
        mock_update_doc_ref_service.update_document_reference_request(
            TEST_NHS_NUMBER, LG_FILE_LIST, TEST_UUID
        )

    exception = exc_info.value
    assert isinstance(exception, DocumentRefException)
    assert exception.status_code == 423
    assert exception.message == "Records are in the process of being uploaded"
