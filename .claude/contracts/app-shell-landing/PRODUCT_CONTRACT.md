# app-shell-landing — PRODUCT CONTRACT

> Role: Product Manager (Architect-first, ROLE_LAUNCH_PROMPTS §2). Input = the locked
> ARCHITECTURE_CONTRACT.md (routing/layout shape, lifecycle resolution, §8 open questions Q1–Q6).
> Self-contained against PROJECT_CONTEXT.md + this contract; assume no chat history. This is the
> **product layer** (user stories, scope, behavior, acceptance criteria) on top of the Architect's
> technical shape — it does NOT reopen the routing/layout/lifecycle decisions. Next role:
> UX/Tech-Writer (compressor #2 handoff at the end).
>
> **Goal (derived from the ARCHITECTURE_CONTRACT + BRIEF):** turn the single-page GEX dashboard into a
> **multi-page product** with a **landing/splash page** that carries the new **Convexa** positioning,
> a persistent nav shell, the relocated Ticker viewer + Positions portfolio (behavior unchanged), and
> a Scanner placeholder — feature 1 of the owner pivot (Track A). FE-only restructure + one new page.
>
> **Each AC below is the required behavioral test** the FE must cover and QA traces at GATE Q. One
> observable behavior apiece; degraded/lifecycle/edge variants are split out as their own ACs. Every
> AC is observable WITHOUT reading code.

---

## 1. User stories

- **U1 — Land on the product.** As a visitor, when I open the app at the root, I see a branded
  **Convexa** landing page that tells me what the product does and gives me a clear way into the app —
  not an immediate dump into a ticker chart.
- **U2 — Understand the value.** As a visitor, I can read the lead hook and a few value props that
  explain "AI reads on your real positioning" (built on the GEX profile + dealer-positioning
  heuristics) before I commit to entering the app.
- **U3 — Enter the app.** As a visitor, I can click a clear primary call-to-action on the landing page
  and arrive in the working product (the Ticker viewer).
- **U4 — Navigate the product.** As a user inside the app, I see a persistent nav and can move between
  **Ticker**, **Positions**, and **Scanner** without losing my place or reloading the app.
- **U5 — Analyze a ticker (unchanged).** As a trader, the Ticker viewer works exactly as the GEX
  dashboard did before — same chart, tiles, ghost-trade, AI rec, personas, live stream — now at its own
  route, with a deep-linkable symbol in the URL.
- **U6 — Manage my positions (unchanged).** As a trader, my simulated positions portfolio works exactly
  as before — same views, customization, saved views, P/L, fills — now at its own route, and my
  positions are still there after I navigate around or reload.
- **U7 — Live feed behaves across navigation.** As a trader, the live feed runs while I'm on the Ticker
  page, stops when I leave it, and comes back cleanly when I return — it never silently keeps streaming
  in the background or double-connects.
- **U8 — See what's coming.** As a visitor/trader, I can see that a **Scanner** is coming (a labeled
  placeholder) without it pretending to work.
- **U9 — Honest about what's live now.** As a visitor, the landing page is honest: it presents the
  things that work today (Ticker analysis, the simulated Positions portfolio, AI recs) as usable, and
  presents **connecting a real brokerage** as *coming soon / waitlist* — never a working button that
  dead-ends.
- **U10 — Operator surface untouched.** As an operator, the metrics surface still lives on its own
  route, off the product nav, exactly as before.

---

## 2. Product decisions made here (resolving the Architect's §8 open questions)

These are binding product calls. Final visual/copy/layout polish is the UX/Tech-Writer's lane; the
product calls below are fixed.

### Brand decisions (OWNER-LOCKED — pin these)
- **PD-Brand-1 — Name / rebrand: "Convexa."** The user-facing brand on the landing page and in the app
  nav is **Convexa** (replaces the "GammaFlow" wordmark). **Scope note (binding):** this is the BRAND in
  the UI only — it is **NOT** a repo/package/module rename. Folder names, package names, store keys
  (`gammaflow.positions.v2`, etc.), and code identifiers are **out of scope** (a separate later cleanup).
  No durable-store key may change (that would orphan a user's saved positions — see PD-Brand-1 guard in
  §5 invariants).
