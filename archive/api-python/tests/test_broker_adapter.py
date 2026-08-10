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

from src.broker import webull_adapter as wa
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


# --------------------------------------------- R2: honest option mapping (Amendment 1)

def test_the_real_book_maps_to_five_exact_nine_partial_zero_unrecognized():
    """R2's done-condition. The rejected alternative — every option as
    `unrecognized` + `legs: []` — is contract-legal but throws away the quantity, cost basis
    and mark Webull DOES supply on 9 of 14 real positions."""
    book = _provider(FakeTransport()).fetch_book(CRED)
    counts = {"exact": 0, "partial": 0, "unrecognized": 0}
    for p in book.positions:
        counts[p.fidelity] += 1
    assert counts == {"exact": 5, "partial": 9, "unrecognized": 0}
    by_id = _mapped_by_id(book)
    for oid in OPTION_IDS:
        assert len(by_id[oid].legs) == 1               # exactly one leg per contract row
        assert by_id[oid].legs[0].kind == "option"


def test_option_symbol_and_underlying_are_the_bare_ticker_verbatim():
    """`symbol` is the bare underlying ticker, NOT an OCC code — so an OCC code is never
    synthesized, and `underlying` is never derived from a contract-symbol prefix."""
    by_id = _mapped_by_id(map_positions(_entries()))
    for oid, ticker in ((ID_NVDA_OPT, "NVDA"), (ID_PLTR_OPT, "PLTR"),
                        (ID_META_OPT_SHORT, "META"), (ID_AAPL_OPT_LONG, "AAPL")):
        leg = by_id[oid].legs[0]
        assert leg.symbol == ticker
        assert leg.underlying == ticker


def test_option_contract_facts_are_omitted_on_the_wire_never_null_padded():
    by_id = _mapped_by_id(map_positions(_entries()))
    for oid in OPTION_IDS:
        leg = by_id[oid].legs[0]
        assert (leg.expiry, leg.strike, leg.right) == (None, None, None)
        wire = leg.to_wire()
        for absent in ("expiry", "strike", "right"):
            assert absent not in wire, f"{oid}: {absent} must be ABSENT, not null"


def test_every_omission_is_named_in_fidelity_notes():
    """`[absent-is-not-none]`: an omitted fact is never silently gone — Amendment 1 pairs
    every omission with a named note, so the FE can say "we don't know" rather than
    rendering "there is nothing"."""
    by_id = _mapped_by_id(map_positions(_entries()))
    for oid in OPTION_IDS:
        notes = " ".join(by_id[oid].fidelity_notes).lower()
        assert by_id[oid].fidelity_notes
        for named in ("strike", "expiry", "call/put"):
            assert named in notes, f"{oid}: {named} omission is not named"


def test_fidelity_notes_never_leak_payload_values():
    """Hygiene: the notes are FIXED strings. No quantity, cost, mark or id may appear."""
    entries = _entries()
    by_id = _mapped_by_id(map_positions(entries))
    for entry in entries:
        notes = by_id[str(entry["instrument_id"])].fidelity_notes
        for key in ("qty", "unit_cost", "total_cost", "last_price", "market_value",
                    "unrealized_profit_loss", "instrument_id"):
            value = str(entry[key])
            assert not any(value in n for n in notes), f"{key}={value} leaked into a note"


def test_option_leg_carries_the_quantity_and_facts_webull_did_supply():
    by_id = _mapped_by_id(map_positions(_entries()))
    nvda = by_id[ID_NVDA_OPT].legs[0]
    assert nvda.quantity == 10.0
    assert nvda.cost_basis == BrokerFact("supplied", 7.89)     # per-contract unit_cost
    assert nvda.broker_mark == BrokerFact("supplied", 4.85)    # per-contract last_price
    short = by_id[ID_AAPL_OPT_SHORT].legs[0]
    assert short.quantity == -10.0                             # signed, straight from `qty`


def test_option_facts_carry_through_when_a_broker_does_supply_them():
    """The presence rule is "iff the broker supplies it" — not "never". A feed that DOES
    carry contract detail maps to a full, `exact` leg with no notes."""
    entry = _synthetic(instrument_id="555", instrument_type="OPTION", symbol="SPY",
                       qty="2", unit_cost="3.25", last_price="4.10", total_cost="650.00",
                       option_type="CALL", strike_price="500", expire_date="2026-09-18",
                       contract_multiplier="100", underlying_symbol="SPY")
    pos = _mapped_by_id(map_positions([entry]))["555"]
    assert pos.fidelity == "exact"
    assert pos.fidelity_notes == []
    leg = pos.legs[0]
    assert (leg.right, leg.strike, leg.expiry) == ("call", 500.0, "2026-09-18")
    assert leg.multiplier == 100.0
    wire = leg.to_wire()
    assert wire["strike"] == 500.0 and wire["expiry"] == "2026-09-18"


