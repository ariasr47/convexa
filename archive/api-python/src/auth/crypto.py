"""
Symmetric key-at-rest crypto helper (BACKEND_EXECUTION_CONTRACT §4 / ARCHITECTURE §2).

A NEW sibling of `passwords.py` / `cookies.py`. Unlike `passwords.py` (a one-way HASH), this is
SYMMETRIC + DECRYPTABLE — the stored Anthropic key must recover to plaintext server-side so the
per-request key resolution (`main.py`) can hand the leaf real key material to call Anthropic.

Fernet (cryptography) — authenticated symmetric encryption (AES-128-CBC + HMAC, versioned token,
no nonce management). Keyed by the server-side, gitignored env secret `AI_KEY_ENCRYPTION_KEY`
(the literal name; read ONLY inside this module). Absent-secret = config-gated, NO crash (mirrors
`AUTH_SESSION_SIGNING_KEY` in service.py): fall back to an EPHEMERAL per-process key — ciphertext
then resets on restart, already true of the in-memory credential store.

Security floor (BACKEND_EXECUTION_CONTRACT §7):
  - The raw key / plaintext is NEVER logged (no log line ever carries plaintext OR ciphertext).
  - The encryption secret is NEVER logged or returned.
  - A decrypt failure returns None (treat as "no usable key") — it NEVER raises into the caller,
    NEVER leaks plaintext/ciphertext, and is handled by the resolution path as unavailable, not 5xx.

This module is part of the auth LEAF: imports ONLY stdlib + `cryptography`. The scoring path
(engine/signals/live/darkpool/chain_store/bundle) NEVER imports it — the structural guarantee of
score byte-identity.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("Convexa")

# The literal env name (server-side, gitignored). Read ONLY here.
_ENV_SECRET = "AI_KEY_ENCRYPTION_KEY"

# Memoized per-process ephemeral key (used only when the env secret is absent).
_EPHEMERAL_FERNET_KEY: bytes | None = None


def _derive_fernet_key(secret: str) -> bytes:
    """
    Derive a valid 32-byte url-safe-base64 Fernet key from an arbitrary operator-supplied secret.
    Accepts any string (an operator can set any passphrase); a 32-byte SHA-256 digest, base64url
    encoded, is always a valid Fernet key. (If the operator already supplied a valid Fernet key we
    still hash it — deterministic + simpler than detecting the format; the secret never leaks.)
    """
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet() -> Fernet:
    """
    Build the Fernet cipher. Uses `AI_KEY_ENCRYPTION_KEY` when set; otherwise an EPHEMERAL
    per-process key (config-gated, no crash). Never logs the secret or the derived key.
    """
    global _EPHEMERAL_FERNET_KEY
    secret = os.getenv(_ENV_SECRET)
    if secret:
        return Fernet(_derive_fernet_key(secret))
    if _EPHEMERAL_FERNET_KEY is None:
        _EPHEMERAL_FERNET_KEY = Fernet.generate_key()
        logger.info(
            "auth/crypto: no %s set; using an ephemeral per-process key (encrypted AI keys reset "
            "on restart — consistent with the in-memory credential store).", _ENV_SECRET)
    return Fernet(_EPHEMERAL_FERNET_KEY)


def encrypt(plaintext: str) -> str:
    """
    Encrypt a raw key to an opaque ciphertext token (str). The plaintext is NEVER logged. The
    returned token is treated as a secret by callers (never returned to a browser, never logged).
    """
    token = _fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("ascii")


def decrypt(ciphertext: str) -> str | None:
    """
    Decrypt a ciphertext token back to the raw key, or None on ANY failure (bad token, secret
    changed/rotated, ephemeral key lost on restart, corrupt data). NEVER raises into the caller;
    NEVER logs the plaintext or ciphertext. None ⇒ the resolution path treats it as no usable key
    (unavailable, not 5xx, no leak — AC-16).
    """
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError, Exception):
        # Do NOT log the ciphertext or any key material. A generic, key-free breadcrumb only.
        logger.warning("auth/crypto: stored AI key could not be decrypted; treating as no key.")
        return None


def reset_ephemeral_key_for_tests() -> None:
    """Test/verification hook: forget the ephemeral key (simulates a restart / secret change)."""
    global _EPHEMERAL_FERNET_KEY
    _EPHEMERAL_FERNET_KEY = None
