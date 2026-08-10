"""
Session cookie signing (ARCHITECTURE §5.1 / BACKEND_EXECUTION_CONTRACT §5).

The browser holds ONLY a signed, HTTP-only, Secure, SameSite cookie carrying the opaque session
id; the server-side session row is the source of truth. The cookie value is `<sid>.<sig>` where
`sig = HMAC-SHA256(signing_key, sid)`, base64url, no padding — tamper-detectable. The signing key
is server-side only (env-supplied, gitignored) and NEVER appears in any response body or log.

A tampered/garbage cookie fails signature verification and resolves to ANONYMOUS (the service
then treats an unverifiable/unknown sid as anonymous — AC-D2).

This module is part of the auth LEAF: stdlib only.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

COOKIE_NAME = "gf_session"


def new_session_id() -> str:
    """High-entropy opaque session id (URL-safe, ~256 bits)."""
    return secrets.token_urlsafe(32)


def _sign(session_id: str, signing_key: str) -> str:
    mac = hmac.new(signing_key.encode("utf-8"), session_id.encode("utf-8"), hashlib.sha256)
    return base64.urlsafe_b64encode(mac.digest()).decode("ascii").rstrip("=")


def sign_cookie(session_id: str, signing_key: str) -> str:
    """Return the signed cookie value `<sid>.<sig>` the browser carries."""
    return f"{session_id}.{_sign(session_id, signing_key)}"


def unsign_cookie(value: str | None, signing_key: str) -> str | None:
    """
    Verify the signature and return the session id, or None on any tamper/format failure.
    Constant-time signature compare. Never raises; never logs the value.
    """
    if not value or "." not in value:
        return None
    sid, _, sig = value.rpartition(".")
    if not sid or not sig:
        return None
    expected = _sign(sid, signing_key)
    if not hmac.compare_digest(sig, expected):
        return None
    return sid
