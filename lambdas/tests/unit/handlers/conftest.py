import json

import pytest

from enums.feature_flags import FeatureFlags
from enums.report_distribution_action import ReportDistributionAction
from models.pds_models import PatientDetails
from repositories.reporting.reporting_dynamo_repository import ReportingDynamoRepository
from services.feature_flags_service import FeatureFlagService
from tests.unit.conftest import (
    MOCK_CREATOR_ID,
    MOCK_SMART_CARD_ID,
    TEST_CURRENT_GP_ODS,
    TEST_NHS_NUMBER,
)


@pytest.fixture
def valid_id_event_without_auth_header():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {"patientId": "9000000009"},
        "headers": {},
    }
    return api_gateway_proxy_event


@pytest.fixture
def valid_id_event_with_auth_header():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {"patientId": "9000000009"},
        "headers": {"Authorization": "mock_token"},
    }
    return api_gateway_proxy_event


@pytest.fixture
def valid_id_post_event_with_auth_header():
    api_gateway_proxy_event = {
        "httpMethod": "POST",
        "queryStringParameters": {"patientId": "9000000009"},
        "headers": {"Authorization": "mock_token"},
    }
    return api_gateway_proxy_event


@pytest.fixture
def valid_id_and_both_doctype_event():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {
            "patientId": "9000000009",
            "docType": "16521000000101,ARF",
        },
    }
    return api_gateway_proxy_event


@pytest.fixture
def valid_id_and_arf_doctype_event():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {"patientId": "9000000009", "docType": "ARF"},
    }
    return api_gateway_proxy_event


@pytest.fixture
def valid_id_and_lg_doctype_event():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {
            "patientId": "9000000009",
            "docType": "16521000000101",
        },
    }
    return api_gateway_proxy_event


@pytest.fixture
def valid_id_and_lg_doctype_delete_event():
    api_gateway_proxy_event = {
        "httpMethod": "DELETE",
        "queryStringParameters": {
            "patientId": "9000000009",
            "docType": "16521000000101",
        },
    }
    return api_gateway_proxy_event


@pytest.fixture
def valid_id_and_invalid_doctype_event():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {"patientId": "9000000009", "docType": "MANGO"},
    }
    return api_gateway_proxy_event


@pytest.fixture
def invalid_id_event():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {"patientId": "900000000900"},
    }
    return api_gateway_proxy_event


@pytest.fixture
def missing_id_event():
    api_gateway_proxy_event = {
        "httpMethod": "GET",
        "queryStringParameters": {"invalid": ""},
    }
    return api_gateway_proxy_event


@pytest.fixture
def mock_upload_lambda_enabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_upload_lambda_feature_flag = mock_function.return_value = {
        "uploadLambdaEnabled": True,
    }
    yield mock_upload_lambda_feature_flag


@pytest.fixture
def mock_upload_lambda_disabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_upload_lambda_feature_flag = mock_function.return_value = {
        "uploadLambdaEnabled": False,
    }
    yield mock_upload_lambda_feature_flag


@pytest.fixture
def mock_upload_document_iteration2_enabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_function.side_effect = [
        {"uploadLambdaEnabled": True},
        {"uploadDocumentIteration2Enabled": True},
    ]
    yield mock_function


@pytest.fixture
def mock_upload_document_iteration2_disabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_function.side_effect = [
        {"uploadLambdaEnabled": True},
        {"uploadDocumentIteration2Enabled": False},
    ]
    yield mock_function


@pytest.fixture
def mock_upload_document_iteration3_enabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_function.side_effect = [
        {"uploadLambdaEnabled": True},
        {"uploadDocumentIteration3Enabled": True},
    ]
    yield mock_function


@pytest.fixture
def mock_upload_document_iteration3_disabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_function.side_effect = [
        {"uploadLambdaEnabled": True},
        {"uploadDocumentIteration3Enabled": False},
    ]
    yield mock_function


@pytest.fixture
def mock_validation_strict_and_bulk_upload_send_to_review_disabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_upload_lambda_feature_flag = mock_function.return_value = {
        "lloydGeorgeValidationStrictModeEnabled": False,
        "bulkUploadSendToReviewEnabled": False,
    }
    yield mock_upload_lambda_feature_flag


@pytest.fixture
def mock_validation_strict_and_bulk_upload_send_to_review_enabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_upload_lambda_feature_flag = mock_function.return_value = {
        "lloydGeorgeValidationStrictModeEnabled": True,
        "bulkUploadSendToReviewEnabled": True,
    }
    yield mock_upload_lambda_feature_flag


@pytest.fixture
def mock_validation_strict_enabled_send_to_review_disabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_upload_lambda_feature_flag = mock_function.return_value = {
        "lloydGeorgeValidationStrictModeEnabled": True,
        "bulkUploadSendToReviewEnabled": False,
    }
    yield mock_upload_lambda_feature_flag


@pytest.fixture
def mock_validation_strict_disabled_send_to_review_enabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_upload_lambda_feature_flag = mock_function.return_value = {
        "lloydGeorgeValidationStrictModeEnabled": False,
        "bulkUploadSendToReviewEnabled": True,
    }
    yield mock_upload_lambda_feature_flag


@pytest.fixture
def mock_upload_document_iteration_3_enabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_feature_flag = mock_function.return_value = {
        FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED: True,
    }
    yield mock_feature_flag


