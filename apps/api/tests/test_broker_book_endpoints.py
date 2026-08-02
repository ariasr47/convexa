"""
broker-connect B5 — book service C5 attempt semantics + the two gated book endpoints.

Service-level (fake provider + fake clock): cache-serve within TTL never moves
`last_attempt_at` · refresh force-fetch advances as_of/attempt · throttle is NOT an attempt ·
a failed attempt advances the attempt fields but NEVER evicts the last good book (served with
its TRUE old as_of) · restart ⇒ no book · unreadable is a pre-contact ATTEMPT.

Endpoint-level (TestClient over the stub provider): the server gate (AC-4) · the
no_credential_stored arm · delete-invalidation leaves no ghost field (AC-3) · decrypt-fail is
`credential_unreadable`, never "Webull rejected", no key material (AC-5/13) · two-user
isolation (AC-23 automated arm) · a raising provider is a 200 `adapter_fault`, never a 5xx.
"""
from __future__ import annotations

import json
import os
import uuid

os.environ.setdefault("MASSIVE_API_KEY", "dummy-verify")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-dummy")
os.environ.setdefault("AI_REC_STUB", "1")
os.environ.setdefault("POSITIONS_PROVIDER", "stub")
os.environ.setdefault("AUTH_COOKIE_SECURE", "false")

import pytest
from fastapi.testclient import TestClient

import main  # noqa: E402
from src import auth
from src.broker.ports import BrokerBook, BrokerCredential, PositionsProvider, ProviderCapabilities
from src.broker.service import BrokerBookService
from src.broker.stub import StubProvider, _ok_positions

CRED_OK = ("ok", BrokerCredential("k", "s"))
APP_KEY = "wbk-book-app-key-11AA"
APP_SECRET = "wbs-book-app-secret-22BB"


class FakeClock:
    def __init__(self, t=1_700_000_000.0):
        self.t = t

    def __call__(self):
        return self.t

    def advance(self, seconds):
        self.t += seconds


class ScriptedProvider(PositionsProvider):
    """Returns the queued book per call (last one repeats); counts real contacts."""

    def __init__(self, *books):
        self.books = list(books) or [BrokerBook(state="ok", positions=_ok_positions(),
                                                account_ref="ref0")]
        self.calls = 0

    def fetch_book(self, credential, account_ref=None):
        book = self.books[min(self.calls, len(self.books) - 1)]
        self.calls += 1
        if isinstance(book, Exception):
            raise book
        return book

    def describe(self):
        return ProviderCapabilities("scripted", "on_demand_snapshot", True, True, False)


def _service(provider, clock, **kw):
    kw.setdefault("ttl_seconds", 60)
    kw.setdefault("stale_after_seconds", 300)
    kw.setdefault("refresh_min_interval_seconds", 15)
    return BrokerBookService(provider, clock=clock, **kw)


# ================================================================== service: C5 semantics

def test_cache_serve_within_ttl_is_not_an_attempt():
    clock, provider = FakeClock(), ScriptedProvider()
    svc = _service(provider, clock)
    first = svc.get_book("u1", CRED_OK)
    assert (first.basis, first.last_attempt_outcome) == ("fresh", "ok")
    clock.advance(10)
    second = svc.get_book("u1", CRED_OK)
    assert provider.calls == 1                       # no broker contact
    assert second.basis == "cache"
    assert second.last_attempt_at == first.last_attempt_at   # UNMOVED
    assert second.as_of == first.as_of


def test_refresh_force_fetch_advances_as_of_and_attempt():
    clock, provider = FakeClock(), ScriptedProvider()
    svc = _service(provider, clock)
    first = svc.get_book("u1", CRED_OK)
    clock.advance(30)                                # past the 15s min interval, inside TTL
    refreshed = svc.refresh_book("u1", CRED_OK)
    assert provider.calls == 2
    assert refreshed.basis == "fresh"
    assert refreshed.as_of > first.as_of
    assert refreshed.last_attempt_at > first.last_attempt_at
    assert refreshed.last_attempt_outcome == "ok"


def test_throttled_refresh_serves_cache_and_moves_nothing():
    clock, provider = FakeClock(), ScriptedProvider()
    svc = _service(provider, clock)
    first = svc.get_book("u1", CRED_OK)
    clock.advance(5)                                 # inside the 15s min interval
    throttled = svc.refresh_book("u1", CRED_OK)
    assert provider.calls == 1                       # NOT an attempt
    assert throttled.basis == "cache"
    assert throttled.last_attempt_at == first.last_attempt_at
    assert throttled.as_of == first.as_of


