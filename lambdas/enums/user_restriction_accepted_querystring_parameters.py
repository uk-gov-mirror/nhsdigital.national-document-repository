from enum import StrEnum


class UserRestrictionQuerystringParameters(StrEnum):
    LIMIT = "limit"
    NHS_NUMBER = "nhsNumber"
    SMARTCARD_ID = "smartcardId"
    NEXT_PAGE_TOKEN = "nextPageToken"
