from enum import StrEnum
from pathlib import Path
from typing import List, Optional


class ForbiddenFileType(StrEnum):
    ACTION = "ACTION"
    APK = "APK"
    APP = "APP"
    BAT = "BAT"
    BIN = "BIN"
    CAB = "CAB"
    CMD = "CMD"
    COM = "COM"
    COMMAND = "COMMAND"
    CPL = "CPL"
    CSH = "CSH"
    EX_ = "EX_"
    EXE = "EXE"
    GADGET = "GADGET"
    INF1 = "INF1"
    INS = "INS"
    INX = "INX"
    IPA = "IPA"
    ISU = "ISU"
    JOB = "JOB"
    JSE = "JSE"
    KSH = "KSH"
    LNK = "LNK"
    MSC = "MSC"
    MSI = "MSI"
    MSP = "MSP"
    MST = "MST"
    OSX = "OSX"
    OUT = "OUT"
    PAF = "PAF"
    PIF = "PIF"
    PRG = "PRG"
    PS1 = "PS1"
    RAR = "RAR"
    REG = "REG"
    RGS = "RGS"
    RUN = "RUN"
    SCR = "SCR"
    SCT = "SCT"
    SHB = "SHB"
    SHS = "SHS"
    U3P = "U3P"
    VB = "VB"
    VBE = "VBE"
    VBS = "VBS"
    VBSCRIPT = "VBSCRIPT"
    WORKFLOW = "WORKFLOW"
    WS = "WS"
    WSF = "WSF"
    WSH = "WSH"
    _7Z = "7Z"


def is_file_type_allowed(
    filename: str, accepted_file_types: Optional[List[str]] = None
) -> bool:
    """
    if accepted_file_types is empty or None:
        → allow any file except forbidden ones
    if accepted_file_types is provided:
        → only allow extensions listed there
    """
    if "." not in filename or filename.startswith("."):
        return False

    path = Path(filename)
    extension = path.suffix.upper().lstrip(".")

    if extension in {file_type.value for file_type in ForbiddenFileType}:
        return False

    if accepted_file_types:
        return extension in accepted_file_types

    # no accepted_file_types provided, accept all non-forbidden types
    return True
