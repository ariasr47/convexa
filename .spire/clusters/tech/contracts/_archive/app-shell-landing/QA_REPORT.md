# app-shell-landing — QA REPORT (GATE Q)

> QA role: fresh session, no builder context. Verified 2026-06-24.
> Test command: `npx nx test dashboard --reporter=verbose`
> Result: **171 tests PASSED / 0 FAILED / 14 test files** — suite is GREEN.
> Interface conformance: NO_BACKEND_CHANGE posture — no new endpoint, no conformance spec emitted.
>   The standing `interface_conformance.py` tool has nothing new to assert for this feature.
> Lane check: `git diff HEAD~1 HEAD -- apps/api` → empty (zero diff). `.claude/contracts/_archive` → unmodified by this commit.
> Brand-is-UI-only: durable keys `gammaflow.positions.v2` (V2_KEY in store.ts:23) and `gammaflow.ghost-trade.v1` (STORAGE_KEY in ghost-trade/store.ts:9) are unchanged. No package, folder, or code identifier renamed.

---

## Acceptance criteria — verdict table

| # | AC (verbatim) | Verdict | Evidence |
|---|---|---|---|
| 1 | **AC-Route-1** — Navigating to `/` renders the Convexa landing page (brand + hook + value props + a primary CTA). `/` does NOT redirect to a ticker. | **PASS** | `app.spec.tsx › routes › "/" renders Landing, not a ticker redirect` (PASSES). Asserts `landing` testid present, hook text present, `vp-ticker` present, `cta-primary` present, `app-shell` absent, `fetchMock` not called. `Landing.tsx` confirmed static + full-bleed. |
| 2 | **AC-Route-2** — Navigating to `/ticker/TSLA` renders the Ticker viewer (the GEX dashboard) for TSLA, inside the persistent nav shell. | **PASS** | `app.spec.tsx › routes › "/ticker/TSLA" renders Ticker viewer in shell` (PASSES). Asserts `app-shell` present + `Call wall` text found + fetch to `/api/ticker/TSLA` made. `app.tsx` route table confirmed: `<Route path="/ticker/:ticker" element={<TickerDashboard />} />` inside `<AppShell>`. |
| 3 | **AC-Route-3** — Navigating to a bare `/ticker` (no symbol) renders the Ticker viewer for the default symbol TSLA. | **PASS** | `app.spec.tsx › routes › bare "/ticker" defaults to TSLA` (PASSES). Confirms `<Navigate to="/ticker/TSLA" replace />` index redirect in `app.tsx` line 42; fetch to `/api/ticker/TSLA` verified. |
| 4 | **AC-Route-4** — Navigating directly to `/ticker/AAPL` renders the Ticker viewer for AAPL (URL-addressable / shareable). | **PASS** | `app.spec.tsx › routes › "/ticker/AAPL" deep-links AAPL` (PASSES). Asserts `Call wall` rendered + fetch to `/api/ticker/AAPL` + input has value `AAPL`. `navigate('/ticker/' + symbol)` confirmed in `TickerDashboard.tsx:403`. |
| 5 | **AC-Route-5** — Navigating to `/positions` renders the positions portfolio page, inside the persistent nav shell. | **PASS** | `app.spec.tsx › routes › "/positions" renders Positions in shell` (PASSES). Asserts `app-shell` + `portfolio-panel` testids present. `PositionsPage.tsx` confirmed as standalone wrapper for `PortfolioPanel`. |
| 6 | **AC-Route-6** — Navigating to `/scanner` renders the static "coming soon" Scanner placeholder, inside the persistent nav shell. | **PASS** | `app.spec.tsx › routes › "/scanner" renders static coming-soon in shell` (PASSES). Asserts `app-shell` + `scanner-placeholder` + text `Scanner — coming soon`. |
| 7 | **AC-Route-7** — Navigating to `/_ops/metrics` renders the operator metrics surface with its own AppBar, outside the product nav shell, exactly as before. The product nav does not show or link to it. | **PASS** | `app.spec.tsx › routes › "/_ops/metrics" renders operator surface off the shell` (PASSES). Asserts `Operator Metrics` text present + `app-shell` absent + `nav-ticker` absent. Route declared FIRST in `app.tsx:34` so `/*` cannot shadow it. |
| 8 | **AC-Nav-1** — On any of `/ticker*`, `/positions`, `/scanner`, the persistent nav (Convexa wordmark + Ticker / Positions / Scanner entries) is visible. | **PASS** | `app.spec.tsx › nav › persistent nav present on ticker/positions/scanner` (PASSES). Loops over all three paths, asserts `shell-brand`, `nav-ticker`, `nav-positions`, `nav-scanner`, and `Convexa` wordmark within the brand element on each. |
| 9 | **AC-Nav-2** — From `/ticker/TSLA`, clicking the Positions nav entry navigates to `/positions` and renders the Positions page; clicking Ticker returns to the Ticker viewer; clicking Scanner goes to the Scanner placeholder. | **PASS** | `app.spec.tsx › nav › entries navigate between pages` (PASSES). Full click-through: Scanner start → click Positions → `portfolio-panel` → click Ticker → `Call wall` → click Scanner → `scanner-placeholder`. |
| 10 | **AC-Nav-3** — The nav indicates which of Ticker / Positions / Scanner is the active/current page. | **PASS** | `app.spec.tsx › nav › active-route indicator on current entry` (PASSES). At `/positions`: `nav-positions` has `aria-current="page"`, `nav-ticker` and `nav-scanner` do not. `AppShell.tsx` confirmed: `aria-current={isActive ? 'page' : undefined}` + 2px bottom indicator + `primary.main` color. |
| 11 | **AC-Nav-4** — Navigating Ticker → Positions → Scanner → Ticker keeps the same nav shell mounted (the chrome does not flash/reload between the three pages). | **PASS** | `app.spec.tsx › nav › shell does not remount across in-shell pages` (PASSES). Captures `shell` DOM node reference before navigation; asserts `screen.getByTestId('app-shell') === shell` (same node) after Positions → Ticker → Scanner cycle. Structural guarantee: `<AppShell>` is parent route with `<Outlet/>`. |
| 12 | **AC-Nav-5** — The `/` landing page does not render the trader nav shell (it is its own full-bleed page). | **PASS** | `app.spec.tsx › nav › landing renders no trader nav shell` (PASSES). Asserts `app-shell` and `nav-ticker` are null at `/`. `Landing.tsx` renders `Box[data-testid="landing"]` with no `AppShell` import or usage. |
| 13 | **AC-Land-1** — The landing page shows the Convexa wordmark and the lead hook ("AI reads on your real positioning," wording-final per UX). | **PASS** | `app.spec.tsx › landing › shows Convexa wordmark + lead hook` (PASSES). Asserts `getAllByText('Convexa').length > 0` + `getByText('See the AI read on your real positioning.')`. `Landing.tsx:109`: hero `<Typography>` contains exact hook string; `ConvexaMark` renders the wordmark. |
| 14 | **AC-Land-2** — The landing page shows value-prop content covering the today-working capabilities: Ticker/GEX analysis, the simulated Positions portfolio, and AI recommendations. | **PASS** | `app.spec.tsx › landing › shows today-working value props` (PASSES). Asserts within `vp-ticker` the text `Ticker / GEX analysis`, within `vp-positions` the text `Simulated positions portfolio`, within `vp-airec` the text `AI recommendations`. `Landing.tsx:33-77`: three `VALUE_PROPS` entries confirmed with these exact titles. |
| 15 | **AC-Land-3** — The landing page shows a clear primary CTA; activating it navigates into the working app (the Ticker viewer at `/ticker`), landing inside the nav shell. | **PASS** | `app.spec.tsx › landing › primary CTA enters the app at /ticker` (PASSES). Clicks `cta-primary`, then asserts `app-shell` and `Call wall` are present. `Landing.tsx:119-129`: `Button` with `component={RouterLink}` to `/ticker` and `data-testid="cta-primary"`. |
| 16 | **AC-Land-4** — Any value-prop secondary CTA (e.g. into Positions) navigates to its in-shell route and renders that page. (No value-prop CTA may dead-end.) | **PASS** | `app.spec.tsx › landing › secondary CTAs navigate to in-shell routes (no dead-end)` (PASSES). Tests `vp-positions-cta` → `portfolio-panel` and `vp-ticker-cta` → `Call wall`. `Landing.tsx:149-156`: each card renders a `<Link component={RouterLink}>` to its `ctaTo` route. |
| 17 | **AC-Land-5** — The landing page presents connecting a real brokerage / "connect your positions" as coming soon / waitlist — it is not a working button that navigates into a broker flow or dead-ends. Activating any such affordance does NOT enter a broker connection (it shows coming-soon/waitlist intent only). | **PASS** | `app.spec.tsx › landing › brokerage connect is coming-soon, not a working button` (PASSES). Asserts `brokerage-block` contains chip `coming soon`; clicking `waitlist-button` shows `waitlist-ack` in-place; still on landing (`landing` testid present); `fetchMock` not called. `Landing.tsx:176-200`: `onClick={() => setWaitlisted(true)}` — no navigate, no fetch, pure in-place state transition. |
| 18 | **AC-Land-6** — The Scanner is presented as a future capability (coming-soon), consistent with the placeholder route (not as a working feature). | **PASS** | `app.spec.tsx › landing › Scanner presented as coming-soon` (PASSES). Asserts within `scanner-block` the chip `coming soon` and `scanner-cta` link. `Landing.tsx:205-219`: `Chip label="coming soon"` + `<Link to="/scanner">` (which itself is the honest placeholder). |
| 19 | **AC-Live-1** — Entering the Ticker page opens exactly one live feed (EventSource) for the current symbol. | **PASS** | `shell-live-lifecycle.flow.spec.tsx › live-lifecycle › entering Ticker opens exactly one EventSource` (PASSES) + covered in the full-journey test. `openFor('TSLA').length === 1` asserted immediately after `findByText('Call wall')`. |
| 20 | **AC-Live-2** — Navigating away from the Ticker page (to Positions or Scanner) closes the live feed — it does not keep streaming in the background, and there is no orphaned/leaked connection. | **PASS** | `shell-live-lifecycle.flow.spec.tsx › live-lifecycle › nav-away closes the feed (no leak)` (PASSES). Captures `es` before nav-away to Scanner; asserts `es.closed === true` after `scanner-placeholder` appears. Full-journey test also asserts `firstTickerEs.closed === true`. |
| 21 | **AC-Live-3** — Navigating back to the Ticker page opens a fresh live feed that reconnects cleanly (cold-start path), with live data resuming. | **PASS** | `shell-live-lifecycle.flow.spec.tsx › live-lifecycle › return reopens a fresh feed` (PASSES). Asserts `esLog.filter(e => e.symbol === 'TSLA').length > before` after returning to `/ticker`. Full-journey test: `esLog.length > beforeReturn` + `openFor('TSLA').length === 1`. |
| 22 | **AC-Live-4** — At no point during a Ticker → Positions → Ticker round-trip (and across a symbol change) are there two concurrent live feeds for the same symbol. | **PASS** | `shell-live-lifecycle.flow.spec.tsx › live-lifecycle › never two concurrent feeds (round-trip)` (PASSES). Asserts `openFor('TSLA').length <= 1` at every stage of the round-trip. Also corroborated by the full-journey and symbol-change tests. |
| 23 | **AC-Live-5** — Changing the symbol on the Ticker page closes the prior feed and opens exactly one feed for the new symbol (no double-subscribe across the change). | **PASS** | `shell-live-lifecycle.flow.spec.tsx › live-lifecycle › symbol change single-subscribes` (PASSES). Clears input, types `AAPL`, Enter; asserts `openFor('TSLA').length === 0` + `openFor('AAPL').length === 1`. `TickerDashboard.tsx:403`: `navigate('/ticker/' + symbol)` confirmed. |
| 24 | **AC-Store-1** — Opening a simulated position on the Positions page, then navigating away and back, shows that same position still present (durable record not lost). | **PASS** | `positions-page.spec.tsx › store › position survives navigation` (PASSES). Seeds position, renders `/positions`, nav to Scanner and back, asserts `position-row` still present + `allPositions().length === 1`. |
| 25 | **AC-Store-2** — Opening a simulated position, then reloading the app, shows that position still present. | **PASS** | `positions-page.spec.tsx › store › position survives reload` (PASSES). Seeds position, mounts, `cleanup()` + `__resetMemory()`, remounts; asserts `position-row` still present (localStorage survives; `__resetMemory` mimics page reload). |
| 26 | **AC-Store-3** — Customization (columns/sort/filter, layout/density) and named saved views persist across navigation and reload. | **PASS** | `positions-page.spec.tsx › store › customization + saved views survive nav + reload` (PASSES). Seeds a named view `Tech swings`, nav away + back → view picker shows it; `cleanup()` + remount → still shows it. |
| 27 | **AC-Store-4** — A position opened from the Ticker page (via the ghost-trade/portfolio entry) is already present when navigating to `/positions` (same durable store; no prop-drilling required). | **PASS** | `positions-page.spec.tsx › store › Ticker-page entry already present on /positions` (PASSES) + `shell-live-lifecycle.flow.spec.tsx › live-lifecycle › a position opened on Ticker is already present on /positions (same singleton store)` (PASSES). Both confirm position opened on `/ticker/TSLA` appears in `portfolio-panel` on `/positions`. |
| 28 | **AC-Store-5** — After navigating away and back (or reloading), the per-position P/L trend sparkline and session delta re-derive from scratch (they are ephemeral by design) while the durable P/L facts (entry, realized) and the position itself remain intact. This is acceptable, not a regression. | **PASS** | `positions-page.spec.tsx › store › ephemeral trends/session-delta re-derive; durable facts persist` (PASSES). After reload, asserts `TSLA $250C` contract line persists + `allPositions()[0].entry_mark === 5`. No stale session-delta carried (re-derived fresh). |
| 29 | **AC-PosLive-1** — On `/positions`, tracked positions show current marks / P-L sourced via the existing tracked-contract mechanism (GET /api/contract), without any new backend endpoint. | **PASS** | `positions-page.spec.tsx › positions-marks › marks populate from GET /api/contract` (PASSES). Asserts `cell-mark` testid present + `fetchMock` called with `/api/contract/`. `PositionsPage.tsx` confirmed: no new endpoint; uses `streamTicker` + `getTicker` (existing) + `usePortfolio` which calls `fetchTrackedContract`. |
| 30 | **AC-PosLive-2** — When a position's mark cannot be refreshed (fetch/stream failure), that position shows its last-known mark/P-L (stale indication) and is never blanked or removed. | **PASS** | `positions-page.spec.tsx › positions-marks › refresh failure → last known, never blanked` (PASSES). `contractMode = 'throw'`; asserts `position-row` present + `TSLA $250C` present + `allPositions().length === 1`. Per UX_AMENDMENTS.md resolution: existing wording (`⏸ offline`/`unavailable`) is accepted (observable behavior verified, not literal §6 strings). |
| 31 | **AC-PosLive-3** — When a tracked contract is not found in the current snapshot (404), the position remains listed with its durable facts and a "tracking unavailable"/last-known state — it is not dropped and does not error the page. | **PASS** | `positions-page.spec.tsx › positions-marks › 404 → tracking unavailable, row kept` (PASSES). `contractMode = 'notfound'` (returns 404); asserts row + `TSLA $250C` present + `cell-unavailable` appears + `portfolio-panel` visible (page not errored). Per UX_AMENDMENTS.md: existing wording accepted. |
| 32 | **AC-PosLive-4** — When the tracked contract exists but has no NBBO quote available, the position falls back to its honest mark/last-known state without throwing into the page. | **PASS** | `positions-page.spec.tsx › positions-marks › null quote → no live quote fallback` (PASSES). `contractMode = 'nullquote'` (returns `option_quote: null`); asserts `position-row` + `TSLA $250C` present + `portfolio-panel` visible + `allPositions().length === 1` (no throw). |
| 33 | **AC-Scan-1** — `/scanner` shows a static "coming soon" message and performs no network fetch, no SSE subscription, and no scan/compute (observable: no bundle/scan request is issued when the Scanner page is shown). | **PASS** | `app.spec.tsx › scanner › static coming-soon, no network` (PASSES). Asserts `scanner-placeholder` present + `fetchMock` not called + `openedEventSources === 0` + no progressbar. Also verified in lifecycle flow: `newCalls.some(u => u.includes('/api/ticker/')) === false` after nav to Scanner. `Scanner.tsx` confirmed: zero imports of fetch/SSE/compute. |
| 34 | **AC-Inv-1** — On the relocated Ticker page, when the live SSE drops, the live-derived tiles dim + show `⏸ offline` (never blanked) while the static bundle (GEX chart, static tiles, blocks, term structure, fresh positioning) keeps rendering the last bundle — exactly as before the relocation. | **PASS** | `ticker-invariants.spec.tsx › invariants (ticker) › Ticker live-degrade still works` (PASSES). Uses fake timers to advance 16s past payload gap; asserts `getAllByText('⏸ offline').length > 0` + `getByText('Call wall')` + `getByText('⚠ Live offline — reconnecting…')`. Watchdog/offline logic unchanged in `TickerDashboard.tsx` (relocate-don't-change). |
| 35 | **AC-Inv-2** — On the relocated Ticker page, a cold-start bundle failure shows the existing red error + Retry; a post-success refresh failure keeps the bundle behind the soft "Couldn't refresh" warning. Page isolation: a Ticker error does not blank the nav shell or the other pages. | **PASS** | `ticker-invariants.spec.tsx › invariants (ticker) › Ticker cold-start = only blank; page-isolated` (PASSES). Cold-start (500): asserts `Retry` present + `app-shell` and `nav-ticker` still present (shell not blanked). Then Retry recovery: asserts `Call wall` renders. |
| 36 | **AC-Inv-3** — On the relocated Positions page, the Live tab is still the non-functional LOCKED "coming soon / not connected" placeholder — no broker, no order path, no real-position data source. | **PASS** | `positions-page.spec.tsx › invariants (positions) › Positions Live tab stays LOCKED` (PASSES). Clicks `tab-live`; asserts `live-locked-panel` present + `open-entry` absent + `fetchMock.mock.calls.length` unchanged (no new network call). `LiveTabPanel.tsx` confirmed: zero-import LOCKED placeholder. |
| 37 | **AC-Inv-4** — All positions/trades on the relocated Positions + Ticker pages remain SIMULATED (paper); no real order/execution path is reachable anywhere in this feature. | **PASS** | `positions-page.spec.tsx › invariants (positions) › everything stays SIMULATED` (PASSES). Asserts `getAllByText('SIMULATED').length > 0` + `queryByText(/place real order/i) === null`. Pre-existing `acceptance.spec.tsx › F. live lock + invariants › no_real_order_path_anywhere_simulated_unmistakable` also passes (171/171 green). |
| 38 | **AC-Inv-5** — The relocation does not change any scoring output — `opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry gate behave identically (no relocated feature becomes a scoring input; backend untouched). Observable: the Ticker viewer's tier/score readouts for a given bundle are the same as before the move. | **PASS** | `ticker-invariants.spec.tsx › invariants (ticker) › scoring untouched (byte-identical)` (PASSES). Mocked bundle has `opportunity_score: 73` / `opportunity_tier: 'actionable'`; asserts `getByText(/73 ·/)` renders in the Ticker viewer. Backend untouched (zero diff on `apps/api`). |
| 39 | **AC-Inv-6** — Each independently-nullable surface (off-exchange blocks, the four neutral metrics, ghost-trade, ai-rec, personas, the positions store) still fails to its own "unavailable"/empty state and does not throw into the page or the shell, on both the Ticker and Positions pages. | **PASS** | `ticker-invariants.spec.tsx › invariants (ticker) › best-effort isolation preserved` (PASSES). Bundle with `off_exchange: null` + null metrics; asserts `Off-exchange data unavailable this cycle.` + `$260` (call wall) still renders. Pre-existing positions store corruption test also passes (degrades to empty without throw). |
| 40 | **AC-Inv-7** — `/_ops/metrics` stays off the product nav, unlinked, read-only, and side-effect-free; the new nav does not reach it. | **PASS** | `app.spec.tsx › invariants › operator path separation preserved` (PASSES). Asserts no `<a>` on `/scanner` or `/` contains `_ops` in href. `AppShell.tsx` confirmed: `NAV` array has no `/_ops/metrics` entry; operator route is NOT linked anywhere in the shell or landing. |
| 41 | **AC-Inv-8** — The app runs with exactly one router and one theme provider at the root (observable: no duplicate-router/duplicate-theme console errors; nav, deep-links, and theming all work app-wide consistently). | **PASS** | `app.spec.tsx › invariants › single router + single theme provider` (PASSES). Deep-link to `/ticker/AAPL` + nav to `/positions` — both work; no duplicate-router errors observed. `app.tsx` confirmed: no `<BrowserRouter>` or `<ThemeProvider>` nested inside (comment on line 5 + structure verified). `main.tsx` is the single provider host (unchanged). |
| 42 | **AC-Inv-9** — The Convexa brand appears in the UI (landing + nav), but a user's previously-saved simulated positions and saved views persist through this feature (the durable store key is unchanged). | **PASS** | `positions-page.spec.tsx › invariants (positions) › brand swap is UI-only (store key unchanged)` (PASSES). Seeds position `pre-rebrand-1` into `PORTFOLIO_V2_KEY`; asserts `position-row` present + `allPositions().some(p => p.id === 'pre-rebrand-1')` + `Convexa` in `shell-brand` + `queryByText('GammaFlow') === null`. Keys confirmed: `V2_KEY = 'gammaflow.positions.v2'` (store.ts:23), `STORAGE_KEY = 'gammaflow.ghost-trade.v1'` (ghost-trade/store.ts:9) — both unchanged. |

---

## Binding invariant checks

| Invariant | Verdict | Evidence |
|---|---|---|
| `[no-real-order-path]` — Positions Live tab stays LOCKED; everything SIMULATED; landing brokerage block does NOT navigate/dead-end. | **PASS** | AC-Inv-3 / AC-Inv-4 / AC-Land-5 verified above. `LiveTabPanel.tsx` zero-import confirmed. Waitlist button in-place state only. |
| `[additive-keeps-score-byte-identical]` — Pure restructure; scoring untouched; no relocated feature becomes a scoring input; backend zero-diff. | **PASS** | AC-Inv-5 verified. `git diff HEAD~1 HEAD -- apps/api` is empty. `TickerDashboard.tsx` internals byte-identical (only route prefix + location changed). |
| `[best-effort-isolated-or-null]` — Relocated degraded behavior preserved. | **PASS** | AC-Inv-1 / AC-Inv-2 / AC-Inv-6 + PosLive-2/3/4 verified. |
| `[live-vs-static-isolation]` — Ticker live-offline: live tiles dim, static bundle keeps rendering. Positions: last-known per UX_AMENDMENTS resolution. | **PASS** | AC-Inv-1 verified (live tiles `⏸ offline`, `Call wall` persists). PosLive-2/3/4 verified (row persists, cell degrades, page not errored). |
| `[operator-vs-trader-path-separation]` — `/_ops/metrics` off the shell, NOT linked from nav. | **PASS** | AC-Inv-7 verified. No `_ops` href in any nav link. Operator route declared FIRST in route table. |
| **Brand-is-UI-only** — No durable localStorage key, package, folder, or code identifier renamed; only visible wordmark is "Convexa". | **PASS** | `gammaflow.positions.v2` and `gammaflow.ghost-trade.v1` confirmed unchanged. `ConvexaMark` brand only in UI chrome (Landing + AppShell). AC-Inv-9 test explicitly verifies this. |
| **Lane check** — `apps/api` and `.claude/contracts/_archive` unmodified. | **PASS** | `git diff HEAD~1 HEAD -- apps/api` → empty. `git diff HEAD~1 HEAD -- .claude/contracts/_archive` → empty. |
| **UX_AMENDMENTS resolution** — AC-PosLive-2/3/4 verified by observable behavior (row persists, cell degraded, no blank/drop), NOT by literal §6 strings. | **PASS** | Tests assert observable behavior only: `position-row` present + durable facts present + `cell-unavailable` or no throw. Carve-out honored. |

---

## Test suite summary

**Test Files:** 14 passed (14)
**Tests:** 171 passed (171)
**Failures:** 0

The suite is GREEN with zero failures. Stderr output contains only:
- Recharts jsdom dimension warnings (chart rendering in headless env, benign, tests pass)
- React Router v7 future-flag warnings (non-blocking, expected for v6)
- Occasional `act(...)` advisory warnings (non-fatal, tests still pass and assert correctly)

All 42 PRODUCT_CONTRACT ACs map to ≥1 named, passing test in the matrix. No AC is uncovered.

---

## AC-to-test traceability (all 42)

| AC | Spec file(s) | Named test(s) |
|---|---|---|
| AC-Route-1 | app.spec.tsx | `routes › "/" renders Landing, not a ticker redirect` |
| AC-Route-2 | app.spec.tsx | `routes › "/ticker/TSLA" renders Ticker viewer in shell` |
| AC-Route-3 | app.spec.tsx | `routes › bare "/ticker" defaults to TSLA` |
| AC-Route-4 | app.spec.tsx | `routes › "/ticker/AAPL" deep-links AAPL` |
| AC-Route-5 | app.spec.tsx | `routes › "/positions" renders Positions in shell` |
| AC-Route-6 | app.spec.tsx | `routes › "/scanner" renders static coming-soon in shell` |
| AC-Route-7 | app.spec.tsx | `routes › "/_ops/metrics" renders operator surface off the shell` |
| AC-Nav-1 | app.spec.tsx | `nav › persistent nav present on ticker/positions/scanner` |
| AC-Nav-2 | app.spec.tsx | `nav › entries navigate between pages` |
| AC-Nav-3 | app.spec.tsx | `nav › active-route indicator on current entry` |
| AC-Nav-4 | app.spec.tsx | `nav › shell does not remount across in-shell pages` |
| AC-Nav-5 | app.spec.tsx | `nav › landing renders no trader nav shell` |
| AC-Land-1 | app.spec.tsx | `landing › shows Convexa wordmark + lead hook` |
| AC-Land-2 | app.spec.tsx | `landing › shows today-working value props` |
| AC-Land-3 | app.spec.tsx | `landing › primary CTA enters the app at /ticker` |
| AC-Land-4 | app.spec.tsx | `landing › secondary CTAs navigate to in-shell routes (no dead-end)` |
| AC-Land-5 | app.spec.tsx | `landing › brokerage connect is coming-soon, not a working button` |
| AC-Land-6 | app.spec.tsx | `landing › Scanner presented as coming-soon` |
| AC-Live-1 | shell-live-lifecycle.flow.spec.tsx | `live-lifecycle › entering Ticker opens exactly one EventSource` + full-journey test |
| AC-Live-2 | shell-live-lifecycle.flow.spec.tsx | `live-lifecycle › nav-away closes the feed (no leak)` + full-journey test |
| AC-Live-3 | shell-live-lifecycle.flow.spec.tsx | `live-lifecycle › return reopens a fresh feed` + full-journey test |
| AC-Live-4 | shell-live-lifecycle.flow.spec.tsx | `live-lifecycle › never two concurrent feeds (round-trip)` + full-journey test |
| AC-Live-5 | shell-live-lifecycle.flow.spec.tsx | `live-lifecycle › symbol change single-subscribes` |
| AC-Store-1 | positions-page.spec.tsx | `store › position survives navigation` |
| AC-Store-2 | positions-page.spec.tsx | `store › position survives reload` |
| AC-Store-3 | positions-page.spec.tsx | `store › customization + saved views survive nav + reload` |
| AC-Store-4 | positions-page.spec.tsx + shell-live-lifecycle.flow.spec.tsx | `store › Ticker-page entry already present on /positions` + `live-lifecycle › a position opened on Ticker is already present on /positions` |
| AC-Store-5 | positions-page.spec.tsx | `store › ephemeral trends/session-delta re-derive; durable facts persist` |
| AC-PosLive-1 | positions-page.spec.tsx | `positions-marks › marks populate from GET /api/contract` |
| AC-PosLive-2 | positions-page.spec.tsx | `positions-marks › refresh failure → last known, never blanked` |
| AC-PosLive-3 | positions-page.spec.tsx | `positions-marks › 404 → tracking unavailable, row kept` |
| AC-PosLive-4 | positions-page.spec.tsx | `positions-marks › null quote → no live quote fallback` |
| AC-Scan-1 | app.spec.tsx + shell-live-lifecycle.flow.spec.tsx | `scanner › static coming-soon, no network` + Scanner leg in full-journey test |
| AC-Inv-1 | ticker-invariants.spec.tsx | `invariants (ticker) › Ticker live-degrade still works` |
| AC-Inv-2 | ticker-invariants.spec.tsx | `invariants (ticker) › Ticker cold-start = only blank; page-isolated` |
| AC-Inv-3 | positions-page.spec.tsx | `invariants (positions) › Positions Live tab stays LOCKED` |
| AC-Inv-4 | positions-page.spec.tsx + acceptance.spec.tsx | `invariants (positions) › everything stays SIMULATED` + `F. live lock + invariants › no_real_order_path_anywhere_simulated_unmistakable` |
| AC-Inv-5 | ticker-invariants.spec.tsx | `invariants (ticker) › scoring untouched (byte-identical)` |
| AC-Inv-6 | ticker-invariants.spec.tsx | `invariants (ticker) › best-effort isolation preserved` |
| AC-Inv-7 | app.spec.tsx | `invariants › operator path separation preserved` |
| AC-Inv-8 | app.spec.tsx | `invariants › single router + single theme provider` |
| AC-Inv-9 | positions-page.spec.tsx | `invariants (positions) › brand swap is UI-only (store key unchanged)` |

---

## Pre-existing suite regression check

All pre-existing specs ran as part of the 171-test suite and passed:
- `positions/acceptance.spec.tsx` (41 tests — positions-portfolio ACs)
- `positions/positions-portfolio.flow.spec.tsx` (flow-integration ACs)
- `positions/PositionsView.spec.tsx`, `PositionEntryDialog.spec.tsx`
- `positions/store.spec.ts`, `defaults.spec.ts`, `entry.spec.ts`, `derive.spec.ts`, `useTrends.spec.ts`
- `ai-rec/ai-rec.spec.tsx` (T1–T18 + E1–E7 — ai-recommendations ACs)

Zero regressions observed.

---

## Summary

**42 PASS / 0 FAIL / 0 UNVERIFIABLE**

## GATE Q verdict: PASS

Every AC is PASS. Every binding invariant holds. The pre-existing suite is fully green. No amendments bounced.
