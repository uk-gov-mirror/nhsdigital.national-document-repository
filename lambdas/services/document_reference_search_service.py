import os
from json import JSONDecodeError

from botocore.exceptions import ClientError
from pydantic import ValidationError

from enums.dynamo_filter import AttributeOperator, ConditionOperator
from enums.infrastructure import MAP_MTLS_TO_DYNAMO
from enums.lambda_error import LambdaError
from enums.metadata_field_names import DocumentReferenceMetadataFields
from enums.mtls import MtlsCommonNames
from enums.snomed_codes import SnomedCodes
from models.document_reference import DocumentReference
from models.fhir.R4.bundle import Bundle, BundleEntry
from models.fhir.R4.fhir_document_reference import (
    Attachment,
    DocumentReferenceInfo,
)
from services.document_service import DocumentService
from utils.audit_logging_setup import LoggingService
from utils.common_query_filters import NotDeleted, UploadCompleted
from utils.constants.api import DOCUMENT_RETRIEVE_ENDPOINT
from utils.dynamo_query_filter_builder import DynamoQueryFilterBuilder
from utils.dynamo_utils import build_mixed_condition_expression
from utils.exceptions import DynamoServiceException
from utils.lambda_exceptions import DocumentRefSearchException
from utils.lambda_header_utils import validate_common_name_in_mtls

logger = LoggingService(__name__)


