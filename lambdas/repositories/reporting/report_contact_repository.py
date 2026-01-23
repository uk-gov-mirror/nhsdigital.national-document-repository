from services.base.dynamo_service import DynamoDBService


class ReportContactRepository:
    def __init__(self, table_name: str):
        self.table_name = table_name
        self.dynamo = DynamoDBService()

    def get_contact_email(self, ods_code: str) -> str | None:
        resp = self.dynamo.get_item(
            table_name=self.table_name,
            key={"OdsCode": ods_code},
        )
        item = (resp or {}).get("Item")
        if not item:
            return None
        return item.get("Email")
