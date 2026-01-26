import json
import os
import time
import uuid
from datetime import datetime, timezone

from enums.death_notification_status import DeathNotificationStatus
from enums.document_review_reason import DocumentReviewReason
from enums.document_review_status import DocumentReviewStatus
from enums.mns_notification_types import MNSNotificationTypes
from enums.snomed_codes import SnomedCodes
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service
from services.base.sqs_service import SQSService

AWS_WORKSPACE = os.environ.get("AWS_WORKSPACE", "")
LLOYD_GEORGE_TABLE = f"{AWS_WORKSPACE}_LloydGeorgeReferenceMetadata"
DOCUMENT_REVIEW_TABLE = f"{AWS_WORKSPACE}_DocumentUploadReview"
PENDING_REVIEW_S3_BUCKET = f"{AWS_WORKSPACE}-pending-review-bucket"
TEST_NHS_NUMBER = "9730154198"
TEST_NHS_NUMBER_DEATH = "9730135967"
TEST_ORIGINAL_ODS = "Y12345"
TEST_NEW_ODS = "H81109"
MOCK_TIME = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


class MNSTestHelper:
    def __init__(self):
        self.dynamo_service = DynamoDBService()
        self.s3_service = S3Service()
        self.sqs_service = SQSService()
        self.mns_queue_url = self.get_mns_queue_url(AWS_WORKSPACE)

    def get_mns_queue_url(self, workspace: str) -> str:
        queue_name = f"{workspace}-mns-notification-queue"
        response = self.sqs_service.client.get_queue_url(QueueName=queue_name)
        return response["QueueUrl"]

    def create_lloyd_george_record(self, nhs_number: str, ods_code: str) -> dict:
        record_id = str(uuid.uuid4())
        dynamo_item = {
            "ID": record_id,
            "NhsNumber": nhs_number,
            "ContentType": "application/pdf",
            "Created": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "CurrentGpOds": ods_code,
            "Custodian": ods_code,
            "DocStatus": "final",
            "DocumentScanCreation": "2023-01-01",
            "DocumentSnomedCodeType": SnomedCodes.LLOYD_GEORGE.value.code,
            "FileLocation": f"s3://{AWS_WORKSPACE}-lloyd-george-store/{nhs_number}/{record_id}",
            "FileName": f"1of1_Lloyd_George_Record_[Test Patient]_[{nhs_number}]_[01-01-2000].pdf",
            "FileSize": "12345",
            "LastUpdated": int(time.time()),
            "Status": "current",
            "Uploaded": True,
            "Uploading": False,
            "Version": "1",
            "VirusScannerResult": "Clean",
        }
        self.dynamo_service.create_item(LLOYD_GEORGE_TABLE, dynamo_item)
        return {"id": record_id, "nhs_number": nhs_number, "ods": ods_code}

    def create_document_review_record(
        self,
        nhs_number: str,
        ods_code: str,
        review_status: DocumentReviewStatus = DocumentReviewStatus.PENDING_REVIEW,
    ) -> dict:
        record_id = str(uuid.uuid4())
        file_location = (
            f"s3://{PENDING_REVIEW_S3_BUCKET}/{nhs_number}/{record_id}/test.pdf"
        )

        dynamo_item = {
            "ID": record_id,
            "NhsNumber": nhs_number,
            "Author": ods_code,
            "Custodian": ods_code,
            "ReviewStatus": review_status,
            "ReviewReason": DocumentReviewReason.NEW_DOCUMENT,
            "UploadDate": int(time.time()),
            "Files": [
                {
                    "FileName": "test.pdf",
                    "FileLocation": file_location,
                }
            ],
            "Version": 1,
            "DocumentSnomedCodeType": SnomedCodes.LLOYD_GEORGE.value.code,
        }
        self.dynamo_service.create_item(DOCUMENT_REVIEW_TABLE, dynamo_item)
        return {"id": record_id, "nhs_number": nhs_number, "ods": ods_code}

    def send_gp_change_message(self, nhs_number: str) -> str:
        message_id = str(uuid.uuid4())
        message_body = {
            "id": message_id,
            "type": MNSNotificationTypes.CHANGE_OF_GP.value,
            "subject": {
                "nhsNumber": nhs_number,
                "familyName": "TESTPATIENT",
                "dob": "2000-01-01",
            },
            "source": {
                "name": "https://test.example.com",
                "identifiers": {
                    "system": "https://test.example.com",
                    "value": str(uuid.uuid4()),
                },
            },
            "time": MOCK_TIME,
            "data": {
                "fullUrl": "https://test.example.com/Patient/123",
                "versionId": str(uuid.uuid4()),
                "provenance": {
                    "name": "Test GP Practice",
                    "identifiers": {
                        "system": "https://test.example.com",
                        "value": str(uuid.uuid4()),
                    },
                },
                "registrationEncounterCode": "00",
            },
        }

        self.sqs_service.send_message_standard(
            queue_url=self.mns_queue_url, message_body=json.dumps(message_body)
        )
        return message_id

    def send_death_notification_message(
        self, nhs_number: str, death_status: DeathNotificationStatus
    ) -> str:
        message_id = str(uuid.uuid4())
        message_body = {
            "id": message_id,
            "type": MNSNotificationTypes.DEATH_NOTIFICATION.value,
            "subject": {
                "nhsNumber": nhs_number,
                "familyName": "TESTPATIENT",
                "dob": "2000-01-01",
            },
            "source": {
                "name": "NHS DIGITAL",
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/nhsSpineASID",
                    "value": "477121000324",
                },
            },
            "time": MOCK_TIME,
            "data": {
                "versionId": 'W/"16"',
                "fullUrl": f"https://int.api.service.nhs.uk/personal-demographics/FHIR/R4/Patient/{nhs_number}",
                "deathNotificationStatus": death_status.value,
                "provenance": {
                    "name": "The GP Practice",
                    "identifiers": {
                        "system": "https://fhir.nhs.uk/Id/nhsSpineASID",
                        "value": "477121000323",
                    },
                },
            },
        }

        self.sqs_service.send_message_standard(
            queue_url=self.mns_queue_url, message_body=json.dumps(message_body)
        )
        return message_id

    def get_lloyd_george_record(self, record_id: str) -> dict:
        return self.dynamo_service.get_item(
            table_name=LLOYD_GEORGE_TABLE, key={"ID": record_id}
        ).get("Item")

    def get_document_review_record(self, record_id: str, version: int = 1) -> dict:
        return self.dynamo_service.get_item(
            table_name=DOCUMENT_REVIEW_TABLE, key={"ID": record_id, "Version": version}
        ).get("Item")

    def get_all_document_review_versions(self, record_id: str) -> list[dict]:
        response = self.dynamo_service.query_table_single(
            table_name=DOCUMENT_REVIEW_TABLE,
            search_key="ID",
            search_condition=record_id,
        )
        return response.get("Items", [])

    def cleanup_lloyd_george_record(self, record_id: str):
        try:
            self.dynamo_service.delete_item(
                table_name=LLOYD_GEORGE_TABLE, key={"ID": record_id}
            )
        except Exception as e:
            print(f"Error cleaning up Lloyd George record {record_id}: {e}")

    def cleanup_document_review_record(self, record_id: str, version: int = 1):
        try:
            records = self.get_all_document_review_versions(record_id)
            for record in records:
                self.dynamo_service.delete_item(
                    table_name=DOCUMENT_REVIEW_TABLE,
                    key={"ID": record_id, "Version": record["Version"]},
                )
        except Exception as e:
            print(f"Error cleaning up document review record {record_id}: {e}")

    def wait_for_update(self, check_func, max_retries=5, delay=10):
        for i in range(max_retries):
            if check_func():
                return True
            time.sleep(delay)
        return False
