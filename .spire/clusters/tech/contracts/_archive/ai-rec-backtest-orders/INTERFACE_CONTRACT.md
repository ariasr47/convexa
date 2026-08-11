# ai-rec-backtest-orders — INTERFACE CONTRACT (FE ↔ BE truth)

> Compressor #3 output 1 of 3. Derived from UX_BLUEPRINT §6 + PRODUCT_CONTRACT D1/D9 +
> ARCHITECTURE_CONTRACT §7. Field names below are the contract of record for both lanes.
>
> **The interface surface of this feature is deliberately TINY.** Orders are CLIENT-LOCAL
> (`convexa.orders.v1`) — there are **NO order endpoints**, no order fields on any wire shape,
> and no change to `getTicker`/`streamTicker`/`GET /api/contract`/`GET /api/personas`/
> `GET /api/recommendation/export`. Order creation rides the EXISTING
> `POST /api/positions/sim-trade/gate` byte-unchanged (403 ⇒ prompt + abort). The ONLY wire
> delta is **purely additive on two existing ai-rec endpoints**: the rec POST gains an optional
> scenario selector + scenario provenance, and the status GET gains the scenario advertisement
> the picker needs.

---

## 0. The env flag (pinned per D9)

**`AI_REC_SCENARIOS_ENABLED`** — server env, **default OFF** (absent/false ⇒ off). An
operator/dev tool in the `AI_REC_STUB` / `SEED_TEST_ACCOUNT` family. No production-store
refusal coupling (D1): default-off + end-to-end scripted marking is the safety boundary.

## 1. `POST /api/recommendation/{ticker}` — additive request field + additive response fields

### 1.1 Request (`RecRequest` gains ONE optional field)

```
{ ...existing fields..., "scenario_id": string | null }   // OPTIONAL; absent == null
```

- **`scenario_id` absent or `null` ⇒ the shipped path, byte-for-byte** (key resolution,
  cooldown, cap, allowance, provider selection — all exactly as today). This is the hard
  additivity rule (AC-45).
- **Auth stays OUTERMOST, unchanged:** a logged-out/expired-session request is rejected
  403/503 BEFORE any scenario logic — never answered with a scenario rec (AC-42).
- **Real readiness gating stays real:** the `ai_eval` gate + `override` behave identically
  with a scenario selected (a not-ready ticker without override refuses exactly like a real
  request — AC-43).

### 1.2 Behavior matrix for `scenario_id` present (non-null)

