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
- The throttle bounds ATTEMPTS, not successes (H-2, system-6 security review). It used to sit
  only on the refresh arm, and the GET arm's only brake was the TTL — which requires a
  *successful* snapshot to exist. So before the first success, or under `credential_rejected`
  / an outage, EVERY GET was a real broker call (proven: 20 GETs → 20 contacts) and S5's
  "Try again" button was an unthrottled retry loop against the owner's own key. One
  server-authoritative interval now governs both arms.
- Broker-side trouble is NEVER a 5xx: every outcome is a typed state inside a 200.

CONCURRENCY (H-3, system-6 security review). The lock used to be process-global AND held
across the blocking broker HTTP call, so one account's slow fetch stalled every other
account's broker request (proven: account B waited 3.80s for its own 2.0s fetch behind
account A) and enough of them would occupy the shared `asyncio.to_thread` executor and reach
non-broker surfaces — across `[best-effort-isolated-or-null]`'s "a broker failure degrades the
Broker tab ONLY". Now: one `threading.Condition` PER USER (keyed exactly like the cache and
the throttle), held only around the state read/decision and the state commit — NEVER across
`fetch_book`. A second request for the same account while a contact is in flight does not
queue behind the network: it serves the honest current envelope and is not an attempt. It
waits only when there is nothing honest to say at all (no snapshot AND no attempt history),
because `unknown` has no "someone else is asking" reason and fabricating one would be a lie.

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
    # A broker contact for THIS user is in flight (set/cleared under the user's condition).
    in_flight: bool = False
    # Set by `invalidate` on the state object it detaches, so an in-flight fetch that started
    # before a credential delete can never commit its book (AC-3: no ghost book).
    invalidated: bool = False

    def has_anything_to_serve(self) -> bool:
        """True when `_assemble` can produce an HONEST envelope: a cached book, or an attempt
        to report. False means the only available answer would be an invented failure cause."""
        return self.snapshot is not None or self.last_attempt_ts is not None


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
        self._conds: dict[str, threading.Condition] = {}   # ONE PER USER (H-3)
        # Guards the two registries ONLY. Held for a dict lookup and nothing else — never
        # across `fetch_book`, never while a per-user condition is held.
        self._registry = threading.Lock()

    # ------------------------------------------------------------------ public surface

    def get_book(self, user_id: str, resolution: CredentialResolution) -> BrokerBook:
        """GET semantics: serve the TTL cache when fresh enough (`basis: cache`), else fetch —
        subject to the same server-authoritative interval as refresh (H-2)."""
        return self._serve(user_id, resolution, force=False)

    def refresh_book(self, user_id: str, resolution: CredentialResolution) -> BrokerBook:
        """POST /refresh semantics: force-fetch, server-side throttle (C4)."""
        return self._serve(user_id, resolution, force=True)

    def invalidate(self, user_id: str) -> None:
        """Credential delete/rotate hook: drop the WHOLE user state — snapshot AND attempt
        history. No field of the old book may survive (AC-3).

        The popped state is also marked `invalidated`, so a fetch that was already in flight
        commits nothing and any waiter on it wakes into the not-connected answer. Never blocks
        on the in-flight call: the per-user condition is only ever held for state work."""
        with self._registry:
            detached = self._users.pop(user_id, None)
            cond = self._conds.get(user_id)
        if detached is None or cond is None:
            return
        with cond:
            detached.invalidated = True
            cond.notify_all()

    # ------------------------------------------------------------------ internals

    def _cond_for(self, user_id: str) -> threading.Condition:
        with self._registry:
            cond = self._conds.get(user_id)
            if cond is None:
                cond = self._conds[user_id] = threading.Condition()
            return cond

    def _state_for(self, user_id: str) -> _UserState:
        with self._registry:
            state = self._users.get(user_id)
            if state is None:
                state = self._users[user_id] = _UserState()
            return state

    def _serve(self, user_id: str, resolution: CredentialResolution, force: bool) -> BrokerBook:
        status, credential = resolution
        if status == "none":
            # No stored credential: the pure product state. No attempt fields (INTERFACE §2:
            # absent when no_credential_stored), no cache read — delete already invalidated.
            return BrokerBook(state="unknown", reason=REASON_NO_CREDENTIAL)

        cond = self._cond_for(user_id)
        ustate = self._state_for(user_id)

        if status == "unreadable":
            # Pre-contact failure IS an attempt (C5's named carve-out): the pipeline ran and
            # failed before broker contact. Last good book (if any) keeps serving.
            with cond:
                ustate.last_attempt_ts = self._clock()
                ustate.last_attempt_outcome = "credential_unreadable"
                return self._assemble(ustate, basis="cache",
                                      fallback_reason="credential_unreadable")

        # --- decide under the user's condition; claim the contact; then RELEASE it ---------
        with cond:
            while True:
                now = self._clock()
                if not force:
                    snap = ustate.snapshot
                    if snap is not None and (now - snap.fetched_at) < self._ttl:
                        return self._assemble(ustate, basis="cache")
                # H-2: ONE server-authoritative interval, both arms. A throttled serve is NOT
                # an attempt (C5) — `last_attempt_at` does not move and no `as_of` is invented.
                if ustate.last_attempt_ts is not None and \
                        (now - ustate.last_attempt_ts) < self._min_interval:
                    return self._assemble(ustate, basis="cache")
                if not ustate.in_flight:
                    ustate.in_flight = True
                    break
                # A contact for THIS account is already out. Never queue behind network I/O
                # and never duplicate the call: serve what we honestly have.
                if ustate.has_anything_to_serve():
                    return self._assemble(ustate, basis="cache")
                # Nothing honest to serve yet (cold start). Wait for the in-flight result and
                # re-decide — on wake the throttle arm above will serve it.
                cond.wait()
                if ustate.invalidated:
                    return BrokerBook(state="unknown", reason=REASON_NO_CREDENTIAL)

        # --- the blocking broker call, with NO lock held ----------------------------------
        prior_ref = ustate.snapshot.account_ref if ustate.snapshot else None
        fetched: Optional[BrokerBook]
        try:
            fetched = self._provider.fetch_book(credential, prior_ref)
        except Exception:
            # The adapter maps its own failures; a RAISING provider is an adapter fault by
            # definition — contained here so broker trouble can never become a 5xx.
            logger.warning("broker: provider raised out of fetch_book (adapter_fault)",
                           exc_info=False)
            fetched = None

        # --- commit under the condition again --------------------------------------------
        with cond:
            try:
                return self._commit(ustate, fetched, now)
            finally:
                ustate.in_flight = False
                cond.notify_all()

    def _commit(self, ustate: _UserState, fetched: Optional[BrokerBook],
                now: float) -> BrokerBook:
        """Record one real broker contact. Success replaces the snapshot; failure NEVER
        evicts. A credential deleted mid-flight discards the result entirely (AC-3)."""
        if ustate.invalidated:
            return BrokerBook(state="unknown", reason=REASON_NO_CREDENTIAL)

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
