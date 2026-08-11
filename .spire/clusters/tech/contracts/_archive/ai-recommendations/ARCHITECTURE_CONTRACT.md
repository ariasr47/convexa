# ARCHITECTURE CONTRACT — AI Recommendations (in-app risk-first ENTRY rec)

> Producer: Architect (architect-first entry, ROLE_LAUNCH_PROMPTS §1). Consumer: Product Manager
> (next), then UX/Tech-Writer, then Interface/Backend/Frontend.
> Reader has ONLY `.claude/GAMMAFLOW_CONTEXT.md` + `BRIEF.md` + this file. No chat history.
> Lane: data-structure *content*, data-flow, component boundaries, isolation/error rules, seams,
> non-goals, restated binding constraints. **No UI/layout, no endpoint signatures, no payload/JSON
> field names, no copy, no product re-scoping.** Everything product/UX/naming = "Open questions for
> the PM" at the end.

## Verdict
**Buildable** on the current architecture as GammaFlow's first LLM integration, with **NO change to
any math, signals, scoring, gate, fingerprint, cache, or SSE path**. The feature is a **new,
isolated, best-effort backend proxy** that (1) reads the *already-computed* cached bundle, (2)
serializes a context payload from it with **zero recompute**, (3) calls the downstream LLM with the
active persona's assembled prompt + that context, and (4) returns a structured rec the FE renders
and can **Accept** into the **existing** ghost-trade tracker. Three things are bounded amendments,
not redesigns: a new server-side secret + rate cap (least-privilege), a new isolated call path, and
the FE single-sourcing personas from `GET /api/personas` (the embed becomes offline fallback). Every
product rule, endpoint signature, payload field name, and UI surface is left to downstream.

---

## The relaxed boundary (restate precisely — this is the load-bearing canon change)

