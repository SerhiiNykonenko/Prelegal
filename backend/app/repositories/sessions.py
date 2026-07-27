from datetime import UTC, datetime, timedelta
import hashlib
import secrets
import sqlite3


def _hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(connection: sqlite3.Connection, *, user_id: int, session_days: int) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    token_hash = _hash_session_token(token)
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=session_days)
    connection.execute(
        """
        INSERT INTO sessions (user_id, session_token_hash, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, token_hash, now.isoformat(), expires_at.isoformat()),
    )
    connection.commit()
    return token, expires_at.isoformat()


def get_user_by_session_token(connection: sqlite3.Connection, session_token: str) -> sqlite3.Row | None:
    token_hash = _hash_session_token(session_token)
    now = datetime.now(UTC).isoformat()
    row = connection.execute(
        """
        SELECT users.id, users.email, sessions.id AS session_id, sessions.expires_at
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.session_token_hash = ? AND sessions.expires_at > ?
        """,
        (token_hash, now),
    ).fetchone()
    return row


def delete_session(connection: sqlite3.Connection, session_token: str) -> None:
    token_hash = _hash_session_token(session_token)
    connection.execute("DELETE FROM sessions WHERE session_token_hash = ?", (token_hash,))
    connection.commit()


def delete_expired_sessions(connection: sqlite3.Connection) -> None:
    now = datetime.now(UTC).isoformat()
    connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
    connection.commit()
