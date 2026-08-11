# ai-rec-backtest-orders — BACKEND EXECUTION CONTRACT

> Compressor #3 output 2 of 3. Server lane ONLY — the scenario provider + registry inside the
> ai-rec leaf, the env flag, per-request selector honoring, and the proof obligations. NO UI
> (the Orders store/engine/widgets, the Act flow, and all copy are the FE lane's — see
> FRONTEND_EXECUTION_CONTRACT). Wire truth = INTERFACE_CONTRACT (field names there are
> binding). Everything else on the server is **zero change**: `engine` / `signals` / `live` /
> `darkpool` / `auth` / providers / bundle / SSE untouched. There are NO order endpoints and
> NO server-side order state (arch §4/§11.1 — do not add any).

---

## 1. New module — `apps/api/src/core/ai_scenarios.py` (the ONLY new file)

A `ScenarioLLMProvider` behind the existing `LLMProvider` seam + a **declarative scenario
registry**. Imported ONLY by `src/core/ai_recommendation.py` (selector value plumbed through
the `main.py` boundary like the existing rec params). `signals`/`engine`/`live`/`darkpool`
import neither — AST-checkable, the structural score-byte-identity guarantee (arch §7).

### 1.1 The registry — scenarios are DATA, not code

Each entry: `{ id, name, template }` where `template` renders against the REAL serialized
context (read-only — the same context export the real provider receives; scenarios may anchor
to the bundle's own levels). **Deterministic given `(scenario_id, context)`** — no randomness,
no clock reads, no persona variation (persona is echoed in the envelope as shipped, never fed
to the template). Fault entries carry a `fault` marker instead of a template and raise
`LLMUnavailable("timeout" | "llm_error")` through the REAL fault-handling path.

### 1.2 Catalog (D2 — exactly these nine ids/names; `name` is rendered verbatim in the UI)

| `id` | `name` | Shape produced |
|---|---|---|
| `long_call_breakout` | Long call — full plan (entry/stop/target) | `trade`, long_call, entry_trigger WITH one explicit numeric level (anchor: call_wall; fallback spot×1.02 rounded), stop/target numeric, position_size stated |
| `long_put_breakdown` | Long put — full plan | `trade`, long_put, numeric-level trigger (anchor: put_wall; fallback spot×0.98), stop/target numeric |
| `conditional_break_above` | Conditional — break above a level | `trade`, long_call, entry_trigger "a break above {level}" where {level} > current spot (anchor: call_wall if above spot, else spot×1.02) |
| `conditional_break_below` | Conditional — break below a level | `trade`, long_put, entry_trigger "a break below {level}" where {level} < current spot (anchor: put_wall if below spot, else spot×0.98) |
| `unparseable_trigger` | Trade — trigger prose, no numeric level | `trade` whose entry_trigger is directional prose containing NO digits (e.g. "enter on confluence of flow flip and reclaimed VWAP") — exercises the FE empty-seed path (AC-6) |
| `condition_already_met` | Trade — condition already met | `trade`, entry_trigger "a break above {level}" with {level} = spot×0.99 rounded (guaranteed already crossed) — exercises the FE already-met notice (AC-9) |
| `no_trade` | No trade — stand aside | `no_trade` with rationale/summary; trade fields null/empty per the real schema |
| `fault_timeout` | Fault — provider timeout | raises `LLMUnavailable("timeout")` |
| `fault_llm_error` | Fault — provider error | raises `LLMUnavailable("llm_error")` |

Anchor rules are null-safe: a missing bundle level falls back to the spot-derived value; spot
comes from the serialized context, so determinism holds. All produced shapes MUST pass
`_coerce_strategy` (the real coercion — a scenario that fails coercion is a registry bug, and
its render fault surfaces as `scenario_error`, never a 5xx).

## 2. Env flag + per-request honoring (order of checks is binding)

**`AI_REC_SCENARIOS_ENABLED`** — default OFF; parsed like `AI_REC_STUB` (truthy env string).

On `POST /api/recommendation/{ticker}`, in order:

1. **Auth gate — outermost, UNCHANGED.** Logged-out/expired ⇒ 403/503 before any scenario
   logic (AC-42).
2. **`ai_eval` readiness gating + `override` — real, UNCHANGED** (AC-43). A gated refusal wins
   over scenario selection.
3. **Scenario branch** (only if request `scenario_id` is present and non-null):
   - Flag OFF ⇒ contained refusal: HTTP 200, `status:"unavailable"`,
     `unavailable_reason:"scenario_unavailable"`. **No key resolution, no cooldown/cap/
     allowance check or consume, no provider call of any kind** — never a silent fall-through
     to a paid LLM (AC-35).
   - Flag ON, unknown id or template render fault ⇒ HTTP 200, `status:"unavailable"`,
     `unavailable_reason:"scenario_error"`. Contained; no key/secret/internal text in the
     reason string (arch §9).
   - Flag ON, fault scenario ⇒ `LLMUnavailable` through the REAL fault path ⇒ the same
     degraded response a real `timeout`/`llm_error` produces (AC-40) + `scenario` provenance.
   - Flag ON, producing scenario ⇒ `ScenarioLLMProvider` output → `_coerce_strategy` → the
     real `RecResponse` envelope (real `as_of`/`pinned_fingerprint`/`stale_born` from the real
     context; real `gate`/`cap` snapshots) + `scenario: {id, name}`.
4. **`scenario_id` absent/null ⇒ the shipped path, byte-for-byte** (key resolution →
   Anthropic/Stub provider, cooldown, cap, allowance — untouched code path).

### 2.1 Key + meter bypass rules (binding — AC-37/38)

A scenario-selected request under flag ON:
- requires NO key material — key resolution is SKIPPED entirely (works on a keyless
  deployment, and never reads/decrypts a stored user key);
- neither checks nor consumes the 60s cooldown, the daily cap, or the per-admin free
  allowance — an exhausted cap/allowance does not block it, and a scenario call leaves every
  counter/cooldown timestamp untouched (the status readout before == after);
- responds with `key_source:"none"` and NO `remaining_free_uses`/`free_uses_total` decrement.

## 3. `GET /api/recommendation/status/{ticker}` — the scenarios advertisement

Add the ALWAYS-present `scenarios` object per INTERFACE §2: flag OFF ⇒
`{enabled:false, catalog:[]}` (never enumerate while disabled); flag ON ⇒ `enabled:true` +
the §1.2 catalog (`id` + `name`, registry order). The read stays side-effect-free, 200,
anonymous-readable, otherwise unchanged.

## 4. Isolation & error rules (restated, binding)

- Any scenario fault ⇒ a contained 200 `unavailable`-family response; NEVER a 5xx; bundle/SSE
  intact (`[best-effort-isolated-or-null]`).
- The auth carve-out stands: the auth gate keeps its real 403/503.
- Scenarios never alter what `/api/ticker`/SSE serve (arch non-goal §11.10).
- No log line or response ever carries key material or template internals.

## 5. Proof obligations (GATE Q evidence — run and record each)

1. **Byte-identity (AC-44/45, `[additive-keeps-score-byte-identical]`):** `opportunity_score`
   / `opportunity_tier` / `state_fingerprint` byte-identical across: flag OFF vs ON;
   scenario-selected vs not (same ticker/filters). Record the score/tier/fingerprint triple.
2. **Structural isolation:** AST/import check — `signals`/`engine`/`live`/`darkpool` import
   neither `ai_scenarios` nor anything new; `ai_scenarios` is imported only by
   `ai_recommendation` (+ the `main.py` boundary wiring).
3. **Flag-off refusal (AC-35):** with the flag unset, a scenario-selecting POST (signed-in)
   returns 200 `scenario_unavailable`; server logs show ZERO provider invocation.
4. **Keyless produced (AC-37):** with NO `ANTHROPIC_API_KEY`, no stored user keys, flag ON —
   each producing scenario returns `status:"produced"` (or its `no_trade`) with
   `scenario:{id,name}` and `key_source:"none"`.
5. **Meter untouched (AC-38):** status counters/cooldown identical before and after a scenario
   call; a scenario call succeeds with the daily cap/allowance exhausted.
6. **Determinism (AC-41):** two scenario POSTs against the same cached bundle ⇒ byte-identical
   `strategy` content. All nine catalog entries exercised (incl. both faults reproducing the
   real degraded shapes — AC-40).
7. **Auth outermost (AC-42):** anonymous scenario POST ⇒ 403, never a scenario rec.
8. **Gating real (AC-43):** not-ready ticker + scenario, no override ⇒ the real gated refusal;
   with `override:true` ⇒ the scenario runs.
9. **Conformance:** `interface_conformance.py` green on
   `.claude/tools/conformance/ai_rec_backtest_orders.json` (default env) + the existing specs
   (additivity — nothing regressed).
