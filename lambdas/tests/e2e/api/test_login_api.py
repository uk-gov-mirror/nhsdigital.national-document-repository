import pytest
from tests.e2e.helpers.data_helper import LloydGeorgeDataHelper
from tests.e2e.helpers.mockcis2_helper import MockCis2Helper

# Note this is testing a mock, but this test is valuable to ensure the login code is working for other tests

data_helper = LloydGeorgeDataHelper()


@pytest.mark.skipif(
    data_helper.workspace == "pre-prod", reason="CIS2 login is not mocked in pre-prod"
)
@pytest.mark.parametrize(
    "ods_code, role_to_assume, expected_granted_role",
    [
        ("H81109", "gp_admin", "GP_ADMIN"),
        ("H81109", "gp_clinical", "GP_CLINICAL"),
        ("X4S4L", "pcse", "PCSE"),
    ],
)
def test_login(ods_code, role_to_assume, expected_granted_role):
    login_helper = MockCis2Helper(ods=ods_code, repository_role=role_to_assume)
    login_helper.generate_mockcis2_token()
    assert login_helper.user_role == expected_granted_role
    assert login_helper.user_token is not None
