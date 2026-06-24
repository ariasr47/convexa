# UX BLUEPRINT — AI Recommendations (in-app risk-first ENTRY rec)

> Producer: UX/Tech-Writer (ROLE_LAUNCH_PROMPTS §3). Consumers: Interface, Backend, Frontend executioners.
> Input: GAMMAFLOW_CONTEXT.md + PRODUCT_CONTRACT.md (18 ACs, 9 decisions) + ARCHITECTURE_CONTRACT.md +
> BRIEF.md. No chat history.
> Lane: component states, where each datum surfaces, microcopy/labels/tooltips, exact degraded-state
> wording, and the **AC → component-state mapping (the required-tests matrix)**. NO server internals,
> NO math, NO final endpoint/payload decisions beyond naming the fields the UI consumes. I have no
> Edit and no Bash — I write contracts, not code.

This file translates the PRODUCT_CONTRACT into concrete UI/interaction design + user-facing copy. It
invents no behavior and reopens no decision. Where the PM left placement/layout/copy to UX, this file
fixes it; where the PM fixed a product rule, this file honors it verbatim.

---

## 0. Surfaces & where they live

Three surfaces, all on the **trader dashboard** (current ticker only), all **independently nullable**
(a failure in any never blanks the GEX chart, the four neutral tiles, off-exchange blocks, the
ghost-trade tracker, or the live stream):

