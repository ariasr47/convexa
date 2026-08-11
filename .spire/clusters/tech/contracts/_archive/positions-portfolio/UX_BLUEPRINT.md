# UX BLUEPRINT — Positions Portfolio

> Role: UX/Tech-Writer. Inputs: `PRODUCT_CONTRACT.md` (41 ACs, Q-A…Q-H resolutions),
> `ARCHITECTURE_CONTRACT.md` (the technical shape + the §3.2 per-datum live-vs-static table, used
> verbatim for degraded states), `BRIEF.md` (modern / organized / customizable / HIGH UX),
> `PROJECT_CONTEXT.md` (§2 the dashboard + ghost-trade tracker we evolve, §5 invariants, §7 the
> FE-tests rule). Lane: component states, microcopy/labels, tooltip/glossary text, the exact
> degraded wording, and the AC→state mapping (= the required-tests matrix). **No final code, no
> server internals, no math, no endpoint/payload decisions beyond naming the fields the UI consumes.**
>
> **Posture: `NO_BACKEND_CHANGE`.** The Simulated portfolio consumes the EXISTING
> `GET /api/contract/{ticker}` lookup + the EXISTING SSE live payload. No new endpoint, no new field.

---

## 0. Design thesis (the headline calls)

A **modern, dense, sortable data-table** is the **default layout** — it is the surface a book of
many positions is read in, it scales to N rows, and it is where columns/sort/filter/grouping/density
have the most leverage. A **card layout** is the alternative for a small book / touch / glance-mode.
The portfolio re-homes today's single-position `GhostTradePanel` into a portfolio surface that keeps
the shipped visual language: the `SIMULATED` chip, the `MARK_BASIS_META` basis chips + tooltips, the
`⏸ offline` + dimming idiom from `app.tsx`'s `Stat` tiles, and the broken-line ring-buffer sparkline
idiom from `operator-metrics/LatencyTrend` (`connectNulls=false`, never 0/interpolated).

Five headline calls:

1. **Default view = a dense, comfortable-density table** named **"All positions"** — sortable
   columns, grouping off, no filter, status = open. Card + compact are one toggle away.
2. **Live tab = a single locked "coming soon / not connected" panel** — always present + selectable,
   zero data, zero network, zero order affordance; visually unmistakable as non-functional.
3. **Entry simulator = the shipped `TradeEntryDialog` extended to three modes** via a mode toggle
   (Manual price · Market · Limit), each surfacing an honest, distinct fill-basis preview + label.
4. **Resting limit = a first-class `Pending` row** with a live "waiting for $X" affordance and a
   `Cancel` control; it transitions to `Open` on a live cross (never off a frozen mark).
5. **Customization = columns/sort/filter + grouping + layout/density + durable named saved views**,
   all pure view-state, persisted in the same durable store, untouched by an SSE drop.

---

## 1. Surfaces inventory

| # | Surface | Where it lives |
| --- | --- | --- |
| S1 | **Portfolio shell** — the two tabs (Simulated · Live), the customization toolbar, the active-view chip | A new portfolio section on the dashboard (re-homes the ghost-trade panel slot) |
| S2 | **All-positions view** — the central table/card list over the flat collection | Inside S1 → Simulated tab |
| S3 | **Per-ticker filtered view** — S2 with the active ticker's filter applied | A derived state of S2 (the ticker filter), not a separate surface |
| S4 | **Position row / card** — one position's mark, P/L (% + $), Δ since entry, session delta, sparkline, basis, status | A row in the S2 table / a card in card layout |
| S5 | **Group header + subtotal** — when grouping is on | Rows interleaved in S2 |
| S6 | **Entry / simulator dialog** — 3 modes (Manual price / Market / Limit) | Opened from S1; extends `TradeEntryDialog` |
| S7 | **Pending-limit affordance** — the resting-limit row state + Cancel | A status variant of S4 |
| S8 | **Customization controls** — columns, sort, filter, grouping, layout, density, saved views | The S1 toolbar + a column/view menu |
| S9 | **Closed / history view** — closed + cancelled positions | S2 with status filter = closed/cancelled |
| S10 | **Live tab (locked)** — the placeholder panel | S1 → Live tab |

