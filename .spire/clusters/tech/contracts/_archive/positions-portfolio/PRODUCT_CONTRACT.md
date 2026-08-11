# PRODUCT CONTRACT — Positions Portfolio (multi-position sim portfolio + locked Live placeholder)

> Producer: Product Manager (SECOND role — architect-first entry). Consumer: UX/Tech-Writer (next
> session — authors UX_BLUEPRINT + runs the split into INTERFACE/BACKEND/FRONTEND execution contracts).
> Inputs: PROJECT_CONTEXT.md (§5/§6/§7), OPEN_THREADS.md §5/§9, and ARCHITECTURE_CONTRACT.md (the
> locked technical shape + its open questions Q-A…Q-H). No chat history.
> Lane: user value, scope, product behavior, acceptance criteria. **No code, math, data structures,
> endpoints, payload/field names, or UI layout** — those are downstream (UX + executioners). Where this
> contract names a behavior, the exact microcopy + visual layout are deferred to UX (flagged inline).

---

## Feature & user value

GammaFlow's shipped ghost-trade tracker holds **one** open sim position per ticker. A swing trader who
runs several ideas at once cannot see them together, cannot compare which are working, and cannot
manage a book. This feature evolves that single tracker into a **portfolio**: a place to see **every
open (and closed) simulated position at once**, each tracking **its own P/L and the change in that
P/L**, both **globally** (all tickers) and **per-ticker** (when focused on one ticker, just that
ticker's positions).

Net value: the trader gets a *manage the book* surface on top of the existing *find the edge* and
*simulate one trade* loops — see at a glance which positions are working, which to trim or cut,
grouped and subtotaled the way they think (by ticker, by strategy, by expiry), in a **modern,
organized, customizable** display whose configuration **survives a reload**. The simulator gains two
new ways to enter — a **market** fill or a **resting limit** order against the live price — alongside
the existing arbitrary-price entry. A second view tab, **Live**, is present but **LOCKED**: it shows
where a future real-broker portfolio will live, while doing **nothing real** — no broker, no real
positions, no order path — so it never touches the blocked vendor decision (OPEN_THREADS §1).

Everything stays **paper / `SIMULATED`** end to end, **risk-free**, and the portfolio is purely
**additive** — it is never an input to GammaFlow's signals, opportunity score/tier, or state
fingerprint.

---

## User stories

**Seeing the whole book**
- As a swing trader, I want a **central view of all my open sim positions at once** so I can see my
  whole book instead of one position per ticker.
- As a swing trader, I want **many concurrent positions**, including more than one on the **same
  ticker** and even the **same contract**, so the portfolio reflects how I actually layer ideas.
- As a swing trader, when I'm **focused on one ticker**, I want the portfolio to show **just that
  ticker's positions**, so the view matches what I'm looking at.

**P/L and its change, per position**
- As a swing trader, I want each position to show **its own running P/L (% and $)** so I know where it
  stands.
- As a swing trader, I want each position to show **how its P/L is changing** — both **since I entered**
  and **over this live session** — plus a **small recent-trend sparkline**, so I can tell a position
  that's turning from one that's drifting.
- As a swing trader, I want **group subtotals** (sum of P/L across a group) when I group positions, so
  I can read the book by ticker / strategy / expiry.

**Entering positions three ways**
- As a swing trader, I want to open a position at **any price I type** so I can log an idea exactly as
  I see it.
- As a swing trader, I want to **buy at market** — fill immediately at the current live option price —
  so I can simulate acting now.
- As a swing trader, I want to place a **resting limit** that fills **only when the live price reaches
  my limit**, and stays visible and **cancellable** until it does, so I can simulate patient entries.

**Managing & organizing the book**
- As a swing trader, I want to **choose which columns** I see and **sort/filter** them so the table
  shows what matters to me.
- As a swing trader, I want to **group** positions by ticker / strategy / expiry with **group P/L
  subtotals**.
- As a swing trader, I want to switch between a **table and a card layout** and a **comfortable or
  compact density**.
- As a swing trader, I want to **save a named view** of my configuration and have it **survive a
  reload**, so I don't reconfigure every session.

**Durability & honesty**
- As a swing trader, I want my **positions, history, and saved views to survive a page reload and a
  live-feed blip**, and my **existing tracked trade to carry over** unchanged when this lands.
- As a swing trader, I want live numbers **honestly marked offline/stale** when the feed drops or the
  market is closed — never a frozen number pretending to be live, and **never a fake fill**.

**The Live view**
- As a swing trader, I want a **Live tab** that shows where my real-broker portfolio will eventually
  live, clearly marked **coming soon / not connected**, that does nothing real — so I understand the
  roadmap without any risk of placing a real order.

---

## Product decisions made here (resolving the Architect's Q-A…Q-H)

The owner reviewed the Architect's recommended defaults and did not override. These are now binding
product decisions; the UX and executioners implement them, not re-decide them.

- **Q-A — Same-contract re-entry → STACK.** A second entry on a contract the trader already holds
  creates a **separate, independent position** (its own identity, entry, P/L, history). Positions are
  **never auto-merged or weight-averaged**. The trader manages each lot independently.

- **Q-B — Enum/event strings + new statuses (concept fixed here; exact serialized strings + display
  labels are UX copy, flagged):**
  - **Entry modes** (three): *arbitrary user price* · *market* · *limit*. Each position must display
    **which mode opened it**, honestly.
  - **Lifecycle statuses** (five concepts): *open* · *closed* · *pending* (a resting limit not yet
    filled) · *cancelled* (a resting limit the user cancelled — terminal). *closed* and *cancelled* are
    **terminal**; *pending* transitions to *open* on fill or *cancelled* on cancel.
  - **Decision-history events** must additionally record: **limit placed**, **limit filled**, **limit
    cancelled** (alongside the existing open/close/accept/reject/alert/roll events).
  - The exact value strings and human labels are UX/copy decisions; the **set of concepts above is
    fixed**.

- **Q-C — Strategy axis → DERIVED from call/put.** For v1 (single-leg long only), "strategy" is
  **derived** as *long call* / *long put*; there is **no free-text strategy field** the trader sets.
  Grouping by strategy groups long calls vs long puts. (Multi-leg strategies are out of scope — see
  Scope/Out.)

- **Q-D — Entry-basis labels (concept fixed; copy deferred to UX):** each entry mode produces an
  **honestly distinct, visible basis label** so the trader can never confuse a typed-in price with a
  live-quote fill:
  - *arbitrary* → a **"user-entered price"** basis (does not claim to be a market quote);
  - *market* → the existing market/quote basis (live option quote, or the labeled **theoretical** mark
    when no quote is available);
  - *limit* → a **"filled at limit price"** basis.
  The exact label strings + tooltips are UX copy (analogous to the existing mark-basis tooltips).

- **Q-E — Live view presentation → LOCKED placeholder, behavior fixed (copy deferred to UX):** the
  Live tab is **always visible and selectable**, renders a single **"coming soon / not connected"**
  locked state, exposes **no positions, no entry, no order action of any kind**, and performs **no
  network call**. It must be **unmistakably non-functional** and clearly distinct from the Simulated
  portfolio. Whether it shows an illustrative empty shell or a single explanatory panel is a UX choice
  — either way it stays **zero data source, zero live behavior**.

- **Q-F — Customization specifics → all four capabilities IN for v1 (owner-pinned), behavior fixed
  (exact column set, labels, defaults, density tiers, and saved-view microcopy deferred to UX):**
  1. **Columns + sort + filter** — the trader chooses which position attributes show and in what order,
     sorts by a chosen attribute (asc/desc), and filters (at minimum by **ticker**, by **status**
     open/closed/pending, and by **strategy/expiry**).
  2. **Grouping** — none / by **ticker** / by **strategy** / by **expiry**, each group carrying a
     **group P/L subtotal** = the sum of its members' P/L.
  3. **Layout + density** — switch between **table** and **card** layout, and **comfortable** vs
     **compact** density.
  4. **Durable named saved views** — save the full configuration (columns, sort, filter, grouping,
     layout, density) under a **name**, then **switch / rename / delete** views; saved views and the
     active selection **survive a reload**.
  UX picks the default columns, the default view, the sort-key labels, the density tier names, and the
  create/rename/delete/switch interaction.

- **Q-G — Multi-position position-context signal → KEEP single-position, FE-only (`NO_BACKEND_CHANGE`).**
  The portfolio does **not** request a backend change to evaluate many positions. The existing
  single-position bundle feedback continues to describe **at most the focused ticker's position**;
  other positions simply receive no server-side "changed" signal. This is purely a convenience signal,
  **never a scoring input**. **Binding under every path:** positions are **never** an input to
  `signals` / `opportunity_score` / `opportunity_tier` / `state_fingerprint` (see Binding constraints).
  No `ARCHITECTURE_CONTRACT` amendment is requested.

- **Q-H — Closed/cancelled retention → RETAIN in a durable closed/history view.** Closed and cancelled
  positions are **kept** (never silently pruned), **visible** in a closed/history view that is
  **separate from the open-positions list** (reachable via the status filter / a closed view), and
  their realized facts persist across reload. **Archival/pruning of old closed positions is explicitly
  future-dated** (see Future-dated) — v1 keeps them.

---

## Scope

**In (v1):**
- A **central "all positions" view** over a flat collection of **many concurrent** open/closed/pending
  sim positions — including **multiple positions on the same ticker and the same contract** (stacked).
- A **per-ticker filtered view**: when focused on a ticker, the portfolio shows only that ticker's
  positions (one filter over the same collection, not a separate book).
- **Per-position P/L (% and $)** plus its **change**: **Δ since entry**, a **session/live delta**, and
  a **small recent-trend sparkline** per position.
- **Three entry modes** — *arbitrary user price*, *market*, *limit* — each producing a position with an
  **honestly labeled entry basis**.
- A **resting-limit lifecycle**: a *pending* limit is a first-class, visible, **cancellable** member
  that **fills only when the live price reaches the limit price**, at the **limit price**.
- **Grouping** by ticker / strategy / expiry with **group P/L subtotals**.
- **Customization (all four):** columns + sort/filter, grouping, table↔card + density, and **durable
  named saved views** (survive reload).
- A **durable carry-over of the existing single tracked trade** into the portfolio as one open
  position, with its decision history and mark/P-L intact (no data loss).
- A **closed/history view** retaining closed + cancelled positions (Q-H).
- **Two view tabs:** **Simulated** (fully functional, the above) and **Live** (a present-but-LOCKED,
  zero-data-source placeholder).
- Honest **live-vs-static** behavior + **per-position isolation** for all live-derived values.

**Out (v1):**
- **Any real-broker / order placement / execution.** Simulation only. **No path to place a real
  order**, in either view. The Live view enables no future order path — it is a visual lock only.
- **Auto-merge / weighted-average of same-contract positions** (Q-A: they stack).
- **Multi-leg, spreads, short/written positions** — single-leg **long** only. (This also fixes the
  strategy axis to long call / long put — Q-C.)
- **A user-set free-text strategy label** (strategy is derived — Q-C).
- **Commissions, slippage, taxes, assignment/exercise modeling** — the existing disclaimer stands; P/L
  stays the existing multiplier-only formula (no second P/L formula).
- **A backend change for multi-position evaluation** (Q-G: FE-only; positions never feed scoring).
- **Server-side / cross-device persistence or sync** — positions and saved views stay **client-local**.
- **Pruning/archival of closed positions** (Q-H retains; archival is future-dated).
- **A live data source, broker adapter, or order path for the Live view** — none is built; it touches
  the vendor/overnight decision (OPEN_THREADS §1) **not at all**.
- **Filling a resting limit off a frozen / last-known / overnight mark** — fills require a live mark.
- **Push / email / mobile notifications.** Any portfolio alerting stays in-dashboard.
- Data structures, endpoints, payload shapes, math, thresholds-as-code, exact microcopy, and UI layout
  (Architect / UX / executioners own these).

**Future-dated (named, explicitly deferred — design must not preclude):**
- **A real Live broker portfolio** behind the locked tab: a real-positions data source + order path via
  the user's broker. The Live tab marks the seam; v1 builds none of it.
- **Closed-position archival / pruning** after some bound, to cap long-run store size (v1 retains all).
- **Multi-leg / spread positions** (would expand the strategy axis and the P/L math).
- **Cross-device sync of positions and saved views** (v1 is client-local).
- **Portfolio-wide AI reassessment across many positions** (today's reassessment is per-position).

---

## Product behavior

### Portfolio & views
- The **central view** lists every position in the collection, honoring the active filter/group/sort.
- The **per-ticker view** is the central view with a **ticker filter** applied; switching ticker focus
  re-filters the same collection — it never loads a different book and never refetches positions.
- **Two tabs** are always present: **Simulated** (functional) and **Live** (locked). Switching tabs
  **re-derives the view only** — it triggers no fetch and mutates no position.
- **Simulation is unmistakable:** the Simulated portfolio is clearly labeled simulated/paper
  throughout; it is never confused with a real position.

### Per-position P/L and its change
- Each position shows its **running P/L in % and $** (gains positive, losses negative; the $ figure
  reflects the **100× multiplier × quantity** — the existing formula, unchanged).
- Each position shows **Δ since entry** (current P/L vs the entry anchor) — this is **durable**: it
  recovers from the stored record on reload and falls back to the last-known mark on a feed drop.
- Each position shows a **session/live delta** (change in P/L over this browser session's reference) —
  this is **ephemeral**: it **re-anchors fresh on reload** and **freezes** on a feed drop.
- Each position shows a **small recent-trend sparkline** — **ephemeral**, bounded, cleared on reload;
  a feed gap shows as a **broken line**, never zero or interpolated.
- **Group subtotals** are the **sum of member dollar P/L** over the group; a member whose live P/L is
  unavailable is **excluded from / marked unavailable in** the subtotal, never counted as zero.

### Entry modes & the resting-limit lifecycle
- **Arbitrary price:** the position opens at the price the trader types, labeled as a user-entered
  basis; this **succeeds even when no live quote / chain is available** (the price is user-supplied).
- **Market:** the position opens **immediately at the current live option price** (or the labeled
  theoretical mark when there is no quote), labeled as a market fill.
- **Market with no resolvable price:** if neither a live quote nor a theoretical mark can be resolved
  (chain unavailable / not found), the market entry **cannot fill** — it **creates no position** and
  is surfaced as a failure on that attempt only; the rest of the portfolio and the app are unaffected.
- **Limit:** the trader names a limit price; the order **rests as a *pending* position** — visible,
  durable across reload, and **cancellable** — and **fills only when the live option price reaches the
  limit** (for a long buy: at or below the limit), at the **limit price** (never a better-than-limit
  price). On fill it becomes a normal **open** position and records a *limit filled* event.
- **A resting limit never fills off a non-live mark:** while the feed is offline or the market is
  closed/overnight, a *pending* limit **stays pending** and **does not fill**; it resumes evaluation
  when the live feed returns.
- **Cancelling a *pending* limit** moves it to *cancelled* (terminal), records a *limit cancelled*
  event, and removes it from the open list while keeping it in the closed/history view.

### Customization & saved views
- Column choice/order, sort, filter, grouping, layout, and density are **pure view settings** — they
  re-derive the display and **never** mutate a position, trigger a fetch, or affect P/L.
- A **saved view** captures the full configuration under a name; the trader can **switch, rename, and
  delete** views. The active view + all saved views **persist across reload**.
- Customization state is **untouched by a feed drop** (it is static/durable).

### Durability, migration, and isolation
- **Migration / carry-over:** an existing single tracked trade appears, after this lands, as **exactly
  one open position** with its **decision history, mark, and P/L intact**, and survives a reload. No
  existing trade or decision is lost.
- **Reload:** positions, decision history, customization, and saved views all persist; ephemeral
  session deltas + trend sparklines clear and re-anchor (by design).
- **Feed drop (SSE):** **live-derived** cells (current mark, current P/L / Δ-since-entry, session/live
  delta, sparkline, group subtotals, resting-limit cross evaluation) degrade — **dimmed + offline /
  last-known**, **never blanked, never zero, never interpolated, never a fake fill**; **static** reads
  (every position record field, the contract-stats line, decision history, customization + saved views,
  closed-position realized P/L) **keep rendering** the last record/bundle.
- **Per-position isolation:** one position's mark/contract-lookup failure marks **only that row**
  unavailable; **other rows, the group subtotals over the survivors, the bundle, and the SSE are
  unaffected**, and it never raises an app-level error.
- **Store failure isolation:** a corrupt/unreadable store degrades to an empty in-memory portfolio
  **without throwing into the UI** and without silently discarding a readable prior blob.

### Live view (locked)
- The **Live tab** renders a single locked **"coming soon / not connected"** state, shows **no
  positions**, offers **no entry and no order action**, makes **no network call**, and reads **no
  sim/real position data**. It does nothing real and can place no order.

---

## Binding constraints (restated — the next role must not violate these)

These are the BRIEF's `Invariant watch` keys + PROJECT_CONTEXT §5. Restated so they carry forward
without re-reading the ledger.

- **`[no-real-order-path]`** (HONORED, not reversed) — The **Simulated** portfolio stays paper /
  `SIMULATED` with **no broker and no order/execution path**, across all N positions and all three
  entry modes (market/limit are **simulated fill bookkeeping against the existing price stream**, never
  a routed order). The **Live** tab is a zero-data-source, zero-behavior lock that **enables no future
  order path**. **No code path may place a real order.**
- **`[additive-keeps-score-byte-identical]`** — Positions, customization, and saved views are **never
  an input** to `signals` / `opportunity_score` / `opportunity_tier` / `state_fingerprint`; these stay
  **byte-identical** with or without the portfolio. (Q-G keeps the existing single-position bundle
  feedback as a dedupe convenience only, never a scoring input.)
- **`[best-effort-isolated-or-null]`** — A per-position mark/contract-lookup failure, a failed market
  fill, or a store/migration failure yields an **unavailable row / no-op / empty fallback**, **never an
  HTTP error and never an app crash**; the bundle, the SSE, and the other positions stay intact.
- **`[live-vs-static-isolation]`** — Every datum is classed live-derived vs static (see Product
  behavior → Feed drop): live-derived UI degrades on an SSE drop (dim + offline / last-known, broken
  trend line, no fills), while static reads keep rendering the last record/bundle.
- **Tracked contract is filter-independent** — a position keeps tracking even when its contract falls
  **outside** the current DTE/expiration display window (the filter shapes gamma structure only).
- **No second P/L formula** — P/L stays the existing multiplier-only computation; fees/slippage/taxes/
  assignment are not modeled (the existing disclaimer stands). Subtotals are a sum, not a new metric.
- **Client-local only** — positions and saved views persist client-side; no server-side or cross-device
  store is introduced.

---

## Acceptance criteria (each observable WITHOUT reading code — each AC = one required behavioral test)

> Every AC is one observable behavior. Degraded/edge variants are split out as their own ACs (the QA
> test cases). UX maps each AC to ≥1 named test in the FRONTEND_EXECUTION_CONTRACT "Tests to write"
> matrix; QA traces every AC to a passing test at GATE Q.

**A. Central & per-ticker views (multi-position)**
- [ ] **AC-1** The central view renders **multiple concurrent open positions at once**, each with its
      own mark, P/L (% and $), P/L-change, and trend; they update on the live feed.
- [ ] **AC-2** Opening a **second position on the same ticker** shows **two separate positions** (not a
      replacement, not a merge).
- [ ] **AC-3 (same-contract stack — Q-A)** Opening a second position on the **same contract** the
      trader already holds shows **two independent positions** with separate identities, entries, and
      P/L — they are **not** averaged or merged.
- [ ] **AC-4 (per-ticker filter)** With the per-ticker filter active, the portfolio shows **only that
      ticker's positions**; clearing it / switching ticker shows the corresponding set — with **no
      refetch of positions**.
- [ ] **AC-5 (empty)** With **no positions**, the central view shows a clear **empty state**, not an
      error or a blank.

**B. Per-position P/L and its change**
- [ ] **AC-6** Each position shows **running % and $ P/L**: above entry reads a gain, below entry a
      loss, and the $ figure reflects the **100× multiplier × quantity**.
- [ ] **AC-7 (Δ since entry)** Each position shows a **Δ-since-entry** change figure derived from its
      entry anchor and current mark.
- [ ] **AC-8 (session/live delta)** Each position shows a **session/live P/L delta** that re-anchors on
      reload.
- [ ] **AC-9 (trend)** Each position shows a **small recent-trend sparkline** that grows as the feed
      updates.
- [ ] **AC-10 (group subtotals)** Grouping yields a **per-group P/L subtotal equal to the sum of that
      group's members' $ P/L**.
- [ ] **AC-11 (subtotal with an unavailable member)** When a group member's live P/L is unavailable,
      the subtotal **excludes / flags** it and is **not** computed as if that member were zero.

**C. Entry modes & resting-limit lifecycle**
- [ ] **AC-12 (arbitrary)** Entering an **arbitrary typed price** creates a position priced at that
      value, labeled as a **user-entered** basis.
- [ ] **AC-13 (arbitrary, no quote)** An **arbitrary** entry **succeeds even when no live quote / chain
      is available** (the price is user-supplied).
- [ ] **AC-14 (market)** A **market** entry creates a position at the **current live option price**,
      labeled as a **market** fill.
- [ ] **AC-15 (market, no quote → theoretical)** A **market** entry with **no live quote** fills at the
      **labeled theoretical** mark.
- [ ] **AC-16 (market, no resolvable price → 404 / chain unavailable)** A **market** entry that can
      resolve **neither a quote nor a theoretical mark cannot fill** — it **creates no position** and
      surfaces a **failure on that attempt only**, leaving the rest of the portfolio and the app intact.
- [ ] **AC-17 (limit rests)** A **limit** entry creates a **pending** position that is **visible** in
      the portfolio and has **not** filled while the live price is on the wrong side of the limit.
- [ ] **AC-18 (limit fills)** A **pending** limit **fills** when the live option price **reaches the
      limit** (long: at or below), at the **limit price**, becoming an **open** position and recording a
      **limit-filled** event.
- [ ] **AC-19 (limit cancel)** A **pending** limit can be **cancelled**, moving it to **cancelled**
      (terminal) and recording a **limit-cancelled** event; it leaves the open list and remains in the
      closed/history view.
- [ ] **AC-20 (no fill off a non-live mark)** While the feed is **offline or the market is
      closed/overnight**, a **pending** limit **does not fill** even if the last-known mark would have
      crossed; it stays pending and resumes when the live feed returns. **(No fabricated fills.)**

**D. Grouping, sorting, filtering, layout, saved views**
- [ ] **AC-21 (group axes)** The trader can **group** by **ticker**, **strategy**, or **expiry**, and
      can turn grouping **off**.
- [ ] **AC-22 (strategy axis is derived — Q-C)** Grouping by **strategy** groups positions as **long
      call vs long put**, derived from the contract (no user-set strategy label).
- [ ] **AC-23 (sort)** The trader can **sort** positions by a chosen attribute, **ascending and
      descending**.
- [ ] **AC-24 (filter)** The trader can **filter** positions — at minimum by **ticker**, by **status**
      (open / closed / pending), and by **strategy/expiry**.
- [ ] **AC-25 (columns)** The trader can **choose which columns** appear and reorder them; the table
      reflects the selection.
- [ ] **AC-26 (layout + density)** The trader can switch between **table and card** layout and between
      **comfortable and compact** density.
- [ ] **AC-27 (save a view)** The trader can **save the current configuration as a named view** and
      **switch / rename / delete** views.
- [ ] **AC-28 (saved view survives reload)** After a **reload**, the **active saved view and its full
      configuration are restored** (columns, sort, filter, grouping, layout, density).
- [ ] **AC-29 (customization untouched by a feed drop)** On a **feed drop**, the customization and
      saved-view state are **unchanged** (static/durable).

**E. Durability, migration, isolation, degraded states**
- [ ] **AC-30 (positions survive reload)** After a **reload**, all open/pending/closed positions and
      their decision history are **still present** with the same facts.
- [ ] **AC-31 (migration / carry-over)** An **existing single tracked trade** (pre-feature) appears as
      **exactly one open position** with its **decision history, mark, and P/L intact**, and survives a
      reload. **(No data loss.)**
- [ ] **AC-32 (feed drop — live cells degrade)** On a **feed drop**, the **live-derived** cells (current
      mark, current P/L, session/live delta, group subtotals) show **offline / last-known** (dimmed,
      flagged) — **not blanked, not zero, not shown as live**.
- [ ] **AC-33 (feed drop — trend gap)** On a **feed drop**, the per-position **trend shows a broken
      line** (a gap), never zero/interpolated; it resumes on reconnect without a manual refresh.
- [ ] **AC-34 (feed drop — static reads persist)** On a **feed drop**, the **position records, the
      contract-stats line, decision history, customization, saved views, and closed-position realized
      P/L all keep rendering**.
- [ ] **AC-35 (per-row isolation)** When **one** position's contract lookup **fails**, **only that
      row** shows unavailable; **other rows, the group subtotals over the survivors, the rest of the
      dashboard, and the live feed are unaffected** — no app-level error.
- [ ] **AC-36 (store failure isolation)** A **corrupt/unreadable store** degrades to an **empty
      portfolio without an app error** (and does not silently discard a readable prior blob).
- [ ] **AC-37 (closed/history retention — Q-H)** **Closed and cancelled** positions are **retained**
      and visible in a **closed/history view separate from the open list** (e.g. via the status filter),
      with their realized facts persisted across reload — **never silently pruned**.

**F. Live view (locked) & guardrails**
- [ ] **AC-38 (Live tab visible & locked)** The **Live tab** is **present and selectable** and renders
      a clear **"coming soon / not connected"** locked state.
- [ ] **AC-39 (Live does nothing real)** The Live view shows **no positions**, offers **no entry and no
      order action**, and makes **no network call** — it does nothing real.
- [ ] **AC-40 (no real order anywhere)** There is **no way to place a real broker order** in either
      view; everything in the Simulated portfolio is unmistakably **simulated**.
- [ ] **AC-41 (score byte-identical / additive)** The opportunity **score, tier, and state fingerprint
      are unchanged** whether or not the portfolio (and its positions/saved views) exist — positions
      are never a scoring input.

**AC count: 41**, covering required states: default/multi-position (AC-1–4, 6–10, 21–27), empty (AC-5),
the three entry modes incl. their no-quote/404 variants (AC-12–16), the resting-limit lifecycle incl.
the no-live-mark guard (AC-17–20), customization + saved-view persistence (AC-25–29), reload &
migration (AC-28, 30, 31), the full feed-drop degraded matrix (AC-32–34), per-row + store isolation
(AC-11, 35, 36), closed/history retention (AC-37), and the Live-lock + no-order + additive invariants
(AC-38–41).

---

## Amendments bounced to the Architect (GATE Z)

**None.** Every product outcome in this contract is supported by the locked technical shape. Q-G is
resolved **FE-only** (`NO_BACKEND_CHANGE`), so no `ARCHITECTURE_CONTRACT` amendment is requested. If a
downstream role finds a v1 outcome the locked shape cannot support, it must bounce a GATE-Z amendment
rather than silently narrow scope.

---

*End of PRODUCT_CONTRACT — PM lane complete. Next role: UX/Tech-Writer (authors UX_BLUEPRINT, then runs
compressor #3 to split INTERFACE / BACKEND / FRONTEND execution contracts; the FE "Tests to write"
matrix must cover all 41 ACs above).*
