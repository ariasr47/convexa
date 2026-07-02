# ai-rec-backtest-orders — PRODUCT_CONTRACT

> PM → UX/Tech-Writer handoff (compressor #2 form). Self-contained against
> `.claude/PROJECT_CONTEXT.md` + this feature's `ARCHITECTURE_CONTRACT.md` (the locked technical
> shape — respected, not re-scoped here). Decisions, not deliberation. Product layer only: no
> code, no endpoints, no payload/field names, no UI layout. Every AC below is observable by a
> person driving the app and is the REQUIRED behavioral test the executioners must cover and QA
> traces at GATE Q.

---

## 1. Goal (derived from the ARCHITECTURE_CONTRACT)

Make the in-app AI recommendation **actionable** and **testable**, simulation-only:

- **Act on a rec as a simulated order.** A produced trade rec gains an "Act" path that creates a
  SIMULATED order encoding the rec's plan (conditional entry trigger on the underlying, optional
  limit price, stop/target carried as plan data, a good-til bound). The order is watched against
  LIVE data only and, on trigger + fill, becomes a position in the existing Simulated portfolio.
  The shipped pre-filled-dialog Accept stays unchanged as the manual, immediate path; an order is
  the automated-bookkeeping path.
- **Scenario harness for backtesting rec quality.** An operator-gated, keyless, deterministic
  scripted-scenario mode drives the REAL rec pipeline with every answer shape the tool can produce
  (trades, conditional entries, no-trade, provider faults) at zero LLM cost — so the operator can
  exercise every rec shape on demand and audit, via the provenance chain (rec → order → position)
  and the exportable decision records, whether following the AI would have paid.

**No real order, ever.** Everything here is sim bookkeeping behind a mandatory confirm.

## 2. Users & stories

