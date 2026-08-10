"""
Persistent Postgres adapter for the four auth store ports (persistent-db ARCHITECTURE §1/§3/§6).

A drop-in sibling of `sqlite_store.py`, implementing the SAME four ports
(`UserStore`/`SessionStore`/`UserSettingsStore`/`UserCredentialStore`) so accounts / sessions /
per-user settings / encrypted AI keys SURVIVE restarts and span replicas — selected by the env
factory (`ACCOUNT_STORE=postgres` + `DATABASE_URL`). The in-memory SQLite adapter stays the default.

Design (ARCHITECTURE §1):
  - RAW parameterized SQL mirroring `sqlite_store.py` STATEMENT-FOR-STATEMENT (no ORM, no Alembic),
    so the two adapters stay diff-able line-by-line and the port-contract semantics match exactly.
    The only deltas from the sqlite SQL are the §3.5 dialect items: `?`->`%s`, `REAL`->
    `DOUBLE PRECISION`, INTEGER-boolean->native `BOOLEAN`, `INSERT OR IGNORE`->`ON CONFLICT ... DO
    NOTHING`, and catching `psycopg.errors.UniqueViolation` (vs `sqlite3.IntegrityError`).
  - psycopg 3 in SYNCHRONOUS mode (the ports are sync ABCs; NO async/await — matching the existing
    concurrency model so this is a true drop-in, not a rewrite).
  - A single process-wide `psycopg_pool.ConnectionPool` REPLACES the sqlite `_SharedDB` module lock:
    Postgres handles concurrency server-side (MVCC + row locks + the UNIQUE constraints), so
    correctness moves to atomic SQL + transactions (§6), not a coarse process lock.
  - Idempotent `CREATE TABLE/INDEX IF NOT EXISTS` bootstrap, run once at `make_stores()` construction
    (mirrors the sqlite constructor; NO migration tool — §3.7). Multi-replica-safe.

Fail mode (ARCHITECTURE §5): this adapter NEVER swallows a connection/operational error into a
false-success or a false-empty — a read/write that cannot reach the DB RAISES, so the existing
service/router/main machinery degrades correctly (signup/login/gated -> 503 auth_unavailable;
who-am-I -> anonymous; AI-key -> storage_available:false), while the anonymous bundle/SSE/trader
path (which never opens a DB connection) stays fully UP. Auth fails CLOSED.

Ciphertext boundary (ARCHITECTURE §3.4/§8): `ai_credentials.ciphertext` holds ONLY the Fernet token
produced by `crypto.py` BEFORE it reaches the store; `last4` is the only non-secret hint. This
adapter NEVER encrypts/decrypts and NEVER sees `AI_KEY_ENCRYPTION_KEY`.

This module is part of the auth LEAF: it imports ONLY stdlib + `psycopg`/`psycopg_pool` + the leaf's
own ports/errors. engine/signals/live/darkpool/chain_store/the bundle-compute path NEVER import it
(the structural guarantee of score byte-identity — ARCHITECTURE §11).
"""
from __future__ import annotations

import logging
import os
import time
import uuid
from typing import Optional

import psycopg
from psycopg.errors import UniqueViolation
from psycopg_pool import ConnectionPool

from . import errors
from .ports import (AuthStores, CredentialRecord, SessionRecord, SettingsRecord, UserRecord,
                    UserStore, SessionStore, UserSettingsStore, UserCredentialStore)

logger = logging.getLogger("Convexa")

# Mirror sqlite_store._VALID_THEMES — theme is validated HERE (the adapter) before the write, so a
# bad theme is a clean 422 (errors.validation), NEVER a DB CHECK -> 5xx (ARCHITECTURE §3.3).
_VALID_THEMES = {"dark", "light", "system"}

# Pool max size — pure operator config (NOT an interface), small default (ARCHITECTURE §1.3/§9).
_DEFAULT_POOL_MAX = int(os.getenv("DATABASE_POOL_MAX", "10"))


def _new_id() -> str:
    return uuid.uuid4().hex


# ----------------------------------------------------------------------------- shared pool + schema

