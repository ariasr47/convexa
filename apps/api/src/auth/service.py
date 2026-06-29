"""
Auth SERVICE — the orchestration logic over the three store ports (signup / login / logout /
session resolution / settings / the Google identity mapping). Imports stdlib + the leaf's own
ports/passwords/cookies/oauth/errors — NEVER engine/signals/live/darkpool/scoring (ARCHITECTURE
§6: the structural guarantee of score byte-identity).

It exposes a small surface main.py drives:
- `resolve_session(cookie_value)` → a `ResolvedSession` (user|None) — a stale/expired/revoked/
  unknown/tampered cookie resolves to ANONYMOUS, never a valid session (AC-D2).
- `signup` / `login` → (identity-shape dict, session_id) | raises AuthError.
- `logout(cookie_value)` → revokes the session row (idempotent).
- `session_status(cookie_value)` → the §2.1 identity shape (ALWAYS resolvable; degrades to
  anonymous on any subsystem fault — AC-J1/D2).
- settings read/write.
- the Google start/callback helpers.

The security floor (AC-H1/H2): no plaintext password, hash, signing key, session id, or secret is
EVER logged or returned. Login failure is generic + non-enumerating (AC-C3/H3).
"""
from __future__ import annotations

import logging
import os
import re
import secrets
import time
from dataclasses import dataclass
from typing import Optional

from . import cookies, errors, google_oauth, passwords
from .ports import AuthStores, SessionRecord, UserRecord

logger = logging.getLogger("Convexa")

# Minimal password floor (surfaced in the 422 message; the FE copy reads it). Backend constant.
PASSWORD_MIN_LENGTH = int(os.getenv("AUTH_PASSWORD_MIN_LENGTH", "8"))

# Session durations (operator config, not product copy — D4). Idle/rolling + absolute cap.
SESSION_IDLE_SECONDS = int(os.getenv("AUTH_SESSION_IDLE_SECONDS", str(7 * 24 * 3600)))
SESSION_ABSOLUTE_SECONDS = int(os.getenv("AUTH_SESSION_ABSOLUTE_SECONDS", str(30 * 24 * 3600)))

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _signing_key() -> str:
    """
    The server-side session-signing key (env-supplied, gitignored). Never logged/returned. If
    unset we derive an ephemeral per-process key so the app runs without config (cookies just don't
    survive a restart — acceptable with the in-memory store, which also resets on restart).
    """
    key = os.getenv("AUTH_SESSION_SIGNING_KEY")
    if key:
        return key
    # Lazily create a stable per-process key (memoized on the module).
    global _EPHEMERAL_KEY
    try:
        return _EPHEMERAL_KEY
    except NameError:
        _EPHEMERAL_KEY = secrets.token_urlsafe(32)
        logger.info("auth: no AUTH_SESSION_SIGNING_KEY set; using an ephemeral per-process key "
                    "(cookies reset on restart — consistent with the in-memory store).")
        return _EPHEMERAL_KEY


# An anti-CSRF state store for the Google flow (process-local; the state is short-lived). Maps an
# opaque state → issue time. Tiny + ephemeral; mirrors the in-memory store's lifetime.
_oauth_states: dict[str, float] = {}
_OAUTH_STATE_TTL = 600.0


@dataclass
class ResolvedSession:
    """The result of resolving a session cookie. `user` is None ⇒ anonymous."""
    user: Optional[UserRecord]
    session_id: Optional[str]

    @property
    def authenticated(self) -> bool:
        return self.user is not None


