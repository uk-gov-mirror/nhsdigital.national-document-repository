import json
from datetime import datetime

import pytest
from enums.dynamo_filter import AttributeOperator
from enums.lambda_error import LambdaError
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.snomed_codes import SnomedCodes
from freezegun import freeze_time
from models.document_reference import DocumentReference, UploadRequestDocument
from services.create_document_reference_service import CreateDocumentReferenceService
from services.document_service import DocumentService
from services.fhir_document_reference_service_base import (
    FhirDocumentReferenceServiceBase,
)
from tests.unit.helpers.data.create_document_reference import (
    ARF_FILE_LIST,
    LG_FILE_LIST,
    PARSED_LG_FILE_LIST,
)
from tests.unit.helpers.data.test_documents import (
    create_test_lloyd_george_doc_store_refs,
)
from utils.common_query_filters import NotDeleted
from utils.constants.ssm import UPLOAD_PILOT_ODS_ALLOWED_LIST
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.exceptions import PatientNotFoundException
from utils.lambda_exceptions import DocumentRefException
from utils.lloyd_george_validator import LGInvalidFilesException
from utils.request_context import request_context

from lambdas.enums.supported_document_types import SupportedDocumentTypes
from lambdas.tests.unit.conftest import (
    MOCK_LG_BUCKET,
    MOCK_LG_TABLE_NAME,
    TEST_CURRENT_GP_ODS,
    TEST_NHS_NUMBER,
    TEST_UUID,
)

NA_STRING = "Not Test Important"

MOCK_ALLOWED_ODS_CODES_LIST_PILOT = {
    "Parameter": {
        "Name": UPLOAD_PILOT_ODS_ALLOWED_LIST,
        "Type": "StringList",
        "Value": "PI001,PI002,PI003",
        "Version": 123,
        "Selector": "string",
        "SourceResult": "string",
        "LastModifiedDate": datetime(2015, 1, 1),
        "ARN": "string",
        "DataType": "string",
    },
}


@pytest.fixture
def mock_create_doc_ref_service(set_env, mocker):
    mocker.patch("services.create_document_reference_service.SSMService")
    create_doc_ref_service = CreateDocumentReferenceService()
    yield create_doc_ref_service


@pytest.fixture
def mock_fhir_doc_ref_base_service(mocker, setup_request_context):
    mock_document_service = mocker.patch(
        "services.fhir_document_reference_service_base.DocumentService",
    )
    mock_s3_service = mocker.patch(
        "services.fhir_document_reference_service_base.S3Service",
    )
    mock_dynamo_service = mocker.patch(
        "services.fhir_document_reference_service_base.DynamoDBService",
    )
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
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS},
    }
    yield
    request_context.authorization = {}


@pytest.fixture()
def mock_process_fhir_document_reference(mocker):
    yield mocker.patch(
        "services.post_fhir_document_reference_service.PostFhirDocumentReferenceService.process_fhir_document_reference",
        return_value=json.dumps(
            {
                "content": [
                    {"attachment": {"url": "https://test-bucket.s3.amazonaws.com/"}},
                ],
            },
        ),
    )


@pytest.fixture()
def mock_ssm(mocker, mock_create_doc_ref_service):
    mocker.patch.object(mock_create_doc_ref_service.ssm_service, "get_ssm_parameter")
    yield mock_create_doc_ref_service.ssm_service


@pytest.fixture()
def mock_create_document_reference(mock_create_doc_ref_service, mocker):
    yield mocker.patch.object(mock_create_doc_ref_service, "create_document_reference")


@pytest.fixture()
def mock_remove_records(mock_create_doc_ref_service, mocker):
    yield mocker.patch.object(
        mock_create_doc_ref_service,
        "remove_records_of_failed_upload",
    )


@pytest.fixture()
def mock_check_existing_records_and_remove_failed_upload(
    mock_create_doc_ref_service,
    mocker,
):
    yield mocker.patch.object(
        mock_create_doc_ref_service,
        "check_existing_records_and_remove_failed_upload",
    )