- **PD-Brand-2 — Vibe: sleek / dark fintech.** The landing page (and, where it makes sense, the shell)
  reads as a modern dark fintech surface. Exact palette/typography/spacing → UX.
- **PD-Brand-3 — Lead hook: "AI reads on your real positioning."** Supporting line in the spirit of
  *"Connect your positions. Get AI reads on your real risk."* — derived from the GEX profile + dealer-
  positioning heuristics the product already computes. UX may refine the exact wording; the *meaning*
  (AI-assisted reads grounded in real positioning/risk) is fixed.

### Q1 — Ticker URL shape → DECIDED: path segment `/ticker/:symbol`, bare `/ticker` → default `TSLA`
- The symbol lives as a **path segment** under the Ticker route: `/ticker/:symbol` (e.g. `/ticker/TSLA`).
  A **bare `/ticker`** resolves to the **default symbol `TSLA`** (preserving today's `/` → `/TSLA`
  default-ticker UX, relocated under `/ticker`).
- Rationale for the call (product-level): a path segment keeps the symbol **deep-linkable/shareable**
  and matches today's segment-based behavior (`useParams().ticker`, `navigate('/'+symbol)`), so the
  ticker textbox's navigate-on-Enter and the one-shot DTE persona pre-fill keep firing on an explicit
  symbol navigation with the minimal change (prefix only). Query-string and in-page-only state were
  rejected as a needless behavior change.
- This honors the Architect's three binding constraints (URL-addressable/deep-linkable; bare `/ticker` →
  default; navigate-on-Enter + one-shot DTE pre-fill preserved).

### Q2 — Standalone `/positions` live-data sourcing → DECIDED: per-tracked-contract polling via the existing `GET /api/contract`, degrade-to-last-known
- The standalone Positions page sources its marks **the same way the shipped portfolio already does**:
  per-tracked-contract reads from the **existing `GET /api/contract`** (filter-independent tracked-
  contract lookup), with **degrade-to-last-known** when a mark can't be refreshed. **No backend change**,
  **no new endpoint**, and **no requirement that the Positions page open its own live SSE stream.**
- Multi-ticker portfolios: each tracked position marks from its own `GET /api/contract` read for its
  contract; positions across different tickers each get their own marks via the existing mechanism. No
  single "page ticker" stream is required or implied.
- **At most one SSE per ticker at any time** is preserved structurally: the Ticker page is unmounted when
  the user is on `/positions` (Architect §3.1), so there is no concurrent Ticker stream to double up
  with; and this product call does **not** mandate a second SSE on the Positions page.
- `[live-vs-static-isolation]` holds: live-derived marks/P-L degrade to **last-known** (⏸) on a
  fetch/stream failure, while the durable position records, customization, and saved views keep
  rendering. `SIMULATED` and `[no-real-order-path]` are untouched. The exact polling cadence / whether a
  light SSE is also used for liveliness is an **executioner detail bounded by these rules** — but the
  product floor is: marks come from `GET /api/contract`, and a position is **never blanked or dropped**
  because its mark couldn't refresh.

### Q3 — Nav labels + landing sections/CTAs → DECIDED (brand pinned above; structure below; exact microcopy/visuals → UX)
- **Nav labels (product-level, exact wording → UX may refine within meaning):** **Ticker**,
  **Positions**, **Scanner**. The brand wordmark **Convexa** appears in the nav/shell chrome. The nav
  must **not** link to the operator route (`/_ops/metrics`) — that stays unlinked.
