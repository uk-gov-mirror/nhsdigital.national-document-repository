import os

from services.base.dynamo_service import DynamoDBService


class SearchDocumentReviewService:

    def __init__(self):
        self.dynamo_service = DynamoDBService()

    def get_review_document_references(self, ods_code, limit):

        response = self.dynamo_service.query_table(
            table_name=os.environ["DOCUMENT_REVIEW_DYNAMODB_NAME"],
            search_key="Custodian",
            search_condition=ods_code,
            index_name="CustodianIndex",
            limit=limit,
        )

        references = response["Items"]
        last_evaluated_key = response.get("LastEvaluatedKey", None)

        return references, last_evaluated_key
