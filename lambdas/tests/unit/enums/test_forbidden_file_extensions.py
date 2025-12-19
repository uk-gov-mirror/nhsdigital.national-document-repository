from enums.upload_forbidden_file_extensions import is_file_type_allowed


def test_forbidden_extension_without_accepted_list():
    assert is_file_type_allowed("virus.exe") is False


def test_forbidden_extension_7z_without_accepted_list():
    assert is_file_type_allowed("file.7z") is False


def test_forbidden_extension_with_accepted_list():
    assert is_file_type_allowed("virus.exe", ["EXE", "PDF"]) is False


def test_allowed_extension_without_accepted_list():
    assert is_file_type_allowed("document.pdf") is True


def test_allowed_extension_with_accepted_list():
    assert is_file_type_allowed("document.pdf", ["PDF", "TXT"]) is True


def test_allowed_extension_not_in_accepted_list():
    assert is_file_type_allowed("image.png", ["PDF", "TXT"]) is False


def test_extension_is_case_insensitive():
    assert is_file_type_allowed("document.PdF", ["PDF"]) is True


def test_filename_without_extension():
    assert is_file_type_allowed("file") is False