- **Landing page required SECTIONS (binding floor — UX designs the visual treatment of each):**
  1. **Brand + hero** — the **Convexa** wordmark + the **lead hook** (PD-Brand-3) + a one-line
     supporting subhead.
  2. **Primary CTA** — a clear, prominent call-to-action that enters the working app (target =
     `/ticker`, i.e. the default-ticker Ticker viewer). See Q6.
  3. **Value props** — a short set (3-ish) of value propositions covering what works today: **Ticker /
     GEX analysis**, the **simulated Positions portfolio**, and **AI recommendations**. Each value prop
     may carry a secondary link/CTA into its surface (e.g. into Positions).
  4. **"Coming soon" / honesty section** — explicitly presents **connect your real brokerage positions**
     as a future capability (coming soon / waitlist), NOT as a working button (see U9 / the Honesty
     constraint and AC-Land-5). The Scanner may also be surfaced here or via the nav as coming-soon.
- **CTA targets (binding):** the primary CTA and any "see your analysis / try it" CTA lead into the
  in-shell app (`/ticker` and/or `/positions`). Any "connect your positions" affordance is **non-
  navigating into a working broker flow** — it is a coming-soon/waitlist affordance only (no dead-end
  button that pretends to connect).
- Exact copy, button labels, visuals, colors, ordering, and responsive layout → **UX/Tech-Writer**.

### Q4 — Live session on leaving Ticker → CONFIRMED: page-scoped teardown/reconnect is acceptable
- The Architect's **page-scoped** decision (the live session mounts on entering Ticker, tears down on
  leaving, reconnects on return) is **confirmed as the correct product behavior.** The small reconnect-
  on-return cost is acceptable. Background warm-keep-alive across navigation is **explicitly out of
  scope** (a possible separate future feature — see §3 Future). This is the centerpiece lifecycle that
  AC-Live-1..4 below pin as required tests.

### Q5 — Scanner placeholder → DECIDED: static "coming soon," no fetch, no compute
- `/scanner` renders a **static "coming soon"** placeholder. It performs **no data fetch, no SSE
  subscription, no scan, no compute, no backend call.** It conveys that a multi-ticker scanner is coming
  later. Exact copy/visual → UX (a short honest "Scanner — coming soon" message; it must not imply it is
  working or loading).