class DocumentReferenceSearchService(DocumentService):
    def get_document_references(
        self,
        nhs_number: str,
        return_fhir: bool = False,
        additional_filters=None,
        check_upload_completed=True,
        api_request_context: dict = {},
    ):
        """
        Fetch document references for a given NHS number.

        Args:
            nhs_number (str): NHS number
            return_fhir (bool, optional): Return FHIR document references. Defaults to False.
            additional_filters (dict, optional): Additional filters to apply to DynamoDB query. (Defaults to None.)
            check_upload_completed (bool): Check upload of document is complete. (Defaults to True.)
            api_request_context (dict, optional): API request context, used to obtain MTLS common name. (Defaults to {}.)
        Returns:
            List of document references or FHIR DocumentReferences.
        """
        common_name = validate_common_name_in_mtls(
            api_request_context=api_request_context,
        )
        try:
            table_name = self._get_table_name(common_name)
            results = self._search_tables_for_documents(
                nhs_number,
                table_name,
                return_fhir,
                additional_filters,
                check_upload_completed,
            )
            return results
        except (
            JSONDecodeError,
            ValidationError,
            ClientError,
            DynamoServiceException,
        ) as e:
            logger.error(
                f"{LambdaError.DocRefClient.to_str()}: {str(e)}",
                {"Result": "Document reference search failed"},
            )
            raise DocumentRefSearchException(500, LambdaError.DocRefClient)

    def _get_table_name(self, common_name: MtlsCommonNames | None) -> str:
        logger.info("Getting table name for document search")
        if not common_name or common_name not in MtlsCommonNames:
            return os.environ["LLOYD_GEORGE_DYNAMODB_NAME"]

        return str(MAP_MTLS_TO_DYNAMO[common_name])

    def _search_tables_for_documents(
        self,
        nhs_number: str,
        table_name: str,
        return_fhir: bool,
        filters=None,
        check_upload_completed=False,
    ):
        document_resources = []

        logger.info(f"Searching for results in {table_name}")
        filter_expression = self._build_filter_expression(
            filters,
            check_upload_completed,
        )

        if "coredocumentmetadata" not in table_name.lower():
            documents = self.fetch_documents_from_table_with_nhs_number(
                nhs_number,
                table_name,
                query_filter=filter_expression,
            )
        else:
            documents = self.fetch_documents_from_table(
                search_condition=nhs_number,
                search_key="NhsNumber",
                index_name="idx_gsi_nhs_number",
                table_name=table_name,
                query_filter=filter_expression,
            )

        if check_upload_completed:
            self._validate_upload_status(documents)

        processed_documents = self._process_documents(
            documents,
            return_fhir=return_fhir,
        )
        document_resources.extend(processed_documents)

        logger.info(f"Found {len(document_resources)} document references")

        if return_fhir:
            return self._create_fhir_bundle(document_resources)

        return document_resources or None

    def _create_fhir_bundle(self, document_resources: list[dict]) -> dict:
        entries = [
            BundleEntry(resource=doc_resource) for doc_resource in document_resources
        ]

        bundle = Bundle(
            type="searchset",
            total=len(entries),
            entry=entries,
        ).model_dump(exclude_none=True)

        return bundle

    def _validate_upload_status(self, documents: list[DocumentReference]):
        if any(self.is_upload_in_process(document) for document in documents):
            logger.error(
                "Records are in the process of being uploaded. Will not process the new upload.",
                {"Result": "Document reference search failed"},
            )
            raise DocumentRefSearchException(423, LambdaError.UploadInProgressError)

    def _process_documents(
        self,
        documents: list[DocumentReference],
        return_fhir: bool,
    ) -> list[dict]:
        results = []
        for document in documents:
            if not document.file_size and not self.is_upload_in_process(document):
                document.file_size = self.s3_service.get_file_size(
                    s3_bucket_name=document.s3_bucket_name,
                    object_key=document.s3_file_key,
                )

            if return_fhir:
                fhir_response = self.create_document_reference_fhir_response(document)
                results.append(fhir_response)
            else:
                document_model = self._build_document_model(document)
                results.append(document_model)
        return results

    def _build_document_model(self, document: DocumentReference) -> dict:
        document_formatted = document.model_dump_camel_case(
            exclude_none=True,
            include={
                "id",
                "file_name",
                "created",
                "virus_scanner_result",
                "file_size",
                "version",
                "content_type",
                "document_snomed_code_type",
                "author",
            },
        )
        return document_formatted

    def _build_filter_expression(
        self,
        filter_values: dict[str, str] | None,
        upload_completed=False,
    ):
        if not filter_values:
            if not upload_completed:
                return NotDeleted
            return UploadCompleted

        filter_builder = DynamoQueryFilterBuilder()
        for filter_key, filter_value in filter_values.items():
            if filter_key == "custodian":
                filter_builder.add_condition(
                    attribute=str(DocumentReferenceMetadataFields.CURRENT_GP_ODS.value),
                    attr_operator=AttributeOperator.EQUAL,
                    filter_value=filter_value,
                )
            elif filter_key == "file_type":
                # placeholder for future filtering
                pass
            elif filter_key == "doc_status":
                filter_builder.add_condition(
                    attribute=str(DocumentReferenceMetadataFields.DOC_STATUS.value),
                    attr_operator=AttributeOperator.EQUAL,
                    filter_value=filter_value,
                )
            elif filter_key == "document_snomed_code":
                filter_builder.add_condition(
                    attribute=str(
                        DocumentReferenceMetadataFields.DOCUMENT_SNOMED_CODE_TYPE.value,
                    ),
                    attr_operator=AttributeOperator.EQUAL,
                    filter_value=filter_value,
                )

        return filter_builder.build() & NotDeleted

    def create_document_reference_fhir_response(
        self,
        document_reference: DocumentReference,
    ) -> dict:
        document_details = Attachment(
            title=document_reference.file_name,
            creation=document_reference.document_scan_creation
            or document_reference.created,
            url=DOCUMENT_RETRIEVE_ENDPOINT
            + "/"
            + document_reference.document_snomed_code_type
            + "~"
            + document_reference.id,
        )
        fhir_document_reference = (
            DocumentReferenceInfo(
                nhs_number=document_reference.nhs_number,
                attachment=document_details,
                custodian=document_reference.current_gp_ods,
                snomed_code_doc_type=SnomedCodes.find_by_code(
                    document_reference.document_snomed_code_type,
                ),
            )
            .create_fhir_document_reference_object(document_reference)
            .model_dump(exclude_none=True)
        )
        return fhir_document_reference

    def get_paginated_references_by_nhs_number(
        self,
        nhs_number: str,
        limit: int | None = None,
        next_page_token: str | None = None,
        filter: dict | None = None,
        api_request_context: dict = {},
        return_fhir: bool = False,
    ):

        filter_expression, condition_attribute_names, condition_attribute_values = (
            self._build_pagination_filter(filter)
        )

        common_name = validate_common_name_in_mtls(
            api_request_context=api_request_context,
        )

        references, next_page_token = self.query_table_with_paginator(
            table_name=self._get_table_name(common_name),
            index_name="NhsNumberIndex",
            search_key="NhsNumber",
            search_condition=nhs_number,
            limit=limit,
            start_key=next_page_token,
            filter_expression=filter_expression,
            expression_attribute_names=condition_attribute_names,
            expression_attribute_values=condition_attribute_values,
            scan_index_forward=False,
        )

        logger.info("Validating upload status")
        self._validate_upload_status(references)

        document_references = self._process_documents(
            references,
            return_fhir=return_fhir,
        )

        return {
            "references": document_references,
            "next_page_token": next_page_token,
        }

    def _build_pagination_filter(
        self,
        filter_values: dict[str, str] | None,
    ) -> tuple[str, dict, dict]:
        logger.info("Creating filter for pagination")
        conditions = [
            {
                "field": DocumentReferenceMetadataFields.DELETED.value,
                "operator": ConditionOperator.EQUAL.value,
                "value": "",
            },
            {
                "field": DocumentReferenceMetadataFields.DELETED.value,
                "operator": "attribute_not_exists",
            },
        ]

        query_filter, condition_attribute_names, condition_attribute_values = (
            build_mixed_condition_expression(conditions=conditions, join_operator="OR")
        )

        if filter_values:
            logger.info("Adding additional filters for pagination")
            additional_conditions = []
            for filter_key, filter_value in filter_values.items():
                if filter_key == "custodian":
                    additional_conditions.append(
                        {
                            "field": DocumentReferenceMetadataFields.CUSTODIAN.value,
                            "operator": ConditionOperator.EQUAL.value,
                            "value": filter_value,
                        },
                    )
                elif filter_key == "document_snomed_code":
                    additional_conditions.append(
                        {
                            "field": DocumentReferenceMetadataFields.DOCUMENT_SNOMED_CODE_TYPE.value,
                            "operator": ConditionOperator.EQUAL.value,
                            "value": filter_value,
                        },
                    )
                elif filter_key == "doc_status":
                    additional_conditions.append(
                        {
                            "field": DocumentReferenceMetadataFields.DOC_STATUS.value,
                            "operator": ConditionOperator.EQUAL.value,
                            "value": filter_value,
                        },
                    )

            (
                additional_filter,
                additional_condition_attribute_names,
                additional_condition_attribute_values,
            ) = build_mixed_condition_expression(conditions=additional_conditions)
            condition_attribute_names.update(additional_condition_attribute_names)
            condition_attribute_values.update(additional_condition_attribute_values)

            return (
                f"({query_filter}) AND " + additional_filter,
                condition_attribute_names,
                condition_attribute_values,
            )

        return query_filter, condition_attribute_names, condition_attribute_values
