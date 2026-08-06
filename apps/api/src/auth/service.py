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

import json
import logging
import os
import re
import secrets
import time
from dataclasses import dataclass
from typing import Callable, Optional

from . import cookies, crypto, errors, google_oauth, passwords, policy
from .ports import AuthStores, SessionRecord, UserRecord

logger = logging.getLogger("Convexa")

# Minimal password floor (surfaced in the 422 message; the FE copy reads it). Backend constant.
PASSWORD_MIN_LENGTH = int(os.getenv("AUTH_PASSWORD_MIN_LENGTH", "8"))

# Session durations (operator config, not product copy — D4). Idle/rolling + absolute cap.
SESSION_IDLE_SECONDS = int(os.getenv("AUTH_SESSION_IDLE_SECONDS", str(7 * 24 * 3600)))
SESSION_ABSOLUTE_SECONDS = int(os.getenv("AUTH_SESSION_ABSOLUTE_SECONDS", str(30 * 24 * 3600)))

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# broker-connect: the credential-kind discriminator value for the Webull App Key/Secret pair
# (ONE store, kind-discriminated — never a second credential store).
CREDENTIAL_KIND_BROKER = "broker_webull"


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
        # DEV-ONLY hint: the email of a seeded fixed test account (set by main.py's gated seed) so
        # who-am-I can advertise it and the login form can pre-fill it. None in production (postgres
        # skips seeding), so `demo_seed` is null there and no pre-fill ever shows.
        self._demo_seed_email: Optional[str] = None
        # broker-connect: the B5 book-cache invalidation hook (set by main.py at wiring time —
        # the auth leaf never imports the broker leaf). Called on broker-credential delete AND
        # set/rotate so a dead credential never leaves a ghost book (AC-3).
        self._broker_cache_invalidator: Optional[Callable[[str], None]] = None

    def set_broker_cache_invalidator(self, fn: Callable[[str], None]) -> None:
        """Register the per-user broker book-cache invalidation hook (main.py wiring)."""
        self._broker_cache_invalidator = fn

    def _invalidate_broker_cache(self, user_id: str) -> None:
        """Best-effort: a hook fault must never break a credential write/delete."""
        if self._broker_cache_invalidator is None:
            return
        try:
            self._broker_cache_invalidator(user_id)
        except Exception:
            logger.warning("auth: broker cache invalidation hook faulted", exc_info=False)

    def set_demo_seed_hint(self, email: str) -> None:
        """Record the seeded test-account email (dev-only; surfaced in the who-am-I `demo_seed`)."""
        self._demo_seed_email = (email or "").strip() or None

    # ------------------------------------------------------------------ identity shape

    def _identity_shape(self, user: Optional[UserRecord]) -> dict:
        """The §2.1 response shape (also returned by signup/login success)."""
        google_avail = False
        try:
            google_avail = google_oauth.available()
        except Exception:
            google_avail = False  # absent/broken config ⇒ unavailable, never a crash (AC-G2)

        # DEV-ONLY: advertise a seeded test account so the login form can pre-fill it. Null in prod.
        demo_seed = {"email": self._demo_seed_email} if self._demo_seed_email else None

        if user is None:
            return {
                "authenticated": False,
                "user": None,
                "google_available": google_avail,
                "settings": None,
                "demo_seed": demo_seed,
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
            "demo_seed": demo_seed,
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
                    "google_available": False, "settings": None, "demo_seed": None}

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

    def ensure_account(self, *, email: str, password: str,
                       display_name: str | None) -> bool:
        """
        Idempotently ensure a (dev/test) account exists with these credentials. Returns True when it
        creates the account, False when it already existed. Creates the settings row on create and
        does NOT open a session. Used ONLY by the gated dev seed at boot (main.py `_seed_test_account`)
        — never on a request path. Bypasses the signup validation floor by design (operator seed, not
        user input). No AI key is attached here (seeded accounts set the BYO key via the Settings UI).
        """
        if self.stores.users.get_by_email(email) is not None:
            return False
        pw_hash = passwords.hash_password(password)  # plaintext is never retained past this call
        try:
            user = self.stores.users.create(
                email=email, password_hash=pw_hash,
                display_name=(display_name or None), google_sub=None)
        except errors.AuthError:
            # A concurrent create won the unique-email race — treat as already present (idempotent).
            return False
        self.stores.settings.upsert_defaults(user.id)
        return True

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
        """
        Read (or default-create) the user's settings bag. On SUCCESS behavior is identical to the
        in-memory path. A non-`AuthError` STORE fault (e.g. a DB outage in the persistent adapter
        mid-request, after the session resolved) is mapped to `auth_unavailable` (503) so settings
        stay inside the auth-class envelope instead of becoming a bare FastAPI 500 — behavior-
        faithful internal hardening, no interface/shape change (persistent-db ARCHITECTURE §5).
        """
        try:
            settings = self.stores.settings.upsert_defaults(user.id)
        except errors.AuthError:
            raise
        except Exception:
            logger.warning("auth: settings read faulted; reporting auth unavailable", exc_info=False)
            raise errors.auth_unavailable()
        return settings.to_wire()

    def write_settings(self, user: UserRecord, patch: dict) -> dict:
        """
        Apply a subset patch (server-wins, D7) and echo the full saved bag. 422 on bad theme. On
        SUCCESS behavior is identical to the in-memory path; a non-`AuthError` STORE fault is mapped
        to `auth_unavailable` (503) (the 422 validation `AuthError` still propagates unchanged) —
        keeping settings in the auth-class envelope, no interface change (persistent-db §5).
        """
        try:
            settings = self.stores.settings.update(user.id, patch)
        except errors.AuthError:
            raise
        except Exception:
            logger.warning("auth: settings write faulted; reporting auth unavailable", exc_info=False)
            raise errors.auth_unavailable()
        return settings.to_wire()

    def get_scan_view(self, user: UserRecord) -> Optional[str]:
        """Scanner v1 P3: read the raw scan-view JSON string for `user` (or None). Best-effort — a
        store fault degrades to None (the caller falls back to the default view; a scan READ is never
        an auth failure domain). Never raises."""
        try:
            settings = self.stores.settings.get(user.id)
        except Exception:
            logger.warning("auth: scan-view read faulted; treating as unset", exc_info=False)
            return None
        return settings.scan_view if settings else None

    def save_scan_view(self, user: UserRecord, view_json: str) -> None:
        """Scanner v1 P3: persist the per-account scan view (a pre-serialized JSON string) behind the
        existing settings port (subset write; server-wins, D7). A non-`AuthError` STORE fault maps to
        `auth_unavailable` (503), mirroring write_settings — keeps the view in the auth-class
        envelope, no bare 500."""
        try:
            self.stores.settings.update(user.id, {"scan_view": view_json})
        except errors.AuthError:
            raise
        except Exception:
            logger.warning("auth: scan-view write faulted; reporting auth unavailable", exc_info=False)
            raise errors.auth_unavailable()

    # ------------------------------------------------------------------ AI credential (BYO key)

    def ai_key_hint(self, user: UserRecord) -> dict:
        """
        The INTERFACE §1.3 masked-hint read: `{set, last4, storage_available}`. NEVER decrypts,
        NEVER returns the key/ciphertext. A store fault ⇒ storage-unavailable (200 set:false),
        never a 5xx (AC-18).
        """
        try:
            rec = self.stores.credentials.get_record(user.id)
        except Exception:
            logger.warning("auth: ai-key hint read faulted; reporting storage unavailable",
                           exc_info=False)
            return {"set": False, "last4": None, "storage_available": False}
        if rec is None:
            return {"set": False, "last4": None, "storage_available": True}
        return {"set": True, "last4": rec.last4, "storage_available": True}

    def set_ai_key(self, user: UserRecord, raw_key: str) -> dict:
        """
        Encrypt + store / overwrite (rotate == overwrite, no history). Returns the masked-hint
        shape `{set:true, last4, storage_available:true}` — NEVER the key/ciphertext (AC-10). A
        store/crypto fault ⇒ 200 `{set:false, storage_available:false}` (never a 5xx — AC-18).
        The raw key is never logged.
        """
        last4 = raw_key[-4:] if len(raw_key) >= 4 else raw_key
        try:
            ciphertext = crypto.encrypt(raw_key)
            self.stores.credentials.set_key(user.id, ciphertext, last4)
        except Exception:
            logger.warning("auth: ai-key store faulted; reporting storage unavailable",
                           exc_info=False)
            return {"set": False, "storage_available": False}
        return {"set": True, "last4": last4, "storage_available": True}

    def delete_ai_key(self, user: UserRecord) -> dict:
        """
        Delete the stored key (idempotent — removing when none is set is still 200 set:false).
        Returns `{set:false, storage_available}`. A store fault ⇒ storage-unavailable, never 5xx.
        """
        try:
            self.stores.credentials.delete_key(user.id)
        except Exception:
            logger.warning("auth: ai-key delete faulted; reporting storage unavailable",
                           exc_info=False)
            return {"set": False, "storage_available": False}
        return {"set": False, "storage_available": True}

    def get_decrypted_ai_key(self, user_id: str) -> str | None:
        """
        SERVER-SIDE ONLY (byo-ai-key §1 resolution): decrypt the stored key for ONE call. Returns
        the raw key, or None when no key is stored OR the ciphertext cannot be decrypted (secret
        changed / restart / corrupt — AC-16). The result NEVER feeds a response, is NEVER logged,
        and is held only transiently by the resolution path. Never raises.
        """
        try:
            rec = self.stores.credentials.get_record(user_id)
        except Exception:
            logger.warning("auth: ai-key decrypted read faulted; treating as no key",
                           exc_info=False)
            return None
        if rec is None:
            return None
        return crypto.decrypt(rec.ciphertext)  # None on decrypt failure (handled as no usable key)

    # ------------------------------------------------------------------ broker credential
    # (broker-connect B3 — the byo-ai-key trio mirrored onto kind="broker_webull". The App Key +
    # App Secret are ONE logical record: json blob -> ONE Fernet ciphertext; both halves or 422,
    # never one. last4 = last 4 of the APP KEY (the secret is never hinted).)

    def broker_credential_hint(self, user: UserRecord) -> dict:
        """Masked-hint read `{set, last4, storage_available}`. NEVER decrypts, NEVER returns
        key/ciphertext. A store fault ⇒ storage-unavailable (200 set:false), never a 5xx."""
        try:
            rec = self.stores.credentials.get_record(user.id, kind=CREDENTIAL_KIND_BROKER)
        except Exception:
            logger.warning("auth: broker-credential hint read faulted; reporting storage "
                           "unavailable", exc_info=False)
            return {"set": False, "last4": None, "storage_available": False}
        if rec is None:
            return {"set": False, "last4": None, "storage_available": True}
        return {"set": True, "last4": rec.last4, "storage_available": True}

    def set_broker_credential(self, user: UserRecord, app_key: str, app_secret: str) -> dict:
        """
        Set/replace BOTH halves as one record (rotate == overwrite, no history). Raises a 422
        `AuthError` when either half is empty — a message that echoes NO fragment of either
        input. Store/crypto fault ⇒ 200 `{set:false, storage_available:false}`, never a 5xx.
        Neither half is ever logged. Invalidates the broker book cache (a rotated credential
        must not serve the previous credential's book).
        """
        app_key = (app_key or "").strip()
        app_secret = (app_secret or "").strip()
        if not app_key or not app_secret:
            raise errors.validation(
                "Enter both the App Key and the App Secret — they are saved together.")
        last4 = app_key[-4:] if len(app_key) >= 4 else app_key
        try:
            blob = json.dumps({"app_key": app_key, "app_secret": app_secret})
            ciphertext = crypto.encrypt(blob)
            self.stores.credentials.set_key(user.id, ciphertext, last4,
                                            kind=CREDENTIAL_KIND_BROKER)
        except Exception:
            logger.warning("auth: broker-credential store faulted; reporting storage "
                           "unavailable", exc_info=False)
            return {"set": False, "storage_available": False}
        self._invalidate_broker_cache(user.id)
        return {"set": True, "last4": last4, "storage_available": True}

    def delete_broker_credential(self, user: UserRecord) -> dict:
        """
        Delete (idempotent). ALWAYS calls the book-cache invalidation hook — a deleted
        credential must never leave a ghost book (AC-3). Store fault ⇒ storage-unavailable,
        never a 5xx.
        """
        self._invalidate_broker_cache(user.id)
        try:
            self.stores.credentials.delete_key(user.id, kind=CREDENTIAL_KIND_BROKER)
        except Exception:
            logger.warning("auth: broker-credential delete faulted; reporting storage "
                           "unavailable", exc_info=False)
            return {"set": False, "storage_available": False}
        return {"set": False, "storage_available": True}

    def get_decrypted_broker_credential(self, user_id: str) -> tuple[str, str] | None:
        """
        SERVER-SIDE ONLY (main.py's per-request resolution): decrypt the stored pair for ONE
        call. Returns (app_key, app_secret), or None when nothing is stored OR the ciphertext
        cannot be decrypted/parsed (secret changed / restart / corrupt). The result NEVER feeds
        a response, is NEVER logged, and never raises.
        """
        try:
            rec = self.stores.credentials.get_record(user_id, kind=CREDENTIAL_KIND_BROKER)
        except Exception:
            logger.warning("auth: broker-credential decrypted read faulted; treating as none",
                           exc_info=False)
            return None
        if rec is None:
            return None
        blob = crypto.decrypt(rec.ciphertext)  # None on decrypt failure
        if blob is None:
            return None
        try:
            parsed = json.loads(blob)
            app_key, app_secret = parsed["app_key"], parsed["app_secret"]
            if not isinstance(app_key, str) or not isinstance(app_secret, str):
                return None
            return app_key, app_secret
        except Exception:
            # Corrupt blob = no usable credential; never a leak, never a raise.
            return None

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
        # 3. No match → this is a REGISTRATION, not a login. Owner lockdown applies here exactly as
        #    it does on /signup — otherwise "Continue with Google" stays a wide-open second door
        #    while the front door is bolted. Steps 1 and 2 are untouched: an existing user (or a
        #    verified-email link to one) is a LOGIN and must keep working while sign-ups are closed.
        if user is None and not policy.registration_allowed(identity.email):
            raise errors.signups_closed()
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
