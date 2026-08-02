"""
broker-connect B4 — Webull adapter characterization tests over the B1 fixtures.

The golden-fixture pattern the scoring path uses: the fixtures ARE the payload truth the
mapping binds to. Until the owner's capture run lands, the truth is the
`*.PROVISIONAL-PENDING-CAPTURE.json` fixtures (hand-derived from Webull's documented shapes);
the loader prefers the captured `positions_raw.json` etc. the moment they exist, so
reconciliation is a fixture swap + assertion diff, not a rewrite.

Pins: every payload position appears in the mapped book (AC-6a count anchor) · signed
quantity · explicit per-leg multiplier (never x100 hardcoded) · tri-state facts · flat
payload ⇒ NO heuristic composition (AC-6b arm) · unrepresentable ⇒ `unrecognized` surfaced,
never dropped · closed failure-cause mapping · opaque HMAC `account_ref`.
"""
from __future__ import annotations

import copy
import hashlib
import hmac as hmac_mod
import json
from pathlib import Path

import pytest

from src.broker.ports import BrokerCredential
from src.broker.webull_adapter import (
    WebullProvider,
    account_ref_for,
    map_failure,
    map_positions,
)

FIXDIR = Path(__file__).parent / "fixtures" / "broker"


def _load(stem: str) -> dict:
    captured = FIXDIR / f"{stem}.json"
    provisional = FIXDIR / f"{stem}.PROVISIONAL-PENDING-CAPTURE.json"
    path = captured if captured.exists() else provisional
    return json.loads(path.read_text(encoding="utf-8"))


POSITIONS_FIXTURE = _load("positions_raw")
ACCOUNT_FIXTURE = _load("account_raw")
ERROR_FIXTURE = _load("error_bad_credential")
RATELIMIT_FIXTURE = _load("rate_limit_headers")


def _entries() -> list[dict]:
    out: list[dict] = []
    for page in POSITIONS_FIXTURE["pages"]:
        out.extend(page.get("holdings") or page.get("positions") or [])
    return copy.deepcopy(out)


def _exc_from_shape(shape: dict) -> Exception:
    """Duck-typed stand-in for webullsdkcore's ServerException (same attribute surface)."""
    e = Exception(shape.get("error_msg") or "")
    e.error_code = shape.get("error_code")
    e.error_msg = shape.get("error_msg")
    e.http_status = shape.get("http_status")
    e.request_id = shape.get("request_id")
    return e


class FakeTransport:
    def __init__(self, subscriptions=None, pages=None, raise_on_subs=None, raise_on_pos=None):
        self._subs = subscriptions if subscriptions is not None \
            else copy.deepcopy(ACCOUNT_FIXTURE["subscriptions"])
        self._pages = pages if pages is not None \
            else copy.deepcopy(POSITIONS_FIXTURE["pages"])
        self._raise_on_subs = raise_on_subs
        self._raise_on_pos = raise_on_pos
        self.position_calls = 0

    def subscriptions(self):
        if self._raise_on_subs:
            raise self._raise_on_subs
        return self._subs

    def positions_page(self, account_id, last_instrument_id=None):
        if self._raise_on_pos:
            raise self._raise_on_pos
        page = self._pages[min(self.position_calls, len(self._pages) - 1)]
        self.position_calls += 1
        return page


def _provider(transport: FakeTransport) -> WebullProvider:
    return WebullProvider(transport_factory=lambda credential: transport)


CRED = BrokerCredential("k", "s")


# ------------------------------------------------------------------ AC-6a: nothing dropped

def test_every_fixture_position_appears_count_never_understates():
    book = _provider(FakeTransport()).fetch_book(CRED)
    assert book.state == "ok"
    entries = _entries()
    assert len(book.positions) == len(entries)
    mapped_ids = {p.broker_position_id for p in book.positions}
    for entry in entries:
        assert str(entry["id"]) in mapped_ids


def test_paging_is_absorbed_inside_fetch_book():
    entries = _entries()
    pages = [
        {"has_next": True, "holdings": entries[:2]},
        {"has_next": False, "holdings": entries[2:]},
    ]
    t = FakeTransport(pages=pages)
    book = _provider(t).fetch_book(CRED)
    assert t.position_calls == 2
    assert len(book.positions) == len(entries)