class _SharedPool:
    """
    One process-wide connection pool + the schema bootstrap. The pool REPLACES the sqlite
    `_SharedDB` lock — Postgres serializes concurrency itself; the pool just hands out connections
    to worker threads / replicas. Created once per `make_stores(database_url)`.
    """

    def __init__(self, database_url: str, pool_max: int = _DEFAULT_POOL_MAX):
        # open=False + a non-blocking open so an UNREACHABLE DB at boot does NOT crash the process:
        # the fault surfaces on FIRST USE as the auth error class (ARCHITECTURE §1.3/§5). A real DB
        # boots the pool and the bootstrap below runs the idempotent DDL.
        self._pool = ConnectionPool(
            conninfo=database_url, min_size=1, max_size=max(1, pool_max), open=False)
        try:
            self._pool.open(wait=False)
        except Exception:
            # Never crash boot on a dead DB — first use will raise into the auth machinery.
            logger.warning("auth/postgres: pool open deferred (DB unreachable at boot?)",
                           exc_info=False)
        self._init_schema_best_effort()

    def _init_schema_best_effort(self) -> None:
        """
        Run the idempotent bootstrap once at construction. A DB that is unreachable at boot must NOT
        crash the process (ARCHITECTURE §1.3/§3.7) — the DDL is retried implicitly on first real use
        (every op opens a fresh pooled connection; the tables exist by then if the DB came up). A
        concurrent multi-replica boot racing the `IF NOT EXISTS` DDL is tolerated (benign).
        """
        try:
            self._init_schema()
        except Exception:
            logger.warning("auth/postgres: schema bootstrap deferred (DB unreachable at boot?); "
                           "will run on first reachable use", exc_info=False)

    def _init_schema(self) -> None:
        # Mirrors sqlite_store._SharedDB._init_schema table-for-table, Postgres types per §3.5.
        # SCHEMA-EVOLUTION SEAM (ARCHITECTURE §3.7): the FIRST future schema change adds a tiny
        # `schema_version` table + ordered idempotent steps here, OR adopts a migration tool then.
        # This feature ships the fresh schema only.
        with self._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id            TEXT PRIMARY KEY,
                        email         TEXT NOT NULL,
                        email_lower   TEXT NOT NULL UNIQUE,
                        display_name  TEXT,
                        password_hash TEXT,
                        google_sub    TEXT UNIQUE,
                        created_at    DOUBLE PRECISION NOT NULL,
                        last_login_at DOUBLE PRECISION
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS sessions (
                        id                  TEXT PRIMARY KEY,
                        user_id             TEXT NOT NULL,
                        created_at          DOUBLE PRECISION NOT NULL,
                        expires_at          DOUBLE PRECISION NOT NULL,
                        absolute_expires_at DOUBLE PRECISION NOT NULL,
                        revoked             BOOLEAN NOT NULL DEFAULT FALSE
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS settings (
                        user_id           TEXT PRIMARY KEY,
                        active_persona_id TEXT,
                        default_ticker    TEXT,
                        theme             TEXT NOT NULL DEFAULT 'dark',
                        scan_view         TEXT
                    )
                    """
                )
                # Scanner v1 P3 schema-evolution (ARCHITECTURE §3.7 first change): additively add the
                # scan_view column to an ALREADY-DEPLOYED settings table. Idempotent + multi-replica-
                # safe (ADD COLUMN IF NOT EXISTS); existing rows keep their data, the new column
                # defaults NULL ([loss-free-durable-migration]).
                cur.execute(
                    "ALTER TABLE settings ADD COLUMN IF NOT EXISTS scan_view TEXT")
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS ai_credentials (
                        user_id    TEXT NOT NULL,
                        kind       TEXT NOT NULL DEFAULT 'ai',
                        ciphertext TEXT NOT NULL,
                        last4      TEXT NOT NULL,
                        created_at DOUBLE PRECISION NOT NULL,
                        updated_at DOUBLE PRECISION NOT NULL
                    )
                    """
                )
                # broker-connect schema-evolution (ARCHITECTURE §3.7 seam, second use): the
                # credential-kind discriminator lands ADDITIVELY on an already-deployed
                # ai_credentials table. Existing rows keep their data and become kind='ai'
                # ([loss-free-durable-migration] — nothing durable is reshaped, a column is
                # added with the legacy default). The PK moves user_id -> (user_id, kind) via
                # an idempotent, named-constraint swap (multi-replica-safe: the second racer's
                # DO block sees the named constraint and no-ops).
                cur.execute(
                    "ALTER TABLE ai_credentials ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL "
                    "DEFAULT 'ai'")
                cur.execute(
                    """
                    DO $$ BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint
                            WHERE conname = 'ai_credentials_user_kind_pk'
                              AND conrelid = 'ai_credentials'::regclass
                        ) THEN
                            ALTER TABLE ai_credentials
                                DROP CONSTRAINT IF EXISTS ai_credentials_pkey;
                            ALTER TABLE ai_credentials
                                ADD CONSTRAINT ai_credentials_user_kind_pk
                                PRIMARY KEY (user_id, kind);
                        END IF;
                    END $$
                    """
                )
                # Index for revoke_all_for_user ("log out everywhere") — the single-session reads
                # hit the PK. The UNIQUE constraints above already index email_lower + google_sub.
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)")
            conn.commit()


