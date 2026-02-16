from io import BytesIO

import pytest
from utils.file_integrity_check import check_file_locked_or_corrupt


@pytest.mark.parametrize(
    "file_extension,file_content,expected_result",
    [
        ("pdf", b"%PDF-1.4\nsome content", False),
        ("zip", b"PK\x03\x04some zip content", False),
    ],
    ids=["pdf_file", "zip_file"],
)
def test_skipped_file_types(file_extension, file_content, expected_result):
    file_stream = BytesIO(file_content)
    result = check_file_locked_or_corrupt(file_stream, file_extension)
    assert result == expected_result


@pytest.mark.parametrize(
    "file_extension,is_encrypted,expected_result",
    [
        ("docx", False, False),
        ("docx", True, True),
        ("xlsx", False, False),
        ("xlsx", True, True),
        ("pptx", False, False),
        ("pptx", True, True),
        ("doc", False, False),
        ("doc", True, True),
        ("xls", False, False),
        ("xls", True, True),
        ("ppt", False, False),
        ("ppt", True, True),
    ],
)
def test_office_files(file_extension, is_encrypted, expected_result, mocker):
    mock_office_file = mocker.patch("utils.file_integrity_check.msoffcrypto.OfficeFile")
    mock_instance = mocker.MagicMock()
    mock_instance.is_encrypted.return_value = is_encrypted
    mock_office_file.return_value = mock_instance

    file_stream = BytesIO(b"fake office content")
    result = check_file_locked_or_corrupt(file_stream, file_extension)

    assert result == expected_result
    mock_office_file.assert_called_once_with(file_stream)
    mock_instance.is_encrypted.assert_called_once()


@pytest.mark.parametrize(
    "file_extension,file_content,expected_result",
    [
        (
            "rtf",
            b"{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}\\f0\\fs60 Hello!}",
            False,
        ),
        ("rtf", b"This is not an RTF file", True),
        ("csv", b"name,age,city\nAlice,30,NYC\nBob,25,LA", False),
        ("csv", b"\xff\xfe Invalid UTF-8", True),
        ("json", b'{"key": "value", "number": 123}', False),
        ("txt", b"This is a simple text file.\nWith multiple lines.", False),
        ("txt", b"", False),
        ("xml", b'<?xml version="1.0"?><root><item>data</item></root>', False),
    ],
)
def test_text_based_files(file_extension, file_content, expected_result):
    file_stream = BytesIO(file_content)
    result = check_file_locked_or_corrupt(file_stream, file_extension)
    assert result == expected_result


@pytest.mark.parametrize(
    "file_extension",
    [
        "jpg",
        "jpeg",
        "png",
        "tiff",
        "tif",
    ],
    ids=["jpg", "jpeg", "png", "tiff", "tif"],
)
def test_image_files_valid(file_extension, mocker):
    mock_image_open = mocker.patch("utils.file_integrity_check.Image.open")
    mock_img = mocker.MagicMock()
    mock_image_open.return_value.__enter__.return_value = mock_img

    file_stream = BytesIO(b"fake image content")
    result = check_file_locked_or_corrupt(file_stream, file_extension)

    assert result is False
    mock_image_open.assert_called_once_with(file_stream)
    mock_img.verify.assert_called_once()


@pytest.mark.parametrize(
    "file_extension",
    ["jpg", "png", "tiff"],
)
def test_image_files_corrupt(file_extension, mocker):
    mock_image_open = mocker.patch("utils.file_integrity_check.Image.open")
    mock_image_open.side_effect = Exception("Corrupt image")

    file_stream = BytesIO(b"corrupt image data")
    result = check_file_locked_or_corrupt(file_stream, file_extension)

    assert result is True


@pytest.mark.parametrize(
    "file_extension",
    ["unknown", "mp4", "mp3", "avi", "mov"],
    ids=["unknown", "mp4", "mp3", "avi", "mov"],
)
def test_unsupported_file_extensions(file_extension):
    file_stream = BytesIO(b"some content")
    result = check_file_locked_or_corrupt(file_stream, file_extension)
    assert result is False


@pytest.mark.parametrize(
    "file_extension",
    ["docx", "xlsx", "pptx", "doc", "xls"],
    ids=["docx", "xlsx", "pptx", "doc", "xls"],
)
def test_office_file_exception_returns_true(file_extension, mocker):
    mock_office_file = mocker.patch("utils.file_integrity_check.msoffcrypto.OfficeFile")
    mock_office_file.side_effect = Exception("Unable to process file")

    file_stream = BytesIO(b"corrupt office content")
    result = check_file_locked_or_corrupt(file_stream, file_extension)

    assert result is True
