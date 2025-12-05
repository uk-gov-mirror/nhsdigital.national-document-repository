import datetime
import io
import json
import os
import uuid

from enums.snomed_codes import SnomedCodes
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service


class DataHelper:
    def __init__(
        self,
        dynamo_table_env: str,
        s3_bucket_env: str,
        snomed_code: str,
        record_type: str,
    ):
        self.dynamo_table = os.environ.get(dynamo_table_env) or ""
        self.s3_bucket = os.environ.get(s3_bucket_env) or ""
        self.snomed_code = snomed_code
        self.record_type = record_type
        self.dynamo_service = DynamoDBService()
        self.s3_service = S3Service()

    def build_record(
        self, nhs_number="9912003071", data=None, doc_status=None, size=None
    ):
        """Helper to create a PDM record dictionary."""
        record = {
            "id": str(uuid.uuid4()),
            "nhs_number": nhs_number,
            "ods": "H81109",
            "data": data or io.BytesIO(b"Sample PDF Content"),
        }
        if doc_status:
            record["doc_status"] = doc_status
        if size:
            record["size"] = size
        return record

    def create_metadata(self, document_details):
        dynamo_item = {
            "ID": document_details["id"],
            "ContentType": "application/pdf",
            "Created": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "CurrentGpOds": "H81109",
            "Custodian": "H81109",
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
        self.dynamo_service.create_item(self.dynamo_table, dynamo_item)

    def create_resource(self, record):
        self.s3_service.upload_file_obj(
            file_obj=record["data"],
            s3_bucket_name=self.s3_bucket,
            file_key=f"{record['nhs_number']}/{record['id']}",
        )

    def retrieve_document_reference(self, record):
        return self.dynamo_service.get_item(
            table_name=self.dynamo_table, key={"ID": record["id"]}
        )

    def create_upload_payload(self, record):
        """Helper to build DocumentReference payload."""
        payload = {
            "resourceType": "DocumentReference",
            "type": {
                "coding": [
                    {
                        "system": "https://snomed.info/sct",
                        "code": f"{self.snomed_code}",
                        "display": "Confidential patient data",
                    }
                ]
            },
            "subject": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/nhs-number",
                    "value": record["nhs_number"],
                }
            },
            "author": [
                {
                    "identifier": {
                        "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                        "value": record["ods"],
                    }
                }
            ],
            "custodian": {
                "identifier": {
                    "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                    "value": record["ods"],
                }
            },
            "content": [
                {
                    "attachment": {
                        "creation": "2023-01-01",
                        "contentType": "application/pdf",
                        "language": "en-GB",
                        "title": "1of1_pdm_record_[Paula Esme VESEY]_[9730153973]_[22-01-1960].pdf",
                    }
                }
            ],
        }
        if "data" in record:
            payload["content"][0]["attachment"]["data"] = record["data"]
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
            "PDM_METADATA_TABLE",
            "PDM_S3_BUCKET",
            SnomedCodes.PATIENT_DATA.value.code,
            "pdm_record",
        )


class LloydGeorgeDataHelper(DataHelper):
    def __init__(self):
        super().__init__(
            "NDR_DYNAMO_STORE",
            "NDR_S3_BUCKET",
            SnomedCodes.LLOYD_GEORGE.value.code,
            "Lloyd_George_Record",
        )
