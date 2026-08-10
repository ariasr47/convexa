"""
Stub positions provider — keyless verification (`POSITIONS_PROVIDER=stub`).

Deterministic: same book every call (no clock, no randomness), so app-run walks and the
conformance sweep see stable output. `STUB_BROKER_BOOK` switches the arm:
  ok (default) — one equity + one two-leg options position
  empty        — a confirmed-empty book
  <failure-cause> — a typed unknown with that reason (FE degradation walks)

Part of the broker leaf: stdlib + the leaf's own ports only.
"""
from __future__ import annotations

import os
from typing import Optional

from .ports import (BrokerBook, BrokerCredential, BrokerFact, BrokerLeg, BrokerPosition,
                    FAILURE_CAUSES, PositionsProvider, ProviderCapabilities)

# Opaque and obviously synthetic; shaped like the adapter's 16-hex handle.
_STUB_ACCOUNT_REF = "57ab0000ac0000ef"


def _ok_positions() -> list[BrokerPosition]:
    return [
        BrokerPosition(
            broker_position_id="stub-eq-AAPL",
            fidelity="exact",
            fidelity_notes=[],
            legs=[BrokerLeg(kind="equity", symbol="AAPL", underlying="AAPL",
                            quantity=100.0, multiplier=1.0,
                            cost_basis=BrokerFact("supplied", 142.75),
                            broker_mark=BrokerFact("supplied", 150.10))],
            unrealized_pl=BrokerFact("supplied", 735.0),
        ),
        BrokerPosition(
            broker_position_id="stub-opt-SPY-vertical",
            fidelity="exact",
            fidelity_notes=[],
            legs=[
                BrokerLeg(kind="option", symbol="SPY260918C00500000", underlying="SPY",
                          quantity=1.0, multiplier=100.0,
                          cost_basis=BrokerFact("supplied", 3.25),
                          broker_mark=BrokerFact("supplied", 4.10),
                          expiry="2026-09-18", strike=500.0, right="call"),
                BrokerLeg(kind="option", symbol="SPY260918C00510000", underlying="SPY",
                          quantity=-1.0, multiplier=100.0,
                          cost_basis=BrokerFact("supplied", 1.80),
                          broker_mark=BrokerFact("not_supplied"),
                          expiry="2026-09-18", strike=510.0, right="call"),
            ],
            unrealized_pl=BrokerFact("not_supplied"),
        ),
    ]


class StubProvider(PositionsProvider):
    def fetch_book(self, credential: BrokerCredential,
                   account_ref: Optional[str] = None) -> BrokerBook:
        arm = os.getenv("STUB_BROKER_BOOK", "ok").strip().lower()
        if arm == "empty":
            return BrokerBook(state="empty", account_ref=_STUB_ACCOUNT_REF)
        if arm in FAILURE_CAUSES:
            return BrokerBook(state="unknown", reason=arm)
        return BrokerBook(state="ok", positions=_ok_positions(),
                          account_ref=_STUB_ACCOUNT_REF)

    def describe(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            provider_id="stub", refresh_basis="on_demand_snapshot",
            supplies_cost_basis=True, supplies_broker_mark=True,
            supplies_unrealized_pl=False)