def test_failed_attempt_advances_attempt_but_never_evicts():
    clock = FakeClock()
    provider = ScriptedProvider(
        BrokerBook(state="ok", positions=_ok_positions(), account_ref="ref0"),
        BrokerBook(state="unknown", reason="broker_unreachable"))
    svc = _service(provider, clock)
    first = svc.get_book("u1", CRED_OK)
    clock.advance(120)                               # past TTL ⇒ GET re-attempts
    degraded = svc.get_book("u1", CRED_OK)
    assert provider.calls == 2
    assert degraded.state == "ok"                    # last good book still served
    assert degraded.as_of == first.as_of             # with its TRUE (old) as_of
    assert degraded.basis == "cache"
    assert degraded.last_attempt_at > first.last_attempt_at
    assert degraded.last_attempt_outcome == "broker_unreachable"
    assert len(degraded.positions) == len(first.positions)


def test_failure_with_no_cache_is_typed_unknown():
    clock = FakeClock()
    provider = ScriptedProvider(BrokerBook(state="unknown", reason="rate_limited"))
    svc = _service(provider, clock)
    book = svc.get_book("u1", CRED_OK)
    assert (book.state, book.reason) == ("unknown", "rate_limited")
    assert book.positions == []
    assert book.last_attempt_outcome == "rate_limited"
    wire = book.to_wire()
    assert "as_of" not in wire and "basis" not in wire   # nothing fabricated


def test_restart_means_no_book():
    clock, provider = FakeClock(), ScriptedProvider()
    svc = _service(provider, clock)
    svc.get_book("u1", CRED_OK)
    fresh_instance = _service(ScriptedProvider(
        BrokerBook(state="unknown", reason="broker_unreachable")), clock)
    book = fresh_instance.get_book("u1", CRED_OK)
    assert book.state == "unknown"                   # process-local cache died with the process


def test_no_credential_short_circuits_with_no_attempt_fields():
    clock, provider = FakeClock(), ScriptedProvider()
    svc = _service(provider, clock)
    svc.get_book("u1", CRED_OK)                      # builds attempt history
    book = svc.get_book("u1", ("none", None))
    wire = book.to_wire()
    assert wire == {"state": "unknown", "reason": "no_credential_stored", "positions": []}
    assert provider.calls == 1


def test_unreadable_is_a_pre_contact_attempt():
    clock, provider = FakeClock(), ScriptedProvider()
    svc = _service(provider, clock)
    book = svc.get_book("u1", ("unreadable", None))
    assert provider.calls == 0                       # failed BEFORE contact
    assert (book.state, book.reason) == ("unknown", "credential_unreadable")
    assert book.last_attempt_at is not None          # ...but it IS an attempt (C5)
    assert book.last_attempt_outcome == "credential_unreadable"


def test_unreadable_keeps_serving_the_last_good_book():
    clock, provider = FakeClock(), ScriptedProvider()
    svc = _service(provider, clock)
    good = svc.get_book("u1", CRED_OK)
    clock.advance(20)
    book = svc.get_book("u1", ("unreadable", None))
    assert book.state == "ok" and book.as_of == good.as_of
    assert book.last_attempt_outcome == "credential_unreadable"


def test_invalidate_drops_snapshot_and_attempt_history():
    clock, provider = FakeClock(), ScriptedProvider()
    svc = _service(provider, clock)
    svc.get_book("u1", CRED_OK)
    svc.invalidate("u1")
    book = svc.get_book("u1", ("none", None))
    assert book.to_wire() == {"state": "unknown", "reason": "no_credential_stored",
                              "positions": []}


def test_raising_provider_is_adapter_fault_never_a_raise():
    clock = FakeClock()
    svc = _service(ScriptedProvider(RuntimeError("boom")), clock)
    book = svc.get_book("u1", CRED_OK)
    assert (book.state, book.reason) == ("unknown", "adapter_fault")


# ================================================================== endpoints

@pytest.fixture()
def client():
    with TestClient(main.app) as c:
        yield c


def _signup(c: TestClient) -> str:
    email = f"broker-book-{uuid.uuid4().hex[:10]}@test.invalid"
    r = c.post("/api/auth/signup", json={"email": email, "password": "Xx-test-passw0rd"})
    assert r.status_code == 200, r.text
    return r.json()["user"]["id"]


def _connect(c: TestClient):
    r = c.put("/api/broker/credential", json={"app_key": APP_KEY, "app_secret": APP_SECRET})
    assert r.status_code == 200 and r.json()["set"] is True


