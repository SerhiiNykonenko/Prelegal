import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_session_login_creates_user(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "login.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        response = client.post(
            "/api/session-login",
            json={"email": "User@example.com", "password": "secret"},
        )

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "user@example.com"

    with sqlite3.connect(database_path) as connection:
        row = connection.execute("SELECT email FROM users").fetchone()

    assert row == ("user@example.com",)


def test_session_login_reuses_existing_user(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "login.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        first_response = client.post(
            "/api/session-login",
            json={"email": "user@example.com", "password": "secret"},
        )
        second_response = client.post(
            "/api/session-login",
            json={"email": "USER@example.com", "password": "new-secret"},
        )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json()["user"]["id"] == second_response.json()["user"]["id"]

    with sqlite3.connect(database_path) as connection:
        count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    assert count == 1
