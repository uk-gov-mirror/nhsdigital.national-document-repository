from abc import ABC, abstractmethod
from typing import Iterable, Callable


class MigrationBase(ABC):
    """
    Abstract base class defining the common interface for all migrations.
    """

    name: str = "UnnamedMigration"
    description: str = "No description provided"
    target_table: str

    def __init__(self, environment: str, table_name: str, run_migration: bool = False):
        self.environment = environment
        self.table_name = table_name
        self.run_migration = run_migration
        self.target_table = f"{self.environment}_{self.table_name}"

    @abstractmethod
    def main(
        self, entries: Iterable[dict]
    ) -> list[tuple[str, Callable[[dict], dict | None]]]:
        pass
