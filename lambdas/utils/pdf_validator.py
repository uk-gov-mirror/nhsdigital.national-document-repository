from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError
from utils.audit_logging_setup import LoggingService
from utils.exceptions import CorruptedFileException

logger = LoggingService(__name__)


def validate_pdf_integrity(file_stream: BytesIO, file_path: str) -> None:
    try:
        file_stream.seek(0)
        reader = PdfReader(stream=file_stream, strict=True)
        _ = len(reader.pages)
        file_stream.seek(0)
    except (PdfReadError, ValueError, TypeError, OSError) as e:
        logger.info(f"PDF validation failed for {file_path}: {e}")
        raise CorruptedFileException(f"Corrupt PDF file detected: {file_path}")
