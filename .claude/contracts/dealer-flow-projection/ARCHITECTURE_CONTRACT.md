# ARCHITECTURE CONTRACT — Dealer-Flow Projection

> Producer: Architect. Consumer: PM (next role).
> Reader has ONLY `.claude/PROJECT_CONTEXT.md` + this file. No chat history.
> Lane: data-structure CONTENT, data-flow, component boundaries, isolation/error rules, restated
> binding constraints, non-goals, open questions. **NO UI/layout, NO endpoint signatures, NO
> payload/JSON field NAMES, NO copy** — those are the PM → UX/interface-split lane (see §Open questions).
> This is compressor-#2 output: decisions, not deliberation.

## 0. Goal (one paragraph)
Turn the already-computed, currently display-only net charm + net vanna (`engine.process_gex_profile`)
into a **forward-looking, assumption-explicit projected dealer-hedging-flow read**: the delta dealers
must buy/sell (a) as time passes toward the next monthly OPEX (the **charm limb**) and (b) if implied
vol moves a stated amount (the **vanna limb**). It is an **additive, advisory CONTEXT read** — it rides
the state export the downstream AI consumes (to enrich TIMING + conviction) and is displayed to the
trader. It **never** touches `opportunity_score` / `opportunity_tier` / the entry gate / `state_fingerprint`.
It is a projection under STATED assumptions, surfaced with those assumptions VISIBLE, exactly as the
analytic gamma flip is surfaced with its "immaterial divergence" honesty posture.

---

## 1. Grounding — what already exists (verified in code)
- `apps/api/src/core/engine.py` `process_gex_profile` already computes, in the SAME per-contract GEX
  loop, over the **DTE-window-filtered** contracts (`filtered_contracts`), rounded to 2dp:
  - `net_charm` (`total_net_charm`) — sum of `dollar_charm = charm · (1/365) · OI · 100 · spot`, where
    `charm = -dDelta/dTime` (daily delta bleed, generalized `b = r−q`). **Units: dollar-delta per 1
    calendar day of time passing, holding spot & vol.** Put sign flipped (`*= -1.0`) so the aggregate is
    a signed dealer-book number consistent with GEX's calls-+/puts-− convention.
  - `net_vanna` (`total_net_vanna`) — sum of `dollar_vanna = vanna · 0.01 · OI · 100 · spot`, where
    `vanna = dDelta/dVol`. The `0.01` scales to **one IV POINT** (1 vol point = 0.01 in decimal IV).
    **Units: dollar-delta per +1 IV-point move in implied vol.** Put sign flipped.
  - `net_volga` (`total_net_volga`) — dVega/dVol; present but **NOT elevated by this feature** (kept
    display-only; see §7 non-goals).
  - `spot` used = `synchronized_spot` (== `gex_spot`, the level-anchor spot), NOT the live/display spot.
  - Greeks use analytic generalized Black-Scholes (`_calc_charm`/`_calc_vanna`), `r = 0.045`, `q`
    per-ticker, time floored at `MIN_GREEK_T = 1/365`. This is the SAME analytic machinery the gamma
    flip uses — **not** the vendor gamma the walls/profile use.
- `apps/api/src/core/signals.py` reads ONLY: price, gamma_flip, net_gex, call/put walls, peak_gex,
  max_pain, iv_hv_ratio, vwap bands. `state_fingerprint` folds only regime / vol_regime / setups /
  score-bucket / level-distance signs. **It references NO higher-order greek and NO positioning metric**
  (grep-verified: zero occurrences of charm/vanna/volga/dex/skew/term). The isolation boundary this
  feature must preserve is therefore **already structurally clean**.
- `apps/api/src/models/market_data.py` — `MarketState` surfaces `net_vanna`/`net_charm`/`net_volga` as
  `Optional[float] = None`; the four positioning metrics (`net_dex`, `chain_vol_oi_ratio`, nested
  `IvSkew`, nested `TermStructure`) are each `Optional[...] = None`, independently nullable. `IvSkew` /
  `TermStructure` are **nested Pydantic sub-models** — the template for a nested projected-flow object.
- `apps/api/src/core/ai_recommendation.py` `serialize_context` reads `bundle.get("market_state")`
  **wholesale** → any new field on `MarketState` flows into the AI export + manual hand-off with **no
  serializer change**. `signals`/`engine`/`live`/`darkpool` do NOT import this leaf.

---

## 2. The projection MODEL (architecture decisions — RESOLVED)

