import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_sign_up_creates_user_with_password_hash_and_session(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "auth.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        response = client.post(
            "/api/auth/sign-up",
            json={"email": "User@example.com", "password": "secret"},
        )
        session_response = client.get("/api/auth/session")

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "user@example.com"
    assert "prelegal_session" in response.cookies
    assert session_response.status_code == 200
    assert session_response.json()["user"]["email"] == "user@example.com"

    with sqlite3.connect(database_path) as connection:
        row = connection.execute("SELECT email, password_hash FROM users").fetchone()
        session_count = connection.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]

    assert row[0] == "user@example.com"
    assert row[1] != "secret"
    assert row[1].startswith("scrypt$")
    assert session_count == 1


def test_sign_up_rejects_duplicate_email(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "auth.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        first_response = client.post("/api/auth/sign-up", json={"email": "user@example.com", "password": "secret"})
        duplicate_response = client.post("/api/auth/sign-up", json={"email": "USER@example.com", "password": "secret"})

    assert first_response.status_code == 200
    assert duplicate_response.status_code == 409
    assert duplicate_response.json() == {"detail": "An account with this email already exists"}

    with sqlite3.connect(database_path) as connection:
        count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    assert count == 1


def test_sign_in_verifies_password_and_sets_session(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "auth.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        sign_up_response = client.post("/api/auth/sign-up", json={"email": "user@example.com", "password": "secret"})
        client.cookies.clear()
        sign_in_response = client.post("/api/auth/sign-in", json={"email": "USER@example.com", "password": "secret"})
        session_response = client.get("/api/auth/session")

    assert sign_up_response.status_code == 200
    assert sign_in_response.status_code == 200
    assert sign_in_response.json()["user"]["email"] == "user@example.com"
    assert "prelegal_session" in sign_in_response.cookies
    assert session_response.status_code == 200


def test_sign_in_rejects_wrong_password(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "auth.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        client.post("/api/auth/sign-up", json={"email": "user@example.com", "password": "secret"})
        client.cookies.clear()
        response = client.post("/api/auth/sign-in", json={"email": "user@example.com", "password": "wrong"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}


def test_sign_out_clears_session(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "auth.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        client.post("/api/auth/sign-up", json={"email": "user@example.com", "password": "secret"})
        sign_out_response = client.post("/api/auth/sign-out")
        session_response = client.get("/api/auth/session")

    assert sign_out_response.status_code == 200
    assert sign_out_response.json() == {"ok": True}
    assert session_response.status_code == 401
