# app-shell-landing — FRONTEND EXECUTION CONTRACT

> Compressor #3 output. The full FE build spec for the Convexa multi-page restructure + landing page.
> Emitted from UX_BLUEPRINT.md; consumes the EXISTING backend (see INTERFACE_CONTRACT.md —
> `NO_BACKEND_CHANGE`). Self-contained; assume no chat history. The "Tests to write" matrix at the end
> enumerates every required case (each AC × component state) — the FE **implements** this set (a floor)
> and never **chooses** the requirement set (PROJECT_CONTEXT §7).

Backend lane: **`NO_BACKEND_CHANGE`** (BACKEND_EXECUTION_CONTRACT.md is a one-line stub).

---

## 1. What to build (net-new UI) + what to relocate

### Net-new components (the only new UI — ARCHITECTURE §4.2)
1. **`Landing`** — full-bleed splash page at `/`, **outside** the shell. Static (no fetch/SSE). UX_BLUEPRINT §3.
2. **`AppShell`** — persistent nav shell (Convexa wordmark + Ticker/Positions/Scanner + active indicator).
   Chrome only; owns no feature data. Renders the active page into an `<Outlet/>`. UX_BLUEPRINT §2.
3. **`Scanner`** — static "coming soon" placeholder at `/scanner`, inside the shell. **No fetch, no SSE,
   no compute, no backend call.** UX_BLUEPRINT §4.

### Relocated (move, don't change — ARCHITECTURE §4.1)
- **Ticker viewer = today's `TickerDashboard`** → its own module, mounts under `/ticker` inside the shell.
  Internals UNCHANGED. Only permitted edits: (a) module location, (b) route prefix it reads/writes
  (`/` → `/ticker/`, §3), (c) remove the now-redundant inner `<AppBar>GammaFlow</AppBar>`/`TraderApp`
  wrapper that `AppShell` replaces. **Do NOT** touch the SSE/poll lifecycle, the watchdog/offline logic,
  the tiles, the chart, the dialogs, or any child (personas/ghost-trade/ai-rec) internals.
