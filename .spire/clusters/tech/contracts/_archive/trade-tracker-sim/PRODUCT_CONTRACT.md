# PRODUCT CONTRACT — Ghost-Trade Tracking & Management · AI Reassessment · Opportunity Escalation

> Producer: Product Manager (FIRST role — PM-first entry, **no Architect yet**).
> Consumer: Architect (next session) — who writes ARCHITECTURE_CONTRACT.md, answers the
> "Feasibility questions" below, and bounces any un-buildable acceptance criterion back here.
> Input: GAMMAFLOW_CONTEXT.md + OPEN_THREADS.md. No chat history.
> Lane: user value, scope, dashboard behavior, acceptance criteria. **No code, math, data
> structures, endpoints, payload/field names, or UI layout** — those are downstream.

## Feature & user value
Today GammaFlow tells a swing trader *where the edge is* (GEX structure, vol context, an
opportunity score, an external-AI gate). It does **not** help once they act. This feature closes the
loop: the user can **open a simulated ("ghost") option trade** — no broker, no real money — and the
dashboard **tracks it live** (running %/$ gain-loss + the contract's current stats), lets them
**ask the downstream AI to reassess the open trade's health** and **accept or reject** the AI's
recommendation (applied to the ghost position), and **alerts them when something material changes**
that warrants a rethink. The **Opportunity score** is upgraded from a passive number into a
**tiered, attention-scaling signal** that, at its top tier, surfaces a guided prompt to open the
simulated trade.

Net value: a complete *find edge → simulate the trade → manage it with AI → learn from the
outcome* loop, **risk-free**, that later swaps the simulation for a real broker connection
(future-dated, not this phase). Crucially it is built to **respect the over-trading guard** that
runs through the whole product — emphasis and alerts are disciplined and de-duped, not a firehose.

## User stories
**Tracking a ghost trade**
- As a swing trader, I want to **open a simulated long option** (pick the contract — expiry, strike,
  call/put — at the current price) so I can track an idea as if I'd bought it, without real risk.
- As a swing trader, I want to see the trade's **running % and $ gain/loss** update as price moves,
  so I always know where the position stands.
- As a swing trader, I want the trade panel to show the **contract's current stats** (price, the
  contract greeks/IV, DTE left, where its strike sits vs spot / walls / flip) so I can read its
  health at a glance.
- As a swing trader, I want my tracked trade to **survive a page reload and a live-feed blip** so I
  don't lose the position I'm following.
- As a swing trader, I want the P/L to be **honestly marked stale when the market is closed /
  overnight** (no live option price), never a frozen number pretending to be live.

**AI reassessment + accept/reject**
- As a swing trader with an open ghost trade, I want a **"Reassess this trade"** action that asks the
  downstream AI to judge the *current* position's health (not just whether there's a fresh entry).
- As a swing trader, I want the AI's answer as a **clear, risk-first recommendation** (hold / trim /
  add / exit / roll) that I can **accept** (it's applied to my ghost position) or **reject** (left
  as-is) — and either way it's **recorded** so I can compare what I did vs what the AI said.
- As a swing trader, I never want a recommendation **auto-executed** — the AI suggests, I decide.

**Event alerts**
- As a swing trader, I want to be **alerted while a trade is open** when something material happens
  (price crosses a wall or the flip, the opportunity tier changes, P/L hits a target/stop level,
  expiration is approaching) so I know *when* to reassess.
- As a swing trader, I want each alert to fire **once per event**, not repeat every refresh, so the
  dashboard stays trustworthy and I'm not nagged into over-trading.

**Opportunity escalation**
- As a swing trader, I want the **Opportunity score to visibly escalate** — quiet when there's no
  edge, increasingly prominent as it rises — so a real setup grabs my attention without me staring.
- As a swing trader, I want a **guided "simulate this trade" prompt** to appear only when the
  opportunity reaches its top tier and the setup is genuinely actionable, so I'm nudged toward sim
  entry only when it's warranted.

## Scope
**In (this phase):**
- A **single open ghost trade per ticker**: long, single-leg (buy call or buy put), quantity default
  1 (quantity adjustable). Opened at the current option price; closed/adjusted by the user or by
  accepting an AI recommendation.
