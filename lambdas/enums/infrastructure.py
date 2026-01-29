import os
from enum import EnumMeta, StrEnum

from enums.lambda_error import LambdaError
from enums.mtls import MtlsCommonNames
from utils.audit_logging_setup import LoggingService
from utils.lambda_exceptions import DocumentRefException, InvalidDocTypeException

logger = LoggingService(__name__)


class DynamoMeta(EnumMeta):
    def __getattr__(cls, name):
        # This is triggered when someone does DynamoTables.FOOBAR
        logger.error("No Table exists during a table definition request.")
        raise InvalidDocTypeException(400, LambdaError.DocTypeInvalid)


class DynamoTables(StrEnum, metaclass=DynamoMeta):
    LLOYD_GEORGE = "LloydGeorgeReferenceMetadata"
    CORE = "COREDocumentMetadata"

    def __str__(self) -> str:
        workspace = os.getenv("WORKSPACE")
        if not workspace:
            logger.error(
                "No workspace environment variable found during table definition."
            )
            raise DocumentRefException(500, LambdaError.EnvMissing)
        return f"{workspace}_{self.value}"


MAP_MTLS_TO_DYNAMO = {MtlsCommonNames.PDM: DynamoTables.CORE}
