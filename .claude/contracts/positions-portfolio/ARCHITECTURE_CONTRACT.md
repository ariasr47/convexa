# positions-portfolio — ARCHITECTURE CONTRACT

> Role: Architect (architect-first entry). Scope: the **technical shape only** — data-model
> content, data-flow, component boundaries, isolation/error rules, restated binding constraints,
> explicit non-goals. This contract designs **no UI/layout, no endpoint signatures, no
> payload/JSON field names, no copy** — those are listed as Open Questions for the PM.
>
> Inputs: `.claude/contracts/positions-portfolio/BRIEF.md`, `PROJECT_CONTEXT.md` (§2/§3/§5/§6/§7),
> `OPEN_THREADS.md` §5 (the SHIPPED ghost-trade tracker we EVOLVE) + §9 (resolved — not reopened).
> Grounded against the shipped code: `apps/dashboard/src/app/ghost-trade/{types,store,mark,
> useGhostTrade,TradeEntryDialog,GhostTradePanel}.ts(x)`, `ai-rec/prefill.ts`,
> `operator-metrics/useLatencyTrend.ts`, `libs/api/src/lib/gammaflow.ts`.

---

## 0. One-paragraph thesis

Evolve the **single open `GhostTrade` per ticker** into a **portfolio: a flat collection of many
concurrent open (and closed) sim positions**, each with stable identity, its own honest mark, its
own P/L, and — new — its own **P/L change** (Δ-since-entry + a session/live delta + a small
ephemeral per-position trend). The durable store gains a **versioned migration** (v1 → v2) so no
existing trade or decision is lost. The mark engine (`mark.ts`) is **reused unchanged** for the
per-position mark; a thin **fill/entry resolver** wraps it to support three entry modes (arbitrary
price / market / limit) plus a **resting-limit lifecycle**. A **customization-state model**
(columns/sort/filter, grouping, layout/density, durable saved views) lives in the same durable
store. Two views — **Simulated** (everything above, functional) and **Live** (a structurally
isolated, present-but-LOCKED placeholder with **no broker, no order path, no real-positions data
source**). Every binding invariant from §6 below is honored by construction: positions never feed
signals/score/tier/fingerprint; per-row failures degrade only that row; live-derived numbers
degrade on an SSE drop while records/history/saved-views persist; nothing reaches a real order.

This is **FE-only by default — `NO_BACKEND_CHANGE`**. The existing backend surface
(`GET /api/contract/{ticker}` tracked-contract lookup, the SSE live `mid`, `position_eval`)
already supplies everything the Simulated portfolio needs. See §7 for the one backend question the
PM must arbitrate (multi-position `position_eval`).

---

## 1. Data-model evolution: single trade → positions collection

### 1.1 The position record (content, not field names)

A **position** is the evolution of today's `GhostTrade`. It carries, conceptually:

- **Identity:** a stable per-position id (today: `GhostTrade.id` via `newId()`). This is the
  collection key and the join key for decision history. It is **distinct from the contract
  identity** — two positions on the *same* contract (e.g. two separate entries, or an entry plus a
  later add-as-new-lot) must be able to coexist, so the contract triplet
  `(expiration, strike, right)` is **NOT** the identity. (PM decides whether same-contract re-entry
  merges or stacks — see §7 Q-A.)
- **Contract instrument:** ticker, expiration, strike, right (single-leg long only, as v1 —
  `side: 'long'`). Instruments are **options contracts**, reusing the existing greeks + option-NBBO
  mark path. Multi-leg is an explicit non-goal (§5).
- **Entry facts:** `entry_mark` (the fill basis), `entry_basis` (`MarkBasis`), `entry_time`, `qty`,
  and the optional editable risk plan (`stop`/`target`) — all already present.
- **NEW — entry provenance / fill mode:** which of the three entry modes produced this position
  (arbitrary user price / market fill / limit fill) — needed so the row can honestly show how it
  was priced. (The mode *enum values* are field-name/copy decisions → PM, §7 Q-B.)
- **Lifecycle status:** today `'open' | 'closed'`. NEW — a `'pending'` status for a **resting limit
  order not yet filled** (see §2.3) and a `'cancelled'` terminal for a cancelled resting limit.
  (Status *value strings* → PM, §7 Q-B.)