def test_a_partially_supplied_option_names_only_the_facts_that_are_missing():
    entry = _synthetic(instrument_id="556", instrument_type="OPTION", symbol="SPY",
                       qty="2", unit_cost="3.25", total_cost="650.00",
                       option_type="PUT", contract_multiplier="100")
    pos = _mapped_by_id(map_positions([entry]))["556"]
    assert pos.fidelity == "partial"
    notes = " ".join(pos.fidelity_notes).lower()
    assert "strike" in notes and "expiry" in notes
    assert "call/put" not in notes                  # `right` WAS supplied — not an omission
    assert pos.legs[0].right == "put"


def test_option_without_a_symbol_is_unrecognized_never_an_anonymous_leg():
    entry = _synthetic(instrument_id="557", instrument_type="OPTION", symbol="", qty="1")
    pos = _mapped_by_id(map_positions([entry]))["557"]
    assert pos.fidelity == "unrecognized" and pos.legs == []


# ---------------------------------- R2b: multiplier reconstruction, behind four guards
# OWNER RULING 2026-08-03: reconstruct the x100 from Webull's own cost aggregate, with all
# four guards binding. The guards are not decoration — they are the whole basis of the
# ruling — so they are pinned by value here as well as by behaviour.

def test_multiplier_guard_constants_are_the_owner_ruled_values():
    assert wa._RECONSTRUCT_MULTIPLIER_FROM_COST is True     # the single flippable constant
    assert wa._MULTIPLIER_RATIO_TOLERANCE == 0.01           # guard 2: 1% of the rounded mult
    assert wa._MULTIPLIER_ROUNDTRIP_ABS == 0.01             # guard 3
    assert wa._MULTIPLIER_ROUNDTRIP_REL == 0.005            # guard 3
    assert wa._MULTIPLIER_MIN_UNIT_COST == 0.05             # guard 4: the precision floor


def test_every_real_option_row_reconstructs_to_one_hundred():
    by_id = _mapped_by_id(map_positions(_entries()))
    assert {by_id[oid].legs[0].multiplier for oid in OPTION_IDS} == {100.0}


def test_the_reconstruction_exactly_reproduces_webulls_own_total_cost():
    """The reconstruction is not a guess about options in general — it reproduces a
    broker-SUPPLIED aggregate. That is the property that makes "Net entry" a restatement of
    Webull's own number rather than a Convexa derivation."""
    by_id = _mapped_by_id(map_positions(_entries()))
    for oid in OPTION_IDS:
        raw = _entry(oid)
        leg = by_id[oid].legs[0]
        reproduced = leg.cost_basis.value * leg.multiplier * leg.quantity
        total_cost = float(raw["total_cost"])
        tolerance = max(0.01, 0.005 * abs(total_cost))
        assert abs(reproduced - total_cost) <= tolerance


def test_a_reconstructed_multiplier_is_named_in_fidelity_notes_as_reconstructed():
    by_id = _mapped_by_id(map_positions(_entries()))
    notes = " ".join(by_id[ID_NVDA_OPT].fidelity_notes).lower()
    assert "multiplier" in notes and "total_cost" in notes


def test_reconstruction_is_behind_one_flippable_constant_and_withholds_when_off(monkeypatch):
    """Flip one module constant and the withhold path takes over on every option row:
    multiplier None, key ABSENT on the wire, the withhold named in the notes. Never a
    plausible-looking default."""
    monkeypatch.setattr(wa, "_RECONSTRUCT_MULTIPLIER_FROM_COST", False)
    by_id = _mapped_by_id(map_positions(_entries()))
    for oid in OPTION_IDS:
        leg = by_id[oid].legs[0]
        assert leg.multiplier is None
        assert "multiplier" not in leg.to_wire()
        assert by_id[oid].fidelity == "partial"
        notes = " ".join(by_id[oid].fidelity_notes).lower()
        assert "multiplier not supplied and not reproducible" in notes
    # The rest of the row is unaffected — quantity and the supplied facts still ride.
    assert by_id[ID_NVDA_OPT].legs[0].quantity == 10.0
    assert by_id[ID_NVDA_OPT].legs[0].cost_basis == BrokerFact("supplied", 7.89)


