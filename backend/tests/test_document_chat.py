from pathlib import Path
from unittest.mock import Mock

from fastapi.testclient import TestClient

from app.main import app
from app.services.document_chat import DocumentChatService


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


def test_generic_chat_turn_uses_plain_text_when_provider_skips_structured_output(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "generic-chat.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    mock_response = {"choices": [{"message": {"content": "I can help you fill in more details about the agreement."}}]}
    mock_completion = Mock(return_value=mock_response)
    monkeypatch.setattr("litellm.completion", mock_completion)

    draft = {
        "documentTitle": "Data Processing Agreement",
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
            "/api/document-drafts/data-processing-agreement/chat-turn",
            headers=_client_headers(),
            json={
                "status": "draft",
                "inputMode": "chat",
                "draft": draft,
                "chat": {"messages": [], "questionGroups": []},
                "message": "Help me fill this out.",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistantMessage"] == "I can help you fill in more details about the agreement."
    assert payload["draft"]["chat"]["messages"][-1]["content"] == "I can help you fill in more details about the agreement."
    assert mock_completion.called


def test_generic_chat_turn_hides_malformed_json_payload(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "generic-chat-malformed.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    mock_response = {
        "choices": [
            {
                "message": {
                    "content": "```json\n{\n  \"documentTitle\": \"Service Level Agreement\",\n  \"parties\": [\n    {\"role\": \"Party 1\", \"name\": null},\n    {\"role\": \"Party 2\", .hyderabad\": null}\n  ]\n}\n```"
                }
            }
        ]
    }
    mock_completion = Mock(return_value=mock_response)
    monkeypatch.setattr("litellm.completion", mock_completion)

    draft = {
        "documentTitle": "Service Level Agreement",
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
            "/api/document-drafts/service-level-agreement/chat-turn",
            headers=_client_headers(),
            json={
                "status": "draft",
                "inputMode": "chat",
                "draft": draft,
                "chat": {"messages": [], "questionGroups": []},
                "message": "Help me draft an SLA.",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistantMessage"] == "I saved your latest answer. I still need a few grouped details to complete the draft."
    assert "```json" not in payload["draft"]["chat"]["messages"][-1]["content"]
    assert ".hyderabad" not in payload["draft"]["chat"]["messages"][-1]["content"]
    assert mock_completion.called


def test_generic_chat_turn_extracts_assistant_reply_from_mixed_text(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "generic-chat-mixed.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    mixed_content = "**JSON summary (no new fields were provided, so all fields are null):** ```json { \"documentTitle\": null, \"effectiveDate\": null } ``` **Assistant reply:** Hi! I’m ready to help you gather and structure any new details for your Service Level Agreement as soon as you provide them."
    mock_response = {"choices": [{"message": {"content": mixed_content}}]}
    mock_completion = Mock(return_value=mock_response)
    monkeypatch.setattr("litellm.completion", mock_completion)

    draft = {
        "documentTitle": "Service Level Agreement",
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
            "/api/document-drafts/service-level-agreement/chat-turn",
            headers=_client_headers(),
            json={
                "status": "draft",
                "inputMode": "chat",
                "draft": draft,
                "chat": {"messages": [], "questionGroups": []},
                "message": "Help me draft an SLA.",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistantMessage"] == "Hi! I’m ready to help you gather and structure any new details for your Service Level Agreement as soon as you provide them."
    assert payload["draft"]["chat"]["messages"][-1]["content"] == "Hi! I’m ready to help you gather and structure any new details for your Service Level Agreement as soon as you provide them."
    assert mock_completion.called


def test_generic_chat_turn_extracts_markdown_assistant_label(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "generic-chat-assistant-label.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    mixed_content = "Here is the current state of your document (no new fields were added in your last message): ```json { \"documentTitle\": \"Service Level Agreement\", \"effectiveDate\": \"\" } ``` **Assistant:** Sure! Let me know which section you'd like Covey to work on next."
    mock_response = {"choices": [{"message": {"content": mixed_content}}]}
    mock_completion = Mock(return_value=mock_response)
    monkeypatch.setattr("litellm.completion", mock_completion)

    draft = {
        "documentTitle": "Service Level Agreement",
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
            "/api/document-drafts/service-level-agreement/chat-turn",
            headers=_client_headers(),
            json={
                "status": "draft",
                "inputMode": "chat",
                "draft": draft,
                "chat": {"messages": [], "questionGroups": []},
                "message": "Help me draft an SLA.",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistantMessage"] == "Sure! Let me know which section you'd like Covey to work on next."
    assert payload["draft"]["chat"]["messages"][-1]["content"] == "Sure! Let me know which section you'd like Covey to work on next."
    assert mock_completion.called


def test_generic_chat_turn_applies_field_updates(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "generic-chat-updates.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    mock_response = {
        "choices": [
            {
                "message": {
                    "parsed": {
                        "documentTitle": "Service Level Agreement",
                        "effectiveDate": "2026-08-01",
                        "businessPurpose": "Provide uptime commitments for hosted services.",
                        "governingLaw": "Delaware",
                        "keyTerms": None,
                        "specialTerms": None,
                        "assistantMessage": "I filled in the effective date, business purpose, and governing law."
                    }
                }
            }
        ]
    }
    mock_completion = Mock(return_value=mock_response)
    monkeypatch.setattr("litellm.completion", mock_completion)

    draft = {
        "documentTitle": "Service Level Agreement",
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
            "/api/document-drafts/service-level-agreement/chat-turn",
            headers=_client_headers(),
            json={
                "status": "draft",
                "inputMode": "chat",
                "draft": draft,
                "chat": {"messages": [], "questionGroups": []},
                "message": "Set the effective date to 2026-08-01, the governing law to Delaware, and say this covers uptime commitments for hosted services.",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistantMessage"] == "I filled in the effective date, business purpose, and governing law."
    assert payload["draft"]["draft"]["effectiveDate"] == "2026-08-01"
    assert payload["draft"]["draft"]["businessPurpose"] == "Provide uptime commitments for hosted services."
    assert payload["draft"]["draft"]["governingLaw"] == "Delaware"
    assert mock_completion.called