class AuthService:
    def __init__(self, stores: AuthStores):
        self.stores = stores

    # ------------------------------------------------------------------ identity shape

    def _identity_shape(self, user: Optional[UserRecord]) -> dict:
        """The §2.1 response shape (also returned by signup/login success)."""
        google_avail = False
        try:
            google_avail = google_oauth.available()
        except Exception:
            google_avail = False  # absent/broken config ⇒ unavailable, never a crash (AC-G2)

        if user is None:
            return {
                "authenticated": False,
                "user": None,
                "google_available": google_avail,
                "settings": None,
            }
        settings = self.stores.settings.get(user.id)
        return {
            "authenticated": True,
            "user": {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "auth_methods": user.auth_methods,
            },
            "google_available": google_avail,
            "settings": settings.to_wire() if settings else None,
        }

    # ------------------------------------------------------------------ session resolution

    def resolve_session(self, cookie_value: str | None) -> ResolvedSession:
        """
        Resolve the signed cookie → (user | anonymous). A tampered/unknown/expired/revoked cookie
        ⇒ anonymous (AC-D2). On an idle-window hit, the session's rolling expiry is advanced (D4).
        NEVER raises — any store/verify fault degrades to anonymous (AC-J1).
        """
        try:
            sid = cookies.unsign_cookie(cookie_value, _signing_key())
            if not sid:
                return ResolvedSession(None, None)
            sess = self.stores.sessions.get(sid)
            now = time.time()
            if sess is None or sess.revoked:
                return ResolvedSession(None, None)
            if now >= sess.expires_at or now >= sess.absolute_expires_at:
                return ResolvedSession(None, None)
            user = self.stores.users.get_by_id(sess.user_id)
            if user is None:
                return ResolvedSession(None, None)
            # Rolling/idle refresh: push the idle expiry forward, capped at the absolute expiry.
            new_expiry = min(now + SESSION_IDLE_SECONDS, sess.absolute_expires_at)
            if new_expiry > sess.expires_at:
                try:
                    self.stores.sessions.touch(sid, new_expiry)
                except Exception:
                    pass  # a touch failure must not break resolution
            return ResolvedSession(user, sid)
        except Exception:
            logger.warning("auth: session resolution failed; treating as anonymous", exc_info=False)
            return ResolvedSession(None, None)

    def _new_session(self, user_id: str) -> str:
        """Create a server-side session row and return the opaque session id."""
        now = time.time()
        sid = cookies.new_session_id()
        self.stores.sessions.create(SessionRecord(
            id=sid, user_id=user_id, created_at=now,
            expires_at=now + SESSION_IDLE_SECONDS,
            absolute_expires_at=now + SESSION_ABSOLUTE_SECONDS,
        ))
        return sid

    # ------------------------------------------------------------------ session status (always-200)

    def session_status(self, cookie_value: str | None) -> dict:
        """
        The §2.1 read: ALWAYS resolvable. Any subsystem fault degrades to anonymous (the endpoint
        returns 200 authenticated:false — AC-J1). Never raises.
        """
        try:
            resolved = self.resolve_session(cookie_value)
            return self._identity_shape(resolved.user)
        except Exception:
            logger.warning("auth: session_status failed; returning anonymous", exc_info=False)
            return {"authenticated": False, "user": None,
                    "google_available": False, "settings": None}

    # ------------------------------------------------------------------ signup / login / logout

    def _validate_credentials(self, email: str, password: str):
        if not email or not _EMAIL_RE.match(email.strip()):
            raise errors.validation("Enter a valid email address.")
        if password is None or len(password) < PASSWORD_MIN_LENGTH:
            raise errors.validation(
                f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")

    def signup(self, *, email: str, password: str,
               display_name: str | None) -> tuple[dict, str]:
        """
        Create the user + settings row, open a session, and return (identity-shape, session_id).
        Raises AuthError(409 email_taken / 422 validation). No account is created on any error.
        """
        self._validate_credentials(email or "", password or "")
        pw_hash = passwords.hash_password(password)  # plaintext is never retained past this call
        user = self.stores.users.create(
            email=email, password_hash=pw_hash,
            display_name=(display_name or None), google_sub=None)
        self.stores.settings.upsert_defaults(user.id)
        self.stores.users.mark_login(user.id, time.time())
        sid = self._new_session(user.id)
        return self._identity_shape(user), sid

    def login(self, *, email: str, password: str) -> tuple[dict, str]:
        """
        Verify credentials (NON-ENUMERATING: identical 401 for unknown-email vs wrong-password,
        constant-time-ish via the always-hash pattern — AC-C3/H3) and open a session. Raises
        AuthError(401 bad_credentials / 422 validation). No session on any error.
        """
        if not email or not _EMAIL_RE.match((email or "").strip()):
            raise errors.validation("Enter a valid email address.")
        if not password:
            raise errors.validation("Enter your password.")
        user = self.stores.users.get_by_email(email)
        stored_hash = user.password_hash if user else None
        # Always perform a verify (dummy when no user/hash) so timing does not enumerate.
        if not passwords.verify_password(password, stored_hash):
            raise errors.bad_credentials()
        # user is guaranteed non-None here (verify_password returns False for a None hash).
        self.stores.users.mark_login(user.id, time.time())
        sid = self._new_session(user.id)
        return self._identity_shape(user), sid

    def logout(self, cookie_value: str | None) -> None:
        """Revoke the session row server-side (idempotent — AC-D1). Never raises."""
        try:
            sid = cookies.unsign_cookie(cookie_value, _signing_key())
            if sid:
                self.stores.sessions.revoke(sid)
        except Exception:
            logger.warning("auth: logout revoke failed (idempotent)", exc_info=False)

    # ------------------------------------------------------------------ settings

    def get_settings(self, user: UserRecord) -> dict:
        settings = self.stores.settings.upsert_defaults(user.id)
        return settings.to_wire()

    def write_settings(self, user: UserRecord, patch: dict) -> dict:
        """Apply a subset patch (server-wins, D7) and echo the full saved bag. 422 on bad theme."""
        settings = self.stores.settings.update(user.id, patch)
        return settings.to_wire()

    # ------------------------------------------------------------------ google flow

    def google_available(self) -> bool:
        try:
            return google_oauth.available()
        except Exception:
            return False

    def google_start_url(self) -> str:
        """Issue an anti-CSRF state + build the Google consent URL. Raises if unconfigured."""
        if not self.google_available():
            raise errors.google_unavailable()
        state = secrets.token_urlsafe(24)
        _oauth_states[state] = time.time()
        # Opportunistically prune expired states.
        cutoff = time.time() - _OAUTH_STATE_TTL
        for s in [s for s, t in _oauth_states.items() if t < cutoff]:
            _oauth_states.pop(s, None)
        return google_oauth.authorization_url(state)

    def _consume_state(self, state: str | None) -> bool:
        if not state:
            return False
        issued = _oauth_states.pop(state, None)
        return issued is not None and (time.time() - issued) <= _OAUTH_STATE_TTL

    def google_callback(self, *, code: str | None, state: str | None) -> str:
        """
        Server-side code→token exchange + identity mapping (ARCHITECTURE §4.2):
          known sub → login; verified-email match to a local account → auto-link (D3); else create.
        Returns the session id for the resolved/created user. Raises AuthError on any failure
        (the router maps it to a safe redirect; no secret/token/stack leaks).
        """
        if not self.google_available():
            raise errors.google_unavailable()
        if not self._consume_state(state):
            raise errors.validation("Invalid or expired sign-in state.")
        if not code:
            raise errors.validation("Missing authorization code.")
        try:
            identity = google_oauth.exchange(code)
        except Exception:
            logger.warning("auth: google token exchange failed", exc_info=False)
            raise errors.auth_unavailable()

        # 1. Known Google identity → log that user in.
        user = self.stores.users.get_by_google_sub(identity.sub)
        # 2. Verified-email match to an existing local account → auto-link (D3).
        if user is None and identity.email and identity.email_verified:
            existing = self.stores.users.get_by_email(identity.email)
            if existing is not None:
                user = self.stores.users.attach_google(existing.id, identity.sub)
        # 3. No match → create a Google-only user (no local password) + its settings row.
        if user is None:
            user = self.stores.users.create(
                email=identity.email, password_hash=None,
                display_name=identity.name, google_sub=identity.sub)
            self.stores.settings.upsert_defaults(user.id)

        self.stores.users.mark_login(user.id, time.time())
        return self._new_session(user.id)

    # ------------------------------------------------------------------ cookie helpers

    def signed_cookie_value(self, session_id: str) -> str:
        return cookies.sign_cookie(session_id, _signing_key())
