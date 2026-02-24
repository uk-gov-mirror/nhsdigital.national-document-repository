from datetime import datetime, timezone

import freezegun

from models.user_restrictions.user_restrictions import UserRestriction
from tests.e2e.mns.mns_helper import TEST_NHS_NUMBER
from tests.unit.conftest import TEST_CURRENT_GP_ODS, TEST_UUID


@freezegun.freeze_time("2024-01-01T12:00:00Z")
def test_model_dump_camel_case(mock_uuid):
    restriction = UserRestriction(
        restricted_user="123456789012",
        nhs_number=TEST_NHS_NUMBER,
        custodian=TEST_CURRENT_GP_ODS,
        creator="223456789022",
    )

    created_timestamp = int(datetime.now(timezone.utc).timestamp())

    expected = {
        "id": TEST_UUID,
        "nhsNumber": TEST_NHS_NUMBER,
        "custodian": TEST_CURRENT_GP_ODS,
        "creator": "223456789022",
        "restrictedUser": "123456789012",
        "created": created_timestamp,
        "isActive": True,
        "lastUpdated": created_timestamp,
        "removedBy": None,
    }

    actual = restriction.model_dump_camel_case()
    assert actual == expected