def _derived(**overrides):
    entry = _synthetic(instrument_id="600", instrument_type="OPTION", symbol="ZZZ", **overrides)
    return _mapped_by_id(map_positions([entry]))["600"].legs[0].multiplier


def test_guard_one_rejects_a_multiplier_below_one():
    # total_cost < unit_cost x qty ⇒ ratio 0.4 ⇒ rounds to 0. A sub-unit multiplier is never
    # a contract multiplier; withhold rather than emit a nonsense scale.
    assert _derived(qty="10", unit_cost="10.00", total_cost="40.00") is None


def test_guard_two_and_three_reject_a_ratio_that_drifts_off_a_whole_multiplier():
    # ratio 10.4: 4% off the nearest whole multiplier. Guard 2 (1% of mult = 0.1) rejects it;
    # guard 3's round-trip would reject it too.
    assert _derived(qty="10", unit_cost="10.00", total_cost="1040.00") is None


def test_guard_three_round_trip_rejects_what_the_ratio_tolerance_alone_would_admit():
    # ratio 99.5 -> rounds to 100, and |99.5-100| = 0.5 is INSIDE guard 2's 1%-of-100 = 1.0
    # window. Only the round-trip check catches it: 10.00 x 100 x 10 = 10000 misses the
    # broker's own 9950 by 50, outside max(0.01, 0.005 x 9950) = 49.75.
    assert _derived(qty="10", unit_cost="10.00", total_cost="9950.00") is None


def test_guard_four_precision_floor_rejects_a_deep_otm_unit_cost():
    # unit_cost 0.04 reconstructs a clean ratio of exactly 100 — every other guard passes —
    # but below 5 cents a 2-decimal rounding can distort the ratio by >10%. The deep-OTM
    # landmine: withheld on principle, not on arithmetic.
    assert _derived(qty="10", unit_cost="0.04", total_cost="40.00") is None
    assert _derived(qty="10", unit_cost="0.05", total_cost="50.00") == 100.0   # at the floor


def test_reconstruction_needs_the_brokers_aggregate_and_withholds_without_it():
    assert _derived(qty="10", unit_cost="7.89", total_cost="7889.00") == 100.0
    for missing in ({"total_cost": None}, {"total_cost": "not-a-number"},
                    {"unit_cost": None}, {"qty": "0", "total_cost": "0"},
                    {"unit_cost": "0.00", "total_cost": "0.00"}):
        fields = {"instrument_id": "601", "instrument_type": "OPTION", "symbol": "ZZZ",
                  "qty": "10", "unit_cost": "7.89", "total_cost": "7889.00", **missing}
        pos = _mapped_by_id(map_positions([_synthetic(**fields)]))["601"]
        assert pos.legs[0].multiplier is None, missing


def test_a_broker_supplied_multiplier_always_beats_the_reconstruction():
    """"Known" means broker-supplied FIRST, reconstructed only as a fallback — and a
    non-standard supplied multiplier carries through untouched, never normalized to 100."""
    leg_mult = _derived(qty="10", unit_cost="10.00", total_cost="10000.00",
                        contract_multiplier="5")
    assert leg_mult == 5.0


def test_a_withheld_multiplier_never_defaults_to_one_or_a_hundred():
    entry = _synthetic(instrument_id="602", instrument_type="OPTION", symbol="ZZZ",
                       qty="10", unit_cost="10.00", total_cost="40.00")   # guard 1 rejects
    pos = _mapped_by_id(map_positions([entry]))["602"]
    leg = pos.legs[0]
    assert leg.multiplier is None
    assert leg.multiplier not in (1.0, 100.0)
    assert "multiplier" not in leg.to_wire()
    assert pos.fidelity == "partial"


def test_equity_multiplier_is_never_reconstructed_it_is_one_by_definition():
    """A share's multiplier is 1 by the definition of the unit, not an inference — and the
    real payload proves reconstruction would be noisy there anyway (AMD's rounded
    `unit_cost` misses `total_cost` by 0.12)."""
    by_id = _mapped_by_id(map_positions(_entries()))
    assert {by_id[sid].legs[0].multiplier for sid in STOCK_IDS} == {1.0}
    assert all(by_id[sid].fidelity == "exact" for sid in STOCK_IDS)


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
