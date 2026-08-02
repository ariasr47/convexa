"""
Broker PORT + record shapes (broker-connect INTERFACE_CONTRACT §1/§2/§4).

A structural sibling of `src/auth/ports.py`: the records ARE the contract, defined against
OUR leg-first model — never Webull's payload — so a payload surprise is an adapter mapping
problem, never a port reopening. `to_wire()` emits EXACTLY the interface's presence rules:
absent means ABSENT, never null-padded.

READ-ONLY IS A TYPE-SURFACE FACT (`[no-real-order-path]`): `PositionsProvider` has exactly
two methods — `fetch_book` and `describe`. There is NO write method, nonexistent rather than
unused; no caller can even express an order. Adding one is a GATE-Z event.

This module is part of the broker ONE-WAY LEAF: it imports STDLIB ONLY (pinned by the B6
source-scan test). It never imports auth (the credential arrives as an in-memory value
object resolved at the main.py boundary) and never imports engine/signals/live/darkpool/
chain_store/the bundle path — real positions are structurally incapable of reaching
score/tier/state_fingerprint.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal, Optional

# ----------------------------------------------------------------------------- vocabularies

BrokerFactState = Literal["supplied", "not_supplied", "unparseable"]
BookState = Literal["ok", "empty", "unknown"]
Fidelity = Literal["exact", "partial", "unrecognized"]

# ONE shared failure-cause set feeds both `last_attempt_outcome` and `unknown.reason`
# (INTERFACE §3) so they can never drift.
FAILURE_CAUSES = ("broker_unreachable", "rate_limited", "credential_rejected",
                  "credential_unreadable", "adapter_fault")
REASON_NO_CREDENTIAL = "no_credential_stored"


# ----------------------------------------------------------------------------- records

@dataclass(frozen=True)
class BrokerFact:
    """
    The tri-state broker-supplied-fact (`[absent-is-not-none]` at field level): never a bare
    null that collapses "Webull doesn't send this" into "zero". `value` present iff supplied.
    """
    state: BrokerFactState
    value: Optional[float] = None

    def to_wire(self) -> dict:
        wire: dict = {"state": self.state}
        if self.state == "supplied":
            wire["value"] = self.value
        return wire


@dataclass(frozen=True)
class BrokerLeg:
    """One leg in OUR model. Quantity is SIGNED (short = negative — one convention, stated
    once); multiplier is EXPLICIT per-leg (never a hardcoded x100)."""
    kind: Literal["equity", "option"]
    symbol: str
    underlying: str
    quantity: float
    multiplier: float
    cost_basis: BrokerFact
    broker_mark: BrokerFact
    expiry: Optional[str] = None    # YYYY-MM-DD, iff option
    strike: Optional[float] = None  # iff option
    right: Optional[Literal["call", "put"]] = None  # iff option

    def to_wire(self) -> dict:
        wire = {
            "kind": self.kind,
            "symbol": self.symbol,
            "underlying": self.underlying,
            "quantity": self.quantity,
            "multiplier": self.multiplier,
            "cost_basis": self.cost_basis.to_wire(),
            "broker_mark": self.broker_mark.to_wire(),
        }
        if self.kind == "option":
            wire["expiry"] = self.expiry
            wire["strike"] = self.strike
            wire["right"] = self.right
        return wire


@dataclass(frozen=True)
class BrokerPosition:
    """
    A broker-reported position. `fidelity` is the mapping-fidelity marker — a book that
    silently drops an unparseable position is a fabricated claim about risk carried, so an
    unrepresentable entry surfaces as `unrecognized` with `legs: []`, never disappears.
    `unrealized_pl` is the additive P/L carry: the broker's OWN figure verbatim iff supplied,
    never computed, never blended with the FE mark ladder.
    """
    broker_position_id: str
    fidelity: Fidelity
    fidelity_notes: list[str]
    legs: list[BrokerLeg]
    unrealized_pl: BrokerFact

    def to_wire(self) -> dict:
        wire: dict = {
            "broker_position_id": self.broker_position_id,
            "fidelity": self.fidelity,
            "legs": [leg.to_wire() for leg in self.legs],
            "unrealized_pl": self.unrealized_pl.to_wire(),
        }
        if self.fidelity != "exact":
            wire["fidelity_notes"] = list(self.fidelity_notes)
        return wire


@dataclass
class BrokerBook:
    """
    The envelope both book endpoints return (INTERFACE §2). The closed `state` enum is the
    SOLE unknown-vs-empty disambiguator: `empty` and `unknown` both carry `positions: []`.
    """
    state: BookState
    reason: Optional[str] = None                 # iff unknown
    as_of: Optional[str] = None                  # iff ok/empty (never fabricated)
    basis: Optional[Literal["fresh", "cache"]] = None
    stale_after_seconds: Optional[int] = None
    account_ref: Optional[str] = None            # opaque server-derived handle, never raw
    positions: list[BrokerPosition] = field(default_factory=list)
    last_attempt_at: Optional[str] = None
    last_attempt_outcome: Optional[str] = None

    def to_wire(self) -> dict:
        """EXACTLY the INTERFACE §2 presence table. Absent means absent — no null-padding."""
        wire: dict = {"state": self.state,
                      "positions": [p.to_wire() for p in self.positions]}
        if self.state == "unknown":
            if self.reason is not None:
                wire["reason"] = self.reason
        else:
            if self.as_of is not None:
                wire["as_of"] = self.as_of
            if self.basis is not None:
                wire["basis"] = self.basis
            if self.stale_after_seconds is not None:
                wire["stale_after_seconds"] = self.stale_after_seconds
        if self.account_ref is not None:
            wire["account_ref"] = self.account_ref
        if self.last_attempt_at is not None:
            wire["last_attempt_at"] = self.last_attempt_at
            if self.last_attempt_outcome is not None:
                wire["last_attempt_outcome"] = self.last_attempt_outcome
        return wire


@dataclass(frozen=True)
class BrokerCredential:
    """
    The in-memory credential VALUE OBJECT resolved per-request at the main.py boundary.
    NEVER serializable into a trace: repr/str are masked, and the dataclass is frozen so the
    halves cannot be reassigned into some longer-lived object by accident.
    """
    app_key: str
    app_secret: str

    def __repr__(self) -> str:  # pragma: no cover - trivial
        return "BrokerCredential(masked)"

    __str__ = __repr__


@dataclass(frozen=True)
class ProviderCapabilities:
    """Static provider facts (how SnapTrade's different set arrives later, port unchanged)."""
    provider_id: str
    refresh_basis: str
    supplies_cost_basis: bool
    supplies_broker_mark: bool
    supplies_unrealized_pl: bool


# ----------------------------------------------------------------------------- the port

class PositionsProvider(ABC):
    """
    The read-only positions port. TWO methods. No write method exists — no `place_order`,
    no `cancel`, no generic `execute(...)` — and none may ever be added outside a GATE-Z
    reopening (`[no-real-order-path]`).
    """

    @abstractmethod
    def fetch_book(self, credential: BrokerCredential,
                   account_ref: Optional[str] = None) -> BrokerBook:
        """One call returns the entire current-holdings snapshot. The adapter absorbs vendor
        paging; pagination never crosses this port. On broker-side trouble the adapter maps
        to `state: unknown` + a closed failure-cause `reason` — it never raises payload
        content into the caller."""

    @abstractmethod
    def describe(self) -> ProviderCapabilities:
        ...