# ----------------------------------------------------------------------------- record mappers
# Structurally identical to sqlite_store's mappers; psycopg's default row is a tuple, so map by
# position from an explicit column order (kept in lockstep with the SELECT column lists below).

def _row_to_user(row) -> UserRecord:
    return UserRecord(
        id=row[0], email=row[1], display_name=row[3],
        password_hash=row[4], google_sub=row[5],
        created_at=row[6], last_login_at=row[7],
    )


_USER_COLS = "id, email, email_lower, display_name, password_hash, google_sub, created_at, " \
             "last_login_at"


class PgUserStore(UserStore):
    def __init__(self, pool: _SharedPool):
        self._p = pool

    def get_by_id(self, user_id: str) -> Optional[UserRecord]:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT {_USER_COLS} FROM users WHERE id = %s", (user_id,))
                row = cur.fetchone()
        return _row_to_user(row) if row else None

    def get_by_email(self, email: str) -> Optional[UserRecord]:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT {_USER_COLS} FROM users WHERE email_lower = %s",
                    (email.strip().lower(),))
                row = cur.fetchone()
        return _row_to_user(row) if row else None

    def get_by_google_sub(self, google_sub: str) -> Optional[UserRecord]:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT {_USER_COLS} FROM users WHERE google_sub = %s", (google_sub,))
                row = cur.fetchone()
        return _row_to_user(row) if row else None

    def create(self, *, email: str, password_hash: Optional[str],
               display_name: Optional[str], google_sub: Optional[str] = None) -> UserRecord:
        email = email.strip()
        email_lower = email.lower()
        user_id = _new_id()
        now = time.time()
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                # Optional pre-check (the common clean-409, parity with sqlite) — the UNIQUE
                # constraint below is the real guarantee under concurrency / multi-replica (§6.4).
                cur.execute("SELECT 1 FROM users WHERE email_lower = %s", (email_lower,))
                if cur.fetchone():
                    raise errors.email_taken()
                try:
                    cur.execute(
                        "INSERT INTO users (id, email, email_lower, display_name, password_hash, "
                        "google_sub, created_at, last_login_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                        (user_id, email, email_lower, display_name, password_hash, google_sub,
                         now, None),
                    )
                    conn.commit()
                except UniqueViolation:
                    # Race on the unique constraint => treat as taken (non-enumerating wire shape).
                    conn.rollback()
                    raise errors.email_taken()
        return UserRecord(id=user_id, email=email, display_name=display_name,
                          password_hash=password_hash, google_sub=google_sub,
                          created_at=now, last_login_at=None)

    def attach_google(self, user_id: str, google_sub: str) -> UserRecord:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET google_sub = %s WHERE id = %s", (google_sub, user_id))
                cur.execute(f"SELECT {_USER_COLS} FROM users WHERE id = %s", (user_id,))
                row = cur.fetchone()
            conn.commit()
        return _row_to_user(row)

    def mark_login(self, user_id: str, when: float) -> None:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET last_login_at = %s WHERE id = %s", (when, user_id))
            conn.commit()


class PgSessionStore(SessionStore):
    def __init__(self, pool: _SharedPool):
        self._p = pool

    def create(self, session: SessionRecord) -> None:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO sessions (id, user_id, created_at, expires_at, "
                    "absolute_expires_at, revoked) VALUES (%s,%s,%s,%s,%s,%s)",
                    (session.id, session.user_id, session.created_at, session.expires_at,
                     session.absolute_expires_at, bool(session.revoked)),
                )
            conn.commit()

    def get(self, session_id: str) -> Optional[SessionRecord]:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, user_id, created_at, expires_at, absolute_expires_at, revoked "
                    "FROM sessions WHERE id = %s", (session_id,))
                row = cur.fetchone()
        if not row:
            return None
        return SessionRecord(
            id=row[0], user_id=row[1], created_at=row[2],
            expires_at=row[3], absolute_expires_at=row[4],
            revoked=bool(row[5]),
        )

    def touch(self, session_id: str, new_expires_at: float) -> None:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE sessions SET expires_at = %s WHERE id = %s",
                    (new_expires_at, session_id))
            conn.commit()

    def revoke(self, session_id: str) -> None:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE sessions SET revoked = TRUE WHERE id = %s", (session_id,))
            conn.commit()

    def revoke_all_for_user(self, user_id: str) -> None:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE sessions SET revoked = TRUE WHERE user_id = %s", (user_id,))
            conn.commit()


def _row_to_settings(row) -> SettingsRecord:
    return SettingsRecord(
        user_id=row[0], active_persona_id=row[1],
        default_ticker=row[2], theme=row[3], scan_view=row[4],
    )


_SETTINGS_COLS = "user_id, active_persona_id, default_ticker, theme, scan_view"


