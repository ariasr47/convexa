# Handoff: Convexa Front-End Redesign

> CANONICAL design reference for the whole UI-REDESIGN program (features 1–4). Owner-provided
> 2026-06-29, AFTER GATE A·X/P·X locked — it SUPERSEDES the token assumptions drawn from the
> compiled `Convexa (standalone).html` bundle. Companion files (on the owner's Desktop):
> `Convexa.dc.html` (the interactive design-reference prototype — the source of truth for look/
> behavior) and `login-page.png` (the full-page `/auth` surface). The 12 screenshots in
> `Desktop\convexa-redesign-screens\` were captured from the `standalone.html` bundle (slightly
> different base hex) and remain a useful visual aid; on token VALUES this README wins.

## Overview
A full visual redesign of the Convexa positions-centric options-analytics app — five
surfaces redesigned as one cohesive dark-fintech system: **Landing (`/`)**, **Ticker / GEX
viewer (`/ticker/:symbol`)**, **Positions (`/positions`)**, **Scanner (`/scanner`)**, and
**Settings / Auth**. It keeps the existing identity (dark mode, `#4f9cff` primary, Inter,
10px radius, the convexity-curve hero motif) and the honesty floor (everything is
SIMULATED / paper; "coming soon" surfaces never look functional).

## About the Design Files
`Convexa.dc.html` is a **design reference created in HTML** — a single-file interactive
prototype that shows the intended look, layout, copy, and behavior of all five surfaces (with a
working top-nav, an auth modal, the Ticker connection states, and the Positions table/cards +
grouping toggles). **It is not production code to copy.**

The task is to **recreate this design in the existing codebase** — the `apps/dashboard` React +
**MUI** app in the Nx monorepo — using its established patterns (MUI components, the `theme.ts`
palette, the existing hooks/stores, and the in-place data/SSE lifecycle). The redesign is
presentation-only: **do not change data flow, fetch/SSE logic, store shapes, gating, or the
honesty invariants.** Re-skin and re-lay-out the existing components; keep their wiring.

Open the prototype locally in a browser to click through it. Top nav switches surfaces; on
Ticker, the "Connection (demo)" segmented control toggles **Live / Stale / Offline** to show
the degraded states; "Sign in" opens the auth modal; Positions has Table/Cards, density, and
grouping toggles plus the locked **Live** tab.

## Fidelity
**High-fidelity.** Final colors, type, spacing, and interaction intent. Recreate
pixel-closely **using MUI + the existing theme** — match the prototype's layout, grouping,
copy, and states, but build with `<Card>`, `<Stack>`, `<Box>`, `sx`, theme palette tokens,
and recharts (already in use) rather than the prototype's raw divs/SVG.

---

## Design Tokens
These already exist in `apps/dashboard/src/app/theme.ts` — **reuse them, do not hard-code.**

| Token | Value | Use |
|---|---|---|
| `palette.background.default` | `#0e1117` | page background |
| `palette.background.paper` | `#161b22` | cards / panels |
| `palette.primary.main` | `#4f9cff` | CTAs, links, active nav, spot line |
| `palette.success.main` | `#2ecc71` | calls / positive gamma / +P&L |
| `palette.error.main` | `#ff5c5c` | puts / negative gamma / −P&L |
| `palette.info.main` (MUI dark default) | cyan ~`#29b6f6` | **live** dot/line, live status |
| `palette.warning.main` | amber | gamma-flip line, stale/offline, "coming soon" |
| `divider` | subtle slate | borders, tile baseline |
| `shape.borderRadius` | `10` | cards (controls 8px, chips pill/999px) |
| `typography.fontFamily` | `Inter, system-ui, …` | everything; use a mono (e.g. Roboto Mono) for numerics |

Prototype-only extras to fold into `sx` (not new theme keys): panel-raised `#1c2330`,
text-secondary `#8b949e`, text-disabled ~`#5b6675`, hatched "coming soon" fill
(`repeating-linear-gradient(135deg, paper 0 18-20px, #14181f 18-20px 36-40px)` + dashed border).

Type scale (px @ desktop): hero 50 / h1 27–35 / section 16–18 / tile value 19 / tile label 12 /
body 14 / caption 12–13. Numbers in monospace, 600 weight.

---

## Screens / Views
Map each surface to its real source file(s). "Redesign delta" = what changes vs. today.