---

## 2. Value-strings + display labels (Q-B — UX copy I own)

The **serialized value strings** (durable, stored in the record — keep stable; migration reads v1
records as `manual` basis) and the **human display labels** (rendered):

### 2.1 Entry modes / fill provenance (`entry_mode`)
| Concept | Serialized value | Display label | Where it surfaces |
| --- | --- | --- | --- |
| arbitrary user price | `manual` | **Manual** | Entry dialog toggle; row basis chip context |
| market fill | `market` | **Market** | Entry dialog toggle; row basis chip context |
| limit fill | `limit` | **Limit** | Entry dialog toggle; Pending/Open row |

> Migration note: a pre-feature `GhostTrade` carries no `entry_mode` ⇒ reads as **`manual`** (it was
> a typed/arbitrary entry). This is the honest default; never infer `market`.

### 2.2 Lifecycle statuses (`status`)
| Concept | Serialized value | Display label | Chip color |
| --- | --- | --- | --- |
| open | `open` | **Open** | default/neutral |
| closed (terminal) | `closed` | **Closed** | neutral outlined |
| pending resting limit | `pending` | **Pending** | info outlined |
| cancelled (terminal) | `cancelled` | **Cancelled** | default outlined, dimmed |

### 2.3 Decision-history events (`event_type` — new values added to `DecisionEvent`)
| Concept | Serialized value | History-line label |
| --- | --- | --- |
| limit placed | `limit_placed` | **Limit placed** |
| limit filled | `limit_filled` | **Limit filled** |
| limit cancelled | `limit_cancelled` | **Limit cancelled** |

> The existing events (`open`/`close`/`accept`/`reject`/`alert`/`roll`) are unchanged.

---

## 3. Entry-basis labels + tooltips (Q-D — extends `MARK_BASIS_META`)

Each entry mode produces an **honestly distinct, visible basis label** so a typed price is never
confused with a live-quote fill. These are **new basis values beside the existing `MarkBasis`** (the
running-mark ladder `snapshot`/`modeled`/`theoretical`/`last_known` is reused unchanged for ongoing
marking; these new values label only the **entry basis**).

| Entry mode | Entry-basis value | Basis chip label | Tooltip |
| --- | --- | --- | --- |
| Manual | `user_entered` | **user-entered price** | "You typed this entry price — it is not a market quote. P/L is measured from it honestly, but it was not a fill the chain confirmed." |
| Market | `snapshot` or `theoretical` (existing) | **snapshot mid** / **theoretical** | (existing `MARK_BASIS_META` tips — a market fill reuses the live-quote-or-theoretical resolution) |
| Limit | `limit_fill` | **filled at limit** | "Filled at your limit price when the live option mark reached it. The sim never fills better than your limit, and never off a frozen/offline mark." |

Tooltip for a **Market entry that fell back to theoretical**: reuse the existing dialog copy —
*"No live quote — fill will use a theoretical (Black-Scholes) mark."*

---

## 4. Glossary / jargon tooltips (reuse shipped copy where it exists)

| Term | Tooltip |
| --- | --- |
| **SIMULATED** | (reuse) "A paper trade — no broker, no real money, no real order is ever placed." |
| **P/L** | (reuse `PL_TIP`) "Running gain/loss = (current mark − entry mark) × 100 × qty. The 100× contract multiplier is included; fees and slippage are not. Green = gain, red = loss." |
| **Δ since entry** | "How far this position's P/L has moved from your entry. Anchored to the entry price; it persists across reload and falls back to the last-known mark if the feed drops." |
| **Session Δ** | "Change in this position's P/L just over this browser session. It re-anchors fresh each reload and freezes (⏸) while the feed is offline — a short-term read, not a durable one." |
| **Trend** (sparkline) | "A small recent-trend line of this position's P/L this session. In-browser only — it clears on reload and shows a gap (broken line), never a zero, while the feed is offline." |
| **Mark** | (reuse) per-basis tip from `MARK_BASIS_META`. |
| **Limit** | "A resting buy order that fills only when the live option mark reaches your limit price — at the limit price. It stays Pending and cancellable until then, and never fills off a frozen/offline mark." |
| **Subtotal** | "Sum of the $ P/L of this group's positions. A position whose live P/L is unavailable is excluded and flagged — never counted as zero." |
| **Group** | "Group your book by ticker, strategy (long call vs long put), or expiry, each with a P/L subtotal." |
| **Saved view** | "A named snapshot of your columns, sort, filter, grouping, layout, and density. Switch, rename, or delete views; the active one survives a reload." |

