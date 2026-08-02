"""
Auth store PORTS (the persistence facade boundary) + the normalized record shapes.

Mirrors the `MarketDataProvider` port pattern in `src/providers/base.py`: three abstract
stores define the CONTENT contract (the records below), and a concrete backend plugs in by
implementing them. The in-memory SQLite adapter (`sqlite_store.py`) is the ONLY adapter this
phase; a persistent (Postgres/file) adapter is a future drop-in behind these same ports — that
is the entire swap (BACKEND_EXECUTION_CONTRACT §2 / ARCHITECTURE §5.2).

The records ARE the contract (like the provider TypedDicts). Field names here are internal to
the auth leaf; the wire shape the FE sees is assembled in `service.py` per INTERFACE_CONTRACT.

This module is part of the auth LEAF: it imports only stdlib. engine/signals/live/darkpool/
chain_store/the bundle-compute path NEVER import it (the structural guarantee of score
byte-identity — ARCHITECTURE §6).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


# ----------------------------------------------------------------------------- records

@dataclass
class UserRecord:
    """The credential / identity record (ARCHITECTURE §3.1).

    `password_hash` is a HASH ONLY (argon2, salt included) — never plaintext, and null/absent for
    a Google-only account. `google_sub` is the linked Google subject id (None when not linked).
    `id` is an opaque server-assigned stable identifier — never the email.
    """
    id: str
    email: str                       # canonical, stored lower-cased (case-insensitive unique)
    display_name: Optional[str]      # non-unique, display-only (D2)
    password_hash: Optional[str]     # argon2 hash incl. salt; None for a Google-only account
    google_sub: Optional[str]        # linked Google subject id; None when not linked
    created_at: float                # epoch seconds
    last_login_at: Optional[float]   # epoch seconds; None until first login

    @property
    def has_password(self) -> bool:
        return bool(self.password_hash)

    @property
    def auth_methods(self) -> list[str]:
        """The auth methods this user can sign in with, for the §2.1 identity shape."""
        methods: list[str] = []
        if self.has_password:
            methods.append("password")
        if self.google_sub:
            methods.append("google")
        return methods


@dataclass
class SessionRecord:
    """The server-side session record (ARCHITECTURE §3.2).

    The opaque `id` is what the signed cookie carries; the row is the source of truth. Expiry is
    absolute AND idle/rolling (D4): an active session's `expires_at` is pushed forward on use up
    to `absolute_expires_at`. `revoked` is server-authoritative invalidation independent of the
    cookie. A stale/expired/revoked/unknown session resolves to ANONYMOUS, never a valid session.
    """
    id: str
    user_id: str
    created_at: float
    expires_at: float                # idle/rolling expiry (advanced on active use)
    absolute_expires_at: float       # hard cap regardless of activity
    revoked: bool = False


@dataclass
class SettingsRecord:
    """The bounded per-user settings bag (ARCHITECTURE §3.3).

    Presentation/preference ONLY — NEVER read by signals/engine/live/darkpool/scoring/tiering/the
    fingerprint (AC-F4). Defaults are null (⇒ app default) except theme.
    """
    user_id: str
    active_persona_id: Optional[str] = None
    default_ticker: Optional[str] = None
    theme: str = "dark"
    # Scanner v1 P3 (D1): the per-account scan VIEW, stored as a JSON string ({symbols, name, sort,
    # density}) or None. Presentation/preference only — never a scoring input. Deliberately NOT in
    # to_wire(): the /api/scan/view endpoints are the FE↔BE truth for the view, so the auth session /
    # settings envelope stays byte-identical (INTERFACE §3.4). Read/written via the existing ports.
    scan_view: Optional[str] = None

    def to_wire(self) -> dict:
        """The settings bag as INTERFACE §2.1/§2.6/§2.7 emits it."""
        return {
            "active_persona_id": self.active_persona_id,
            "default_ticker": self.default_ticker,
            "theme": self.theme,
        }


@dataclass
class CredentialRecord:
    """
    The per-user encrypted credential record (byo-ai-key BACKEND_EXECUTION_CONTRACT §4;
    broker-connect extends it with the `kind` discriminator — ONE store, never a fork).

    The RECORD is the contract. It stores the ENCRYPTED ciphertext of the key (never plaintext)
    plus a NON-SECRET masked hint (`last4`) captured as cleartext metadata at SAVE time — so the
    masked-hint read NEVER decrypts. `user_id` is the opaque server id, never the email.

    `kind` discriminates credential families on the SAME row shape: `"ai"` (the original
    BYO-AI-key rows — the default, so every existing call site is untouched) and
    `"broker_webull"` (broker-connect: the ciphertext is a JSON blob of both halves,
    `last4` = last 4 of the App Key). Rows are keyed on (user_id, kind).

    HARD floor: `ciphertext` is treated as a secret (never logged, never returned to a browser).
    `last4` is the ONLY credential datum a response may carry.
    """
    user_id: str
    ciphertext: str                  # Fernet token of the raw key — NEVER plaintext, NEVER returned
    last4: str                       # cleartext masked hint (last 4 chars) — set at save time
    created_at: float
    updated_at: float
    kind: str = "ai"                 # credential-kind discriminator (additive; default = legacy)


# ----------------------------------------------------------------------------- ports

class UserStore(ABC):
    """Create/lookup users; create with a password hash; attach a Google identity (ARCH §5.2)."""

    @abstractmethod
    def get_by_id(self, user_id: str) -> Optional[UserRecord]:
        ...

    @abstractmethod
    def get_by_email(self, email: str) -> Optional[UserRecord]:
        """Case-insensitive email lookup (caller may pass any case)."""

    @abstractmethod
    def get_by_google_sub(self, google_sub: str) -> Optional[UserRecord]:
        ...

    @abstractmethod
    def create(self, *, email: str, password_hash: Optional[str],
               display_name: Optional[str], google_sub: Optional[str] = None) -> UserRecord:
        """Create a user. Raises EmailTakenError on a case-insensitive email collision."""

    @abstractmethod
    def attach_google(self, user_id: str, google_sub: str) -> UserRecord:
        """Link a Google subject onto an existing user (account-linking, ARCHITECTURE §4.2)."""

    @abstractmethod
    def mark_login(self, user_id: str, when: float) -> None:
        """Stamp last_login_at (audit basics)."""


class SessionStore(ABC):
    """Create/resolve/revoke server-side sessions (ARCH §5.2). The row is the source of truth."""

    @abstractmethod
    def create(self, session: SessionRecord) -> None:
        ...

    @abstractmethod
    def get(self, session_id: str) -> Optional[SessionRecord]:
        """Return the raw row (no expiry/revocation interpretation — the service applies that)."""

    @abstractmethod
    def touch(self, session_id: str, new_expires_at: float) -> None:
        """Advance the idle/rolling expiry on active use (D4)."""

    @abstractmethod
    def revoke(self, session_id: str) -> None:
        """Server-authoritative single-session revocation (logout)."""

    @abstractmethod
    def revoke_all_for_user(self, user_id: str) -> None:
        """Designed-for 'log out everywhere' (built but not surfaced this phase)."""


class UserSettingsStore(ABC):
    """Read/write the bounded per-user settings bag (ARCH §5.2)."""

    @abstractmethod
    def get(self, user_id: str) -> Optional[SettingsRecord]:
        ...

    @abstractmethod
    def upsert_defaults(self, user_id: str) -> SettingsRecord:
        """Create the user's settings row at defaults if absent; return it."""

    @abstractmethod
    def update(self, user_id: str, patch: dict) -> SettingsRecord:
        """Apply a subset patch (server-wins, D7) and return the full saved bag."""