### 1. App shell / nav — `apps/dashboard/src/app/shell/AppShell.tsx`
- Sticky top bar, 60px, `background.paper` @ ~82% with `backdrop-filter: blur(12px)`,
  1px bottom divider, max-width 1240 centered, 24px gutters.
- Left: convexity wordmark (small SVG check-curve in primary + "Convexa", 700). Links `/`.
- Nav (left, after wordmark): **Ticker · Positions · Scanner**. Active = primary text +
  2px primary bottom-border; inactive = text-secondary. (Existing `NavLink` rules are correct.)
- Right: when **signed out**, an outlined "Sign in" pill (person icon + label, `white-space:nowrap`)
  opening the auth modal in `signup` mode; when **signed in**, the email (secondary) + a 32px
  gradient avatar (primary→`#7b5cff`) linking to Settings. This is the existing `AccountControl`.
- **Redesign delta:** blur/translucent bar, gradient avatar, tighter type. No structural change.

### 2. Landing (`/`) — `apps/dashboard/src/app/landing/Landing.tsx`
Full-bleed, outside the shell (unchanged routing). Static — no fetch.
- **Hero:** the convexity-curve motif SVG (keep the two bezier paths
  `M0 380 C 300 360, 600 240, 1200 30` + the lighter `M0 400 C 360 390, 700 300, 1200 90`)
  at ~0.16 opacity in primary, plus a soft radial primary glow top-right. Left-aligned column
  (max ~660): a primary pill **"Dealer-gamma analytics"**, the H1 **"See the AI read on your
  real positioning."** (700, −0.02em, line-height 1.08), a secondary sub-line with a dotted
  "dealer gamma" jargon tooltip, then two buttons: contained **"Open the Ticker viewer →"**
  (→`/ticker`) and outlined **"See a live example"** (→`/ticker`).
- **What works today** (eyebrow label + 3-col grid of `background.paper` outlined cards):
  *Ticker / GEX analysis* → `/ticker`; *Simulated positions portfolio* → `/positions`;
  *AI recommendations* → `/ticker`. Each: title 700, secondary body (with jargon tooltips on
  "dealer gamma"/"SIMULATED"), and a primary text-link CTA.
- **Honest coming-soon band** (2fr/1fr grid, **hatched** fill + dashed border to read as
  inert): *🔒 Connect a real brokerage* + amber "coming soon" badge + a non-navigating
  **"Notify me"** (resting → toast "Thanks — we'll let you know…", never enters a broker flow);
  *Scanner* + badge + "Preview the scanner →" (→`/scanner`).
- **Footer:** divider, small wordmark, disclaimer caption: "Convexa is an analysis tool. All
  positions and trades shown are **simulated** (paper). Not investment advice. No brokerage
  connection."
- **Redesign delta:** eyebrow pill, glow, hatched coming-soon cards, "See a live example"
  secondary CTA. Keep all CTA destinations and the non-navigating waitlist behavior.

### 3. Ticker / GEX viewer (`/ticker/:symbol`) — `apps/dashboard/src/app/ticker/TickerDashboard.tsx` + `gex-profile-chart.tsx`
Max-width 1240. **Keep the existing SSE/poll lifecycle, watchdog, skeleton-first cold-load,
and live-vs-static isolation entirely** — only re-lay-out.
- **Control bar:** labeled fields — Ticker (input), Expirations (multiselect), Persona
  (picker), "View AI hand-off", Dark-pool switch. (The prototype's "Connection (demo)" segmented
  control is **demo-only** to show states — do NOT build it; the real states come from the
  stream.)
- **Status row:** regime chip (`positive gamma` success / negative error) + exactly one
  connection chip:
  - **live** → info/cyan, pulsing dot, `● live · open · $386.23`
  - **stale** (`freshness.stale`) → an amber alert banner "data is N old — levels may be
    unreliable" and the session chip (`○ market closed · mid $…`); static levels still shown.
  - **offline** (`streamOffline`) → amber `⚠ Live offline — reconnecting…`; **live-derived
    tiles dim to ~0.45 + `⏸ offline`**; static tiles untouched.
- **Headline:** `TSLA · $386.23` (mono) + `(levels @ $385.27 · all expirations)`; secondary
  **last-trade readout** below (`● Last trade $386.01`, or `⏸ …` dimmed offline, or honest
  "no recent print"). Last-trade is display-only and never feeds the anchor.