@pytest.fixture
def mock_upload_document_iteration_3_disabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_feature_flag = mock_function.return_value = {
        FeatureFlags.UPLOAD_DOCUMENT_ITERATION_3_ENABLED: False,
    }
    yield mock_feature_flag


@pytest.fixture
def required_report_distribution_env(monkeypatch):
    monkeypatch.setenv("REPORT_BUCKET_NAME", "my-report-bucket")
    monkeypatch.setenv("CONTACT_TABLE_NAME", "contact-table")
    monkeypatch.setenv("PRM_MAILBOX_EMAIL", "prm@example.com")
    monkeypatch.setenv("SES_FROM_ADDRESS", "from@example.com")
    monkeypatch.setenv("SES_CONFIGURATION_SET", "my-config-set")


@pytest.fixture
def lambda_context(mocker):
    ctx = mocker.Mock()
    ctx.aws_request_id = "req-123"
    return ctx


@pytest.fixture
def required_report_orchestration_env(monkeypatch):
    monkeypatch.setenv("BULK_UPLOAD_REPORT_TABLE_NAME", "TestTable")
    monkeypatch.setenv("REPORT_BUCKET_NAME", "test-report-bucket")


@pytest.fixture
def mock_reporting_dynamo_service(mocker):
    mock_cls = mocker.patch(
        "repositories.reporting.reporting_dynamo_repository.DynamoDBService",
    )
    return mock_cls.return_value


@pytest.fixture
def reporting_repo(monkeypatch, mock_reporting_dynamo_service):
    monkeypatch.setenv("BULK_UPLOAD_REPORT_TABLE_NAME", "TestTable")
    return ReportingDynamoRepository()


@pytest.fixture
def report_distribution_list_event():
    return {"action": ReportDistributionAction.LIST, "prefix": "p/"}


@pytest.fixture
def report_distribution_process_one_event():
    return {
        "action": ReportDistributionAction.PROCESS_ONE,
        "key": "reports/ABC/whatever.xlsx",
    }


@pytest.fixture
def mock_report_distribution_wiring(mocker):
    svc_instance = mocker.Mock(name="ReportDistributionServiceInstance")
    mocker.patch(
        "handlers.report_distribution_handler.ReportDistributionService",
        autospec=True,
        return_value=svc_instance,
    )
    return svc_instance


@pytest.fixture
def mock_report_orchestration_wiring(mocker):
    from handlers import report_orchestration_handler as handler_module

    orchestration_service = mocker.Mock(name="ReportOrchestrationServiceInstance")
    s3_service = mocker.Mock(name="S3ServiceInstance")

    mocker.patch.object(
        handler_module,
        "ReportOrchestrationService",
        autospec=True,
        return_value=orchestration_service,
    )
    mocker.patch.object(
        handler_module,
        "S3Service",
        autospec=True,
        return_value=s3_service,
    )

    mock_window = mocker.patch.object(
        handler_module,
        "calculate_reporting_window",
        return_value=(100, 200),
    )
    mock_report_date = mocker.patch.object(
        handler_module,
        "get_report_date_folder",
        return_value="2026-01-02",
    )

    return {
        "handler_module": handler_module,
        "orchestration_service": orchestration_service,
        "s3_service": s3_service,
        "mock_window": mock_window,
        "mock_report_date": mock_report_date,
    }


@pytest.fixture
def mock_user_restriction_enabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_feature_flag = mock_function.return_value = {
        FeatureFlags.USER_RESTRICTION_ENABLED: True,
        FeatureFlags.USE_SMARTCARD_AUTH: False,
    }
    yield mock_feature_flag


@pytest.fixture
def mock_user_restriction_disabled(mocker):
    mock_function = mocker.patch.object(FeatureFlagService, "get_feature_flags_by_flag")
    mock_feature_flag = mock_function.return_value = {
        FeatureFlags.USER_RESTRICTION_ENABLED: False,
    }
    yield mock_feature_flag


@pytest.fixture
def valid_create_restriction_event():
    yield {
        "httpMethod": "POST",
        "headers": {"Authorization": "test_token"},
        "queryStringParameters": {"patientId": TEST_NHS_NUMBER},
        "body": json.dumps(
            {"smartcardId": MOCK_SMART_CARD_ID, "nhsNumber": TEST_NHS_NUMBER},
        ),
    }


@pytest.fixture
def mock_request_context(mocker):
    mock_context = mocker.patch("utils.ods_utils.request_context")
    mock_context.authorization = {
        "nhs_user_id": MOCK_CREATOR_ID,
        "selected_organisation": {"org_ods_code": TEST_CURRENT_GP_ODS},
    }
    yield mock_context


@pytest.fixture
def mock_pds_service_with_matching_ods(mocker):
    """
    Mock PDS service to return patient with ODS code matching TEST_CURRENT_GP_ODS.
    Use this fixture in tests that need ODS validation to pass.
    """
    mock_patient_details = PatientDetails(
        nhsNumber=TEST_NHS_NUMBER,
        givenName=["Jane"],
        familyName="Smith",
        birthDate="2010-10-22",
        postalCode="LS1 6AE",
        superseded=False,
        restricted=False,
        generalPracticeOds=TEST_CURRENT_GP_ODS,  # Y12345 - matches request context
        active=True,
    )
    mock_service = mocker.patch(
        "services.user_restrictions.create_user_restriction_service.get_pds_service",
    )
    mock_service.return_value.fetch_patient_details.return_value = mock_patient_details
    yield mock_service