| Surface | Lives | Role |
|---|---|---|
| **A. Rec panel** (`AiRecPanel`) | A dedicated card on the dashboard, sibling to the ghost-trade panel | The on-demand "Get AI recommendation" action + the rendered rec + all gating/degraded states |
| **B. Export drawer** (`StateExportDrawer`) | Opened from a secondary "View what's sent" control in the rec panel header AND from the existing persona **HandoffDialog** (augmenting today's manual hand-off) | The always-available floor: view/copy the exact structured export (context + persona prompt + glossary) without triggering a call |
| **C. Accept → ghost-trade** | Reuses the shipped `TradeEntryDialog` (pre-filled), inside the existing ghost-trade tracker | The advisory Accept boundary; nothing tracked until confirm |

**Binding framing honored throughout** (PM Behavior rules + Decision 1):
- The rec is **advice behind an explicit Accept, never a command.** No imperative verbs ("Buy",
  "Enter now"). Copy frames it as "the AI suggests" / "a read", and the primary post-rec control is
  **"Accept into ghost trade"**, not "Execute".
- **Risk-first / invalidation foremost** — max risk + invalidation render **first**, above structure/
  strike/targets, in every produced rec.
- **`no_trade` is a first-class success**, visually distinct from an error (info/neutral, never red).
- **Honest staleness** — every rec carries "as of {snapshot}" and goes visibly stale on a newer bundle.
- **The export is the complete, reviewable list of what leaves the machine** — stated explicitly.
- **Never present a stale snapshot as fresh** — a rec generated off a stale bundle inherits a stale-born
  badge at birth (see §3 `produced` substate).

---

## 1. Data the UI consumes (names the FE reads — final shapes are the Interface's)

The UI consumes, by name (these are the consumption points the Interface contract must satisfy):

**From the existing bundle (already on the page — `TickerBundle`, unchanged):**
- `meta.freshness.snapshot_iso` — the **as-of / pin anchor** shown on every rec.
- `meta.freshness.stale`, `meta.freshness.data_age_seconds` — drives the **stale-born** badge.
- `ai_eval.ready`, `ai_eval.changed`, `ai_eval.reasons`, `ai_eval.state_fingerprint` — the **gating
  signal** (Available vs no-fresh-edge) + the staleness key (a rec whose pinned `state_fingerprint`
  no longer matches the current bundle's is stale).
- `signals.opportunity_score`, `signals.opportunity_tier` — shown unchanged; rendered in the export &
  invariance readout; **never mutated by this feature** (AC18).
- The active persona (`Handoff` / `usePersona().active`) — the default framing persona.

**From the new rec response (named here for the UI; typed in INTERFACE_CONTRACT):**
- `rec.status` — `produced | unavailable | gated_off` (drives panel state machine).
- `rec.persona` — `{ id, name }` (persona attribution, AC3).
- `rec.as_of` — the pinned snapshot identity (the `snapshot_iso` it was generated from) (AC4).
- `rec.stale_born` — boolean: the bundle was already stale at generation time (honest-stale-at-birth).
- `rec.strategy` — the risk-first fields: `decision`, `bias`, `structure`, `strikes[]`, `expiration`,
  `entry_trigger`, `invalidation_level`, `max_risk`, `position_size`, `exit_plan{target,stop}`,
  `time_horizon`, `confidence`, `rationale`. (`decision: no_trade` ⇒ trade fields null + rationale.)
- `rec.unavailable_reason` — short machine reason for the `unavailable` state (timeout/error/no_key/etc).

**From the new gating/cap status (named here; typed in INTERFACE_CONTRACT):**
- `gate.state` — `available | no_fresh_edge | cooling_down`.
- `gate.cooldown_remaining_seconds` — countdown for `cooling_down`.
- `cap.over_limit` — boolean: daily cap reached.
- `cap.resets_at` — ISO instant the daily cap resets (drives "resets {when}").
- `availability.in_app_enabled` — false ⇒ key-not-configured/feature-off (inert in-app action).

> The FE NEVER receives or holds an API key. None of the above carries a key (server-side only).

---

## 2. The rec-panel state machine (one surface, mutually-exclusive states)

The `AiRecPanel` is always present on the dashboard (independently nullable — its own card). It is in
exactly one of these states. Transitions are user-initiated except `stale` (bundle-driven) and
`cooling_down → available` (timer).

```
                          ┌─────────────────────────────────────────────┐
                          │  key-not-configured  (availability off)      │  ← inert in-app; export floor stays
                          └─────────────────────────────────────────────┘
  idle ──[click Get rec]──> loading ──> produced ──[newer bundle]──> stale(produced)
   │                          │            │  └─[Accept]──> Accept dialog (ghost-trade)
   │                          │            └─ no_trade (no Accept)
   │                          └─[error/timeout]──> unavailable ──[Retry]──> loading
   │
   ├─ gate=no_fresh_edge ──> idle(de-emphasized) ──[Override & query]──> loading
   ├─ gate=cooling_down ───> idle(disabled + timer) ──[timer elapses]──> idle(available)
   └─ cap.over_limit ──────> idle(disabled, "daily limit") — export floor stays
```

---

## 3. Component states — full spec (default / loading / stale / offline / empty / error + every PM edge)

### State: `idle` — Available (default, fresh actionable edge)
*When:* `availability.in_app_enabled === true` AND `gate.state === 'available'` AND `!cap.over_limit`
AND no cooldown.
- **Primary action (enabled):** button `Get AI recommendation`.
  - Tooltip: *"Ask the AI for a risk-first entry read on {TICKER}, framed by your active persona and the
    current snapshot. Advisory only — you'll review and explicitly Accept before anything is tracked."*
- **Persona control (per-query override, AC16):** an inline persona select next to the action,
  defaulting to the active persona, labelled `Persona for this read`.
  - Helper caption: *"Defaults to your active persona ({activePersonaName}). Changing it here frames
    this one read only — it doesn't change your active persona and never recomputes any number."*
- **Secondary control (always visible, all states):** text button `View what's sent` → opens the
  Export drawer (§4). Sub-caption near it (de-emphasized): *"Costs nothing — opens the exact export."*
- **Snapshot context line (de-emphasized):** *"Reads the current snapshot, as of {snapshot_iso →
  relative, e.g. '12s ago'}."*

### State: `loading` — "thinking" (AC1, AC2)
*When:* a query is in flight (multi-second).
- Replaces the action region with a determinate-feel spinner + label `Thinking…`.
- Sub-caption: *"Asking the AI for a risk-first read on {TICKER} ({personaForThisRead}). This can take
  a few seconds."*
- **Whole-rec discipline (AC2):** nothing of the rec renders during loading — no partial fields. The
  loading state is replaced atomically by the full `produced`/`no_trade`/`unavailable` state.
- Action is disabled while loading (no double-submit).

### State: `produced` — risk-first rec rendered whole (AC1, AC2, AC3, AC4)
*When:* `rec.status === 'produced'` AND `rec.strategy.decision === 'trade'`.
Render order is **fixed risk-first** (top to bottom):
1. **Provenance header (AC3, AC4):**
   - Persona chip: `Persona · {rec.persona.name}` — tooltip: *"This read was produced by the
     {name} persona. A different persona may read the same snapshot differently."*
   - As-of chip: `As of {rec.as_of → snapshot time}` — tooltip: *"Pinned to the snapshot it was
     generated from. It won't refresh itself — request a fresh read when you want one."*
   - `SIMULATED / advisory` chip — tooltip: *"A read, not an order. Nothing is tracked until you
     Accept and confirm a paper (simulated) trade."*
2. **RISK FIRST block (foremost, visually prominent):**
   - `Max risk` = `rec.strategy.max_risk` — label tooltip: *"The most this plan puts at risk. Judge
     this before anything else."*
   - `Invalidation` = `rec.strategy.invalidation_level` — tooltip: *"The level that says the idea is
     wrong. If price reaches it, the thesis is invalidated."*
3. **Plan block:** `Decision: Trade` · `Bias` · `Structure` · `Strike(s)` · `Expiration` (with caption
   *"within your {min_dte}–{max_dte} DTE window"*) · `Entry trigger`.
4. **Exit block:** `Target` (`exit_plan.target`) · `Stop` (`exit_plan.stop`).
5. **Sizing block:** `Suggested size` = `rec.strategy.position_size` — caption: *"A suggestion. Your
   size is your risk decision — you'll be able to change it on Accept."*
6. **Read context:** `Time horizon` · `Confidence` (chip: low/medium/high) · `Rationale` (free text,
   cites GammaFlow levels).
7. **Actions:** primary `Accept into ghost trade` (→ §5) ; secondary `View what's sent` ; tertiary
   `Dismiss`.
- **Gospel guard (binding):** no copy anywhere says "buy/enter/execute now". The accept verb is
  "Accept into ghost trade".
- **Stale-born sub-state (`rec.stale_born === true`):** a non-blocking warning strip above the
  provenance: *"This read was generated from a snapshot already marked stale ({data_age}). Treat the
  levels with caution."* (Honest live-vs-stale — never presents a stale snapshot as fresh. Distinct
  from the `stale` state below, which is post-generation drift.)

