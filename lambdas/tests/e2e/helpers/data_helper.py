import datetime
import io
import json
import os
import uuid

import boto3

from enums.snomed_codes import SnomedCodes
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service

TEST_NHS_NUMBER = "9730136912"


class DataHelper:
    def __init__(
        self,
        table_name: str,
        bucket_name: str,
        snomed_code: str,
        record_type: str,
    ):
        self.workspace = os.environ.get("AWS_WORKSPACE", "")
        self.dynamo_table = None
        self.s3_bucket = None
        self.snomed_code = snomed_code
        self.record_type = record_type
        self.dynamo_service = DynamoDBService()
        self.s3_service = S3Service()
        self.apim_url = None
        self.api_endpoint = None
        self.mtls_endpoint = None

        self.build_env(table_name, bucket_name)

    def build_env(self, table_name, bucket_name):
        if not self.workspace:
            raise ValueError("AWS_WORKSPACE environment variable is missing or empty.")
        self.dynamo_table = f"{self.workspace}_{table_name}"
        self.s3_bucket = f"{self.workspace}-{bucket_name}"

        apim_map = {
            "pre-prod": "int.api.service.nhs.uk",
            "ndr-test": "internal-qa.api.service.nhs.uk",
            "ndr-dev": "internal-dev.api.service.nhs.uk",
        }
        self.apim_url = apim_map.get(
            str(self.workspace),
            "internal-dev.api.service.nhs.uk",
        )

        domain = (
            "national-document-repository.nhs.uk"
            if self.workspace == "pre-prod"
            else "access-request-fulfilment.patient-deductions.nhs.uk"
        )

        self.api_endpoint = (
            f"api.{self.workspace}.{domain}"
            if self.workspace in {"pre-prod", "ndr-test"}
            else f"api-{self.workspace}.{domain}"
        )

        self.mtls_endpoint = f"mtls.{self.workspace}.{domain}"

    def build_record(
        self,
        nhs_number=TEST_NHS_NUMBER,
        data=None,
        doc_status=None,
        size=None,
        ods: str = "H81109",
    ):
        record = {
            "id": str(uuid.uuid4()),
            "nhs_number": nhs_number,
            "ods": ods,
            "data": data or io.BytesIO(b"Sample PDF Content"),
        }
        if doc_status:
            record["doc_status"] = doc_status
        if size:
            record["size"] = size
        return record

    def create_metadata(self, document_details, **extra_attributes):
        dynamo_item = {
            "ID": document_details["id"],
            "ContentType": "application/pdf",
            "Created": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "CurrentGpOds": document_details.get("ods", "H81109"),
            "Custodian": document_details.get("ods", "H81109"),
            "DocStatus": document_details.get("doc_status", "final"),
            "DocumentScanCreation": "2023-01-01",
            "DocumentSnomedCodeType": self.snomed_code,
            "FileLocation": f"s3://{self.s3_bucket}/{document_details['nhs_number']}/{document_details['id']}",
            "FileName": f"1of1_{self.record_type}_[Holly Lorna MAGAN]_[{document_details['nhs_number']}]_[29-05-2006].pdf",
            "FileSize": document_details.get("size", "12345"),
            "LastUpdated": 1743177202,
            "NhsNumber": document_details["nhs_number"],
            "Status": "current",
            "Uploaded": True,
            "Uploading": False,
            "Version": "1",
            "S3VersionID": "some-version-id",
            "VirusScannerResult": "Clean",
        }
        dynamo_item.update(extra_attributes)
        self.dynamo_service.create_item(self.dynamo_table, dynamo_item)

    def create_resource(self, record):
        self.s3_service.upload_file_obj(
            file_obj=record["data"],
            s3_bucket_name=self.s3_bucket,
            file_key=f"{record['nhs_number']}/{record['id']}",
        )

    def retrieve_document_reference(self, record):
        return self.dynamo_service.get_item(
            table_name=self.dynamo_table,
            key={"ID": record["id"]},
        )

    def create_upload_payload(
        self,
        record,
        exclude=None,
        return_json=False,
        content_type=None,
        title=None,
    ):
        """Helper to build DocumentReference payload."""
        payload = {
            "resourceType": "DocumentReference",
            "type": {
                "coding": [
                    {
                        "system": "https://snomed.info/sct",
                        "code": f"{self.snomed_code}",
                        "display": "Confidential patient data",
                    },
                ],
            },
            "subject": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/nhs-number",
                    "value": record["nhs_number"],
                },
            },
            "author": [
                {
                    "identifier": {
                        "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                        "value": record["ods"],
                    },
                },
            ],
            "custodian": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": record["ods"],
                },
            },
            "content": [
                {
                    "attachment": {
                        "creation": "2023-01-01",
                        "contentType": "application/pdf",
                        "language": "en-GB",
                        "title": "1of1_pdm_record_[Paula Esme VESEY]_[9730153973]_[22-01-1960].pdf",
                    },
                },
            ],
        }

        if content_type:
            payload["content"][0]["attachment"]["contentType"] = content_type
        if title:
            payload["content"][0]["attachment"]["title"] = title

        if exclude is None:
            exclude = []

        for field in exclude:
            if field == "title":
                payload["content"][0]["attachment"].pop(field, None)
            else:
                payload.pop(field, None)

        if "data" in record:
            payload["content"][0]["attachment"]["data"] = record["data"]

        if return_json:
            return payload

        return json.dumps(payload)

    def tidyup(self, record):
        self.dynamo_service.delete_item(
            table_name=self.dynamo_table,
            key={"ID": record["id"]},
        )
        self.s3_service.delete_object(
            self.s3_bucket,
            f"{record['nhs_number']}/{record['id']}",
        )


