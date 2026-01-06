import pytest

from enums.environment import Environment


@pytest.mark.parametrize(
    "env_value, expected",
    [
        ("prod", Environment.PROD),
        ("pre-prod", Environment.PRE_PROD),
        ("ndr-test", Environment.NDR_TEST),
        ("ndr-dev", Environment.NDR_DEV),
    ],
)
def test_valid_workspace_values(monkeypatch, env_value, expected):
    monkeypatch.setenv("WORKSPACE", env_value)
    assert Environment.from_env() == expected


@pytest.mark.parametrize(
    "env_value",
    [
        "abcd1",
        "ndr000",
        "prmp000",
        "foobar",
    ],
)
def test_invalid_workspace_defaults_to_ndr_dev(monkeypatch, env_value):
    monkeypatch.setenv("WORKSPACE", env_value)
    assert Environment.from_env() == Environment.NDR_DEV


def test_workspace_is_case_insensitive(monkeypatch):
    monkeypatch.setenv("WORKSPACE", "PRE-PROD")
    assert Environment.from_env() == Environment.PRE_PROD


def test_workspace_not_set_defaults_to_ndr_dev(monkeypatch):
    monkeypatch.delenv("WORKSPACE", raising=False)
    assert Environment.from_env() == Environment.NDR_DEV


def test_workspace_empty_string_defaults_to_ndr_dev(monkeypatch):
    monkeypatch.setenv("WORKSPACE", "")
    assert Environment.from_env() == Environment.NDR_DEV
