"""
broker-connect B4 — Webull adapter characterization tests over the B1 fixtures.

The golden-fixture pattern the scoring path uses: the fixtures ARE the payload truth the
mapping binds to. The fixtures here are the OWNER'S REAL CAPTURE (`positions_raw.json` et al,
committed 2026-08-03) — there is deliberately **no fallback**: `_load` hard-fails naming the
capture tool. The previous silent captured-else-provisional fallback is exactly the mechanism
that let 10 of these tests pass against fiction and then break the instant reality arrived.

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

from src.broker.ports import BrokerCredential, BrokerFact
from src.broker.webull_adapter import (
    WebullProvider,
    account_ref_for,
    map_failure,
    map_positions,
)

FIXDIR = Path(__file__).parent / "fixtures" / "broker"

_CAPTURE_CMD = (".venv/Scripts/python.exe tests/capture_broker_fixtures.py "
                "(owner's shell, WEBULL_APP_KEY + WEBULL_APP_SECRET set)")


def _load(stem: str) -> dict:
    """Captured fixtures ONLY. A missing one is a hard failure naming the capture tool —
    never a silent fall back onto a hand-derived guess (that fallback is what let this file
    pass against fiction until the owner's real capture landed)."""
    path = FIXDIR / f"{stem}.json"
    if not path.exists():
        raise AssertionError(
            f"Captured broker fixture is missing: {path}. These tests bind to the owner's "
            f"REAL Webull capture and have no provisional fallback by design. Re-capture "
            f"with: {_CAPTURE_CMD}")
    return json.loads(path.read_text(encoding="utf-8"))


POSITIONS_FIXTURE = _load("positions_raw")
ACCOUNT_FIXTURE = _load("account_raw")
ERROR_FIXTURE = _load("error_bad_credential")
RATELIMIT_FIXTURE = _load("rate_limit_headers")

# ---------------------------------------------------------------- captured instrument ids
# The real payload's ONLY position key is `instrument_id`; there is no `id` key at all.
# Named so a future key rename is a one-line diff instead of magic strings in 12 assertions.
ID_AMD_STOCK = "913254235"          # long 25 @ 461.41
ID_AAPL_STOCK = "913256135"         # long 10 @ 309.00
ID_INTC_STOCK = "913257268"         # long 100 @ 90.75
ID_MU_STOCK = "913324077"           # long 10 @ 831.42
ID_SPCX_STOCK = "951015522"         # long 100 @ 108.98
ID_NVDA_OPT = "1058096497"          # long 10 @ 7.89 · total_cost 7889.00
ID_PLTR_OPT = "1058322781"          # long 2 @ 24.95 · total_cost 4990.00
ID_TSLA_OPT_LONG_A = "1061776505"   # long 10 @ 10.62
ID_AAPL_OPT_LONG = "1061783502"     # long 10 @ 6.92
ID_AAPL_OPT_SHORT = "1061810138"    # SHORT 10 @ 3.07 · total_cost -3070.00
ID_TSLA_OPT_SHORT = "1062038045"    # SHORT 4 @ 8.49
ID_TSLA_OPT_LONG_B = "1062257958"   # long 4 @ 16.34
ID_META_OPT_SHORT = "1062622359"    # SHORT 5 @ 10.49
ID_META_OPT_LONG = "1062651284"     # long 5 @ 18.10

STOCK_IDS = (ID_AMD_STOCK, ID_AAPL_STOCK, ID_INTC_STOCK, ID_MU_STOCK, ID_SPCX_STOCK)
OPTION_IDS = (ID_NVDA_OPT, ID_PLTR_OPT, ID_TSLA_OPT_LONG_A, ID_AAPL_OPT_LONG,
              ID_AAPL_OPT_SHORT, ID_TSLA_OPT_SHORT, ID_TSLA_OPT_LONG_B,
              ID_META_OPT_SHORT, ID_META_OPT_LONG)


def _entries() -> list[dict]:
    out: list[dict] = []
    for page in POSITIONS_FIXTURE["pages"]:
        out.extend(page.get("holdings") or page.get("positions") or [])
    return copy.deepcopy(out)


def _entry(instrument_id: str) -> dict:
    return next(e for e in _entries() if e["instrument_id"] == instrument_id)


def _synthetic(**overrides) -> dict:
    """A payload entry shaped EXACTLY like the captured ones (13 keys, string numerics), for
    the arms real data cannot produce — a bad instrument_type, a broker that one day does
    supply contract detail, a deep-OTM precision landmine."""
    base = {
        "instrument_id": "999000111", "symbol": "ZZZZ", "instrument_type": "STOCK",
        "short_name": "ZZZZ", "qty": "1", "unit_cost": "1.00", "currency": "USD",
        "total_cost": "1.00", "last_price": "1.00", "market_value": "1.00",
        "unrealized_profit_loss": "0.00", "unrealized_profit_loss_rate": "0.00",
        "holding_proportion": "0.00",
    }
    base.update(overrides)
    return base


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


def _mapped_by_id(book_or_positions):
    positions = getattr(book_or_positions, "positions", book_or_positions)
    return {p.broker_position_id: p for p in positions}


# ------------------------------------------------------------------ AC-6a: nothing dropped

def test_every_fixture_position_appears_count_never_understates():
    book = _provider(FakeTransport()).fetch_book(CRED)
    assert book.state == "ok"
    entries = _entries()
    assert len(entries) == 14                          # the owner's real book, 5 stock + 9 option
    assert len(book.positions) == len(entries)
    mapped_ids = {p.broker_position_id for p in book.positions}
    for entry in entries:
        assert str(entry["instrument_id"]) in mapped_ids


def test_position_ids_are_instrument_ids_and_no_id_key_exists():
    """Pins the exact bug class that broke 10 tests: the adapter used to prefer an `id` key
    that the real payload does not have anywhere."""
    entries = _entries()
    assert all("id" not in e for e in entries), "real Webull entries carry no `id` key"
    assert all(e.get("instrument_id") for e in entries)
    by_id = _mapped_by_id(map_positions(entries))
    assert set(by_id) == {str(e["instrument_id"]) for e in entries}
    assert set(by_id) == set(STOCK_IDS) | set(OPTION_IDS)


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


def test_instrument_type_vocabulary_is_the_captured_one():
    """Webull says STOCK, not EQUITY. A silent vocabulary drift maps the whole book to
    `unrecognized`, which is exactly what happened pre-capture."""
    kinds = {e["instrument_type"] for e in _entries()}
    assert kinds == {"STOCK", "OPTION"}
    by_id = _mapped_by_id(map_positions(_entries()))
    for sid in STOCK_IDS:
        assert by_id[sid].fidelity == "exact"
        assert [leg.kind for leg in by_id[sid].legs] == ["equity"]


# ------------------------------------------------------------------ leg mapping fidelity

def test_signed_quantity_short_is_negative():
    by_id = _mapped_by_id(map_positions(_entries()))
    assert by_id[ID_AMD_STOCK].legs[0].quantity == 25.0
    # Webull's `qty` already carries the sign on a short — no sign synthesis anywhere.
    assert _entry(ID_AAPL_OPT_SHORT)["qty"] == "-10"


def test_equity_leg_multiplier_is_explicit_one_never_an_implied_hundred():
    by_id = _mapped_by_id(map_positions(_entries()))
    for sid in STOCK_IDS:
        assert by_id[sid].legs[0].multiplier == 1.0


def test_equity_leg_omits_the_option_facts():
    by_id = _mapped_by_id(map_positions(_entries()))
    eq = by_id[ID_INTC_STOCK].legs[0]
    assert (eq.kind, eq.expiry, eq.strike, eq.right) == ("equity", None, None, None)
    assert eq.symbol == "INTC" and eq.underlying == "INTC"
    wire = eq.to_wire()
    for absent in ("expiry", "strike", "right"):
        assert absent not in wire


# ------------------------------------------------------------------ tri-state facts

def test_unrealized_pl_supplied_is_carried_verbatim():
    by_id = _mapped_by_id(map_positions(_entries()))
    assert by_id[ID_AMD_STOCK].unrealized_pl == BrokerFact("supplied", 267.63)


def test_webulls_own_option_pl_is_carried_verbatim_even_though_it_is_wrong():
    """Webull computes an option row's `unrealized_profit_loss` as
    `market_value - total_cost`, applying the x100 contract multiplier to ONLY `total_cost`
    — so its own figure is wrong by ~100x. INTERFACE §4 says the carry is VERBATIM: we
    surface the broker's fact as the broker states it and never silently "correct" it
    (a corrected number presented as the broker's would be a fabricated broker fact)."""
    by_id = _mapped_by_id(map_positions(_entries()))
    nvda = by_id[ID_NVDA_OPT]
    assert nvda.unrealized_pl == BrokerFact("supplied", -7840.50)   # EXACTLY Webull's number

    raw = _entry(ID_NVDA_OPT)
    true_economic = (float(raw["last_price"]) - float(raw["unit_cost"])) * float(raw["qty"]) * 100
    assert true_economic == pytest.approx(-3040.0)
    # The whole point: we did NOT move toward the true figure.
    assert nvda.unrealized_pl.value != pytest.approx(true_economic, abs=1.0)


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
        if e["instrument_id"] == ID_AMD_STOCK:
            e["unrealized_profit_loss"] = "N/A"
            e["unit_cost"] = "garbage"
    by_id = _mapped_by_id(map_positions(entries))
    assert by_id[ID_AMD_STOCK].unrealized_pl.state == "unparseable"
    assert by_id[ID_AMD_STOCK].legs[0].cost_basis.state == "unparseable"
    assert by_id[ID_AMD_STOCK].legs[0].cost_basis.value is None


def test_cost_basis_is_the_per_unit_figure_never_the_aggregate():
    """R9c, now a CONFIRMED capture fact rather than an assumption: `unit_cost`/`last_price`
    are per-unit; `total_cost`/`market_value` are aggregates and never reach a leg."""
    by_id = _mapped_by_id(map_positions(_entries()))
    amd = by_id[ID_AMD_STOCK].legs[0]
    assert amd.cost_basis == BrokerFact("supplied", 461.41)     # unit_cost, not 11535.37
    assert amd.broker_mark == BrokerFact("supplied", 472.12)    # last_price, not 11803.00
    raw = _entry(ID_AMD_STOCK)
    # `unit_cost` is a 2-decimal ROUNDED average cost, so unit_cost x qty reproduces
    # `total_cost` only to within the rounding (11535.25 vs 11535.37 here). That residue is
    # precisely why `_derive_multiplier` needs a tolerance rather than exact equality.
    assert float(raw["total_cost"]) == pytest.approx(461.41 * 25, abs=0.5)
    aggregates = {float(raw["total_cost"]), float(raw["market_value"])}
    assert amd.cost_basis.value not in aggregates
    assert amd.broker_mark.value not in aggregates


# ------------------------------------------------------------------ AC-6b: flat ⇒ no composition

def test_flat_payload_never_composes_contracts_into_strategies():
    """The captured payload has NO grouping identity (CAPTURE_FINDINGS §a: candidate list
    empty) — a settled fact now, not a fallback. Three TSLA contracts, two AAPL contracts and
    two META contracts stay separate single-leg positions; nothing is composed by heuristic."""
    book = _provider(FakeTransport()).fetch_book(CRED)
    by_id = _mapped_by_id(book)
    assert len(book.positions) == 14
    same_underlying_groups = [
        (ID_TSLA_OPT_LONG_A, ID_TSLA_OPT_SHORT, ID_TSLA_OPT_LONG_B),
        (ID_AAPL_OPT_LONG, ID_AAPL_OPT_SHORT),
        (ID_META_OPT_SHORT, ID_META_OPT_LONG),
    ]
    for group in same_underlying_groups:
        assert len({by_id[i].broker_position_id for i in group}) == len(group)


def test_option_entries_carry_no_contract_detail_at_all():
    """The BIG capture fact: an OPTION row is byte-for-byte the same 13 keys as a STOCK row.
    No option_type, strike_price, expire_date, contract_multiplier or underlying_symbol
    anywhere, and `symbol` is the bare underlying ticker, not an OCC contract code."""
    absent = ("option_type", "strike_price", "expire_date", "contract_multiplier",
              "underlying_symbol")
    stock_keys = {frozenset(e) for e in _entries() if e["instrument_type"] == "STOCK"}
    option_entries = [e for e in _entries() if e["instrument_type"] == "OPTION"]
    assert len(option_entries) == 9
    for e in option_entries:
        assert frozenset(e) in stock_keys              # identical key set to a stock row
        for key in absent:
            assert key not in e
        assert e["symbol"].isalpha()                   # bare ticker, never an OCC code


# ------------------------------------------------------------------ unrepresentable entries

def test_unrepresentable_entry_is_surfaced_as_unrecognized_not_dropped():
    """The real book produces no unrecognized entries; this arm is synthetic on purpose and
    stays covered so a future WARRANT/CRYPTO row can never be silently dropped."""
    entries = _entries() + [_synthetic(instrument_id="777", instrument_type="WARRANT",
                                       qty="50", unit_cost="0.8000")]
    by_id = _mapped_by_id(map_positions(entries))
    assert len(by_id) == 15
    warrant = by_id["777"]
    assert warrant.fidelity == "unrecognized"
    assert warrant.legs == []
    assert warrant.fidelity_notes                      # the dropped fact is NAMED
    assert any("instrument_type" in n for n in warrant.fidelity_notes)
    # Notes never carry payload VALUES beyond the enum: no quantity/cost figures leak.
    assert not any("0.8000" in n or "50" in n for n in warrant.fidelity_notes)


def test_entry_that_explodes_mapping_is_contained_per_position():
    entries = _entries()
    entries[0]["qty"] = {"weird": ["shape"]}           # unparseable quantity
    positions = map_positions(entries)
    assert len(positions) == len(entries)              # still surfaced, never dropped
    assert positions[0].fidelity == "unrecognized"
    assert positions[0].broker_position_id == ID_AMD_STOCK


def test_non_object_entry_is_contained():
    positions = map_positions(_entries() + ["not-an-object"])
    assert len(positions) == 15
    assert positions[-1].fidelity == "unrecognized"
    assert positions[-1].legs == []


# ------------------------------------------------------------------ failure-cause mapping

def test_bad_credential_fixture_maps_to_credential_rejected():
    exc = _exc_from_shape(ERROR_FIXTURE["exception"])
    assert exc.error_code == "UNAUTHORIZED" and exc.http_status == 401
    assert exc.error_msg == ""                         # captured shape: empty message
    assert map_failure(exc) == "credential_rejected"
    t = FakeTransport(raise_on_subs=exc)
    book = _provider(t).fetch_book(CRED)
    assert (book.state, book.reason) == ("unknown", "credential_rejected")
    assert book.positions == []


def test_synthetic_429_maps_to_rate_limited():
    """SYNTHETIC by necessity — Webull never returned a 429 during the capture run. This pins
    OUR mapping logic, not observed vendor behaviour."""
    exc = _exc_from_shape({"error_code": "RATE_LIMIT_EXCEEDED", "error_msg": "too many requests",
                           "http_status": 429, "request_id": "r"})
    assert map_failure(exc) == "rate_limited"
    by_code_only = _exc_from_shape({"error_code": "TOO_MANY_REQUESTS", "error_msg": "",
                                    "http_status": None, "request_id": "r"})
    assert map_failure(by_code_only) == "rate_limited"


_RATE_LIMIT_HEADER_WORDS = ("rate", "limit", "quota", "retry", "throttle")


def test_captured_reads_exposed_no_rate_limit_headers_tripwire():
    """Webull exposed NO rate/limit headers on any read (CAPTURE_FINDINGS §d) — only
    X-Request-Id — so our own `BROKER_REFRESH_MIN_INTERVAL_SECONDS` throttle is the sole real
    mechanism. If a future capture DOES see such a header, this fails loudly rather than
    letting a real budget signal sit unread in a fixture."""
    offenders = []
    for scope, headers in RATELIMIT_FIXTURE.items():
        if not isinstance(headers, dict):
            continue
        for name in headers:
            if any(word in name.lower() for word in _RATE_LIMIT_HEADER_WORDS):
                offenders.append(f"{scope}.{name}")
    assert offenders == [], (
        f"Webull now exposes rate-limit headers {offenders}: the adapter's throttle should "
        f"read them instead of relying on our interval alone.")


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


def test_captured_subscriptions_payload_is_sanitized_and_multi_entry():
    """The owner's capture carried TWO subscription entries and the adapter takes the first
    — an unpinned choice on one data point, flagged (not a bug) so a future multi-account
    owner sees it named rather than discovering it."""
    subs = ACCOUNT_FIXTURE["subscriptions"]
    assert len(subs) == 2
    assert all(s["account_id"] == "ACCT_REDACTED" for s in subs)


# ------------------------------------------------------------------ describe

def test_describe_names_the_provider():
    caps = WebullProvider().describe()
    assert caps.provider_id == "webull"
    assert caps.refresh_basis == "on_demand_snapshot"
    assert caps.supplies_unrealized_pl is True         # confirmed by capture question (e)