def test_anonymous_is_refused_on_both_book_routes(client):
    assert client.get("/api/broker/book").status_code in (401, 403)
    assert client.post("/api/broker/book/refresh").status_code in (401, 403)


def test_no_credential_arm_on_the_wire(client):
    _signup(client)
    r = client.get("/api/broker/book")
    assert r.status_code == 200
    assert r.json() == {"state": "unknown", "reason": "no_credential_stored", "positions": []}


def test_connected_book_serves_the_stub_with_full_envelope(client):
    _signup(client)
    _connect(client)
    r = client.get("/api/broker/book")
    assert r.status_code == 200
    body = r.json()
    assert body["state"] == "ok"
    assert len(body["positions"]) == 2
    for key in ("as_of", "basis", "stale_after_seconds", "account_ref",
                "last_attempt_at", "last_attempt_outcome"):
        assert key in body
    assert "reason" not in body
    # And the refresh route serves the same envelope shape.
    r2 = client.post("/api/broker/book/refresh")
    assert r2.status_code == 200 and r2.json()["state"] == "ok"


def test_delete_invalidation_leaves_no_ghost_field(client):
    user_id = _signup(client)
    _connect(client)
    populated = client.get("/api/broker/book").json()
    account_ref = populated["account_ref"]
    symbols = [leg["symbol"] for p in populated["positions"] for leg in p["legs"]]
    assert symbols                                          # the book really was populated
    assert user_id in main._broker_service._users           # cached server-side
    assert client.delete("/api/broker/credential").status_code == 200
    # The invalidation HOOK really fired: the server cache entry is gone, not just unreachable
    # behind the no_credential arm.
    assert user_id not in main._broker_service._users
    after = client.get("/api/broker/book")
    assert after.json() == {"state": "unknown", "reason": "no_credential_stored",
                            "positions": []}
    assert account_ref not in after.text
    for sym in symbols:
        assert sym not in after.text                        # AC-3: no residual book field


def test_decrypt_fail_is_ours_never_webulls(client):
    user_id = _signup(client)
    _connect(client)
    # Corrupt the stored ciphertext: resolution becomes ("unreadable", None).
    auth.get_service().stores.credentials.set_key(
        user_id, "corrupt-not-a-fernet-token", APP_KEY[-4:], kind="broker_webull")
    r = client.get("/api/broker/book")
    assert r.status_code == 200
    body = r.json()
    assert body["state"] == "unknown"
    assert body["reason"] == "credential_unreadable"
    text = r.text.lower()
    assert "rejected" not in text                           # never "Webull rejected your key"
    assert APP_KEY not in r.text and APP_SECRET not in r.text


def test_two_user_isolation_shares_no_field(client):
    _signup(client)
    _connect(client)
    a_book = client.get("/api/broker/book").json()
    a_hint = client.get("/api/broker/credential").json()

    with TestClient(main.app) as other:
        _signup(other)
        b_book = other.get("/api/broker/book")
        b_hint = other.get("/api/broker/credential")
        assert b_book.json() == {"state": "unknown", "reason": "no_credential_stored",
                                 "positions": []}
        assert b_hint.json() == {"set": False, "last4": None, "storage_available": True}
        combined = b_book.text + b_hint.text
        assert a_book["account_ref"] not in combined        # AC-23: nothing of A's leaks
        assert a_hint["last4"] not in combined
        for p in a_book["positions"]:
            for leg in p["legs"]:
                assert leg["symbol"] not in combined


def test_provider_raise_is_a_contained_200_adapter_fault(client, monkeypatch):
    _signup(client)
    _connect(client)

    class RaisingProvider(PositionsProvider):
        def fetch_book(self, credential, account_ref=None):
            raise RuntimeError("boom")

        def describe(self):
            return ProviderCapabilities("raising", "on_demand_snapshot", False, False, False)

    monkeypatch.setattr(main, "_broker_service", BrokerBookService(RaisingProvider()))
    r = client.get("/api/broker/book")
    assert r.status_code == 200
    assert (r.json()["state"], r.json()["reason"]) == ("unknown", "adapter_fault")


def test_gate_refusal_is_a_real_status_not_a_product_state(client):
    """The auth carve-out: anonymous is 401/403 with the auth envelope — never a 200
    `unknown` (that arm is reserved for signed-in broker trouble)."""
    r = client.get("/api/broker/book")
    assert r.status_code in (401, 403)
    assert "state" not in r.json()
