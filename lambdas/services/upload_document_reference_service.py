import os
from typing import Optional

from botocore.exceptions import ClientError
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.virus_scan_result import VirusScanResult
from enums.lambda_error import LambdaError
from enums.snomed_codes import SnomedCodes
from utils.dynamo_utils import DocTypeTableRouter
from utils.lambda_exceptions import InvalidDocTypeException
from utils.s3_utils import DocTypeS3BucketRouter
from models.document_reference import DocumentReference
from services.base.dynamo_service import DynamoDBService
from services.base.s3_service import S3Service
from services.document_service import DocumentService
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import (
    FinalOrPreliminaryAndNotSuperseded,
    PreliminaryStatus,
)
from utils.exceptions import (
    DocumentServiceException,
    FileProcessingException,
    TransactionConflictException,
)
from utils.utilities import get_virus_scan_service

logger = LoggingService(__name__)


class UploadDocumentReferenceService:
    def __init__(self):
        self.staging_s3_bucket_name = os.environ["STAGING_STORE_BUCKET_NAME"]
        self.table_name = os.environ["LLOYD_GEORGE_DYNAMODB_NAME"]
        self.destination_bucket_name = os.environ["LLOYD_GEORGE_BUCKET_NAME"]
        self.doc_type = SnomedCodes.LLOYD_GEORGE.value
        self.document_service = DocumentService()
        self.dynamo_service = DynamoDBService()
        self.virus_scan_service = get_virus_scan_service()
        self.s3_service = S3Service()
        self.table_router = DocTypeTableRouter()
        self.bucket_router = DocTypeS3BucketRouter()

    def handle_upload_document_reference_request(
        self, object_key: str, object_size: int = 0
    ):
        """Handle the upload document reference request with comprehensive error handling"""
        if not object_key:
            logger.error("Invalid or empty object_key provided")
            return

        try:
            object_parts = object_key.split("/")
            document_key = object_parts[-1]
            nhs_number = None
            if len(object_parts) > 1:
                nhs_number = object_parts[-2]
            self._get_infrastructure_for_document_key(object_parts)

            preliminary_document_reference = self._fetch_preliminary_document_reference(
                document_key, nhs_number
            )
            if not preliminary_document_reference:
                return

            self._process_preliminary_document_reference(
                preliminary_document_reference, object_key, object_size
            )

        except Exception as e:
            logger.error(f"Unexpected error processing document reference: {str(e)}")
            logger.error(f"Failed to process document reference: {object_key}")
            return

    def _get_infrastructure_for_document_key(self, object_parts: list[str]) -> None:
        doc_type = None
        if object_parts[0] != "fhir_upload" or not (
            doc_type := SnomedCodes.find_by_code(object_parts[1])
        ):
            return

        try:
            self.doc_type = doc_type
            self.table_name = self.table_router.resolve(doc_type)
            self.destination_bucket_name = self.bucket_router.resolve(doc_type)
        except KeyError:
            logger.error(
                f"SNOMED code {doc_type.code} - {doc_type.display_name} is not supported"
            )
            raise InvalidDocTypeException(400, LambdaError.DocTypeDB)

    def _fetch_preliminary_document_reference(
        self, document_key: str, nhs_number: str | None = None
    ) -> Optional[DocumentReference]:
        """Fetch document reference from the database"""
        try:
            if self.doc_type.code != SnomedCodes.PATIENT_DATA.value.code:
                search_key = "ID"
                search_condition = document_key
            else:
                if not nhs_number:
                    logger.error(
                        f"Failed to process object key with ID: {document_key}"
                    )
                    raise FileProcessingException(400, LambdaError.DocRefInvalidFiles)

                search_key = ["NhsNumber", "ID"]
                search_condition = [nhs_number, document_key]

            documents = self.document_service.fetch_documents_from_table(
                search_key=search_key,
                search_condition=search_condition,
                table_name=self.table_name,
                query_filter=PreliminaryStatus,
            )

            if not documents:
                logger.error(
                    f"No document with the following key found in {self.table_name} table: {document_key}"
                )
                logger.info("Skipping this object")
                return None

            if len(documents) > 1:
                logger.warning(
                    f"Multiple documents found for key {document_key}, using first one"
                )

            return documents[0]

        except ClientError as e:
            logger.error(
                f"Error fetching document reference for key {document_key}: {str(e)}"
            )
            raise DocumentServiceException(
                f"Failed to fetch document reference: {str(e)}"
            )

    def _process_preliminary_document_reference(
        self,
        preliminary_document_reference: DocumentReference,
        object_key: str,
        object_size: int,
    ):
        """Process the preliminary (uploading) document reference with virus scanning and file operations"""
        try:
            virus_scan_result = self._perform_virus_scan(
                preliminary_document_reference, object_key
            )
            preliminary_document_reference.virus_scanner_result = virus_scan_result

            if virus_scan_result == VirusScanResult.CLEAN:
                self._process_clean_document(
                    preliminary_document_reference,
                    object_key,
                )
            else:
                logger.warning(
                    f"Document {preliminary_document_reference.id} failed virus scan"
                )

            preliminary_document_reference.file_size = object_size
            preliminary_document_reference.uploaded = True
            preliminary_document_reference.uploading = False

            if self.doc_type.code != SnomedCodes.PATIENT_DATA.value.code:
                updated_doc_status = None
                if virus_scan_result != VirusScanResult.CLEAN:
                    updated_doc_status = "cancelled"

                    preliminary_document_reference.doc_status = updated_doc_status
                    self._update_dynamo_table(preliminary_document_reference)
                else:
                    updated_doc_status = "final"
                    preliminary_document_reference.doc_status = updated_doc_status

                    self._finalize_and_supersede_with_transaction(
                        preliminary_document_reference
                    )

                    # Update NRL Pointer
                    # TODO: PRMP-390
                    #
            else:
                try:
                    preliminary_document_reference.doc_status = (
                        "cancelled"
                        if virus_scan_result != VirusScanResult.CLEAN
                        else "final"
                    )

                    self._update_dynamo_table(preliminary_document_reference)
                except Exception as e:
                    logger.error(
                        f"Error processing document reference {preliminary_document_reference.id}: {str(e)}"
                    )
                    raise

        except TransactionConflictException as e:
            logger.error(
                f"Transaction conflict while processing document {preliminary_document_reference.id}: {str(e)}"
            )
            raise
        except Exception as e:
            logger.error(
                f"Error processing document reference {preliminary_document_reference.id}: {str(e)}"
            )
            raise

    def _finalize_and_supersede_with_transaction(self, new_document: DocumentReference):
        """
        Atomically update the new document to 'final' status AND supersede existing final documents.
        if race condition occurs, existing preliminary documents are cancelled.
        Uses DynamoDB transactions to ensure all operations happen together or none at all.
        This prevents race conditions where two concurrent uploads could both become 'final'.
        """
        try:
            logger.info(
                f"Checking for existing final documents to supersede for NHS number {new_document.nhs_number}"
            )

            existing_docs: list[DocumentReference] = (
                self.document_service.fetch_documents_from_table(
                    table_name=self.table_name,
                    index_name="S3FileKeyIndex",
                    search_condition=new_document.s3_file_key,
                    search_key="S3FileKey",
                    query_filter=FinalOrPreliminaryAndNotSuperseded,  # final status or preliminary and not superseded
                )
            )

            # TODO: use s3_key to look up existing documents,
            # awaiting migration PRMP-179
            # https://github.com/nhsconnect/national-document-repository/pull/799

            transact_items = []

            update_fields_dict = new_document.model_dump(
                by_alias=True,
                exclude_none=True,
                include={
                    "virus_scanner_result",
                    "doc_status",
                    "file_location",
                    "file_size",
                    "uploaded",
                    "uploading",
                    "s3_version_id",
                },
            )

            new_doc_transaction = self.dynamo_service.build_update_transaction_item(
                table_name=self.table_name,
                document_key=self.document_reference_key(new_document.id),
                update_fields=update_fields_dict,
                condition_fields={"DocStatus": "preliminary"},
            )
            transact_items.append(new_doc_transaction)

            # Supersede existing final documents
            if existing_docs:
                logger.info(
                    f"Superseding {len(existing_docs)} existing final document(s) for NHS number {new_document.nhs_number}"
                )

                for doc in existing_docs:
                    if doc.id == new_document.id:
                        continue

                    # Supersede logic differs based on whether the existing doc is preliminary or final
                    if doc.doc_status == "preliminary":
                        # preliminary documents are cancelled
                        supersede_transaction = (
                            self.dynamo_service.build_update_transaction_item(
                                table_name=self.table_name,
                                document_key=self.document_reference_key(doc.id),
                                update_fields={
                                    "Status": "superseded",
                                    "DocStatus": "cancelled",
                                },
                                condition_fields={
                                    "DocStatus": "preliminary",
                                    "Version": new_document.version,
                                },
                            )
                        )
                    else:
                        # any previous final documents are deprecated
                        supersede_transaction = (
                            self.dynamo_service.build_update_transaction_item(
                                table_name=self.table_name,
                                document_key=self.document_reference_key(doc.id),
                                update_fields={
                                    "Status": "superseded",
                                    "DocStatus": "deprecated",
                                },
                                condition_fields={
                                    "DocStatus": "final",
                                    "Version": str(int(new_document.version) - 1),
                                },
                            )
                        )

                    transact_items.append(supersede_transaction)
            else:
                logger.info("No existing final documents to supersede")

            # Execute the transaction
            try:
                self.dynamo_service.transact_write_items(transact_items)
                logger.info(
                    f"Successfully updated document {new_document.id} to final status"
                    + (
                        f" and superseded {len(existing_docs)} document(s)"
                        if existing_docs
                        else ""
                    )
                )
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "")
                if error_code == "TransactionCanceledException":
                    logger.error(
                        f"Transaction cancelled - concurrent update detected for NHS number {new_document.nhs_number}"
                    )
                    raise TransactionConflictException(
                        f"Concurrent update detected while finalizing document for NHS number {new_document.nhs_number}. "
                        f"Another process may have already finalized a document for this patient."
                    )
                raise

        except TransactionConflictException:
            logger.info(
                f"Cancelling preliminary document {new_document.id} due to transaction conflict"
            )
            new_document.doc_status = "cancelled"
            new_document.uploaded = False
            new_document.uploading = False
            new_document.file_size = None
            self._update_dynamo_table(new_document)
            self.delete_file_from_bucket(
                new_document.file_location, new_document.s3_version_id
            )
            raise
        except Exception as e:
            logger.error(
                f"Unexpected error while finalizing document for {new_document.nhs_number}: {e}"
            )
            raise

    def document_reference_key(self, document_id):
        return {DocumentReferenceMetadataFields.ID.value: document_id}

    def _perform_virus_scan(
        self, document_reference: DocumentReference, object_key: str
    ) -> VirusScanResult:
        """Perform a virus scan on the document"""
        try:
            return self.virus_scan_service.scan_file(
                object_key, nhs_number=document_reference.nhs_number
            )

        except Exception as e:
            logger.error(
                f"Virus scan failed for document {document_reference.id}: {str(e)}"
            )
            return VirusScanResult.ERROR

    def _process_clean_document(
        self, document_reference: DocumentReference, object_key: str
    ):
        """Process a document that passed virus scanning"""
        try:
            self.copy_files_from_staging_bucket(document_reference, object_key)
            self.delete_file_from_staging_bucket(object_key)
            logger.info(
                f"Successfully processed clean document: {document_reference.id}"
            )

        except Exception as e:
            logger.error(
                f"Error processing clean document {document_reference.id}: {str(e)}"
            )
            document_reference.doc_status = "cancelled"
            raise FileProcessingException(f"Failed to process clean document: {str(e)}")

    def copy_files_from_staging_bucket(
        self, document_reference: DocumentReference, source_file_key: str
    ):
        """Copy files from staging bucket to destination bucket"""
        try:
            logger.info("Copying files from staging bucket")
            dest_file_key = f"{document_reference.nhs_number}/{document_reference.id}"
            if self.doc_type.code != SnomedCodes.PATIENT_DATA.value.code:
                dest_file_key = document_reference.s3_file_key

            copy_result = self.s3_service.copy_across_bucket(
                source_bucket=self.staging_s3_bucket_name,
                source_file_key=source_file_key,
                dest_bucket=self.destination_bucket_name,
                dest_file_key=dest_file_key,
            )
            if self.doc_type.code == SnomedCodes.PATIENT_DATA.value.code:
                document_reference.s3_file_key = dest_file_key
            document_reference.s3_bucket_name = self.destination_bucket_name
            document_reference.file_location = document_reference._build_s3_location(
                self.destination_bucket_name, dest_file_key
            )
            document_reference.s3_version_id = copy_result.get("VersionId")
            return copy_result

        except ClientError as e:
            logger.error(f"Error copying files from staging bucket: {str(e)}")
            raise FileProcessingException(
                f"Failed to copy file from staging bucket: {str(e)}"
            )

    def delete_file_from_staging_bucket(self, source_file_key: str):
        """Delete file from staging bucket"""
        try:
            logger.info(f"Deleting file from staging bucket: {source_file_key}")
            self.s3_service.delete_object(self.staging_s3_bucket_name, source_file_key)

        except ClientError as e:
            logger.error(f"Error deleting file from staging bucket: {str(e)}")

    def delete_file_from_bucket(self, file_location: str, version_id: str):
        """Delete file from bucket"""
        try:
            s3_bucket_name, source_file_key = DocumentReference._parse_s3_location(
                file_location
            )
            logger.info(
                f"Deleting file from bucket: {s3_bucket_name}/{source_file_key}"
            )

            self.s3_service.delete_object(s3_bucket_name, source_file_key, version_id)

        except ClientError as e:
            logger.error(f"Error deleting file from bucket: {str(e)}")

    def _update_dynamo_table(
        self,
        document: DocumentReference,
    ):
        """Update the DynamoDB table with document status and virus scan results"""
        try:
            logger.info("Updating dynamo db table")
            update_key = None
            update_fields = {
                "virus_scanner_result",
                "doc_status",
                "file_location",
                "file_size",
                "uploaded",
                "uploading",
            }
            if self.doc_type.code == SnomedCodes.PATIENT_DATA.value.code:
                update_fields.add("s3_file_key")
                update_key = {
                    DocumentReferenceMetadataFields.NHS_NUMBER.value: document.nhs_number,
                    DocumentReferenceMetadataFields.ID.value: document.id,
                }

            self.document_service.update_document(
                table_name=self.table_name,
                update_key=update_key,
                document=document,
                update_fields_name=update_fields,
            )

        except ClientError as e:
            logger.error(f"Error updating DynamoDB table: {str(e)}")
            raise DocumentServiceException(
                f"Failed to update document in database: {str(e)}"
            )