@pytest.fixture()
def mock_check_for_duplicate_files(mocker):
    yield mocker.patch(
        "services.create_document_reference_service.check_for_duplicate_files",
    )


@pytest.fixture()
def mock_getting_patient_info_from_pds(mocker, mock_pds_patient):
    yield mocker.patch(
        "services.create_document_reference_service.getting_patient_info_from_pds",
        return_value=mock_pds_patient,
    )


@pytest.fixture
def mock_fetch_available_document_references_by_type(
    mocker,
    mock_fhir_doc_ref_base_service,
):
    mock = mocker.patch.object(
        mock_fhir_doc_ref_base_service.document_service,
        "fetch_available_document_references_by_type",
    )
    mock.return_value = []
    yield mock


@pytest.fixture
def undo_mocking_for_is_upload_in_process(mock_fhir_doc_ref_base_service):
    mock_fhir_doc_ref_base_service.document_service.is_upload_in_process = (
        DocumentService.is_upload_in_process
    )


@pytest.fixture
def mock_get_allowed_list_of_ods_codes_for_upload_pilot(
    mock_create_doc_ref_service,
    mocker,
):
    return mocker.patch.object(
        mock_create_doc_ref_service.feature_flag_service,
        "get_allowed_list_of_ods_codes_for_upload_pilot",
    )


def test_create_document_reference_request_empty_list(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_create_document_reference,
    mock_process_fhir_document_reference,
    mock_getting_patient_info_from_pds,
    setup_request_context,
):
    with pytest.raises(DocumentRefException) as e:
        mock_create_doc_ref_service.create_document_reference_request(
            TEST_NHS_NUMBER,
            [],
        )

    assert e.value == DocumentRefException(400, LambdaError.DocRefInvalidFiles)
    mock_create_document_reference.assert_not_called()
    mock_process_fhir_document_reference.assert_not_called()


def test_create_document_reference_request_with_lg_list_happy_path(
    mocker,
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_process_fhir_document_reference,
    mock_getting_patient_info_from_pds,
    mock_get_allowed_list_of_ods_codes_for_upload_pilot,
    mock_check_existing_records_and_remove_failed_upload,
    mock_fetch_available_document_references_by_type,
    mock_check_for_duplicate_files,
):
    mock_get_allowed_list_of_ods_codes_for_upload_pilot.return_value = [
        TEST_CURRENT_GP_ODS,
    ]
    mock_presigned_url_response = "https://test-bucket.s3.amazonaws.com/"

    url_references = mock_create_doc_ref_service.create_document_reference_request(
        TEST_NHS_NUMBER,
        LG_FILE_LIST,
    )
    expected_response = {
        "uuid1": mock_presigned_url_response,
        "uuid2": mock_presigned_url_response,
        "uuid3": mock_presigned_url_response,
    }
    assert url_references == expected_response

    mock_check_existing_records_and_remove_failed_upload.assert_called_with(
        TEST_NHS_NUMBER,
        LG_FILE_LIST[0]["docType"],
    )
    mock_check_for_duplicate_files.assert_called_once()