class PdmDataHelper(DataHelper):
    def __init__(self):
        super().__init__(
            "COREDocumentMetadata",
            "pdm-document-store",
            SnomedCodes.PATIENT_DATA.value.code,
            "pdm_record",
        )


class LloydGeorgeDataHelper(DataHelper):
    def __init__(self):
        self.bulk_upload_table_name = "BulkUploadReport"
        self.metadata_processor_lambda_name = "BulkUploadMetadataProcessor"
        self.unstitched_table_name = "UnstitchedLloydGeorgeReferenceMetadata"
        self.staging_bucket = "staging-bulk-store"
        self.bulk_upload_table = None
        self.unstitched_table = None
        self.metadata_processor_lambda = None

        self.lambda_client = boto3.client("lambda")
        self.s3_client = boto3.client("s3")

        super().__init__(
            "LloydGeorgeReferenceMetadata",
            "lloyd-george-store",
            SnomedCodes.LLOYD_GEORGE.value.code,
            "Lloyd_George_Record",
        )

    def build_env(self, table_name, bucket_name):
        super().build_env(table_name, bucket_name)
        self.bulk_upload_table = f"{self.workspace}_{self.bulk_upload_table_name}"
        self.metadata_processor_lambda = (
            f"{self.workspace}_{self.metadata_processor_lambda_name}"
        )
        self.unstitched_table = f"{self.workspace}_{self.unstitched_table_name}"
        self.staging_bucket = f"{self.workspace}-{self.staging_bucket}"

    def scan_bulk_upload_report_table(self):
        return self.dynamo_service.scan_whole_table(self.bulk_upload_table or "")

    def scan_unstitch_table(self):
        return self.dynamo_service.scan_whole_table(self.unstitched_table or "")

    def run_bulk_upload(self, payload):
        payload = json.dumps(payload)
        response = self.lambda_client.invoke(
            FunctionName=self.metadata_processor_lambda,
            InvocationType="RequestResponse",
            Payload=payload,
        )
        return response

    def upload_to_staging_directory(self, key, body):
        self.s3_service.save_or_create_file(self.staging_bucket, key, body)

    def add_virus_scan_tag(self, key, result, date):
        self.s3_client.put_object_tagging(
            Bucket=self.staging_bucket,
            Key=key,
            Tagging={
                "TagSet": [
                    {"Key": "scan-result", "Value": result},
                    {"Key": "scan-date", "Value": date},
                ],
            },
        )

    def scan_lloyd_george_table(self):
        return self.dynamo_service.scan_whole_table(self.dynamo_table or "")

    def check_record_exists_in_s3(self, key):
        return self.s3_service.get_head_object(self.s3_bucket or "", key)

    def check_record_exists_in_s3_with_version(self, key, version_id):
        s3_client = boto3.client("s3")
        try:
            if version_id:
                _ = s3_client.head_object(
                    Bucket=self.s3_bucket,
                    Key=key,
                    VersionId=version_id,
                )
            else:
                _ = s3_client.head_object(Bucket=self.s3_bucket, Key=key)
            return True
        except s3_client.exceptions.ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            raise