### Q6 — Default landing vs. app entry → DECIDED: `/` always shows the landing page; the app is entered via a CTA
- `/` **always** renders the **Convexa landing page** for all visitors. There is no auth/session state
  to deep-link past it, and the landing page is the product's front door. Users enter the working app by
  clicking a CTA (Q3 → `/ticker`). Returning users are **not** auto-bounced past the landing; `/` is the
  landing every time. (If a future feature wants returning-user deep-linking, that's a separate call.)

---

## 3. Scope

### In scope (this feature)
- A **landing/splash page** at `/` carrying the **Convexa** brand, the lead hook, value props, a primary
  CTA into the app, and an honest "coming soon" treatment of real-brokerage connect + Scanner.
- A **persistent nav shell** (Convexa wordmark + **Ticker / Positions / Scanner** nav) wrapping the three
  in-shell pages; the shell persists across navigation between those three pages.
- The **Ticker viewer** relocated to `/ticker/:symbol` (bare `/ticker` → `TSLA`), **behavior unchanged**.
- The **Positions** portfolio relocated to `/positions`, **behavior unchanged**, sourcing marks via the
  existing `GET /api/contract` with degrade-to-last-known (Q2).
- A **Scanner** placeholder at `/scanner` (static "coming soon", no fetch).
- The **page-scoped live-feed lifecycle** (mount on Ticker → teardown on leave → clean reconnect on
  return → never double-subscribe).
- **Positions store persistence** across navigation + reload (durable records/customization/saved views;
  ephemeral marks/trends re-derive).
- **Invariant preservation** of all relocated features (live-degrade still works, scoring untouched,
  positions **Live** tab stays LOCKED, everything stays SIMULATED).
- The **Convexa wordmark** swapped into the user-facing brand surfaces (landing + nav). UI brand only.

### Out of scope (NOT this feature)
- **Any backend change** — no new endpoint, no payload change, no SSE change.
- **Repo/package/store-key rename** to "convexa" — the Convexa brand is **UI-only**; code identifiers,
  package names, folder names, and durable-storage keys stay as-is (separate later cleanup).
- **Real brokerage connect / "connect your positions" functionality** — presented as coming-soon/
  waitlist only; no broker, no real-position read, no working connect button. The positions **Live** tab
  stays the zero-import LOCKED placeholder.
- **Scanner functionality** — placeholder only; no scan/fan-out/multi-ticker fetch/compute.
- **Positions expansion** — no new portfolio features (no same-contract merge, multi-leg grouping,
  closed-position pruning); relocated as-is.
- **Any rewrite of relocated internals** — GEX, positions, personas, ghost-trade, ai-rec internals are
  not edited (relocate-don't-change).
- **Auth / route guards / SSR / returning-user deep-link-past-landing.**
- **Background warm-keep-alive of the live session across navigation** (Q4 — possible future feature).
- **AI recs on positions** (that is the later `positions-page-expansion` feature).

### Future-dated (design-for seams — do NOT build now)
- **Real brokerage connect** (Track B `broker-connect`) — the "coming soon / waitlist" landing affordance
  + the LOCKED positions **Live** tab are the seams it lands in. **Must not be precluded:** the honesty
  section's coming-soon affordance is a non-functional placeholder that a later feature replaces with a
  real connect flow.
- **Scanner** (the later `scanner` feature) — the `/scanner` route + nav entry are the seam; the later
  feature replaces the placeholder with real scan logic.
- **AI recs on positions** (`positions-page-expansion`) — lands on the relocated `/positions` page.
- **Warm-keep-alive of the live feed across navigation** — a separate feature if ever wanted (Q4).

---

## 4. Acceptance criteria (each AC = one required behavioral test; observable without reading code)

> Convention: each AC is one observable behavior. Degraded/lifecycle/edge variants are their own ACs.
> QA traces every AC to ≥1 named passing test at GATE Q.

### Routing — each route renders its page (the route table)
- **AC-Route-1 — Landing at root.** Navigating to `/` renders the **Convexa landing page** (brand + hook
  + value props + a primary CTA). `/` does **NOT** redirect to a ticker.
- **AC-Route-2 — Ticker route renders.** Navigating to `/ticker/TSLA` renders the Ticker viewer (the GEX
  dashboard) for `TSLA`, inside the persistent nav shell.
- **AC-Route-3 — Bare ticker defaults.** Navigating to a bare `/ticker` (no symbol) renders the Ticker
  viewer for the **default symbol `TSLA`**.
- **AC-Route-4 — Deep-linkable symbol.** Navigating directly to `/ticker/AAPL` (a non-default symbol)
  renders the Ticker viewer for `AAPL` (the symbol is URL-addressable / shareable).
- **AC-Route-5 — Positions route renders.** Navigating to `/positions` renders the positions portfolio
  page, inside the persistent nav shell.
- **AC-Route-6 — Scanner route renders.** Navigating to `/scanner` renders the **static "coming soon"**
  Scanner placeholder, inside the persistent nav shell.
- **AC-Route-7 — Operator route stays separate.** Navigating to `/_ops/metrics` renders the operator
  metrics surface with its **own** AppBar, **outside** the product nav shell, exactly as before. The
  product nav does **not** show or link to it.

### Navigation + shell persistence
- **AC-Nav-1 — Persistent nav present.** On any of `/ticker*`, `/positions`, `/scanner`, the persistent
  nav (Convexa wordmark + **Ticker / Positions / Scanner** entries) is visible.
- **AC-Nav-2 — Nav moves between pages.** From `/ticker/TSLA`, clicking the **Positions** nav entry
  navigates to `/positions` and renders the Positions page; clicking **Ticker** returns to the Ticker
  viewer; clicking **Scanner** goes to the Scanner placeholder.
- **AC-Nav-3 — Active-route indication.** The nav indicates which of Ticker / Positions / Scanner is the
  active/current page.
- **AC-Nav-4 — Shell does not remount across in-shell pages.** Navigating Ticker → Positions → Scanner →
  Ticker keeps the same nav shell mounted (the chrome does not flash/reload between the three pages).
- **AC-Nav-5 — Landing carries no product nav.** The `/` landing page does **not** render the trader nav
  shell (it is its own full-bleed page).

### Landing page (Convexa brand + hook + value props + CTA + honesty)
- **AC-Land-1 — Brand + hook.** The landing page shows the **Convexa** wordmark and the lead hook
  ("AI reads on your real positioning," wording-final per UX).
- **AC-Land-2 — Value props.** The landing page shows value-prop content covering the **today-working**
  capabilities: Ticker/GEX analysis, the simulated Positions portfolio, and AI recommendations.
- **AC-Land-3 — Primary CTA enters the app.** The landing page shows a clear primary CTA; activating it
  navigates into the working app (the Ticker viewer at `/ticker`), landing inside the nav shell.
- **AC-Land-4 — Secondary CTA into a surface (if present).** Any value-prop secondary CTA (e.g. into
  Positions) navigates to its in-shell route and renders that page. (If UX renders only the primary CTA,
  this AC maps to the primary; no value-prop CTA may dead-end.)
- **AC-Land-5 — Honesty: brokerage connect is coming-soon, not working.** The landing page presents
  **connecting a real brokerage / "connect your positions"** as **coming soon / waitlist** — it is **not**
  a working button that navigates into a broker flow or dead-ends. Activating any such affordance does
  NOT enter a broker connection (it shows coming-soon/waitlist intent only).
- **AC-Land-6 — Scanner presented as coming-soon on landing/nav.** The Scanner is presented as a future
  capability (coming-soon), consistent with the placeholder route (not as a working feature).

### Live-feed lifecycle (THE centerpiece — Ticker→Positions→Ticker)
- **AC-Live-1 — Feed opens on Ticker.** Entering the Ticker page opens exactly **one** live feed
  (EventSource) for the current symbol.
- **AC-Live-2 — Feed closes on nav-away.** Navigating away from the Ticker page (to Positions or Scanner)
  **closes** the live feed — it does not keep streaming in the background, and there is no orphaned/leaked
  connection.
- **AC-Live-3 — Feed reopens on return.** Navigating back to the Ticker page opens a **fresh** live feed
  that reconnects cleanly (cold-start path), with live data resuming.
- **AC-Live-4 — Never double-subscribed.** At no point during a Ticker → Positions → Ticker round-trip
  (and across a symbol change) are there **two concurrent** live feeds for the same symbol.
- **AC-Live-5 — Symbol-change still single-subscribes.** Changing the symbol on the Ticker page (textbox
  navigate-on-Enter to a new `/ticker/:symbol`) closes the prior feed and opens exactly one feed for the
  new symbol (no double-subscribe across the change).

### Positions store persistence (across navigation + reload)
- **AC-Store-1 — Position survives navigation.** Opening a simulated position on the Positions page, then
  navigating away and back, shows that **same position still present** (durable record not lost).
- **AC-Store-2 — Position survives reload.** Opening a simulated position, then reloading the app, shows
  that position **still present**.
- **AC-Store-3 — Customization + saved views survive nav + reload.** Customization (columns/sort/filter,
  layout/density) and **named saved views** persist across navigation and reload.
- **AC-Store-4 — Cross-page write is already present.** A position opened from the **Ticker** page (via
  the ghost-trade/portfolio entry) is **already present** when navigating to `/positions` (same durable
  store; no prop-drilling required).
- **AC-Store-5 — Ephemeral marks/trends re-derive (acceptable).** After navigating away and back (or
  reloading), the per-position **P/L trend sparkline** and session delta re-derive from scratch (they are
  ephemeral by design) while the **durable P/L facts** (entry, realized) and the position itself remain
  intact. This is acceptable, not a regression.

### Positions live-data sourcing on the standalone page (Q2 — degraded variants split out)
- **AC-PosLive-1 — Marks populate from the existing source.** On `/positions`, tracked positions show
  current marks / P-L sourced via the existing tracked-contract mechanism (`GET /api/contract`), without
  any new backend endpoint.
- **AC-PosLive-2 — Mark refresh failure degrades to last-known (not blanked).** When a position's mark
  cannot be refreshed (fetch/stream failure), that position shows its **last-known** mark/P-L (⏸/stale
  indication) and is **never blanked or removed** — the durable record, customization, and saved views
  keep rendering. (`[live-vs-static-isolation]`.)
- **AC-PosLive-3 — Tracked contract not found (404).** When a tracked contract is not found in the
  current snapshot (404), the position remains listed with its durable facts and a "tracking
  unavailable"/last-known state — it is **not** dropped and does not error the page.
- **AC-PosLive-4 — No quote available (null).** When the tracked contract exists but has no NBBO quote
  available, the position falls back to its honest mark/last-known state without throwing into the page.

### Scanner placeholder (Q5)
- **AC-Scan-1 — Static coming-soon.** `/scanner` shows a static "coming soon" message and performs **no**
  network fetch, **no** SSE subscription, and **no** scan/compute (observable: no bundle/scan request is
  issued when the Scanner page is shown).

### Invariant preservation (the relocated features behave exactly as before)
- **AC-Inv-1 — Ticker live-degrade still works (`[live-vs-static-isolation]`).** On the relocated Ticker
  page, when the live SSE drops, the live-derived tiles dim + show `⏸ offline` (never blanked) while the
  static bundle (GEX chart, static tiles, blocks, term structure, fresh positioning) **keeps rendering**
  the last bundle — exactly as before the relocation.
- **AC-Inv-2 — Ticker cold-start failure is the only blank screen.** On the relocated Ticker page, a
  cold-start bundle failure shows the existing red error + **Retry**; a post-success refresh failure
  keeps the bundle behind the soft "Couldn't refresh" warning. Page isolation: a Ticker error does not
  blank the nav shell or the other pages.
- **AC-Inv-3 — Positions "Live" tab stays LOCKED (`[no-real-order-path]`).** On the relocated Positions
  page, the **Live** tab is still the non-functional **LOCKED** "coming soon / not connected" placeholder
  — no broker, no order path, no real-position data source.
- **AC-Inv-4 — Everything stays SIMULATED.** All positions/trades on the relocated Positions + Ticker
  pages remain `SIMULATED` (paper); no real order/execution path is reachable anywhere in this feature.
- **AC-Inv-5 — Scoring untouched (`[additive-keeps-score-byte-identical]`).** The relocation does not
  change any scoring output — `opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry
  gate behave identically (no relocated feature becomes a scoring input; backend untouched). Observable:
  the Ticker viewer's tier/score readouts for a given bundle are the same as before the move.
- **AC-Inv-6 — Best-effort isolation preserved (`[best-effort-isolated-or-null]`).** Each independently-
  nullable surface (off-exchange blocks, the four neutral metrics, ghost-trade, ai-rec, personas, the
  positions store) still fails to its own "unavailable"/empty state and does **not** throw into the page
  or the shell, on both the Ticker and Positions pages.
- **AC-Inv-7 — Operator path separation preserved (`[operator-vs-trader-path-separation]`).**
  `/_ops/metrics` stays off the product nav, **unlinked**, read-only, and side-effect-free; the new nav
  does not reach it.
- **AC-Inv-8 — Single router / single theme provider.** The app runs with exactly one router and one
  theme provider at the root (observable: no duplicate-router/duplicate-theme console errors; nav,
  deep-links, and theming all work app-wide consistently).
- **AC-Inv-9 — Brand swap is UI-only (store keys unchanged).** The Convexa brand appears in the UI
  (landing + nav), but a user's previously-saved simulated positions and saved views **persist** through
  this feature (the durable store key is unchanged) — observable: positions saved before the rebrand are
  still present after.

---

## 5. Binding constraints the next role (UX/Tech-Writer) must NOT violate

Restated so UX inherits them without re-reading the ledger. These are promoted-canon (reopen only via
GATE Z) plus this feature's product constraints.

- **`[live-vs-static-isolation]`** — every live-derived datum degrades on a feed drop (dim + offline,
  never blank) while static reads keep rendering the last bundle. UX must spec the degraded wording for
  the Ticker live tiles (relocated, unchanged) and the Positions last-known marks — never a blank/dropped
  position on a mark-refresh failure.
- **`[best-effort-isolated-or-null]`** — each relocated nullable surface degrades to its own
  unavailable/empty state, never throwing into the page or shell. UX specs those empty/unavailable
  states; relocation keeps them.
- **`[additive-keeps-score-byte-identical]`** — pure restructure; the scoring path is untouched and no
  relocated feature becomes a scoring input. UX must not introduce any UI that feeds positions/marks into
  scoring.
- **`[no-real-order-path]`** — everything stays `SIMULATED` (paper, mandatory confirm). The positions
  **Live** tab + the Scanner + the landing "connect your positions" affordance are **non-functional
  placeholders** — UX must present them as coming-soon/locked, never as a working broker/order path.
  Reopening this requires a deliberate owner + vendor/broker decision (GATE Z).
- **`[operator-vs-trader-path-separation]`** — `/_ops/metrics` stays off the product nav, unlinked,
  read-only. UX must not add a nav link to it.
- **Convexa brand is UI-only** — the rebrand is the wordmark/copy on the landing + nav only. UX must NOT
  rename code/packages/folders or any durable-storage key (that would orphan a user's saved positions —
  AC-Inv-9). Out of scope for this feature.
- **Honesty floor** — the landing communicates the full vision but the brokerage connect is **not live**.
  No CTA/affordance may present an un-built capability as working. Today-working surfaces (Ticker,
  Positions sim, AI recs) are usable; real-brokerage connect + Scanner are coming-soon. (Honors
  `[best-effort-isolated-or-null]` and the owner-locked vision.)
- **Relocate-don't-change** — the Ticker viewer + Positions portfolio behave exactly as before. UX
  designs only the NEW chrome (landing, nav shell, Scanner placeholder) + the degraded-state wording for
  the relocated surfaces; it does not redesign the relocated internals.
- **Default-ticker UX** — bare `/ticker` lands on `TSLA`; the symbol is a deep-linkable path segment;
  navigate-on-Enter + the one-shot DTE persona pre-fill still fire on explicit symbol navigation.

---

## 6. Amendments bounced to Architect (GATE Z)

**None.** Every product outcome required above is supported by the locked technical shape:
- The landing/CTA/honesty/value-prop/Scanner-placeholder content is all NEW static UI within the
  Architect's `Landing` + `Scanner` + `AppShell` boundaries (§2, §4.2).
- The Ticker URL shape (Q1), Positions marks sourcing (Q2), page-scoped feed (Q4), Scanner static (Q5),
  and landing-as-entry (Q6) all fall inside the Architect's bounded constraints — no constraint had to be
  loosened, and no outcome required a backend change or a relocated-internals edit. No scope was silently
  narrowed; the honesty constraint is satisfied by the existing LOCKED-placeholder seams, not by dropping
  a promised capability.

If UX or the executioners discover the locked shape can't support one of these ACs, that is a GATE-Z
bounce back to the Architect (e.g. via an ARCHITECTURE_CONTRACT amendment) — not a silent narrowing.
