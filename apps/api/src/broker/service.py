"""
BrokerBookService — the per-user book cache + C5 attempt semantics + envelope assembly
(broker-connect B5; INTERFACE_CONTRACT §2/§6 are the behavior spec, verbatim).

The rules this module IS:
- An *attempt* = actual broker contact, or the read pipeline failing before contact on
  `credential_unreadable`. A cache serve under the TTL or a refresh throttle is NOT an
  attempt — `last_attempt_at` does not move. That is how a consumer distinguishes "server
  chose not to ask" from "server asked and failed".
- The TTL bounds serve-without-attempting ONLY — it is not an eviction deadline. A failed
  attempt never evicts: the last good book keeps serving with its TRUE (old) `as_of` plus the
  failure in `last_attempt_*`. The cache drops only on process restart (it is process-local
  by construction) or credential delete (`invalidate` — no ghost book, AC-3).
- Refresh has FORCE-FETCH semantics: always *requests* a fresh read; the server may throttle
  (`BROKER_REFRESH_MIN_INTERVAL_SECONDS`, server-authoritative — protects the owner's own
  broker rate limits; there is no client retry parameter).
- Broker-side trouble is NEVER a 5xx: every outcome is a typed state inside a 200.

Cache keys are the OPAQUE server user id — never an email, never a broker account number
(the AC-23 backend boundary). Part of the broker leaf: stdlib + the leaf's own ports only;
the credential arrives as a value object resolved at the main.py boundary.
"""
from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Literal, Optional

from .ports import (BrokerBook, BrokerCredential, BrokerPosition, FAILURE_CAUSES,
                    PositionsProvider, REASON_NO_CREDENTIAL)

logger = logging.getLogger("Convexa")

# Server-owned policy knobs (env; operator config, never wire fields).
DEFAULT_TTL_SECONDS = 60                 # serve-without-attempt bound — NOT eviction
DEFAULT_STALE_AFTER_SECONDS = 300        # rides every served snapshot
DEFAULT_REFRESH_MIN_INTERVAL_SECONDS = 15  # the refresh throttle

# The per-request credential resolution main.py hands in:
#   ("ok", BrokerCredential) | ("none", None) | ("unreadable", None)
CredentialResolution = tuple[Literal["ok", "none", "unreadable"], Optional[BrokerCredential]]


def _iso(ts: float) -> str:
    return (datetime.fromtimestamp(ts, timezone.utc)
            .isoformat(timespec="seconds").replace("+00:00", "Z"))


@dataclass
class _Snapshot:
    """The last GOOD book (state ok|empty) for one user, with its true fetch time."""
    state: Literal["ok", "empty"]
    positions: list[BrokerPosition]
    account_ref: Optional[str]
    as_of: str
    fetched_at: float


@dataclass
class _UserState:
    snapshot: Optional[_Snapshot] = None
    last_attempt_ts: Optional[float] = None
    last_attempt_outcome: Optional[str] = None