---

## 5. Customization specifics (Q-F — UX owns the concretes)

### 5.1 Default column set + labels (table)
Default visible columns, in default order:

| Order | Column key | Header label | Live? | Notes |
| --- | --- | --- | --- | --- |
| 1 | `simulated` | (SIMULATED chip) | static | always-on marker; not removable |
| 2 | `contract` | **Contract** | static | `TSLA $250C · exp 2026-07-17 · Long ×2` |
| 3 | `status` | **Status** | static | Open / Pending / Closed / Cancelled chip |
| 4 | `mode` | **Entry** | static | Manual / Market / Limit (with basis chip) |
| 5 | `mark` | **Mark** | **live** | + basis chip; `⏸` when offline |
| 6 | `pl` | **P/L ($ / %)** | **live** | green/red; `—` + `⏸` offline |
| 7 | `delta_entry` | **Δ since entry** | **live** | persists on reload |
| 8 | `session_delta` | **Session Δ** | **live** | freezes ⏸ offline; clears on reload |
| 9 | `trend` | **Trend** | **live** | sparkline; broken line on gap |
| 10 | `entry` | **Entry price** | static | entry mark + basis chip |
| 11 | `qty` | **Qty** | static | |

Available-but-hidden-by-default columns (selectable): **Expiry**, **Strike**, **Right**,
**Strategy** (Long call / Long put — derived), **DTE**, **Greeks (Δ/Γ/Θ/V)**, **IV**, **Stop**,
**Target**, **Entry time**, **Opened (age)**.

### 5.2 Default view
- **Name:** *"All positions"* (the seeded default saved view; cannot be deleted, can be edited and
  "Save as" a copy).
- **Layout:** table. **Density:** comfortable. **Grouping:** none. **Sort:** P/L $ descending.
  **Filter:** status = open (Closed/Cancelled reachable via the status filter → S9). **Columns:**
  the default set in §5.1.

### 5.3 Sort-key labels (the sortable attributes)
**P/L ($)**, **P/L (%)**, **Δ since entry**, **Session Δ**, **Ticker**, **Strategy**, **Expiry**,
**DTE**, **Qty**, **Entry time** — each toggling **Ascending ↔ Descending** (a direction caret on
the active header; a dedicated Sort menu in card layout).

### 5.4 Filter controls
- **Ticker** — all / a specific ticker (the per-ticker view is this filter set to the focused ticker).
- **Status** — Open / Pending / Closed / Cancelled (multi-select; default = Open). Closed+Cancelled
  selected = the closed/history view (S9).
- **Strategy** — Long call / Long put.
- **Expiry** — a specific expiration date.

### 5.5 Layout + density
- **Layout toggle:** **Table** ↔ **Cards** (icon toggle in the toolbar).
- **Density toggle:** **Comfortable** ↔ **Compact** (compact = tighter row height, smaller type;
  applies to both layouts).

### 5.6 Saved-view UX (create / rename / delete / switch)
- A **view picker** (dropdown) in the toolbar shows the active view name + a `●` if the current
  config differs from the saved snapshot (unsaved-changes dot).
- **Create:** *"Save as new view…"* → name prompt → seeds from the current config. Copy: *"Name this
  view"*; placeholder *"e.g. Tech swings"*; confirm *"Save view"*.
