"""
broker-connect B2 — record shapes, wire presence rules, the read-only port surface, factory.

These pin the INTERFACE_CONTRACT §2/§4 presence rules at the record level (absent means
ABSENT, never null-padded), the no-write-method port invariant (`[no-real-order-path]` is a
TYPE-SURFACE fact, not a disabled button), and the masked credential repr (AC-5 arm).
"""
from __future__ import annotations

import pytest

from src.broker import get_positions_provider
from src.broker.ports import (
    BrokerBook,
    BrokerCredential,
    BrokerFact,
    BrokerLeg,
    BrokerPosition,
    PositionsProvider,
    ProviderCapabilities,
)
from src.broker.stub import StubProvider


def _leg(kind="equity", **kw):
    base = dict(kind=kind, symbol="AAPL", underlying="AAPL", quantity=100.0, multiplier=1.0,
                cost_basis=BrokerFact("supplied", 10.0), broker_mark=BrokerFact("supplied", 11.0))
    base.update(kw)
    return BrokerLeg(**base)


def _pos(**kw):
    base = dict(broker_position_id="p1", fidelity="exact", fidelity_notes=[],
                legs=[_leg()], unrealized_pl=BrokerFact("not_supplied"))
    base.update(kw)
    return BrokerPosition(**base)


# ------------------------------------------------------------------ BrokerFact wire

def test_fact_value_present_iff_supplied():
    assert BrokerFact("supplied", 3.5).to_wire() == {"state": "supplied", "value": 3.5}
    assert BrokerFact("not_supplied").to_wire() == {"state": "not_supplied"}
    assert BrokerFact("unparseable").to_wire() == {"state": "unparseable"}


# ------------------------------------------------------------------ BrokerLeg wire

def test_equity_leg_omits_option_fields():
    wire = _leg().to_wire()
    assert wire["kind"] == "equity"
    for absent in ("expiry", "strike", "right"):
        assert absent not in wire


def test_option_leg_carries_option_fields():
    wire = _leg(kind="option", symbol="SPY260918C00500000", underlying="SPY",
                expiry="2026-09-18", strike=500.0, right="call",
                quantity=-2.0, multiplier=100.0).to_wire()
    assert wire["expiry"] == "2026-09-18"
    assert wire["strike"] == 500.0
    assert wire["right"] == "call"
    assert wire["quantity"] == -2.0       # signed, never abs()'d on the wire
    assert wire["multiplier"] == 100.0    # explicit, never implied


# ------------------------------------------------------------------ BrokerPosition wire

def test_fidelity_notes_present_iff_not_exact():
    assert "fidelity_notes" not in _pos().to_wire()
    wire = _pos(fidelity="partial", fidelity_notes=["cost basis dropped"]).to_wire()
    assert wire["fidelity_notes"] == ["cost basis dropped"]
    wire = _pos(fidelity="unrecognized", fidelity_notes=["instrument_type WARRANT"],
                legs=[]).to_wire()
    assert wire["legs"] == []             # surfaced with empty legs, never dropped
    assert wire["fidelity_notes"] == ["instrument_type WARRANT"]


def test_unrealized_pl_always_present_as_tri_state():
    assert _pos().to_wire()["unrealized_pl"] == {"state": "not_supplied"}


# ------------------------------------------------------------------ BrokerBook wire presence

def test_unknown_book_carries_reason_and_nothing_snapshotty():
    wire = BrokerBook(state="unknown", reason="no_credential_stored").to_wire()
    assert wire["state"] == "unknown"
    assert wire["reason"] == "no_credential_stored"
    assert wire["positions"] == []
    for absent in ("as_of", "basis", "stale_after_seconds", "account_ref",
                   "last_attempt_at", "last_attempt_outcome"):
        assert absent not in wire