def test_create_document_reference_request_raise_error_when_invalid_lg(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mocker,
    mock_process_fhir_document_reference,
    mock_create_document_reference,
    mock_check_for_duplicate_files,
    mock_getting_patient_info_from_pds,
    mock_get_allowed_list_of_ods_codes_for_upload_pilot,
    mock_check_existing_records_and_remove_failed_upload,
):
    document_references = []
    side_effects = []

    for (
        index,
        file,
    ) in enumerate(LG_FILE_LIST):
        document_references.append(
            DocumentReference(
                nhs_number=TEST_NHS_NUMBER,
                s3_bucket_name=NA_STRING,
                id=NA_STRING,
                content_type=NA_STRING,
                file_name=file["fileName"],
                doc_type=SupportedDocumentTypes.LG,
                document_snomed_code_type=SnomedCodes.LLOYD_GEORGE.value.code,
            ),
        )
        side_effects.append(document_references[index])

    mock_create_document_reference.side_effect = side_effects
    mock_check_for_duplicate_files.side_effect = LGInvalidFilesException("test")
    mock_get_allowed_list_of_ods_codes_for_upload_pilot.return_value = [
        TEST_CURRENT_GP_ODS,
    ]

    with pytest.raises(DocumentRefException):
        mock_create_doc_ref_service.create_document_reference_request(
            TEST_NHS_NUMBER,
            LG_FILE_LIST,
        )

    mock_create_document_reference.assert_has_calls(
        [
            mocker.call(
                TEST_NHS_NUMBER,
                TEST_CURRENT_GP_ODS,
                validated_doc,
                SnomedCodes.LLOYD_GEORGE.value.code,
            )
            for validated_doc in PARSED_LG_FILE_LIST
        ],
        any_order=True,
    )


def test_create_document_reference_failed_to_parse_pds_response(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_create_document_reference,
    mock_getting_patient_info_from_pds,
    mock_fetch_available_document_references_by_type,
):
    mock_getting_patient_info_from_pds.side_effect = LGInvalidFilesException

    with pytest.raises(Exception) as exc_info:
        mock_create_doc_ref_service.create_document_reference_request(
            TEST_NHS_NUMBER,
            LG_FILE_LIST,
        )

    exception = exc_info.value
    assert isinstance(exception, DocumentRefException)
    assert exception.status_code == 400
    assert exception.message == "Invalid files or id"

    mock_create_document_reference.assert_not_called()


def test_cdr_nhs_number_not_found_raises_search_patient_exception(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_create_document_reference,
    mock_getting_patient_info_from_pds,
    mock_fetch_available_document_references_by_type,
):
    mock_getting_patient_info_from_pds.side_effect = PatientNotFoundException

    with pytest.raises(Exception) as exc_info:
        mock_create_doc_ref_service.create_document_reference_request(
            TEST_NHS_NUMBER,
            LG_FILE_LIST,
        )

    exception = exc_info.value
    assert isinstance(exception, DocumentRefException)
    assert exception.status_code == 404
    assert exception.message == "Patient does not exist for given NHS number"

    mock_create_document_reference.assert_not_called()


def test_cdr_non_pdf_file_raises_exception(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_process_fhir_document_reference,
    mock_check_for_duplicate_files,
    mock_getting_patient_info_from_pds,
    mock_get_allowed_list_of_ods_codes_for_upload_pilot,
    mock_check_existing_records_and_remove_failed_upload,
):
    mock_check_for_duplicate_files.side_effect = LGInvalidFilesException
    mock_get_allowed_list_of_ods_codes_for_upload_pilot.return_value = [
        TEST_CURRENT_GP_ODS,
    ]

    with pytest.raises(Exception) as exc_info:
        mock_create_doc_ref_service.create_document_reference_request(
            TEST_NHS_NUMBER,
            LG_FILE_LIST,
        )

    exception = exc_info.value
    assert isinstance(exception, DocumentRefException)
    assert exception.status_code == 400
    assert exception.message == "Invalid files or id"


