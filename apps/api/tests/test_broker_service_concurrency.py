"""
broker-connect H-3 (system-6 security review, High) — the book service lock.

Before: ONE process-global `threading.Lock`, held ACROSS `fetch_book` (up to 50 pages x 10s
read timeout). One account's slow or hanging Webull fetch stalled every other account's broker
request — a cross-account DoS by construction (proven: account B waited 3.80s for its own 2.0s
fetch behind account A) — and, since `main.py` dispatches through `asyncio.to_thread`, enough
of them occupy the event loop's shared default executor and the starvation reaches non-broker
surfaces. That crosses `[best-effort-isolated-or-null]`: a broker failure must degrade the
Broker tab ONLY.

After: one `threading.Condition` per user id (keyed exactly like the cache and the throttle),
held only around the state decision and the state commit, never across the network call.

These tests are DETERMINISTIC, not timing-threshold assertions. Concurrency is proven with a
`threading.Barrier` that two calls must BOTH be inside `fetch_book` to clear: under the old
global lock the second call never arrives and the barrier times out, so a regression is a hard
failure rather than a flaky duration comparison.
"""
from __future__ import annotations

import threading
import time

import pytest

from src.broker.ports import (BrokerBook, BrokerCredential, PositionsProvider,
                              ProviderCapabilities)
from src.broker.service import BrokerBookService
from src.broker.stub import _ok_positions

CRED_OK = ("ok", BrokerCredential("k", "s"))
_TIMEOUT = 5.0                       # generous; the passing path clears it instantly


def _book(ref: str) -> BrokerBook:
    return BrokerBook(state="ok", positions=_ok_positions(), account_ref=ref)


class RendezvousProvider(PositionsProvider):
    """Every fetch must meet `parties - 1` others INSIDE fetch_book before any may return."""

    def __init__(self, parties: int = 2):
        self.barrier = threading.Barrier(parties, timeout=_TIMEOUT)
        self._count_lock = threading.Lock()
        self.calls = 0

    def fetch_book(self, credential, account_ref=None):
        with self._count_lock:
            self.calls += 1
        self.barrier.wait()          # BrokenBarrierError if the peer never gets here
        return _book("ref")

    def describe(self):
        return ProviderCapabilities("rendezvous", "on_demand_snapshot", True, True, False)


class GatedProvider(PositionsProvider):
    """Blocks inside fetch_book until the test releases it."""

    def __init__(self):
        self.entered = threading.Event()
        self.release = threading.Event()
        self._count_lock = threading.Lock()
        self.calls = 0

    def fetch_book(self, credential, account_ref=None):
        with self._count_lock:
            self.calls += 1
        self.entered.set()
        assert self.release.wait(timeout=_TIMEOUT), "the gated fetch was never released"
        return _book("ref")

    def describe(self):
        return ProviderCapabilities("gated", "on_demand_snapshot", True, True, False)


class FakeClock:
    def __init__(self, t=1_700_000_000.0):
        self.t = t

    def __call__(self):
        return self.t

    def advance(self, seconds):
        self.t += seconds


def _service(provider, clock=None):
    return BrokerBookService(provider, ttl_seconds=60, stale_after_seconds=300,
                             refresh_min_interval_seconds=15, clock=clock or time.time)


def _run(target, *args):
    result: dict = {}

    def runner():
        try:
            result["value"] = target(*args)
        except BaseException as exc:            # noqa: BLE001 - surfaced by the assertions
            result["error"] = exc

    thread = threading.Thread(target=runner, daemon=True)
    thread.start()
    return thread, result


# ------------------------------------------------------------------ the headline defect

def test_two_accounts_do_not_serialize_on_the_broker_call():
    """THE H-3 proof. Both accounts must be inside `fetch_book` simultaneously. Under the
    process-global lock account B could not enter until A returned, the barrier would time
    out, and both books would come back `unknown`."""
    provider = RendezvousProvider(parties=2)
    svc = _service(provider)

    a_thread, a_result = _run(svc.get_book, "user-a", CRED_OK)
    b_thread, b_result = _run(svc.get_book, "user-b", CRED_OK)
    a_thread.join(timeout=_TIMEOUT * 2)
    b_thread.join(timeout=_TIMEOUT * 2)

    assert not a_thread.is_alive() and not b_thread.is_alive()
    assert "error" not in a_result and "error" not in b_result
    assert a_result["value"].state == "ok" and b_result["value"].state == "ok"
    assert provider.calls == 2


def test_a_stalled_account_does_not_block_a_different_account_at_all():
    """The starvation arm stated as a liveness property: while A hangs indefinitely inside
    `fetch_book`, B completes a full fetch. `[best-effort-isolated-or-null]` — and B here
    stands in for every OTHER `asyncio.to_thread` caller in the app."""
    class TwoProviders(PositionsProvider):
        def __init__(self):
            self.a_entered = threading.Event()
            self.release_a = threading.Event()

        def fetch_book(self, credential, account_ref=None):
            if credential.app_key == "a":
                self.a_entered.set()
                self.release_a.wait(timeout=_TIMEOUT)
                return _book("ref-a")
            return _book("ref-b")

        def describe(self):
            return ProviderCapabilities("two", "on_demand_snapshot", True, True, False)

    provider = TwoProviders()
    svc = _service(provider)
    a_thread, _ = _run(svc.get_book, "user-a", ("ok", BrokerCredential("a", "s")))
    assert provider.a_entered.wait(timeout=_TIMEOUT), "A never reached the broker call"

    started = time.monotonic()
    b_book = svc.get_book("user-b", ("ok", BrokerCredential("b", "s")))   # must not block
    elapsed = time.monotonic() - started
    assert (b_book.state, b_book.basis) == ("ok", "fresh")
    # A is still parked inside its fetch for up to `_TIMEOUT` seconds. B must not have paid
    # for any of that: under the global lock B could not return before A did.
    assert elapsed < _TIMEOUT / 5, f"B waited {elapsed:.2f}s behind account A's stalled fetch"

    provider.release_a.set()
    a_thread.join(timeout=_TIMEOUT)
    assert not a_thread.is_alive()


