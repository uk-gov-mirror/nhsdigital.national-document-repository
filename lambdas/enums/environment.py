import os
from enum import Enum


class Environment(str, Enum):
    PROD = "prod"
    PRE_PROD = "pre-prod"
    NDR_TEST = "ndr-test"
    NDR_DEV = "ndr-dev"

    @classmethod
    def from_env(cls) -> "Environment":
        value = os.getenv("WORKSPACE")
        if not value:
            return cls.NDR_DEV

        return cls._value2member_map_.get(value.lower(), cls.NDR_DEV)
