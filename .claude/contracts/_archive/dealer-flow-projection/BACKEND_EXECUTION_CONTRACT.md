# BACKEND EXECUTION CONTRACT — Dealer-Flow Projection

> Server work ONLY. Binds to `INTERFACE_CONTRACT.md` (what to EMIT). Contains NO UI detail.
> Self-contained against `.claude/PROJECT_CONTEXT.md` + this feature's ARCHITECTURE_CONTRACT +
> INTERFACE_CONTRACT. No chat history.

## Scope (what the backend builds)
An additive, best-effort, **static** projection object on `MarketState`, computed in the engine from the
already-computed window-scoped `net_charm`/`net_vanna` aggregates + the chain's next monthly-OPEX date;
the higher-order-greek summation is made order-independent (the folded-in determinism fix). **No new
endpoint, no new query param, no new vendor fetch, no serializer change.** `signals`/scoring untouched.

## 1. The projection object (emit exactly the INTERFACE shape)
Add a nested Pydantic sub-model on `apps/api/src/models/market_data.py` (mirror `IvSkew`/`TermStructure`)
and hang it on `MarketState` as an `Optional[...] = None` field named **`dealer_flow_projection`**. The
object + its two limbs (`charm`, `vanna`) are independently nullable. Emit the exact field
names/types/units/null-rules from `INTERFACE_CONTRACT.md §"Payload addition"` — restated:

- **`spot_basis`** (float): `synchronized_spot` / `gex_spot` the flow was computed at (close-anchored,
  NOT live). null only when the whole object is null.
- **`charm`** (object | null):
  - `projected_delta` (float, 2dp) = `net_charm · horizon_days`, signed dealer-book sign.
  - `per_day_base` (float, 2dp) = the existing `net_charm`.
  - `horizon_days` (int) = calendar days from "today" (UTC date, the engine's `today_str`) to the next
    monthly OPEX, **clamped `>= 1`**.
  - `opex_date` (str) = that monthly-OPEX date, ISO `YYYY-MM-DD`.
  - **null iff** `net_charm` is unavailable OR the horizon can't be determined (no future monthly OPEX
    in the chain).
- **`vanna`** (object | null):
  - `projected_delta` (float, 2dp) = `net_vanna · move_iv_points` with `move_iv_points = 1.0` ⇒ equals
    `net_vanna`.
  - `move_iv_points` (float) = `1.0` (fixed base).
  - `illustrative_move_iv_points` (float) = `5.0` (fixed illustrative shock).
  - `illustrative_projected_delta` (float, 2dp) = `net_vanna · 5.0` — **pre-scaled on the wire**.
  - `reference_direction` (str) = `"increase"`.
  - **null iff** `net_vanna` is unavailable.

## 2. The projection MODEL (compute rules — from ARCHITECTURE_CONTRACT §2; no re-scoping)
- **Reuse the existing window-scoped aggregates.** `net_charm`/`net_vanna` are already summed over the
  DTE-window-filtered contracts in `process_gex_profile` (the same `filtered_contracts` GEX loop, using
  the analytic BS greeks `_calc_charm`/`_calc_vanna`, `r = 0.045`, per-ticker `q`, `t` floored at
  `MIN_GREEK_T = 1/365`, spot = `synchronized_spot`). **Do NOT recompute greeks, do NOT re-scope, do
  NOT add a source.** The projection is a pure transform over the values already produced.
- **Horizon** = calendar days to the next MONTHLY OPEX (3rd-Friday expiration). Reuse the existing
  monthly-OPEX derivation the engine already privileges (`_is_monthly_expiration` / the `max_pain`
  monthly anchor). Count from `today_str` (UTC date). Clamp `>= 1`.
- **Charm projection:** `projected_delta = net_charm · horizon_days` (linear, first-order — NOT
  path-integrated). **Window-scoped horizon consequence:** if the selected DTE window EXCLUDES the next
  monthly OPEX, `net_charm` stays the window's aggregate and `horizon_days` still points to the OPEX —
  emit both `horizon_days` + `opex_date` unchanged (the mismatch is intentionally left legible; do NOT
  retarget to the window edge and do NOT null the limb just because the window is short).
