# app-shell-landing — ARCHITECTURE CONTRACT

> Role: Architect (architect-first, ROLE_LAUNCH_PROMPTS §1). Self-contained against the named
> inputs (BRIEF.md, PROJECT_CONTEXT §2/§5/§7, OPEN_THREADS, the current `app.tsx` / `main.tsx` /
> `positions/` / `libs/api/.../gammaflow.ts`). Defines data-structure CONTENT, data-flow, component
> boundaries, isolation/error rules, the binding invariants, and explicit non-goals. It does NOT
> design UI/layout, copy, brand, nav labels, payload/field names, or endpoints — those are OPEN
> QUESTIONS for the PM (§8). Next role: Product Manager (compressor #2 handoff at the end).

This is **feature 1 of the owner pivot (Track A)**: the single-page dashboard becomes a **multi-page
app**. The pivotal calls are routing/layout and **how the relocated live-SSE Ticker viewer + the
positions durable store survive navigation without regressing state/lifecycle**. It is **FE-only**
(`NO_BACKEND_CHANGE`) — a pure restructure + one new static page. Nothing about the GEX / positions /
personas / ghost-trade / ai-rec INTERNALS changes; they **move, they don't change**.

---

## 0. Ground truth (what exists today)

- **Router is already wired.** `apps/dashboard/src/main.tsx` mounts a single `<BrowserRouter>` around
  `<App/>`, inside one `<ThemeProvider theme={theme}>` + `<CssBaseline/>` (theme from
  `apps/dashboard/src/app/theme.ts`).
- **`apps/dashboard/src/app/app.tsx` today holds the whole frontend.** Its structure:
  - `App` — top-level `<Routes>`: `/_ops/metrics` → `<OperatorMetrics/>`; `/*` → `<TraderApp/>`.
  - `TraderApp` — renders a `<AppBar>GammaFlow</AppBar>` then nested `<Routes>`: `/` →
    `<Navigate to="/TSLA">`, `/:ticker` → `<TickerDashboard/>`.
  - `TickerDashboard` — the entire GEX dashboard: ticker/expiration/dark-pool toolbar, the headline +
    stat-tile grid, `GhostTradePanel`, `PortfolioPanel`, `AiRecPanel`, `GexProfileChart`, term-
    structure card, Fresh-positioning, off-exchange blocks, setups, and all dialogs. It owns the
    **live-SSE subscription** (the `streamTicker` effect, the >15s payload-gap watchdog →
    `streamOffline`), the **60s poll** (`getTicker`), and the hooks `useGhostTrade`, `usePortfolio`,
    `usePersona`, `useAiRecommendation`.
- **Live session lifecycle (today):** the SSE effect keys on `[ticker, selected]`; its cleanup
  `() => { clearTimeout(gapTimer); unsub(); }` calls `streamTicker`'s returned closer, which does
  `es.close()` → the backend `LiveHub` ref-counts the session down and tears it down after an 8s
  grace (PROJECT_CONTEXT §2, `src/core/live.py`). So **unmounting `TickerDashboard` already closes
  the EventSource cleanly today** — the relocation must preserve exactly this unmount semantics.
- **Positions store (today):** `apps/dashboard/src/app/positions/store.ts` is a **module-level
  singleton** over `localStorage` (`gammaflow.positions.v2`, with loss-free v1→v2 migration) plus an
  in-memory `memory` cache. It is the **source of truth** and is **independent of React mount state**:
  any component calling `allPositions()/putPosition()/...` reads/writes the same store. `usePortfolio`
  is the React binding (per-row marks, resting-limit lifecycle, trends) but the durable data does not
  live in the component.
- **Operator route already separated.** `/_ops/metrics` (`operator-metrics.tsx`) has its **own
  AppBar**, is OFF the trader routes, unlinked, read-only — the `[operator-vs-trader-path-separation]`
  invariant. This feature must keep it exactly as is.
- **`react-router-dom` is already a dependency** (BrowserRouter, Routes, Route, Navigate, useParams,
  useNavigate, all imported today). No new router dependency is introduced.

---

## 1. Routing architecture

### 1.1 Target route table

The app becomes a **flat, top-level route table** under the existing single `<BrowserRouter>` (in
`main.tsx`, unchanged). A persistent **shell layout** (§2) wraps the four trader routes; the landing
page and the operator route are **outside** that shell.

| Path | Page | Shell? | Disposition |
|---|---|---|---|
| `/` | **Landing / splash** (NEW) | NO (full-bleed, own page) | New static page. Communicates the pivot positioning (connect positions → AI recs on GEX + heuristics). Carries the entry CTAs into the app. |
| `/ticker` (+ a ticker segment, see §1.3) | **Ticker viewer** = TODAY's `TickerDashboard` | YES | EXISTING `app.tsx` GEX dashboard, RELOCATED unchanged. |
| `/positions` | **Positions** = TODAY's `PortfolioPanel` | YES | EXISTING positions portfolio, RELOCATED unchanged. |
| `/scanner` | **Scanner** (NEW placeholder) | YES | "Coming soon" static page. NO scan logic, NO fetch, NO compute (built later as the `scanner` feature). |
| `/_ops/metrics` | **Operator metrics** | NO (own AppBar) | EXISTING, UNCHANGED. Stays off the trader shell, unlinked, read-only. |

**`/` is no longer a redirect to `/TSLA`.** Today `/` → `Navigate to="/TSLA"`; after this feature `/`
is the landing page. The default-ticker behavior moves into the Ticker route (§1.3).

### 1.2 Where the router + routes live (data-flow / file shape)

- **`main.tsx`** — unchanged in spirit: one `<BrowserRouter>` around the app root, inside the single
  `<ThemeProvider>` + `<CssBaseline>`. (Whether the route table itself is declared in `App` or hoisted
  into `main.tsx` is an implementation detail left to the executioner; the contract requires only ONE
  router and ONE theme provider at the app root — §3.4.)
- **App root (`app.tsx`'s `App`)** — becomes the **route table only**: it composes the routes in the
  table above. It stops being the GEX dashboard. The GEX dashboard moves to its own module (§4).
- **Route table structure (required shape, not file names):**
  - `/_ops/metrics` → `<OperatorMetrics/>` (outside the shell — first, as today, so `/*` can't shadow it).
  - `/` → `<Landing/>` (outside the shell).
  - the shell-wrapped group → `<AppShell/>` (§2) wrapping `/ticker*`, `/positions`, `/scanner`.
- **Routing mechanism:** a **persistent layout via a parent route with nested child routes**
  (react-router `<Outlet/>` pattern) is the contract's intent for the shell group — the shell mounts
  once and the page content swaps in the outlet, so the shell (and any provider/state that sits at the
  shell level, §3) is NOT torn down on a Ticker↔Positions↔Scanner navigation. (Exact route nesting
  form is the executioner's; the binding requirement is **the shell does not remount across the three
  in-shell pages**, §2.2 / §3.3.)

### 1.3 The ticker segment (relocation of `/:ticker`)

Today the symbol lives in the URL (`/:ticker`, default `/TSLA` via redirect; `useParams().ticker`;
`navigate('/'+symbol)`). The Ticker viewer **keeps a URL-addressable symbol** — that behavior is part
of "behavior unchanged" (deep-linkable, the ticker textbox navigates, the persona DTE pre-fill one-shot
rides an explicit navigation). The viewer now lives under the `/ticker` segment instead of the root.

- **CONTRACT:** the symbol remains in the URL under the Ticker route, and a **bare `/ticker` resolves
  to a default symbol** (the current default is `TSLA`) — preserving today's `/` → `/TSLA` default-
  ticker UX, just relocated under `/ticker`.
- The **exact URL shape** of the symbol under `/ticker` (`/ticker/:ticker` vs `/ticker?symbol=` vs
  `/ticker` + in-page state) is a **PM/UX open question (§8 Q1)** — it touches user-facing URL/layout
  and deep-link copy, which are out of the Architect lane. The binding constraints the PM must honor:
  (a) the symbol is URL-addressable/deep-linkable; (b) a bare `/ticker` lands on the default symbol;
  (c) the ticker textbox's navigate-on-Enter and the one-shot DTE pre-fill still fire on an explicit
  symbol navigation (today's `useNavigate` + `pendingPrefill` ref behavior, `app.tsx` L383–389).
- **Relocate-don't-change:** `TickerDashboard`'s internal `useParams`/`useNavigate` usage is preserved;
  only the path prefix it reads/writes changes. No edits to its body beyond the route prefix it targets.

### 1.4 Non-goals for routing

No new endpoints, no server-side routing, no route guards/auth (none exists today), no lazy-loading
mandate (allowed but not required), no change to `/_ops/metrics`. The Scanner route does **no**
data work — it is a placeholder component returning static "coming soon" content only.

---

## 2. App-layout / nav shell

### 2.1 Component boundary: shell vs page

A new **`AppShell`** component is the persistent chrome for the three in-shell trader pages:

- **Shell OWNS (shared, mounts once for the in-shell group):**
  - The **persistent nav** between Ticker / Positions / Scanner (replacing today's bare
    `<AppBar>GammaFlow</AppBar>` in `TraderApp`). Active-route indication.
  - The page container/outlet into which the active page renders.
  - Any shell-level shared providers/state placed here per §3 (the contract's intent: **none of the
    feature data-state moves up into the shell** — see §3.4; the shell is chrome, not a data owner).
- **Pages OWN their own content + their own data lifecycle:**
  - **Ticker viewer** (`TickerDashboard` relocated) owns its SSE subscription, its 60s poll, and its
    feature hooks — exactly as today. The shell does **not** own or hoist the live session (§3.1).
  - **Positions page** (`PortfolioPanel` relocated) owns its `usePortfolio` binding; the durable data
    is the module-singleton store, not the page (§3.2).
  - **Scanner** owns nothing (static placeholder).

### 2.2 What is shared vs per-page (binding)

| Concern | Where it lives | Lifecycle |
|---|---|---|
| Theme / MUI `ThemeProvider` / `CssBaseline` | App root (`main.tsx`), as today | Mounts once for the whole app — **unchanged** (§3.4). |
| `BrowserRouter` | App root (`main.tsx`), as today | One router, app-wide — **unchanged**. |
| Nav chrome (Ticker/Positions/Scanner) | `AppShell` | Mounts once for the in-shell group; persists across the three pages. |
| Landing page chrome | `Landing` (its own full-bleed page) | NOT under `AppShell`; no trader nav. |
| Operator AppBar | `OperatorMetrics` (own AppBar) | Unchanged; off the shell. |
| Live-SSE session | **Ticker page only** (`TickerDashboard`) | Mounts on entering Ticker, **tears down on leaving** (§3.1). |
| Positions durable data | **Module-singleton store** (`positions/store.ts`) | Independent of mount; survives all navigation (§3.2). |
| Ticker/persona/dark-pool/AI-rec in-memory UI state | **Ticker page only** | Resets on leaving Ticker (acceptable — see §3.1 / §8 Q4). |

The shell is **presentation chrome with no feature data ownership.** This keeps the relocation a pure
move: the pages keep owning their own data exactly as `TickerDashboard`/`PortfolioPanel` do today.

### 2.3 Landing is NOT in the shell

The landing/splash page is its own **full-bleed** page (BRIEF: "landing is its own full-bleed page").
It renders outside `AppShell` so it carries no trader nav bar and is free to be a marketing-style
surface. Its CTAs navigate INTO the shell routes (e.g. into Ticker / Positions). Brand, copy, visuals,
colors, and the exact CTA targets are **PM/UX open questions** (§8) — the Architect designs only that
it is a separate route + separate component outside the shell.

---

## 3. The lifecycle problem (the real risk — precise contract)

This is the one true risk the BRIEF names: the live-SSE session must not **leak**, **double-subscribe**,
or **keep streaming when the user is on another page**, yet must **reconnect cleanly on return**; and
the positions durable store must **persist correctly** across route changes.

### 3.1 Live-SSE session — mount/unmount contract

**RULE: the live session is owned by the Ticker page and ONLY mounts while the Ticker page is mounted.**

- The `streamTicker` subscription effect (today in `TickerDashboard`, `app.tsx` L291–303) **stays
  inside the Ticker page component**. It is NOT hoisted into the shell or the app root.
- Because the Ticker page is a **child route of the shell**, navigating to `/positions` or `/scanner`
  **unmounts `TickerDashboard`**, which runs the existing cleanup → `unsub()` → `es.close()` → the
  backend `LiveHub` ref-count drops and the session tears down (8s grace). **No leak, no orphaned
  EventSource, no streaming while off the Ticker page.** This is the SAME unmount path that fires today
  on a ticker change — the contract is that relocation **does not weaken it**.
- **Return to Ticker** remounts the page → the effect re-runs → a fresh `EventSource` opens →
  reconnects cleanly. This is the existing cold-start path (`setLive(null); setStreamOffline(false)`
  at effect entry, then arm the watchdog after the first payload).
- **No double-subscribe (binding):** there must be **at most one** `streamTicker`/`EventSource` per
  ticker at any time. The enforcement is structural: exactly one subscription effect, owned by one
  component instance (the Ticker page), with `[ticker, selected]` deps and a cleanup that closes before
  any re-subscribe. The shell must **not** also subscribe. React 18 StrictMode double-invoke in dev is
  already handled by the existing effect cleanup (mount→cleanup→mount) — relocation must keep that
  cleanup intact.
- **The watchdog / `streamOffline` / degraded-live behavior is internal to `TickerDashboard` and is NOT
  modified.** Relocation preserves `[live-vs-static-isolation]` exactly: on an SSE drop the live-derived
  tiles dim + `⏸ offline`, the static bundle keeps rendering (§5).
- **Decision (binding):** the live session is **page-scoped, not app-scoped.** It does NOT persist in
  the background while the user is on Positions/Scanner/Landing. Rationale: (a) it matches today's
  semantics (the session is tied to the viewed ticker), (b) it honors the backend's ref-counted
  teardown design, (c) keeping a background SSE alive on other pages would be a NEW behavior and a leak
  risk this feature explicitly must avoid. The small reconnect cost on return is acceptable and is the
  existing cold-start path. (If the PM later wants warm-keep-alive across nav, that is a **separate,
  out-of-scope** feature — §7 / §8 Q4.)

### 3.2 Positions durable store + in-memory state — across navigation

**RULE: the localStorage store is the source of truth and is mount-independent; it survives all
navigation by construction.**

- `positions/store.ts` is a **module-level singleton** over `localStorage` with an in-memory `memory`
  cache (read above). It is **not** owned by any React component. Therefore:
  - Navigating away from `/positions` and back **does not lose any position** — the durable data lives
    in `localStorage` + the module cache, not in `usePortfolio`'s React state.
  - A position opened on the Ticker page (via the ghost-trade/portfolio entry) writes through the same
    singleton, so it is **already present** when the user navigates to `/positions`. No cross-page
    prop-drilling or shared React context is required for durability.
- **DURABLE vs EPHEMERAL split (binding) — what survives nav vs what re-derives:**
  - **DURABLE (survives nav + reload, the source of truth):** the positions collection, decisions,
    customization + named saved views (all in `store.ts`); and the ghost-trade durable store
    (`ghost-trade/store.ts`, `gammaflow.ghost-trade.v1`). These MUST persist across every route change.
  - **EPHEMERAL (re-derives on remount, by design):** `usePortfolio`'s per-row tracked-contract
    fetches + computed marks, the per-position P/L **trend ring buffers** (`useTrends`), and the
    session delta. These are **already declared ephemeral** today (they reset on reload — OPEN_THREADS
    §7c, PROJECT_CONTEXT §2: "ephemeral per-position P/L trend ring buffer"). Losing them on a nav-away
    /nav-back is **consistent with the shipped contract** (same as a reload) and is **acceptable** —
    NOT a regression. The marks re-fetch from `GET /api/contract` on remount; the durable P/L facts
    (entry, realized) are read straight from the store.
- **CONTRACT:** relocation must NOT change `store.ts` or `usePortfolio`'s durability logic. The
  durable data is mount-independent; only the ephemeral derivations re-run on remount, exactly as on a
  reload today. No in-memory durable state may be introduced at the page or shell level that would be
  lost on navigation.

### 3.3 Where shared state/providers sit (app root vs per-route)

- **App root (mounts once, app-wide):** `BrowserRouter`, `ThemeProvider`, `CssBaseline`. **Nothing
  else.** No feature data provider is hoisted here.
- **Shell (mounts once for the in-shell group):** nav chrome + outlet only. **No feature data state.**
- **Per-page (mounts/unmounts with the page):** the Ticker viewer's SSE + poll + feature hooks; the
  Positions page's `usePortfolio` binding. Durable cross-page data lives in the **module-singleton
  stores**, not in any provider.

**Why no shared React context for positions/live:** the durable data is already a module singleton
(the correct cross-page persistence mechanism, and it predates this feature). Introducing a context
provider would be a rewrite of shipped internals — out of scope and unnecessary. The live session is
intentionally page-scoped (§3.1), so it must NOT be lifted into a shared provider.

### 3.4 Single-provider invariant (binding)

There MUST remain exactly **one** `<BrowserRouter>` and exactly **one** `<ThemeProvider>`/
`<CssBaseline>` at the app root (as today in `main.tsx`). The shell and pages must not nest a second
router or a second theme provider. (Nesting a second `BrowserRouter` is a classic regression — called
out so the executioner doesn't introduce one when extracting the shell.)

---

## 4. Component boundaries / relocation rules

### 4.1 The relocate-don't-change boundary (binding)

The pivot is a **structural move**, not a rewrite. The following are RELOCATED and their **internals
are not edited**:

- **Ticker viewer** = today's `TickerDashboard` (the body of `app.tsx`, L204–774) **moves to its own
  module** and mounts under `/ticker` inside the shell. Its **GEX chart, stat-tile grid, the four
  neutral metric tiles, term-structure card, Fresh-positioning, off-exchange blocks, setups, the
  SSE/poll lifecycle, the watchdog/offline logic, and every dialog** are **unchanged**. The only edits
  permitted: (a) the file/module location, (b) the route prefix it reads/writes (§1.3), (c) removing
  the now-redundant inner `<AppBar>GammaFlow</AppBar>`/`TraderApp` wrapper that the shell replaces.
- **Personas, ghost-trade, ai-rec** — these are **mounted inside the Ticker viewer** (they are
  `TickerDashboard`'s children today). They move **with** it as-is. **No edits to their INTERNALS**
  (`personas/`, `ghost-trade/`, `ai-rec/`). They keep their isolation and invariants.
- **Positions page** = today's `PortfolioPanel` (+ `usePortfolio` + `store.ts` + the whole
  `positions/` tree) **relocated** to mount under `/positions`. **No edits to `positions/`
  internals** — the flat durable store, the v1→v2 migration, the resting-limit lifecycle, the
  Simulated/Live tabs (incl. the zero-import LOCKED `LiveTabPanel`), customization + saved views,
  marks/P-L — all unchanged. Only the **mounting location** changes.
  - NOTE: today `PortfolioPanel` is rendered inside `TickerDashboard` and receives
    `data`/`live`/`isLive`/`streamOffline`/`ticker` props from the Ticker page's bundle + stream. On
    `/positions` it is a **standalone page** with no Ticker-page parent supplying those props. **How
    the standalone Positions page sources `live`/`data` (its own light SSE/`GET /api/contract` flow vs
    rendering without a live stream) is a relocation detail with a real lifecycle consequence** — see
    §4.3 (the one genuine relocation question) and §8 Q2.

### 4.2 NEW components (the only net-new UI)

- **`Landing`** — NEW full-bleed splash page at `/` (brand/copy/visuals are PM/UX — §8). Static; no
  data fetch, no SSE.
- **`AppShell`** — NEW persistent nav shell (§2). Chrome only.
- **`Scanner`** — NEW placeholder page. Static "coming soon" content. **NO scan logic, NO fetch, NO
  compute, NO new endpoint** (built later as the `scanner` feature). It must not subscribe to SSE or
  call any bundle endpoint.

### 4.3 The one genuine relocation question — Positions page live data

This is the only place where "relocate-don't-change" meets a real design choice, because the Positions
page loses its Ticker-page parent that today supplies `live`/`data`/`isLive`/`streamOffline`.

- **Architectural constraint (binding):** whatever the Positions page does to source live marks, it
  must (a) **NOT introduce a second concurrent SSE subscription that double-subscribes the same ticker
  already streamed by the Ticker page** — but note the Ticker page is UNMOUNTED when the user is on
  `/positions` (§3.1), so a Positions-page stream is the only one alive at that time, which is fine;
  (b) keep `[live-vs-static-isolation]` — live marks degrade on a drop, durable records persist;
  (c) keep `[no-real-order-path]` and `SIMULATED` (untouched); (d) require **no backend change**
  (consume the existing `GET /api/contract` + the existing SSE, exactly as the shipped portfolio does).
- The portfolio already reuses `GET /api/contract` + SSE `mid` and degrades correctly on a drop (it
  was built to do this — OPEN_THREADS §7c). The contract's position: the standalone Positions page may
  drive its own minimal live/contract flow using the **existing** mechanisms, with **at most one SSE
  per ticker** at a time. The **exact data-sourcing shape** for the standalone page (which ticker(s)
  it streams, whether it streams at all vs. uses `GET /api/contract` polling, and how multi-ticker
  portfolios mark) is a **PM/UX + executioner question (§8 Q2)** — it has UX consequences (how live the
  Positions marks feel) that are out of the Architect lane. The binding rules above bound it.

### 4.4 Tests (per the standing FE-tests rule, PROJECT_CONTEXT §7)

The FE executioner owns the test set (the contract chain specifies it). The relevant new/behavioral
coverage this restructure must produce (a floor; final matrix authored by UX/PM):
- **Routing:** each route renders its page; `/` is the landing (not a redirect to a ticker); unknown
  paths behave sanely; `/_ops/metrics` still resolves to the operator surface OFF the shell.
- **Live-session lifecycle (the centerpiece flow-integration test):** navigate Ticker→Positions→Ticker
  and assert (a) the EventSource opened on Ticker, (b) it **closed** on navigating away (no leak / no
  second open), (c) it **re-opened** on return, (d) **never two concurrent subscriptions** for the
  same ticker. Mock only the network/SSE boundary.
- **Store persistence across nav:** open a position, navigate away and back (and reload), assert the
  position + customization + saved views persist (durable), and that ephemeral trends re-derive
  (acceptable) — never a lost durable record.
- **Invariant preservation:** the relocated Ticker viewer still degrades correctly on an SSE drop
  (`[live-vs-static-isolation]`); the Live tab stays the zero-import LOCKED placeholder
  (`[no-real-order-path]`); no scoring path is touched (`[additive-keeps-score-byte-identical]`).

---

## 5. Isolation / error rules

- **Page isolation:** a failure in one page must not blank the shell or the other pages. The shell
  chrome renders regardless of page state. A Ticker cold-start failure stays the Ticker page's existing
  red-error + Retry; it does not break nav.
- **`[live-vs-static-isolation]` (RESTATED, binding):** the relocated Ticker viewer keeps its watchdog
  → on an SSE drop, live-derived tiles dim + `⏸ offline` (never blanked), the static bundle (chart,
  static tiles, blocks, term structure, fresh positioning) keeps rendering the last bundle; cold-start
  failure is the only blank screen (error + Retry); a post-success poll failure keeps the bundle behind
  the soft "Couldn't refresh" warning. **This behavior survives the move unchanged** — it is the
  BRIEF's named one-real-risk, and the §3.1 page-scoped-session contract is what preserves it.
- **`[best-effort-isolated-or-null]` (RESTATED, binding):** the relocated features keep their
  isolation — each independently-nullable surface (off-exchange, the four metrics, ghost-trade,
  ai-rec, personas, the positions store) still fails to its own "unavailable"/empty state, never
  throwing into the page or the shell. The positions store's guarded degrade-to-empty (`store.ts`)
  is unchanged.
- **`[additive-keeps-score-byte-identical]` (RESTATED, binding):** this is a **pure restructure** —
  the scoring path (`opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry gate)
  is **not touched**. No relocated feature becomes a scoring input; positions are never an input; the
  module boundary that enforces this is untouched because no internals change. (Backend untouched
  entirely — §6.)
- **`[operator-vs-trader-path-separation]` (preserved):** `/_ops/metrics` stays off the trader shell,
  unlinked, read-only, side-effect-free. The new nav must **not** link to it.
- **`[no-real-order-path]` (RESTATED, binding):** everything stays `SIMULATED` (paper). The positions
  **Live** tab stays the **zero-import LOCKED placeholder** (no broker, no order/execution path, no
  real-position data source). The new **Scanner** page is likewise a non-functional placeholder. NO
  broker / real-positions / "Live" wiring is added by this feature.

---

## 6. Explicit non-goals

This feature does **NOT**:
- **NO backend change** — `NO_BACKEND_CHANGE`. No new endpoint, no payload change, no SSE change. The
  contract consumes only the existing `GET /api/ticker`, `GET /api/contract`, the existing SSE stream,
  `GET /api/_metrics`, and the existing rec/persona endpoints.
- **NO scanner logic** — `/scanner` is a static placeholder only. No scan, no fan-out, no multi-ticker
  fetch, no compute. (The later `scanner` feature builds it; the metrics baseline already supports it,
  OPEN_THREADS §6 — but NOT here.)
- **NO positions expansion** — the portfolio is relocated as-is. No new portfolio features, no
  same-contract merge, no multi-leg grouping, no closed-position pruning (all deferred — OPEN_THREADS
  §7c).
- **NO broker / real-positions / "Live" wiring** — the Live tab and Scanner stay non-functional
  placeholders; `[no-real-order-path]` is untouched; reopening it requires a deliberate owner +
  vendor/broker decision via GATE Z.
- **NO rewrite of any relocated internals** — GEX, positions, personas, ghost-trade, ai-rec internals
  are not edited (relocate-don't-change, §4.1).
- **NO UI/layout/brand/copy/nav-label design** — that is the PM/UX lane (§8). The Architect designs
  routing, layout boundaries, lifecycle, and isolation only.
- **NO auth / route guards / SSR** — none exist today; none added.
- **NO live-keep-alive across navigation** — the session is page-scoped (§3.1); background warm-keep is
  explicitly out of scope (a possible future feature).

---

## 7. Restated binding invariants (the watch list)

| Invariant | How this feature honors it |
|---|---|
| `[additive-keeps-score-byte-identical]` | Pure restructure; scoring path untouched; backend untouched; no relocated feature becomes a scoring input. |
| `[best-effort-isolated-or-null]` | Relocated features keep their isolation; each surface degrades to its own null/empty state; the store's guarded degrade is unchanged. |
| `[live-vs-static-isolation]` | The Ticker viewer's SSE degraded behavior (dim + offline, static keeps rendering) survives the move; the page-scoped session (§3.1) preserves the watchdog. |
| `[operator-vs-trader-path-separation]` | `/_ops/metrics` stays off the shell, unlinked, read-only; the new nav does not link to it. |
| `[no-real-order-path]` | Everything stays `SIMULATED`; the Live tab + Scanner stay non-functional placeholders; no broker/order wiring added. |

---

## 8. OPEN QUESTIONS for the PM (out of the Architect lane)

These are UI/layout/copy/URL-shape/field decisions the PM (then UX) must resolve. The Architect has
bounded each with the binding constraints above; the PM fills the user-facing shape.

- **Q1 — Ticker URL shape.** Exact URL form for the symbol under `/ticker` (`/ticker/:ticker` vs
  `/ticker?symbol=` vs `/ticker` + in-page state). Binding: URL-addressable/deep-linkable; bare
  `/ticker` → default symbol (`TSLA` today); navigate-on-Enter + one-shot DTE pre-fill preserved (§1.3).
- **Q2 — Standalone Positions live data.** What the standalone `/positions` page streams/polls for live
  marks (which ticker(s), SSE vs `GET /api/contract` polling, multi-ticker marking). Binding: ≤1 SSE
  per ticker at a time, no backend change, `[live-vs-static-isolation]` + `SIMULATED` preserved (§4.3).
- **Q3 — Nav labels + the landing page's brand / copy / visuals / colors / CTAs.** All nav labels
  (Ticker/Positions/Scanner wording), the landing positioning copy, brand, visuals, and the CTA targets
  (where "connect your positions" / "see recommendations" lead). Architect designs only that the
  landing is a separate full-bleed route outside the shell with CTAs into the shell routes (§2.3).
- **Q4 — Live session on leaving Ticker.** Architect's decision is **page-scoped teardown** (§3.1).
  Confirm the small reconnect-on-return cost is acceptable product behavior, or escalate a future
  warm-keep-alive as a separate feature (NOT this one).
- **Q5 — Scanner placeholder content.** The "coming soon" copy/visual for `/scanner` (static only).
- **Q6 — Default landing vs. app entry.** Whether returning users should still land on `/` (the splash)
  every time, or whether an entry should deep-link past it — a product/UX call. Architect default: `/`
  is the landing for all visitors (no auth/session state exists to do otherwise).

---

## 9. Summary (one-line shape)

One `<BrowserRouter>` + one `<ThemeProvider>` at the app root (`main.tsx`, unchanged); a flat route
table: `/` = NEW full-bleed `Landing` (outside the shell), a persistent `AppShell` (nav: Ticker /
Positions / Scanner) wrapping `/ticker*` (the relocated `TickerDashboard`, unchanged internals,
URL-addressable symbol), `/positions` (the relocated `PortfolioPanel`, unchanged internals), and
`/scanner` (NEW static placeholder), with `/_ops/metrics` untouched and off the shell. The live-SSE
session is **page-scoped to the Ticker viewer** (mounts on entry, the existing cleanup closes the
EventSource on leave — no leak/double-subscribe, reconnects on return); the positions durable data is
the **module-singleton localStorage store** (mount-independent, survives all nav; only ephemeral
trends/marks re-derive on remount, same as a reload). Pure FE restructure + one new page; backend and
all feature internals untouched.
