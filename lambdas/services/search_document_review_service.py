from services.base.dynamo_service import DynamoDBService


class SearchDocumentReviewService:

    def __init__(self):
        dynamo_service = DynamoDBService()