- **Vanna projection:** base `= net_vanna · 1.0`; illustrative `= net_vanna · 5.0`. Both pre-scaled.
  Sign carries `net_vanna`'s sign; `reference_direction = "increase"` (a vol decrease is the negation —
  the backend emits NO separate decrease figure).
- **No live inputs.** No live vol, no live spot, no SSE path. It is derived entirely from the cached
  snapshot (`[live-vs-static-isolation]` — DECLARED static).

## 3. Determinism fix (folded in — ARCHITECTURE_CONTRACT §5)
- Replace the naive left-to-right `+=` accumulation of the per-contract dollar-charm/dollar-vanna/
  **dollar-volga** contributions in `process_gex_profile` with an **order-independent deterministic
  reduction** (e.g. `math.fsum` over a collected list, or a sorted/Kahan sum) so the result is
  independent of `filtered_contracts` iteration order and mathematically equal (full precision) to the
  true sum. This removes the ~9th-sig-digit float-ordering jitter (BACKLOG §B).
- **Volga is included in the fix ONLY because it shares the loop** — it gains NO projection and stays
  display-only (ARCHITECTURE_CONTRACT §7).
- **Scope guard:** the fix is confined to charm/vanna/volga aggregation. Do **NOT** touch the GEX/DEX
  sums, the flip, or any scoring input — changing those risks `state_fingerprint` drift.
- **Rounding** (2dp for dollar quantities) is applied AFTER the deterministic reduction, so the
  surfaced value is stable.

## 4. Isolation-from-scoring (HARD — `[additive-keeps-score-byte-identical]`)
- Compute the projection in the **engine** (a pure deterministic transform) and surface it ONLY as the
  nested `MarketState` field. Introduce **no new input to `signals`**. `signals.generate_signals`,
  `_opportunity_score`, `compute_opportunity_tier`, `evaluate_gate`, and `state_fingerprint` must read
  NONE of `dealer_flow_projection` (or the raw charm/vanna/horizon). `signals.py` imports nothing from
  the projection. This is the SAME boundary the four positioning metrics honor (already clean).
- **AI export rides it for free:** `ai_recommendation.serialize_context` reads `market_state`
  **wholesale**, so `dealer_flow_projection` flows into the in-app AI rec export AND the manual
  copy-paste hand-off with **no serializer change** (AC-14). Do NOT add a bespoke serializer path.

## 5. Best-effort isolation (`[best-effort-isolated-or-null]`)
- Compute the projection in its **own guarded block**. Any failure (missing aggregate, no monthly OPEX,
  or a raise) yields a `null` object / null limb — **never an HTTP error, never a fabricated 0/date**.
  `market_state` (gamma fields), `strike_profile`, and the SSE path stay intact; the bundle stays 200.
- The two limbs degrade **independently**: `net_charm` present + `net_vanna` absent ⇒ `charm` populated,
  `vanna` null (and vice-versa). Whole object null only when BOTH limbs are unavailable OR the block
  raises.

## 6. Glossary deliverable (AC-15)
- Insert the `dealer_flow_projection` entry (author-copy authored verbatim in **UX_BLUEPRINT.md §6**)
  into `apps/api/market_state_glossary.md` — a new subsection near "Higher-order dealer greeks" + add
  `dealer_flow_projection` to the **Reliability order** line (same tier as the higher-order greeks:
  directional/advisory context only). Keep it the glossary the export/hand-off path forwards. Copy is
  UX-owned; do not paraphrase away the units / assumptions / caveats / reliability-tier clauses.

## 7. Runtime proofs the backend must produce (the BE side of the required-tests matrix)
> No pytest suite exists (PROJECT_CONTEXT §Layout) — verify by app-run + `interface_conformance.py` +
> these explicit runtime proofs (the pattern used by dex-voloi-skew-term / byo-ai-key). Each proof is
> observable and traces to an AC.

- **P-AC-11 (additive byte-identity):** for one input snapshot, `opportunity_score`,
  `opportunity_tier`, the gate decision, and `state_fingerprint` are **byte-identical** with vs without
  `dealer_flow_projection` present. (Record score N / fingerprint H unchanged, as done for
  dex-voloi-skew-term / byo-ai-key.)