- **Tiles — split into two labeled groups** (redesign delta; today it's one grid):
  - **Live tape** (degrade on offline): Net flow (5m), Spread, Gamma flip (live), VWAP,
    Last trade.
  - **Dealer positioning** (snapshot, never live): Call wall (up), Put wall (down), Net GEX
    (up/down), Net DEX, Max pain, IV/HV, Vol/OI, IV skew, Term structure, Opportunity (tier color).
  - Each tile: `background.paper`, 3px left accent (success/error/divider or tier color), 12px
    label (secondary) + optional `ⓘ` with the existing plain-language tooltip, mono value 19px.
    Keep every existing tooltip string verbatim.
- **GEX strike profile** (`gex-profile-chart.tsx`, recharts): horizontal net-GEX-by-strike,
  strikes high→low. Green = call-dominated (net +) right of zero; red = put-dominated (net −)
  left; call/put walls full-opacity + white hairline outline, others ~0.8. Reference lines:
  **spot** (primary, dashed), **gamma flip** (warning/amber, dashed), **live** (info/cyan, solid,
  bold) — each labeled at the right edge. Legend top-right. Optional neutral DEX series stays.
- **Term structure** (recharts line, ATM IV by tenor, "backwardation") and **AI recommendation ·
  TSLA** card side-by-side. AI card: persona-for-this-read select + "View what's sent"; signed-out
  → "Sign in to ask AI" CTA (opens auth modal `login`); signed-in → the rec text / `no_trade`
  state. Keep `AiRecPanel` + `useAiRecommendation` wiring and its independent-nullability.
  - **"View what's sent" tray** (`StateExportDrawer.tsx`): right-side slide-out — a privacy
    summary line, **Copy all**, and three COPY-able sections (Computed snapshot / Persona prompt /
    Field glossary). Read-only export; no LLM call.
- **Fresh positioning (Vol/OI)** (restored), **Off-exchange blocks** (largest prints near spot,
  neutral proximity chip, age), and **Setups** — each setup is a card: title + a non-directional
  severity badge (HIGH amber / MEDIUM blue / LOW grey) + the plain-language read. Empty →
  "No clean setup right now". Keep existing data + copy.
- **Open simulated position dialog** (`ghost-trade/TradeEntryDialog.tsx` / `positions/PositionEntryDialog.tsx`):
  centered modal — `Open simulated position · {TICKER}` + SIMULATED badge; Manual-price / Market /
  Limit tabs; Expiration + Strike selects; CALL/PUT toggle; Quantity; price field; optional
  Stop/Target; "Select a contract to see the fill."; the paper-trade disclaimer ("no broker, no
  real money…"); Cancel + **Open simulated position**. Opened from the ticker's "+ Open simulated
  trade" and the Positions "+ Open simulated position". **No real-order affordance, ever.**
- Ghost-trade panel + embedded Positions portfolio render as today.

### 4. Positions (`/positions`) — `PositionsPage.tsx` / `PortfolioPanel.tsx` / `PositionsView.tsx` / `CustomizationToolbar.tsx` / `PositionRow.tsx` / `PlSparkline.tsx`
- Header: "Positions" + sub ("Your simulated book — paper-only, persisted in this browser.
  Live marks degrade gracefully; records never drop.") + a right-aligned **Net P/L (open)**
  readout (success/error, dims offline).
- **Simulated / Live tabs:** Simulated has a green `PAPER` badge; **Live is locked** (🔒) —
  selecting it shows a hatched "Live positions — coming soon" panel, never a functional table.
- **Toolbar** (`CustomizationToolbar`): saved-view picker (unsaved-change dot), Table/Cards,
  Comfortable/Compact density, Group (None/Ticker/Strategy/Expiry) — grouping renders group
  headers with **subtotals** (success/error). Status filter chips (open/pending/closed/cancelled),
  History, Columns menu, "+ Open simulated position". All re-derive the view; none fetches.
- **Table view:** dense, mono numerics; columns Ticker (sym + leg), Strategy, Qty, Entry, Mark,
  P/L, P/L %, Δ entry, **Trend** (`PlSparkline` — broken-line, `connectNulls={false}`, green/red
  by last value), Expiry · DTE. Live cells (Mark/P&L/%) dim on offline; static cells persist.
- **Cards view:** 2-col; big mono P/L + % and the sparkline up top, then Qty/Entry/Mark/Expiry
  footer.
- Empty / filtered-empty / history states render copy (never blank), as today.

### 5. Scanner (`/scanner`) — `apps/dashboard/src/app/scanner/Scanner.tsx`
Honest coming-soon placeholder, in the shell, **zero data work** (no fetch/SSE/spinner — the
absence of any network call is the requirement). Centered hatched card: a scanner glyph, "Scanner
— coming soon", the roadmap copy, an amber "coming soon" badge, and "Go to the Ticker viewer →".

### 6. Settings / Auth — `SettingsPage.tsx` + `AiKeySection.tsx` + `auth/AuthDialog.tsx` + `auth/GoogleButton.tsx`
- **Settings** (max-width ~640, stacked panels): **Account** (signed-in → avatar + name +
  email + "Sign out"; signed-out → "Sign in to sync…" + Sign in); **AI key** — write-only,
  masked (`sk-ant-•••• 4f9c` + Replace/Remove; empty → password input + "sent once on save,
  never logged" + Save). **No reveal/show/copy control.** **Preferences** (appearance only):
  Active persona select, Default ticker input, Theme segmented (Dark/Light/System). Keep
  server-wins / anonymous-local behavior and the "Affects appearance only" copy.
- **Auth modal** (`AuthDialog`): centered, backdrop blur; toggles signup/login; email + masked
  password; primary submit; "or" divider; **white "Continue with Google"** button (multicolor
  G mark); mode-switch link. Keep the security floor (password never echoed; non-enumerating
  bad-credentials; mapped error codes). On success → close + return to gated action.
- **Full-page `/auth` route** (new — see `login-page.png`): same form as the modal but as a
  standalone page — convexity motif background + centered card with the Convexa wordmark, the
  signup/login toggle, email / password / display-name, Create account / Sign in, the Google
  button, and the paper-only disclaimer. Use for direct visits to `/auth`; the modal stays for
  in-context gated actions. Both share one `AuthDialog`-style form component.

---

## Interactions & Behavior
- **Nav** swaps the in-shell route; shell persists (parent route + `<Outlet/>`), no remount.
- **Auth modal**: open from "Sign in" / gated CTAs (`useGate`), close on backdrop/×, success
  closes and re-runs the gated action.
- **Ticker degraded states** are stream-driven (not a toggle): stale = `freshness.stale` banner;
  offline = `streamOffline` dims live-derived tiles + chart live-line removed + single warning chip.
- **Positions** toggles (layout/density/group/filter/view) re-derive client-side only.
- **Coming-soon** surfaces (brokerage waitlist, Scanner, Live tab) never navigate into or imply a
  built capability; waitlist is a non-navigating acknowledgement.
- Transitions are light (≤180ms fades, hover border/color). No flashy motion.

## State Management
No new global state. Reuse existing hooks/stores: `useGhostTrade`, `usePortfolio`,
`usePersona`, `useAiRecommendation`, `useSettings`, `AuthContext`/`useGate`, and the
Ticker SSE/poll effects. The redesign adds only presentational state already local to each
component (tab/layout/density/group selections, modal open).

## Assets
- `login-page.png` — reference screenshot of the full-page `/auth` login surface.
- No other raster assets. All marks are inline SVG: the wordmark check-curve, the hero convexity
  beziers, and the **landing value-card icons** — bar-chart (Ticker/GEX), wallet (Simulated
  portfolio), sparkle (AI recommendations), lock (Connect a brokerage), radar (Scanner) — each a
  primary-blue line icon in a tinted 40px rounded square. In the app, prefer the matching
  `@mui/icons-material` glyphs (e.g. `BarChart`, `AccountBalanceWallet`, `AutoAwesome`, `Lock`,
  `Radar`) over hand-rolled SVG. Other icons (InfoOutlined, Close, Bolt) stay MUI.
- Fonts: Inter (already configured) + a monospace for numerics (Roboto Mono or the MUI mono stack).

## Files
- `Convexa.dc.html` — the interactive design reference (this bundle). All five surfaces +
  the full-page `/auth` login + auth modal + the "What's sent" tray + the Open-simulated-position
  dialog. The prototype's logic builds the data-viz (GEX bars, term line, sparklines) in plain JS
  for reference — in the app, use recharts as the existing components already do. Open it in a
  browser and click through; the ticker's "Connection (demo)" control toggles the live/stale/offline
  states.
- `login-page.png` — screenshot of the login surface.
- Target source files to edit are listed per-surface above, all under
  `apps/dashboard/src/app/…`. Tokens: `apps/dashboard/src/app/theme.ts` (unchanged).