### State: `no_trade` — legitimate outcome, no Accept (AC5)
*When:* `rec.status === 'produced'` AND `rec.strategy.decision === 'no_trade'`.
- Visually **info/neutral, never red** (distinct from `unavailable`).
- Heading: `No trade — sit this one out` with an info icon.
- Body: `rec.strategy.rationale` (the why).
- Same provenance header (persona chip + as-of chip) as `produced` (AC3/AC4 still hold).
- **Accept is ABSENT** (not merely disabled-looking — there is no entry to pre-fill). A caption states:
  *"No entry to Accept — a 'no trade' read is a complete, correct answer."*
- `View what's sent` + `Dismiss` remain.

### State: `unavailable` — AI error/timeout + retry (AC11)
*When:* `rec.status === 'unavailable'` (timeout, LLM error, transient over-cap surfaced as failure).
- Contained, calm, **not a dashboard-wide banner**, not a blank page.
- Heading: `AI unavailable — try again` (warning, not error-red catastrophe styling).
- Body (generic, no stack/leak): *"Couldn't get a read right now. This didn't affect the rest of the
  dashboard."*
- Primary action `Retry` — **respects cooldown + cap**: if a retry would land in cooldown or over-cap,
  Retry is disabled and shows the relevant blocked sub-caption (e.g. *"Retry available in {n}s"* /
  *"Retry available when the daily limit resets {when}"*).
