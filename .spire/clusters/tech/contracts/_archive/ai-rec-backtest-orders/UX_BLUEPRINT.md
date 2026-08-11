# ai-rec-backtest-orders — UX_BLUEPRINT

> UX/Tech-Writer → execution split (compressor #3 input). Self-contained against
> `.claude/PROJECT_CONTEXT.md` + this feature's `ARCHITECTURE_CONTRACT.md` (locked shape) +
> `PRODUCT_CONTRACT.md` (locked — 48 ACs, D1–D10). Component states + user-facing copy only:
> no server internals, no math, no code. All wording below (incl. the six D8 disclosures) is
> FINAL and binding on the executioners; `{braces}` are interpolation slots. The §9 map from
> ACs to component states IS the required-tests matrix the FRONTEND_EXECUTION_CONTRACT
> enumerates.

---

## 1. Surface map

| Surface | Where | What it does |
|---|---|---|
| **Act affordance** | `AiRecPanel` action row (Ticker page, `ai-rec` Widget) | Opens the order-creation confirm from a produced TRADE rec. Sits beside the unchanged Accept. |
| **Order-creation confirm** | The ONE shared sim-entry dialog (`trading/TradeEntryDialog`), additive **order variant** | Pre-filled, fully editable plan + the mandatory SIMULATED confirm. Dismiss = nothing created. |
| **Orders widget** | Ticker page bento board (`<Widget id="orders">`) | THAT ticker's orders — the place evaluation is actually live while you watch. |
| **Orders panel** | Positions page, inside the **Simulated** tab, ABOVE the positions view | Management home: every order, every ticker, Open/History, cancel, detail, export. |
| **Order detail** | Dialog from either surface | Plan-as-placed vs the rec's stated plan, provenance, lifecycle timeline, position link. |
| **Position backlink** | Positions row/detail (existing surface) | `trigger fill` entry-basis chip + "From sim order → view order" provenance line. |
| **Scenario picker** | `AiRecPanel`, operator-only, flag-gated | Visible ONLY when the server says scenario mode is ON. Always marked as scripted output. |

Both order surfaces render the SAME `convexa.orders.v1` store — one truth, two scopes (AC-14).

## 2. "Act as sim order" — the affordance on the AI-rec panel

### 2.1 Presence rules (binding — AC-1/2/3)

- **Present** ONLY when the panel is in the `produced` phase AND `strategy.decision === 'trade'`.
  It renders in the existing action row: `[Accept into ghost trade] [Act as sim order] [View
  what's sent] [Dismiss]` — Accept stays first and byte-identical (AC-47).
- **Absent — never merely disabled** — on: a `no_trade` rec (AC-2, mirroring Accept's absence);
  EVERY degraded/unavailable/gated state (`unavailable` incl. all reasons, `gated_off`, the byo
  CTA states, loading, idle, signed-out gate) (AC-3).
- A **scenario-produced trade rec DOES offer Act** (S6 — the operator forward-tests the loop);
  the scripted marking travels with it (§6, D8-4).

### 2.2 Affordance copy

- Button label: **`Act as sim order`** (outlined, secondary to Accept's contained primary).
- Tooltip: *"Creates a simulated order encoding this plan — trigger, limit, stop, target — that
  watches live data and works the entry unattended. No real order, ever."*
- Signed-out / expired-session use: the standard gated-write pattern (D10/D8-6) — prompt text
  **"Sign in to place a simulated order."** Flow aborts; nothing stored; re-initiate after
  sign-in (no auto-resume).

## 3. The order-creation confirm (order variant of the shared sim-entry dialog)

The Act flow opens `trading/TradeEntryDialog` in an additive **order variant** (host-passed
seam). Without the seam the dialog is byte-identical to shipped (protects AC-47/48). Same skin:
400px panel-raised surface (`extrasFor(theme).panelRaised`), uppercase `FieldLabel` idiom,
`SIMULATED` chip, mode-correct dark + light via theme tokens only.

### 3.1 Anatomy (top → bottom) + seeds (D2/D3)

1. **Header:** title **"Simulated order — act on this rec"** + the `SIMULATED` chip + close ✕.
2. **Notice strips** (each only when applicable, in this order):
   - **Scenario strip** (D8-4, scenario-sourced rec): *"Scripted scenario — this plan came from
     the "{scenario name}" scenario, not a real AI read."* (warning-tinted, never red).
   - **Stale strip** (D7/D8-5, newer bundle since the rec's pin): §3.3 wording. Never blocks.
   - **Already-met notice** (D8-2): §3.3 wording. Appears/disappears LIVE as the user edits the
     trigger against the current live mid; shown only when a live mid exists and already
     satisfies the chosen comparator+level.
3. **Provenance line** (read-only): *"From AI read · {persona} · as of {as_of}"* — or
   *"From scripted scenario · {scenario name}"*.
4. **Contract plan** (all editable — D3): Expiration / Strike / Right / Qty. Seeds: the shipped
   Accept seeding (`recToPrefill` rules — first strike, structure→right, `parseQty`, stop,
   target).
5. **Entry trigger section** — label **"ENTRY TRIGGER"**:
   - Comparator select (**Above** / **Below**) + numeric level field.
   - **Seed policy (D2, binding):** pre-seeded ONLY when the rec's `entry_trigger` text states
     ONE explicit numeric level with an unambiguous direction word; the seed carries a chip
     **"Derived from the rec"**. Otherwise both fields start EMPTY with helper: *"The rec didn't
     state a numeric level, so nothing was pre-filled. Set a level, or leave the trigger empty —
     the order then arms immediately as a plain limit / market order."*
   - **The rec's verbatim words are ALWAYS shown** beneath the trigger fields (label **"THE
     REC'S OWN WORDS"**, quoted `entry_trigger` text, or *"— (the rec stated no entry
     trigger)"*). Never hidden while a structured trigger is shown (product constraint §7).
   - Empty-trigger helper (when left empty): *"No trigger — arms immediately and works the
     entry right away."*
6. **Entry price** — a 2-option segmented control replacing the shipped 3-mode control IN ORDER
   VARIANT ONLY: **"Limit"** / **"Market on trigger"**.
   - Limit helper: *"After the trigger, rests at your limit and fills only on a live cross at
     that price. Fill price = the limit."*
   - Market helper: *"After the trigger, fills at the first live-resolvable option mark."*
   - Seed: EMPTY ⇒ default selection **Market on trigger** (the v1 rec schema states no
     contract premium, so there is nothing to seed — honest default; typing a limit price
     switches to Limit).
7. **Stop / Target** (plan data, editable, may be blank) — helper: *"Carried onto the position
   as plan data. Exits stay manual — nothing sells automatically."*
8. **Good-til** — label **"GOOD-TIL"**, date field. Default **min(now + 7 days, contract
   expiration)** (D3). Helper: *"Every order needs a bound. Defaults to 7 days, capped at the
   contract's expiration; the order expires then if it hasn't filled."* Validation (blocks
   confirm): *"Set a good-til date after now and no later than the contract's expiration."*
   Impossible to submit blank/removed (AC-8).
9. **The mandatory SIMULATED disclosure** (D8-1, always visible above the confirm): §3.3.
10. **Confirm button:** **"Place simulated order"** (contained primary). Dismiss/✕/Escape ⇒
    nothing created, Orders surfaces unchanged (AC-7).

### 3.2 Dialog states

| State | Trigger | Presentation |
|---|---|---|
| default (seeded) | rec states one numeric level | Trigger pre-seeded + "Derived from the rec" chip; verbatim text below (AC-5) |
| empty-seed | no parseable level (AC-6) | Trigger fields empty + no-seed helper; verbatim text still shown |
| already-met | live mid already satisfies trigger | D8-2 notice strip; confirm still enabled (AC-9) |
| stale-rec | newer bundle since pin | D8-5 strip; proceed allowed (AC-10) |
| scenario-sourced | rec carries scenario provenance | D8-4 strip + provenance line variant (AC-39) |
| gate-rejected | server 403 on confirm | Standard sign-in prompt (D8-6); dialog flow aborts BEFORE any store write; zero order (AC-11) |
| gate-unavailable | server 503 on confirm | The shipped "couldn't reach sign-in" gate copy; abort, zero order |
| contract-stats degraded | `GET /api/contract` fault | The shipped "contract stats unavailable" caption; plan fields remain editable (per-row isolation) |
| validating | good-til blank/out-of-range, qty < 1, level non-numeric | Inline field errors; confirm disabled |

### 3.3 The six binding disclosures (D8 — final wording, verbatim)

1. **SIMULATED confirm (D8-1):** *"Simulated only — no real order is ever placed. Once
   confirmed, this order can trigger and fill unattended whenever a live stream for {TICKER}
   is open in this browser. Orders are stored in this browser — not synced to your account."*
2. **Already met (D8-2):** *"Condition already met — {TICKER} is already {above|below}
   {level} on live data. This order will trigger on the first live update after you place it."*
3. **Not evaluated (D8-3, the honest coverage state — §4.3):** *"Waiting for live data — not
   currently evaluated"* (visible text), with tooltip: *"No live stream for {TICKER} is open in
   this tab (or the session is closed), so this order cannot trigger or fill right now — and it
   will not catch up on moves it missed. Open {TICKER}'s ticker page during live hours to watch
   it. It can still expire on the clock, and you can still cancel it."* NEVER hidden or
   suppressed on a non-terminal uncovered order.
4. **Scripted-scenario marking (D8-4):** chip **"SCRIPTED SCENARIO"** + strip *"Scripted
   scenario · {name} — deterministic scripted output run through the real rec pipeline. Not a
   real AI read."* Applied end-to-end: rec panel, creation dialog, order rows ("Scripted ·
   {name}" source), order detail, export records.
5. **Stale rec at Act (D8-5):** *"Newer data has arrived since this read was pinned (as of
   {as_of}). The plan below reflects that older snapshot; the trigger still evaluates against
   live data only."*
6. **Sign-in gate on Act (D8-6):** *"Sign in to place a simulated order."* — the app's standard
   gated-write prompt pattern (`useGate`/`SignInPrompt`), server-enforced.

## 4. The Orders surfaces

### 4.1 Order row anatomy (shared by both surfaces)

Each row/card shows, mode-correct and token-only:

- **Contract line:** `{TICKER} {strike}{C|P} · {expiration}` + `×{qty}`.
- **Plan facts:** trigger (*"above {level}"* / *"below {level}"* / *"— none (armed
  immediately)"*), entry price (*"limit ${limit}"* / *"market on trigger"*), stop/target
  (`—` when blank), *"Good-til {date}"*.
- **Status chip** (§4.2) + the relevant timestamp (*placed {time}* / *triggered {time}* /
  *filled {time}* / *cancelled {time}* / *expired {time}*).
- **Source:** *"AI read · {persona}"* or *"Scripted · {scenario name}"* (D8-4).
- **Evaluation reality** (non-terminal rows only, derived at render — §4.3).
- **Actions:** `Details` always; `Cancel order` on `waiting`/`triggered` ONLY (two-step inline:
  first click → the button reads **"Confirm cancel"**, second click cancels; click-away
  resets). NO edit affordance anywhere (D6, AC-22).
- A `SIMULATED` chip on each surface header (reuses `positions/labels` chip + tip) (AC-46).

### 4.2 Lifecycle status set (durable states — labels + tooltips)

| Status | Chip label | Tooltip |
|---|---|---|
| `waiting` | **Waiting** | *"Armed. Waits for {TICKER} to cross the trigger level on live data."* |
| `triggered` | **Triggered · working entry** | limit: *"Trigger crossed. Resting at the ${limit} limit — fills only on a live cross at that price."* · market: *"Trigger crossed. Fills at the first live-resolvable option mark."* |
| `filled` | **Filled** | *"Entry filled — a simulated position was created. Open it from Details."* |
| `cancelled` | **Cancelled** | *"Cancelled by you. Terminal — recreate the order to change a plan."* |
| `expired` | **Expired** | *"The good-til bound (or the contract's own expiration) passed before the entry completed."* |

Terminal chips render de-emphasized (text.secondary tint); `filled` uses the success tint;
none is error-red (an expired sim order is information, not failure). Status changes announce
via an `aria-live="polite"` region on each surface.

### 4.3 Evaluation reality — the derived honest-coverage sub-state (D5/D8-3, load-bearing)

Computed at render, NEVER persisted, NEVER suppressible, on every `waiting`/`triggered` row:

- **Watching:** an open live stream covers the order's ticker in this tab AND the payload is
  live (`isLive && !streamOffline`). Chip **"Watching live"** (live-accent, pulses per the
  board's live-dot idiom, reduced-motion → static). Tooltip: *"A live stream for {TICKER} is
  open in this tab — this order is evaluated in real time."* A live **distance readout** may
  accompany it: `mid {mid} · {Δ} to trigger` (live-derived cell).
- **Not evaluated:** everything else — no stream for that ticker, stream offline/dropped
  (>15s payload gap), session closed/overnight, frozen/stale payloads. Renders the D8-3 text
  + tooltip (§3.3, item 3), warning-tinted, never red, never hidden.
- **Offline dim:** on a stream drop, ONLY the live-derived cells (Watching chip, distance
  readout) dim per the standard `⏸ offline` treatment; the durable row facts (plan, status,
  timestamps) never dim, never blank (`[live-vs-static-isolation]`, AC-26).
- Terminal rows show no evaluation cell (nothing is being evaluated).

### 4.4 Ticker-board Orders widget

`<Widget id="orders" title={"Simulated orders · {TICKER}"} live={watching-any}>`, span 1,
placed directly after the AI-recommendation widget (act → watch reads as one motion), next
`revealIndex` in the board cascade. `live` pulses only while ≥1 of this ticker's orders is
actually Watching.

- **Default:** this ticker's non-terminal orders (compact rows), then a collapsed "Recent
  {n} completed" group (terminal, newest first).
- **Empty:** *"No simulated orders for {TICKER}. Act on an AI read to create one — it watches
  the live tape for the entry."*
- **Loading:** none needed (client-local store, synchronous read) — first paint is real data.
- **Stale/offline:** per §4.3 (row-level; the widget frame itself never dims).
- **Store fault:** §4.6 block inside the widget body.
- Header action: **"All orders →"** (navigates to `/positions`).

### 4.5 Positions-page Orders panel

`Simulated orders` panel INSIDE the Simulated tab, above the positions view (the Live tab
stays the locked placeholder — untouched). Subtitle: *"Rec-driven entries watched against live
data. Paper only — never a real order."*

- **Segmented pill** (the page's existing pill idiom): **Open** (waiting + triggered, default)
  / **History** (filled, cancelled, expired — never dropped, AC-24).
- Shows ALL tickers. Rows for tickers other than this page's focused/streamed one show the
  §4.3 not-evaluated state — that is CORRECT and required, not a bug (D5).
- **Empty (Open):** *"No simulated orders yet. On a ticker page, Act on a produced AI read to
  create one."* **Empty (History):** *"No completed orders yet."*
- Header actions: **"Export JSON"** (client-side download `convexa-orders-{YYYY-MM-DD}.json`:
  all orders + the decision records — the AC-33 audit floor) + the `SIMULATED` chip.

### 4.6 Degraded — orders store fault (AC-29, `[best-effort-isolated-or-null]`)

Corrupt/unreadable `convexa.orders.v1` ⇒ BOTH surfaces show one honest block — title
**"Orders unavailable"**, body: *"This browser's orders storage couldn't be read. Everything
else keeps working — positions, live data, and charts are unaffected, and previously saved
orders were not overwritten."* Positions, ticker page, bundle, SSE all keep working; the
readable prior blob is never deleted/overwritten. The Act confirm ALSO refuses to store into a
faulted store (confirm shows the same title as an inline error; nothing partially written).

## 5. Order detail + provenance/review touchpoints (the rec → order → position walk)

**Order detail dialog** (from `Details`; panel-raised skin):

- **SOURCE:** *"AI read · {persona}"* or *"Scripted scenario · {name} ({scenario_id})"* +
  *"Pinned to {rec_fingerprint} · as of {rec_as_of}"* + **"THE REC'S OWN WORDS"** quoting
  `trigger_source_text` verbatim (AC-30).
- **PLAN AS PLACED:** contract, qty, structured trigger, limit/market, stop/target, good-til —
  the facts the audit compares against the rec's words (edits at creation don't sever this —
  D3).
- **LIFECYCLE:** timeline of placed → triggered → filled/cancelled/expired with timestamps,
  fill mark + basis when filled.
- **Links:** `filled` ⇒ **"View position →"** (navigates to the position on `/positions`);
  cancel action per §4.1 when non-terminal.

**Position side (backlink, AC-31):** a position created by an order fill carries
- the entry-basis chip **`limit fill`** (existing) or the new **`trigger fill`** — tip:
  *"Filled at the first live option mark after the trigger crossed — recorded at fill time,
  never backfilled."*;
- a provenance line in the position's detail/history area: **"From sim order · view order →"**
  (opens the order detail).

**Decision history:** every transition (placed / triggered / filled / cancelled / expired)
appends to the existing append-only decision record surface; a fill also appears in the
position's own history (AC-32). The JSON export (§4.5) joins rec identity → order → position
end-to-end (AC-33).

## 6. Scenario picker (operator-only, flag-gated OFF — D1)

- **OFF (default):** ZERO scenario surface — no picker, no option, no copy, anywhere (AC-34).
  A crafted scenario request renders the panel's standard unavailable handling (AC-35) — no
  special copy.
- **ON** (the status read advertises it): the AI-rec panel shows, beneath the persona select,
  an operator-styled block:
  - Label: **"Scenario (operator)"**; select with default option **"Real AI read (no
    scenario)"** + the catalog by server-provided display name (AC-36).
  - Caption: *"Operator harness — runs a scripted rec shape through the real pipeline:
    keyless, deterministic, consumes no cooldown or caps. Output is always marked as
    scripted."*
  - With a scenario selected, the primary action reads **"Run scenario"** (otherwise the
    shipped "Get AI recommendation"). Cooldown/cap disabled-states do NOT block a scenario run
    (AC-38); the signed-out gate DOES (AC-42); the real readiness gate + "Ask anyway" override
    behave exactly as real (AC-43).
- **Marking (D8-4, end-to-end):** every scenario-produced rec renders the **"SCRIPTED
  SCENARIO"** chip in the provenance row + the §3.3-4 strip; fault scenarios render the
  standard degraded rec state (timeout/error) — contained, bundle/chart/stream untouched
  (AC-40) — plus the scripted marking so the operator knows it was scripted.

## 7. Shared copy inventory (single-sourced in `orders/copy.ts` / additions to `ai-rec/copy.ts`)

All §2–§6 strings above are the binding set. Additional shared strings:

- Panel/widget titles: `Simulated orders` / `Simulated orders · {TICKER}`.
- Actions: `Act as sim order` · `Place simulated order` · `Cancel order` · `Confirm cancel` ·
  `Details` · `Export JSON` · `All orders →` · `View position →` · `view order →` ·
  `Run scenario`.
- Trigger renderings: `above {level}` / `below {level}` / `— none (armed immediately)`;
  entry price: `limit ${limit}` / `market on trigger`; bound: `Good-til {date}`.
- Sources: `AI read · {persona}` / `Scripted · {name}`.
- Glossary tooltip for "trigger" (jargon rule): *"A condition on the UNDERLYING's live NBBO
  mid. When it crosses the level, the order starts working the option entry."*
- Glossary tooltip for "good-til": *"The order's expiry bound. If the entry hasn't completed
  by this date (or the contract itself expires), the order expires — the only thing that can
  happen without live data."*

## 8. Theme & motion rules (binding)

- Token-only: every new surface uses theme tokens / `extrasFor(theme)` (panel-raised dialog
  skin), zero hardcoded hex, correct in dark AND light.
- Motion: status-chip changes may flash per the shipped `useFlashOnChange` idiom, gated
  `isLive && !streamOffline`; the Watching pulse and any reveal/cascade honor
  `useReducedMotion` (reduced ⇒ instant/static). No new animation primitives.
- The Orders widget participates in the board's one-time staggered reveal via `revealIndex`.
- Accessibility: status changes announced via `aria-live="polite"`; the two-step cancel is
  keyboard-operable; chips carry `describeChild` tooltips.

## 9. AC → component-state map (THE required-tests matrix)

| AC | Surface · state(s) that satisfy it |
|---|---|
| AC-1 | §2.1 present-rules: produced-trade panel shows Act beside unchanged Accept |
| AC-2 | §2.1 absent on `no_trade` |
| AC-3 | §2.1 absent across ALL degraded/gated/loading/idle/signed-out states |
| AC-4 | §3.1 items 4–7: seeded + fully editable dialog |
| AC-5 | §3.2 default-seeded: "Derived from the rec" chip + verbatim words |
| AC-6 | §3.2 empty-seed state + immediate-arm path |
| AC-7 | §3.1 item 9 disclosure + dismiss ⇒ nothing created |
| AC-8 | §3.1 item 8: good-til default/cap/validation, never blank |
| AC-9 | §3.2 already-met notice + first-live-update trigger |
| AC-10 | §3.2 stale-rec strip, proceed allowed |
| AC-11 | §3.2 gate-rejected: prompt + abort, zero order |
| AC-12 | §4.1/§4.2 `waiting` row with full plan facts + source + placed time |
| AC-13 | §4.2 trigger-less ⇒ `triggered` immediately, never `waiting` |
| AC-14 | §4.4 (ticker-scoped) + §4.5 (all tickers + history) — same store |
| AC-15 | §4.2 waiting→triggered on live mid cross, status + time visible |
| AC-16 | §4.2 triggered(limit): fills only on live cross at limit; fill price = limit |
| AC-17 | §4.2 triggered(market): first live-resolvable mark recorded |
| AC-18 | §4.2 filled: exactly one position, link set, idempotent (no double fill) |
| AC-19 | §4.1 cancel on `waiting` ⇒ terminal, close time, no position, stops evaluating |
| AC-20 | §4.1 cancel on `triggered` ⇒ terminal, no position |
| AC-21 | §4.2 `expired` off-stream on render/reload (clock-only transition) |
| AC-22 | §4.1 actions: Details + Cancel only; no edit affordance |
| AC-23 | store durability: all states (incl. `triggered`) survive reload |
| AC-24 | §4.5 History: terminal rows never transition, never dropped |
| AC-25 | §4.3 not-evaluated state, always shown, never suppressible |
| AC-26 | §4.3 offline: no transition on mock cross; live cells dim; rows persist |
| AC-27 | §4.3 reconnect: no retro-fill; resumes on new live data only |
| AC-28 | §4.3 frozen/stale/last-known/closed inputs never trigger or fill |
| AC-29 | §4.6 store-fault block; positions/ticker/bundle/stream intact |
| AC-30 | §5 order detail SOURCE block (fingerprint/persona/scenario + verbatim words) |
| AC-31 | §5 two-way links: order "View position →" + position "view order →"/basis chip |
| AC-32 | §5 decision history per transition; fill in the position's history too |
| AC-33 | §4.5 Export JSON joins rec → order → position |
| AC-34 | §6 OFF: zero scenario surface |
| AC-35 | §6 OFF + crafted request: standard unavailable handling (BE refusal token) |
| AC-36 | §6 ON: picker lists the D2 catalog by name |
| AC-37 | BE proof (keyless produced) — FE renders the produced rec normally |
| AC-38 | §6 ON: cooldown/cap states don't block Run scenario; counters unchanged (BE proof) |
| AC-39 | §3.2 scenario-sourced dialog + §4.1 source + §5 detail/export marking |
| AC-40 | §6 fault scenario ⇒ contained degraded rec state, page intact |
| AC-41 | BE determinism proof |
| AC-42 | §2.2/§6 signed-out ⇒ sign-in gate, never a scenario rec |
| AC-43 | §6 real readiness gate + override, unchanged (BE proof + panel gate states) |
| AC-44 | structural: orders feed no request/scoring input; bundle calls unchanged (+ BE proof) |
| AC-45 | BE byte-identity proof (flag on/off, selected/not) |
| AC-46 | SIMULATED labeling on §3/§4/§5; no broker affordance; Live tab untouched |
| AC-47 | §2.1 Accept path byte-identical with Orders present |
| AC-48 | shipped limit mode still creates a `pending` Position; existing pendings untouched |