- A persistent **trade panel** with: entry price + time + qty, current price, **running % and $
  P/L**, the contract's current stats, DTE remaining, and strike position vs spot/walls/flip.
- A **"Reassess"** action that hands the *current trade + current market context* to the **existing
  external downstream-AI contract** and surfaces the returned risk-first recommendation.
- **Accept / Reject** of each recommendation, with a per-trade **decision history** (what AI said,
  what the user chose, timestamp, P/L at the time).
- **In-dashboard reassessment alerts** for a defined set of material events while a trade is open.
- An **Opportunity escalation ladder**: named tiers with attention-scaling emphasis, the top tier
  surfacing the guided sim-entry prompt; tiers are **operator-tunable** and built on the existing
  `opportunity_score` / AI-gate machinery.
- Honest **live-vs-stale** behavior for all trade-derived live values; per-feature degradation.

**Out (this phase):**
- **Any real-broker / Trader-API order placement.** Simulation only. There must be **no path to
  place a real order** in this phase.
- **Auto-execution** of AI recommendations (always user-gated accept/reject).
- **Multi-leg, spreads, short/written options, multiple concurrent trades, portfolio P/L.**
- **Commissions, slippage, taxes, assignment/exercise modeling** (sim is mid-price, multiplier-only).
- **Push / email / mobile notifications** (alerts are in-dashboard only this phase).
- **Backtesting / historical trade replay / multi-session trade analytics.**
- Data structures, endpoints, payload shapes, math, thresholds-as-code, and UI layout
  (Architect / Interface / UX / Eng own these).

**Future-dated (named, explicitly deferred):**
- **Sim ↔ live broker toggle** ("trade with your own Trader API"): swap the ghost position for a real
  order via the user's platform/broker. Out of this phase; the design should not *preclude* it.
- **Back-testing of AI-assisted recommendations** (the reason this tracker exists long-term): replay
  historical bundles — `market_data.json` + signals + strike profile — through the *same* ghost-trade
  + reassessment + decision-history machinery to measure whether AI-assisted recommendations produce
  an **edge** vs holding / vs no-AI. **Not built this phase, but the design must not preclude it**
  (see "Design-for: back-testing seam" and feasibility Q11–Q13). The live-tracking and back-testing
  modes should differ only in their **data source and clock**, not in the trade/decision logic.
- ADV-/percentile-adaptive alert thresholds; external notifications; fees/slippage realism.

## Product decisions made here (so the Architect isn't guessing)
- **Fill basis = option mid**, consistent with the standing "live spot = NBBO mid, not last trade"
  decision. Open and close both record the mid at action time. (Data availability of an option mid is
  a feasibility question — see Q1.)
- **P/L = (current − entry) × 100 × qty** in dollars, and the corresponding % vs entry cost.
  The standard **100-share contract multiplier is included**; **fees/slippage are excluded** in the
  sim and this simplification is stated to the user (no hidden realism claims).
- **One open ghost trade per ticker** in v1; opening a second on the same ticker is not supported
  until the first is closed.
- **Reassessment is always user-initiated**; an alert may *suggest* reassessing but never auto-queries
  the AI and never auto-acts.
- **Escalation tiers are product states, not magic numbers.** Proposed ladder: **Dormant → Watch →
  Actionable → Prime.** Emphasis increases per tier; **Prime** unlocks the guided sim-entry prompt.
  Exact score bands are operator config mapped to the existing `GATE_SCORE` concept (not set here).

### Design-for: back-testing seam (build the seam, not the feature)
The ghost-trade tracker is the long-term substrate for **back-testing whether AI-assisted
recommendations add edge**. This phase ships **live sim only**, but the Architect should design so the
later back-test reuses the *same* trade + reassessment + decision logic, differing only in input:
- **Data-source abstraction.** The tracker must be drivable from **replayed historical bundles**
  (`market_data.json` + signals + strike profile snapshots in sequence), not just the live feed — the
  same way it consumes a live bundle, so trade/decision logic is identical in both modes.
- **Clock abstraction.** P/L, alerts, DTE decay, and dedupe must key off a **supplied "now"** (a sim
  clock during replay), not wall-clock, so a historical sequence can be stepped through.
