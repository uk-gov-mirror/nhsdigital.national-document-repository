import os

import pytest

from lambdas.tests.e2e.helpers.data_helper import PdmDataHelper

pdm_data_helper = PdmDataHelper()

PDM_METADATA_TABLE = (
    os.environ.get("PDM_METADATA_TABLE") or "ndr-dev_PDMDocumentMetadata"
)
PDM_S3_BUCKET = os.environ.get("PDM_S3_BUCKET") or "ndr-dev-pdm-document-store"


@pytest.fixture
def test_data():
    test_records = []
    yield test_records
    for record in test_records:
        pdm_data_helper.tidyup(record)
