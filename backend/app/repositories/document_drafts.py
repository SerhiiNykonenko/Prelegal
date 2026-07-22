import json
import sqlite3
from datetime import UTC, datetime

from app.repositories.users import normalize_email
from app.schema import (
    DocumentDraftChatState,
    DocumentDraftSnapshot,
    SaveDocumentDraftRequest,
    create_default_document_draft,
)


def _serialize_snapshot(snapshot: DocumentDraftSnapshot) -> tuple[str, str, str, str]:
    return (
        snapshot.status,
        snapshot.inputMode,
        json.dumps(snapshot.draft.model_dump(mode="json")),
        json.dumps(snapshot.chat.model_dump(mode="json")),
    )


def _deserialize_snapshot(row: sqlite3.Row) -> DocumentDraftSnapshot:
    return DocumentDraftSnapshot(
        documentKey=row["document_key"],
        status=row["status"],
        inputMode=row["input_mode"],
        draft=json.loads(row["draft_json"]),
        chat=DocumentDraftChatState.model_validate(json.loads(row["chat_json"])),
    )


def get_or_create_document_draft(
    connection: sqlite3.Connection,
    *,
    user_email: str,
    document_key: str,
) -> DocumentDraftSnapshot:
    normalized_email = normalize_email(user_email)
    row = connection.execute(
        """
        SELECT document_key, status, input_mode, draft_json, chat_json
        FROM document_drafts
        WHERE user_email = ? AND document_key = ?
        """,
        (normalized_email, document_key),
    ).fetchone()

    if row:
        return _deserialize_snapshot(row)

    snapshot = create_default_document_draft(document_key)
    now = datetime.now(UTC).isoformat()
    status, input_mode, draft_json, chat_json = _serialize_snapshot(snapshot)
    connection.execute(
        """
        INSERT INTO document_drafts (
            user_email,
            document_key,
            status,
            input_mode,
            draft_json,
            chat_json,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            normalized_email,
            document_key,
            status,
            input_mode,
            draft_json,
            chat_json,
            now,
            now,
        ),
    )
    connection.commit()
    return snapshot


def save_document_draft(
    connection: sqlite3.Connection,
    *,
    user_email: str,
    document_key: str,
    payload: SaveDocumentDraftRequest,
) -> DocumentDraftSnapshot:
    normalized_email = normalize_email(user_email)
    snapshot = DocumentDraftSnapshot(
        documentKey=document_key,
        status=payload.status,
        inputMode=payload.inputMode,
        draft=payload.draft,
        chat=payload.chat,
    )
    now = datetime.now(UTC).isoformat()
    status, input_mode, draft_json, chat_json = _serialize_snapshot(snapshot)
    connection.execute(
        """
        INSERT INTO document_drafts (
            user_email,
            document_key,
            status,
            input_mode,
            draft_json,
            chat_json,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_email, document_key) DO UPDATE SET
            status = excluded.status,
            input_mode = excluded.input_mode,
            draft_json = excluded.draft_json,
            chat_json = excluded.chat_json,
            updated_at = excluded.updated_at
        """,
        (
            normalized_email,
            document_key,
            status,
            input_mode,
            draft_json,
            chat_json,
            now,
            now,
        ),
    )
    connection.commit()
    return snapshot
