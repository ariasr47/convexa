"""
AI Recommendations — the isolated, best-effort in-app LLM proxy + state-export serializer.

This is Convexa's FIRST in-app LLM call. The module is a **one-way leaf** (mirrors the
observability Level-1 boundary): `signals.py` / `engine.py` / `live.py` / `darkpool.py` MUST
NOT import it. That import boundary is the *structural* enforcement of
`additive-keeps-score-byte-identical` — nothing in the scoring path can depend on this module,
so a recommendation can never feed back into `opportunity_score` / `opportunity_tier` /
`ai_eval` / `state_fingerprint` / the entry gate. main.py imports it for the three
recommendation endpoints only; the bundle / SSE path never touches it.

Binding invariants this module preserves:
  - `best-effort-isolated-or-null` — an LLM/cap/key fault NEVER raises an HTTP 5xx; it returns a
    contained 200 `RecResponse` with `status: "unavailable"` and a safe `unavailable_reason`
    ("timeout" | "llm_error" | "over_cap" | "no_key"). No key/secret/internal text ever leaks.
  - No recompute / no new vendor fetch — the export + rec context are a read+serialize of the
    ALREADY-CACHED bundle (MarketState/signals/strike_profile/meta). Null stays null.
  - Server-side key only — `ANTHROPIC_API_KEY` is read ONLY here (mirroring `MASSIVE_API_KEY`),
    never serialized into any payload, never reaches the browser.
  - Persona is canonical-sourced (src/core/personas.py / GET /api/personas) and non-scoring.
  - No real order path — these endpoints never create or mutate a trade.

Seams (designed-for, NOT built now):
  - `LLMProvider` (provider-port-like): "which LLM vendor/model" is a contained swap, mirroring
    `MarketDataProvider`. Only Claude (claude-opus-4-8) today; a `StubLLMProvider` is used when
    no key is configured (and during verification, to exercise the paths without paid calls).
  - BYO-key / multi-tenant: the credential is read behind `_resolve_api_key()` — a single
    server-side key today, but the boundary could later accept a per-user key. NOT built.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
import zoneinfo
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone

from . import personas as personas_lib

logger = logging.getLogger("Convexa")

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
_GLOSSARY_PATH = os.path.join(_REPO_ROOT, "market_state_glossary.md")
_EXCHANGE_TZ = zoneinfo.ZoneInfo("America/New_York")

# ----------------------------------------------------------------------------- config (env)
# Operator-configurable. Mirrors the MASSIVE_API_KEY convention: the key lives in .env and is
# read ONLY in this module. Absent => in_app_enabled:false (the export floor still works).
COOLDOWN_SECONDS = int(os.getenv("AI_REC_COOLDOWN_SECONDS", "60"))
DAILY_CAP = int(os.getenv("AI_REC_DAILY_CAP", "50"))
# Feature flag: lets an operator disable the in-app LLM call while keeping the export floor.
IN_APP_ENABLED_FLAG = os.getenv("AI_REC_IN_APP_ENABLED", "true").lower() == "true"
# The model id (latest Claude). A model swap is contained to the provider seam below.
ANTHROPIC_MODEL = os.getenv("AI_REC_MODEL", "claude-opus-4-8")
# Bounded request timeout for the LLM call (seconds) — the proxy owns its own timeout so its
# multi-second latency can never stall the ~60s cached bundle or the SSE stream.
LLM_TIMEOUT_SECONDS = float(os.getenv("AI_REC_TIMEOUT_SECONDS", "60"))

# Allowed enum vocabularies (used to coerce/validate model output to the strategy schema).
_BIAS = {"long", "short", "neutral", "volatility"}
_DECISION = {"trade", "no_trade"}
_CONFIDENCE = {"low", "medium", "high"}


def _resolve_api_key() -> str | None:
    """Single server-side key today (BYO-key is a designed-for seam, not built). Read ONLY here."""
    key = os.getenv("ANTHROPIC_API_KEY")
    return key or None


def in_app_enabled() -> bool:
    """In-app LLM path is available iff a key is configured AND the feature flag is on."""
    return IN_APP_ENABLED_FLAG and _resolve_api_key() is not None


# ============================================================================= LLM provider seam
class LLMUnavailable(Exception):
    """Contained LLM fault. `reason` is one of the safe, non-leaking codes the FE understands."""

    def __init__(self, reason: str):
        # reason ∈ {"timeout", "llm_error", "no_key"}; NEVER carries key/secret/internal text.
        super().__init__(reason)
        self.reason = reason


class LLMProvider(ABC):
    """
    Provider-port-like seam (mirrors `MarketDataProvider`): "which LLM vendor/model" is a
    contained choice. `generate_strategy` takes the assembled prompt pieces and returns a dict
    already reconciled to the `prompts/strategy_prompt.md` ENTRY schema, or raises LLMUnavailable.
    """

    name = "base"

    @abstractmethod
    def generate_strategy(self, *, system_prompt: str, context_json: str, glossary: str,
                          dte_min, dte_max) -> dict:
        ...


class AnthropicLLMProvider(LLMProvider):
    """
    Claude (claude-opus-4-8) adapter, STRUCTURED output via the tool-use / JSON path.

    Reconciles the model output to the existing `prompts/strategy_prompt.md` risk-first ENTRY
    schema (unchanged). The key is read at construction ONLY here; it never leaves this object.
    The SDK import is lazy so the absence of `anthropic` (or the key) degrades cleanly to the
    stub rather than crashing module import.
    """

    name = "anthropic"

    def __init__(self, api_key: str, model: str = ANTHROPIC_MODEL,
                 timeout: float = LLM_TIMEOUT_SECONDS):
        self._api_key = api_key
        self._model = model
        self._timeout = timeout

    def generate_strategy(self, *, system_prompt, context_json, glossary, dte_min, dte_max) -> dict:
        try:
            import anthropic  # lazy import — only when a real call is actually made
        except Exception:
            logger.warning("ai_recommendation: anthropic SDK not installed; treating as no_key")
            raise LLMUnavailable("no_key")

        client = anthropic.Anthropic(api_key=self._api_key, timeout=self._timeout)
        user_block = (
            "Here is the Convexa market_state bundle to analyze (JSON):\n\n"
            f"```json\n{context_json}\n```\n\n"
            "Field reference (glossary):\n\n"
            f"{glossary}\n\n"
            f"Size any trade to the {dte_min}-{dte_max} DTE window the levels were computed for. "
            "Respond by calling the `strategy` tool exactly once with the risk-first schema."
        )
        # Structured output via a forced single tool call — the schema is the strategy_prompt
        # ENTRY schema, unchanged. The model MUST emit JSON matching it.
        tool = {
            "name": "strategy",
            "description": "Return the risk-first options strategy decision.",
            "input_schema": _STRATEGY_TOOL_SCHEMA,
        }
        try:
            resp = client.messages.create(
                model=self._model,
                max_tokens=2000,
                system=system_prompt,
                tools=[tool],
                tool_choice={"type": "tool", "name": "strategy"},
                messages=[{"role": "user", "content": user_block}],
            )
        except Exception as e:  # anthropic.APITimeoutError, APIError, connection errors, etc.
            cls = type(e).__name__.lower()
            if "timeout" in cls:
                raise LLMUnavailable("timeout")
            logger.warning("ai_recommendation: LLM call failed (%s)", cls)
            raise LLMUnavailable("llm_error")

        for block in getattr(resp, "content", []) or []:
            if getattr(block, "type", None) == "tool_use" and getattr(block, "name", None) == "strategy":
                return dict(block.input)
        logger.warning("ai_recommendation: LLM returned no structured tool call")
        raise LLMUnavailable("llm_error")


class StubLLMProvider(LLMProvider):
    """
    Deterministic, no-network stub used when no real key/SDK is available (and for verification:
    it exercises produced / no_trade / unavailable paths without a live key or cost). Returns a
    valid `strategy_prompt`-shaped response derived from the serialized context, so the proxy can
    be driven end-to-end. Document the toggle: set ANTHROPIC_API_KEY (and install `anthropic`) to
    use the real AnthropicLLMProvider instead.
    """

    name = "stub"

    def generate_strategy(self, *, system_prompt, context_json, glossary, dte_min, dte_max) -> dict:
        ctx = {}
        try:
            ctx = json.loads(context_json)
        except Exception:
            ctx = {}
        ms = ctx.get("market_state") or {}
        sig = ctx.get("signals") or {}
        setups = sig.get("setups") or []
        # Allow verification of the fault path without a live key: an operator/test can force a
        # contained failure through the stub via an env toggle (default off).
        forced = os.getenv("AI_REC_STUB_FORCE", "").strip().lower()
        if forced in ("timeout", "llm_error"):
            raise LLMUnavailable(forced)

        # No setups => no_trade (a correct, common answer per the prompt). Else a modest,
        # risk-first illustrative trade anchored to the bundle's own levels. STUB ONLY.
        if not setups:
            return {
                "decision": "no_trade", "bias": "neutral", "structure": None,
                "strikes": [], "expiration": None, "entry_trigger": None,
                "invalidation_level": None, "max_risk": None, "position_size": None,
                "exit_plan": {"target": None, "stop": None},
                "time_horizon": None, "confidence": "low",
                "rationale": "[STUB] No clean setup in signals.setups; standing aside is the "
                             "correct call. (Stub response — not a live model output.)",
            }
        call_wall = ms.get("call_wall")
        put_wall = ms.get("put_wall")
        flip = ms.get("gamma_flip")
        strikes = [s for s in (put_wall, call_wall) if s is not None]
        return {
            "decision": "trade", "bias": "long",
            "structure": "call debit spread",
            "strikes": strikes or [],
            "expiration": ms.get("max_pain_expiration"),
            "entry_trigger": f"break and hold above the {call_wall} call wall"
                             if call_wall is not None else "confirmation above resistance",
            "invalidation_level": flip,
            "max_risk": "1.5% of account",
            "position_size": "2 contracts",
            "exit_plan": {"target": 12.5, "stop": 6.0},
            "time_horizon": f"{dte_min or 5}-{dte_max or 10} trading days",
            "confidence": "medium",
            "rationale": "[STUB] Illustrative risk-first spread anchored to the gamma walls/flip "
                         "in this bundle. (Stub response — not a live model output.)",
        }


# JSON-Schema for the forced tool call. Mirrors the strategy_prompt ENTRY schema 1:1.
_STRATEGY_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "decision": {"type": "string", "enum": ["trade", "no_trade"]},
        "bias": {"type": "string", "enum": ["long", "short", "neutral", "volatility"]},
        "structure": {"type": ["string", "null"]},
        "strikes": {"type": "array", "items": {"type": "number"}},
        "expiration": {"type": ["string", "null"]},
        "entry_trigger": {"type": ["string", "null"]},
        "invalidation_level": {"type": ["number", "null"]},
        "max_risk": {"type": ["string", "null"]},
        "position_size": {"type": ["string", "null"]},
        "exit_plan": {
            "type": "object",
            "properties": {
                "target": {"type": ["number", "null"]},
                "stop": {"type": ["number", "null"]},
            },
            "required": ["target", "stop"],
        },
        "time_horizon": {"type": ["string", "null"]},
        "confidence": {"type": ["string", "null"], "enum": ["low", "medium", "high", None]},
        "rationale": {"type": "string"},
    },
    "required": ["decision", "bias", "strikes", "exit_plan", "rationale"],
}


# Verification toggle: force the no-network STUB behind the seam even when a key is configured, so
# the produced/no_trade/unavailable paths are exercisable with NO live key and NO cost. Document the
# real-call switch: unset AI_REC_STUB (default unset) AND `pip install anthropic` AND set
# ANTHROPIC_API_KEY to route to the real Claude (claude-opus-4-8) AnthropicLLMProvider.
_FORCE_STUB = os.getenv("AI_REC_STUB", "").strip().lower() in ("1", "true", "yes", "on")


def _get_provider() -> LLMProvider:
    """
    Resolve the active LLM provider behind the seam. Real Claude when a key is configured, the
    feature flag is on, the `anthropic` SDK is importable, and the stub is NOT forced; otherwise the
    deterministic stub (so the path is exercisable without a key/cost — and so a configured key with
    no SDK degrades cleanly to the stub instead of always failing `no_key`).
    """
    key = _resolve_api_key()
    if key and IN_APP_ENABLED_FLAG and not _FORCE_STUB:
        try:
            import anthropic  # noqa: F401 — availability probe only
            return AnthropicLLMProvider(key)
        except Exception:
            logger.warning("ai_recommendation: anthropic SDK unavailable; using STUB provider "
                           "(set AI_REC_STUB= and `pip install anthropic` for the real call)")
    return StubLLMProvider()


# ============================================================================= strategy coercion
def _coerce_strategy(raw: dict) -> dict:
    """
    Reconcile a model/stub output to the EXACT INTERFACE §1.1 `strategy` shape (the unchanged
    strategy_prompt ENTRY schema). Enums clamped to allowed values; for `no_trade` the trade
    fields are forced null/empty per the contract's `no_trade_nulls`. Always returns a fully
    shaped object so the conformance `strategy_shape` holds.
    """
    raw = raw or {}
    decision = raw.get("decision")
    decision = decision if decision in _DECISION else "no_trade"
    bias = raw.get("bias")
    bias = bias if bias in _BIAS else "neutral"
    confidence = raw.get("confidence")
    confidence = confidence if confidence in _CONFIDENCE else None

    exit_plan = raw.get("exit_plan") or {}
    target = exit_plan.get("target")
    stop = exit_plan.get("stop")

    strikes = raw.get("strikes")
    strikes = [s for s in strikes if isinstance(s, (int, float)) and not isinstance(s, bool)] \
        if isinstance(strikes, list) else []

    def _num_or_none(v):
        return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None

    def _str_or_none(v):
        return v if isinstance(v, str) and v != "" else None

    strategy = {
        "decision": decision,
        "bias": bias,
        "structure": _str_or_none(raw.get("structure")),
        "strikes": strikes,
        "expiration": _str_or_none(raw.get("expiration")),
        "entry_trigger": _str_or_none(raw.get("entry_trigger")),
        "invalidation_level": _num_or_none(raw.get("invalidation_level")),
        "max_risk": _str_or_none(raw.get("max_risk")),
        "position_size": _str_or_none(raw.get("position_size")),
        "exit_plan": {"target": _num_or_none(target), "stop": _num_or_none(stop)},
        "time_horizon": _str_or_none(raw.get("time_horizon")),
        "confidence": confidence,
        "rationale": raw.get("rationale") if isinstance(raw.get("rationale"), str) else "",
    }
    if decision == "no_trade":
        # Contract `no_trade_nulls`: trade fields null/empty for no_trade.
        strategy["strikes"] = []
        strategy["expiration"] = None
        strategy["invalidation_level"] = None
        strategy["max_risk"] = None
        strategy["position_size"] = None
        strategy["exit_plan"] = {"target": None, "stop": None}
    return strategy


# ============================================================================= context serializer
def assemble_persona_prompt(persona_id: str | None) -> str:
    """
    Assemble the ENTRY persona prompt from the CANONICAL decomposed template + presets in
    personas.py (resolves the dual-sourcing flag). null => Default (byte-identical to today's
    prompt). Best-effort: any failure falls back to the byte-identical Default body.
    """
    persona = personas_lib.get_persona(persona_id)
    return personas_lib.assemble("entry", persona)["text"]


def _read_glossary() -> str:
    try:
        with open(_GLOSSARY_PATH, encoding="utf-8") as f:
            return f.read()
    except Exception:
        logger.debug("ai_recommendation: glossary read failed", exc_info=True)
        return ""


def serialize_context(bundle: dict) -> dict:
    """
    THE single state-export serializer: a read + serialize of the ALREADY-CACHED bundle into the
    INTERFACE §1.2 `context`. Feeds BOTH the in-app call (§1.1) and the manual hand-off (§1.2) —
    one serializer, identical bytes.

    NO recompute, NO new vendor fetch, NO greek repricing, NO DTE-scope change. Null stays null:
    a value absent/None in the bundle is absent/None here. Live fields are the snapshot's captured
    values, NOT a live re-read. Dark-pool context is included ONLY when present in the bundle.

    `bundle` is the cached, snapshot-stripped bundle (the dict main.py holds in `_cache[...]["bundle"]`,
    augmented at serve time with `meta`/finalized `ai_eval`). We read it; we never write it.
    """
    context = {
        "market_state": bundle.get("market_state"),
        "signals": bundle.get("signals"),
        "strike_profile": bundle.get("strike_profile"),
        "expirations": bundle.get("expirations", []),
        "ai_eval": bundle.get("ai_eval"),
        "meta": bundle.get("meta"),
    }
    # Off-exchange / dark-pool context: ONLY when present in the bundle (mirrors the bundle's own
    # presence rule — omitted when dark_pool was off). Null stays null.
    if "off_exchange" in bundle and bundle["off_exchange"] is not None:
        context["off_exchange"] = bundle["off_exchange"]
    return context


def build_export(ticker: str, bundle: dict, persona_id: str | None) -> dict:
    """
    Emit the INTERFACE §1.2 `RecExport`: ONLY {ticker, as_of, context, persona_prompt, glossary,
    egress_note}. No key, no other ticker, no user identity, no order/broker data (egress
    invariant). Triggers NO LLM call. The caller provides the already-cached bundle (404 upstream
    if the ticker was never fetched).
    """
    meta = bundle.get("meta") or {}
    as_of = (meta.get("freshness") or {}).get("snapshot_iso")
    return {
        "ticker": ticker,
        "as_of": as_of,
        "context": serialize_context(bundle),
        "persona_prompt": assemble_persona_prompt(persona_id),
        "glossary": _read_glossary(),
        "egress_note": (
            f"Complete list of what leaves the machine for {ticker}: context + persona prompt + "
            "glossary. No key, no other ticker, no identity, no order data."
        ),
    }


# ============================================================================= cap + cooldown state
class _RateState:
    """
    Process-local cap/cooldown counter (single-user today; consistent with the metrics aggregate's
    ephemerality — RESETS ON RESTART). Thread-safe (the endpoints run the proxy off the event loop).

    Cooldown: AI_REC_COOLDOWN_SECONDS after the last successful query. Daily cap: AI_REC_DAILY_CAP
    per UTC day; `resets_at` = the next local-ET midnight reset boundary (documented choice).
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._last_query_ts: float | None = None
        self._count_day: str | None = None
        self._count: int = 0

    @staticmethod
    def _today_key() -> str:
        return datetime.now(_EXCHANGE_TZ).strftime("%Y-%m-%d")

    @staticmethod
    def resets_at_iso() -> str:
        """Next daily reset boundary: local-ET midnight, expressed in UTC ISO."""
        now_et = datetime.now(_EXCHANGE_TZ)
        next_midnight = (now_et + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0)
        return next_midnight.astimezone(timezone.utc).isoformat()

    def _roll_day(self):
        today = self._today_key()
        if self._count_day != today:
            self._count_day = today
            self._count = 0

    def snapshot(self) -> dict:
        """Read-only cap/cooldown view for §1.3 RecStatus (no mutation)."""
        with self._lock:
            self._roll_day()
            over = self._count >= DAILY_CAP
            remaining = max(0, DAILY_CAP - self._count)
            cooldown_remaining = self._cooldown_remaining()
        return {
            "cap": {"over_limit": over, "remaining_today": remaining,
                    "resets_at": self.resets_at_iso()},
            "cooldown_remaining_seconds": cooldown_remaining,
        }

    def _cooldown_remaining(self) -> int:
        if self._last_query_ts is None:
            return 0
        elapsed = time.time() - self._last_query_ts
        return max(0, int(round(COOLDOWN_SECONDS - elapsed)))

    def check_blocked(self) -> str | None:
        """
        Return a block reason WITHOUT consuming a slot: "over_cap" | "cooling_down" | None.
        Cooldown is reported but does NOT short-circuit the rec (the rec gate maps cooldown into
        gate.state; over_cap maps into unavailable). Used by the rec path before a call.
        """
        with self._lock:
            self._roll_day()
            if self._count >= DAILY_CAP:
                return "over_cap"
            if self._cooldown_remaining() > 0:
                return "cooling_down"
            return None

    def commit_query(self):
        """Record a successful query: stamps the cooldown + increments the daily counter."""
        with self._lock:
            self._roll_day()
            self._last_query_ts = time.time()
            self._count += 1