- **Structured, exportable decision history.** Each open/close/accept/reject/alert record (verdict,
  choice, time, price, P/L, contract) must be **machine-readable and exportable**, so a back-test can
  score AI-assisted vs hold-only vs no-AI outcomes after the fact. (This is a v1 requirement *because*
  it's cheap now and load-bearing later — see acceptance criteria.)
- **Deterministic given inputs.** For the same input sequence + the same accept/reject choices, the
  tracked P/L and decision trail should be reproducible (no hidden dependence on live timing) — a
  precondition for a trustworthy back-test. The *mechanism* is the Architect's call (Q11–Q13).

## Behavior rules

### Ghost-trade lifecycle & P/L
- Opening records the contract, side (long call/put), qty, entry mid, and entry time; the panel then
  shows the position as **open**.
- While **market is live**, current price and **% / $ P/L update continuously**; gains read positive,
  losses negative.
- The **trade record and entry facts are static/persistent** — they ride the durable layer, **never**
  blanked or lost on a live-stream drop or a page reload.
- The **P/L and current-price values are live-derived** and obey **stream isolation** (below): on a
  feed drop they mark **stale/offline** (keep last value, visibly flagged), never frozen-as-live,
  never blanked; they self-heal when the feed returns — **no manual refresh**.
- **Closed market / overnight:** because there is no overnight option price, P/L **freezes with a
  closed/stale indicator**; no fake ticks.
- **Tracked contract is independent of the DTE/expiration display filter:** the position keeps
  tracking even if its contract falls **outside** the window currently shaping the GEX view. (The DTE
  filter shapes gamma structure only — it must not stop tracking a held contract.)

### AI reassessment (accept / reject)
- "Reassess" packages the **open trade + current market state** and routes it through the
  **existing external-AI hand-off** (the same contract the gate/glossary/strategy-prompt define).
  GammaFlow **defines the request + surfaces the response**; it does **not** itself become an
  LLM caller unless the Architect rules that necessary (Q3).
- The recommendation is a **risk-first, structured** verdict in this product vocabulary:
  **Hold · Trim (scale-out) · Add (scale-in) · Exit (close) · Roll (adjust)**.
- **Accept → apply to the ghost position:** Exit closes it and books realized P/L; Trim reduces qty;
  Add increases qty (capped — must not become an over-trading nudge); Roll closes the current and
  opens the recommended replacement ghost contract; Hold leaves it open.
- **Reject → leave the position unchanged**, recorded as a user override.
- **Every** accept/reject writes a **decision-history** entry (AI verdict, user choice, time, P/L at
  decision). Nothing is ever auto-applied.

### Reassessment alerts (material events only)
- While a trade is open, an **in-dashboard alert** is raised on a material event, e.g.: **price
  crosses a gamma wall or the flip**, **opportunity tier change**, **P/L crosses a target/stop
  level**, **DTE-to-expiration threshold reached**, or **the AI-gate "state changed" fingerprint
  flips**. The exact trigger set/thresholds are operator config (Q6).
- **De-dupe is binding:** an alert fires **once per distinct event** (reuse the existing gate
  "changed"/fingerprint discipline), **not** every poll while a condition merely persists.
- **No alert fires on stale/overnight/closed data** — alerts require fresh inputs.

### Opportunity escalation & emphasis
- The opportunity surface escalates by **tier** with **attention-scaling emphasis** (quiet at
  Dormant, prominent at Prime). The mapping is built on the existing `opportunity_score` and
  `ai_eval.ready/changed`.
- The **guided sim-entry prompt appears only at the Prime tier** *and* when the setup is actionable;
  below Prime it is absent.
- **Over-trading guard is binding here too:** the attention escalation and the sim-entry prompt fire
  on a **material change *into* a higher tier** (de-duped), **not** continuously while the score sits
  high. Emphasis must inform, not badger.

### Cross-cutting
- The whole feature is **additive and best-effort**: if trade tracking, reassessment, or alerting
  fails for a cycle, the **GEX chart, stats, and the rest of the dashboard render normally** and only
  the affected area shows an "unavailable" state.
- **Simulation is unmistakable:** the ghost trade must be clearly labeled simulated/not-real
  throughout, so it's never confused with a real position.

## Binding constraints from GAMMAFLOW_CONTEXT (must be respected — restated for the Architect)
- **Gamma sourcing unchanged.** Vendor gamma for profile/walls; analytic BS gamma only for the flip
  ±20% grid. This feature **adds no gamma source** and must not alter gamma, the flip, walls, peak
  GEX, max pain, PCR, VWAP, or HV.
- **Rates / greeks model unchanged.** r = 4.5%, dividend yield q, `MIN_GREEK_T = 1/365` floor stay
  as-is; the feature introduces no new BS repricing of those structures.
- **DTE/expiration-filter scope unchanged.** The filter shapes only gamma structure; max pain & PCR
  stay full-chain. **A tracked contract must keep tracking regardless of the current filter window.**
- **Dark-pool / off-exchange stays context-only** — capped, toggleable, no directional "smart money."
  Nothing here may turn off-exchange data into a trade signal.
- **Live-vs-cached isolation is law.** Heavy analysis rides the ~60s cached REST bundle; only the
  light live values stream over SSE. The trade's **live P/L follows the live lane and degrades
  independently**; the **trade record + analysis follow the cached/durable lane and never blank** on a
  live drop. Cold-start (never any successful load) remains the *only* blank-screen condition.
- **Honest live-vs-stale.** Never present a frozen price/P/L as live; reuse `live` / `market_session`
  semantics. **No overnight (8 PM–4 AM ET) data** — P/L and alerts freeze honestly overnight.
- **The AI is external.** GammaFlow defines the **contract + gate**; it **does not call an LLM**
  today. Reassessment must fit this model (or the Architect must explicitly decide otherwise — Q3).
- **Over-trading guard is a product invariant.** The gate escalates only when **actionable AND
  changed**; the user is prone to over-trading. All new emphasis, prompts, and alerts must inherit
  this discipline (gated, de-duped, material-change-only). **Accept/reject is always user-gated.**
- **Single-ticker, on-demand.** No watchlist/portfolio scan; one ticker in focus.

## Feasibility questions for the Architect (flagged, NOT resolved here)
1. **Live per-contract option price.** Is a live per-option NBBO/mid available to drive P/L, or must
   P/L be **derived from the underlying move via the contract's greeks**? Today the live lane streams
   only the **underlying** NBBO/flow/flip; per-contract greeks/IV come from the ~60–120s chain
   snapshot. What is the honest, buildable source for a *live* ghost-option price?
2. **Stream isolation with a per-option value.** If a live option price is added, does it fit the
   existing single live SSE session per ticker, or require a new subscription? How is isolation
   preserved so a trade value never destabilizes the existing live tiles?
3. **Reassessment round-trip.** The downstream AI is external and GammaFlow does not call an LLM.
   For "Reassess → recommendation → accept/reject," what is the actual mechanism — a manual hand-off
   payload, a webhook/callback, or does this phase require GammaFlow to *invoke* the AI (an
   architecture change)? Define the request/response path that keeps the external-AI contract intact.
4. **Trade-state persistence.** Where does the ghost trade + decision history live so it **survives
   reloads and stream drops** (client local storage vs server-side store)? The app is currently
   stateless/on-demand — what's the lightest durable option?
5. **Trade-aware gate semantics.** The current gate answers "is there an entry edge"; an open trade
   needs "is the *held position* still healthy." Can the existing `ai_eval` / fingerprint machinery
   be extended to a **position-aware** mode, or is a separate evaluation needed — without breaking the
   over-trading dedupe?
6. **Alert evaluation locus & cadence.** Where are alert conditions evaluated (server per-bundle vs
   client) and at what cadence, and can wall/flip-cross + tier-change + P/L-threshold reuse the
   existing **fingerprint/"changed"** dedupe so alerts fire once per event, not per poll?
7. **Opportunity tiering source.** Can the **Dormant/Watch/Actionable/Prime** ladder and the Prime
   sim-entry gate be derived from the existing `opportunity_score` + `GATE_SCORE` + `ai_eval`, or is a
   new scoring surface required? (Bands themselves are config, not asked here.)
8. **P/L refresh vs the 60s cache.** P/L should feel live (sub-60s); the analysis bundle is cached
   ~60s. How do the two cadences coexist so P/L is timely without hammering the vendor or breaking
   the cache model?
9. **Roll mechanics for a sim.** Accepting "Roll" closes one ghost and opens a replacement contract —
   is the replacement contract's pricing/greeks available in the same snapshot pass (no new fetch),
   like the blocks precedent, or does it need a fetch?
10. **Future broker-swap seam.** Without building it, is there an architecture seam so a later
    sim↔real-broker toggle drops in without reworking the tracking/AI/alert layers?
11. **Back-test replay seam.** Can the tracker be **fed a sequence of historical bundles**
    (`market_data.json` + signals + strike profile) through the *same* path it consumes a live
    bundle, so trade/decision logic is identical live vs replay? What's the lightest data-source +
    **sim-clock** abstraction that makes this possible without forking the trade logic?
12. **Reassessment in replay.** Back-testing edge requires the AI to be reassessed at each historical
    step. Given the AI is external, how is reassessment driven during an **offline/batch replay**
    (recorded/cached AI responses? a callable hook? deferred until the AI integration of Q3 is
    decided?) — flag dependencies, don't resolve.
13. **Decision-history schema durability.** Is the structured, exportable decision/outcome record
    (Q-design-for) stable and complete enough to later compute edge metrics (AI-assisted vs hold-only
    vs no-AI) without re-instrumenting? Confirm the record captures everything a back-test needs.

## Acceptance criteria (each observable without reading code)
**Ghost trade & P/L**
- [ ] The user can **open a simulated long call or put** by choosing a contract at its current price;
      a clearly **simulated** trade panel then shows entry price, entry time, and quantity.
- [ ] While the market is live, the panel's **% and $ P/L update as price moves**; a price above
      entry shows a gain, below entry a loss, and the $ figure reflects the **100× multiplier × qty**.
- [ ] The panel shows the contract's **current stats** (price, greeks/IV, DTE left, strike vs
      spot/walls/flip).
