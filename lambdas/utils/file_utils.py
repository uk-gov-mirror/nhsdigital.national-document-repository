import csv
from io import BytesIO, TextIOWrapper

import msoffcrypto
from PIL import Image
from utils.audit_logging_setup import LoggingService
from utils.constants.file_extensions import (
    MEDIA_FILE_EXTENSIONS,
    MICROSOFT_OFFICE_FILE_EXTENSIONS,
    TEXT_FILE_EXTENSIONS,
)

logger = LoggingService(__name__)


def convert_csv_dictionary_to_bytes(
    headers: list[str],
    csv_dict_data: list[dict],
    encoding: str = "utf-8",
) -> bytes:
    csv_buffer = BytesIO()
    csv_text_wrapper = TextIOWrapper(csv_buffer, encoding=encoding, newline="")
    fieldnames = headers if headers else []

    writer = csv.DictWriter(csv_text_wrapper, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(csv_dict_data)

    csv_text_wrapper.flush()
    csv_buffer.seek(0)

    result = csv_buffer.getvalue()
    csv_buffer.close()

    return result


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