@freeze_time("2023-10-30T10:25:00")
def test_create_document_reference_request_lg_upload_throw_lambda_error_if_upload_in_progress(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_process_fhir_document_reference,
    mock_getting_patient_info_from_pds,
    mock_check_for_duplicate_files,
    mock_fetch_available_document_references_by_type,
    mock_get_allowed_list_of_ods_codes_for_upload_pilot,
):
    two_minutes_ago = 1698661380  # 2023-10-30T10:23:00
    mock_records_upload_in_process = create_test_lloyd_george_doc_store_refs(
        override={
            "uploaded": False,
            "uploading": True,
            "last_updated": two_minutes_ago,
        },
    )
    mock_fetch_available_document_references_by_type.return_value = (
        mock_records_upload_in_process
    )
    mock_get_allowed_list_of_ods_codes_for_upload_pilot.return_value = [
        TEST_CURRENT_GP_ODS,
    ]

    with pytest.raises(DocumentRefException) as e:
        mock_create_doc_ref_service.create_document_reference_request(
            TEST_NHS_NUMBER,
            LG_FILE_LIST,
        )
    assert e.value == DocumentRefException(423, LambdaError.UploadInProgressError)


def test_create_document_reference_request_lg_upload_throw_lambda_error_if_got_a_full_set_of_uploaded_record(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_process_fhir_document_reference,
    mock_getting_patient_info_from_pds,
    mock_check_for_duplicate_files,
    mock_fetch_available_document_references_by_type,
    mock_get_allowed_list_of_ods_codes_for_upload_pilot,
):
    mock_fetch_available_document_references_by_type.return_value = (
        create_test_lloyd_george_doc_store_refs()
    )
    mock_get_allowed_list_of_ods_codes_for_upload_pilot.return_value = [
        TEST_CURRENT_GP_ODS,
    ]

    with pytest.raises(DocumentRefException) as e:
        mock_create_doc_ref_service.create_document_reference_request(
            TEST_NHS_NUMBER,
            LG_FILE_LIST,
        )

    assert e.value == DocumentRefException(422, LambdaError.DocRefRecordAlreadyInPlace)


def test_check_existing_records_remove_previous_failed_upload_and_continue(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_fetch_available_document_references_by_type,
    mock_remove_records,
    mocker,
):
    mock_doc_refs_of_failed_upload = create_test_lloyd_george_doc_store_refs(
        override={"uploaded": False},
    )
    mock_fetch_available_document_references_by_type.return_value = (
        mock_doc_refs_of_failed_upload
    )
    mock_create_doc_ref_service.stop_if_all_records_uploaded = mocker.MagicMock()
    mock_create_doc_ref_service.stop_if_upload_is_in_process = mocker.MagicMock()

    mock_create_doc_ref_service.check_existing_records_and_remove_failed_upload(
        TEST_NHS_NUMBER,
        mock_doc_refs_of_failed_upload[0].document_snomed_code_type,
    )
    mock_remove_records.assert_called_with(
        MOCK_LG_TABLE_NAME,
        mock_doc_refs_of_failed_upload,
    )


def test_parse_documents_list_for_valid_input(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
):
    mock_input = LG_FILE_LIST
    expected = PARSED_LG_FILE_LIST

    actual = mock_create_doc_ref_service.parse_documents_list(mock_input)

    assert actual == expected


def test_parse_documents_list_raise_lambda_error_when_no_type(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
):
    mock_input_no_file_type = [
        {
            "fileName": "test1.txt",
            "contentType": "text/plain",
        },
    ]

    with pytest.raises(DocumentRefException):
        mock_create_doc_ref_service.parse_documents_list(mock_input_no_file_type)


def test_parse_documents_list_raise_lambda_error_when_doc_type_is_invalid(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
):
    mock_input_wrong_doc_type = [
        {
            "fileName": "test1.txt",
            "contentType": "text/plain",
            "docType": "banana",
        },
    ]

    with pytest.raises(DocumentRefException):
        mock_create_doc_ref_service.parse_documents_list(mock_input_wrong_doc_type)


