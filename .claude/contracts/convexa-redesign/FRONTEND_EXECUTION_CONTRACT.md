# FRONTEND_EXECUTION_CONTRACT — convexa-redesign · SURFACE: Positions

> Per-surface contract (overwrites the prior Scanner one; Landing + Settings/Auth + Scanner are shipped).
> Implement-from-Figma. **Complete re-design / re-write of the Positions portfolio UI.**
> **NO_BACKEND_CHANGE · NO_INTERFACE_CHANGE.** Presentation-only restructure + re-skin — the data flow,
> durable store, mark/P-L math, gating, and the LOCKED Live tab are PRESERVED EXACTLY.
> Authority: `design_handoff_convexa_redesign/README.md` §4 + the three Figma frames
> **"Positions - Table" (`4:2143`)**, **"Positions - Cards" (`4:2429`)**, **"Positions - Live (Locked)" (`4:2497`)**.
> The conductor inspected all three frames + the authoritative frame source (`figma_frames/05/06/07` →
> `screenPositions()`); this contract carries every pixel value (the lane has NO live Figma access).

## REVISION 1 (owner decision 2026-06-29) — default table columns MATCH THE MOCK
> Supersedes the "Table/cards stay column-driven / keep DEFAULT_COLUMNS / `types.ts`+`defaults.ts` DO-NOT-TOUCH"
> stance below. The baseline re-skin shipped (commit `9336856`); this revision re-models the **default visible
> column set** to the Figma frame. **`types.ts` + `defaults.ts` ARE now editable for the column model ONLY**
> (no store/derive/mark/gating change; positions still never feed scoring; saved-view persistence still works).
- **New `DEFAULT_COLUMNS`** (left→right, exactly the mock): `contract` (header **"Ticker"**) · `strategy` ·
  `qty` · `entry` · `mark` · `pl` · `pl_pct` · `delta_entry` · `trend` · `expiry`. Plus the existing trailing
  **actions cell** (per-row **Close** for open/pending) — keep it (the frame's trailing empty `th`).
- **Split P/L:** add a new `ColumnKey` **`pl_pct`** (label "P/L %", renders the % only, `success/error` by sign,
  mono, dims offline). Change the existing `pl` column to render the **$ amount only** (label **"P/L"**), mono,
  colored, dims offline. (`SortKey` already has `pl_dollar`/`pl_pct` — reuse; sorting unchanged.)
- **Slim the `contract` cell** to the frame's "Ticker" style: **bold mono symbol** + secondary `$400 Call`
  (strike + Call/Put) ONLY — drop the inline `· exp … · Long ×N` (that info now lives in the `strategy`/`qty`/
  `expiry` columns + the card footer). Apply to BOTH table + the cards' top row.
- **Move to OPTIONAL (not default-visible, still available via the Columns menu):** `simulated`, `status`,
  `mode`, `session_delta`. SIMULATED/paper honesty is carried by the tab **PAPER** badge + the `positions-disclosure`
  (both already present) — so dropping the per-row `simulated` column from the default view is fine.
- Keep every other invariant + the gating/lock/offline behavior. Update `defaults.spec.ts` + any test asserting the
  old default set or `pl`-combined; keep AC↔test coverage; `nx test dashboard` green.

## Token map (frame CSS var → MUI/theme — NEVER hardcode a hex except the documented literals)
| frame var | value | use as |
|---|---|---|
| `--panel` | `#161b22` | `background.paper` (sx `bgcolor: 'background.paper'`) |
| `--panel2` | `#1c2330` | `extras.panelRaised` (sx literal — toolbar/segmented/group-header bg) |
| `--line` | `#222b38` | `divider` (subtle row/table borders) |
| `--line2` | `#2d3845` | stronger control/table-outer border — use `divider` (diff is negligible) |
| `--tx` | `#e6edf3` | `text.primary` |
| `--tx2` | `#8b949e` | `text.secondary` |
| `--tx3` | `#5b6675` | `text.disabled` |
| `--blue` | `#4f9cff` | `primary.main`; dark text on blue = `primary.contrastText` (`#0a0f16`) |
| `--green` | `#2ecc71` | `success.main` |
| `--red` | `#ff5c5c` | `error.main` |
| `--amber` | `#f0a020` | `warning.main` + the documented amber-alpha tints (as on Scanner) |
| `--r` | `10px` | the card/control radius (theme `shape.borderRadius` = 10) |
Mono numerics: the existing mono font (`tokens.typographyTokens.monoFontFamily`) with `tabular-nums`, as today.

## Scope — files
**Re-skin/restructure (UI only — keep every prop/handler/wiring):**
`positions/PositionsPage.tsx`, `PortfolioPanel.tsx`, `PositionsView.tsx`, `PositionRow.tsx`,
`CustomizationToolbar.tsx`, `LiveTabPanel.tsx`, `PlSparkline.tsx`, and update the colocated `*.spec.tsx`.
**DO NOT TOUCH (logic/wiring — read them to bind, never change behavior):** `usePortfolio.ts`, `derive.ts`,
`store.ts`, `entry.ts`, `useTrends.ts`, `labels.ts`, `defaults.ts`, `types.ts`, and `../ghost-trade/mark.ts`.
Read each component you edit FIRST to learn its current props/handlers; this is a re-skin of presentation, the
data/handlers stay identical.

## Structure (match the frame) — page composition
The `/positions` page (`PositionsPage.tsx`) is a centered **1240px** content column (`maxWidth 1240, mx auto, p 3`).
Top-to-bottom: **(1) page header**, **(2) Simulated/Live tabs**, then per active tab either the **locked Live
panel** or the **(3) toolbar → (4) status-pill row → (5) table | cards**.

### (1) Page header — `PositionsPage.tsx`
A flex row (`alignItems:'flex-start'`, `justifyContent:'space-between'`, `flexWrap:'wrap'`, `gap:'12px'`, `mb:'6px'`):
- **Left:** `h1` **"Positions"** (`fontSize:'1.7rem'`, `fontWeight:700`, `m:'0 0 4px'`) + subtitle `p`
  (`fontSize:'0.88rem'`, `color:'text.secondary'`) **verbatim**: `Your simulated book — paper-only, persisted in
  this browser. Live marks degrade gracefully; records never drop.`
- **Right** (`textAlign:'right'`): label **"Net P/L (open)"** (`0.72rem`, `text.secondary`) + a **mono** value
  (`1.5rem`, `700`, `success.main` if ≥0 else `error.main`, **`opacity:0.5` when `streamOffline`**),
  `data-testid="positions-net-pl"`. Value = **sum of the OPEN positions' P/L** (compute from `pf.rows` / the same
  P/L the rows show — reuse `pf`'s derived P/L; do NOT recompute via a new path). Format
  `(v>=0?'+$':'−$') + Math.abs(v).toLocaleString()` (e.g. `+$1,085`, real minus sign `−`).

### (2) Tabs — `PortfolioPanel.tsx` (replaces the old `<Tabs>` + the "Positions portfolio" Card heading)
Underline tabs in a row (`display:'flex'`, `borderBottom:'1px solid'`, `borderColor:'divider'`, `mt:'20px'`).
**Remove the outer `Card`/"Positions portfolio"/`SIMULATED`-chip chrome** — the frame has the tabs directly under
the page header. Keep `data-testid="tab-simulated"` + `tab-live` and the `tab` state + switch behavior (no fetch,
no mutation on switch).
- **Simulated** (`tab-simulated`): underline `2px` `primary.main` when active else transparent; color
  `primary.main` active else `text.secondary`; `0.9rem/600`, `padding:'10px 4px'`; followed by a **green `PAPER`
  badge** (`0.62rem/700`, `success.main`, `border:'1px solid'` `borderColor` `success.main`@0.4 alpha,
  `borderRadius:'4px'`, `padding:'1px 5px'`).
- **Live** (`tab-live`): `marginLeft:'18px'`; label **`🔒 Live`**; color `text.primary` active else `text.disabled`;
  same underline rule.

### Locked Live panel — `LiveTabPanel.tsx` (KEEP THE ZERO-IMPORT LOCK; re-skin only)
**CRITICAL — the zero-import boundary is the `no-real-order-path` enforcement:** this module must keep importing
ONLY `@mui/material` + the static copy constants (`labels.ts`). Do NOT add any store/mark/fetch/SSE import. Re-skin
to the frame (it reuses the Scanner hatched-card pattern): a centered hatched inert box (`mt:'24px'`,
`background: 'repeating-linear-gradient(135deg, #161b22 0 18px, #14181f 18px 36px)'` — reuse `ui/ComingSoonBox`,
overriding `data-testid="live-locked-panel"`; **18px stripes here per this frame**), `border:'1px dashed' divider`,
`borderRadius` 10, `padding:'48px'`, `textAlign:'center'`:
- `🔒` glyph (`fontSize:'1.6rem'`, `mb:'10px'`).
- `h3` **"Live positions — coming soon"** (use `LIVE_HEADING` if it matches; `1.15rem/700`, `m:'0 0 8px'`).
- body `p` (`maxWidth:440`, `mx:'auto'`, `0.9rem`, `text.secondary`, `lineHeight:1.55`) — use `LIVE_BODY` verbatim:
  `Connecting a real brokerage to track the risk you're actually carrying is on the roadmap. For now, everything in Convexa is simulated (paper).`
  (If `LIVE_BODY`/`LIVE_HEADING` differ from the frame copy, KEEP the existing `labels.ts` strings — honesty copy is
  authoritative over the mock — and note the diff; do not edit `labels.ts`.)
- The amber **"coming soon"** pill (same style as Scanner: `0.68rem/600` uppercase, `warning.main`, border
  `rgba(255,167,38,0.35)`, bg `rgba(255,167,38,0.08)`, `borderRadius:999`, `padding:'3px 10px'`,
  `display:'inline-block'`, `mt:'14px'`). Keep `data-testid="live-lock-chip"`.
Keep it structurally inert: present + selectable, no data, no network, no entry/order affordance.

### (3) Toolbar — `CustomizationToolbar.tsx` (keep ALL wiring; re-lay-out to the frame)
`mt:'18px'`. Row of controls (`display:'flex'`, `alignItems:'center'`, `gap:'10px'`, `flexWrap:'wrap'`, `mb:'6px'`):
1. **View picker** (saved views) — a `selectBox`: `bgcolor:'background.paper'`, `border:1px divider`,
   `borderRadius:8`, `padding:'7px 11px'`, `fontSize:'0.8rem'`: small label **"View"** (`text.disabled`,`0.68rem`) +
   the active view name (`600`) + a `▾`. Keep the unsaved-change dot + save-as/rename/delete menu wiring and the
   `guardSaveView` server-gate (AC-E7). Default builtin view name "All positions".
2. a thin vertical divider (`width:1px`, `height:20px`, `bgcolor:'divider'`).
3. **Table / Cards** segmented (MUI `ToggleButtonGroup` exclusive, or buttons): container `bgcolor:'panelRaised'
   (#1c2330)`, `border:1px divider`, `borderRadius:8`, `padding:3`, `gap:3`; each seg `padding:'6px 12px'`,
   `0.78rem/600`, `borderRadius:7`; active = `text.primary` + `bgcolor` panelRaised + `1px divider` border; inactive
   = transparent + `text.secondary`. Wire to `working.layout` (`table`|`card`).
4. **Comfortable / Compact** segmented — same styling; wire to `working.density`.
5. **Group** segmented — same container; a leading `Group` label (`0.68rem`, `text.disabled`), then **None ·
   Ticker · Strategy · Expiry** (keep all 4 per README §4 + `GroupAxis`; the frame trimmed Expiry for space).
   Wire to `working.group`.
6. **Columns** menu — keep the existing columns selector affordance (README §4) as a button in the toolbar
   (same `selectBox`/seg styling), wiring unchanged.
7. a flex spacer (`flex:1`), then the primary CTA **"+ Open simulated position"** — a **blue pill button** on the
   right: `bgcolor:'primary.main'`, `color:'primary.contrastText'`, `padding:'8px 15px'`, `borderRadius:8`,
   `0.82rem/700`, `whiteSpace:'nowrap'`. This REPLACES the old separate `<Button>Open simulated position</Button>`
   Stack in `PortfolioPanel` — move that handler (`requestOpenEntry`, gated) onto this toolbar button. Keep
   `data-testid="open-entry"` on it.

### (4) Status-pill row — below the toolbar (`display:'flex'`, `gap:'6px'`, `flexWrap:'wrap'`, `mb:'14px'`)
- Four **status filter pills** `open · pending · closed · cancelled` (`0.74rem/600`, `borderRadius:999`,
  `padding:'3px 11px'`, `cursor:pointer`): **active** = `bgcolor:'primary.main'` + `color:'primary.contrastText'` +
  `border:1px primary.main`; **inactive** = transparent + `text.secondary` + `1px divider`. Wire to
  `working.filter.status` (multi-select; default `['open']`) — same filter wiring as today.
- a **"History"** link (`0.78rem`, `primary.main`, `cursor:pointer`, `ml:'4px'`) — keep the existing history-view
  behavior (closed+cancelled).
- **Offline banner** (only when `streamOffline`): a single line `⚠ Live marks paused — P/L shown is from the last
  update. Records persist.` (`0.78rem`, `warning.main`, `mb:'10px'`).

### (5a) Table view — `PositionsView.tsx` + `PositionRow.tsx`
Outer: `bgcolor:'background.paper'`, `border:1px divider`, `borderRadius` 10, `overflow:'hidden'`. A `<table>`
(`width:100%`, `borderCollapse:'collapse'`).
- **`thead th`** (left-aligned, `padding:'11px 12px'`, `0.7rem/600`, `letterSpacing:'.03em'`, `textTransform:
  uppercase`, `color:'text.secondary'`, `borderBottom:1px divider`, `whiteSpace:nowrap`) + a trailing empty `th`.
  Columns (default order): **Ticker · Strategy · Qty · Entry · Mark · P/L · P/L % · Δ entry · Trend · Expiry**
  (driven by `working.columns`; respect the user's column selection/order — these are the default visible set).
- **Row cells** (`td`: `padding` comfortable `12px` / compact `7px 12px`, `0.86rem`, `borderBottom:1px divider`,
  `whiteSpace:nowrap`):
  - **Ticker**: flex gap 7 → mono `600` symbol + `text.secondary` `0.8rem` leg (e.g. `$400 Call`).
  - **Strategy**: `0.78rem text.secondary` (e.g. `Long call`).
  - **Qty**: mono (e.g. `5 ×`).
  - **Entry**: mono `text.secondary`.
  - **Mark**: mono — **`opacity:0.5` when `streamOffline`** (live cell).
  - **P/L**: mono `600`, `success.main`/`error.main` by sign — **`opacity:0.5` offline**.
  - **P/L %**: mono, same color — **`opacity:0.5` offline**.
  - **Δ entry**: mono `text.secondary`.
  - **Trend**: the `PlSparkline` (broken-line, `connectNulls={false}`, green/red by last value) — re-skin only.
  - **Expiry**: `0.8rem text.secondary` (e.g. `Jul 18 · 19d`).
- **Group header row** (when `working.group !== 'none'`): a full-width `td` (`colSpan = cols+1`), `bgcolor:
  'panelRaised'`, `padding:'8px 12px'`, `0.78rem/600`: `{label} ({count})` + `Subtotal ` (`text.secondary`,`400`) +
  mono subtotal (`success.main`/`error.main` `600`). Subtotals come from `deriveGroups` — wiring unchanged.

### (5b) Cards view — `PositionsView.tsx` (`working.layout === 'card'`)
A column (`display:'flex'`, `flexDirection:'column'`, `gap` grouped `18px` else `12px`). Per group: an optional group
header line (grouped: `0.82rem/600` `{label} ({count}) · Subtotal {mono}`), then a **2-col grid**
(`gridTemplateColumns:'repeat(2, 1fr)'`, `gap:'12px'`). Each card: `bgcolor:'background.paper'`, `border:1px
divider`, `borderRadius` 10, `padding:'15px'`:
- **Top row** (`flex`, `alignItems:center`, `justifyContent:space-between`, `mb:'12px'`): left flex gap 8 → mono
  `700`/`1rem` symbol + `text.secondary` `0.85rem` leg; right a strategy chip (`0.7rem`, `text.disabled`, `border:1px
  divider`, `borderRadius:5`, `padding:'2px 7px'`, e.g. `Long call`).
- **Middle row** (`flex`, `alignItems:flex-end`, `justifyContent:space-between`, **`opacity:0.5` offline**): left a
  mono **`1.5rem/700`** P/L (`success.main`/`error.main`) + below a mono `0.85rem` P/L % (same color); right the
  `PlSparkline`.
- **Footer row** (`flex`, `gap:'16px'`, `mt:'12px'`, `pt:'12px'`, `borderTop:1px divider`, `0.76rem text.secondary`):
  `Qty {mono text.primary}` · `Entry {mono}` · `Mark {mono}` · (`marginLeft:auto`) `{exp} · {dte}d`.

### Empty / filtered-empty / history states (KEEP — never blank)
Preserve the existing copy + testids for: no positions (`Open one to start your book.` + an Open CTA),
filtered-empty (a clear-filter affordance), and the history view. Re-skin to the new card/table styling; do not drop
any state.

## Invariants (HARD — verify in tests; PROJECT_CONTEXT §5)
- **`NO_BACKEND_CHANGE` / `additive-keeps-score-byte-identical`** — positions/customization/views are NEVER an input
  to signals/score/tier/`state_fingerprint`. No new fetch/SSE; the page sourcing (`getTicker`/`streamTicker`/
  `fetchTrackedContract`) is unchanged.
- **`no-real-order-path`** — everything stays `SIMULATED` (paper). The **Live tab keeps its zero-import LOCK** (no
  store/mark/fetch/SSE import in `LiveTabPanel`); no real-order affordance anywhere.
- **`server-side-gate-enforcement`** — the open-position confirm + save-view writes keep awaiting the **server gate**
  (`gate.guard(..., { serverGate: gate.simTradeGate })` / `POST /api/positions/sim-trade/gate`) BEFORE the local
  write. The FE check is UX only; a 403 must still abort the write. Keep `positions-signin-prompt` + the gating flow.
- **`live-vs-static-isolation`** — live-derived cells (Mark / P/L / P/L % / Net P/L) **dim to `opacity:0.5` + the
  offline banner** on `streamOffline`; static cells (Ticker/Strategy/Qty/Entry/Δ entry/Expiry) keep rendering;
  durable records are NEVER blanked/zeroed/dropped.
- **Honest browser-local disclosure (D6d, MANDATORY)** — KEEP the `positions-disclosure` copy
  (`AUTH_COPY.positions.disclosure`, verbatim) somewhere on the Simulated surface (a subtle info line is fine; it need
  not be a loud banner, but it must be present — it is a data-residency honesty requirement the frame omits).
- Tokens via theme; the only sx literals are `panelRaised`/`hatchAlt` (`#1c2330`/`#14181f`), the badge amber-alpha
  tints, and `primary.contrastText` `#0a0f16` for dark-on-blue.

## Tests (`positions/*.spec.tsx`) — this is a re-write, so update UI-coupled tests; keep behavior covered
- **Behavioral/invariant specs MUST stay green (update selectors, not assertions):** the gating flow
  (`positions-portfolio.flow.spec.tsx` server-gate + sign-in prompt + 403-abort), no-real-order
  (`no_real_order_path_anywhere_simulated_unmistakable`, the Live zero-import lock), durable persist/reload + v1→v2
  migration, derive/sort/group/subtotal (`derive.spec.ts` — should be untouched), offline degradation
  (`feed_drop_*`), score/tier/fingerprint byte-identity, and the entry/limit-fill logic (`entry.spec.ts`,
  `PositionEntryDialog.spec.tsx` — untouched).
- **Add/adjust component tests** for the new structure: page header **Net P/L (open)** readout (sign color +
  offline dim, `positions-net-pl`), underline tabs + PAPER badge, the toolbar controls (View/Table-Cards/density/
  Group/Columns wire to `working.*`), the status pills (multi-select default `['open']`), table columns + group
  header subtotals, cards layout, the Live locked panel (re-skinned, lock intact).
- Keep AC↔test traceability (every README §4 behavior maps to ≥1 named test). Run `npx nx test dashboard` —
  **all green** (`export PATH="/c/nvm4w/nodejs:$PATH"` first).

## Verify
`git diff` scope = the 7 `positions/*.tsx` files + their specs ONLY (no logic files, no other surface). **Do NOT
commit** — the conductor renders all three states (Table / Cards / Live, + an offline pass) via the Claude_Preview
MCP against the frames, then commits.

## Reference
- README §4 (Positions) — structure/copy authority. See [[convexa-redesign-spec-authority]].
- Figma frames `4:2143` (Table) · `4:2429` (Cards) · `4:2497` (Live-locked); frame source `figma_frames/05/06/07` →
  `screenPositions()`. This contract carries the exact px values (the lane has no live Figma).
- `FIGMA_COMPONENT_MAP.md` — PositionRow (`34:72`), Top-nav (`36:41`), Tabs segmented (`33:222`), TradeEntryDialog
  (`42:141`). The data model is `positions/types.ts`; the brain is `usePortfolio.ts`; derivation is `derive.ts`.