- [ ] After a **page reload**, the open ghost trade is **still present** with the same entry facts.
- [ ] On a **live-stream drop**, P/L and current price show **stale/offline** (last value, flagged) —
      not blanked, not shown as live — while the **trade record, entry facts, and the GEX
      chart/stats stay fully visible**; when the feed returns, P/L **resumes without a manual refresh**.
- [ ] When the **market is closed/overnight**, P/L **freezes with a closed/stale indicator** and shows
      no fake updates.
- [ ] The trade **keeps tracking even when its contract is outside the current DTE/expiration
      display window**.

**AI reassessment**
- [ ] With a trade open, a **"Reassess"** action returns a **risk-first recommendation** drawn from
      {Hold, Trim, Add, Exit, Roll}.
- [ ] **Accepting** applies the mapped change to the ghost position (Exit closes it and books realized
      % and $ P/L; Trim reduces qty; Add increases qty within a cap; Roll closes and re-opens the
      recommended contract; Hold leaves it open).
- [ ] **Rejecting** leaves the position unchanged.
- [ ] Every accept/reject creates a **decision-history entry** (AI verdict, user choice, time, P/L at
      decision); **nothing is ever auto-applied**.
- [ ] The decision/outcome history (opens, closes, accepts, rejects, alerts — each with its contract,
      time, price, and P/L) is **structured and exportable** as a record, not just rendered on screen
      (so a future back-test can score it). *(v1 requirement; back-test consumption itself is future.)*

**Alerts**
- [ ] While a trade is open, a **reassessment alert** appears when a defined material event occurs
      (e.g., price crosses a wall/flip, opportunity tier changes, P/L hits a target/stop, DTE
      threshold reached).
- [ ] Each alert appears **once per event** and does **not** repeat on every refresh while the
      condition merely persists.
- [ ] **No alert fires** while data is **stale/overnight/closed**.

**Opportunity escalation**
- [ ] The opportunity surface shows **tiered emphasis that increases with the score** (visibly quiet
      at the low tier, prominent at the top).
- [ ] A **guided sim-entry prompt** appears **only at the top (Prime) tier** when the setup is
      actionable, and is **absent** below it.
- [ ] The escalation/prompt fires on a **change into a higher tier** and does **not** re-fire every
      poll while the score stays high (over-trading guard observable).

**Guardrails**
- [ ] There is **no way to place a real broker order** in this phase; the trade is unmistakably
      **simulated** everywhere it appears.
- [ ] If trade tracking / reassessment / alerting **fails for a cycle**, the **GEX chart and all other
      stats render normally** and only the affected area shows "unavailable."