- **Save changes:** when the active view has unsaved edits → *"Save changes to '{name}'"*.
- **Rename:** inline rename in the picker → *"Rename view"*.
- **Delete:** *"Delete view"* → confirm *"Delete '{name}'? Your positions are unaffected."* (The
  seeded *All positions* default cannot be deleted — the control is hidden for it.)
- **Switch:** selecting a view applies its full config; **switching never refetches and never mutates
  a position** (pure view re-derivation).
- Empty saved-view list (only the default exists) → the picker shows just *All positions* + *Save as
  new view…*.

---

## 6. Component states — every surface × {default / loading / stale / offline (SSE-drop) / empty / error / not-found-no-quote}

> Degraded behavior is taken **verbatim from ARCHITECTURE_CONTRACT §3.2**: live cells dim +
> last-known + `⏸`; the per-position trend = a **broken line** (never 0/interpolated); static reads
> (records, contract-stats line, decision history, customization, saved views, closed realized P/L)
> **keep rendering**; a resting limit **never fills off a non-live mark**.

### S2/S3 — All-positions view (table or card)
| State | Behavior + exact copy |
| --- | --- |
| **default** | The collection renders as N rows/cards honoring the active filter/group/sort. Live cells update on the feed. The per-ticker filter narrows to the focused ticker with **no refetch**. |
| **loading** | First load before any bundle/contract data: rows show their **static** record fields immediately (contract, status, entry, qty); live cells show a skeleton/`—` until the first mark resolves. Durable rows never blank waiting for data. |
| **stale** | Bundle is stale (market closed / aged snapshot): live cells render the last mark with the existing freshness idiom; banner reuses *"data is {age} old — levels may be unreliable"* (dashboard-level). Records persist. |
| **offline (SSE-drop)** | Live cells (Mark, P/L, Δ since entry, Session Δ, subtotals) **dim to 0.5 + show `⏸ offline`**; trend = **broken line**; static columns unaffected; the dashboard's single **`⚠ Live offline — reconnecting…`** chip already signals the cause. Resting limits **do not fill**. |
| **empty** | No positions match → a clear empty state, **not** an error/blank. Copy (no positions at all): *"No simulated positions yet. Open one to start your book."* + an **Open simulated position** button. Copy (filtered to empty): *"No positions match this filter."* + a **Clear filter** action. |
| **error** | The collection model never throws to the UI; a store read failure → see S1 store-failure. A per-row failure is isolated (see S4). There is **no view-level error screen** for the portfolio body. |
| **not-found-no-quote** | A row's contract isn't in the snapshot (404) or has no quote → handled per-row (S4), never view-wide. |

