"""
In-memory SQLite adapter — the ONLY store adapter this phase (BACKEND_EXECUTION_CONTRACT §2 /
ARCHITECTURE §5.2).

A bare `sqlite3 :memory:` DB is per-connection and vanishes when that connection closes, so we
hold ONE shared connection for the process lifetime (`check_same_thread=False`) guarded by a
module-level lock — giving "one process-wide in-memory DB that survives across requests and is
thread-safe under FastAPI's threaded handling (bundle compute runs in to_thread)". It RESETS on
restart (accepted prototype property).

The persistent (Postgres/file) adapter is NOT built this phase — it is a future drop-in behind
the same three ports (`ports.py`). The seam: implement the ports, register in the factory
(`__init__.get_stores`), set `ACCOUNT_STORE`. Nothing else changes.

This module is part of the auth LEAF: it imports only stdlib + its own ports/errors.
"""
from __future__ import annotations

import sqlite3
import threading
import time
import uuid
from typing import Optional

from . import errors
from .ports import (AuthStores, SessionRecord, SettingsRecord, UserRecord,
                    UserStore, SessionStore, UserSettingsStore)

_VALID_THEMES = {"dark", "light", "system"}


def _new_id() -> str:
    return uuid.uuid4().hex


class _SharedDB:
    """One shared in-memory connection + a lock. All adapters below share this instance."""

    def __init__(self):
        # A single connection makes the :memory: DB persist for the process lifetime; the lock
        # serializes access so concurrent worker threads (to_thread) are safe. Volume is tiny
        # (auth lookups), so a coarse lock is fine and avoids cross-connection :memory: issues.
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(":memory:", check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        with self._conn:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id            TEXT PRIMARY KEY,
                    email         TEXT NOT NULL,
                    email_lower   TEXT NOT NULL UNIQUE,
                    display_name  TEXT,
                    password_hash TEXT,
                    google_sub    TEXT UNIQUE,
                    created_at    REAL NOT NULL,
                    last_login_at REAL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    id                  TEXT PRIMARY KEY,
                    user_id             TEXT NOT NULL,
                    created_at          REAL NOT NULL,
                    expires_at          REAL NOT NULL,
                    absolute_expires_at REAL NOT NULL,
                    revoked             INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS settings (
                    user_id           TEXT PRIMARY KEY,
                    active_persona_id TEXT,
                    default_ticker    TEXT,
                    theme             TEXT NOT NULL DEFAULT 'dark'
                );
                """
            )


# Process-wide shared DB (the in-memory DB that survives across requests).
_db = _SharedDB()


def _row_to_user(row: sqlite3.Row) -> UserRecord:
    return UserRecord(
        id=row["id"], email=row["email"], display_name=row["display_name"],
        password_hash=row["password_hash"], google_sub=row["google_sub"],
        created_at=row["created_at"], last_login_at=row["last_login_at"],
    )


class SqliteUserStore(UserStore):
    def get_by_id(self, user_id: str) -> Optional[UserRecord]:
        with _db._lock:
            row = _db._conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return _row_to_user(row) if row else None

    def get_by_email(self, email: str) -> Optional[UserRecord]:
        with _db._lock:
            row = _db._conn.execute(
                "SELECT * FROM users WHERE email_lower = ?", (email.strip().lower(),)).fetchone()
        return _row_to_user(row) if row else None

    def get_by_google_sub(self, google_sub: str) -> Optional[UserRecord]:
        with _db._lock:
            row = _db._conn.execute(
                "SELECT * FROM users WHERE google_sub = ?", (google_sub,)).fetchone()
        return _row_to_user(row) if row else None

    def create(self, *, email: str, password_hash: Optional[str],
               display_name: Optional[str], google_sub: Optional[str] = None) -> UserRecord:
        email = email.strip()
        email_lower = email.lower()
        user_id = _new_id()
        now = time.time()
        with _db._lock:
            exists = _db._conn.execute(
                "SELECT 1 FROM users WHERE email_lower = ?", (email_lower,)).fetchone()
            if exists:
                raise errors.email_taken()
            try:
                with _db._conn:
                    _db._conn.execute(
                        "INSERT INTO users (id, email, email_lower, display_name, password_hash, "
                        "google_sub, created_at, last_login_at) VALUES (?,?,?,?,?,?,?,?)",
                        (user_id, email, email_lower, display_name, password_hash, google_sub,
                         now, None),
                    )
            except sqlite3.IntegrityError:
                # Race on the unique constraint ⇒ treat as taken (non-enumerating wire shape).
                raise errors.email_taken()
        return UserRecord(id=user_id, email=email, display_name=display_name,
                          password_hash=password_hash, google_sub=google_sub,
                          created_at=now, last_login_at=None)

    def attach_google(self, user_id: str, google_sub: str) -> UserRecord:
        with _db._lock:
            with _db._conn:
                _db._conn.execute(
                    "UPDATE users SET google_sub = ? WHERE id = ?", (google_sub, user_id))
            row = _db._conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return _row_to_user(row)

    def mark_login(self, user_id: str, when: float) -> None:
        with _db._lock:
            with _db._conn:
                _db._conn.execute(
                    "UPDATE users SET last_login_at = ? WHERE id = ?", (when, user_id))


class SqliteSessionStore(SessionStore):
    def create(self, session: SessionRecord) -> None:
        with _db._lock:
            with _db._conn:
                _db._conn.execute(
                    "INSERT INTO sessions (id, user_id, created_at, expires_at, "
                    "absolute_expires_at, revoked) VALUES (?,?,?,?,?,?)",
                    (session.id, session.user_id, session.created_at, session.expires_at,
                     session.absolute_expires_at, 1 if session.revoked else 0),
                )

    def get(self, session_id: str) -> Optional[SessionRecord]:
        with _db._lock:
            row = _db._conn.execute(
                "SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not row:
            return None
        return SessionRecord(
            id=row["id"], user_id=row["user_id"], created_at=row["created_at"],
            expires_at=row["expires_at"], absolute_expires_at=row["absolute_expires_at"],
            revoked=bool(row["revoked"]),
        )

    def touch(self, session_id: str, new_expires_at: float) -> None:
        with _db._lock:
            with _db._conn:
                _db._conn.execute(
                    "UPDATE sessions SET expires_at = ? WHERE id = ?",
                    (new_expires_at, session_id))

    def revoke(self, session_id: str) -> None:
        with _db._lock:
            with _db._conn:
                _db._conn.execute(
                    "UPDATE sessions SET revoked = 1 WHERE id = ?", (session_id,))

    def revoke_all_for_user(self, user_id: str) -> None:
        with _db._lock:
            with _db._conn:
                _db._conn.execute(
                    "UPDATE sessions SET revoked = 1 WHERE user_id = ?", (user_id,))


class SqliteUserSettingsStore(UserSettingsStore):
    def get(self, user_id: str) -> Optional[SettingsRecord]:
        with _db._lock:
            row = _db._conn.execute(
                "SELECT * FROM settings WHERE user_id = ?", (user_id,)).fetchone()
        if not row:
            return None
        return SettingsRecord(
            user_id=row["user_id"], active_persona_id=row["active_persona_id"],
            default_ticker=row["default_ticker"], theme=row["theme"],
        )

    def upsert_defaults(self, user_id: str) -> SettingsRecord:
        with _db._lock:
            with _db._conn:
                _db._conn.execute(
                    "INSERT OR IGNORE INTO settings (user_id, active_persona_id, default_ticker, "
                    "theme) VALUES (?, NULL, NULL, 'dark')", (user_id,))
            row = _db._conn.execute(
                "SELECT * FROM settings WHERE user_id = ?", (user_id,)).fetchone()
        return SettingsRecord(
            user_id=row["user_id"], active_persona_id=row["active_persona_id"],
            default_ticker=row["default_ticker"], theme=row["theme"],
        )

    def update(self, user_id: str, patch: dict) -> SettingsRecord:
        # Validate theme (the only enumerated field) BEFORE the write; 422 on a bad value.
        if "theme" in patch and patch["theme"] is not None and patch["theme"] not in _VALID_THEMES:
            raise errors.validation(
                "theme must be one of 'dark', 'light', or 'system'.")
        with _db._lock:
            with _db._conn:
                _db._conn.execute(
                    "INSERT OR IGNORE INTO settings (user_id, active_persona_id, default_ticker, "
                    "theme) VALUES (?, NULL, NULL, 'dark')", (user_id,))
                # Apply only the keys present in the patch (subset write; server-wins, D7).
                for col in ("active_persona_id", "default_ticker", "theme"):
                    if col in patch:
                        _db._conn.execute(
                            f"UPDATE settings SET {col} = ? WHERE user_id = ?",
                            (patch[col], user_id))
            row = _db._conn.execute(
                "SELECT * FROM settings WHERE user_id = ?", (user_id,)).fetchone()
        return SettingsRecord(
            user_id=row["user_id"], active_persona_id=row["active_persona_id"],
            default_ticker=row["default_ticker"], theme=row["theme"],
        )


def make_stores() -> AuthStores:
    """Construct the three-port bundle over the shared in-memory DB."""
    return AuthStores(
        users=SqliteUserStore(),
        sessions=SqliteSessionStore(),
        settings=SqliteUserSettingsStore(),
    )