- `View what's sent` stays available (the floor).
- **Isolation guarantee (AC11):** this state changes nothing outside the panel; the GEX chart, the four
  neutral tiles, off-exchange blocks, the ghost-trade tracker, and the live stream keep rendering.

### State: `cooling_down` — cooldown timer (AC9)
*When:* `gate.state === 'cooling_down'` (within the 60s default window after a query).
- Action **disabled** with a visible countdown: button label `Cooling down · {remaining}s`.
- Caption: *"A fresh entry read rarely changes inside a minute, and the data refreshes about every
  60 seconds. Available again in {remaining}s."*
- The countdown decrements; at 0 the state returns to `idle` (Available) and re-enables (AC9).
- An already-rendered `produced`/`no_trade` rec **stays rendered** during cooldown (cooldown gates the
  next query, not the current artifact).

### State: `daily_cap_reached` — resets-when (AC10)
*When:* `cap.over_limit === true`.
- Action **disabled** (calm blocked state, **not an error**).
- Message: `Daily AI limit reached — resets {cap.resets_at → friendly, e.g. "12:00 AM ET"}`.
- Caption: *"You've used today's AI recommendations. The manual export below still works and costs
  nothing."*
- **Export floor explicitly preserved:** `View what's sent` remains fully functional (AC10, AC17).

### State: `no_fresh_edge` — de-emphasized + explicit override (AC8)
*When:* `gate.state === 'no_fresh_edge'` (guardrails: not `ready`, or nothing `changed`).
- The action is **visibly de-emphasized** (muted/outlined, not hidden, not hard-disabled).
- Message: `No fresh edge right now` with a short reason drawn from `ai_eval.reasons` when present
  (e.g. *"score below the actionable threshold"* / *"nothing has changed since the last evaluation"*).
- Caption: *"The guardrails don't see a fresh, actionable edge. You can still ask if you want a read —
  it counts against your cooldown and daily limit."*
- **Explicit override control (AC8):** a secondary, de-emphasized button `Ask anyway` → triggers a
  normal query (→ `loading`). The default presentation discourages it; the override is one tap.
- Tooltip on `Ask anyway`: *"Override the quiet gate and request a read anyway. Still rate-limited."*

### State: `key_not_configured` — inert in-app + manual floor (AC12)
*When:* `availability.in_app_enabled === false` (no key / feature off).
- The in-app `Get AI recommendation` action is **visibly inert** (disabled, muted), with a short
  explanation chip/line: `In-app AI not configured`.
- Caption: *"The in-app AI read isn't available on this deployment. The manual copy-paste hand-off and
  the structured export below still work."*
- **`View what's sent` (Export drawer) + the persona HandoffDialog stay fully functional** (AC12, AC17).
- The rest of the dashboard is untouched.

### State: `stale` — newer bundle arrived (AC6)
*When:* a `produced`/`no_trade` rec is rendered AND a **newer bundle (newer poll)** has arrived — i.e.
the current bundle's `meta.freshness.snapshot_iso` / `ai_eval.state_fingerprint` differs from the
rec's pinned `rec.as_of` / pinned fingerprint.
- The existing rec **stays rendered** (not blanked, not mutated, not re-run) but is **marked stale**:
  - A `Stale` chip overlays the provenance header: `Stale · based on older data`.
  - A strip below the header: *"A newer snapshot has arrived. This read is from {rec.as_of}. Get a
    fresh recommendation when you're ready."* with an inline `Get a fresh recommendation` button (which
    enters the normal gated flow — respects gate/cooldown/cap).
- **No silent refresh / no auto-re-run (AC6):** the rec content is byte-stable; only the stale chrome
  is added. Accept (if a trade rec) remains available but the stale warning is adjacent so the trader
  decides knowingly.

### State: SSE-drop — rec untouched (AC7)
*When:* the live SSE feed drops (the dashboard's `⚠ Live offline` treatment engages on live-derived
tiles).
- The rec panel is a **static artifact, not a live-derived tile**: on an SSE drop it is **completely
  untouched** — not staled, not refreshed, not blanked, no offline chip on the rec, no countdown
  change. It persists exactly as rendered, pinned to its snapshot (AC7).
