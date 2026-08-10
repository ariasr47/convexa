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
from dataclasses import dataclass
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
# byo-ai-key §6: the per-admin daily SHARED-key allowance (distinct from the global AI_REC_DAILY_CAP).
# Default 3/day per admin user-id; consumed only on a PRODUCED shared-key rec.
ADMIN_FREE_DAILY = int(os.getenv("AI_REC_ADMIN_FREE_DAILY", "3"))

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


def shared_key_configured() -> bool:
    """byo-ai-key: is a SHARED server-side Anthropic key configured (the admin-allowance pool)?"""
    return IN_APP_ENABLED_FLAG and _resolve_api_key() is not None


# ============================================================================= resolved-key VO
@dataclass
class ResolvedKey:
    """
    byo-ai-key §1: the per-request resolved-key VALUE OBJECT computed at the main.py boundary and
    handed to the leaf. It carries WHICH key material to use + provenance + the metering identity —
    NEVER serialized, NEVER logged. The transient `key_material` is the raw key for THIS one call
    only; it is never put on a logged/serialized field (AC-11/12).

    key_source:
      - "own_key"      — the user's own decryptable key (their cost; NOT metered against shared;
                         per-identity cooldown only).
      - "shared_admin" — the shared server key, gated by the per-admin daily allowance (metered).
      - "none"         — no usable key; `unavailable_reason` distinguishes a/c/e.

    metering_identity is the key into the per-identity rate collection (the admin user-id for a
    shared_admin path; the user id for own-key cooldown).
    """
    key_source: str                       # own_key | shared_admin | none
    key_material: str | None = None        # transient raw key for ONE call; never logged/serialized
    model: str = ANTHROPIC_MODEL
    metering_identity: str | None = None    # user id used to key the per-identity rate state
    unavailable_reason: str | None = None   # for key_source=none: no_key | over_limit | shared_key_unconfigured
    remaining_free_uses: int | None = None  # admin shared-configured path only (pre-call snapshot)
    free_uses_total: int | None = None      # the per-admin allowance, present whenever remaining is


def resolve_key(*, user_id: str, own_key: str | None, is_admin: bool) -> ResolvedKey:
    """
    byo-ai-key §1: build the per-request resolved-key VALUE OBJECT from the inputs main.py resolves
    at the orchestration boundary — the user's DECRYPTED own key (or None; decryption is done in the
    auth leaf), and whether the user's email is in the admin allowlist. Decryption + the admin
    allowlist read stay at the boundary; THIS function applies the owner-fixed resolution ORDER:

      1. own decryptable key?  → own_key   (their cost; per-identity cooldown; NOT shared-metered)
      2. else admin AND shared key configured AND per-admin allowance left? → shared_admin (metered)
      3. else none, with the distinguished reason:
           - admin AND shared configured AND allowance == 0 → over_limit             (state c)
           - admin AND shared NOT configured                → shared_key_unconfigured (state e)
           - else (regular, no own key)                     → no_key                  (state a)

    Own-key-first applies EVEN for admins, EVEN when no shared key exists. The precondition ORDER on
    the admin branch (shared-configured? gates allowance-left?) makes an admin with no shared key
    resolve to (e), not (c). NEVER raises. The raw key is carried transiently in `key_material`.
    """
    # (1) Own key first — for everyone (regular + admin).
    if own_key:
        return ResolvedKey(
            key_source="own_key", key_material=own_key, model=ANTHROPIC_MODEL,
            metering_identity=user_id)

    shared_ok = shared_key_configured()

    # (2)/(3) Admin shared-allowance branch — only when admin AND a shared key is configured.
    if is_admin:
        if shared_ok:
            remaining = _rate.admin_remaining(user_id)
            if remaining > 0:
                return ResolvedKey(
                    key_source="shared_admin", key_material=_resolve_api_key(),
                    model=ANTHROPIC_MODEL, metering_identity=user_id,
                    remaining_free_uses=remaining, free_uses_total=ADMIN_FREE_DAILY)
            # Shared configured but allowance exhausted → (c) over_limit. Surface remaining 0.
            return ResolvedKey(
                key_source="none", metering_identity=user_id, unavailable_reason="over_limit",
                remaining_free_uses=0, free_uses_total=ADMIN_FREE_DAILY)
        # Admin, no shared key configured → (e) shared_key_unconfigured. No counter.
        return ResolvedKey(
            key_source="none", metering_identity=user_id,
            unavailable_reason="shared_key_unconfigured")

    # Regular user, no own key → (a) no_key. No counter.
    return ResolvedKey(
        key_source="none", metering_identity=user_id, unavailable_reason="no_key")


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
        "summary": {
            "type": ["string", "null"],
            "description": "ONE plain-English sentence a trader reads at a glance: the verdict plus "
                           "the single most important reason. No jargon dump, no numbers-only shorthand.",
        },
        "key_points": {
            "type": "array",
            "items": {"type": "string"},
            "description": "2-5 short, scannable bullets that justify the decision, each citing a "
                           "specific Convexa level (call/put wall, gamma flip, magnet/max pain, IV/HV, "
                           "VWAP). One idea per bullet — not full paragraphs.",
        },
        "reengage_when": {
            "type": "array",
            "items": {"type": "string"},
            "description": "1-3 concrete conditions that would change the call. For no_trade: what "
                           "you'd need to see to take the trade. For a trade: what would invalidate "
                           "or let you scale it.",
        },
        "rationale": {"type": "string"},
    },
    "required": ["decision", "bias", "strikes", "exit_plan", "rationale"],
}


