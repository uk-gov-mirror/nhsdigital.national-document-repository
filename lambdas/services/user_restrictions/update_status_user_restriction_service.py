from services.user_restrictions.user_restriction_dynamo_service import (
    UserRestrictionDynamoService,
)


class UpdateStatusUserRestrictionService:
    def __init__(self):
        self.dynamo_service = UserRestrictionDynamoService()

    def handle_delete_restriction(
        self,
        restriction_id: str,
        removed_by: str,
        nhs_number: str,
    ) -> None:
        self.dynamo_service.update_restriction_inactive(
            restriction_id=restriction_id,
            removed_by=removed_by,
            patient_id=nhs_number,
        )