class UserCredentialStore(ABC):
    """
    The FOURTH storage port (byo-ai-key BACKEND_EXECUTION_CONTRACT §4): the per-user encrypted
    credentials. Mirrors the other three ports. The adapter stores the ciphertext + masked hint;
    it NEVER sees the encryption secret (the crypto leaf owns that). `get_decrypted` is the ONLY
    decrypting op and is server-side ONLY — used SOLELY by §1 resolution, NEVER feeding a
    response.

    broker-connect: every method takes the ADDITIVE `kind` keyword (default `"ai"` — existing
    call sites unchanged); adapters key rows on (user_id, kind). One store, never a fork.
    """

    @abstractmethod
    def set_key(self, user_id: str, ciphertext: str, last4: str, kind: str = "ai") -> None:
        """Encrypt-at-rest store / OVERWRITE of the (user_id, kind) row (rotate == overwrite,
        no history)."""

    @abstractmethod
    def get_record(self, user_id: str, kind: str = "ai") -> Optional[CredentialRecord]:
        """Raw record (ciphertext + hint). Server-side only; the caller never serializes ciphertext."""

    @abstractmethod
    def delete_key(self, user_id: str, kind: str = "ai") -> None:
        """Delete the stored (user_id, kind) credential. Idempotent."""


# ----------------------------------------------------------------------------- store bundle

@dataclass
class AuthStores:
    """The four ports a backend adapter supplies, returned by the env-selected factory."""
    users: UserStore
    sessions: SessionStore
    settings: UserSettingsStore
    credentials: UserCredentialStore