Two roles: the **trader** (the app's user; sign-in required for order-creating writes) and the
**operator** (owner/dev running a deployment).

- **S1 — Act without babysitting (trader):** As a trader, when the AI gives me a conditional plan
  ("long call on a break of X"), I want to accept it as a simulated order that watches the live
  tape for me, so the entry executes per the plan while I keep the app open on that ticker —
  without me staring at the level.
- **S2 — The manual path stays (trader):** As a trader, I can still Accept a rec into the
  pre-filled, editable entry dialog exactly as today when I want to enter immediately and by hand.
- **S3 — Watch & manage orders (trader):** As a trader, I want one place to see every simulated
  order — its plan, its current state, when it was placed/triggered/filled — and to cancel any
  order that hasn't filled.
- **S4 — Honest coverage (trader):** As a trader, I want to KNOW when an order is not actually
  being watched (no live stream open for its ticker, stream offline, market closed/overnight), so
  I never believe an entry is being worked when it isn't.
- **S5 — Review outcomes (trader):** As a trader, I want to trace any position back to the order
  that filled it and the rec that proposed it (including the rec's own words for the trigger), and
  export the record, so I can audit fills against the AI's stated plan.
- **S6 — Backtest the AI for free (operator):** As the operator, I want to flip on a scripted
  scenario mode (off by default), pick any rec shape by name, and run it through the REAL rec
  pipeline keyless and without burning cooldown/caps — then Act on it and watch it forward-test on
  live data — so I can evaluate rec quality and the whole read→act→review loop without LLM spend.
- **S7 — Exercise every degraded shape (operator):** As the operator, I want fault scenarios
  (provider timeout / provider error) selectable like any other, so every degraded rec state the
  trader could see is reproducible on demand.

## 3. Scope

### In (v1)

- "Act on this rec" on a **produced trade rec** (real or scenario) → order-creation dialog
  (pre-filled from the rec, fully editable) → mandatory SIMULATED confirm → server sign-in gate →
  a durable simulated order.
- The v1 trigger grammar exactly as locked (the ceiling): **one condition — underlying above or
  below one numeric level** — plus optional limit price, stop/target carried as plan data, and a
  mandatory good-til bound. Trigger-less orders act as plain resting-limit / market orders.
- A new **Orders surface**: on the **Positions page** (all orders, all tickers, incl. terminal
  history — the management home) and on the **Ticker page widget board** (that ticker's orders,
  where evaluation actually runs while you watch). Placement decision + coverage story: §4-D5,
  §5.2.
- The observable lifecycle: `waiting → triggered → filled` plus `cancelled` and `expired`, with
  the derived honest "waiting for live data — not currently evaluated" state whenever no live
  stream covers the order's ticker.
- Fill into the existing Simulated positions portfolio (one position per fill; stop/target carried
  onto the position as plan data).
- Provenance end-to-end: rec fingerprint / persona / scenario id / the rec's verbatim trigger text
  on the order; two-way order ↔ position linkage; append-only decision records at every
  transition; client-side JSON export of orders + decision records (the v1 backtest/audit floor —
  forward-test only).
- The backend scripted **scenario mode**: server flag, default OFF; when ON, an in-app scenario
  picker on the rec panel; keyless; consumes no cooldown/cap/allowance; deterministic; scenario
  provenance marked end-to-end; fault scenarios included. Catalog: §4-D2.

### Out (v1) — binding (from the ARCHITECTURE_CONTRACT non-goals; do not reintroduce)

- Any real order / broker / execution path (the Positions "Live" tab stays a locked placeholder).
- Everything the trigger grammar names OUT: multi-condition confluence (AND/OR), hold/confirmation
  qualifiers, cross-from-the-other-side edge detection, non-price conditions (flow/tier/IV/volume/
  session), option-price triggers, trailing/OCO/bracket, retrigger/repeat, short side, multi-leg.
- Stop/target **automation** — carried as plan data only; exits stay the existing manual/
  reassessment surface.
- Server-side order store/endpoints; headless/background evaluation; per-order stream fan-out;
  cross-tab coordination; account-scoped order sync (orders are "stored in this browser").
- Historical recorded-state replay (v1 backtesting is forward-test only).
- A named "backtest run" entity (runs are derived groupings over the exported records).
- **Manual order creation from the Orders surface** (PM call): v1 orders are born ONLY from the
  Act-on-rec flow. The existing entry dialog keeps its manual/market/limit modes unchanged.
- Post-placement editing of an order (cancel-and-recreate only).
- Auto-creation of any order without an explicit, confirmed user action; any Act path on a
  no-trade or degraded/unavailable rec.
- Migration or rerouting of existing pending limit Positions (the two mechanisms coexist, §4-D4).

### Future-dated (design-for seams — do not preclude, do not build)

- Richer trigger grammar (the named v2+ extensions above).
- Server-side/account-scoped order store + headless evaluator (after the client→server store
  migration seam; deliberate GATE-Z discussion required).
- Recorded-state replay backtesting (the deterministic scenario provider + pure engine transitions
  are preserved FOR that seam).
- Named backtest runs / in-app outcome analytics over the decision log.
- Stop/target automated exits (its own feature with its own live-cross rules).
- Manual order creation from the Orders surface (the provenance shape already allows it).

## 4. Product decisions made here (resolves ARCHITECTURE_CONTRACT §12, in order)

- **D1 — Scenario surface + exposure (§12.1):** Scenario mode is an **operator/dev tool**: a
  server env flag, **default OFF**. When ON, the rec panel shows an **in-app scenario picker**
  that lists the registry's scenarios by human-readable name (a picker you can't enumerate is
  useless for the operator). When OFF: **zero scenario surface anywhere** — no picker, no mention,
  and a crafted scenario-selecting request gets the contained refusal (never a paid LLM call).
  **No production-store refusal coupling** (unlike the demo-account seed): scenario mode touches
  no persistent store; the default-off flag plus the mandatory end-to-end "scripted scenario"
  marking (D-honesty, §7) is the safety boundary.
- **D2 — Scenario catalog + trigger-seed policy (§12.2):** Catalog = the locked coverage floor
  **plus** three product additions, so every Act-flow edge is drivable: (1) long-call trade with
  entry/stop/target; (2) long-put trade; (3) conditional entry on a break **above** a level;
  (4) conditional entry on a break **below** a level; (5) a trade rec whose trigger text has **no
  parseable numeric level** (exercises the empty-seed path); (6) a trade rec whose condition is
  **already met** at placement (exercises the already-met notice); (7) no-trade; (8) provider
  timeout fault; (9) provider error fault. Scenario names/copy = UX lane. **Seed policy:** a
  proposed structured trigger is pre-seeded ONLY from an explicit numeric level the rec itself
  states (high confidence); never inferred from prose alone. No high-confidence level ⇒ the
  trigger field starts **empty** (the user may leave it empty — order arms immediately — or set
  one manually). A seed is always labeled as derived from the rec, always editable, and never
  armed without the user seeing it in the confirm dialog; the rec's verbatim trigger text is
  displayed alongside.
- **D3 — Order defaults + editability at creation (§12.3):** Good-til default = **7 calendar days
  from placement, capped at the order's contract expiration date**; editable at creation within
  (now → contract expiration]; can never be blank/removed (every order carries a bound). Quantity
  default = the same seeding rule the existing Accept pre-fill uses (from the rec when it states
  size, else 1; minimum 1). When the rec states an entry price for the contract, it seeds the
  **limit price**; the user may clear it (= market-on-trigger) or edit it. **All plan fields are
  editable at creation** (contract, qty, trigger, limit, stop, target, good-til); edits do not
  sever provenance — the audit's whole point is comparing plan-as-placed vs the rec's stated plan.
- **D4 — Plain-limit routing (§12.4):** **Coexist.** The existing entry dialog's limit mode keeps
  creating a `pending` Position exactly as shipped; the Orders path is reserved for rec-driven
  acting in v1. No migration of existing pending positions in either direction.
- **D5 — Orders placement (§12.5, determines evaluation coverage):** **Both surfaces.** The
  **Positions page** hosts the full management surface (every order, every ticker, terminal
  history, cancel); the **Ticker page widget board** gains an Orders widget scoped to that ticker.
  Honest consequence, owned as product behavior: an order is evaluated **only while this browser
  tab has a live stream open for its ticker** — the Ticker page for that ticker, or the
  Positions/Orders surface while that ticker is its focused/streamed one — during live data hours.
  Everywhere else (other tickers on the Positions list, closed tab, offline stream, overnight/
  closed session) the order is **not evaluated, cannot trigger, cannot fill — and must say so**
  (the "waiting for live data — not currently evaluated" state). Keeping the order's ticker page
  open is how a trader "works" an order in v1; the spec never implies background execution.
- **D6 — Post-placement edits (§12.6):** **Cancel-and-recreate only.** No edit affordance on a
  placed order; management actions are view detail + cancel.
- **D7 — Acting on a stale rec (§12.7):** **Allowed, with a visible disclosure** in the creation
  dialog (newer data has arrived since this rec was pinned). Never blocked — the trigger
  re-validates against live data anyway, and provenance pins the rec's fingerprint/as-of
  regardless.
- **D8 — Copy set (§12.8; scoped here, written by UX):** Six binding disclosures must exist:
  (1) the mandatory-confirm SIMULATED disclosure at creation — must state: simulated only / no
  real order; that once confirmed the order can trigger and fill **unattended later** while a
  live stream is open; and that orders are stored in this browser (not account-synced);
  (2) "condition already met at placement" — shown whenever the chosen trigger is already
  satisfied by the current live value, warning it will trigger on the first live update;
  (3) "waiting for live data — not currently evaluated" — on every non-terminal order lacking a
  live stream; may never be hidden or suppressed;
  (4) scripted-scenario marking on every scenario-sourced rec, order, and downstream display —
  never mistakable for a real AI read;
  (5) the stale-rec disclosure at Act (D7);
  (6) the sign-in prompt on a gated Act (D10) — reuse the app's existing gated-write prompt
  pattern.
- **D9 — Interface-split items (§12.9):** Delegated to the UX/interface lane as the architect
  assigned (scenario-selector transport name, scenario-provenance fields, the refusal token, the
  final flag name) — with these behavioral constraints binding: the flag defaults OFF; a
  scenario-selecting request while OFF gets a **contained, non-produced refusal** in the existing
  unavailable-family semantics (never a silent fall-through to a paid LLM call, never a crash);
  scenario provenance must survive end-to-end so D8(4) can render everywhere.
- **D10 — Sign-in framing for Act (§12.10):** Act inherits the app's standard gated-write UX: the
  affordance is visible, and on use by an anonymous/expired session the server gate rejects, the
  standard sign-in prompt appears, the flow **aborts before anything is stored** (zero order
  created). After signing in the user re-initiates Act; no auto-resume of the aborted creation.
  (In practice a rec on screen implies a session existed — the gate matters for expired sessions
  and bypassed clients; the server remains the boundary of record.)

**Amendments bounced to Architect: none.** Every §12 answer above fits inside the locked shape.

## 5. Product behavior spec

### 5.1 Acting on a rec

- Only a **produced trade rec** offers Act (label/affordance = UX). No-trade recs and every
  degraded/unavailable rec state offer no Act path. Accept (the pre-filled immediate-entry dialog)
  remains beside it, byte-for-byte the shipped behavior.
- Act opens the order-creation dialog: contract + qty + stop/target + limit pre-filled from the
  rec per D3; the proposed trigger pre-seeded per D2 (or empty); the rec's verbatim trigger text
  shown for comparison; stale disclosure when applicable (D7); already-met notice when applicable
  (D8-2). Everything editable. Confirm is mandatory and SIMULATED-labeled (D8-1); dismissing
  creates nothing. Confirmation passes the server sign-in gate first (D10) and only then stores
  the order.

### 5.2 The Orders surfaces + the honest coverage story

- A confirmed order appears immediately: `waiting` if it has a trigger, `triggered` (working the
  entry) if trigger-less. Each row/entry shows the plan facts (contract, trigger, limit or
  market-on-trigger, stop/target, good-til), its status with timestamps, its source (AI rec /
  scripted scenario — marked per D8-4), and its current evaluation reality: evaluating live vs
  "waiting for live data — not currently evaluated."
- Positions page = the management home (all orders, all tickers, terminal history, cancel).
  Ticker page widget = that ticker's orders while you watch it — the place evaluation is actually
  live. The surfaces present the SAME orders (one store, one truth).
- Coverage honesty (D5) is a first-class behavior, not fine print: whenever no open live stream
  covers an order's ticker — other pages, dropped stream, closed/overnight session — the order
  visibly reads as not evaluated. It can still expire on the clock (the only off-stream
  transition) and can still be cancelled.

### 5.3 The lifecycle a trader observes

- **waiting → triggered:** the first live underlying update satisfying the trigger condition
  (including the first update after placement if already met). **triggered → filled:** with a
  limit — only a live cross at the limit price, fill recorded at the limit; without — the first
  live-resolvable option mark. Trigger and fill may land on the same live update; both facts are
  still shown. A fill creates exactly one position in the Simulated portfolio, carrying qty and
  stop/target as plan data; the order links to it and the position links back.
- **cancelled:** user action, available from waiting and triggered; terminal; no position.
- **expired:** the good-til bound (or the contract's own expiration) passes; applies even with no
  stream open; terminal; no position.
- Nothing ever fires off frozen/stale/last-known/offline data or a bundle snapshot, and nothing
  retro-fills after a reconnect — if the level crossed while no live stream was up, the order
  simply remains waiting. Orders and their statuses survive reload; terminal states never
  transition again.

### 5.4 Provenance & outcome review (the v1 backtest record)

- Every order permanently records where it came from: the rec's fingerprint + as-of + persona (or
  the scenario id), and the rec's verbatim trigger text. Every transition (placed / triggered /
  filled / cancelled / expired) appends a decision record to the existing append-only decision
  history. Orders + decision records are exportable client-side as JSON; the exported data joins
  end-to-end rec → order → position, so "did following the AI pay?" is answerable offline from the
  export (v1's audit floor — forward-test only, no named runs).

### 5.5 Scenario mode (operator)

- OFF (default): invisible — no picker, no scenario copy anywhere in the trader UI; a crafted
  scenario-selecting request is refused contained (D9).
- ON: the rec panel shows the picker (D1) listing the D2 catalog by name. A selected scenario runs
  the REAL rec pipeline — sign-in gate outermost, real readiness gating and override behavior —
  keyless, and neither consumes nor is blocked by cooldown/daily-cap/admin allowance. The output
  is deterministic for the same scenario against the same (cached/unchanged) bundle. Fault
  scenarios reproduce the standard degraded rec states, bundle/live untouched. Every
  scenario-sourced rec — and any order and position descending from it — is marked scripted
  end-to-end (D8-4). Non-scenario requests behave byte-for-byte as shipped.

## 6. Acceptance criteria

Each AC = one observable behavior = one required test. Observe by driving the app (with the
project's standard controllable mock at the network boundary where live conditions must be
forced); no code reading required.

### A. Acting on a rec (creation flow)

- **AC-1** A produced trade rec shows an "Act as simulated order" affordance ALONGSIDE the
  existing Accept; choosing Accept still opens the shipped pre-filled entry dialog, unchanged.
- **AC-2** A no-trade rec offers no Act affordance.
- **AC-3** Every degraded/unavailable rec state (gated-off, cooldown, cap, no-key, provider fault,
  auth-required, etc.) offers no Act affordance.
- **AC-4** Act opens a creation dialog pre-filled from the rec (contract, qty per the existing
  Accept seeding rule, stop/target, limit from the rec's stated entry price when present); every
  plan field is editable before confirm.
- **AC-5** When the rec states an explicit numeric trigger level, the dialog shows a pre-seeded
  structured trigger, labeled as derived from the rec, editable — and the rec's verbatim trigger
  text is displayed alongside it.
- **AC-6** When the rec's trigger text has no parseable numeric level, the trigger field starts
  empty (nothing guessed); the user can proceed with no trigger (the order arms immediately as a
  plain limit/market order) or set one manually.
- **AC-7** No order exists until the explicit confirm: the dialog is SIMULATED-labeled, discloses
  the later unattended fill and stored-in-this-browser facts, and dismissing/cancelling it creates
  nothing (Orders surface unchanged).
- **AC-8** The good-til bound is always present: pre-filled to 7 days capped at the contract's
  expiration, editable at creation, and impossible to submit blank/removed.
- **AC-9** When the chosen trigger condition is already satisfied by the current live value, the
  dialog shows the "condition already met" notice before confirm; proceeding yields an order that
  triggers on the first live update after placement.
- **AC-10** Acting on a stale rec (newer data since its pin) shows a visible stale disclosure in
  the creation dialog; the user may still proceed.
- **AC-11** With no valid session (anonymous or expired), confirming Act produces the standard
  sign-in prompt and aborts: zero order is created, nothing is stored, and the rejection is
  server-enforced (a bypassed client check is still rejected).

### B. Orders surface & lifecycle

- **AC-12** A confirmed order with a trigger appears immediately in the Orders surface as
  `waiting`, showing its plan facts (contract, trigger, limit or market-on-trigger, stop/target,
  good-til), its placement time, and its source.
- **AC-13** A confirmed order with no trigger appears immediately as `triggered` (working the
  entry), never as `waiting`.
- **AC-14** The Positions page shows ALL orders across tickers (incl. a terminal history:
  filled/cancelled/expired); the Ticker page's Orders widget shows that ticker's orders; both
  reflect the same underlying orders consistently.
- **AC-15** With a live stream open for the order's ticker, a live underlying update crossing the
  trigger level moves the order `waiting → triggered`, visibly (status + trigger time).
- **AC-16** A `triggered` order with a limit price fills ONLY when the live option mark crosses
  the limit; the recorded fill price is the limit price.
- **AC-17** A `triggered` order without a limit (market-on-trigger) fills at the first
  live-resolvable option mark, which is recorded as the fill price.
- **AC-18** A fill creates exactly ONE new open position in the existing Simulated portfolio
  (qty, stop, target carried as plan data); the order reads `filled` and links to that position;
  continued live updates create no duplicate position and no second fill.
- **AC-19** Cancelling a `waiting` order marks it `cancelled` (terminal) with a close time; no
  position is created; it no longer evaluates.
- **AC-20** Cancelling a `triggered`, not-yet-filled order likewise ends it `cancelled` with no
  position.
- **AC-21** An order whose good-til bound has passed reads `expired` (terminal, no position) —
  including when NO live stream is open for its ticker (clock-only transition; observable on next
  view/reload).
- **AC-22** A placed order offers no edit affordance — only view detail and cancel (change =
  cancel and recreate).
- **AC-23** Orders and their statuses survive a full page reload — including a `triggered`,
  unfilled order remaining `triggered`.
- **AC-24** Terminal orders (`filled`/`cancelled`/`expired`) never change state again, and remain
  visible in the history view.

### C. Honest coverage & degraded states

- **AC-25** A non-terminal order whose ticker has NO open live stream (other page, no focused
  stream, session closed) visibly shows the "waiting for live data — not currently evaluated"
  state; the state is never hidden or suppressed.
- **AC-26** With the stream offline/dropped, a trigger level being crossed (driven via the mock)
  causes NO transition: the order stays `waiting`, shows not-evaluated, live-derived cells dim per
  the standard offline treatment, and the durable order rows never blank.
- **AC-27** After the stream reconnects, there is no retro-fill/catch-up: a cross that happened
  only during the outage leaves the order `waiting`; evaluation resumes on new live data only.
- **AC-28** Frozen / stale / last-known / overnight-closed values never trigger or fill an order
  (driven via mock closed-session/stale payloads).
- **AC-29** If the browser-local orders storage is corrupted (e.g., mangled by hand in devtools),
  the Orders surface shows an honest unavailable/empty state while the Positions portfolio, the
  Ticker page, the bundle, and the live stream keep working; previously readable positions data is
  untouched.

### D. Provenance & audit

- **AC-30** An order's detail shows its provenance: the rec's fingerprint + as-of + persona (or
  the scenario identity for a scripted rec) and the rec's verbatim trigger text.
- **AC-31** From a filled order the created position is reachable, and from that position its
  originating order is identifiable (two-way linkage observable in the UI and/or the export).
- **AC-32** Every order transition (placed / triggered / filled / cancelled / expired) appends a
  decision record visible in the decision history/export, and a fill also appears in the
  position's own history.
- **AC-33** Orders + decision records are exportable client-side as JSON; the exported data joins
  the full chain (rec identity → order → position) for offline analysis.

### E. Scenario harness (operator)

- **AC-34** With the scenario flag OFF (the default), ZERO scenario surface is visible anywhere in
  the app — no picker, no scenario option, no scenario copy.
- **AC-35** With the flag OFF, a hand-crafted scenario-selecting request receives the contained
  unavailable-family refusal — never a real (paid) LLM call, never a crash/blank; the rec panel
  shows the standard unavailable handling.
- **AC-36** With the flag ON, the rec panel shows a scenario picker listing, by name, at least the
  D2 catalog: long-call trade, long-put trade, break-above conditional, break-below conditional,
  unparseable-trigger trade, condition-already-met trade, no-trade, timeout fault, provider-error
  fault.
- **AC-37** A selected scenario produces a rec with NO AI key configured anywhere (keyless
  deployment) — the whole point of the harness.
- **AC-38** A scenario request neither consumes nor is blocked by the cooldown, the daily cap, or
  the admin free allowance (counters/cooldown in the status readout are unchanged by scenario
  calls, and an exhausted allowance does not stop one).
- **AC-39** A scenario-produced rec is visibly marked as scripted (never mistakable for a real AI
  read), and an order created from it — and its detail and export records — carry the scripted
  marking end-to-end.
- **AC-40** Selecting a fault scenario (timeout / provider error) reproduces the same degraded rec
  state the real fault produces, contained: bundle, chart, and live stream unaffected.
- **AC-41** Requesting the same scenario twice against the same (unchanged/cached) bundle yields
  identical rec content (determinism).
- **AC-42** A logged-out scenario request is rejected as sign-in-required (the auth gate stays
  outermost) — never answered with a scenario rec.
- **AC-43** Real readiness gating behaves identically in scenario mode: a not-ready ticker without
  override refuses a scenario rec exactly like a real one, and the override works exactly as real.

### F. Invariants & coexistence

- **AC-44** With orders present in every state (waiting/triggered/filled/cancelled/expired), the
  ticker's score, opportunity tier, and state fingerprint are byte-identical to the no-orders
  baseline — observable via the state export / fingerprint readout the app already provides.
- **AC-45** Scenario mode ON vs OFF, and scenario-selected vs not, leave score / tier / state
  fingerprint byte-identical (same observation method as AC-44).
- **AC-46** The Orders surfaces, the creation dialog, and order details all carry simulated
  labeling, and no broker/real-order affordance exists anywhere in the feature (the Positions
  "Live" tab remains the locked placeholder).
- **AC-47** The existing Accept flow is unchanged end-to-end: Accept → pre-filled dialog →
  confirmed simulated position, exactly as shipped, with Orders present.
- **AC-48** The existing entry dialog's limit mode still creates a `pending` Position (not an
  order), and previously existing pending positions are untouched by this feature.

## 7. Product-level constraints the next roles must not violate

- **`[no-real-order-path]`** — SIMULATED end-to-end; mandatory confirm at order creation (the
  confirm covers the later unattended fill); zero broker/execution affordance; the Live tab stays
  locked. Reopening = owner + vendor decision via GATE Z.
- **`[server-side-gate-enforcement]`** — order creation is sign-in gated at the server before
  anything is stored; the in-app prompt is UX, not enforcement. The rec request keeps its auth
  gate outermost, scenario mode included.
- **`[additive-keeps-score-byte-identical]`** — orders, the engine, and scenarios are never
  presented as, nor are, inputs to score/tier/gate/fingerprint; byte-identity is proven (AC-44/45).
- **`[live-vs-static-isolation]`** — never present a frozen/stale/offline value as live
  evaluation; live-derived cells dim on drop; durable order records never blank; no trigger/fill
  ever off non-live data; clock expiry is the only off-stream transition.
- **`[best-effort-isolated-or-null]`** — an orders fault degrades only the Orders surface; a
  scenario fault degrades only that rec response; bundle/positions/stream stay intact.
- **Honesty set (binding presentation rules; wording = UX):** the not-evaluated state is always
  shown, never suppressible (D8-3); scenario origin is always marked, end-to-end (D8-4); the
  stale-rec and already-met disclosures appear at creation (D7, D8-2); the rec's verbatim trigger
  text is always visible where the structured trigger is shown; a parsed trigger is never armed
  without the user seeing it in the confirm dialog; orders disclose "stored in this browser."
- **No Act on no-trade or degraded recs; no auto-created orders, ever** — Act is always an
  explicit, confirmed user action.
- **Do not re-scope the technical shape:** the v1 trigger grammar is a ceiling; the exclusion
  list in Scope-Out is binding on UX and the executioners alike.

## 8. Delegated to the UX/interface lane (scoped here, decided there)

- **Copy** for the six D8 disclosures + all labels/microcopy (Act affordance naming, status
  wording, scenario names, picker copy).
- **Interface-split items (per D9, with its behavioral constraints):** the scenario-selector
  transport name, the scenario-provenance fields on the rec response, the refusal token for
  scenario-selected-while-disabled, and the final server flag name (default OFF).
- **Presentation** of the Orders widget/board integration, order detail, history, and the
  evaluation-state treatment — within the placement + honesty rules fixed in D5/D8.