- **Realized facts on close:** `realized_pl_dollar`, `realized_pl_pct`, `close_time` — unchanged.
- **Grouping dimensions (derived, not stored as a group key):** ticker, strategy, expiry are the
  three grouping axes the BRIEF names. Ticker and expiry are already on the record. **Strategy** is
  new: v1 single-leg long has a trivial strategy (`long call` / `long put`), derivable from
  `right`; do NOT add a free-text strategy field that could drift. (Whether to persist an explicit
  strategy label vs derive it → PM, §7 Q-C.)

The record stays a **plain serializable object** (localStorage-friendly), additive over today's
`GhostTrade` — every new field is **optional** so a v1 record reads as a valid position.

### 1.2 The collection shape

Today's store keys **one** trade per ticker: `trades: Record<string, GhostTrade>` (by ticker). This
**cannot** hold multiple positions per ticker and is the core thing that changes.

**Shape decision: a flat id-keyed map of positions** — `Record<PositionId, Position>` — NOT a
ticker-nested structure. Rationale:

- The central "all positions" view is the natural/default read (iterate all values); per-ticker
  filtering is a **predicate over the flat collection** (`position.ticker === selected`), and
  grouping by ticker/strategy/expiry is a **derived fold**, never a stored hierarchy. A nested
  `ticker → strategy → expiry` tree would hard-code one grouping order and fight the
  "group by any of three axes" requirement.
- Per-position identity is the map key (§1.1), so two positions on the same contract coexist
  cleanly.
- Closed/cancelled positions stay in the collection (filterable by status) so realized history and
  the decision log keep their join target; a separate archive is a non-goal for v1.

**Decision/history concept is preserved append-only.** `decisions: DecisionRecord[]` stays a single
global, append-only, exportable array joined to a position by id (today `trade_id`). No structural
change beyond what migration requires (§1.3). Every per-position event (open/fill/close/accept/
reject/alert/roll, plus new: limit-placed / limit-filled / limit-cancelled) appends one record.
(New event-type *value strings* → PM, §7 Q-B.)

### 1.3 Durable schema migration (v1 → v2) — no data loss

The store is versioned (`SCHEMA_VERSION`, `STORAGE_KEY = 'gammaflow.ghost-trade.v1'`,
`PersistShape.schema_version`). The upgrade path:

1. **Bump `SCHEMA_VERSION` to 2.** Read the persisted blob; branch on its `schema_version`.
2. **Migrate the trades map:** the v1 `trades: Record<ticker, GhostTrade>` is read, and **each
   existing trade is re-keyed by its own `id`** into the new flat `positions:
   Record<PositionId, Position>` map. Every existing trade already has a unique `id`, so this is a
   loss-free one-to-one move; the ticker is preserved on the record itself. New optional fields
   (fill mode, etc.) are left absent → they read as a manual/arbitrary entry, which is exactly what
   a pre-feature trade was.
3. **Decisions array carries over verbatim** — same shape, same `trade_id` join (the id is
   unchanged by re-keying), append-only invariant intact.
4. **Customization state** (§5) is **absent in v1 data** → initialize to defaults on read; never an
   error.