### 2.1 Horizon
- **Charm limb horizon = calendar days to the next MONTHLY OPEX (3rd-Friday expiration).** Rationale:
  charm bleed is a time-to-expiry catalyst and the monthly OPEX is the conventional dealer-flow anchor
  the engine already privileges (`max_pain` uses the nearest monthly OPEX; `_is_monthly_expiration`
  already exists). Fixed-N-days was rejected: it decouples the read from the actual expiry structure the
  charm is measured against. The horizon in days (`H`) is the count from "today" (UTC date, matching the
  engine's `today_str`) to that monthly-OPEX date, clamped to `>= 1`.
- **Vanna limb has no time horizon** — it is an instantaneous sensitivity ("if vol moves NOW"). Its
  "horizon" is the vol-move magnitude assumption (§2.3), not a date.

### 2.2 Charm limb (expected delta drift, holding spot & vol)
- `net_charm` is **already** dollar-delta per +1 calendar day. The projected charm-driven flow to the
  horizon = **`net_charm · H`** (a linear, first-order projection: "if nothing else moves, this is the
  cumulative delta dealers must hedge by monthly OPEX from time-decay alone").
- **Linear (not re-integrated) by design.** Charm itself drifts as t→expiry; a path-accurate integral
  would require re-pricing the chain across a time grid (materially heavier, and a modeling choice the
  BRIEF does not ask for). The linear `net_charm · H` is the honest first-order read; its
  first-order-ness is part of the visible assumption set (§6). Re-integration is a named non-goal (§7).

### 2.3 Vanna limb (expected delta change per vol move)
- `net_vanna` is **already** dollar-delta per +1 IV point. The projected vanna-driven flow = **`net_vanna
  · Δσ`**, where **`Δσ` is a STATED, fixed vol-move assumption of +1 IV point (Δσ = 1)** as the base
  unit. Because the base unit is +1 point, the base projected vanna flow **equals `net_vanna` itself**;
  the read's job is to LABEL it as "expected dealer flow on a +1 vol-point move" and make the sign +
  direction legible, not to invent a new magnitude.
- **The vol-move assumption is a first-class, surfaced ASSUMPTION, not a hidden constant.** The read MUST
  carry the assumed `Δσ` it was projected at (so the trader/AI sees "per +1 IV pt" and can scale
  linearly). Whether the product ALSO surfaces a larger illustrative move (e.g. +2 / +5 pts) is a
  **product decision for the PM** (§Open questions) — architecturally it is pure linear scaling of the
  same `net_vanna`, no new computation.
- **Sign convention (must be stated in the read, resolved here):** the value carries `net_vanna`'s sign.
  A vol move can be up OR down; the base read is quoted for a vol **increase** (+Δσ). A vol decrease is
  the negation (linear). The read states the reference direction so the consumer is never guessing.

### 2.4 Aggregation across the chain
- **Window-scoped, NOT full-chain** — the projection aggregates over the SAME DTE-window-filtered
  contributors that `net_charm`/`net_vanna` already sum (`filtered_contracts`). Justification vs CONTEXT
  §3: charm/vanna are **hedging-flow structure** (the same family as GEX/DEX, which are explicitly
  window-scoped because the DTE window "shapes only the gamma structure"). They are NOT the full-chain
  family (max-pain / PCR / Vol/OI), which exist to be filter-independent references. A projected dealer
  FLOW read must move with the window the trader selected — a 7–45 DTE swing window should not have its
  charm read polluted by LEAP time-decay. This reuses the existing aggregates unchanged (no re-scoping).
- **Consequence for the horizon:** the charm limb multiplies the window-scoped `net_charm` by `H`
  (days-to-monthly-OPEX). If the selected DTE window **excludes** the next monthly OPEX, `net_charm` is
  still the window's aggregate charm and `H` is still to the monthly OPEX — this is intentional ("flow
  the CURRENTLY-SELECTED window will generate by that date"). The read MUST surface `H` and the OPEX date
  it targets so the assumption is inspectable (a window/horizon mismatch is then legible, not silent).

### 2.5 What the read contains (CONTENT — field-level; NAMES are the interface lane's, see §Open questions)
The projected-flow read is a **single nested object** on `market_state` (mirroring `IvSkew`/`TermStructure`),
independently nullable. Its CONTENT (quantities / units / signs / null rules):

| Content (quantity) | Type | Units / sign | Null rule |
|---|---|---|---|
| projected charm-driven flow to horizon | float | **dollar-delta** (signed; sign = `net_charm`'s dealer-book sign); = `net_charm · H` | null if `net_charm` unavailable OR horizon undeterminable |
| horizon length | int | **calendar days** to next monthly OPEX (`H >= 1`) | null if no monthly/future OPEX in chain |
| horizon target date | string | the monthly-OPEX date the charm is projected to (ISO date) | null with the above |
| per-day charm base | float | dollar-delta **per +1 calendar day** (= the existing `net_charm`) | null if `net_charm` unavailable |
| projected vanna-driven flow per assumed move | float | **dollar-delta** (signed) for the assumed `Δσ`; base `Δσ = +1 IV pt` ⇒ = `net_vanna` | null if `net_vanna` unavailable |
| assumed vol-move magnitude | float | **IV points** (the `Δσ` the vanna flow is quoted at; base 1.0) | null if vanna limb unavailable |
| vol-move reference direction | string | which direction `Δσ` is quoted for (a vol **increase**); the read is linear/negatable | null if vanna limb unavailable |
| spot basis | float | `synchronized_spot` / `gex_spot` the flow was computed at | null only if the whole read is null |

- **Signs:** both flow quantities inherit the existing signed-dealer-book convention (calls +, puts −,
  put contributions already negated in-engine). NO new sign math is introduced.
- **Rounding/determinism:** see §5.
- **Independent nullability of the two limbs:** the charm limb and vanna limb are **independently
  nullable** within the object (if `net_charm` is available but `net_vanna` is not, the charm limb
  populates and the vanna limb is null, and vice-versa). The whole object is null only when BOTH the
  underlying aggregates are unavailable OR the computation raises (§4).

---

## 3. LIVE-vs-STATIC classification (RESOLVED)
- **STATIC bundle read.** The projection is derived entirely from the cached option-chain snapshot: it
  reuses the engine's window-scoped `net_charm`/`net_vanna` (computed at `synchronized_spot`/`gex_spot`,
  the close-anchored spot) and the monthly-OPEX date from the same chain. It folds in **NO** live vol and
  **NO** live spot.
- **Therefore: EXCLUDED from the live-offline treatment** — exactly like the four positioning metrics and
  Net GEX. On an SSE drop it **keeps rendering the last bundle, un-dimmed, never blanked**; it does NOT
  gain an `⏸ offline` state. It refreshes only on the ~60s REST bundle poll.
- **Rationale for NOT making it live-derived:** making the vanna limb move on live IV or the charm read
  move on live spot would (a) create a live-recompute path off the SSE payload that the engine's greek
  machinery is not on, and (b) break the "assumption-explicit, snapshot-pinned" honesty posture (a
  projection that jitters every 1.5s reads as a live signal, which it is not). The projection is a
  deliberate, snapshot-anchored read — like the analytic flip, which is also computed once per bundle.
- **`[live-vs-static-isolation]` satisfied by declaration:** this datum is declared **static**; the FE
  binds it to the last-bundle render path, not the live-degrade path.

---

## 4. Isolation-from-scoring boundary (the HARD invariant — `[additive-keeps-score-byte-identical]`)

### 4.1 The structural guarantee
- **Producer:** the projection is computed in the **engine** (a pure, deterministic transform over the
  already-computed `net_charm`/`net_vanna` + the chain's monthly-OPEX date) and surfaced as a nested
  field on `MarketState`. It introduces **no new input to `signals`**.
- **The one-way boundary that makes score byte-identical:** `signals.generate_signals`,
  `_opportunity_score`, `compute_opportunity_tier`, `evaluate_gate`, and `state_fingerprint` read a fixed
  set of `market_state` keys (§1) that **does not and must not include** the projection object. Because
  `signals` never reads the new field, adding it cannot change any scoring output. This is the SAME
  boundary the four positioning metrics honor and is **already clean** (verified). The enforcement is
  the module boundary: `signals.py` imports nothing from the projection and reads no projection key.
- **Verification obligation (for the executioner/QA, stated here as the contract):** `opportunity_score`,
  `opportunity_tier`, the gate decision, and `state_fingerprint` are **byte-identical** with and without
  the projection object present, for the same input snapshot. (The proven pattern: score N / fingerprint
  H unchanged, as done for dex-voloi-skew-term and byo-ai-key.)

### 4.2 AI-call boundary (CONTEXT §8)
- The projection enriches ONLY the **state export** the AI reads (it rides `market_state`, which
  `serialize_context` already forwards wholesale). The AI is an **advisory consumer**: the projection
  **never** feeds `signals`/score/tier/gate/`state_fingerprint`, **never** triggers a recompute or vendor
  fetch, **never** rides the SSE path, **never** auto-acts. It is context that improves the AI's TIMING +
  conviction, nothing more.

### 4.3 Gamma-sourcing split — NOT reopened (`gamma-sourcing-split`)
- This is a **NEW derived read over the ANALYTIC greeks already computed** (charm/vanna use the same
  analytic BS machinery as the flip). It touches the walls / profile / peak-GEX (vendor gamma) and the
  gamma-flip (analytic gamma) **not at all**. No third gamma source, no re-unification of the split.

---

## 5. Float-DETERMINISM decision (BACKLOG §B — RESOLVED: FOLD THE FIX IN)
- **Decision: apply a deterministic reduction to the higher-order-greek aggregates as part of this
  feature.** `net_charm`/`net_vanna` (and `net_volga`, for consistency of the shared loop) are currently
  accumulated by naive left-to-right `+=` over `filtered_contracts`, whose contract order can vary,
  producing the logged **~9th-significant-digit float-ordering jitter** (BACKLOG §B "Engine higher-order-
  greek determinism"). This was **tolerable while display-only** (sub-visible, and it does NOT touch
  `opportunity_score`/score inputs/`state_fingerprint`). **Elevating these values into (a) an AI-consumed
  state-export field and (b) a projection multiplied by a horizon `H`** is the concrete pull to make them
  order-independent: an AI-consumed, snapshot-pinned "same picture" read should be **byte-stable across
  identical inputs** (so the manual hand-off, the in-app export, and cold==warm all agree exactly, and so
  a future fingerprint/dedupe over the export is not defeated by ordering noise).
- **Mechanism (engine-internal, math-invariant — the executioner picks the exact primitive):** replace
  the running `+=` accumulation of the per-contract dollar-charm/vanna/volga contributions with an
  **order-independent deterministic reduction** (e.g. sum a collected list via `math.fsum`, or sort
  contributions before summing, or Kahan). Requirement: the result is **independent of contract iteration
  order** and mathematically equal (to full precision) to the true sum. This is a determinism fix, **not**
  a value change: the rounded (2dp) outputs are unchanged in every realistic case; only the sub-visible
  ordering jitter is removed.
- **Scope guard:** the fix is confined to the charm/vanna/volga aggregation. It does **NOT** touch the
  GEX/DEX sums, the flip, or any scoring input — those keep their current accumulation (changing them
  would risk `state_fingerprint` drift and is out of scope / a `[additive-keeps-score-byte-identical]`
  hazard). **QA must re-prove `opportunity_score`/`state_fingerprint` byte-identical after the fix**,
  since the fix lives in the engine that feeds `signals` (the guarantee: the fix touches only fields
  `signals` does not read).
- **Rounding:** the projection's output floats are rounded consistently with the existing metrics (2dp
  for dollar quantities), applied AFTER the deterministic reduction, so the surfaced value is stable.

---

## 6. HONESTY posture (RESOLVED — same posture as the analytic gamma flip, CONTEXT §3/§9)
- The projection is **model-dependent and forward-looking**; it MUST be surfaced with its assumptions
  **visible** and **never as a guarantee**. The read is self-describing: it carries its own horizon (`H`
  + the OPEX date), its vol-move assumption (`Δσ` + reference direction), its first-order/linear nature,
  and its spot basis — so neither the trader nor the AI can consume the number without the frame.
- **Assumptions that MUST travel with the read** (content requirements; the copy is the UX lane's):
  1. Charm flow is projected **holding spot & vol constant**, **linearly** (first-order, not
     re-integrated), to the next monthly OPEX.
  2. Vanna flow is the delta change for an **assumed vol move of `Δσ`** (base +1 IV pt), quoted for a vol
     **increase**, linearly scalable/negatable.
  3. It is a **dealer-hedging-flow projection**, advisory CONTEXT — **not** a price forecast, **not** a
     scored signal, **not** a guarantee. It is the "when/why dealers push," distinct from the static GEX
     levels' "where price is pulled."
- This mirrors the flip's "immaterial divergence, measure-before-calibrate" honesty: state the model,
  don't hide it, don't over-claim.

---

## 7. Non-goals (explicit)
- **Not scored.** Never an input to `signals`/`opportunity_score`/`opportunity_tier`/gate/
  `state_fingerprint`. No confluence bonus, no setup, no tier effect.
- **Not live-derived.** No live-vol / live-spot fold-in; no SSE path; no `⏸ offline` state.
- **No path-accurate charm re-integration.** The charm limb is the linear first-order `net_charm · H`;
  re-pricing the chain across a time grid is a named deferred seam, not this feature.
- **`net_volga` is NOT elevated.** Volga stays display-only; it is included in the determinism fix (§5)
  only because it shares the same aggregation loop, not because it gains a projection. (An IV-of-IV /
  vol-convexity read off volga is a possible future feature, out of scope.)
- **No gamma-sourcing change.** No third gamma source; walls/profile (vendor gamma) and flip (analytic
  gamma) untouched.
- **No new vendor dependency / no new network I/O.** The projection reuses aggregates already computed
  in `process_gex_profile` + the monthly-OPEX date already derived there; no provider-port change.
- **No engine change to the scored aggregates.** The determinism fix is confined to charm/vanna/volga.
- **No UI/layout, no endpoint, no wire field NAMES, no copy** — all downstream (§Open questions).

---

## 8. Restated binding constraints (name each — PM inherits these)
- **`[additive-keeps-score-byte-identical]`** (HARD) — the projection is AI-context/display ONLY; the
  entry gate, `opportunity_score`, `opportunity_tier`, and `state_fingerprint` stay **byte-identical**
  with/without it. `signals` imports and reads none of it (the module boundary is the enforcement).
  Re-proven after the §5 determinism fix.
- **`[best-effort-isolated-or-null]`** — any projection failure yields a **null/omitted field, never an
  HTTP error**; `market_state`/`strike_profile` and the SSE path stay intact. Computed in its own guarded
  block; the two limbs are independently nullable (§2.5); a raise → whole object null.
- **`[live-vs-static-isolation]`** — DECLARED **static** (§3): keeps rendering the last bundle un-dimmed
  on an SSE drop; excluded from the live-offline treatment; refreshes only on the REST poll.
- **`gamma-sourcing-split`** — NOT reopened: a new derived read over the ANALYTIC greeks already computed;
  does not touch the walls/flip vendor-vs-analytic gamma sourcing, adds no third source (§4.3).
- **Analytic BS greek math + `MIN_GREEK_T` floor** — unchanged: charm/vanna use the existing
  `_calc_charm`/`_calc_vanna` with `r = 0.045`, per-ticker `q`, `t` floored at `1/365`, spot =
  `synchronized_spot`. No new greek, no repricing.
- **AI-call boundary (CONTEXT §8)** — the AI stays an advisory consumer of already-computed state; the
  projection only enriches the state export it reads; never feeds score/gate/fingerprint, never
  recomputes/fetches, never rides SSE, never auto-acts, no key to the browser.

---

## Open questions for the PM (and interface/UX-split items — OUT of the Architect's lane)
These are product / interface / UX decisions this contract deliberately does NOT make:
1. **Wire/JSON field NAMES + nesting name** for the projected-flow object and its members (interface-split
   lane). This contract fixes the CONTENT/units/signs/null-rules only (§2.5).
2. **Transport & endpoint shape** — the object rides the existing cached bundle's `market_state`
   (structurally it already flows into `serialize_context`/the export with no serializer change); confirm
   no new endpoint is wanted. (Architect view: NO new endpoint needed — additive `MarketState` field.)
3. **The vanna-limb vol-move magnitude(s) surfaced to the trader** — base is +1 IV pt; does the product
   also show an illustrative larger move (e.g. +2 / +5 pts)? Pure linear scaling, no new computation — a
   presentation/product choice.
4. **Whether to surface a vol-DECREASE read** alongside the base vol-increase quote (it is the negation;
   product decides if both directions are shown).
5. **Display placement, tile/section shape, chart vs numeric, chip labels, and all COPY** (the
   assumptions text, the "not a guarantee" framing, the units labels) — UX lane, per the honesty content
   requirements in §6.
6. **Acceptance criteria** for: score byte-identity (with the §5 determinism fix), per-limb null states,
   the static/no-offline behavior on an SSE drop, the horizon = monthly-OPEX derivation (incl. the
   window-excludes-OPEX case, §2.4), and the assumptions-visible requirement.
7. **Glossary entry** for the downstream-AI `market_state_glossary.md` (field-level reference for the AI
   consumer) — content owned by UX/Tech-Writer, but the PM should scope it as a deliverable.
8. **Determinism-fix regression scope** — the PM should list "re-prove `opportunity_score` +
   `state_fingerprint` byte-identical after the higher-order-greek reduction change" as an explicit AC
   (the fix lives in the engine that feeds `signals`; §5).