def test_prepare_doc_object_lg_happy_path(
    mocker,
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
):
    validated_document = UploadRequestDocument.model_validate(LG_FILE_LIST[0])
    nhs_number = "1234567890"
    reference_id = 12341234
    current_gp_ods = TEST_CURRENT_GP_ODS

    mocker.patch(
        "services.create_document_reference_service.create_reference_id",
        return_value=reference_id,
    )
    mocked_doc = mocker.MagicMock()
    nhs_doc_class = mocker.patch(
        "services.create_document_reference_service.DocumentReference",
        return_value=mocked_doc,
    )

    actual_document_reference = mock_create_doc_ref_service.create_document_reference(
        nhs_number,
        current_gp_ods,
        validated_document,
        snomed_code_type="SNOMED",
    )

    assert actual_document_reference == mocked_doc
    nhs_doc_class.assert_called_with(
        nhs_number=nhs_number,
        current_gp_ods=current_gp_ods,
        s3_bucket_name=mock_create_doc_ref_service.staging_bucket_name,
        sub_folder=mock_create_doc_ref_service.upload_sub_folder,
        id=reference_id,
        content_type="application/pdf",
        file_name="1of3_Lloyd_George_Record_[Joe Bloggs]_[9000000009]_[25-12-2019].pdf",
        doc_type=SupportedDocumentTypes.LG.value,
        uploading=True,
        document_snomed_code_type="SNOMED",
        author=TEST_CURRENT_GP_ODS,
        custodian=TEST_CURRENT_GP_ODS,
        doc_status="preliminary",
    )


def test_check_existing_records_does_nothing_if_no_record_exist(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_fetch_available_document_references_by_type,
    mock_remove_records,
    mocker,
):
    mock_fetch_available_document_references_by_type.return_value = []

    assert (
        mock_create_doc_ref_service.check_existing_records_and_remove_failed_upload(
            TEST_NHS_NUMBER,
            SupportedDocumentTypes.LG,
        )
        is None
    )
    mock_remove_records.assert_not_called()


@freeze_time("2023-10-30T10:25:00")
def test_check_existing_records_throw_error_if_upload_in_progress(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_fetch_available_document_references_by_type,
    mock_remove_records,
):
    two_minutes_ago = 1698661380  # 2023-10-30T10:23:00
    mock_fetch_available_document_references_by_type.return_value = (
        create_test_lloyd_george_doc_store_refs(
            override={
                "uploaded": False,
                "uploading": True,
                "last_updated": two_minutes_ago,
            },
        )
    )

    with pytest.raises(Exception) as e:
        mock_create_doc_ref_service.check_existing_records_and_remove_failed_upload(
            TEST_NHS_NUMBER,
            SupportedDocumentTypes.LG,
        )
    ex = e.value
    assert isinstance(ex, DocumentRefException)
    assert ex.status_code == 423
    assert ex.message == "Records are in the process of being uploaded"

    mock_remove_records.assert_not_called()


def test_check_existing_records_throw_error_if_got_a_full_set_of_uploaded_record(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_fetch_available_document_references_by_type,
    mock_remove_records,
):
    mock_fetch_available_document_references_by_type.return_value = (
        create_test_lloyd_george_doc_store_refs()
    )

    with pytest.raises(Exception) as e:
        mock_create_doc_ref_service.check_existing_records_and_remove_failed_upload(
            TEST_NHS_NUMBER,
            SupportedDocumentTypes.LG,
        )

    ex = e.value
    assert isinstance(ex, DocumentRefException)
    assert ex.status_code == 422
    assert ex.message == "The patient already has a full set of record."

    mock_remove_records.assert_not_called()


def test_remove_records_of_failed_upload(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mocker,
):
    mock_doc_refs_of_failed_upload = create_test_lloyd_george_doc_store_refs(
        override={"uploaded": False},
    )

    mock_create_doc_ref_service.post_fhir_doc_ref_service.s3_service = (
        mocker.MagicMock()
    )

    mock_create_doc_ref_service.remove_records_of_failed_upload(
        table_name=MOCK_LG_TABLE_NAME,
        failed_upload_records=mock_doc_refs_of_failed_upload,
    )
    file_keys = [record.s3_file_key for record in mock_doc_refs_of_failed_upload]

    mock_create_doc_ref_service.post_fhir_doc_ref_service.s3_service.delete_object.assert_has_calls(
        [mocker.call(MOCK_LG_BUCKET, file_key) for file_key in file_keys],
        any_order=True,
    )
    mock_fhir_doc_ref_base_service.document_service.hard_delete_metadata_records.assert_called_with(
        table_name=MOCK_LG_TABLE_NAME,
        document_references=mock_doc_refs_of_failed_upload,
    )