- **P-AC-12 (post-determinism-fix re-proof):** for the same input snapshot, `opportunity_score`, tier,
  gate, and `state_fingerprint` are byte-identical **before vs after** the higher-order-greek reduction
  change (the fix touches only fields `signals` does not read).
- **P-AC-16 (byte-stable projection):** for an identical input snapshot, the surfaced projected-flow
  numbers AND the underlying charm/vanna/volga aggregates are byte-stable across repeated compute /
  cold==warm (no sub-visible ordering jitter) — so the manual hand-off, the in-app export, and the
  display agree exactly.
- **P-AC-2/3/8 (horizon):** `charm.horizon_days` = days to the next monthly OPEX (`>= 1`) and
  `charm.opex_date` is that date; with a DTE window that EXCLUDES the OPEX, the limb still emits
  `horizon_days` + `opex_date` (not retargeted, not null-because-short).
- **P-AC-4 (vanna scaling):** `vanna.illustrative_projected_delta == net_vanna · 5` and
  `vanna.projected_delta == net_vanna · 1` (pre-scaled; FE does not multiply).
- **P-AC-7 (window scoping):** the two limbs change when `min_dte`/`max_dte` change (in step with
  `net_gex`/`net_dex`); they are NOT full-chain.
- **P-AC-9/10/10b (null family):** force `net_vanna` unavailable ⇒ `charm` populated, `vanna` null;
  force `net_charm` unavailable ⇒ `vanna` populated, `charm` null; force both ⇒ `dealer_flow_projection`
  null. In all cases the bundle stays 200 with `market_state`/`strike_profile` intact and NO fabricated
  0/date.
- **P-AC-14 (export presence):** `GET /api/recommendation/export/{ticker}` (and the in-app rec state
  export) contain `dealer_flow_projection` (via the wholesale `market_state` serialization), with no
  change to score/tier/gate/fingerprint.
- **Conformance:** author `.claude/tools/conformance/dealer-flow-projection.json` (standalone; the flat
  `interface_conformance.py` schema) projecting the INTERFACE `## Conformance spec` runnable endpoint —
  the score/tier/gate/fingerprint FLOOR + `market_state` presence ONLY. The additive field is
  optional/nullable and MUST NOT be a required path (a null cycle must PASS).

## 8. Files (backend lane)
- `apps/api/src/models/market_data.py` — new nested model(s) + the `dealer_flow_projection` field.
- `apps/api/src/core/engine.py` (`process_gex_profile`) — the projection compute (in its own guarded
  block) + the deterministic-reduction fix for charm/vanna/volga.
- `apps/api/market_state_glossary.md` — the glossary entry (UX_BLUEPRINT §6 copy).
- `.claude/tools/conformance/dealer-flow-projection.json` — the standalone conformance spec.
- **Untouched (binding):** `apps/api/src/core/signals.py`, the gate/score/tier/fingerprint,
  `ai_recommendation.serialize_context` (rides wholesale — no edit), the SSE path, the provider port,
  the GEX/DEX sums + flip.

## 9. Binding constraints (restated)
- **`[additive-keeps-score-byte-identical]`** (HARD) — display/AI-context only; `signals` reads none of
  it; re-proven after the determinism fix (P-AC-11/P-AC-12).
- **`[best-effort-isolated-or-null]`** — any failure ⇒ null object/limb, never an HTTP error, never a
  fabricated 0/date; limbs independent; the bundle stays 200.
- **`[live-vs-static-isolation]`** — DECLARED static: no SSE path, no live vol/spot; refreshes only on
  the REST poll.
- **`gamma-sourcing-split`** — NOT reopened: a derived read over the analytic greeks already computed;
  no third source, walls/flip vendor-vs-analytic gamma untouched.
- **Analytic BS greek math + `MIN_GREEK_T`** — unchanged; no new greek, no repricing.
- **AI-call boundary** — the AI stays an advisory consumer of already-computed state; the projection
  only enriches the export it reads.
```