Canon `ai-external-no-llm` (GAMMAFLOW_CONTEXT §8: "The AI is external — GammaFlow defines the
contract + gate only, it does not call an LLM") is **deliberately relaxed by owner decision
(2026-06-23)**, to be formally demoted/narrowed at GATE S (system-7). The **NEW boundary this feature
must honor exactly**:

> **GammaFlow MAY now call an LLM — but ONLY as a best-effort, isolated, gated CONSUMER of
> already-computed state.** The call is opt-in (on-demand, user-initiated), gated by the existing
> `ai_eval` guardrails + a rate cap, fully isolated (any LLM failure is contained — never touches the
> bundle/SSE/page), advisory-only (nothing auto-acts), and a **pure downstream consumer**: the LLM
> sees only state GammaFlow has already computed and never feeds anything back into
> signals/score/tier/gate/fingerprint. The external/manual copy-paste hand-off **remains valid** and
> is augmented (not replaced) by the same JSON state export.

What the relaxation does **NOT** authorize (still forbidden):
- The LLM is **never** a scoring/gate/fingerprint input (see `additive-keeps-score-byte-identical`).
- The LLM **never** triggers a recompute, a vendor fetch, a cache mutation, or a real order.
- The LLM **never** rides the SSE path or blocks bundle delivery.
- The LLM **never** sees the API key in the browser (server-side proxy only).

---

## Binding constraints restated (must not be violated)

**Math invariants (the JSON export READS computed state; it NEVER recomputes)**
- **Gamma sourcing unchanged** — vendor gamma for profile/walls/peak GEX; analytic BS gamma *only*
  for the flip ±20% grid. This feature **adds no gamma source** and recomputes none of: gamma, flip,
  walls, peak GEX, net/call/put GEX, DEX, max pain, PCR, VWAP/bands, HV/IV, skew, term structure. The
  context export carries the values **as the bundle already serialized them** (a serialization of the
  cached `MarketState`/`signals`/`strike_profile`/`meta`, no derivation).
- **Rates/greeks model unchanged** — r = 4.5%, dividend yield q, `MIN_GREEK_T = 1/365` floor are not
  touched; nothing here repricing or re-deriving any greek.
- **DTE/expiration-filter scope unchanged** — the filter shapes gamma structure only; max pain & PCR
  stay full-chain. The export simply carries the requested DTE window (already in the bundle) so the
  LLM sizes to the horizon the levels were computed for.

**Promoted build invariants (BRIEF Invariant-watch — restated for the PM)**
- **`[additive-keeps-score-byte-identical]`** — the AI call is a **pure consumer**. It must NEVER be
  an input to `signals` / `opportunity_score` / `opportunity_tier` / the entry gate / `ai_eval` /
  `state_fingerprint`. `signals.py` / `engine.py` are **not modified**. The bundle (and its score +
  fingerprint) is **byte-identical with and without this feature enabled, and identical whether or
  not a rec was ever requested**. The enforcement boundary: the LLM call lives in a module that
  `signals`/`engine` do not import (a one-way dependency, like observability is Level-1 only).
- **`[best-effort-isolated-or-null]`** — an LLM timeout / error / rate-limit / over-cap / disabled
  (no key) yields a graceful **"unavailable" rec state**, never an HTTP error that breaks the bundle,
  the SSE path, or the rest of the page. The rec surface is **independently nullable**: its failure
  is contained to itself; the GEX chart, tiles, ghost-trade tracker, and live stream keep rendering.
- **`[live-vs-static-isolation]`** — a recommendation is **pinned to the bundle snapshot it was
  generated from** (honest staleness): it carries the snapshot's identity/as-of so the UI can show it
  is "as of {that snapshot}". A rec is a **static artifact** — it does **NOT** silently refresh, mutate,
  or re-evaluate on an SSE drop or a newer poll; a newer bundle makes the existing rec *stale*, it
  does not invalidate or auto-regenerate it. (The rec is generated-once, like a snapshot read, not a
  live-derived tile.)
- **`[no-real-order-path]`** — "action" = **Accept into the paper-sim ghost-trade tracker only**.
  `SIMULATED` everywhere. The rec is **advisory**: the user explicitly Accepts; nothing auto-acts; no
  broker order, ever. Accept **reuses the shipped ghost-trade tracker** (the existing entry path +
  durable store) — this is an *integration*, not a new order system.
- **Over-trading gate is binding** — querying honors the existing `ai_eval` guardrails (`ready` /
  `changed` / `state_fingerprint`) **plus a rate cap**; the risk-first output contract (the
  `strategy_prompt` schema: lead with risk, `no_trade` is a valid+common answer) survives intact and
  is never softened.
- **Persona single-sourcing** — the persona prompt sent to the LLM is the **canonical** decomposed
  template + presets from `GET /api/personas` (resolves the OPEN_THREADS §7 / BACKLOG §D dual-sourcing
  flag): the FE embed becomes an **offline / assembly-failure fallback only**. The assembled prompt is
  still a **non-input to scoring** (persona changes only the AI briefing — §6 canon).

**Other standing constraints inherited**
- **Dark-pool/off-exchange stays context-only** — capped, neutral, no directional "smart money."
  Off-exchange data enters the LLM context only as the same neutral context it already is; it never
  becomes a trade signal here.
- **Single-ticker, on-demand** — the rec is for the *current* ticker only; no watchlist/scan.
- **Honest live-vs-stale** — never present a stale snapshot as fresh; the rec inherits the bundle's
  freshness/`stale` flag at generation time.

---

## Data-structure CONTENT (content only — field NAMES are the PM/UX/Interface's call)

### A. The state→JSON context payload (what the LLM is fed about the ticker)
A **serialization of the already-computed cached bundle for the current ticker — NO recompute, no new
vendor fetch, no new derivation.** It is the structured context the manual copy-paste path lacks
today, and it is shared by both paths (in-app call + augmented manual export). Content it must carry,
all sourced verbatim from the existing bundle (`MarketState` / `signals` / `strike_profile` / `meta`):
- **Gamma structure:** the per-strike profile + walls (call/put wall), gamma flip, peak-GEX magnet,
  net/call/put GEX, max pain (+ its expiration), PCR.
- **The four neutral positioning reads:** DEX (net/call/put + per-strike), Vol/OI (chain ratio +
  per-strike + unusual threshold), IV skew (anchor tenor), term structure (ATM-IV-by-tenor curve +
  state). Each carried with its existing nullability.
- **Volatility/anchors:** ATM IV, 30d HV, IV/HV, VWAP + bands.
- **Higher-order greeks:** net vanna/charm/volga (directional context only).
- **Live fields** as captured **in that snapshot** (price, net flow, etc.) — carried as part of the
  pinned snapshot, NOT a live re-read (the rec is static).
- **Dark-pool/off-exchange context** (ratio, levels, blocks) — as the same neutral context, present
  only when the bundle includes it (toggle/availability respected).
- **`signals` read-outs the LLM should reason over:** setups, regime/vol-regime,
  `opportunity_score`, `opportunity_tier`, and `ai_eval` (`ready`/`changed`/`state_fingerprint`).
  Carried as **read-only context** — the LLM consumes them, it never produces or alters them.
- **The DTE/expiration window** the structure was computed over (so the LLM sizes to horizon).
- **Snapshot identity / as-of** so the rec can be pinned to it (the `state_fingerprint` + freshness/
  timestamp already in the bundle are the natural anchor — exact field choice is the Interface's).

> **No recompute clause (binding):** the exporter is a *read + serialize* of the cached bundle. If a
> value is absent/null in the bundle it is absent/null in the export — the exporter never fills,
> fetches, or recomputes a missing value. This keeps the math invariants untouched and keeps the
> export consistent with what every other surface shows.

> **Reuse the glossary:** `market_state_glossary.md` is the field-level reference and rides the
> context (as the external contract already specifies) so the LLM reads with the reliability order.

### B. The structured recommendation artifact (risk-first content)
The LLM returns the **existing `strategy_prompt` risk-first ENTRY schema** — the contract is already
defined in `prompts/strategy_prompt.md` and MUST survive unchanged (lead with risk; `no_trade` is a
valid+common answer; JSON-only). Risk-first content it carries:
- **Decision** (`trade` / `no_trade`) + **bias** (long/short/neutral/volatility).
- **Structure** + **concrete strike(s)** + **expiration within the requested DTE window**.
- **Entry trigger** (the confirming condition/level) + **invalidation level**.
- **Risk-first sizing:** max risk ($/% of account) + a concrete position size consistent with it.
- **Exit plan:** target + stop.
- **Time horizon** + **confidence** + **rationale citing the specific GammaFlow levels**.
- When `no_trade`: trade fields null + rationale (an honest, common, correct outcome).

**The rec artifact is wrapped with provenance** (content, not names): which **persona** produced it,
the **snapshot it is pinned to** (the as-of anchor above), and a **generation status** distinguishing
the artifact's states — produced / unavailable (LLM error/timeout/over-cap/disabled) / gated-off
(guardrails say no fresh edge). The wrapper is what lets the UI render honest staleness, the
"unavailable" path, and attribution. The artifact is **advisory metadata** — accepting it is a
separate, explicit user act (see boundary below).

---

## Data-flow + component boundaries

### Where the LLM call lives — BACKEND PROXY (not the FE)
The LLM call lives **server-side**, in a **new isolated backend module** (a sibling to the existing
best-effort modules, NOT inside `engine`/`signals`/`live`). Rationale that is binding (not product):
- **Credential model** — the API key is server-side (`.env`, mirroring `MASSIVE_API_KEY`); it MUST
  NEVER reach the browser. All LLM calls route through the backend → the FE never holds the key.
- **Egress control + rate cap** — a single server-side choke point is where the rate cap, the
  least-privilege egress, and the "exactly what state leaves the machine" boundary are enforced.
- **Isolation** — the call is on its own path, off the bundle/SSE pipeline; its latency
  (multi-second) and failure modes cannot stall the ~60s cached bundle or the live stream.

This new module is a **one-way leaf**: `signals`/`engine`/`live`/`darkpool` do NOT import it (mirrors
the observability Level-1 rule). That import boundary is the structural enforcement of
`additive-keeps-score-byte-identical`.

### Context assembly — from the CACHED bundle, no recompute
1. The proxy obtains the current ticker's **already-cached bundle** (the same cached `MarketState` /
   `signals` / `strike_profile` / `meta` the dashboard already holds) — **no new vendor fetch, no
   recompute**. Whether the proxy re-reads the bundle from the cache server-side or the FE hands the
   already-fetched bundle to it is an **Interface decision** (both satisfy "no recompute"); the
   binding rule is only that the context is a serialization of *already-computed* state.
2. The proxy serializes the context payload (§A) from it and **pins the snapshot identity/as-of**.
3. The **persona's assembled prompt** is sourced from the **canonical `GET /api/personas`** template +
   presets (FE embed = offline fallback). Where the prompt is assembled (server vs FE-then-passed) is
   an Interface decision; the binding rule is canonical-sourced + persona-is-non-scoring.

### Request → response flow
- **Gated trigger:** on-demand, user-initiated, **honoring `ai_eval`** (de-emphasized / "no fresh
  edge" when not `ready`/`changed`) **+ a rate cap**. The *exact* gating/cooldown UX policy is a PM
  product rule (below); the architecture only requires the guardrail + cap exist server-side.
- **Call:** proxy → downstream LLM (latest Claude) with (persona prompt + context payload + glossary).
  Token streaming is **optional** and a downstream build choice (the BACKEND lane consults the
  `claude-api` skill for model id / structured-output / streaming) — the architecture neither requires
  nor forbids it; either way the response is reconciled to the structured schema (§B).
- **Response:** the structured rec artifact (§B) wrapped with provenance + status, returned to the FE.
- **Render:** the FE renders the risk-first rec readably, attributed to the persona + pinned snapshot,
  with honest staleness. **Never presented as gospel** (hallucination risk is real) — the risk-first
  framing + the explicit-Accept gate are the discipline.

### The Accept → ghost-trade hand-off boundary (reuse, NOT a new order system)
- An **Accept** is an explicit user act that maps the rec's structured fields into the **existing
  ghost-trade tracker entry path** — pre-filling / creating a tracked `GhostTrade` via the shipped
  `TradeEntryDialog` + durable store. This is the **single boundary** between the AI feature and the
  tracker; the AI feature ends at "hand structured fields to the existing entry flow."
- **`SIMULATED` everywhere** — the accepted rec becomes a paper-sim ghost trade, identical in kind to
  a manually-entered one. No new store, no order path, no auto-fill without the user's act.
- **What Accept pre-fills vs leaves user-editable** (e.g. strike/expiry/size/stop/target) is a **PM/UX
  product decision** — the architecture only fixes that the data *flows into the existing entry flow*
  and the user confirms before anything is tracked.
- The reverse direction is forbidden: the ghost-trade tracker does **not** feed back into scoring, and
  an accepted rec is still advisory (the tracker is paper-sim).

---

## Isolation / error rules (binding)
- **Best-effort, contained:** LLM timeout / error / rate-limit / over-cap / no-key-configured → a
  graceful "unavailable" rec state. **Never** an HTTP 5xx on the bundle, never a broken SSE, never a
  blank page. The rec surface degrades **alone**.
- **Disabled = absent, not broken:** with no key configured (or the feature off), the in-app call path
  is simply unavailable and the **manual copy-paste path (now with the JSON export) still works** —
  the manual hand-off is the always-available floor.
- **Pinned + honest staleness:** every rec carries the snapshot it was generated from; a newer bundle
  marks it stale (UI shows as-of), it never silently refreshes or re-runs on an SSE drop / new poll.
- **Advisory-only:** nothing auto-acts; Accept is always an explicit user act; no broker path.
- **Cost/latency isolation:** the multi-second call is off the cached-bundle and SSE critical paths;
  its latency is the rec surface's own loading state, not the page's.

---

## Seams (designed-for, NOT built now)
- **BYO-key (per-user / multi-tenant) credential seam** — model the LLM credential like the vendor
  **provider port**: a single server-side key today, behind a seam that *could* later accept a
  per-user key when multi-tenancy is real (a lifted-constraint trigger). **Build the server-side-key +
  rate-cap path only; design the boundary so BYO-key is a contained later swap.** Explicitly NOT built.
- **Provider-port-like LLM abstraction** — the same seam keeps "which LLM vendor / model" a contained
  choice (mirrors `MarketDataProvider`), so a model/vendor change is an adapter swap, not a rewrite.
  Designed-for; the only model today is latest Claude.
- **Open-position reassessment** is a **separate existing path** (the `reassessment_prompt` / operator-
  mediated boundary) and stays out of scope here (entry only — see non-goals).

---

## Security / data-egress note (going-live-adjacent — foreshadows deferred system-6)
This is GammaFlow's **first external data egress to a generated-content surface**, so two things must
be designed least-privilege from the start (the deferred **system-6** red-team will scrutinize them
when going live):
- **Least-privilege secret handling:** the LLM key lives server-side only (`.env`, like
  `MASSIVE_API_KEY`), is never serialized into any bundle/SSE/response, never reaches the browser, and
  is read only by the isolated proxy. The rate cap is a server-side guard against runaway cost/egress.
- **Exactly what state leaves the machine:** what egresses is **only the already-computed context
  payload (§A) + the persona prompt + the glossary** for the *current ticker on demand* — no raw
  vendor credentials, no other ticker, no user identity, no order/broker data (there is none), and
  nothing the LLM can feed back into GammaFlow's state. The export is the **complete, auditable list**
  of what leaves; the PM/UX should treat "what's in the export" as an explicit, reviewable surface.
- **Generated-content trust:** LLM output is **untrusted, advisory text** — rendered as a
  recommendation behind an explicit Accept, never auto-executed, never fed back into scoring. The
  hallucination risk is mitigated by the risk-first schema + the explicit-Accept discipline, not by
  trusting the model.

---

## Explicit NON-GOALS (out of scope for this feature)
- **Real-order / broker path** — `SIMULATED` only; crossing to real orders is the deliberately parked
  "going-live" scope shift (OPEN_THREADS §5 / BACKLOG §D). Not here.
- **Reassessment of OPEN positions** — entry only (the first slice). The position-aware
  `reassessment_prompt` / operator-mediated reassessment path is the existing, separate boundary; this
  feature does not in-app-LLM-ify it.
- **BYO-key / multi-user / multi-tenant build** — designed-for seam only; single user today.
- **Anything that makes the AI a scoring input** — the LLM never feeds
  signals/score/tier/gate/fingerprint; the score stays byte-identical.
- **Recompute / new vendor fetch / new math** — the export reads computed state; no new gamma source,
  no greek repricing, no DTE-scope change.
- **Multi-ticker / watchlist** — current ticker, on-demand, only.

---

## Open questions for the PM (deliberately NOT decided here — product / scope / UX-policy)
1. **Rec UI scope** — where/how the rec surface lives on the dashboard, its layout, copy, and how the
   risk-first fields are presented (this is UX; the architecture only fixes the *content* + states).
2. **Gating / cooldown policy as a product rule** — the *exact* behavior when `ai_eval` is not
   `ready`/`changed` (de-emphasized? disabled? "no fresh edge" message?), and the cooldown/cadence
   the UI enforces on top of the rate cap.
3. **Cost / usage caps as product policy** — the concrete rate-cap numbers + what the user sees at the
   cap (the architecture requires a cap exists; the *value* + *over-limit behavior* are product).
4. **What Accept pre-fills** — which rec fields populate the ghost-trade entry (strike / expiry /
   size / stop / target) vs. stay user-editable, and the confirm step before tracking.
5. **Error / empty / over-limit product behavior** — exact UX for unavailable (LLM error/timeout),
   `no_trade` (a valid result, not an error), over-cap, and key-not-configured (manual path only).
6. **Manual-export UX** — how the augmented copy-paste export is surfaced alongside the in-app call
   (the architecture fixes that the *same* export feeds both paths; the surface is product/UX).
7. **Token streaming** — whether the rec streams in or appears whole (a UX/latency call; the
   architecture allows either).
8. **Attribution / staleness presentation** — how persona attribution + "as-of {snapshot}" staleness
   are shown (the architecture requires the data be pinned + carried; the presentation is UX).
9. **Persona selection at query time** — whether the active persona is implicit or chosen per-query
   (the architecture only requires it be canonical-sourced + non-scoring).

---

## Field-name / endpoint / payload disclaimer
This contract specifies **content and shape only**. All endpoint signatures, payload/JSON field
names, request/response envelopes, SSE semantics, and the exact `GET /api/personas` consumption
belong to the **Interface contract** (authored after UX). The Architect names none of them.
