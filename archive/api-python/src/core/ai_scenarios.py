"""
AI-rec scripted SCENARIOS — a deterministic, keyless `ScenarioLLMProvider` behind the existing
`LLMProvider` seam + the declarative 9-entry scenario registry (ai-rec-backtest-orders, BACKEND §1).

Purpose: let the FE exercise its order/backtest flows end-to-end (rec → order → export) against
KNOWN, scripted rec shapes — full plans, conditional triggers, an unparseable-prose trigger, an
already-met condition, a stand-aside, and the two real fault shapes — with NO key material and NO
paid LLM call, ever.

Boundary (structural — the score-byte-identity guarantee):
  - This module is a leaf-of-leaf: imported ONLY by `src/core/ai_recommendation.py` (lazily, at
    call time) — `signals` / `engine` / `live` / `darkpool` / `main` import neither it nor anything
    new because of it. Nothing here can feed `opportunity_score` / `opportunity_tier` /
    `state_fingerprint` / the entry gate.
  - Scenarios are DATA, not code: each registry entry is `{id, name, template}` (or a `fault`
    marker) interpreted by ONE renderer against the REAL serialized context (read-only — the same
    context export the real provider receives; templates anchor to the bundle's own levels).
  - Determinism (AC-41): output depends ONLY on `(scenario_id, context)` — no randomness, no clock
    reads, no persona variation (the persona is echoed in the envelope as shipped, never fed here).
  - Fault entries raise `LLMUnavailable("timeout" | "llm_error")` through the REAL fault-handling
    path, reproducing the exact degraded shape a real provider fault produces (AC-40).
  - Gated by `AI_REC_SCENARIOS_ENABLED` (server env, default OFF — absent/false ⇒ off; parsed like
    `AI_REC_STUB`). Flag off ⇒ zero scenario surface (the catalog is never enumerable; a
    scenario-selecting POST gets the contained `scenario_unavailable` refusal).
  - `[no-real-order-path]`: nothing here creates any broker/order/execution path — orders are
    frontend-local; this module only shapes an ADVISORY rec payload.

Isolation: any render fault here surfaces upstream as a contained HTTP-200 `scenario_error`
refusal, never a 5xx (`[best-effort-isolated-or-null]`); no log line or response ever carries key
material or template internals.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass

# One-way at load time: ai_recommendation imports THIS module lazily (call-time), so this
# top-level import of the seam types is acyclic.
from .ai_recommendation import LLMProvider, LLMUnavailable

_TRUTHY = ("1", "true", "yes", "on")


def scenarios_enabled() -> bool:
    """`AI_REC_SCENARIOS_ENABLED` — default OFF (absent/false ⇒ off); parsed like `AI_REC_STUB`.
    Read per-call (no import-order coupling); an operator/dev flag in the `AI_REC_STUB` /
    `SEED_TEST_ACCOUNT` family (D9)."""
    return os.getenv("AI_REC_SCENARIOS_ENABLED", "").strip().lower() in _TRUTHY


# ============================================================================= registry (DATA)
@dataclass(frozen=True)
class Scenario:
    """One registry entry. Producing scenarios carry a declarative `template`; fault scenarios
    carry a `fault` marker instead and raise through the real fault path."""
    id: str
    name: str
    fault: str | None = None       # "timeout" | "llm_error"
    template: dict | None = None   # declarative render spec (see _render)


# Template spec interpreted by `_render` (scenarios stay data, not code):
#   level:  {"anchor": <market_state field|absent>, "mult": <spot-fallback multiplier>,
#            "require": "above_spot"|"below_spot"|absent}
#           → the ONE numeric level: the anchored bundle level when present (and satisfying
#             `require`), else round(spot * mult, 2). Null-safe: a missing bundle level falls back
#             to the spot-derived value; a missing spot is a render fault (→ scenario_error).
#   derive: {"target_mult", "stop_mult"} → exit_plan target/stop = round(level * mult, 2).
#   strategy: the raw strategy fields. Strings may carry {level}/{target}/{stop} placeholders;
#             "strikes": "level" → [level]; "expiration": "max_pain_expiration" → that context
#             read; "invalidation_level": "stop" → the derived stop; "exit_plan": "derived" →
#             {target, stop}. Everything else passes through to `_coerce_strategy` upstream.

_SCENARIO_NOTE = "(Scripted scenario — deterministic against this snapshot, not a live model output.)"

REGISTRY: tuple[Scenario, ...] = (
    Scenario(
        id="long_call_breakout",
        name="Long call — full plan (entry/stop/target)",
        template={
            "level": {"anchor": "call_wall", "mult": 1.02},
            "derive": {"target_mult": 1.03, "stop_mult": 0.985},
            "strategy": {
                "decision": "trade", "bias": "long", "structure": "long call",
                "strikes": "level", "expiration": "max_pain_expiration",
                "entry_trigger": "break and hold above {level}",
                "invalidation_level": "stop",
                "max_risk": "1% of account, defined by the {stop} stop",
                "position_size": "1 contract",
                "exit_plan": "derived",
                "time_horizon": "3-10 trading days",
                "confidence": "medium",
                "summary": "Scripted long-call plan: buy a call on a break and hold above "
                           "{level}, stop {stop}, target {target}.",
                "key_points": [
                    "Entry {level} anchors to this bundle's call wall (spot-derived fallback when absent).",
                    "The plan is complete before entry: stop {stop}, target {target}, one contract.",
                    "Scripted scenario output — deterministic, not a live model read.",
                ],
                "reengage_when": [
                    "Price reclaims {level} after a failed first breakout attempt.",
                    "A fresh bundle moves the call wall materially away from {level}.",
                ],
                "rationale": "Scripted scenario 'long_call_breakout': a complete long-call "
                             "breakout plan (entry/stop/target) anchored to the bundle's own "
                             "levels. " + _SCENARIO_NOTE,
            },
        },
    ),
    Scenario(
        id="long_put_breakdown",
        name="Long put — full plan",
        template={
            "level": {"anchor": "put_wall", "mult": 0.98},
            "derive": {"target_mult": 0.97, "stop_mult": 1.015},
            "strategy": {
                "decision": "trade", "bias": "short", "structure": "long put",
                "strikes": "level", "expiration": "max_pain_expiration",
                "entry_trigger": "break and hold below {level}",
                "invalidation_level": "stop",
                "max_risk": "1% of account, defined by the {stop} stop",
                "position_size": "1 contract",
                "exit_plan": "derived",
                "time_horizon": "3-10 trading days",
                "confidence": "medium",
                "summary": "Scripted long-put plan: buy a put on a break and hold below "
                           "{level}, stop {stop}, target {target}.",
                "key_points": [
                    "Entry {level} anchors to this bundle's put wall (spot-derived fallback when absent).",
                    "The plan is complete before entry: stop {stop}, target {target}, one contract.",
                    "Scripted scenario output — deterministic, not a live model read.",
                ],
                "reengage_when": [
                    "Price loses {level} again after a reflexive bounce.",
                    "A fresh bundle moves the put wall materially away from {level}.",
                ],
                "rationale": "Scripted scenario 'long_put_breakdown': a complete long-put "
                             "breakdown plan (entry/stop/target) anchored to the bundle's own "
                             "levels. " + _SCENARIO_NOTE,
            },
        },
    ),
    Scenario(
        id="conditional_break_above",
        name="Conditional — break above a level",
        template={
            "level": {"anchor": "call_wall", "mult": 1.02, "require": "above_spot"},
            "derive": {"target_mult": 1.03, "stop_mult": 0.99},
            "strategy": {
                "decision": "trade", "bias": "long", "structure": "long call",
                "strikes": "level", "expiration": "max_pain_expiration",
                "entry_trigger": "a break above {level}",
                "invalidation_level": "stop",
                "max_risk": "1% of account",
                "position_size": "1 contract",
                "exit_plan": "derived",
                "time_horizon": "3-10 trading days",
                "confidence": "medium",
                "summary": "Scripted conditional: go long calls only on a break above {level} — "
                           "no position until the level trades.",
                "key_points": [
                    "The {level} trigger sits ABOVE the current spot — the order waits, it does not fill now.",
                    "Anchored to the call wall when it is above spot; spot-derived otherwise.",
                    "Scripted scenario output — deterministic, not a live model read.",
                ],
                "reengage_when": [
                    "Price trades through {level} — the conditional arms and the plan activates.",
                ],
                "rationale": "Scripted scenario 'conditional_break_above': a conditional entry "
                             "that must NOT trigger until price breaks above the stated level. "
                             + _SCENARIO_NOTE,
            },
        },
    ),
    Scenario(
        id="conditional_break_below",
        name="Conditional — break below a level",
        template={
            "level": {"anchor": "put_wall", "mult": 0.98, "require": "below_spot"},
            "derive": {"target_mult": 0.97, "stop_mult": 1.01},
            "strategy": {
                "decision": "trade", "bias": "short", "structure": "long put",
                "strikes": "level", "expiration": "max_pain_expiration",
                "entry_trigger": "a break below {level}",
                "invalidation_level": "stop",
                "max_risk": "1% of account",
                "position_size": "1 contract",
                "exit_plan": "derived",
                "time_horizon": "3-10 trading days",
                "confidence": "medium",
                "summary": "Scripted conditional: go long puts only on a break below {level} — "
                           "no position until the level trades.",
                "key_points": [
                    "The {level} trigger sits BELOW the current spot — the order waits, it does not fill now.",
                    "Anchored to the put wall when it is below spot; spot-derived otherwise.",
                    "Scripted scenario output — deterministic, not a live model read.",
                ],
                "reengage_when": [
                    "Price trades through {level} — the conditional arms and the plan activates.",
                ],
                "rationale": "Scripted scenario 'conditional_break_below': a conditional entry "
                             "that must NOT trigger until price breaks below the stated level. "
                             + _SCENARIO_NOTE,
            },
        },
    ),
    Scenario(
        id="unparseable_trigger",
        name="Trade — trigger prose, no numeric level",
        template={
            # NO level spec: the trigger is directional prose containing NO digits (AC-6 — the FE
            # empty-seed path). No placeholders are rendered for this entry.
            "strategy": {
                "decision": "trade", "bias": "long", "structure": "long call",
                "strikes": [], "expiration": None,
                "entry_trigger": "enter on confluence of flow flip and reclaimed VWAP",
                "invalidation_level": None,
                "max_risk": "small and pre-defined",
                "position_size": "a starter position",
                "exit_plan": None,
                "time_horizon": "a few sessions",
                "confidence": "low",
                "summary": "Scripted trade whose trigger is prose only — there is no numeric "
                           "level to seed an order from.",
                "key_points": [
                    "The entry trigger is directional prose with no digits — exercises the manual-seed path.",
                    "Scripted scenario output — deterministic, not a live model read.",
                ],
                "reengage_when": [
                    "A clean numeric level emerges at a wall or the gamma flip.",
                ],
                "rationale": "Scripted scenario 'unparseable_trigger': a trade whose entry "
                             "trigger deliberately carries no numeric level. " + _SCENARIO_NOTE,
            },
        },
    ),
    Scenario(
        id="condition_already_met",
        name="Trade — condition already met",
        template={
            # level = spot × 0.99 rounded (guaranteed already crossed: `require` pins it strictly
            # below spot even in degenerate rounding cases).
            "level": {"mult": 0.99, "require": "below_spot"},
            "derive": {"target_mult": 1.03, "stop_mult": 0.98},
            "strategy": {
                "decision": "trade", "bias": "long", "structure": "long call",
                "strikes": "level", "expiration": "max_pain_expiration",
                "entry_trigger": "a break above {level}",
                "invalidation_level": "stop",
                "max_risk": "1% of account",
                "position_size": "1 contract",
                "exit_plan": "derived",
                "time_horizon": "3-10 trading days",
                "confidence": "medium",
                "summary": "Scripted trade whose break-above trigger at {level} is already met "
                           "at the current spot.",
                "key_points": [
                    "The {level} trigger sits below the current spot — the condition has already been crossed.",
                    "Exercises the already-met notice on the order ticket (AC-9).",
                    "Scripted scenario output — deterministic, not a live model read.",
                ],
                "reengage_when": [
                    "Price falls back below {level}, re-arming the breakout condition.",
                ],
                "rationale": "Scripted scenario 'condition_already_met': a break-above entry "
                             "whose level is already crossed at the snapshot spot. " + _SCENARIO_NOTE,
            },
        },
    ),
    Scenario(
        id="no_trade",
        name="No trade — stand aside",
        template={
            "strategy": {
                "decision": "no_trade", "bias": "neutral", "structure": None,
                "strikes": [], "expiration": None, "entry_trigger": None,
                "invalidation_level": None, "max_risk": None, "position_size": None,
                "exit_plan": None, "time_horizon": None, "confidence": "low",
                "summary": "Scripted stand-aside: no trade — the scripted read finds no edge "
                           "worth paying for here.",
                "key_points": [
                    "Standing aside is the scripted verdict; trade fields are intentionally empty.",
                    "Scripted scenario output — deterministic, not a live model read.",
                ],
                "reengage_when": [
                    "A decisive break of a wall with confirming flow.",
                    "A regime change in a fresh bundle.",
                ],
                "rationale": "Scripted scenario 'no_trade': stand aside; trade fields are "
                             "null/empty per the real schema. " + _SCENARIO_NOTE,
            },
        },
    ),
    Scenario(id="fault_timeout", name="Fault — provider timeout", fault="timeout"),
    Scenario(id="fault_llm_error", name="Fault — provider error", fault="llm_error"),
)

_BY_ID: dict[str, Scenario] = {s.id: s for s in REGISTRY}


def get_scenario(scenario_id: str) -> Scenario | None:
    """Registry lookup. None ⇒ unknown id (the caller emits the contained `scenario_error`)."""
    return _BY_ID.get(scenario_id)


def advertisement() -> dict:
    """
    The ALWAYS-present `RecStatus.scenarios` advertisement (INTERFACE §2): flag OFF ⇒
    `{enabled: false, catalog: []}` (the catalog is NEVER enumerable while disabled — D1);
    flag ON ⇒ `enabled: true` + the full registry catalog (id + verbatim display name,
    registry order — single-sourced from here, AC-36). Side-effect-free.
    """
    if not scenarios_enabled():
        return {"enabled": False, "catalog": []}
    return {"enabled": True,
            "catalog": [{"id": s.id, "name": s.name} for s in REGISTRY]}


# ============================================================================= the provider
class ScenarioLLMProvider(LLMProvider):
    """
    The deterministic, keyless scenario provider behind the existing `LLMProvider` seam.

    `generate_strategy` IGNORES `system_prompt`/`glossary`/`dte_min`/`dte_max` by design —
    scenario output depends ONLY on `(scenario_id, context)` (determinism, AC-41; persona never
    varies the output). Fault entries raise `LLMUnavailable` through the REAL fault path; a
    template render fault propagates and surfaces upstream as the contained `scenario_error`
    (never a 5xx). No network, no key material, no cost.
    """

    name = "scenario"

    def __init__(self, scenario: Scenario):
        self._scenario = scenario

    def generate_strategy(self, *, system_prompt, context_json, glossary, dte_min, dte_max) -> dict:
        if self._scenario.fault:
            raise LLMUnavailable(self._scenario.fault)
        ctx = json.loads(context_json)
        return _render(self._scenario.template or {}, ctx)


# ============================================================================= the renderer
def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _fmt(x: float) -> str:
    """Stable price text: 2 decimals, trailing zeros trimmed (605.0 → '605', 616.38 → '616.38')."""
    return f"{x:.2f}".rstrip("0").rstrip(".")


def _spot(market_state: dict) -> float:
    """The context's current spot (`price`, falling back to `gex_spot`). Missing/degenerate spot
    is a render fault (→ contained `scenario_error` upstream, never a 5xx)."""
    spot = _num(market_state.get("price"))
    if spot is None:
        spot = _num(market_state.get("gex_spot"))
    if spot is None or spot <= 0:
        raise ValueError("scenario render: no usable spot in context")
    return float(spot)


def _resolve_level(spec: dict, market_state: dict, spot: float) -> float:
    """
    Resolve the scenario's ONE numeric level, null-safe (BACKEND §1.2 anchor rules): the anchored
    bundle level when present and satisfying `require` (above_spot/below_spot vs the context
    spot), else round(spot × mult, 2). A post-rounding guard makes the `require` constraint a hard
    guarantee even for degenerate spots. Deterministic — inputs come only from the context.
    """
    require = spec.get("require")
    anchor = spec.get("anchor")
    level = _num(market_state.get(anchor)) if anchor else None
    if level is not None:
        if require == "above_spot" and not (level > spot):
            level = None
        elif require == "below_spot" and not (level < spot):
            level = None
    if level is None:
        level = round(spot * spec["mult"], 2)
    if require == "above_spot" and level <= spot:
        level = round(spot + 0.01, 2)
    elif require == "below_spot" and level >= spot:
        level = round(spot - 0.01, 2)
    return float(level)


def _render(template: dict, ctx: dict) -> dict:
    """
    Interpret ONE declarative template against the REAL serialized context (read-only) into a raw
    strategy dict. The output is fed through the REAL `_coerce_strategy` upstream — a shape that
    fails to render raises here and surfaces as the contained `scenario_error`.
    """
    market_state = ctx.get("market_state") or {}
    level = target = stop = None
    fmt: dict[str, str] = {}
    level_spec = template.get("level")
    if level_spec is not None:
        spot = _spot(market_state)
        level = _resolve_level(level_spec, market_state, spot)
        derive = template.get("derive") or {}
        if "target_mult" in derive:
            target = round(level * derive["target_mult"], 2)
        if "stop_mult" in derive:
            stop = round(level * derive["stop_mult"], 2)
        fmt = {
            "level": _fmt(level),
            "target": _fmt(target) if target is not None else "",
            "stop": _fmt(stop) if stop is not None else "",
        }

    def _t(v):
        """Fill {level}/{target}/{stop} placeholders in template strings (recurses into lists)."""
        if isinstance(v, str) and fmt:
            return v.format(**fmt)
        if isinstance(v, list):
            return [_t(x) for x in v]
        return v

    s = template.get("strategy") or {}
    return {
        "decision": s.get("decision", "no_trade"),
        "bias": s.get("bias", "neutral"),
        "structure": s.get("structure"),
        "strikes": [level] if s.get("strikes") == "level" and level is not None else [],
        "expiration": (market_state.get("max_pain_expiration")
                       if s.get("expiration") == "max_pain_expiration" else None),
        "entry_trigger": _t(s.get("entry_trigger")),
        "invalidation_level": stop if s.get("invalidation_level") == "stop" else None,
        "max_risk": _t(s.get("max_risk")),
        "position_size": s.get("position_size"),
        "exit_plan": ({"target": target, "stop": stop} if s.get("exit_plan") == "derived"
                      else {"target": None, "stop": None}),
        "time_horizon": s.get("time_horizon"),
        "confidence": s.get("confidence"),
        "summary": _t(s.get("summary")),
        "key_points": _t(s.get("key_points") or []),
        "reengage_when": _t(s.get("reengage_when") or []),
        "rationale": _t(s.get("rationale") or ""),
    }
