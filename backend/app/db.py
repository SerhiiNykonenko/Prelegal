from collections.abc import Iterator
from contextlib import contextmanager
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


def ensure_database_directory(database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)


def initialize_database(database_path: Path, reset: bool = False) -> None:
    ensure_database_directory(database_path)
    if reset and database_path.exists():
        database_path.unlink()

    with sqlite3.connect(database_path) as connection:
        connection.execute(SCHEMA)
        connection.commit()


@contextmanager
def get_connection(database_path: Path) -> Iterator[sqlite3.Connection]:
    ensure_database_directory(database_path)
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()
