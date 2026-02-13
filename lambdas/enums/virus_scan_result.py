from enum import StrEnum


class VirusScanResult(StrEnum):
    CLEAN = "Clean"
    INFECTED = "Infected"
    INFECTED_ALLOWED = "InfectedAllowed"
    UNSCANNABLE = "Unscannable"
    ERROR = "Error"
    INVALID = "Invalid"


SCAN_RESULT_TAG_KEY = "scan-result"
