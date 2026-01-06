import boto3
import json

from enum import StrEnum, auto
from functools import lru_cache

from enums.lambda_error import LambdaError
from enums.environment import Environment
from utils.audit_logging_setup import LoggingService
from utils.lambda_exceptions import InvalidDocTypeException

logger = LoggingService(__name__)


class MtlsCommonNames(StrEnum):
    PDM = auto()

    @classmethod
    def allowed_names(cls) -> dict["MtlsCommonNames", list[str]]:
        raw = cls._get_mtls_common_names()
        return {cls[k]: v for k, v in raw.items() if k in cls.__members__}

    @classmethod
    def from_common_name(cls, common_name: str) -> "MtlsCommonNames | None":
        for doc_type, names in cls.allowed_names().items():
            if common_name in names:
                return doc_type
        logger.error(f"mTLS common name {common_name} - is not supported")
        raise InvalidDocTypeException(400, LambdaError.DocTypeInvalid)

    @classmethod
    @lru_cache(maxsize=1)
    def _get_mtls_common_names(cls) -> dict[str, list[str]]:
        ssm = boto3.client("ssm")
        environment = Environment.from_env().value
        response = ssm.get_parameter(
            Name=f"/ndr/{environment}/mtls_common_names",
            WithDecryption=True,
        )
        return json.loads(response["Parameter"]["Value"])