# ------------------------------------------------------------------ leg mapping fidelity

def _mapped_by_id(book_or_positions):
    positions = getattr(book_or_positions, "positions", book_or_positions)
    return {p.broker_position_id: p for p in positions}


def test_signed_quantity_short_is_negative():
    by_id = _mapped_by_id(map_positions(_entries()))
    short_put = by_id["1003"]
    assert short_put.legs[0].quantity == -1.0
    long_call = by_id["1002"]
    assert long_call.legs[0].quantity == 2.0


def test_multiplier_is_read_from_the_payload_never_hardcoded():
    entries = _entries()
    for e in entries:
        if e["id"] == 1002:
            e["contract_multiplier"] = "5"     # a non-standard multiplier must carry through
    by_id = _mapped_by_id(map_positions(entries))
    assert by_id["1002"].legs[0].multiplier == 5.0
    assert by_id["1003"].legs[0].multiplier == 100.0
    assert by_id["1001"].legs[0].multiplier == 1.0   # equity: explicit 1, not an implied 100


def test_option_fields_map_and_equity_omits_them():
    by_id = _mapped_by_id(map_positions(_entries()))
    call = by_id["1002"].legs[0]
    assert (call.kind, call.right, call.strike, call.expiry, call.underlying) == \
        ("option", "call", 500.0, "2026-09-18", "SPY")
    put = by_id["1003"].legs[0]
    assert (put.kind, put.right, put.strike) == ("option", "put", 480.0)
    eq = by_id["1001"].legs[0]
    assert (eq.kind, eq.expiry, eq.strike, eq.right) == ("equity", None, None, None)


# ------------------------------------------------------------------ tri-state facts

def test_unrealized_pl_supplied_is_carried_verbatim():
    by_id = _mapped_by_id(map_positions(_entries()))
    assert by_id["1002"].unrealized_pl.state == "supplied"
    assert by_id["1002"].unrealized_pl.value == 170.0


def test_unrealized_pl_missing_is_not_supplied_never_computed():
    entries = _entries()
    for e in entries:
        e.pop("unrealized_profit_loss", None)   # unit_cost + last_price still present
    for p in map_positions(entries):
        assert p.unrealized_pl.state == "not_supplied"
        assert p.unrealized_pl.value is None


def test_malformed_fact_is_unparseable_not_zero():
    entries = _entries()
    for e in entries:
        if e["id"] == 1001:
            e["unrealized_profit_loss"] = "N/A"
            e["unit_cost"] = "garbage"
    by_id = _mapped_by_id(map_positions(entries))
    assert by_id["1001"].unrealized_pl.state == "unparseable"
    assert by_id["1001"].legs[0].cost_basis.state == "unparseable"
    assert by_id["1001"].legs[0].cost_basis.value is None


# ------------------------------------------------------------------ AC-6b: flat ⇒ no composition

def test_flat_payload_never_composes_contracts_into_strategies():
    book = _provider(FakeTransport()).fetch_book(CRED)
    option_positions = [p for p in book.positions
                        if any(leg.kind == "option" for leg in p.legs)]
    # The two SPY 2026-09-18 contracts stay two SEPARATE single-leg positions.
    assert len(option_positions) == 2
    for p in option_positions:
        assert len(p.legs) == 1


# ------------------------------------------------------------------ unrepresentable entries

def test_unrepresentable_entry_is_surfaced_as_unrecognized_not_dropped():
    by_id = _mapped_by_id(map_positions(_entries()))
    warrant = by_id["1004"]
    assert warrant.fidelity == "unrecognized"
    assert warrant.legs == []
    assert warrant.fidelity_notes                      # the dropped fact is NAMED
    assert any("instrument_type" in n for n in warrant.fidelity_notes)
    # Notes never carry payload VALUES beyond the enum: no quantity/cost figures leak.
    assert not any("0.8000" in n or "50" in n for n in warrant.fidelity_notes)


