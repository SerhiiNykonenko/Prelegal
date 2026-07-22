from datetime import UTC, datetime
import sqlite3


def normalize_email(email: str) -> str:
    return email.strip().lower()


def upsert_user_for_fake_login(connection: sqlite3.Connection, email: str, password_text: str) -> dict[str, int | str]:
    normalized_email = normalize_email(email)
    now = datetime.now(UTC).isoformat()
    connection.execute(
        """
        INSERT INTO users (email, password_text, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
            password_text = excluded.password_text,
            updated_at = excluded.updated_at
        """,
        (normalized_email, password_text, now, now),
    )
    connection.commit()
    user = connection.execute(
        "SELECT id, email FROM users WHERE email = ?",
        (normalized_email,),
    ).fetchone()
    return {"id": user["id"], "email": user["email"]}