def test_ods_code_not_in_pilot_raises_exception(
    mocker,
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_create_document_reference,
    mock_get_allowed_list_of_ods_codes_for_upload_pilot,
    mock_fetch_available_document_references_by_type,
    mock_getting_patient_info_from_pds,
):
    mock_get_allowed_list_of_ods_codes_for_upload_pilot.return_value = ["PI001"]

    with pytest.raises(DocumentRefException) as exc_info:
        mock_create_doc_ref_service.create_document_reference_request(
            TEST_NHS_NUMBER,
            LG_FILE_LIST,
        )

    mock_create_document_reference.assert_not_called()

    exception = exc_info.value
    assert isinstance(exception, DocumentRefException)
    assert exception.status_code == 404
    assert exception.message == "ODS code does not match any of the allowed."


def test_patient_ods_does_not_match_user_ods_and_raises_exception(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_create_document_reference,
    mock_check_existing_records_and_remove_failed_upload,
):

    with pytest.raises(DocumentRefException) as exc_info:
        mock_create_doc_ref_service.create_document_reference_request(
            TEST_NHS_NUMBER,
            LG_FILE_LIST,
        )

    mock_create_document_reference.assert_not_called()

    exception = exc_info.value
    assert isinstance(exception, DocumentRefException)
    assert exception.status_code == 401
    assert (
        exception.message
        == "The user is not authorised to upload documents for this patient"
    )


def test_unable_to_find_config_raises_exception(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_check_existing_records_and_remove_failed_upload,
    mock_getting_patient_info_from_pds,
    mock_get_allowed_list_of_ods_codes_for_upload_pilot,
    mock_process_fhir_document_reference,
):
    mock_get_allowed_list_of_ods_codes_for_upload_pilot.return_value = [
        TEST_CURRENT_GP_ODS,
    ]

    with pytest.raises(DocumentRefException) as exc_info:
        mock_create_doc_ref_service.create_document_reference_request(
            TEST_NHS_NUMBER,
            ARF_FILE_LIST,
        )

    exception = exc_info.value
    assert isinstance(exception, DocumentRefException)
    assert exception.status_code == 400
    assert exception.message == "Invalid files or id"

    mock_process_fhir_document_reference.assert_not_called()


def test_check_existing_records_fetches_previous_records_for_doc_type(
    mock_fhir_doc_ref_base_service,
    mock_create_doc_ref_service,
    mock_fetch_available_document_references_by_type,
    mock_remove_records,
    mocker,
):
    doc_type = SupportedDocumentTypes.LG

    expected_query_filter = (
        NotDeleted
        & DynamoQueryFilterBuilder()
        .add_condition(
            DocumentReferenceMetadataFields.DOCUMENT_SNOMED_CODE_TYPE,
            AttributeOperator.EQUAL,
            doc_type,
        )
        .add_condition(
            DocumentReferenceMetadataFields.DOC_STATUS,
            AttributeOperator.EQUAL,
            "final",
        )
        .build()
    )
    mocker.patch(
        "services.create_document_reference_service.get_document_type_filter",
    ).return_value = expected_query_filter

    mock_create_doc_ref_service.check_existing_records_and_remove_failed_upload(
        TEST_NHS_NUMBER,
        doc_type,
    )

    mock_fetch_available_document_references_by_type.assert_called_with(
        nhs_number=TEST_NHS_NUMBER,
        doc_type=doc_type,
        query_filter=expected_query_filter,
    )
