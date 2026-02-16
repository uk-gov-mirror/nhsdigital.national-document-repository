import msoffcrypto
from PIL import Image
from utils.audit_logging_setup import LoggingService
from utils.constants.file_extensions import (
    MEDIA_FILE_EXTENSIONS,
    MICROSOFT_OFFICE_FILE_EXTENSIONS,
    TEXT_FILE_EXTENSIONS,
)

logger = LoggingService(__name__)


def check_file_locked_or_corrupt(file_stream, ext):
    file_stream.seek(0)
    try:
        if ext == "pdf" or ext == "zip":
            # Skipping PDF check, as this is covered by the antivirus scan
            logger.info(f"Skipping check for {ext} files")
            return False

        if ext in MICROSOFT_OFFICE_FILE_EXTENSIONS:
            office_file = msoffcrypto.OfficeFile(file_stream)
            encrypt = office_file.is_encrypted()
            return encrypt

        if ext in TEXT_FILE_EXTENSIONS:
            sample = file_stream.read(1024)
            sample.decode("utf-8")
            if ext == "rtf" and not sample.startswith(b"{\\rtf1"):
                return True
            return False

        if ext in MEDIA_FILE_EXTENSIONS:
            with Image.open(file_stream) as img:
                img.verify()
            return False

        logger.info(
            f"File with extension {ext} is not supported for locked/corrupt check, treating as valid.",
        )
        return False

    except Exception as e:
        logger.error(
            f"Error checking file validity for .{ext}: {type(e).__name__} - {str(e)}",
        )
        return True
