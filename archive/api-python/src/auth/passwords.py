"""
Password hashing (BACKEND_EXECUTION_CONTRACT §4 / ARCHITECTURE §2 security floor).

Hash with argon2 (argon2-cffi). The plaintext is NEVER stored, logged, or returned — even in
the in-memory DB. Login verification is constant-time via the KDF's own verify, and we use an
ALWAYS-HASH dummy-verify pattern so a missing/Google-only account does not enumerate via timing
(the unknown-email and wrong-password paths both perform an argon2 verify).

This module is part of the auth LEAF: it imports only its hashing dep + stdlib.
"""
from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

# One hasher instance (thread-safe). Defaults are the argon2-cffi recommended parameters.
_ph = PasswordHasher()

# A precomputed dummy hash to verify against when no real hash exists (Google-only or
# unknown-email), so the verify path takes argon2 time either way — non-enumerating timing.
# It is a hash of a fixed throwaway string; it never matches a real password.
_DUMMY_HASH = _ph.hash("argon2-dummy-verify-target-not-a-real-password")


def hash_password(plaintext: str) -> str:
    """Return an argon2 hash (salt embedded). The plaintext is never retained."""
    return _ph.hash(plaintext)


def verify_password(plaintext: str, stored_hash: str | None) -> bool:
    """
    Constant-time-ish verify. When `stored_hash` is None (Google-only / unknown user), still run a
    dummy argon2 verify so timing does not enumerate, then return False. Returns True only on a
    real match. Never raises, never logs the plaintext or the hash.
    """
    target = stored_hash if stored_hash else _DUMMY_HASH
    try:
        ok = _ph.verify(target, plaintext)
    except (VerifyMismatchError, InvalidHashError, Exception):
        ok = False
    # A None stored_hash can never be a real match even if the dummy somehow verified.
    return bool(ok) and bool(stored_hash)