_rate = _RateState()


def reset_rate_state_for_tests():
    """Test/verification hook: clear the process-local cap/cooldown counter."""
    global _rate
    _rate = _RateState()


# ============================================================================= gate derivation
def derive_gate(ai_eval: dict | None) -> dict:
    """
    Derive INTERFACE §1.3 `gate` from the EXISTING `ai_eval` machinery (READ only — never recompute
    or alter it) + the cooldown window:
      - `cooling_down` ⇔ within the cooldown window after the last query (takes presentation
        precedence, but reported truthfully).
      - `no_fresh_edge` ⇔ guardrails say not actionable/changed (`!ai_eval.ready` or
        `!ai_eval.changed`); human strings surfaced in `gate.reasons` (mirrors `ai_eval.reasons`).
      - `available` otherwise.
    """
    ai_eval = ai_eval or {}
    ready = bool(ai_eval.get("ready"))
    changed = bool(ai_eval.get("changed"))
    snap = _rate.snapshot()
    cooldown_remaining = snap["cooldown_remaining_seconds"]

    reasons: list[str] = []
    fresh_edge = ready and changed
    if not fresh_edge:
        # Mirror ai_eval.reasons; add explicit not-ready/not-changed cause when ai_eval is silent.
        reasons = list(ai_eval.get("reasons") or [])
        if not ready and "stale data" not in reasons:
            reasons = reasons or ["no actionable edge"]
        if not changed and ready:
            reasons = reasons + ["unchanged since last evaluation"]
        if not reasons:
            reasons = ["no fresh edge"]

    if cooldown_remaining > 0:
        state = "cooling_down"
    elif not fresh_edge:
        state = "no_fresh_edge"
    else:
        state = "available"

    return {
        "state": state,
        "cooldown_remaining_seconds": cooldown_remaining,
        "reasons": reasons if state == "no_fresh_edge" else [],
    }


