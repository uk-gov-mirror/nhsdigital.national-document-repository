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

        self.build_env(table_name, bucket_name)

    def build_env(self, table_name, bucket_name):
        if not self.workspace:
            raise ValueError("WORKSPACE environment variable is missing or empty.")
        self.dynamo_table = f"{self.workspace}_{table_name}"
        self.s3_bucket = f"{self.workspace}-{bucket_name}"

        apim_map = {
            "pre-prod": "int.api.service.nhs.uk",
            "ndr-test": "internal-qa.api.service.nhs.uk",
            "ndr-dev":  "internal-dev.api.service.nhs.uk",
            }
        self.apim_url = apim_map.get(str(self.workspace), "internal-dev.api.service.nhs.uk")


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
            "COREDocumentMetadata",
            "pdm-document-store",
            SnomedCodes.PATIENT_DATA.value.code,
            "pdm_record",
        )

    def retrieve_document_reference(self, record):
        return self.dynamo_service.get_item(
            table_name=self.dynamo_table,
            key={"NhsNumber": record["nhs_number"], "ID": record["id"]},
        )

    def tidyup(self, record):
        self.dynamo_service.delete_item(
            table_name=self.dynamo_table,
            key={"NhsNumber": record["nhs_number"], "ID": record["id"]},
        )
        self.s3_service.delete_object(
            self.s3_bucket,
            f"{record['nhs_number']}/{record['id']}",
        )


class LloydGeorgeDataHelper(DataHelper):
    def __init__(self):
        super().__init__(
            "LloydGeorgeReferenceMetadata",
            "lloyd-george-store",
            SnomedCodes.LLOYD_GEORGE.value.code,
            "Lloyd_George_Record",
        )
