"""
The auth ERROR CLASS (ARCHITECTURE §7 / INTERFACE §3).

Auth is a NEW HTTP-status-bearing class, carved out of the bundle's null-on-failure rule: these
endpoints legitimately return real status codes (401/403/409/422/503). They are NOT the
best-effort-isolated-or-null trading-path computations.

`AuthError` carries the HTTP status + the `{error, message}` envelope codes pinned in
INTERFACE §2. The `message` is server-safe and NON-ENUMERATING — it never reveals whether an
email exists, and NEVER contains a secret, hash, password, or stack.

This module is part of the auth LEAF: stdlib only.
"""
from __future__ import annotations


class AuthError(Exception):
    """An auth-class failure carrying its HTTP status + safe envelope (INTERFACE §2)."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message

    def envelope(self) -> dict:
        """The `{error, message}` body (INTERFACE §1 error envelope)."""
        return {"error": self.code, "message": self.message}


# ----------------------------------------------------------------------------- canonical errors
# Each factory pins the (status, code, safe-message) tuple from INTERFACE §2/§3. Messages are
# deliberately generic; bad-credentials is identical regardless of which half is wrong (AC-C3/H3).

def email_taken() -> AuthError:
    return AuthError(409, "email_taken", "An account with that email already exists.")


def validation(message: str) -> AuthError:
    # `message` is a safe, field-level hint (e.g. the password-floor copy) — never a secret.
    return AuthError(422, "validation", message)


def bad_credentials() -> AuthError:
    # NON-ENUMERATING: identical for unknown-email vs wrong-password. Must not reveal existence.
    return AuthError(401, "bad_credentials", "Incorrect email or password.")


def auth_required() -> AuthError:
    return AuthError(403, "auth_required", "Sign in to do this.")


def settings_auth_required() -> AuthError:
    # A 401 on the dedicated settings read/write (INTERFACE §2.6/§2.7).
    return AuthError(401, "auth_required", "Sign in to access settings.")


def auth_unavailable() -> AuthError:
    return AuthError(503, "auth_unavailable", "Sign-in is temporarily unavailable.")


def google_unavailable() -> AuthError:
    return AuthError(409, "google_unavailable", "Google sign-in is not configured.")
