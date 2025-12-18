from io import BytesIO

import pytest

from utils.exceptions import CorruptedFileException
from utils.pdf_validator import validate_pdf_integrity


@pytest.fixture
def empty_pdf_stream():
    return BytesIO(b"")


def test_validate_pdf_integrity_with_valid_pdf(valid_pdf_stream):
    validate_pdf_integrity(valid_pdf_stream, "/test/valid.pdf")

    assert valid_pdf_stream.tell() == 0


def test_validate_pdf_integrity_with_corrupt_pdf(corrupt_pdf_stream):
    with pytest.raises(CorruptedFileException) as exc_info:
        validate_pdf_integrity(corrupt_pdf_stream, "/test/corrupt.pdf")

    assert "corrupt.pdf" in str(exc_info.value)


def test_validate_pdf_integrity_with_empty_pdf(empty_pdf_stream):
    with pytest.raises(CorruptedFileException) as exc_info:
        validate_pdf_integrity(empty_pdf_stream, "/test/empty.pdf")

    assert "empty.pdf" in str(exc_info.value)


def test_validate_pdf_integrity_with_truncated_pdf():
    truncated_content = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\ntruncated content"
    buffer = BytesIO(truncated_content)

    with pytest.raises(CorruptedFileException) as exc_info:
        validate_pdf_integrity(buffer, "/test/truncated.pdf")

    assert "truncated.pdf" in str(exc_info.value)


def test_validate_pdf_integrity_resets_stream_position(valid_pdf_stream):
    valid_pdf_stream.seek(50)

    validate_pdf_integrity(valid_pdf_stream, "/test/valid.pdf")

    assert valid_pdf_stream.tell() == 0
