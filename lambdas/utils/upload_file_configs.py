from typing import Dict

from enums.snomed_codes import SnomedCodes
from models.upload_file_config import DocumentConfig
from utils.exceptions import ConfigNotFoundException

LLOYD_GEORGE = DocumentConfig(
    snomed_code=SnomedCodes.LLOYD_GEORGE.value.code,
    display_name="Scanned Paper Notes",
    can_be_updated=True,
    associated_snomed="",
    multifile_upload=True,
    multifile_zipped=False,
    multifile_review=True,
    can_be_discarded=True,
    single_file_only=True,
    stitched=True,
    accepted_file_types=["PDF"],
    content=[],
)

ELECTRONIC_HEALTH_RECORD = DocumentConfig(
    snomed_code=SnomedCodes.EHR.value.code,
    display_name="Electronic Health Record",
    can_be_updated=True,
    associated_snomed="",
    multifile_upload=True,
    multifile_zipped=False,
    multifile_review=True,
    can_be_discarded=True,
    single_file_only=False,
    stitched=True,
    accepted_file_types=["PDF"],
    content=[],
)

ATTACHMENTS = DocumentConfig(
    snomed_code=SnomedCodes.EHR_ATTACHMENTS.value.code,
    display_name="Attachments",
    can_be_updated=True,
    associated_snomed="",
    multifile_upload=True,
    multifile_zipped=False,
    multifile_review=True,
    can_be_discarded=True,
    single_file_only=False,
    stitched=True,
    accepted_file_types=["ZIP"],
    content=[],
)

LETTERS_AND_DOCUMENTS = DocumentConfig(
    snomed_code=SnomedCodes.LETTERS_AND_DOCUMENTS.value.code,
    display_name="Letters and Documents",
    can_be_updated=False,
    associated_snomed="",
    multifile_upload=True,
    multifile_zipped=False,
    multifile_review=False,
    can_be_discarded=True,
    single_file_only=False,
    stitched=False,
    accepted_file_types=[],
    content=[],
)

ALL_CONFIGS = [
    LLOYD_GEORGE,
    ELECTRONIC_HEALTH_RECORD,
    ATTACHMENTS,
    LETTERS_AND_DOCUMENTS,
]

CONFIG_BY_SNOMED: Dict[str, DocumentConfig] = {
    config.snomed_code: config for config in ALL_CONFIGS
}


def get_config_by_snomed_code(snomed_code: str) -> DocumentConfig:
    config = CONFIG_BY_SNOMED.get(snomed_code)
    if not config:
        raise ConfigNotFoundException(
            f"No DocumentConfig found for SNOMED code '{snomed_code}'"
        )
    return config
