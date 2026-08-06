"""
Registration policy — the owner lockdown (2026-08-06).

ONE definition, read by BOTH registration doors:
  - `POST /api/auth/signup`            (router.py)
  - the Google callback's create-user  (service.py step 3)

It lives in its own module deliberately. This repo has been bitten three times by "two copies of
code that were supposed to be one" drifting apart (see DECISION_LEDGER
`vendor-contract-verified-not-faked`), and a registration gate that holds on one door and not the
other is exactly that failure with a security consequence.

FAILS CLOSED: `SIGNUPS_ENABLED` unset ⇒ sign-ups are OFF. Both values are re-read per call, so
flipping the env re-opens registration without a redeploy (same idiom as the admin allowlist).
"""
from __future__ import annotations

import os

_TRUTHY = {"1", "true", "yes", "on"}


def signups_enabled() -> bool:
    """True only on an explicit truthy value. A typo keeps the door shut."""
    return os.getenv("SIGNUPS_ENABLED", "").strip().lower() in _TRUTHY


def owner_emails() -> set[str]:
    """The always-allowed allowlist, so the owner can create/recreate their own account while
    sign-ups are closed. Comma-separated, matched case-insensitively."""
    raw = os.getenv("OWNER_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def registration_allowed(email: str | None) -> bool:
    """The single predicate both doors ask. An owner-allowlisted email is always allowed."""
    if signups_enabled():
        return True
    return (email or "").strip().lower() in owner_emails()
