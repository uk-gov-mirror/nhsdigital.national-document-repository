import os

from services.base.dynamo_service import DynamoDBService


class SearchDocumentReviewService:

    def __init__(self, ods_code):
        self.dynamo_service = DynamoDBService()
        self.ods_code = ods_code

    def get_review_document_references(self):

        self.dynamo_service.query_table(
            table_name=os.environ["DOCUMENT_REVIEW_DYNAMODB_NAME"],
            search_key="Custodian",
            search_condition=self.ods_code,
            index_name="CustodianIndex",
        )