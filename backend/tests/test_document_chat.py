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


def test_chat_turn_follow_up_questions_reflect_applied_updates(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "chat-followup.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    draft = _empty_draft()
    draft["purpose"] = "Evaluating a partnership"
    draft["governingLaw"] = "Delaware"
    draft["jurisdiction"] = "courts located in New Castle, DE"
    draft["modifications"] = "None."

    with TestClient(app) as client:
        response = client.post(
            "/api/document-drafts/mutual-nda/chat-turn",
            headers=_client_headers(),
            json={"message": "We need Delaware governing law.", "draft": draft, "chat": {"messages": [], "questionGroups": []}},
        )

    assert response.status_code == 200
    payload = response.json()
    all_question_keys = {
        question["key"]
        for group in payload["draft"]["chat"]["questionGroups"]
        for question in group["questions"]
    }
    assert "governingLaw" not in all_question_keys
    assert "jurisdiction" not in all_question_keys
    assert "modifications" not in all_question_keys


def test_chat_turn_switches_to_requested_document(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "chat-switch.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(app) as client:
        response = client.post(
            "/api/document-drafts/mutual-nda/chat-turn",
            headers=_client_headers(),
            json={
                "message": "Actually, please switch to a Data Processing Agreement instead.",
                "draft": _empty_draft(),
                "chat": {"messages": [], "questionGroups": []},
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["switchTo"] == "data-processing-agreement"
    assert payload["draft"]["documentKey"] == "data-processing-agreement"
    assert payload["draft"]["draft"]["documentTitle"] == "Data Processing Agreement"


def test_generic_document_review_blocks_missing_fields(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "generic-review.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    empty_generic = {
        "documentTitle": "",
        "effectiveDate": "",
        "businessPurpose": "",
        "governingLaw": "",
        "keyTerms": "",
        "specialTerms": "",
        "parties": [
            {"role": "Party 1", "name": "", "title": "", "company": "", "email": "", "address": ""},
            {"role": "Party 2", "name": "", "title": "", "company": "", "email": "", "address": ""},
        ],
    }

    with TestClient(app) as client:
        response = client.post(
            "/api/document-drafts/data-processing-agreement/review",
            headers=_client_headers(),
            json={"status": "review", "inputMode": "form", "draft": empty_generic, "chat": {"messages": [], "questionGroups": []}},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["readyForDownload"] is False
    assert payload["fieldErrors"]["documentTitle"]
    assert payload["fieldErrors"]["parties.0.company"]