def status_payload(ai_eval: dict | None) -> dict:
    """Emit INTERFACE §1.3 `RecStatus` (no LLM call, side-effect-free)."""
    snap = _rate.snapshot()
    return {
        "availability": {"in_app_enabled": in_app_enabled()},
        "gate": derive_gate(ai_eval),
        "cap": snap["cap"],
    }


# ============================================================================= the rec proxy
def _persona_for_provenance(persona_id: str | None) -> dict:
    p = personas_lib.get_persona(persona_id)
    if p is None:
        default = personas_lib.get_persona("default")
        return {"id": "default", "name": default["name"] if default else "Default (no persona)"}
    return {"id": p["id"], "name": p["name"]}


def generate_recommendation(ticker: str, bundle: dict, *, persona_id: str | None,
                            dte_min, dte_max, override: bool,
                            snapshot_fingerprint: str) -> dict:
    """
    The best-effort, isolated, gated LLM proxy → emits INTERFACE §1.1 `RecResponse` (ALWAYS a
    well-formed dict the endpoint returns as HTTP 200). NEVER raises for an LLM/cap/key/gate fault.

    Order of operations:
      1. Pin provenance from the cached bundle (as_of / pinned_fingerprint / stale_born).
      2. Gate short-circuit: gate==no_fresh_edge && !override => `gated_off` (strategy null).
      3. Cap short-circuit: over_cap => `unavailable` / "over_cap".
      4. Availability: no key/feature off => `unavailable` / "no_key".
      5. Call the LLM behind the seam (own timeout). Fault => `unavailable` with a safe reason.
      6. Success => `produced` + coerced strategy; commit the cap/cooldown counter.
    """
    meta = bundle.get("meta") or {}
    freshness = meta.get("freshness") or {}
    ai_eval = bundle.get("ai_eval") or {}
    as_of = freshness.get("snapshot_iso")
    pinned_fingerprint = ai_eval.get("state_fingerprint") or snapshot_fingerprint or ""
    stale_born = bool(freshness.get("stale"))
    persona = _persona_for_provenance(persona_id)
    gate = derive_gate(ai_eval)
    cap_snap = _rate.snapshot()["cap"]

    def envelope(status, *, strategy=None, unavailable_reason=None):
        return {
            "status": status,
            "persona": persona,
            "as_of": as_of,
            "pinned_fingerprint": pinned_fingerprint,
            "stale_born": stale_born,
            "strategy": strategy,
            "unavailable_reason": unavailable_reason,
            "gate": gate,
            "cap": cap_snap,
        }

    # (2) Gate short-circuit — belt-and-suspenders (the FE normally gates ahead via §1.3).
    if gate["state"] == "no_fresh_edge" and not override:
        return envelope("gated_off")

    # (3) Cap short-circuit — a calm blocked state, never an HTTP error.
    block = _rate.check_blocked()
    if block == "over_cap":
        return envelope("unavailable", unavailable_reason="over_cap")

    # (4) Availability (no key configured / feature off).
    if not in_app_enabled():
        return envelope("unavailable", unavailable_reason="no_key")

    # (5) Call the LLM behind the seam. Any fault => contained `unavailable`.
    try:
        system_prompt = assemble_persona_prompt(persona_id)
        context = serialize_context(bundle)
        context_json = json.dumps(context, default=str)
        glossary = _read_glossary()
        provider = _get_provider()
        raw = provider.generate_strategy(
            system_prompt=system_prompt, context_json=context_json, glossary=glossary,
            dte_min=dte_min, dte_max=dte_max)
    except LLMUnavailable as e:
        return envelope("unavailable", unavailable_reason=e.reason)
    except Exception:
        logger.exception("ai_recommendation: unexpected proxy failure; returning unavailable")
        return envelope("unavailable", unavailable_reason="llm_error")

    # (6) Success — coerce to schema, commit the cap/cooldown counter, refresh cap snapshot.
    strategy = _coerce_strategy(raw)
    _rate.commit_query()
    cap_snap = _rate.snapshot()["cap"]
    return {
        "status": "produced",
        "persona": persona,
        "as_of": as_of,
        "pinned_fingerprint": pinned_fingerprint,
        "stale_born": stale_born,
        "strategy": strategy,
        "unavailable_reason": None,
        "gate": gate,
        "cap": cap_snap,
    }
