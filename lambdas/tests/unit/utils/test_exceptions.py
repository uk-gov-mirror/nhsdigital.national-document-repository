import pytest
from utils.exceptions import MigrationUnrecoverableException, MigrationRetryableException

def test_migration_unrecoverable_exception_fields():
    exc = MigrationUnrecoverableException(item_id="123", message="fatal error")
    assert exc.item_id == "123"
    assert exc.message == "fatal error"
    assert str(exc) == "fatal error"

def test_migration_retryable_exception_fields():
    exc = MigrationRetryableException(message="temporary error", segment_id="seg-1")
    assert exc.segment_id == "seg-1"
    assert exc.message == "temporary error"
    assert str(exc) == "temporary error"