### S4 — Position row / card (Open)
| State | Behavior + exact copy |
| --- | --- |
| **default** | Mark (+ basis chip), P/L $ + %, Δ since entry, Session Δ, sparkline, status/mode chips. Green = gain, red = loss (reuse `money`/`pct`). |
| **loading** | Static fields render; live cells `—` until first mark. |
| **stale** | Live cells show last mark; basis chip reads the honest basis (e.g. `theoretical`/`last known`). |
| **offline (SSE-drop)** | Row's live cells dim + `⏸ offline`; sparkline shows a gap; the row record/contract-stats/history persist. |
| **empty** | n/a (a row is a present position). |
| **error (per-row isolation)** | This row's contract lookup fails → **only this row's** live cells read *"unavailable this cycle"* (reuse the shipped *"Trade tracking unavailable this cycle — your position is safe."* tone, condensed to a cell: **"unavailable"** + tooltip *"This position's contract couldn't be priced this cycle — it's safe; other positions are unaffected."*). Other rows, the subtotal over survivors, the bundle, and the SSE are unaffected; **no app-level error**. |
| **not-found-no-quote** | 404 → same per-row "unavailable" treatment (the contract isn't in the snapshot). `option_quote:null` but priceable → **theoretical** mark with the `theoretical` basis chip (not an error). |

### S4 (closed variant)
Realized summary (reuse the shipped closed copy): *"Closed · realized {±$X} ({±Y%}) · held {dur}"*.
Realized facts are **static** — they keep rendering on an SSE drop and across reload.

### S5 — Group header + subtotal
| State | Behavior + exact copy |
| --- | --- |
| **default** | Group header: the axis value (ticker / `Long call`·`Long put` / expiry) + a **count** + **Subtotal {±$X}** (sum of member $ P/L). |
| **offline (SSE-drop)** | Subtotal is live-derived → dims + `⏸`; computed over the members still pricing. |
| **subtotal with unavailable member** | The unavailable member is **excluded** and the header flags it: *"Subtotal {±$X} · 1 position excluded (unavailable)"*. **Never** counted as zero. |
| **empty** | A group with no members is not rendered. |

### S6 — Entry / simulator dialog (3 modes)
Title reuses *"Open simulated position · {ticker}"* + the **SIMULATED** chip. A **mode toggle**
(Manual price · Market · Limit) sits at the top; contract pickers (Expiration / Strike / Call·Put /
Qty / optional Stop·Target) reused from `TradeEntryDialog`.

| Mode | State | Behavior + exact copy |
| --- | --- | --- |
| **Manual** | default | A **Manual price** field. Fill preview: *"Opens at your price ${X} · Cost ${X×100×qty} — user-entered, not a market quote."* Basis chip: **user-entered price**. |
| Manual | no-quote | **Succeeds anyway** (price is user-supplied). Best-effort contract-stats lookup runs for greeks/DTE; if it fails, a caption *"Contract stats unavailable — your entry still works."* and the entry proceeds. |
| **Market** | default | Fill preview reuses the shipped *"Fill: mid ${X} · Cost ${…} (mid × 100 × qty)"*. Basis chip: **snapshot mid**. |
| Market | no-quote → theoretical | *"No live quote — fill will use a theoretical (Black-Scholes) mark."* Basis chip: **theoretical**. |
| Market | no resolvable price (404 / chain unavailable) | **Cannot fill** — confirm disabled; copy: *"No quote or theoretical mark available for this contract — a market order can't fill. Try Manual price, or pick another contract."* On a failed attempt: **creates no position**; surfaces *"Couldn't fill at market — no position was opened."* on that attempt only; the rest of the portfolio/app is untouched. |
| **Limit** | default | A **Limit price** field. Preview: *"Rests until the live mark reaches ${X}, then fills at ${X}. Stays cancellable until it fills."* Confirm label: **Place limit order**. On confirm → a **Pending** position + a `limit_placed` history event. |
| Limit | already-crossable | If the live mark is already at/below the limit, copy: *"The live mark is already at or below your limit — this will fill on the next live tick."* (still rests, then fills on the next live cross; never a synchronous off-mark fill). |
| **(all modes)** | loading | Fill preview area: *"Select a contract to see the fill."* / spinner while resolving. |
| **(all modes)** | error (chain load) | reuse *"Couldn't load the chain for entry — try again."* |
| **(all modes)** | disclaimer | reuse *"Paper trade — no broker, no real money. Filled at the option mid; fees, slippage, taxes and assignment are not modeled."* |

### S7 — Pending-limit affordance (resting limit)
| State | Behavior + exact copy |
| --- | --- |
| **default (pending)** | Status chip **Pending** (info). Live affordance: *"Waiting for mark ≤ ${limit} (live ${mark})"* + a **Cancel** button. P/L cell shows `—` (not yet a position) with tip *"Fills at your limit; no P/L until it fills."* |
| **fills** | On a **live** cross (mark ≤ limit) → transitions to **Open**, entry basis **filled at limit**, records `limit_filled`. Toast/inline: *"Limit filled at ${limit}."* |
| **offline (SSE-drop) / closed / overnight** | **Does not fill.** Affordance dims + `⏸`: *"Paused — resumes pricing when the live feed returns."* No fabricated fill even if the last-known mark would have crossed. |
| **cancel** | **Cancel** → status **Cancelled** (terminal), records `limit_cancelled`, leaves the open list, remains in S9 (closed/history). Confirm copy: *"Cancel this resting limit? It moves to your history."* |
| **per-row isolation** | A pending row whose mark can't resolve simply doesn't fill that cycle; never blocks other rows. |

### S8 — Customization controls
| State | Behavior + exact copy |
| --- | --- |
| **default** | Toolbar: view picker, layout toggle, density toggle, group selector, sort control, filter chips, **Columns** menu. All re-derive the view; **none triggers a fetch or mutates a position**. |
| **offline (SSE-drop)** | **Untouched** — customization + saved views are static/durable; controls keep working, the view re-derives over whatever live cells are dimmed. |
| **reload** | The **active saved view + all saved views restore** (columns, sort, filter, grouping, layout, density). |
| **empty (no saved views)** | Picker shows only *All positions* + *Save as new view…*. |
| **error** | A corrupt customization blob → initialize to defaults silently (see S1 store-failure); never an error dialog. |

### S9 — Closed / history view
| State | Behavior + exact copy |
| --- | --- |
| **default** | Reachable via status filter = Closed/Cancelled (a quick **History** affordance in the toolbar sets it). Lists closed + cancelled positions with realized facts + decision history. Section caption: *"Closed and cancelled positions are kept here — never pruned."* |
| **stale / offline** | Realized facts are **static** → keep rendering unchanged on an SSE drop. |
| **empty** | *"No closed or cancelled positions yet."* |
| **reload** | Closed/cancelled positions + their realized P/L + decision history persist. |

### S10 — Live tab (LOCKED placeholder)
| State | Behavior + exact copy |
| --- | --- |
| **default (the ONLY state)** | The tab is **present + selectable**. Renders a single locked panel — **no positions, no entry, no order action, no network call, no data source**. Visually unmistakable as inert (a lock affordance, muted/illustrative styling, clearly distinct from the Simulated portfolio). |
| copy (heading) | **Live · coming soon** |
| copy (body) | *"This is where your live, real-broker portfolio will live. It's not connected yet — no broker, no real positions, no orders. Everything you can act on today is in the **Simulated** tab."* |
| copy (lock chip) | **Not connected** |
| invariant | Makes **no** network call, imports **no** store/mark/fill/SSE; can place **no** order. |

---

## 7. AC → component-state mapping (this mapping IS the required-tests matrix)

> Each AC maps to ≥1 surface+state. The FRONTEND_EXECUTION_CONTRACT "Tests to write" matrix
> enumerates a named test per row. **All 41 ACs are mapped.**

| AC | Behavior | Surface · state |
| --- | --- | --- |
| AC-1 | Multiple concurrent open positions, each with mark/P-L/change/trend, update on feed | S2 default · S4 default |
| AC-2 | Second position on same ticker → two separate positions | S2 default |
| AC-3 | Second position on same **contract** → two independent (no merge) | S2 default |
| AC-4 | Per-ticker filter shows only that ticker; clear/switch re-filters, **no refetch** | S3 default · S8 default |
| AC-5 | No positions → empty state, not error/blank | S2 empty |
| AC-6 | Running % + $ P/L; gain above / loss below; $ = 100×mult×qty | S4 default |
| AC-7 | Δ since entry from entry anchor + current mark | S4 default (`delta_entry`) |
| AC-8 | Session/live delta re-anchors on reload | S4 default (`session_delta`) · reload |
| AC-9 | Recent-trend sparkline grows as feed updates | S4 default (`trend`) |
| AC-10 | Group subtotal = sum of members' $ P/L | S5 default |
| AC-11 | Subtotal excludes/flags an unavailable member (not zero) | S5 subtotal-with-unavailable-member |
| AC-12 | Arbitrary typed price → position at that value, user-entered basis | S6 Manual default |
| AC-13 | Arbitrary entry succeeds with no quote/chain | S6 Manual no-quote |
| AC-14 | Market entry at current live option price, market basis | S6 Market default |
| AC-15 | Market, no quote → theoretical mark (labeled) | S6 Market no-quote→theoretical |
| AC-16 | Market, no resolvable price → no fill, no position, isolated failure | S6 Market no-resolvable-price |
| AC-17 | Limit rests as Pending, visible, not filled on wrong side | S7 default (pending) · S6 Limit default |
| AC-18 | Limit fills on live cross at the limit price, records limit-filled | S7 fills |
| AC-19 | Pending limit cancellable → Cancelled, records limit-cancelled, stays in history | S7 cancel · S9 default |
| AC-20 | No fill off a non-live mark (offline/closed) — stays pending | S7 offline/closed |
| AC-21 | Group by ticker/strategy/expiry, and off | S8 default (group) |
| AC-22 | Strategy axis derived (long call vs long put) | S5 default · S8 default |
| AC-23 | Sort by an attribute, asc + desc | S8 default (sort) |
| AC-24 | Filter by ticker / status / strategy·expiry | S8 default (filter) · S9 |
| AC-25 | Choose + reorder columns | S8 default (columns) |
| AC-26 | Table↔card layout + comfortable↔compact density | S8 default (layout/density) |
| AC-27 | Save named view; switch / rename / delete | S8 default (saved views) |
| AC-28 | Saved view + full config restore after reload | S8 reload |
| AC-29 | Customization untouched by a feed drop | S8 offline |
| AC-30 | All open/pending/closed positions + history persist after reload | S2/S4 reload · S9 reload |
| AC-31 | Existing single trade migrates to exactly one open position, intact, survives reload | S2 default · migration |
| AC-32 | Feed drop → live cells offline/last-known (dim+flag), not blank/zero/live | S2/S4 offline |
| AC-33 | Feed drop → trend broken line, resumes on reconnect | S4 offline (trend) |
| AC-34 | Feed drop → static reads (records, contract-stats, history, customization, saved views, closed realized P/L) keep rendering | S2/S4/S8/S9 offline |
| AC-35 | One row's lookup fails → only that row unavailable; others + subtotal + dashboard + feed unaffected | S4 error (per-row isolation) · S5 |
| AC-36 | Corrupt store → empty portfolio without app error; doesn't discard a readable prior blob | S1 store-failure |
| AC-37 | Closed + cancelled retained, visible in a separate closed/history view, never pruned | S9 default · reload |
| AC-38 | Live tab present + selectable, "coming soon / not connected" locked | S10 default |
| AC-39 | Live shows no positions, no entry, no order, no network call | S10 default (invariant) |
| AC-40 | No real order anywhere; Simulated unmistakably simulated | S10 + S2/S4/S6 SIMULATED markers |
| AC-41 | Score/tier/fingerprint byte-identical with/without portfolio | Invariant (no scoring input) |

**Coverage: 41/41 ACs mapped.**

---

## 8. Binding invariants (restated — the FE must not violate)

- **`[no-real-order-path]`** — Simulated stays `SIMULATED`; market/limit are simulated fill
  bookkeeping against the existing mark stream, never a routed order. The Live tab wires to nothing
  and enables no order path.
- **`[additive-keeps-score-byte-identical]`** — positions / customization / saved views are **never**
  an input to `signals` / `opportunity_score` / `opportunity_tier` / `state_fingerprint`. The
  existing single-position `position_eval` (focused ticker only) stays a dedupe convenience, never a
  scoring input.
- **`[best-effort-isolated-or-null]`** — a per-row mark/lookup failure, a failed market fill, or a
  store/migration failure → an unavailable row / no-op / empty fallback; **never an HTTP error, never
  an app crash**; bundle + SSE + other positions intact.
- **`[live-vs-static-isolation]`** — the §3.2 table is binding: live cells degrade (dim + `⏸` +
  last-known, broken trend line, no fills) while static reads keep rendering; never a fake limit fill
  off a non-live mark.

---

*End of UX_BLUEPRINT — next: compressor #3 emits INTERFACE / BACKEND / FRONTEND execution contracts.*
</content>
</invoke>