class PgUserSettingsStore(UserSettingsStore):
    def __init__(self, pool: _SharedPool):
        self._p = pool

    def get(self, user_id: str) -> Optional[SettingsRecord]:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT {_SETTINGS_COLS} FROM settings WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
        return _row_to_settings(row) if row else None

    def upsert_defaults(self, user_id: str) -> SettingsRecord:
        # ONE transaction: ensure-row (ON CONFLICT DO NOTHING) then SELECT, so a concurrent creator
        # can't interleave a missing-row read (§6.3). Mirrors sqlite's INSERT OR IGNORE + read.
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO settings (user_id, active_persona_id, default_ticker, theme) "
                    "VALUES (%s, NULL, NULL, 'dark') ON CONFLICT (user_id) DO NOTHING", (user_id,))
                cur.execute(
                    f"SELECT {_SETTINGS_COLS} FROM settings WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
            conn.commit()
        return _row_to_settings(row)

    def update(self, user_id: str, patch: dict) -> SettingsRecord:
        # Validate theme (the only enumerated field) BEFORE the write; 422 on a bad value — kept in
        # the adapter (mirror _VALID_THEMES), NOT a DB CHECK, so it stays a clean 422 (§3.3).
        if "theme" in patch and patch["theme"] is not None and patch["theme"] not in _VALID_THEMES:
            raise errors.validation(
                "theme must be one of 'dark', 'light', or 'system'.")
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO settings (user_id, active_persona_id, default_ticker, theme) "
                    "VALUES (%s, NULL, NULL, 'dark') ON CONFLICT (user_id) DO NOTHING", (user_id,))
                # Apply only the keys present in the patch (subset write; server-wins, D7).
                for col in ("active_persona_id", "default_ticker", "theme", "scan_view"):
                    if col in patch:
                        cur.execute(
                            f"UPDATE settings SET {col} = %s WHERE user_id = %s",
                            (patch[col], user_id))
                cur.execute(
                    f"SELECT {_SETTINGS_COLS} FROM settings WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
            conn.commit()
        return _row_to_settings(row)


class PgUserCredentialStore(UserCredentialStore):
    """
    Postgres adapter for the per-user encrypted AI key (byo-ai-key §4). Stores the Fernet
    ciphertext + the cleartext masked hint (`last4`) — NEVER the plaintext key. The encryption
    happens in `crypto.py` BEFORE the store; this adapter NEVER decrypts and NEVER sees the secret.
    """

    def __init__(self, pool: _SharedPool):
        self._p = pool

    def set_key(self, user_id: str, ciphertext: str, last4: str, kind: str = "ai") -> None:
        now = time.time()
        # ONE atomic upsert (set OR rotate). created_at is OMITTED from the DO UPDATE SET clause so
        # the existing value is PRESERVED on rotate (set on first insert) — the clean single-
        # statement way, no read race (§6.2). Identical net behavior to the sqlite read-then-write.
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO ai_credentials (user_id, kind, ciphertext, last4, created_at, "
                    "updated_at) VALUES (%s,%s,%s,%s,%s,%s) "
                    "ON CONFLICT (user_id, kind) DO UPDATE SET ciphertext=EXCLUDED.ciphertext, "
                    "last4=EXCLUDED.last4, updated_at=EXCLUDED.updated_at",
                    (user_id, kind, ciphertext, last4, now, now))
            conn.commit()

    def get_record(self, user_id: str, kind: str = "ai") -> Optional[CredentialRecord]:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT user_id, ciphertext, last4, created_at, updated_at, kind "
                    "FROM ai_credentials WHERE user_id = %s AND kind = %s", (user_id, kind))
                row = cur.fetchone()
        if not row:
            return None
        return CredentialRecord(
            user_id=row[0], ciphertext=row[1], last4=row[2],
            created_at=row[3], updated_at=row[4], kind=row[5],
        )

    def delete_key(self, user_id: str, kind: str = "ai") -> None:
        with self._p._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM ai_credentials WHERE user_id = %s AND kind = %s",
                    (user_id, kind))
            conn.commit()


def make_stores(database_url: str) -> AuthStores:
    """
    Construct the four-port bundle over a single process-wide connection pool, running the
    idempotent schema bootstrap on construction (ARCHITECTURE §1.3/§3.7). A DB that is unreachable
    at boot does NOT crash here — the fault surfaces on first use as the auth error class (§5).
    """
    if not database_url:
        raise ValueError("postgres_store.make_stores requires a non-empty DATABASE_URL")
    pool = _SharedPool(database_url)
    return AuthStores(
        users=PgUserStore(pool),
        sessions=PgSessionStore(pool),
        settings=PgUserSettingsStore(pool),
        credentials=PgUserCredentialStore(pool),
    )