# ------------------------------------------------------------------ same account, in flight

def test_a_second_read_for_the_same_account_never_queues_behind_the_network():
    """The other half of "never hold a lock across I/O": a concurrent read for the SAME
    account returns immediately from cache rather than parking a thread pool worker, and does
    NOT duplicate the broker contact. It is not an attempt — `last_attempt_at` is unmoved."""
    clock = FakeClock()
    provider = GatedProvider()
    svc = _service(provider, clock)

    provider.release.set()                       # the first read completes normally
    first = svc.get_book("u1", CRED_OK)
    provider.release.clear()
    provider.entered.clear()
    clock.advance(120)                           # past both the TTL and the throttle interval

    thread, result = _run(svc.get_book, "u1", CRED_OK)
    assert provider.entered.wait(timeout=_TIMEOUT), "the refresh never reached the broker"
    contacts_in_flight = provider.calls          # == 2: the first read, plus this one

    concurrent = svc.get_book("u1", CRED_OK)     # would have blocked ~a full fetch before
    assert concurrent.basis == "cache"
    assert concurrent.as_of == first.as_of                       # true old as_of, unfabricated
    assert concurrent.last_attempt_at == first.last_attempt_at   # NOT an attempt (C5)
    assert provider.calls == contacts_in_flight                  # no duplicate contact

    provider.release.set()
    thread.join(timeout=_TIMEOUT)
    assert result["value"].basis == "fresh"
    assert provider.calls == contacts_in_flight


def test_a_cold_start_race_coalesces_onto_one_contact_and_never_invents_a_cause():
    """With nothing honest to serve there IS no truthful envelope for "someone else is
    asking" — `unknown` has no such reason — so the second caller waits for the in-flight
    result instead of fabricating `adapter_fault`. One broker contact, two honest answers."""
    provider = GatedProvider()
    svc = _service(provider)

    first_thread, first_result = _run(svc.get_book, "u1", CRED_OK)
    assert provider.entered.wait(timeout=_TIMEOUT)
    second_thread, second_result = _run(svc.get_book, "u1", CRED_OK)
    time.sleep(0.05)                              # let the second caller reach the wait
    provider.release.set()

    first_thread.join(timeout=_TIMEOUT)
    second_thread.join(timeout=_TIMEOUT)
    assert not first_thread.is_alive() and not second_thread.is_alive()
    assert provider.calls == 1                    # coalesced, not duplicated
    assert first_result["value"].state == "ok"
    assert second_result["value"].state == "ok"
    assert second_result["value"].basis == "cache"          # it did not contact the broker
    assert second_result["value"].as_of == first_result["value"].as_of


# ------------------------------------------------------------------ AC-3 under concurrency

def test_a_credential_delete_during_an_in_flight_fetch_leaves_no_ghost_book():
    """The regression guard the old global lock gave for free. `invalidate` no longer waits
    for the network call, so the in-flight fetch must discover it was detached and commit
    NOTHING (AC-3: delete must never leave a ghost book)."""
    provider = GatedProvider()
    svc = _service(provider)

    thread, result = _run(svc.get_book, "u1", CRED_OK)
    assert provider.entered.wait(timeout=_TIMEOUT)
    svc.invalidate("u1")                          # must not block on the fetch
    provider.release.set()
    thread.join(timeout=_TIMEOUT)
    assert not thread.is_alive()

    assert result["value"].to_wire() == {"state": "unknown",
                                         "reason": "no_credential_stored", "positions": []}
    assert "u1" not in svc._users                 # nothing was written back
    after = svc.get_book("u1", ("none", None))
    assert after.to_wire() == {"state": "unknown", "reason": "no_credential_stored",
                               "positions": []}


def test_invalidate_wakes_a_waiter_into_the_not_connected_answer():
    """A cold-start waiter parked on the in-flight contact must not wake up holding the
    deleted credential's book."""
    provider = GatedProvider()
    svc = _service(provider)

    first_thread, _ = _run(svc.get_book, "u1", CRED_OK)
    assert provider.entered.wait(timeout=_TIMEOUT)
    waiter_thread, waiter_result = _run(svc.get_book, "u1", CRED_OK)
    time.sleep(0.05)
    svc.invalidate("u1")
    provider.release.set()

    first_thread.join(timeout=_TIMEOUT)
    waiter_thread.join(timeout=_TIMEOUT)
    assert not waiter_thread.is_alive()
    assert waiter_result["value"].reason == "no_credential_stored"
    assert waiter_result["value"].positions == []


# ------------------------------------------------------------------ structural

def test_the_service_holds_no_process_global_lock():
    """Named so a future refactor cannot quietly reintroduce the shared mutex."""
    svc = _service(RendezvousProvider(parties=1))
    assert not hasattr(svc, "_lock"), "a process-global service lock is back (H-3)"
    svc.get_book("user-a", CRED_OK)
    svc.get_book("user-b", CRED_OK)
    assert set(svc._conds) == {"user-a", "user-b"}      # one primitive PER ACCOUNT
