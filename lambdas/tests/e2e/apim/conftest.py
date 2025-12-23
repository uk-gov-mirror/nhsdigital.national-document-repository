import pytest

from lambdas.tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()

PDM_METADATA_TABLE = pdm_data_helper.dynamo_table
PDM_S3_BUCKET = pdm_data_helper.s3_bucket


@pytest.fixture
def test_data():
    test_records = []
    yield test_records
    for record in test_records:
        pdm_data_helper.tidyup(record)
