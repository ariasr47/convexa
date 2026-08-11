# FRONTEND EXECUTION CONTRACT — AI Recommendations

> Producer: UX/Tech-Writer (compressor #3). Consumer: Frontend executioner.
> Lane: **UI work + the component states** in UX_BLUEPRINT.md. References INTERFACE_CONTRACT.md for what
> it CONSUMES. Self-contained against GAMMAFLOW_CONTEXT.md + UX_BLUEPRINT.md + INTERFACE_CONTRACT.md.
> Repo: `C:\Dev\gammaflow-web` (Nx, React 19 + Vite + MUI). Tests: Vitest + jsdom + Testing Library.

The FE does **not** decide the requirement set — the **Tests to write** matrix below (derived from the
18 ACs × component states × promoted invariants) is the floor QA traces at GATE Q. Implement that set;
add unit tests as a ceiling; never silently drop a required case (untestable → GATE Z bounce).

---

## 1. What to build

### Components (new)
- `AiRecPanel` — the dedicated rec card (the state machine in UX_BLUEPRINT §2/§3). Independently
  nullable: its failure NEVER blanks the GEX chart, the four neutral tiles, off-exchange blocks, the
  ghost-trade tracker, or the live stream.
- `StateExportDrawer` — the always-available export floor (UX §4); opened from `AiRecPanel` AND wired
  into the existing persona `HandoffDialog` (augmenting today's manual hand-off — the SAME export feeds
  both paths).
- `useAiRecommendation` — the hook owning rec-panel state: reads `RecStatus` (gate/cap/availability),
  issues `POST /api/recommendation/{ticker}`, holds the pinned `RecResponse`, computes the **stale**
  transition by comparing the rec's `pinned_fingerprint`/`as_of` against the live bundle's
  `ai_eval.state_fingerprint`/`meta.freshness.snapshot_iso`. Never auto-refreshes/re-runs a rec.

### API client (`libs/api`, `@org/api`) — new typed functions + types
Add (names from INTERFACE_CONTRACT): `requestRecommendation(ticker, RecRequest): Promise<RecResponse>`,
`fetchRecExport(ticker, {personaId?}): Promise<RecExport>`, `fetchRecStatus(ticker): Promise<RecStatus>`,
plus the `RecRequest`/`RecResponse`/`RecStrategy`/`RecExport`/`RecStatus` interfaces matching INTERFACE
§1 exactly. A transport fault (non-2xx / network) surfaces as the `unavailable` panel state (caught,
not thrown to the page). **No key is ever sent or received.**

### Reuse (do NOT build new)
- **Personas:** consume `usePersona()` for the active persona + per-query override; assemble persona text
  from the **canonical** `GET /api/personas` (the FE embed is the offline/assembly-failure fallback only —
  this resolves the dual-sourcing flag; align with the persona module's canonical sourcing).
- **Ghost trade:** Accept reuses the shipped `TradeEntryDialog`. Extend its `prefill` seam (currently
  `{ expiration, strike, right }`) to also seed qty/stop/target from the rec; keep EVERY field editable;
  the dialog's existing mandatory `Open simulated trade` confirm + `SIMULATED` chip + paper-trade
  disclaimer are unchanged. Map rec → prefill per UX §5. **No new entry system, no order path.**

### Copy
All user-facing strings are verbatim from UX_BLUEPRINT §7 (microcopy index) + §3/§4/§5. Do not improvise
copy. Honor binding framing: advisory-behind-Accept (never imperative), risk-first foremost, `no_trade`
first-class (info, not red), honest "as of {snapshot}" + stale wording, the export's egress-honesty line.

---

## 2. Component states to implement (UX_BLUEPRINT §3 — full list)
`idle(Available)` · `loading("thinking")` · `produced(risk-first, whole)` · `no_trade` · `unavailable
(+retry)` · `cooling_down(timer)` · `daily_cap_reached(resets-when)` · `no_fresh_edge(de-emphasized +
override)` · `key_not_configured(inert + manual floor)` · `stale(newer bundle)` · `SSE-drop(rec
untouched)` · `Accept → pre-filled ghost-trade dialog → mandatory confirm/cancel`.

State sources:
- gate/cap/availability ← `fetchRecStatus` (`RecStatus`).
- the rec artifact ← `requestRecommendation` (`RecResponse`); `status` drives produced/unavailable/gated.
- stale ← compare rec pin vs live bundle (newer poll), per UX §3 `stale`.
- SSE-drop ← the panel ignores SSE entirely (it is NOT a live-derived tile); assert it is untouched.

---

## 3. Tests to write — REQUIRED MATRIX (Vitest + Testing Library; flow-integration is the centerpiece)

The flow-integration test drives the real user flow end-to-end, mocking ONLY the network boundary
(`requestRecommendation`/`fetchRecStatus`/`fetchRecExport`/the bundle + SSE), never a live backend. Every
row below is a required named test; QA traces each AC → ≥1 passing test at GATE Q. An uncovered AC is a
FAIL even if the suite is green.

| # | Test (named) | AC | Component state(s) | Asserts |
|---|---|---|---|---|
| T1 | `produces a risk-first rec after a thinking state` | AC1 | idle→loading→produced | click `Get AI recommendation` → `Thinking…` shows → produced rec renders with max-risk + invalidation FIRST, plus structure/strike/expiry/entry-trigger/sizing/target/stop/horizon/confidence/rationale |
| T2 | `renders the rec whole, never partially streamed` | AC2 | loading→produced | no rec field is in the DOM during `loading`; the full rec appears atomically replacing `Thinking…` |
| T3 | `shows persona attribution on the rec` | AC3 | produced/no_trade | `Persona · {name}` chip present, = `rec.persona.name` |
| T4 | `shows the pinned snapshot as-of on the rec` | AC4 | produced/no_trade | `As of {snapshot}` chip present, = `rec.as_of` |
| T5 | `renders no_trade as a legitimate outcome with no Accept` | AC5 | no_trade | info (not error) styling; rationale shown; **no `Accept into ghost trade` control**; provenance chips still present |
| T6 | `marks the rec stale when a newer bundle arrives, without refreshing it` | AC6 | produced→stale | after a newer bundle (changed `snapshot_iso`/`state_fingerprint`), `Stale · based on older data` + the strip appear; rec body byte-stable; NO new network call fired |
| T7 | `leaves the rec untouched on an SSE drop` | AC7 | produced + SSE-drop | simulate SSE drop (the page's `⚠ Live offline` engages elsewhere); the rec panel shows NO stale chip, NO offline chip, NO refresh — identical DOM; pinned |
| T8 | `de-emphasizes on no-fresh-edge but allows an explicit override query` | AC8 | no_fresh_edge | action de-emphasized + `No fresh edge right now`; `Ask anyway` present → click → `loading` (a query fires) |
| T9 | `disables the action with a visible cooldown that re-enables` | AC9 | cooling_down→idle | after a query, `Cooling down · {n}s` disabled; advancing the timer to 0 re-enables `Get AI recommendation` |
| T10 | `shows a calm daily-cap state with resets-when and keeps the export available` | AC10 | daily_cap_reached | `Daily AI limit reached — resets {when}`, not error styling; action disabled; `View what's sent` still works |
| T11 | `shows AI-unavailable with retry and degrades the rec surface alone` | AC11 | unavailable | on error/timeout → `AI unavailable — try again` + `Retry`; GEX chart + neutral tiles + off-exchange blocks + ghost-trade tracker + live stream still render; NO dashboard-wide error banner, NO blank page |
| T12 | `cleanly disables in-app when no key is configured but keeps the manual floor` | AC12 | key_not_configured | `in_app_enabled:false` → action inert + `In-app AI not configured`; `View what's sent`/HandoffDialog export still functional; rest of dashboard untouched |
| T13 | `pre-fills the editable ghost-trade entry dialog from a trade rec` | AC13 | produced→Accept | `Accept into ghost trade` opens `TradeEntryDialog` pre-filled with side/strike/expiry/stop/target/suggested-size; every field editable; sizing caption present |
| T14 | `creates no trade until confirm and none on cancel` | AC14 | Accept dialog | no ghost trade exists after Accept-open; Cancel → still none; Confirm → one created |
| T15 | `produces an unmistakably SIMULATED trade with no real-order path` | AC15 | Accept→confirm | confirmed trade carries `SIMULATED`, identical-in-kind to a manual ghost trade; no auto-exec/auto-track; no broker control anywhere |
| T16 | `uses active persona by default and a per-query override without recompute` | AC16 | idle→produced | default = active persona; choosing a different persona for the read → rec attributed to THAT persona; the globally-active persona unchanged; `opportunity_score`/`tier`/`ai_eval` unchanged; no getTicker/streamTicker fired |
| T17 | `lets the user view/copy the export without a call, even when in-app is unavailable` | AC17 | export drawer | `View what's sent` opens drawer with context + persona prompt + glossary + egress-honesty line; `Copy all` works; NO `requestRecommendation` call fired; works in `key_not_configured`/`daily_cap_reached`/`unavailable` |
| T18 | `keeps the score/tier/gate/live tiles byte-identical across rec activity` | AC18 | invariance | snapshot score/tier/gate/live-tile DOM before any query, after a produced rec, after a per-query persona override → byte-for-observable-identical; never-requesting also identical |

**Edge / invariant cases (promoted invariants × states — also required):**
| # | Test | Covers |
|---|---|---|
| E1 | `rec failure is isolated to its own surface` | `best-effort-isolated-or-null` (deepens T11): forced `unavailable` → no HTTP error reaches the bundle/page; all other surfaces live |
| E2 | `newer-bundle stales while SSE-drop does not` | `live-vs-static-isolation` (T6 vs T7 as distinct transitions in one flow) |
| E3 | `score/fingerprint unchanged with and without a rec, and across persona override` | `additive-keeps-score-byte-identical` (deepens T18) |
| E4 | `export carries only context, persona prompt, glossary for the current ticker` | egress honesty (deepens T17): no key, no other ticker, no identity, no order data in the drawer |
| E5 | `flags a stale-born rec generated off an already-stale bundle` | honest live-vs-stale: `rec.stale_born` → stale-born warning at birth, distinct from T6's post-gen stale |
| E6 | `disables retry when it would land in cooldown or over-cap` | retry-under-gate: `unavailable` `Retry` disabled + sub-caption when cooldown>0 / over_cap |
| E7 | `falls back to the embedded persona template when canonical personas are unavailable` | persona canonical-source + offline fallback (assembly-failure path) |

Standing FE rule: write unit + component + **flow-integration** tests; the flow-integration test is the
centerpiece (drives the actual user flow through every edge, mocking only the network boundary). Assert
the component states + degraded paths + promoted invariants, not a coverage %.

---

## 4. Invariants the FE must preserve (and assert)
- `[additive-keeps-score-byte-identical]` — the rec/export NEVER mutate `opportunity_score`/
  `opportunity_tier`/`ai_eval`/`state_fingerprint`/the gate or any dashboard number (T18/E3).
- `[best-effort-isolated-or-null]` — any rec fault is contained to `AiRecPanel`; everything else renders
  (T11/E1). A transport fault is caught and shown as `unavailable`, never thrown to the page.
- `[live-vs-static-isolation]` — the rec is a static artifact: newer bundle ⇒ stale (T6); SSE drop ⇒
  untouched (T7); never silently refresh/re-run (the hook fires NO query on poll or SSE events).
- `[no-real-order-path]` — Accept = paper-sim ghost-trade via the shipped dialog + mandatory confirm;
  `SIMULATED` everywhere; no broker path (T13/T14/T15).
- **Persona canonical-sourced + non-scoring** — per-query override is pure prompt-framing; it never
  recomputes and never changes the active persona (T16); canonical source with embed fallback (E7).
- **Honest live-vs-stale** — "as of {snapshot}" on every rec (T4); stale-born warning at birth (E5);
  never present a stale snapshot as fresh.
- **Server-side key only** — the FE never sends/holds a key; the rec request body carries only
  identifiers + gating context (INTERFACE §1.1).

## 5. Run / gates
- `npx nx test dashboard` (and `nx test api` for `libs/api`) — Vitest + jsdom + Testing Library.
- GATE Q: every AC1–AC18 → ≥1 named passing test from §3 (the table's AC column is the traceability map).
- The BE↔FE seam is verified by `interface_conformance.py` against INTERFACE_CONTRACT §3.