def test_ok_book_carries_envelope_and_no_reason():
    wire = BrokerBook(state="ok", as_of="2026-08-02T14:00:00Z", basis="fresh",
                      stale_after_seconds=300, account_ref="abcd1234abcd1234",
                      positions=[_pos()], last_attempt_at="2026-08-02T14:00:00Z",
                      last_attempt_outcome="ok").to_wire()
    assert "reason" not in wire
    assert wire["as_of"] == "2026-08-02T14:00:00Z"
    assert wire["basis"] == "fresh"
    assert wire["stale_after_seconds"] == 300
    assert wire["account_ref"] == "abcd1234abcd1234"
    assert wire["last_attempt_at"] == "2026-08-02T14:00:00Z"
    assert wire["last_attempt_outcome"] == "ok"
    assert len(wire["positions"]) == 1


def test_empty_and_unknown_both_carry_positions_list():
    empty = BrokerBook(state="empty", as_of="t", basis="fresh", stale_after_seconds=300).to_wire()
    unknown = BrokerBook(state="unknown", reason="broker_unreachable").to_wire()
    assert empty["positions"] == [] and unknown["positions"] == []
    # `state` is the SOLE disambiguator — same [] on both.
    assert empty["state"] != unknown["state"]


def test_reason_is_dropped_unless_unknown():
    # Defensive: even a mis-set reason never leaks onto a served snapshot.
    wire = BrokerBook(state="ok", reason="broker_unreachable", as_of="t", basis="cache",
                      stale_after_seconds=300).to_wire()
    assert "reason" not in wire


def test_last_attempt_outcome_only_with_last_attempt_at():
    wire = BrokerBook(state="unknown", reason="broker_unreachable",
                      last_attempt_outcome="broker_unreachable").to_wire()
    assert "last_attempt_at" not in wire and "last_attempt_outcome" not in wire


# ------------------------------------------------------------------ the read-only port

def test_port_type_surface_has_no_write_method():
    for verb in ("place_order", "cancel", "modify", "execute", "submit", "trade", "buy", "sell"):
        assert not any(verb in m.lower() for m in dir(PositionsProvider)), verb
    assert PositionsProvider.__abstractmethods__ == frozenset({"fetch_book", "describe"})


def test_credential_repr_and_str_are_masked():
    cred = BrokerCredential(app_key="wb-app-key-1234", app_secret="wb-app-secret-9876")
    for rendered in (repr(cred), str(cred), f"{cred}"):
        assert "wb-app-key-1234" not in rendered
        assert "wb-app-secret-9876" not in rendered
        assert rendered == "BrokerCredential(masked)"


# ------------------------------------------------------------------ factory

def test_factory_returns_stub_for_stub():
    assert isinstance(get_positions_provider("stub"), StubProvider)


def test_factory_raises_on_unknown_name():
    with pytest.raises(ValueError):
        get_positions_provider("etrade")


def test_factory_snaptrade_is_reserved_not_built():
    with pytest.raises(ValueError):
        get_positions_provider("snaptrade")


def test_factory_reads_env(monkeypatch):
    monkeypatch.setenv("POSITIONS_PROVIDER", "stub")
    assert isinstance(get_positions_provider(), StubProvider)


# ------------------------------------------------------------------ stub provider

def test_stub_ok_book_is_deterministic_with_equity_and_two_leg_option(monkeypatch):
    monkeypatch.delenv("STUB_BROKER_BOOK", raising=False)
    stub = StubProvider()
    cred = BrokerCredential("k", "s")
    book1, book2 = stub.fetch_book(cred, None), stub.fetch_book(cred, None)
    assert book1.to_wire() == book2.to_wire()
    assert book1.state == "ok"
    leg_counts = sorted(len(p.legs) for p in book1.positions)
    assert leg_counts == [1, 2]           # one equity + one two-leg options position
    kinds = {leg.kind for p in book1.positions for leg in p.legs}
    assert kinds == {"equity", "option"}
    assert book1.account_ref            # opaque, present


def test_stub_empty_switch(monkeypatch):
    monkeypatch.setenv("STUB_BROKER_BOOK", "empty")
    book = StubProvider().fetch_book(BrokerCredential("k", "s"), None)
    assert book.state == "empty" and book.positions == []


def test_stub_describe():
    caps = StubProvider().describe()
    assert isinstance(caps, ProviderCapabilities)
    assert caps.provider_id == "stub"
