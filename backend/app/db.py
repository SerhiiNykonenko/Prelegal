from collections.abc import Iterator
from contextlib import contextmanager
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS document_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    document_key TEXT NOT NULL,
    status TEXT NOT NULL,
    input_mode TEXT NOT NULL,
    draft_json TEXT NOT NULL,
    chat_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_email, document_key)
);
"""


def ensure_database_directory(database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)


def initialize_database(database_path: Path, reset: bool = False) -> None:
    ensure_database_directory(database_path)
    if reset and database_path.exists():
        database_path.unlink()

    with sqlite3.connect(database_path) as connection:
        connection.executescript(SCHEMA)
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
