from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def _client_headers() -> dict[str, str]:
    return {"x-session-email": "user@example.com"}


def _complete_draft() -> dict:
    return {
        "purpose": "Evaluating a business relationship.",
        "effectiveDate": "2026-08-01",
        "mndaTermType": "fixed",
        "mndaTermYears": 1,
        "confidentialityTermType": "fixed",
        "confidentialityTermYears": 1,
        "governingLaw": "Delaware",
        "jurisdiction": "courts located in New Castle, DE",
        "modifications": "None.",
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
    }


def _empty_draft() -> dict:
    today = "2026-08-01"
    return {
        "purpose": "",
        "effectiveDate": today,
        "mndaTermType": "fixed",
        "mndaTermYears": 1,
        "confidentialityTermType": "fixed",
        "confidentialityTermYears": 1,
        "governingLaw": "",
        "jurisdiction": "",
        "modifications": "None.",
        "partyOne": {
            "printName": "",
            "title": "",
            "company": "",
            "noticeAddress": "",
            "signatureDate": today,
        },
        "partyTwo": {
            "printName": "",
            "title": "",
            "company": "",
            "noticeAddress": "",
            "signatureDate": today,
        },
    }


def test_chat_turn_returns_missing_questions(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "chat.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        response = client.post(
            "/api/document-drafts/mutual-nda/chat-turn",
            headers=_client_headers(),
            json={"message": "Acme and Beta are exploring a partnership.", "draft": _empty_draft(), "chat": {"messages": [], "questionGroups": []}},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistantMessage"]
    assert payload["readyForReview"] is False
    assert any(group["title"] == "Agreement basics" for group in payload["draft"]["chat"]["questionGroups"])
    saved = payload["draft"]["draft"]
    assert saved["partyOne"]["signatureDate"] == "2026-08-01"


def test_chat_turn_signals_ready_when_draft_complete(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "chat.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        response = client.post(
            "/api/document-drafts/mutual-nda/chat-turn",
            headers=_client_headers(),
            json={"message": "All fields look correct.", "draft": _complete_draft(), "chat": {"messages": [], "questionGroups": []}},
        )

    assert response.status_code == 200
    assert response.json()["readyForReview"] is True


def test_review_endpoint_blocks_missing_required_fields(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "review.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        response = client.post(
            "/api/document-drafts/mutual-nda/review",
            headers=_client_headers(),
            json={"status": "review", "inputMode": "form", "draft": _empty_draft(), "chat": {"messages": [], "questionGroups": []}},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["readyForDownload"] is False
    assert payload["fieldErrors"]["purpose"]
    assert payload["fieldErrors"]["partyOne.printName"]
    assert payload["fieldErrors"]["partyTwo.company"]


def test_review_endpoint_allows_valid_draft(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "review.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        response = client.post(
            "/api/document-drafts/mutual-nda/review",
            headers=_client_headers(),
            json={"status": "review", "inputMode": "form", "draft": _complete_draft(), "chat": {"messages": [], "questionGroups": []}},
        )

    assert response.status_code == 200
    assert response.json() == {"fieldErrors": {}, "readyForDownload": True}
