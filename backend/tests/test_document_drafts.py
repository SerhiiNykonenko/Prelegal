import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_load_document_draft_creates_default_snapshot(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "drafts.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        response = client.get(
            "/api/document-drafts/mutual-nda",
            cookies={"prelegal_session": "User@example.com"},
        )

    assert response.status_code == 200
    payload = response.json()["draft"]
    assert payload["documentKey"] == "mutual-nda"
    assert payload["inputMode"] == "form"
    assert payload["status"] == "draft"
    assert payload["draft"]["governingLaw"] == "Delaware"
    assert payload["chat"] == {"messages": [], "questionGroups": []}

    with sqlite3.connect(database_path) as connection:
        count = connection.execute("SELECT COUNT(*) FROM document_drafts").fetchone()[0]

    assert count == 1


def test_update_document_draft_persists_snapshot(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "drafts.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    payload = {
        "status": "review",
        "inputMode": "chat",
        "draft": {
            "purpose": "Discussing a possible services partnership.",
            "effectiveDate": "2026-08-01",
            "mndaTermType": "fixed",
            "mndaTermYears": 2,
            "confidentialityTermType": "perpetual",
            "confidentialityTermYears": 1,
            "governingLaw": "California",
            "jurisdiction": "San Francisco County, CA",
            "modifications": "Mutual return of materials on request.",
            "partyOne": {
                "printName": "Pat One",
                "title": "CEO",
                "company": "Acme",
                "noticeAddress": "100 Main St",
                "signatureDate": "2026-08-01",
            },
            "partyTwo": {
                "printName": "Sam Two",
                "title": "CFO",
                "company": "Beta",
                "noticeAddress": "200 Oak Ave",
                "signatureDate": "2026-08-02",
            },
        },
        "chat": {
            "messages": [
                {"role": "assistant", "content": "Tell me about the agreement parties."},
                {"role": "user", "content": "Acme and Beta are evaluating a partnership."},
            ],
            "questionGroups": [
                {
                    "title": "Terms",
                    "questions": [
                        {"key": "governingLaw", "prompt": "Which state law should govern the NDA?"},
                    ],
                },
            ],
        },
    }

    with TestClient(app) as client:
        response = client.put(
            "/api/document-drafts/mutual-nda",
            headers={"x-session-email": "user@example.com"},
            json=payload,
        )
        reload_response = client.get(
            "/api/document-drafts/mutual-nda",
            cookies={"prelegal_session": "USER@example.com"},
        )

    assert response.status_code == 200
    assert reload_response.status_code == 200
    saved = reload_response.json()["draft"]
    assert saved["status"] == "review"
    assert saved["inputMode"] == "chat"
    assert saved["draft"]["partyOne"]["company"] == "Acme"
    assert saved["chat"]["messages"][0]["role"] == "assistant"
    assert saved["chat"]["questionGroups"][0]["title"] == "Terms"


def test_document_draft_requires_session(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "drafts.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        response = client.get("/api/document-drafts/mutual-nda")

    assert response.status_code == 401
    assert response.json() == {"detail": "Session required"}
