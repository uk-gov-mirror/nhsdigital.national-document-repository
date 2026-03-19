from models.user_restrictions.user_restrictions import UserRestriction


class UserRestrictionResponse(UserRestriction):
    patient_given_name: list[str] | None = None
    patient_family_name: str | None = None
    restricted_user_first_name: str | None = None
    restricted_user_last_name: str | None = None
