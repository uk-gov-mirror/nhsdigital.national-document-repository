from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional


@dataclass
class SSHKey:
    user_name: str
    ssh_public_key_id: str
    ssh_public_key_body: str
    date_imported: datetime
    server_id: str
    user_email: Optional[str] = None
    
    @property
    def age_in_days(self) -> int:
        """Calculate the age of the key in days"""
        now = datetime.now(timezone.utc)
        return (now - self.date_imported).days
    
    @property
    def is_expired(self) -> bool:
        """Check if the key has exceeded the 90-day limit"""
        return self.age_in_days >= 90
    
    @property
    def expires_soon(self) -> bool:
        """Check if the key will expire within 7 days"""
        return 83 <= self.age_in_days < 90
    
    @property
    def days_until_expiry(self) -> int:
        """Calculate days until expiry (negative if already expired)"""
        return 90 - self.age_in_days


@dataclass
class KeyExpiryReport:
    expiring_soon: list[SSHKey]
    expired_keys: list[SSHKey]
    total_keys_checked: int
    
    @property
    def has_expiring_keys(self) -> bool:
        """Check if there are keys expiring soon"""
        return len(self.expiring_soon) > 0
    
    @property
    def has_expired_keys(self) -> bool:
        """Check if there are expired keys"""
        return len(self.expired_keys) > 0