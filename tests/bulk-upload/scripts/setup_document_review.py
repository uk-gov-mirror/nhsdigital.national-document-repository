import csv
import os
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, NamedTuple

import boto3
from botocore.exceptions import ClientError

SOURCE_PDF_FILE = "../source_to_copy_from.pdf"


class Patient(NamedTuple):
    full_name: str
    date_of_birth: str
    nhs_number: str
    ods_code: str


def get_timestamp(days_ago: int = 0) -> int:
    target_date = datetime.now() - timedelta(days=days_ago)
    return int(target_date.timestamp())


def get_patients(filename: str) -> List[Dict]:
    patients = []
    csv_path = f"../test_patients_data/{filename}"

    if not os.path.exists(csv_path):
        print(f"Warning: {csv_path} not found.")

    else:
        with open(csv_path, mode="r", newline="") as file:
            reader = csv.DictReader(file)
            for idx, row in enumerate(reader):
                if idx >= 300:
                    break
                patients.append(row)
    return patients


def parse_patient_record(raw_record: dict) -> Patient:
    nhs_number = raw_record["NHS_NO"]
    name_parts = [
        raw_record["GIVEN_NAME"],
        raw_record.get("OTHER_GIVEN_NAME", ""),
        raw_record["FAMILY_NAME"],
    ]
    full_name = " ".join(name_part for name_part in name_parts if name_part)
    date_of_birth = raw_record["DOB"].replace("/", "-")
    ods_code = raw_record["GPP"]
    return Patient(full_name, date_of_birth, nhs_number, ods_code)


def build_document_review_object(
    patient: Patient,
    review_id: str,
    files: List[Dict[str, str]],
    review_status: str = "PENDING_REVIEW",
    review_reason: str = "General error",
    days_ago_uploaded: int = 1,
    reviewer: str | None = None,
    review_date: int | None = None,
    document_reference_id: str | None = None,
) -> Dict[str, Any]:
    upload_timestamp = int(get_timestamp(days_ago=days_ago_uploaded))

    review_obj = {
        "ID": review_id,
        "Version": 1,
        "Author": f"{patient.ods_code}",
        "Custodian": patient.ods_code,
        "ReviewStatus": review_status,
        "ReviewReason": review_reason,
        "UploadDate": upload_timestamp,
        "Files": files,
        "NhsNumber": patient.nhs_number,
        "DocumentSnomedCodeType": "16521000000101",  # Lloyd George code
    }

    if reviewer:
        review_obj["Reviewer"] = reviewer

    if review_date:
        review_obj["ReviewDate"] = review_date

    if document_reference_id:
        review_obj["DocumentReferenceId"] = document_reference_id

    return review_obj


def build_file_reference(
    upload_id, file_name: str, bucket_name: str
) -> Dict[str, str]:
    s3_key = f"{upload_id}/{file_name}"
    file_location = f"s3://{bucket_name}/{s3_key}"

    return {
        "FileName": file_name,
        "FileLocation": file_location,
    }


