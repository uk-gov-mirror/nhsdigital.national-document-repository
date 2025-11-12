import pytest
from scripts.github.checklist_validator.main import validate_checklist


def test_all_checked():
    body = """
- [x] Task 1
- [x] Task 2
"""
    assert validate_checklist(body) is True


def test_some_unchecked():
    body = """
- [x] Task 1
- [ ] Task 2
"""
    assert validate_checklist(body) is False


def test_empty_body():
    assert validate_checklist("") is False