| Flag | `scenario_id` | Result (always HTTP 200 on this branch; never 5xx; never a paid LLM call) |
|---|---|---|
| OFF | any | `status:"unavailable"`, `unavailable_reason:"scenario_unavailable"` — the contained refusal (AC-35). No key resolution, no meter touch, no fall-through to a real provider. |
| ON | unknown id / template render fault | `status:"unavailable"`, `unavailable_reason:"scenario_error"` — contained, isolated; no secret/internal text in the reason (arch §9). |
| ON | fault scenario (`fault_timeout` / `fault_llm_error`) | The SAME degraded shape the real fault produces: `status:"unavailable"`, `unavailable_reason:"timeout"` / `"llm_error"` (existing tokens) + `scenario` provenance (1.3). |
| ON | producing scenario | `status:"produced"` (or the scenario's `no_trade`) through the REAL envelope (`_coerce_strategy`, real `as_of`/`pinned_fingerprint`/`stale_born`/`gate`/`cap` snapshots) + `scenario` provenance. |

- **Keyless + meter bypass (binding):** a scenario-selected request under flag ON requires NO
  key material (`key_source:"none"`, no `remaining_free_uses` decrement) and **neither checks
  nor consumes** cooldown, the daily cap, or the per-admin allowance (AC-37/38). The `gate`/
  `cap` response snapshots still report the real, untouched values.
- **Determinism:** identical `(scenario_id, context)` ⇒ byte-identical rec content (AC-41).
  Scenario output does NOT vary by persona; `persona` in the envelope echoes the request as
  shipped.

### 1.3 Response (`RecResponse` gains ONE optional field)

```
"scenario": { "id": string, "name": string } | null      // additive; absent == null
```

- **Non-null on EVERY scenario-driven response** — produced, scenario `no_trade`, AND fault
  scenarios — so D8-4 scripted marking can render end-to-end (rec → order → export, AC-39).
- `null`/absent on every real read (incl. both refusal rows above — a refusal is not scenario
  OUTPUT). The FE keys the "SCRIPTED SCENARIO" marking off this field ONLY.
- No other `RecResponse` change. `unavailable_reason` gains the two new tokens
  `scenario_unavailable` / `scenario_error` (string field, already open-set for the FE — the
  panel's generic unavailable block handles both; no special FE copy).

## 2. `GET /api/recommendation/status/{ticker}` — additive advertisement field

`RecStatus` gains ONE field, **ALWAYS present** after this feature (statically checkable):

```
"scenarios": { "enabled": boolean, "catalog": [ { "id": string, "name": string } ] }
```

- Flag OFF ⇒ `{ "enabled": false, "catalog": [] }` — the catalog is NEVER enumerable while
  disabled (D1: zero scenario surface; the FE renders no picker when `enabled:false`).
- Flag ON ⇒ `enabled:true` + the full registry catalog: `id` (stable selector token, what the
  POST sends back as `scenario_id`) + `name` (human-readable display name, rendered verbatim
  in the picker — single-sourced from the server registry, AC-36). Order = registry order.
- The read stays side-effect-free, anonymous-readable, HTTP 200, unchanged otherwise.

## 3. Explicitly unchanged (restated so no lane drifts)

- `GET /api/recommendation/export/{ticker}` — unchanged (egress floor intact).
- `GET /api/ticker/*`, SSE `/api/stream/*`, `GET /api/contract/*`, `GET /api/personas`,
  `/api/auth/*`, `POST /api/positions/sim-trade/gate` — unchanged; no new header/param/field.
- Score / `opportunity_tier` / `state_fingerprint`: byte-identical with the flag on vs off and
  scenario-selected vs not (`[additive-keeps-score-byte-identical]`, AC-44/45 — BE proof
  obligation).

---

## Conformance spec

Machine-checkable (system-1) shapes live in the STANDALONE runnable file
**`.claude/tools/conformance/ai_rec_backtest_orders.json`** (flat
`{method,path,path_params,query,body,required}` schema `interface_conformance.py` executes —
same standalone convention as `conformance/byo-ai-key.json`; system-12). This section is the
human-readable truth; the JSON is its runnable projection.

**What the tool CAN assert (environment-independent, default flag-OFF sweep):**
1. `GET /api/recommendation/status/{ticker}` carries the existing `availability`/`gate`/`cap`
   shape UNCHANGED **plus** the always-present additive `scenarios.enabled: boolean` +
   `scenarios.catalog: array` (with `catalog[].id`/`catalog[].name: string` via `[]` fan-out —
   vacuously true on the default-off empty catalog, type-enforced when an operator runs the
   sweep with the flag ON).

**What the tool CANNOT assert (verified by BE runtime proofs + FE tests, not this tool):**
- The `POST /api/recommendation/{ticker}` branches (refusal tokens, scenario provenance,
  keyless/meter-bypass, determinism, auth-outermost) — the POST is auth-gated (anonymous ⇒
  403) and env/flag-dependent; covered by the BACKEND_EXECUTION_CONTRACT proof block + the
  FRONTEND test matrix.
- Byte-identity of score/tier/fingerprint across flag states — the BE byte-identity proof.

**HARD negative invariants both lanes enforce:** a scenario-selecting request NEVER
falls through to a paid LLM call and NEVER 5xxs; no reason string ever carries key/secret/
internal text; no response anywhere carries order data (orders never ride the wire).

---

## Amendment note (GATE Z — flagged by the FE executioner, ACCEPTED by the conductor 2026-07-02)

The TS client (`libs/api`) types `RecStatus.scenarios` as **optional** even though §2 specifies it
ALWAYS present on the wire. This is deliberate client-side resilience, not a wire change: the
BACKEND obligation (always emit `scenarios`) is unchanged and machine-checked by the conformance
spec; the FE merely degrades an absent field exactly like `{enabled:false}` (no picker, no throw)
instead of trusting the promise at the type level. Observable behavior matches this contract in
both directions. No lane action required.