def test_option_missing_multiplier_is_unrecognized_never_fabricated():
    entries = _entries()
    for e in entries:
        if e["id"] == 1002:
            e.pop("contract_multiplier")
    by_id = _mapped_by_id(map_positions(entries))
    assert by_id["1002"].fidelity == "unrecognized"
    assert by_id["1002"].legs == []                    # never a plausible-looking x100 guess


def test_entry_that_explodes_mapping_is_contained_per_position():
    entries = _entries()
    entries[0]["quantity"] = {"weird": ["shape"]}      # unparseable quantity
    positions = map_positions(entries)
    assert len(positions) == len(entries)              # still surfaced, never dropped
    assert positions[0].fidelity == "unrecognized"


# ------------------------------------------------------------------ failure-cause mapping

def test_bad_credential_fixture_maps_to_credential_rejected():
    exc = _exc_from_shape(ERROR_FIXTURE["exception"])
    assert map_failure(exc) == "credential_rejected"
    t = FakeTransport(raise_on_subs=exc)
    book = _provider(t).fetch_book(CRED)
    assert (book.state, book.reason) == ("unknown", "credential_rejected")
    assert book.positions == []


def test_rate_limit_fixture_maps_to_rate_limited():
    exc = _exc_from_shape(RATELIMIT_FIXTURE["throttle_probe"]["exception"])
    assert map_failure(exc) == "rate_limited"


def test_network_failure_maps_to_broker_unreachable():
    client_exc = Exception("connect timeout")
    client_exc.error_code = "SDK.HttpError"            # webullsdkcore ClientException shape
    client_exc.error_msg = "connection refused"
    assert map_failure(client_exc) == "broker_unreachable"
    assert map_failure(TimeoutError("t")) == "broker_unreachable"
    assert map_failure(ConnectionError("c")) == "broker_unreachable"


def test_vendor_5xx_maps_to_broker_unreachable():
    exc = _exc_from_shape({"error_code": "INTERNAL_ERROR", "error_msg": "oops",
                           "http_status": 502, "request_id": "r"})
    assert map_failure(exc) == "broker_unreachable"


def test_anything_else_maps_to_adapter_fault_never_raises():
    assert map_failure(ValueError("boom")) == "adapter_fault"
    book = _provider(FakeTransport(raise_on_pos=ValueError("boom"))).fetch_book(CRED)
    assert (book.state, book.reason) == ("unknown", "adapter_fault")


def test_garbage_subscriptions_payload_is_adapter_fault_not_a_raise():
    book = _provider(FakeTransport(subscriptions={"nothing": "here"})).fetch_book(CRED)
    assert (book.state, book.reason) == ("unknown", "adapter_fault")


# ------------------------------------------------------------------ empty book

def test_empty_holdings_is_a_confirmed_empty_state():
    book = _provider(FakeTransport(pages=[{"has_next": False, "holdings": []}])).fetch_book(CRED)
    assert book.state == "empty"
    assert book.positions == []
    assert book.account_ref                            # the account still resolved


# ------------------------------------------------------------------ account_ref opacity (AC-23)

def test_account_ref_is_keyed_hash_never_the_raw_number(monkeypatch):
    monkeypatch.setenv("AUTH_SESSION_SIGNING_KEY", "test-ref-secret")
    raw = "ZH-REAL-ACCOUNT-42"
    ref = account_ref_for(raw)
    expected = hmac_mod.new(b"test-ref-secret", raw.encode("utf-8"),
                            hashlib.sha256).hexdigest()[:16]
    assert ref == expected
    assert len(ref) == 16
    assert raw not in ref and "42" not in ref
    assert account_ref_for(raw) == ref                 # deterministic per secret


def test_fetched_book_carries_hashed_ref_not_fixture_account_value():
    subs = copy.deepcopy(ACCOUNT_FIXTURE["subscriptions"])
    subs[0]["account_id"] = "RAW-ACCT-777"
    book = _provider(FakeTransport(subscriptions=subs)).fetch_book(CRED)
    assert book.account_ref is not None
    assert "RAW-ACCT-777" not in book.account_ref
    assert "777" not in book.account_ref


# ------------------------------------------------------------------ describe

def test_describe_names_the_provider():
    caps = WebullProvider().describe()
    assert caps.provider_id == "webull"
    assert caps.refresh_basis == "on_demand_snapshot"