- (Contrast with the ghost-trade P/L and live tiles, which dim to `⏸ offline` — the rec does NOT.)

---

## 4. Export drawer — the always-available floor (AC17 + egress honesty)

`StateExportDrawer` — opened from `View what's sent` (rec panel) and from the persona `HandoffDialog`
(augmenting today's manual hand-off; the **same** export feeds both the in-app call and the manual path).

- **Header:** `What's sent to the AI · {TICKER}`.
- **Egress-honesty banner (binding copy):** *"This is the complete, reviewable list of what leaves the
  machine for {TICKER}, on demand: the computed snapshot, your persona's prompt, and the field
  glossary. No other ticker, no account or identity, no broker/order data, and no API key ever leave."*
- **Three labelled, copyable sections** (the export's content, per ARCHITECTURE §A — names final in
  INTERFACE_CONTRACT):
  1. `Computed snapshot (context)` — the serialized cached bundle: gamma structure, the four neutral
     reads, vol/anchors, higher-order greeks, dark-pool context (only if present in the bundle),
     signals/tier/gate, the DTE window, and the as-of snapshot identity. Caption: *"A serialization of
     what GammaFlow already computed — no recompute, no new fetch. Null stays null."*
  2. `Persona prompt` — the assembled persona prompt (the persona currently selected for this read).
  3. `Field glossary` — `market_state_glossary.md`, so the AI reads with the reliability order.
- **Controls:** `Copy all` (whole export, for manual paste) + per-section `Copy`. Toast: *"Export
  copied."*
- **Availability:** open/copy works in EVERY rec-panel state including `key_not_configured`,
  `daily_cap_reached`, `unavailable` — it triggers **no in-app call** and costs nothing (AC17).
- **Persona for the export:** mirrors the per-query persona override if one is set, else the active
  persona, so "what's sent" matches the read you'd request.

---

## 5. Accept → ghost-trade pre-fill + mandatory confirm (AC13, AC14, AC15)

`Accept into ghost trade` (present only on a `produced` **trade** rec; absent on `no_trade`, AC5):

- **Opens the existing `TradeEntryDialog` pre-filled** (reuse, not a new entry system). The dialog's
  existing `prefill` seam (`{ expiration, strike, right }`) is extended by the FE-execution lane to also
  seed quantity/stop/target from the rec; **every pre-filled field stays editable** (AC13).
- **Pre-fill mapping (PM Decision 4):**
  | Ghost-trade field | From the rec | Editable? |
  |---|---|---|
  | structure/side (`right`: call/put / long) | `rec.strategy.bias`/`structure` | yes |
  | strike | `rec.strategy.strikes[0]` (nearest available if not listed) | yes |
  | expiration | `rec.strategy.expiration` (within DTE window) | yes |
  | stop | `rec.strategy.exit_plan.stop` ← from invalidation/exit | yes |
  | target | `rec.strategy.exit_plan.target` | yes |
  | suggested size (qty) | derived from `rec.strategy.position_size` | yes — **a suggestion** |
- **Sizing copy (binding — size is the trader's risk decision):** a caption in the dialog when
  AI-prefilled: *"Suggested size from the AI read — change it to fit your risk. Sizing is your call."*
- **Provenance in the dialog:** a small `Pre-filled from AI read · {persona}` chip so the user knows the
  source; the existing `SIMULATED` chip + paper-trade disclaimer remain (AC15).
- **Mandatory confirm (AC14):** **no ghost trade exists until the user confirms** (the dialog's existing
  `Open simulated trade` button). **Cancelling leaves no trade.** This is the shipped confirm path —
  unchanged.
- **Simulated, advisory, no real order (AC15):** the resulting trade is the same `SIMULATED` ghost trade
  as a manual one — same store, same `SIMULATED` labeling, **no auto-execution, no auto-tracking, no
  broker path, ever.** Accept only pre-fills; the user's confirm is the only thing that tracks.
- **Add-cap discipline (PM Decision 4):** the tracker's existing "one open ghost trade per ticker" rule
  applies unchanged — Accept pre-fills an entry; the tracker owns what happens if one is already open.
  This feature does not change that behavior.

---

## 6. AC → component-state mapping (THIS IS THE REQUIRED-TESTS MATRIX)

Each AC maps to the component state(s)/interaction that satisfies it. The FE-execution "Tests to write"
matrix is derived directly from this (every row → ≥1 named passing test; QA traces at GATE Q).

| AC | Requirement (observable) | Component state(s) / interaction that satisfies it |
|---|---|---|
| **AC1** | Trigger → loading → risk-first rec rendered with all fields | `idle(Available)` → `loading` → `produced` (RISK-FIRST block first; full field set) |
| **AC2** | Rec is whole, not partially streamed; loading precedes & is replaced | `loading` (no partial fields) atomically → `produced` |
| **AC3** | Persona attribution on the rec | provenance header persona chip in `produced` + `no_trade` |
| **AC4** | "As of {snapshot}" pin on the rec | provenance header as-of chip in `produced` + `no_trade` |
| **AC5** | `no_trade` rendered as legitimate (distinct from error), no Accept | `no_trade` state (info styling; Accept absent) |
| **AC6** | Newer bundle → rec marked stale, not refreshed/mutated/re-run | `stale` state (chip + strip; content byte-stable; no auto-rerun) |
| **AC7** | SSE drop → rec untouched (not staled/refreshed/blanked) | SSE-drop rule: rec panel completely inert to SSE; persists pinned |
| **AC8** | No-fresh-edge → de-emphasized + "no fresh edge" + override still queries | `no_fresh_edge` state (`Ask anyway` override → `loading`) |
| **AC9** | After a query → disabled + visible cooldown; re-enables after | `cooling_down` state (countdown) → `idle(Available)` |
| **AC10** | Daily cap → disabled + "resets {when}" calm state; export stays | `daily_cap_reached` state (export floor preserved) |
| **AC11** | Error/timeout → "AI unavailable — try again" + retry; rest of dashboard renders | `unavailable` state (Retry respects cooldown/cap; isolation asserted) |
| **AC12** | No key → in-app inert + explanation; manual export still works; dashboard untouched | `key_not_configured` state (Export drawer + HandoffDialog functional) |
| **AC13** | Trade rec → Accept pre-fills entry dialog (side/strike/expiry/stop/target/size), all editable | `produced` → Accept → §5 pre-filled `TradeEntryDialog` |
| **AC14** | No trade created until confirm; cancel leaves none | §5 mandatory-confirm (cancel path asserted) |
| **AC15** | Confirmed Accept → unmistakably `SIMULATED`, no auto-exec, no broker path | §5 result `SIMULATED` (identical-in-kind to manual) |
| **AC16** | Default = active persona; per-query override → rec attributed to that persona; no recompute, active unchanged | `idle` per-query persona select → `produced` attributed; invariance asserted |
| **AC17** | View/copy export without a call; available when in-app unavailable | Export drawer (§4) reachable from every state incl. inert/cap/error |
| **AC18** | Requesting/never-requesting + per-query persona leave score/tier/gate/live tiles identical | invariance across `idle`/`loading`/`produced`/`no_trade` (bundle numbers byte-stable) |

**Edge/invariant cases the FE must ALSO cover (beyond the 18 ACs — promoted invariants × states):**
- E1 — `[best-effort-isolated-or-null]`: a forced rec failure (`unavailable`) leaves GEX chart + tiles +
  ghost-trade + SSE rendering; **no HTTP error reaches the bundle/page** (AC11 deepened).
- E2 — `[live-vs-static-isolation]`: a newer poll staleness (AC6) AND a separate SSE drop (AC7) are
  tested as **distinct** transitions — newer-bundle ⇒ stale; SSE-drop ⇒ untouched.
- E3 — `[additive-keeps-score-byte-identical]`: assert `opportunity_score`/`opportunity_tier`/`ai_eval`
  identical before vs after a query and across a per-query persona override (AC18 deepened).
- E4 — Egress honesty: the export contains ONLY {context, persona prompt, glossary} for the current
  ticker; no key, no other ticker, no identity, no order data (AC17 deepened).
- E5 — Stale-born at generation: a rec produced off an already-`stale` bundle renders the stale-born
  warning at birth (honest-live-vs-stale), distinct from the post-generation `stale` state.
- E6 — Retry-under-gate: `unavailable` Retry is itself disabled when it would land in cooldown/over-cap.

---

## 7. Microcopy / glossary index (single source of user-facing strings)

| Key | String |
|---|---|
| action.get | `Get AI recommendation` |
| action.askAnyway | `Ask anyway` |
| action.retry | `Retry` |
| action.accept | `Accept into ghost trade` |
| action.viewExport | `View what's sent` |
| action.freshRec | `Get a fresh recommendation` |
| loading.title | `Thinking…` |
| produced.riskLabel | `Max risk` / `Invalidation` |
| noTrade.title | `No trade — sit this one out` |
| noTrade.caption | `No entry to Accept — a 'no trade' read is a complete, correct answer.` |
| unavailable.title | `AI unavailable — try again` |
| unavailable.body | `Couldn't get a read right now. This didn't affect the rest of the dashboard.` |
| cooldown.label | `Cooling down · {remaining}s` |
| cap.title | `Daily AI limit reached — resets {when}` |
| cap.caption | `You've used today's AI recommendations. The manual export below still works and costs nothing.` |
| noEdge.title | `No fresh edge right now` |
| noEdge.caption | `The guardrails don't see a fresh, actionable edge. You can still ask if you want a read — it counts against your cooldown and daily limit.` |
| noKey.chip | `In-app AI not configured` |
| noKey.caption | `The in-app AI read isn't available on this deployment. The manual copy-paste hand-off and the structured export below still work.` |
| stale.chip | `Stale · based on older data` |
| stale.strip | `A newer snapshot has arrived. This read is from {as_of}. Get a fresh recommendation when you're ready.` |
| staleBorn.strip | `This read was generated from a snapshot already marked stale ({data_age}). Treat the levels with caution.` |
| provenance.persona | `Persona · {name}` |
| provenance.asOf | `As of {snapshot time}` |
| provenance.sim | `SIMULATED / advisory` |
| export.header | `What's sent to the AI · {TICKER}` |
| export.egress | `This is the complete, reviewable list of what leaves the machine for {TICKER}, on demand: the computed snapshot, your persona's prompt, and the field glossary. No other ticker, no account or identity, no broker/order data, and no API key ever leave.` |
| accept.sizing | `Suggested size from the AI read — change it to fit your risk. Sizing is your call.` |
| accept.prefillChip | `Pre-filled from AI read · {persona}` |
| tooltip.advisory | `A read, not an order. Nothing is tracked until you Accept and confirm a paper (simulated) trade.` |

**Glossary additions (hover tooltips, matching the product's "explanatory hover on every jargon" rule):**
- *Risk-first read* — *"The AI leads with the most you can lose and the level that invalidates the idea,
  before the upside — so you judge it as a plan, not a vibe."*
- *Invalidation level* — *"The price at which the trade idea is wrong and should be abandoned."*
- *As of {snapshot}* — *"The recommendation is frozen to the data snapshot it was generated from. It
  won't update itself; request a fresh one when you want one."*
- *No fresh edge* — *"GammaFlow's guardrails don't currently see a changed, actionable setup. A read is
  still allowed, but discouraged to curb over-trading."*
- *SIMULATED* — *"A paper trade — no broker, no real money, no real order is ever placed."* (reuses the
  shipped `SIMULATED_TIP`.)

---

## 8. Lane guardrails honored (self-check)
- No server internals, no math, no final endpoint/payload schema — only the field NAMES the UI consumes
  (§1), to be typed by the Interface contract.
- Every binding constraint from the PM/Architect is reflected in copy and states: advisory-behind-Accept,
  risk-first, `no_trade` first-class, honest staleness/as-of, SSE-untouched, no-real-order, server-side
  key only, persona canonical + non-scoring, score byte-identical, manual export floor.
