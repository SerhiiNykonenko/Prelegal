from datetime import UTC, datetime
import hashlib
import hmac
import secrets
import sqlite3


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    password_hash = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f"scrypt${salt}${password_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    algorithm, salt, password_hash = stored_hash.split("$", 2)
    if algorithm != "scrypt":
        return False
    candidate = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return hmac.compare_digest(candidate, password_hash)


def create_user(connection: sqlite3.Connection, email: str, password: str) -> dict[str, int | str]:
    normalized_email = normalize_email(email)
    now = datetime.now(UTC).isoformat()
    cursor = connection.execute(
        """
        INSERT INTO users (email, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        """,
        (normalized_email, hash_password(password), now, now),
    )
    connection.commit()
    return {"id": cursor.lastrowid, "email": normalized_email}


def get_user_by_email(connection: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    normalized_email = normalize_email(email)
    return connection.execute(
        "SELECT id, email, password_hash FROM users WHERE email = ?",
        (normalized_email,),
    ).fetchone()