# Verification toggle: force the no-network STUB behind the seam even when a key is configured, so
# the produced/no_trade/unavailable paths are exercisable with NO live key and NO cost. Document the
# real-call switch: unset AI_REC_STUB (default unset) AND `pip install anthropic` AND set
# ANTHROPIC_API_KEY to route to the real Claude (claude-opus-4-8) AnthropicLLMProvider.
_FORCE_STUB = os.getenv("AI_REC_STUB", "").strip().lower() in ("1", "true", "yes", "on")


def _get_provider(resolved: ResolvedKey) -> LLMProvider:
    """
    Build the active LLM provider for THIS request from the resolved-key VO (byo-ai-key §1): given
    resolved key material + model, build the real Claude adapter when the `anthropic` SDK is
    importable and the stub is NOT forced; otherwise the deterministic stub (so the path is
    exercisable without a key/cost — and so a configured key with no SDK degrades cleanly to the
    stub instead of always failing). Provider-agnostic-friendly: the key material is request-scoped,
    not process-global.
    """
    key = resolved.key_material
    if key and not _FORCE_STUB:
        try:
            import anthropic  # noqa: F401 — availability probe only
            return AnthropicLLMProvider(key, model=resolved.model)
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

    def _str_list(v, cap):
        """A bounded list of non-empty trimmed strings (drops non-strings/blanks; caps length)."""
        if not isinstance(v, list):
            return []
        out = []
        for x in v:
            if isinstance(x, str) and x.strip():
                out.append(x.strip())
            if len(out) >= cap:
                break
        return out

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
        # Structured reasoning (additive) — kept for BOTH trade and no_trade (they're the reasoning,
        # not trade fields), so the no_trade nulling below never clears them.
        "summary": _str_or_none(raw.get("summary")),
        "key_points": _str_list(raw.get("key_points"), 5),
        "reengage_when": _str_list(raw.get("reengage_when"), 3),
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
def _today_key() -> str:
    return datetime.now(_EXCHANGE_TZ).strftime("%Y-%m-%d")


def _resets_at_iso() -> str:
    """Next daily reset boundary: local-ET midnight, expressed in UTC ISO."""
    now_et = datetime.now(_EXCHANGE_TZ)
    next_midnight = (now_et + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0)
    return next_midnight.astimezone(timezone.utc).isoformat()


class _IdentityRate:
    """
    Per-identity metering record (byo-ai-key §6): the per-identity cooldown (anti-over-trading,
    applied per identity so one user's calls never cool down another's) + the per-admin SHARED
    daily allowance counter. RESETS ON RESTART (process-local, ephemeral). Not individually locked
    — the owning `_RateCollection` holds one lock for the whole collection.
    """

    def __init__(self):
        self.last_query_ts: float | None = None     # per-identity cooldown anchor
        self.global_count_day: str | None = None     # global-cap day for THIS identity's calls
        self.global_count: int = 0                    # contributes to the shipped global cap
        self.admin_count_day: str | None = None       # shared-allowance day
        self.admin_count: int = 0                     # shared-allowance units consumed today


