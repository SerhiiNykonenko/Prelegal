import sqlite3
from pathlib import Path

from app.db import initialize_database


def _count_users(database_path: Path) -> int:
    with sqlite3.connect(database_path) as connection:
        return connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def test_reset_flag_recreates_existing_database(tmp_path: Path) -> None:
    database_path = tmp_path / "reset.db"
    initialize_database(database_path)

    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "INSERT INTO users (email, password_text, created_at, updated_at) VALUES (?, ?, ?, ?)",
            ("user@example.com", "secret", "now", "now"),
        )
        connection.commit()

    assert _count_users(database_path) == 1

    initialize_database(database_path, reset=True)

    assert _count_users(database_path) == 0


def test_initialize_database_preserves_existing_database_without_reset(tmp_path: Path) -> None:
    database_path = tmp_path / "preserve.db"
    initialize_database(database_path)

    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "INSERT INTO users (email, password_text, created_at, updated_at) VALUES (?, ?, ?, ?)",
            ("user@example.com", "secret", "now", "now"),
        )
        connection.commit()

    initialize_database(database_path)

    assert _count_users(database_path) == 1