- **Positions page = today's `PortfolioPanel`** (+ `usePortfolio` + `store.ts` + the whole `positions/`
  tree) → mounts under `/positions` inside the shell, **standalone** (no Ticker-page parent). Internals
  UNCHANGED (store, v1→v2 migration, resting-limit lifecycle, Simulated/**LOCKED** Live tabs, customization
  + saved views). Only the mounting location changes + the standalone mark-sourcing wiring (§4).
- **`OperatorMetrics` (`/_ops/metrics`)** — UNCHANGED, off the shell, own AppBar, NOT linked.

---

## 2. Route table (the required shape — ARCHITECTURE §1)

One `<BrowserRouter>` + one `<ThemeProvider>`/`<CssBaseline>` at the app root (`main.tsx`, **unchanged** —
do NOT nest a second router or theme provider; AC-Inv-8). The app root (`App` in `app.tsx`) becomes the
**route table only** (it stops being the GEX dashboard):

| Path | Element | In shell? |
|---|---|---|
| `/_ops/metrics` | `<OperatorMetrics/>` | NO — declared FIRST so `/*` can't shadow it. |
| `/` | `<Landing/>` | NO — full-bleed. |
| (parent route, persistent layout) | `<AppShell/>` with `<Outlet/>` | — shell mounts once. |
| `/ticker` and `/ticker/:symbol` (child) | relocated `<TickerDashboard/>` | YES |
| `/positions` (child) | relocated `<PortfolioPanel/>` standalone wrapper | YES |
| `/scanner` (child) | `<Scanner/>` | YES |

**Persistent layout requirement (binding):** the shell group MUST use a **parent route + nested child
routes** (`<Outlet/>` pattern) so the shell does NOT remount when navigating Ticker↔Positions↔Scanner
(AC-Nav-4). Page content swaps in the outlet; the nav bar (and the Ticker page's mount/unmount, which
drives the live-feed lifecycle) follow from child mount/unmount.

**Ticker URL shape (Q1, binding):** path segment `/ticker/:symbol`; **bare `/ticker` → default `TSLA`**.
The relocated `TickerDashboard` keeps `useParams()` (default `'TSLA'`) and `useNavigate`; the **only** edit
to its navigation is the prefix: `navigate('/' + symbol)` → `navigate('/ticker/' + symbol)`. Navigate-on-
Enter and the one-shot DTE persona pre-fill MUST still fire on explicit symbol navigation (AC-Route-4,
AC-Live-5). Bare-`/ticker` default is satisfied either by a child route + `useParams` default, or an index
redirect to `/ticker/TSLA` — either is acceptable as long as `/` itself is NEVER a redirect to a ticker
(AC-Route-1).

---

## 3. The live-feed lifecycle (THE centerpiece — ARCHITECTURE §3.1)

**The live session is page-scoped to the Ticker viewer and stays inside `TickerDashboard`.** Do NOT hoist
it into `AppShell` or the app root. The structural guarantee:

- The `streamTicker` subscription effect (keyed `[ticker, selected]`, with its cleanup
  `() => { clearTimeout(gapTimer); unsub(); }`) **stays inside the Ticker page component, unchanged.**
- Because the Ticker page is a **child route of the shell**, navigating to `/positions` or `/scanner`
  **unmounts `TickerDashboard`** → the existing cleanup runs → `unsub()` → `es.close()` → backend
  ref-count drops → session tears down (8s grace). **No leak, no background stream, no double-subscribe.**
- Returning to `/ticker*` **remounts** the page → the effect re-runs → a fresh `EventSource` opens (the
  existing cold-start path: `setLive(null); setStreamOffline(false)` on entry, watchdog armed after the
  first payload). Live data resumes.
- **At most one EventSource per symbol at any time** (AC-Live-4). Enforcement is structural: exactly one
  subscription effect, one component instance, cleanup-before-resubscribe. The shell must NOT also
  subscribe. React StrictMode double-invoke in dev is already handled by the existing cleanup — keep it
  intact (do not remove or weaken the effect cleanup during extraction).
- Symbol change (navigate-on-Enter to a new `/ticker/:symbol`) closes the prior feed and opens exactly one
  for the new symbol (AC-Live-5) — same `[ticker, selected]`-dep cleanup, just under the new prefix.
- The watchdog / `streamOffline` / degraded-live behavior is **internal to `TickerDashboard` and NOT
  modified** — `[live-vs-static-isolation]` survives the move (AC-Inv-1).

**Out of scope:** background warm-keep-alive across navigation (Q4 — a separate future feature). Do NOT add it.

---

## 4. Positions store persistence + standalone mark sourcing (ARCHITECTURE §3.2, §4.3 / Q2)

### Durable store (survives nav + reload by construction)
- `positions/store.ts` is a **module-level singleton** over `localStorage` (`gammaflow.positions.v2`,
  loss-free v1→v2 migration) + an in-memory cache. It is **NOT** owned by any React component and is
  mount-independent. Do NOT change `store.ts` or `usePortfolio`'s durability logic. Do NOT introduce any
  page-level or shell-level in-memory durable state that would be lost on navigation.
- **DURABLE (must persist across every route change + reload):** the positions collection, decisions,
  customization (columns/sort/filter, layout/density), named saved views; the ghost-trade durable store
  (`gammaflow.ghost-trade.v1`). (AC-Store-1/2/3/4.)
- **EPHEMERAL (re-derives on remount, by design — acceptable, NOT a regression):** `usePortfolio`'s
  per-row marks, the per-position P/L trend ring buffers (`useTrends`), the session delta. They re-derive
  on remount exactly as on a reload today. (AC-Store-5.)
- A position opened on the **Ticker** page (ghost-trade/portfolio entry) writes through the same singleton,
  so it is **already present** on `/positions` with no prop-drilling/context (AC-Store-4).
- **Brand is UI-only:** do NOT rename the durable store key — positions/views saved before the rebrand
  MUST persist after (AC-Inv-9).

### Standalone mark sourcing (Q2, binding rules)
On `/positions` the page has no Ticker-page parent supplying `live`/`data`/`isLive`/`streamOffline`. Source
marks via the **existing** `GET /api/contract` mechanism (the same way the shipped portfolio already does),
with **degrade-to-last-known**. Binding: (a) **no new backend endpoint / no backend change**; (b) **≤1 SSE
per ticker** at a time (the Ticker page is unmounted while on `/positions`, so a Positions-page stream — if
any — is the only one alive, which is fine; a second SSE is NOT mandated); (c) `[live-vs-static-isolation]`
holds — marks degrade, durable records persist; (d) `SIMULATED` + `[no-real-order-path]` untouched.

**A position is NEVER blanked or dropped because its mark couldn't refresh.** Degraded wording (UX_BLUEPRINT §6):
- Mark refresh fails → row stays, mark/P-L cell dimmed + `⏸ last known`. (AC-PosLive-2.)
- `GET /api/contract` 404 → row stays with durable facts, cell `tracking unavailable`. (AC-PosLive-3.)
- `option_quote: null` → honest fallback mark, cell `no live quote`. (AC-PosLive-4.)
- Success → marks/P-L render normally. (AC-PosLive-1.)

**LOCKED Live tab (AC-Inv-3):** the relocation must NOT add any import/wiring to `LiveTabPanel` — it stays
the zero-import LOCKED placeholder. Everything stays `SIMULATED` (AC-Inv-4).

---

## 5. The new chrome — build spec (copy/visuals from UX_BLUEPRINT §2/§3/§4)

- **`AppShell`** — `AppBar` (`position="static"`, `elevation={0}`, `background.paper`, hairline bottom
  divider). Left: Convexa wordmark + convexity mark (`primary.main` SVG), links to `/`. Entries: `Ticker`
  · `Positions` · `Scanner` with active-route indication (active = `primary.main` text + 2px bottom
  indicator; match `/ticker*`, `/positions`, `/scanner`). **No link to `/_ops/metrics`** (AC-Inv-7).
  Renders `<Outlet/>`. No fetch, no state of its own.
- **`Landing`** — full-bleed dark canvas. Hero (convexity-curve motif background SVG, low opacity; wordmark;
  lead hook "See the AI read on your real positioning."; subhead; **primary CTA "Open the Ticker viewer →"
  → `/ticker`**). Three value-prop cards (Ticker/GEX, Positions sim `SIMULATED`, AI recs) each with a
  secondary CTA into its in-shell route. Honesty band (brokerage-connect coming-soon + non-navigating
  waitlist acknowledgement; Scanner coming-soon). Footer (simulated/paper disclaimer; no `/_ops/metrics`
  link). Static — no fetch/SSE. Renders NO trader nav shell (AC-Nav-5).
- **`Scanner`** — centered outlined `background.paper` card; "Scanner — coming soon" heading + body + muted
  `coming soon` chip + optional "Go to the Ticker viewer →" link. **No fetch, no SSE, no compute, no
  spinner/skeleton** (the absence of any network request is the AC-Scan-1 requirement).

Reuse the existing theme verbatim (UX_BLUEPRINT §0). No second theme provider.

---

## 6. Relocate-don't-change guardrails (do NOT edit these internals)

- Ticker viewer: GEX chart, stat-tile grid, four neutral metric tiles, term structure, fresh positioning,
  off-exchange blocks, setups, SSE/poll lifecycle, watchdog/offline logic, every dialog, personas/
  ghost-trade/ai-rec children — **unchanged** (only location + route prefix + remove the old AppBar wrapper).
- Positions: `store.ts`, v1→v2 migration, resting-limit lifecycle, Simulated/LOCKED-Live tabs,
  customization + saved views, marks/P-L math — **unchanged** (only mount location + standalone mark wiring).
- Operator metrics — **unchanged**, off the shell, unlinked.
- Degraded-state wording on the relocated surfaces must survive **verbatim** (UX_BLUEPRINT §5/§6):
  `⏸ offline`, `⚠ Live offline — reconnecting…`, `Couldn't refresh — showing data from {age} ago…`, the
  cold-start red error + Retry; and the new standalone `⏸ last known` / `tracking unavailable` /
  `no live quote`.

---

## 7. Tests to write (REQUIRED MATRIX — each AC × component state → ≥1 named test)

> PROJECT_CONTEXT §7: the FE does NOT choose the requirement set. This matrix IS the floor. Each row is a
> required named test; the FE may add unit tests (ceiling) but must not drop a row (untestable → GATE-Z
> bounce). QA traces every AC to ≥1 named passing test at GATE Q. Vitest + jsdom + Testing Library; mock
> only the network/SSE boundary (never a live backend). Use `MemoryRouter`/`initialEntries` for routing,
> a mock `EventSource` for the live-feed lifecycle, and a seeded `localStorage` for store persistence.
> The **live-feed lifecycle flow-integration test** is the centerpiece.

| # | AC | Named test (suggested) | Asserts (component state) |
|---|---|---|---|
| 1 | AC-Route-1 | `routes › "/" renders Landing, not a ticker redirect` | `Landing` default at `/`; brand+hook+value+CTA present; **no** redirect to `/ticker`/`/TSLA`. |
| 2 | AC-Route-2 | `routes › "/ticker/TSLA" renders Ticker viewer in shell` | `AppShell` + `Ticker` default for TSLA. |
| 3 | AC-Route-3 | `routes › bare "/ticker" defaults to TSLA` | `Ticker` default resolves TSLA. |
| 4 | AC-Route-4 | `routes › "/ticker/AAPL" deep-links AAPL` | `Ticker` default for non-default symbol. |
| 5 | AC-Route-5 | `routes › "/positions" renders Positions in shell` | `AppShell` + `Positions` default. |
| 6 | AC-Route-6 | `routes › "/scanner" renders static coming-soon in shell` | `AppShell` + `Scanner` default. |
| 7 | AC-Route-7 | `routes › "/_ops/metrics" renders operator surface off the shell` | `OperatorMetrics` own AppBar, no product nav; nav shows no link to it. |
| 8 | AC-Nav-1 | `nav › persistent nav present on ticker/positions/scanner` | `AppShell` default — wordmark + 3 entries visible on each. |
| 9 | AC-Nav-2 | `nav › entries navigate between pages` | Click Positions/Ticker/Scanner → route + page renders. |
| 10 | AC-Nav-3 | `nav › active-route indicator on current entry` | Active entry indicated per current path. |
| 11 | AC-Nav-4 | `nav › shell does not remount across in-shell pages` | Ticker→Positions→Scanner→Ticker keeps the same shell instance (no remount/flash). |
| 12 | AC-Nav-5 | `nav › landing renders no trader nav shell` | `/` has no nav bar (full-bleed). |
| 13 | AC-Land-1 | `landing › shows Convexa wordmark + lead hook` | Hero default. |
| 14 | AC-Land-2 | `landing › shows today-working value props` | Ticker/GEX + Positions sim + AI recs cards. |
| 15 | AC-Land-3 | `landing › primary CTA enters the app at /ticker` | Click → `/ticker` inside shell. |
| 16 | AC-Land-4 | `landing › secondary CTAs navigate to in-shell routes (no dead-end)` | Each value-prop CTA → its route renders. |
| 17 | AC-Land-5 | `landing › brokerage connect is coming-soon, not a working button` | Waitlist affordance shows coming-soon/waitlist intent; does NOT enter a broker flow or dead-end (resting → acknowledged state). |
| 18 | AC-Land-6 | `landing › Scanner presented as coming-soon` | Scanner shown as future capability (consistent with `/scanner`). |
| 19 | AC-Live-1 | `live-lifecycle › entering Ticker opens exactly one EventSource` | One mock EventSource opened for the symbol. |
| 20 | AC-Live-2 | `live-lifecycle › nav-away closes the feed (no leak)` | `es.close()` called; no second open; no background stream. |
| 21 | AC-Live-3 | `live-lifecycle › return reopens a fresh feed` | New EventSource opened on return (cold-start path); live resumes. |
| 22 | AC-Live-4 | `live-lifecycle › never two concurrent feeds (round-trip)` | At no point are two open EventSources for the same symbol. |
| 23 | AC-Live-5 | `live-lifecycle › symbol change single-subscribes` | navigate-on-Enter to new symbol closes prior + opens exactly one new. |
| 24 | AC-Store-1 | `store › position survives navigation` | Open position, nav away+back → present. |
| 25 | AC-Store-2 | `store › position survives reload` | Open position, remount/reload → present. |
| 26 | AC-Store-3 | `store › customization + saved views survive nav + reload` | Columns/sort/filter/density + named views persist. |
| 27 | AC-Store-4 | `store › Ticker-page entry already present on /positions` | Open via Ticker → present on `/positions` (same singleton). |
| 28 | AC-Store-5 | `store › ephemeral trends/session-delta re-derive; durable facts persist` | Sparkline/session delta reset on remount; entry/realized + position persist. |
| 29 | AC-PosLive-1 | `positions-marks › marks populate from GET /api/contract` | `Positions` default — marks/P-L render from the existing source. |
| 30 | AC-PosLive-2 | `positions-marks › refresh failure → ⏸ last known, never blanked` | Degraded — row stays, `⏸ last known`. |
| 31 | AC-PosLive-3 | `positions-marks › 404 → tracking unavailable, row kept` | Degraded — `tracking unavailable`; page does not error. |
| 32 | AC-PosLive-4 | `positions-marks › null quote → no live quote fallback` | Degraded — `no live quote`; no throw. |
| 33 | AC-Scan-1 | `scanner › static coming-soon, no network` | `Scanner` default; assert **no** fetch/EventSource is created when shown. |
| 34 | AC-Inv-1 | `invariants › Ticker live-degrade still works` | SSE drop → live tiles dim + `⏸ offline`; static bundle keeps rendering. |
| 35 | AC-Inv-2 | `invariants › Ticker cold-start = only blank; page-isolated` | Cold-start → red error + Retry; post-success → soft "Couldn't refresh"; error does not blank shell/other pages. |
| 36 | AC-Inv-3 | `invariants › Positions Live tab stays LOCKED` | Zero-import LOCKED placeholder; no broker/order/data wiring. |
| 37 | AC-Inv-4 | `invariants › everything stays SIMULATED` | No real-order path reachable on Positions/Ticker. |
| 38 | AC-Inv-5 | `invariants › scoring untouched (byte-identical)` | Tier/score readouts identical for a given bundle pre/post relocation. |
| 39 | AC-Inv-6 | `invariants › best-effort isolation preserved` | Each nullable surface (off-exchange, four metrics, ghost-trade, ai-rec, personas, positions store) → own unavailable/empty state, no throw into page/shell. |
| 40 | AC-Inv-7 | `invariants › operator path separation preserved` | `/_ops/metrics` off the shell, unlinked, read-only; nav doesn't reach it. |
| 41 | AC-Inv-8 | `invariants › single router + single theme provider` | No duplicate-router/duplicate-theme error; nav+deep-links+theming consistent. |
| 42 | AC-Inv-9 | `invariants › brand swap is UI-only (store key unchanged)` | Positions/views seeded under the existing key before rebrand are present after. |

**Coverage statement:** all 42 enumerated ACs in PRODUCT_CONTRACT §4 (Route 1–7, Nav 1–5, Land 1–6,
Live 1–5, Store 1–5, PosLive 1–4, Scan 1, Inv 1–9) are mapped to ≥1 named test above. (The brief's "41"
is an off-by-one of this same set; every AC present is covered.)

---

## 8. Consumes (reference INTERFACE_CONTRACT.md)

Existing endpoints only, unchanged: `GET /api/ticker/{ticker}` + SSE (relocated Ticker viewer, page-scoped),
`GET /api/contract/{ticker}` (standalone Positions marks, Q2), `GET /api/recommendation/*` + `GET
/api/personas` (relocated Ticker children), `GET /api/_metrics` (operator surface, off the shell). The new
`Landing`, `AppShell`, and `Scanner` touch the backend **not at all**. `NO_BACKEND_CHANGE`.