class BrokerBookService:
    def __init__(self, provider: PositionsProvider, *,
                 ttl_seconds: Optional[int] = None,
                 stale_after_seconds: Optional[int] = None,
                 refresh_min_interval_seconds: Optional[int] = None,
                 clock: Callable[[], float] = time.time):
        self._provider = provider
        self._ttl = ttl_seconds if ttl_seconds is not None else int(
            os.getenv("BROKER_BOOK_TTL_SECONDS", str(DEFAULT_TTL_SECONDS)))
        self._stale_after = stale_after_seconds if stale_after_seconds is not None else int(
            os.getenv("BROKER_STALE_AFTER_SECONDS", str(DEFAULT_STALE_AFTER_SECONDS)))
        self._min_interval = refresh_min_interval_seconds if refresh_min_interval_seconds \
            is not None else int(os.getenv("BROKER_REFRESH_MIN_INTERVAL_SECONDS",
                                           str(DEFAULT_REFRESH_MIN_INTERVAL_SECONDS)))
        self._clock = clock
        self._users: dict[str, _UserState] = {}   # keyed on the OPAQUE server user id ONLY
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ public surface

    def get_book(self, user_id: str, resolution: CredentialResolution) -> BrokerBook:
        """GET semantics: serve the TTL cache when fresh enough (`basis: cache`), else fetch."""
        with self._lock:
            return self._serve(user_id, resolution, force=False)

    def refresh_book(self, user_id: str, resolution: CredentialResolution) -> BrokerBook:
        """POST /refresh semantics: force-fetch, server-side throttle (C4)."""
        with self._lock:
            return self._serve(user_id, resolution, force=True)

    def invalidate(self, user_id: str) -> None:
        """Credential delete/rotate hook: drop the WHOLE user state — snapshot AND attempt
        history. No field of the old book may survive (AC-3)."""
        with self._lock:
            self._users.pop(user_id, None)

    # ------------------------------------------------------------------ internals

    def _serve(self, user_id: str, resolution: CredentialResolution, force: bool) -> BrokerBook:
        status, credential = resolution
        if status == "none":
            # No stored credential: the pure product state. No attempt fields (INTERFACE §2:
            # absent when no_credential_stored), no cache read — delete already invalidated.
            return BrokerBook(state="unknown", reason=REASON_NO_CREDENTIAL)

        ustate = self._users.setdefault(user_id, _UserState())
        now = self._clock()

        if status == "unreadable":
            # Pre-contact failure IS an attempt (C5's named carve-out): the pipeline ran and
            # failed before broker contact. Last good book (if any) keeps serving.
            ustate.last_attempt_ts = now
            ustate.last_attempt_outcome = "credential_unreadable"
            return self._assemble(ustate, basis="cache", fallback_reason="credential_unreadable")

        if not force:
            snap = ustate.snapshot
            if snap is not None and (now - snap.fetched_at) < self._ttl:
                return self._assemble(ustate, basis="cache")
            return self._attempt(ustate, credential, now)

        # force-fetch (refresh): server-authoritative throttle. Throttle is NOT an attempt.
        if ustate.last_attempt_ts is not None and \
                (now - ustate.last_attempt_ts) < self._min_interval:
            return self._assemble(ustate, basis="cache")
        return self._attempt(ustate, credential, now)

    def _attempt(self, ustate: _UserState, credential: BrokerCredential,
                 now: float) -> BrokerBook:
        """One real broker contact. Success replaces the snapshot; failure NEVER evicts."""
        prior_ref = ustate.snapshot.account_ref if ustate.snapshot else None
        try:
            fetched = self._provider.fetch_book(credential, prior_ref)
        except Exception:
            # The adapter maps its own failures; a RAISING provider is an adapter fault by
            # definition — contained here so broker trouble can never become a 5xx.
            logger.warning("broker: provider raised out of fetch_book (adapter_fault)",
                           exc_info=False)
            fetched = None

        ustate.last_attempt_ts = now
        if fetched is not None and fetched.state in ("ok", "empty"):
            ustate.last_attempt_outcome = "ok"
            ustate.snapshot = _Snapshot(
                state=fetched.state, positions=list(fetched.positions),
                account_ref=fetched.account_ref, as_of=_iso(now), fetched_at=now)
            return self._assemble(ustate, basis="fresh")

        cause = fetched.reason if (fetched is not None and
                                   fetched.reason in FAILURE_CAUSES) else "adapter_fault"
        ustate.last_attempt_outcome = cause
        return self._assemble(ustate, basis="cache", fallback_reason=cause)

    def _assemble(self, ustate: _UserState, basis: Literal["fresh", "cache"],
                  fallback_reason: Optional[str] = None) -> BrokerBook:
        """Envelope assembly per INTERFACE §2: a served snapshot carries its TRUE as_of +
        the attempt fields; no snapshot ⇒ typed unknown with a failure-cause reason."""
        last_at = _iso(ustate.last_attempt_ts) if ustate.last_attempt_ts is not None else None
        outcome = ustate.last_attempt_outcome if last_at is not None else None
        snap = ustate.snapshot
        if snap is not None:
            return BrokerBook(
                state=snap.state, as_of=snap.as_of, basis=basis,
                stale_after_seconds=self._stale_after, account_ref=snap.account_ref,
                positions=list(snap.positions),
                last_attempt_at=last_at, last_attempt_outcome=outcome)
        reason = fallback_reason or outcome or "adapter_fault"
        return BrokerBook(state="unknown", reason=reason,
                          last_attempt_at=last_at, last_attempt_outcome=outcome)