def create_test_scenarios(patients: List[Patient], bucket_name: str):

    review_objects = []
    files_to_upload = []

    def scenario_1(patient):
        """Pending Review with single file"""
        file_name = f"upload_review_{patient.nhs_number}_doc1.pdf"
        review_id = str(uuid.uuid4())
        files = [build_file_reference(review_id, file_name, bucket_name)]
        review_obj = build_document_review_object(
            review_id=review_id,
            patient=patient,
            files=files,
            review_status="PENDING_REVIEW",
            review_reason="General error",
            days_ago_uploaded=1,
        )
        return review_obj, [(patient.nhs_number, file_name, files[0]["FileLocation"])]

    def scenario_2(patient):
        """Pending Review with multiple files"""

        files = []
        files_list = []
        review_id = str(uuid.uuid4())

        for i in range(3):
            file_name = f"upload_review_{patient.nhs_number}_doc{i+1}.pdf"
            file_ref = build_file_reference(review_id, file_name, bucket_name)
            files.append(file_ref)
            files_list.append((patient.nhs_number, file_name, file_ref["FileLocation"]))
        review_obj = build_document_review_object(
            review_id=review_id,
            patient=patient,
            files=files,
            review_status="PENDING_REVIEW",
            review_reason="More or less files than we expected",
            days_ago_uploaded=2,
        )
        return review_obj, files_list

    def scenario_3(patient):
        """Approved review"""
        file_name = f"upload_review_{patient.nhs_number}_doc1.pdf"
        review_id = str(uuid.uuid4())
        files = [build_file_reference(review_id, file_name, bucket_name)]
        review_obj = build_document_review_object(
            patient=patient,
            review_id=review_id,
            files=files,
            review_status="APPROVED",
            review_reason="Demographic mismatches",
            days_ago_uploaded=5,
            reviewer="H81109",
            review_date=get_timestamp(days_ago=2),
            document_reference_id=str(uuid.uuid4()),
        )
        return review_obj, [(patient.nhs_number, file_name, files[0]["FileLocation"])]

    def scenario_4(patient):
        """Rejected review"""
        file_name = f"upload_review_{patient.nhs_number}_doc1.pdf"
        review_id = str(uuid.uuid4())
        files = [build_file_reference(review_id, file_name, bucket_name)]
        review_obj = build_document_review_object(
            review_id=review_id,
            patient=patient,
            files=files,
            review_status="REJECTED",
            review_reason="Filename Naming convention error",
            days_ago_uploaded=7,
            reviewer="H81109",
            review_date=get_timestamp(days_ago=3),
        )
        return review_obj, [(patient.nhs_number, file_name, files[0]["FileLocation"])]

    def scenario_5(patient):
        """Approved with multiple files and document reference"""

        files = []
        files_list = []
        review_id = str(uuid.uuid4())

        for i in range(2):
            file_name = f"upload_review_{patient.nhs_number}_doc{i+1}.pdf"
            file_ref = build_file_reference(review_id, file_name, bucket_name)
            files.append(file_ref)
            files_list.append((patient.nhs_number, file_name, file_ref["FileLocation"]))

        review_obj = build_document_review_object(
            review_id=review_id,
            patient=patient,
            files=files,
            review_status="APPROVED",
            review_reason="Duplicate records error",
            days_ago_uploaded=10,
            reviewer="H81109",
            review_date=get_timestamp(days_ago=5),
            document_reference_id=str(uuid.uuid4()),
        )
        return review_obj, files_list


    def scenario_6(patient):
        """random document type review"""

        file_name = f"random_upload_{patient.nhs_number}.txt"
        review_id = str(uuid.uuid4())
        files = [build_file_reference(review_id, file_name, bucket_name)]
        review_obj = build_document_review_object(
            review_id=review_id,
            patient=patient,
            files=files,
            review_status="PENDING_REVIEW",
            review_reason="Unknown NHS number",
            days_ago_uploaded=3,
        )
        review_obj["DocumentSnomedCodeType"] = "734163000"
        return review_obj, [(patient.nhs_number, file_name, files[0]["FileLocation"])]

    def scenario_7(patient):
        """Multiple versions: NEVER_REVIEWED (v1) and PENDING_REVIEW (v2) with different custodians"""

        review_id = str(uuid.uuid4())
        file_name = f"upload_review_{patient.nhs_number}_doc1.pdf"

        files = [build_file_reference(review_id, file_name, bucket_name)]

        review_obj_v1 = build_document_review_object(
            review_id=review_id,
            patient=patient,
            files=files,
            review_status="NEVER_REVIEWED",
            review_reason="General error",
            review_date=get_timestamp(days_ago=1),
            days_ago_uploaded=15,
        )
        review_obj_v1["Version"] = 1
        review_obj_v1["Author"] = "A12345"
        review_obj_v1["Reviewer"] = "A12345"

        review_obj_v2 = build_document_review_object(
            review_id=review_id,
            patient=patient,
            files=files,
            review_status="PENDING_REVIEW",
            review_reason="General error",
            days_ago_uploaded=15,
        )
        review_obj_v2["Version"] = 2
        review_obj_v1["Author"] = "A12345"
        review_obj_v2["Custodian"] = "H81109"

        files_list = [
            (patient.nhs_number, file_name, files[0]["FileLocation"])
        ]

        return [review_obj_v1, review_obj_v2], files_list

    scenarios = [
        scenario_1,
        scenario_2,
        scenario_3,
        scenario_4,
        scenario_5,
        scenario_6,
        scenario_7,
    ]

    for idx, patient in enumerate(patients):
        scenario_func = scenarios[idx % len(scenarios)]
        result = scenario_func(patient)
        review_obj, patient_files = result

        if isinstance(review_obj, list):
            review_objects.extend(review_obj)
        else:
            review_objects.append(review_obj)

        files_to_upload.extend(patient_files)

    return review_objects, files_to_upload


def upload_files_to_s3(files_to_upload: List[tuple], source_pdf: str):
    s3_client = boto3.client("s3")

    for nhs_number, file_name, file_location in files_to_upload:
        s3_location = file_location.replace("s3://", "")
        bucket_name, s3_key = s3_location.split("/", 1)

        try:
            s3_client.upload_file(
                Filename=source_pdf,
                Bucket=bucket_name,
                Key=s3_key,
                ExtraArgs={"ContentType": "application/pdf"},
            )
        except FileNotFoundError:
            print(f"Source file not found: {source_pdf}")
        except ClientError as e:
            print(f"Error uploading {file_name}: {e}")


def write_to_dynamodb(review_objects: List[Dict[str, Any]], table_name: str):
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)

    try:
        with table.batch_writer() as batch:
            for review_obj in review_objects:
                batch.put_item(Item=review_obj)
        print(f"\nSuccessfully wrote {len(review_objects)} review objects to DynamoDB")
    except ClientError as e:
        print(f"Error writing to DynamoDB: {e.response['Error']['Message']}")
        raise


def main():
    environment = os.environ.get("ENVIRONMENT", "ndr-dev")
    bucket_name = f"{environment}-document-pending-review-store"
    table_name = f"{environment}_DocumentUploadReview"
    patient_file = os.environ.get("PATIENT_DATA_FILE", "ODS_Code_H81109.csv")

    try:
        patients_data = get_patients(patient_file)
        patients = [parse_patient_record(record) for record in patients_data]
        print(f"Loaded {len(patients)} patients")
    except Exception as e:
        print(f"Error loading patients: {e}")
        return

    review_objects, files_to_upload = create_test_scenarios(patients, bucket_name)
    print(f"Created {len(review_objects)} review objects with {len(files_to_upload)} files")

    print("\nUploading files to S3...")
    upload_files_to_s3(files_to_upload, SOURCE_PDF_FILE)

    print("\nWriting to DynamoDB...")
    write_to_dynamodb(review_objects, table_name)

    print("SETUP COMPLETE")


if __name__ == "__main__":
    main()

