"""
Google OAuth — server-side Authorization-Code flow, CONFIG-GATED OFF (ARCHITECTURE §4 / D9 /
BACKEND_EXECUTION_CONTRACT §6).

The flow is wired end-to-end, but with NO Google client creds in env it is DISABLED: `available()`
reports False, `GET /api/auth/session.google_available` is False, and absent creds cause NO crash
on boot or on the session read — mirroring the missing-ANTHROPIC_API_KEY ⇒ ai-rec `unavailable:no_key`
pattern. The client id/secret/redirect-uri are read from env ONLY (server-side, gitignored) and
NEVER reach the browser; the browser never sees the client secret or Google tokens.

`authorization_url(state)` builds the redirect to Google with an anti-CSRF `state`. `exchange(code)`
performs the server-side code→token exchange and returns the verified identity (`sub`, `email`,
`email_verified`). The actual cookie-setting + identity mapping live in `service.py`.

This module is part of the auth LEAF: it imports only stdlib + its OAuth dep. It reads the Google
env keys lazily so an absent config never errors at import.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger("Convexa")

_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"
_SCOPE = "openid email profile"


def _client_id() -> Optional[str]:
    return os.getenv("GOOGLE_CLIENT_ID") or None


def _client_secret() -> Optional[str]:
    return os.getenv("GOOGLE_CLIENT_SECRET") or None


def _redirect_uri() -> Optional[str]:
    return os.getenv("GOOGLE_REDIRECT_URI") or None


def available() -> bool:
    """
    True iff all three Google creds are configured. Drives `google_available` (AC-G1/G3). Absent
    creds ⇒ False, no crash (AC-G2). Config-only — flipping it on requires no rebuild.
    """
    return bool(_client_id() and _client_secret() and _redirect_uri())


def authorization_url(state: str) -> str:
    """Build the Google consent redirect URL carrying the anti-CSRF `state` (ARCHITECTURE §4)."""
    from urllib.parse import urlencode
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": _SCOPE,
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{_AUTH_ENDPOINT}?{urlencode(params)}"


class GoogleIdentity:
    """The verified identity from a successful callback (no tokens leak past this boundary)."""

    def __init__(self, sub: str, email: str, email_verified: bool, name: Optional[str]):
        self.sub = sub
        self.email = email
        self.email_verified = email_verified
        self.name = name


def exchange(code: str) -> GoogleIdentity:
    """
    Server-side Authorization-Code exchange: code → tokens (server-only) → verified userinfo.
    The browser never sees the client secret or the tokens. Raises on any failure; the caller
    maps that to a safe redirect (never leaking the secret/token/stack).
    """
    from authlib.integrations.requests_client import OAuth2Session

    session = OAuth2Session(
        client_id=_client_id(), client_secret=_client_secret(),
        redirect_uri=_redirect_uri(), scope=_SCOPE)
    # The code→token exchange happens server-side; tokens never leave this process.
    session.fetch_token(_TOKEN_ENDPOINT, code=code, grant_type="authorization_code")
    resp = session.get(_USERINFO_ENDPOINT)
    info = resp.json()
    return GoogleIdentity(
        sub=str(info.get("sub")),
        email=(info.get("email") or "").strip(),
        email_verified=bool(info.get("email_verified")),
        name=info.get("name"),
    )