5. **Write back under a v2 key/version.** Migration is **read-time, idempotent, and guarded** — a
   parse/migration failure degrades to the existing in-memory-empty fallback (today's `catch →
   empty()`), it must **never throw into the UI** and must **never silently discard** a readable v1
   blob. (Whether to keep the same `STORAGE_KEY` string with an internal version field, or write a
   new `…v2` key and leave the old one as a one-time fallback source, is an implementation detail —
   recommend: read old-key-if-new-key-absent, write new key; the BRIEF's durability promise is the
   binding part, the key string is not a PM contract field.)

**Binding migration guarantee:** after upgrade, an existing single open trade appears as exactly
one open position in the portfolio, its decision history intact, its mark/P-L identical. This is an
acceptance-grade behavior (it survives reload — the BRIEF's observable).

---

## 2. Mark-and-fill engine (reuse + extend `mark.ts`)

**Reuse, unchanged:** `computeMark()` (the snapshot→modeled→theoretical→last_known→frozen ladder),
`pl()`, `bsPrice()`, `MARK_BASIS_META`. The *running* mark of every open position is computed by
the **existing** ladder per row — nothing about ongoing marking changes; it just runs N times.

The **new** surface is a thin **entry/fill resolver** that decides the **`entry_mark` +
`entry_basis`** at position-open time, under three modes. "Live price" sources are the **already
available** ones — there is **no new fetch and no new endpoint**:

- **Underlying live price** = the SSE `LiveUpdate.mid` (the same value `useGhostTrade` already
  feeds `computeMark` as `liveUnderlying`).
- **Option live price** = `TrackedContract.option_quote.mid` from `GET /api/contract` (today's
  `fetchTrackedContract`), or, when `option_quote` is null, the labeled **theoretical** BS mark —
  exactly the fallback `TradeEntryDialog` already implements.

### 2.1 Mode (a) — arbitrary user-input price

The user types an entry price. `entry_mark` = that price; `entry_basis` is recorded as a
**user-input / arbitrary** basis (a NEW `MarkBasis`-adjacent label so the row is honest that the
fill was not a market quote — value/name → PM, §7 Q-D). No quote dependency: this must succeed even
when `option_quote` is null and the chain is unavailable, because the price is user-supplied.
Best-effort contract-stats lookup still runs (for greeks/dte display) but its failure does **not**
block the entry.

### 2.2 Mode (b) — market order

Fill **immediately at the current live option price**: `entry_mark = option_quote.mid` (basis
`snapshot`), or the theoretical BS mark (basis `theoretical`) when no NBBO — i.e. **exactly today's
`TradeEntryDialog` fill resolution**, now labeled as a market fill. If neither a quote nor an IV is
resolvable (chain unavailable / 404), the market order **cannot fill** and is surfaced as a
best-effort failure on that entry attempt only (it does not create a position; it never errors the
app). This reuses the existing fill path verbatim.

### 2.3 Mode (c) — limit order + resting-limit lifecycle

A **limit** order names a limit price and rests until the **live price crosses it**, then fills.

- **State machine:** `pending` (resting) → `filled` (becomes a normal open position) **or**
  `cancelled` (user-cancelled; terminal). These are position **statuses** (§1.1) so a resting limit
  is a first-class collection member — visible, durable across reload, and cancellable.
- **Cross semantics (the binding rule):** a **buy limit** (v1 is long-only, so all entries are
  buys) fills when the **live option mark ≤ the limit price** (you buy at or below your limit). The
  fill price is the **limit price** (a conservative, deterministic, no-look-ahead fill — do NOT
  fill at a better-than-limit live price; that would fabricate price improvement the sim can't
  honestly claim). Basis at fill = a **limit-fill** basis label (→ PM, §7 Q-D).
- **"Live price" for the cross** = the same per-position honest mark the row already computes
  (`computeMark` → modeled/snapshot/theoretical). The cross is **evaluated client-side, each
  mark refresh**, exactly where the existing per-row mark is computed. There is **no server-side
  resting order** and **no order path** — the rest is a pure FE bookkeeping state over the existing
  mark stream.
- **Crossing while offline/closed:** the cross is **only evaluated against a live (non-frozen,
  non-last_known) mark.** While the stream is offline or the market is closed/overnight, a resting
  limit **does not fill** (no fake fills off a frozen/last-known mark) — it stays `pending` and
  resumes evaluation when the feed returns. This is a direct application of
  `[live-vs-static-isolation]`.
- **Best-effort isolation:** a per-position cross evaluation that can't resolve a live mark
  (contract-lookup failure for that row) simply does not fill that cycle; it never blocks other
  rows, the bundle, or the SSE.
- **On fill,** the resting limit transitions to an open position with `entry_time` = fill time and
  appends a decision record (limit-filled event).

**Reuse summary:** modes (a)/(b) are a relabeling + small generalization of the *existing*
`TradeEntryDialog` fill resolution; mode (c) adds a `pending`-status lifecycle and a cross check
that runs in the *same place the per-row mark already runs*. No new math, no new fetch, no new
endpoint.

---

## 3. Per-position P/L and its change

### 3.1 P/L (reused formula — binding, unchanged)

P/L per position = the existing `pl(mark, entry_mark, qty)` →
`dollar = (mark − entry_mark) × 100 × qty`, `pct = (mark − entry_mark) / entry_mark × 100`. The
100× multiplier is included; fees/slippage/taxes/assignment are **not** modeled (the existing
disclaimer stands). **Do not introduce a second P/L formula.** Group subtotals (§4.3) are a **sum
of per-position dollar P/L** over the group — a fold, not a new metric.

### 3.2 "Change in P/L" — the new derivation

The BRIEF asks each position to track **its own P/L AND the change in that P/L**. Define two
distinct, separately-sourced deltas plus a small trend:

- **Δ since entry (static-anchored):** this is just P/L itself relative to the entry anchor — it is
  **derived from the durable record** (`entry_mark`) and the current mark. It persists/recovers from
  the store; it is *not* lost on an SSE drop (it falls back to the last-known mark like the mark
  itself).
- **Session/live delta (live-derived):** the change in P/L over a short, *ephemeral* reference —
  i.e. (current P/L − P/L at a session/window anchor). The session anchor is an **in-browser,
  ephemeral** value (e.g. the P/L recorded at first observation this session, or a rolling window
  start). This is **purely live-derived**: on an SSE drop it **freezes/last-known** and resumes on
  reconnect; it is **never persisted** (clears on reload, by design — same contract as the
  latency-visualizer trend).
- **Per-position trend (small, ephemeral):** a bounded **ring buffer of recent (timestamp, P/L)
  samples per position**, reusing the **`StoredSample`/ring-buffer pattern** from
  `operator-metrics/useLatencyTrend.ts` (bounded by count + age, append-on-refresh, gap = break
  never stitched/interpolated, clears on reload, no refetch on a view switch). This drives a small
  per-row sparkline downstream. It is **ephemeral and live-derived**; a gap during an SSE drop is a
  **broken line**, never zero/interpolated.

**Live-vs-static split (binding, explicit):**

| Datum | Class | On SSE drop | On reload |
| --- | --- | --- | --- |
| Position record, entry facts, qty, status, risk plan | **static/durable** | persists | persists |
| Decision history | **static/durable** | persists | persists |
| Saved views + customization (§5) | **static/durable** | persists | persists |
| Δ since entry (current P/L vs entry) | **live mark, static anchor** | last-known mark (⏸) | recovers from store |
| Session/live P/L delta | **live-derived, ephemeral** | freezes ⏸ / last-known | clears (re-anchors) |
| Per-position P/L trend (ring buffer) | **live-derived, ephemeral** | broken line (gap) | clears |

This table is the `[live-vs-static-isolation]` contract for this feature. The portfolio's **static
columns keep rendering** the last record on an SSE drop; only the live-derived cells dim/⏸.

### 3.3 What is live-derived vs static — precise statement

- **Live-derived (degrade on SSE drop, dim + ⏸, never blank):** current mark, current P/L (Δ since
  entry), session/live P/L delta, the per-position trend, the resting-limit cross evaluation, group
  P/L subtotals (because they fold live per-position P/L).
- **Static (keep rendering last bundle/record):** every position record field, the contract-stats
  line (greeks/IV/DTE from the last `GET /api/contract`, the cached lane), decision history, all
  customization/saved-view state, the entry facts and realized P/L of closed positions.

---

## 4. Two views: Simulated (functional) vs Live (LOCKED placeholder)

### 4.1 Simulated view

The functional paper-sim portfolio: everything in §1–§3 + §5. It is the **only** view with a data
source (the existing tracked-contract lookup + SSE), the **only** view that can create/modify
positions, and it stays **`SIMULATED`** end-to-end with **no order path** — the existing
guarantees extend unchanged to N positions.

### 4.2 Live view — structurally inert by construction

The Live view is a **present-but-LOCKED placeholder** reflecting a future real-broker capability
that is **NOT implemented**. The architecture must make it **impossible to accidentally wire to
anything real:**

- **No data source.** The Live view reads **no positions collection, no broker adapter, no order
  path, no network call.** It renders a static "locked / not available" affordance only. There is
  **no `FillSource`, no `PositionStore`, no broker port instantiated** — the deferred broker seams
  noted in OPEN_THREADS §5 stay **specified-but-unbuilt**; this contract does **not** introduce
  them.
- **Structural isolation (the enforcement):** the Live view is its own component that **imports
  none** of: the durable store, the mark/fill engine, `fetchTrackedContract`, the SSE live feed,
  the customization store. It receives **no props** carrying real or sim position data. The lane
  separation already enforced by `@nx/enforce-module-boundaries` plus a **zero-import boundary**
  for the Live component is the guarantee — if it imports nothing live, it can wire to nothing.
- **`no-real-order-path` honored, not reversed.** The Live view does not *enable* a future order
  path; it is a visual lock only. The vendor/broker decision (OPEN_THREADS §1) stays untouched and
  unblocked — this feature does **not** depend on it.

(The locked-state *copy*, the exact lock affordance, and whether Live shows an illustrative empty
shell vs a single "coming soon" panel are UX/PM decisions — §7 Q-E.)

### 4.3 Central all-positions vs per-ticker filtered — a data-flow/boundary concern

Both are **the same flat collection under different read predicates**, NOT two data sources:

- **Central "all positions":** iterate the full open/closed collection (status-filtered as the view
  chooses).
- **Per-ticker filtered:** the central view with a `ticker === selected` predicate applied. When
  the dashboard is focused on a ticker, the portfolio surface shows just that ticker's positions —
  this is **one predicate**, derived, never a separate store.
- **Grouping** (by ticker / strategy / expiry) is a **derived fold** over whichever predicate is
  active, producing groups each carrying a **group P/L subtotal** = sum of member dollar P/L (§3.1).
  Grouping is a *view-state* choice (§5), never a stored hierarchy (§1.2).

Boundary rule: the **collection + mark/fill engine** is the model; **filtering, grouping,
subtotaling, sorting, column/layout selection are pure derivations** over that model + the
customization state. No derivation mutates the model or triggers a fetch (mirrors the
latency-visualizer "switches re-derive, never refetch" discipline).

---

## 5. Customization state model (data-structure + persistence)

A **durable customization/view state**, persisted in the **same store** as positions (so it
survives reload like the rest), additive to `PersistShape`. Conceptually it holds:

- **Column selection + order** — which position attributes are shown and in what order.
- **Sort** — a sort key + direction (over the visible columns).
- **Filter** — predicate state (at minimum: by ticker, by status open/closed/pending, by
  strategy/expiry; the per-ticker filter of §4.3 is one instance of this).
- **Grouping** — the active grouping axis ∈ {none, ticker, strategy, expiry} (§4.3).
- **Layout** — table ↔ card.
- **Density** — comfortable ↔ compact.
- **Saved views** — a **named collection** of the above bundles. A saved view is a serializable
  snapshot of {columns, sort, filter, grouping, layout, density} + a name + id; the model keeps a
  list of them plus the **active view id**. Saving/loading/deleting a view mutates only this
  customization state, never the positions.

**Persistence + isolation:**

- This state is **static/durable** (§3.2 table) — it persists across reload and is **untouched by an
  SSE drop**. It is initialized to defaults when absent (v1 data / first run) and is **migration-
  safe** (§1.3 step 4).
- It is a **pure view concern**: it never feeds the mark/fill engine, the P/L math, the bundle
  request, or `position_eval`. It is **never an input to signals/score/tier/fingerprint** (trivially
  — it's local view state).
- Saved views are **client-local** (like the rest of the store); multi-device sync is a non-goal.

The available **column set, the human labels, default columns, default view, sort-key names, and
the saved-view UX** are **PM/UX decisions** (§7 Q-F) — this contract fixes only that the state is a
serializable, durable, defaulted, derivation-only structure.

---

## 6. Isolation / error rules + RESTATEMENT of binding constraints

### 6.1 Restated binding invariants (must NOT be violated)

These are restated from the BRIEF "Invariant watch" and `PROJECT_CONTEXT` §5. Each is honored by
construction here:

- **`[no-real-order-path]`** (HONORED, not reversed) — The **Simulated** portfolio stays paper /
  `SIMULATED` with no broker and no order/execution path (extends today's guarantee to N positions
  and to the three entry modes — the "market/limit order" wording is **simulated fill bookkeeping
  against the existing price stream**, never a routed order). The **Live** view is a non-functional,
  zero-data-source, zero-import placeholder (§4.2) — it enables no order path. No code path can place
  a real order.
- **`[additive-keeps-score-byte-identical]`** — Positions are **never an input** to `signals` /
  `opportunity_score` / `opportunity_tier` / `state_fingerprint`. The portfolio is a FE-side,
  client-local additive surface over already-computed bundle data. The only bundle-feedback that
  exists today (`position_eval` via `pos_*` query params) is a **dedupe/changed signal, not a
  scoring input**, and is already proven score-byte-identical; §7 Q-G asks the PM how/whether it
  generalizes to N positions, but **under no answer** may positions feed scoring/the fingerprint.
  The module boundary (the portfolio imports the bundle; `signals` imports nothing portfolio) is the
  enforcement.
- **`[best-effort-isolated-or-null]`** — A per-position **mark or contract-lookup failure degrades
  only that row** (its mark/P-L/trend show unavailable for that position), **never the bundle, never
  the SSE, never the other positions, never an HTTP error.** This is the existing ghost-trade
  isolation applied **per row** across the collection. A migration/store failure degrades to the
  in-memory-empty fallback without throwing.
- **`[live-vs-static-isolation]`** — Live-derived data (current mark, P/L, session/live delta, the
  per-position trend, resting-limit cross evaluation, group subtotals) **degrades on an SSE drop**
  (dim + ⏸ / last-known, broken trend line — never blank, never zero/interpolated, never a fake
  fill), while **static reads** (position records, decision history, contract-stats lane, saved
  views/customization, closed-position realized P/L) **keep rendering** the last record/bundle. See
  the §3.2 table — it is the binding per-datum split.

### 6.2 Additional isolation rules (this feature)

- **Per-row independence:** each position's mark/P-L/trend/limit-cross is computed independently;
  one row's failure or freeze never affects another row or the group subtotal's other members
  (a failed member is simply excluded from / marked-unavailable in the subtotal, never zeroed in a
  way that fabricates a number).
- **Bounded memory:** the per-position trend ring buffers are **bounded by count + age** (reuse the
  latency-visualizer caps) so an arbitrarily large portfolio over a long session can't grow
  unbounded.
- **Resting limits never fill off a non-live mark** (§2.3) — the binding guard against fabricated
  fills.
- **The portfolio is read-only toward the bundle/SSE** — it never mutates the cache, never triggers
  an extra vendor fetch; entry/contract-stats reuse the **existing** `GET /api/contract` (no new
  fetch) and the **existing** SSE stream.

### 6.3 Explicit NON-GOALS

- **No real broker, no real positions, no order routing/execution** — the Live view is a locked
  placeholder; the deferred broker `FillSource`/`PositionStore` seams stay **unbuilt**.
- **No backend change by default** (`NO_BACKEND_CHANGE`) — pending the single PM arbitration in §7
  Q-G (multi-position `position_eval`). The Simulated portfolio is fully deliverable FE-only.
- **No multi-leg / spreads / short positions** — single-leg long only, as v1. (Spreads change the
  "strategy" axis and the P/L math — out of scope.)
- **No fees/slippage/taxes/assignment modeling** — the existing disclaimer stands.
- **No server-side / cross-device persistence** — saved views and positions stay client-local;
  multi-device sync is a non-goal.
- **No new live data source for the Live view** — it touches the vendor/overnight decision
  (OPEN_THREADS §1) **not at all**.
- **No UI/layout, no endpoint signatures, no payload/JSON field names, no copy** — out of the
  Architect's lane; see §7.
- **No reopening of resolved §9 decisions** (NBBO-mid spot, gamma sourcing, dark-pool framing).

---

## 7. Open questions for the PM (deliberately NOT decided here)

These are product / naming / endpoint / copy decisions outside the Architect's lane. The PM (then
UX) resolves them; the technical shape above holds under any reasonable answer.

- **Q-A — Same-contract re-entry semantics:** when a user opens a second position on a contract they
  already hold, do positions **stack** (two independent lots — the default this contract assumes) or
  **merge** (weighted-average entry into one lot)? Affects whether identity can ever be the contract
  triplet. Recommend: **stack** (simpler, honest, matches "many concurrent positions").
- **Q-B — Enum value strings + new event types (field-name/copy lane):** the fill-mode values
  (arbitrary/market/limit), the new statuses (`pending`/`cancelled`), and the new decision event
  types (limit-placed / limit-filled / limit-cancelled) need their exact serialized value strings +
  labels. Architect fixes the *concepts*; PM fixes the *strings/copy*.
- **Q-C — Strategy axis:** is "strategy" (a grouping axis) **derived** from `right` for v1
  single-leg-long (recommended), or an explicit user-set label? Affects whether a strategy field is
  persisted.
- **Q-D — Entry-basis labels for the three modes:** the user-input, market-fill, and limit-fill
  bases need honest display labels/tips (analogous to the existing `MARK_BASIS_META` copy). Copy +
  whether they extend `MarkBasis` or sit beside it.
- **Q-E — Live view presentation:** exact locked-state copy + affordance (illustrative empty shell
  vs single "future capability" panel). Must stay zero-data-source either way.
- **Q-F — Customization specifics:** the available column set + labels, default columns, the default
  view, sort-key names, density tiers, and the saved-view UX (create/rename/delete/switch). Pure
  view/copy.
- **Q-G — Multi-position `position_eval` (the one backend question):** today `position_eval` /
  `pos_*` query params describe **one** open position to the bundle (alerts/dedupe). With N
  positions, the PM must decide: (i) keep it single-position (the FE feeds the *focused* ticker's
  position, others get no server-side `changed` signal — FE-only, `NO_BACKEND_CHANGE`, recommended
  for v1), or (ii) request a backend amendment to evaluate multiple positions. **Binding constraint
  on any answer:** positions must **never** feed `signals`/score/tier/`state_fingerprint`
  (`[additive-keeps-score-byte-identical]`), and any backend change must remain best-effort/isolated.
  Recommend **(i)** to keep this feature FE-only.
- **Q-H — Closed-position retention / archive:** do closed/cancelled positions stay in the live
  collection indefinitely (filterable), or get archived/pruned after some bound? Affects long-run
  store size. Recommend: retain + filter for v1; archive is a later concern.

---

## 8. Reuse ledger (what extends vs what is new)

| Asset | Disposition |
| --- | --- |
| `mark.ts` `computeMark`/`pl`/`bsPrice`/`MARK_BASIS_META` | **Reuse unchanged** (run per-row) |
| `store.ts` `PersistShape` + guarded read/write/export | **Extend** (flat positions map, customization state, v1→v2 migration) |
| `types.ts` `GhostTrade`/`DecisionRecord`/`TradeAlert` | **Evolve** `GhostTrade`→Position (additive fields, statuses); `DecisionRecord` reused + new event types |
| `useGhostTrade.ts` (mark/P-L, alerts, reassess, accept/reject) | **Generalize** from one trade to a keyed collection; per-row mark/alert logic reused |
| `TradeEntryDialog.tsx` fill resolution | **Reuse + extend** into the 3-mode entry/fill resolver (arbitrary/market/limit) |
| `GhostTradePanel.tsx` | **Re-home** into a portfolio surface (table/card, grouping, subtotals) — UX-authored |
| `operator-metrics/useLatencyTrend.ts` ring buffer | **Reuse the pattern** for the per-position P/L trend (bounded, ephemeral, gap=break) |
| `ai-rec/prefill.ts` Accept→entry seam | **Reuse** — an accepted AI rec opens a new portfolio position (via the same entry resolver) |
| `fetchTrackedContract` / `GET /api/contract` / SSE `mid` | **Reuse unchanged** — no new fetch, no new endpoint |
| Backend `signals`/score/tier/fingerprint | **Untouched** (the enforcement boundary) |
| Broker `FillSource`/`PositionStore` deferred seams | **Stay unbuilt** (Live is a zero-import lock) |

---

## 9. Acceptance-grade shape assertions (for the PM's ACs + downstream tests)

These are the *technical* observables the contract guarantees; the PM turns them into ACs and the
UX into the test matrix:

1. The portfolio renders **N concurrent open sim positions**, each with its own mark + P/L +
   P/L-change + small trend, updating on the live feed.
2. **Migration:** an existing v1 single open trade appears as exactly one open position with its
   decision history + mark/P-L intact after the v1→v2 upgrade; survives reload.
3. **Three entry modes** each create a position with the correct, honestly-labeled entry basis;
   a **resting limit** sits `pending`, fills only on a live cross at the limit price, and is
   cancellable.
4. **Per-ticker filter** shows only that ticker's positions; **grouping** by ticker/strategy/expiry
   yields **group P/L subtotals** = sum of member P/L.
5. **Customization + a saved view survive reload** (durable), untouched by an SSE drop.
6. **SSE drop:** live-derived cells dim/⏸/last-known, the per-position trend shows a broken line,
   resting limits do **not** fill; **records, history, saved views, contract-stats lane persist**.
7. **Per-row isolation:** one position's contract-lookup failure marks only that row unavailable;
   other rows, subtotals (over the survivors), the bundle, and the SSE are unaffected.
8. **No real order anywhere; `SIMULATED` everywhere; the Live view wires to nothing** (zero data
   source, zero live import). Score/tier/`state_fingerprint` byte-identical with/without the
   portfolio.

---

*End of ARCHITECTURE_CONTRACT — Architect lane complete. Next role: Product Manager (PM resolves
Q-A…Q-H, authors the PRODUCT_CONTRACT + ACs, picks the FE-only-vs-backend path at Q-G).*