class _RateCollection:
    """
    Process-local, KEYED collection of per-identity rate state (byo-ai-key §6) — `_RateState`
    evolved from one global instance into one entry per identity key, same lock pattern. Thread-safe
    (the endpoints run the proxy off the event loop). A metering fault never raises 5xx.

    - Per-identity COOLDOWN: `COOLDOWN_SECONDS` after that identity's last successful query.
    - Global DAILY CAP (`AI_REC_DAILY_CAP`): the shipped orthogonal cap, kept per-identity so it
      stays a per-caller daily ceiling (a calm `over_cap` unavailable; never blocks another user).
    - Per-ADMIN SHARED allowance (`AI_REC_ADMIN_FREE_DAILY`): consumed only on a PRODUCED
      shared_admin rec; reset at local-ET midnight per counter.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._by_identity: dict[str, _IdentityRate] = {}

    def _entry(self, identity: str) -> _IdentityRate:
        e = self._by_identity.get(identity)
        if e is None:
            e = _IdentityRate()
            self._by_identity[identity] = e
        return e

    @staticmethod
    def _roll_global(e: _IdentityRate):
        today = _today_key()
        if e.global_count_day != today:
            e.global_count_day = today
            e.global_count = 0

    @staticmethod
    def _roll_admin(e: _IdentityRate):
        today = _today_key()
        if e.admin_count_day != today:
            e.admin_count_day = today
            e.admin_count = 0

    @staticmethod
    def _cooldown_remaining(e: _IdentityRate) -> int:
        if e.last_query_ts is None:
            return 0
        elapsed = time.time() - e.last_query_ts
        return max(0, int(round(COOLDOWN_SECONDS - elapsed)))

    def snapshot(self, identity: str) -> dict:
        """Read-only cap/cooldown view for §1.3 RecStatus (no mutation) for one identity."""
        with self._lock:
            e = self._entry(identity)
            self._roll_global(e)
            over = e.global_count >= DAILY_CAP
            remaining = max(0, DAILY_CAP - e.global_count)
            cooldown_remaining = self._cooldown_remaining(e)
        return {
            "cap": {"over_limit": over, "remaining_today": remaining,
                    "resets_at": _resets_at_iso()},
            "cooldown_remaining_seconds": cooldown_remaining,
        }

    def check_blocked(self, identity: str) -> str | None:
        """Block reason WITHOUT consuming a slot: "over_cap" | "cooling_down" | None."""
        with self._lock:
            e = self._entry(identity)
            self._roll_global(e)
            if e.global_count >= DAILY_CAP:
                return "over_cap"
            if self._cooldown_remaining(e) > 0:
                return "cooling_down"
            return None

    def commit_query(self, identity: str):
        """Record a successful query for this identity: stamp cooldown + bump the global counter."""
        with self._lock:
            e = self._entry(identity)
            self._roll_global(e)
            e.last_query_ts = time.time()
            e.global_count += 1

    # --- per-admin SHARED allowance (byo-ai-key §6) -------------------------------------------
    def admin_remaining(self, admin_user_id: str) -> int:
        """Remaining shared-key allowance for this admin today (read-only, no commit)."""
        with self._lock:
            e = self._entry(admin_user_id)
            self._roll_admin(e)
            return max(0, ADMIN_FREE_DAILY - e.admin_count)

    def admin_commit(self, admin_user_id: str) -> int:
        """Consume ONE shared-allowance unit (on a PRODUCED shared rec only). Returns the remaining."""
        with self._lock:
            e = self._entry(admin_user_id)
            self._roll_admin(e)
            e.admin_count += 1
            return max(0, ADMIN_FREE_DAILY - e.admin_count)


_rate = _RateCollection()


def reset_rate_state_for_tests():
    """Test/verification hook: clear the WHOLE per-identity rate collection (byo-ai-key §6)."""
    global _rate
    _rate = _RateCollection()


# ============================================================================= gate derivation
def derive_gate(ai_eval: dict | None, identity: str = "_global") -> dict:
    """
    Derive INTERFACE §1.3 `gate` from the EXISTING `ai_eval` machinery (READ only — never recompute
    or alter it) + the PER-IDENTITY cooldown window (byo-ai-key §6: one user's calls never cool down
    another's):
      - `cooling_down` ⇔ within the cooldown window after THIS identity's last query (takes
        presentation precedence, but reported truthfully).
      - `no_fresh_edge` ⇔ guardrails say not actionable/changed (`!ai_eval.ready` or
        `!ai_eval.changed`); human strings surfaced in `gate.reasons` (mirrors `ai_eval.reasons`).
      - `available` otherwise.
    """
    ai_eval = ai_eval or {}
    ready = bool(ai_eval.get("ready"))
    changed = bool(ai_eval.get("changed"))
    snap = _rate.snapshot(identity)
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


def status_payload(ai_eval: dict | None, resolved: ResolvedKey | None = None) -> dict:
    """
    Emit INTERFACE §1.3/§2.2 `RecStatus` (no LLM call, side-effect-free — does NOT pre-commit a
    free use). With a `resolved` VO (authenticated request) the per-identity cooldown + the additive
    `remaining_free_uses`/`free_uses_total` are populated (byo-ai-key §2):
      - present (number) ONLY for an admin on a shared-key-CONFIGURED path,
      - null/omitted for regular users, own-key, and shared-unconfigured paths.
    """
    identity = (resolved.metering_identity if resolved and resolved.metering_identity
                else "_global")
    snap = _rate.snapshot(identity)
    # In-app availability is TRUE when the deployment has a shared key OR the requesting user has a
    # usable resolved key (own_key / shared_admin). Without the second clause a BYO user on a
    # deployment with NO shared key sees "in-app AI not configured" and can never trigger their own
    # key — the FE disables the Get button straight off this flag (useAiRecommendation → in_app_enabled).
    # The operator kill-switch (IN_APP_ENABLED_FLAG) still gates it; anonymous reads (resolved=None)
    # are unchanged (fall back to the shared-key check).
    user_has_usable_key = bool(resolved and resolved.key_source in ("own_key", "shared_admin"))
    in_app = in_app_enabled() or (IN_APP_ENABLED_FLAG and user_has_usable_key)
    payload = {
        "availability": {"in_app_enabled": in_app},
        "gate": derive_gate(ai_eval, identity),
        "cap": snap["cap"],
        "remaining_free_uses": None,
        "free_uses_total": None,
    }
    if resolved is not None and resolved.remaining_free_uses is not None:
        payload["remaining_free_uses"] = resolved.remaining_free_uses
        payload["free_uses_total"] = resolved.free_uses_total
    # ai-rec-backtest-orders (INTERFACE §2): the ALWAYS-present scenarios advertisement. Flag OFF ⇒
    # {enabled:false, catalog:[]} (never enumerable while disabled); flag ON ⇒ the full registry
    # catalog in registry order. Best-effort: a fault degrades to the disabled shape, never a 5xx.
    try:
        from . import ai_scenarios  # lazy: keeps the load-time import graph one-way (leaf-of-leaf)
        payload["scenarios"] = ai_scenarios.advertisement()
    except Exception:
        logger.warning("ai_recommendation: scenarios advertisement faulted; advertising disabled")
        payload["scenarios"] = {"enabled": False, "catalog": []}
    return payload


# ============================================================================= the rec proxy
def _persona_for_provenance(persona_id: str | None) -> dict:
    p = personas_lib.get_persona(persona_id)
    if p is None:
        default = personas_lib.get_persona("default")
        return {"id": "default", "name": default["name"] if default else "Default (no persona)"}
    return {"id": p["id"], "name": p["name"]}


def generate_recommendation(ticker: str, bundle: dict, *, persona_id: str | None,
                            dte_min, dte_max, override: bool,
                            snapshot_fingerprint: str,
                            resolved: ResolvedKey,
                            scenario_id: str | None = None) -> dict:
    """
    The best-effort, isolated, gated LLM proxy → emits INTERFACE §1.1/§2.1 `RecResponse` (ALWAYS a
    well-formed dict the endpoint returns as HTTP 200). NEVER raises for an LLM/cap/key/gate fault.

    `resolved` (byo-ai-key §1) is the per-request resolved-key VALUE OBJECT computed at the main.py
    boundary — it carries WHICH key material to use, `key_source`, the model, the per-identity
    metering identity, and (for key_source=none) the distinguished `unavailable_reason`. The leaf
    NEVER decrypts and NEVER reads env for the key; it consumes the VO. The raw `key_material` is
    used transiently to build the provider and is NEVER serialized/logged.

    `scenario_id` (ai-rec-backtest-orders, BACKEND §2) is the OPTIONAL scripted-scenario selector:
    absent/None ⇒ the shipped path below, byte-for-byte (AC-45). Non-null ⇒ the scenario branch —
    keyless (main.py SKIPPED key resolution; `key_source:"none"`) and meter-bypassing (neither
    checks nor consumes cooldown/cap/allowance, AC-37/38) — gated by `AI_REC_SCENARIOS_ENABLED`
    (default OFF ⇒ the contained `scenario_unavailable` refusal, AC-35). The REAL `ai_eval`
    readiness gate still wins over scenario selection (AC-43); scenario responses carry additive
    `scenario:{id,name}` provenance (refusals do not — a refusal is not scenario output).

    Order of operations:
      1. Pin provenance + key_source/free-use fields from the cached bundle + the VO.
      2. key_source==none short-circuit: emit `unavailable` with the distinguished reason
         (no_key (a) / over_limit (c) / shared_key_unconfigured (e)) — NO LLM call, NO meter.
      3. Gate short-circuit: gate==no_fresh_edge && !override => `gated_off`.
      4. Per-identity cap short-circuit: over_cap => `unavailable` / "over_cap".
      5. Call the LLM behind the seam (own timeout). Fault => `unavailable` (NO meter consumed).
      6. Success => `produced` + coerced strategy; commit the per-identity cooldown/cap; on a
         shared_admin success ONLY, consume one per-admin allowance unit (mirror commit_query).
    """
    meta = bundle.get("meta") or {}
    freshness = meta.get("freshness") or {}
    ai_eval = bundle.get("ai_eval") or {}
    as_of = freshness.get("snapshot_iso")
    pinned_fingerprint = ai_eval.get("state_fingerprint") or snapshot_fingerprint or ""
    stale_born = bool(freshness.get("stale"))
    persona = _persona_for_provenance(persona_id)
    identity = resolved.metering_identity or "_global"
    gate = derive_gate(ai_eval, identity)
    cap_snap = _rate.snapshot(identity)["cap"]
    # The provenance/free-use fields the FE keys off (byo-ai-key §2). For key_source=none these are
    # the pre-call snapshot values from the VO; on a produced shared rec remaining is updated below.
    key_source = resolved.key_source
    remaining_free_uses = resolved.remaining_free_uses
    free_uses_total = resolved.free_uses_total

    def envelope(status, *, strategy=None, unavailable_reason=None, ks=None,
                 remaining=None, total=None, scenario=None):
        out = {
            "status": status,
            "persona": persona,
            "as_of": as_of,
            "pinned_fingerprint": pinned_fingerprint,
            "stale_born": stale_born,
            "strategy": strategy,
            "unavailable_reason": unavailable_reason,
            "gate": gate,
            "cap": cap_snap,
            # byo-ai-key additive fields:
            "key_source": ks if ks is not None else key_source,
            "remaining_free_uses": remaining if remaining is not None else remaining_free_uses,
            "free_uses_total": total if total is not None else free_uses_total,
        }
        # ai-rec-backtest-orders (INTERFACE §1.3): scenario provenance is ADDITIVE and non-null on
        # EVERY scenario-driven response (produced / scenario no_trade / fault). Absent == null on
        # every real read AND on both scenario refusals (a refusal is not scenario OUTPUT);
        # omitting the key keeps the shipped real path byte-for-byte (AC-45).
        if scenario is not None:
            out["scenario"] = scenario
        return out

    # --- ai-rec-backtest-orders scenario branch (BACKEND §2, order of checks binding) ----------
    # Runs AFTER the auth gate (main.py, outermost — AC-42) and applies the REAL ai_eval readiness
    # gate FIRST (a gated refusal wins over scenario selection — AC-43), then the flag/registry.
    # The branch is keyless (key resolution was SKIPPED at the main.py boundary) and
    # meter-bypassing: it NEVER calls check_blocked/commit_query/admin_commit, so cooldown, the
    # daily cap, and the per-admin allowance are neither checked nor consumed (AC-37/38) — the
    # `gate`/`cap` snapshots above still report the real, untouched values. Every fault here is a
    # contained HTTP-200 refusal, never a 5xx, and never falls through to a paid provider (AC-35).
    if scenario_id is not None:
        if gate["state"] == "no_fresh_edge" and not override:
            return envelope("gated_off")  # identical to the real gated refusal (AC-43)
        from . import ai_scenarios  # lazy: keeps the load-time import graph one-way (leaf-of-leaf)
        if not ai_scenarios.scenarios_enabled():
            # Flag OFF ⇒ the contained refusal. No key resolution happened, no meter was touched,
            # and NO provider of any kind is invoked (AC-35).
            return envelope("unavailable", unavailable_reason="scenario_unavailable")
        entry = ai_scenarios.get_scenario(scenario_id)
        if entry is None:
            return envelope("unavailable", unavailable_reason="scenario_error")
        provenance = {"id": entry.id, "name": entry.name}
        try:
            context_json = json.dumps(serialize_context(bundle), default=str)
            raw = ai_scenarios.ScenarioLLMProvider(entry).generate_strategy(
                system_prompt="", context_json=context_json, glossary="",
                dte_min=dte_min, dte_max=dte_max)
        except LLMUnavailable as e:
            # Fault scenarios reproduce the REAL degraded shape (+ provenance) — AC-40.
            return envelope("unavailable", unavailable_reason=e.reason, scenario=provenance)
        except Exception as e:
            # Template render fault ⇒ contained scenario_error. The reason string and this log
            # line carry no key/secret/template internals (class name + id only).
            logger.warning("ai_recommendation: scenario %r render fault (%s)",
                           scenario_id, type(e).__name__)
            return envelope("unavailable", unavailable_reason="scenario_error")
        # Produced through the REAL coercion + envelope. NO commit_query / NO admin_commit — the
        # meter stays untouched (AC-38).
        return envelope("produced", strategy=_coerce_strategy(raw), scenario=provenance)

    # (2) No usable key — emit the distinguished unavailable reason. NO LLM, NO meter (AC-1/3/6/24).
    if key_source == "none":
        return envelope("unavailable", ks="none",
                        unavailable_reason=resolved.unavailable_reason or "no_key")

    # (3) Gate short-circuit — belt-and-suspenders (the FE normally gates ahead via §1.3).
    if gate["state"] == "no_fresh_edge" and not override:
        return envelope("gated_off")

    # (4) Per-identity global-cap short-circuit — a calm blocked state, never an HTTP error.
    block = _rate.check_blocked(identity)
    if block == "over_cap":
        return envelope("unavailable", unavailable_reason="over_cap")

    # (5) Call the LLM behind the seam. Any fault => contained `unavailable` (NO meter — AC-17).
    try:
        system_prompt = assemble_persona_prompt(persona_id)
        context = serialize_context(bundle)
        context_json = json.dumps(context, default=str)
        glossary = _read_glossary()
        provider = _get_provider(resolved)
        raw = provider.generate_strategy(
            system_prompt=system_prompt, context_json=context_json, glossary=glossary,
            dte_min=dte_min, dte_max=dte_max)
    except LLMUnavailable as e:
        return envelope("unavailable", unavailable_reason=e.reason)
    except Exception:
        logger.exception("ai_recommendation: unexpected proxy failure; returning unavailable")
        return envelope("unavailable", unavailable_reason="llm_error")

    # (6) Success — coerce to schema, commit the per-identity cooldown/cap counter.
    strategy = _coerce_strategy(raw)
    _rate.commit_query(identity)
    cap_snap = _rate.snapshot(identity)["cap"]
    # On a shared_admin PRODUCED rec ONLY, consume one per-admin allowance unit (count on success
    # only — own-key is unmetered against the shared pool; byo-ai-key §6).
    if key_source == "shared_admin" and resolved.metering_identity:
        remaining_free_uses = _rate.admin_commit(resolved.metering_identity)
        free_uses_total = ADMIN_FREE_DAILY
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
        "key_source": key_source,
        "remaining_free_uses": remaining_free_uses,
        "free_uses_total": free_uses_total,
    }
