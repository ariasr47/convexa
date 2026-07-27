# redesign-foundation — ARCHITECTURE CONTRACT

> Role: Delivery Architect (architect-first, GATE A·X; AMENDED at GATE Z · 2026-06-29). TECHNICAL
> SHAPE ONLY of feature `redesign-foundation`. Self-contained against `.claude/PROJECT_CONTEXT.md`
> (§2/§5/§7) + `.claude/contracts/redesign-foundation/BRIEF.md` + the canonical
> `.claude/contracts/redesign-foundation/DESIGN_HANDOFF.md`. No chat-history dependency.
>
> This contract decides the *integration shape* of recreating the Convexa redesign in the tested MUI
> app. It does NOT design UI/layout, copy, component code, endpoint signatures, payload/field names,
> or product scope — those are the PM's (and later UX's) to own. Open questions to the PM are §7.
>
> Scope discipline: this is feature 1 of a 4-feature phased UI-redesign program. Everything outside
> the **foundation + Landing + AppShell** triplet is an explicit non-goal here (§3, §6).

> **GATE Z amendment (2026-06-29).** The owner supplied the authoritative `DESIGN_HANDOFF.md` (this
> folder, with companion `Convexa.dc.html` + `login-page.png`) AFTER GATE A·X locked. It SUPERSEDES the
> token assumptions this contract originally drew from the compiled `Convexa (standalone).html` bundle.
> The token-extraction strategy (§1) is rewritten to **reuse the existing `theme.ts`** (no new tokens
> module, no `#0a0f16` base, no new `--panel`/`--tx` theme keys); the new `/auth` full-page route is
> deferred to feature 4; and the cyan/violet accent semantics are now fixed (not a PM open question).
> See §0a "Design reference" and the per-section AMENDED notes. All other sections stand in intent.

---

## 0a. Design reference (canonical — wins on token VALUES)

`DESIGN_HANDOFF.md` (this folder) — plus its companions `Convexa.dc.html` (the interactive
design-reference prototype: look / layout / copy / behavior of all five surfaces) and `login-page.png`
(the full-page `/auth` surface) — is the **canonical design reference for the whole UI-redesign program
(features 1–4)** and the primary input the UX lane consumes. On token VALUES it **wins** over the 12
`convexa-redesign-screens` screenshots, which were captured from the older `standalone.html` bundle
(slightly different base hex) and remain a visual aid only. Where this contract and `DESIGN_HANDOFF.md`
could conflict on a value, `DESIGN_HANDOFF.md` is authoritative; this contract owns only the *technical
integration shape* (where a token lives, how it flows, what must not regress).

---

## 0. Inputs grounded against the repo (load-bearing facts)

These are the current shapes the contract binds to. Re-derive from code if it drifts.

- **Theme** (`apps/dashboard/src/app/theme.ts`): a `COMMON` block (`shape.borderRadius: 10`;
  `typography.fontFamily: 'Inter, system-ui, …'`; `h1`) spread into **two** `createTheme` exports —
  `theme` (dark, the historical default + anonymous baseline) and `lightTheme` (light, added by
  user-accounts). A `themeForPref(pref)` maps `'light' | 'dark' | 'system'` → a concrete `Theme`.
  Current dark palette: `primary #4f9cff`, `success #2ecc71`, `error #ff5c5c`,
  `background.default #0e1117` / `background.paper #161b22`. This palette is **kept as-is** (§1).
- **Theme application** (`auth/ThemeProvider.tsx`): a SINGLE `<ThemeProvider>` + `<CssBaseline>` wrap
  the whole app, fed by `themeForPref(effective.theme)`. There is exactly one ThemeProvider in prod
  (AC-Inv-8 single-theme); `main.tsx` carries the single `<BrowserRouter>`.
- **Fonts today**: `index.html` loads NO web font; `styles.css` is empty. "Inter" in the theme
  resolves to system fallbacks today. So adding the Roboto Mono numeric handle (and, if desired, the
  real Inter face) is *additive* (no current font asset to break).
- **Consumers in scope**: `landing/Landing.tsx` (static marketing surface, no fetch/SSE), `shell/AppShell.tsx`
  (persistent nav chrome, no feature data/fetch/SSE), `shell/ConvexaMark.tsx` (the wordmark + convex SVG arc).
- **The degraded-state pattern** (`ticker/TickerDashboard.tsx`): live-derived tiles dim to `opacity: 0.5`
  + caption `⏸ offline` on an SSE drop (`STREAM_OFFLINE_MS = 15_000` watchdog); static tiles are
  excluded. This component is OUT of scope this feature (it is feature 2) — but its degraded contract
  is restated here as a HARD preservation rule the token layer must not regress (it consumes the theme).
- **How tests pin** (`app.spec.tsx`, `durable/brand.spec.tsx`): render `<App/>` (or a component) under a
  `ThemeProvider` + `MemoryRouter`, mock ONLY the network boundary (`fetch`/`EventSource`), and assert by
  `data-testid` + visible text + ARIA (`aria-current`). Tests assert *structure/behavior*, not pixels or
  hex values — the reskin must keep every queried `data-testid`, text string, role, and `aria-current`
  intact. (Brand spec asserts the literal wordmark "Convexa" and absence of "GammaFlow".) `app.spec.tsx`
  also imports `{ theme }` directly — that import + render must keep working unchanged.

---

## 1. Token-extraction strategy (the pivotal call) — AMENDED (GATE Z)

> AMENDED. The original clause — "lift the export's CSS-var tokens into a NEW TypeScript tokens module
> as source of truth, with a darker base `#0a0f16` and a new `--panel/--panel2/--raise` + `--tx/--tx2/
> --tx3` theme structure" — is **WITHDRAWN**. `DESIGN_HANDOFF.md` → "Design Tokens" states the opposite:
> the tokens *"already exist in `apps/dashboard/src/app/theme.ts` — reuse them, do not hard-code"*, the
> prototype-only extras are *"to fold into `sx` (not new theme keys)"*, and the page base stays
> `#0e1117` (NOT `#0a0f16`). This is a RESKIN + RE-LAYOUT on the EXISTING theme, not a new token system.

The integration risk is recreating the redesign in a tested MUI/Emotion app **without** (a) introducing
a second, divergent styling system, (b) breaking the dual dark/light themes, or (c) regressing any test.
The decision below is binding; the PM/UX may refine *which sx-level extra is used where*, but not the
layering or the kept theme values.

### 1.1 Single source of truth: the EXISTING `theme.ts` (reused, not replaced)

- **DECISION**: there is **NO new tokens module**. `apps/dashboard/src/app/theme.ts` REMAINS the single
  authoritative palette/typography/shape source. Its current tokens are **kept unchanged in role AND
  value**: `background.default #0e1117` (page base — NOT `#0a0f16`), `background.paper #161b22`
  (cards/panels), `primary.main #4f9cff` (CTAs/links/active nav/spot line), `success.main #2ecc71`
  (calls / +gamma / +P&L), `error.main #ff5c5c` (puts / −gamma / −P&L), `divider` (subtle slate
  borders/baseline), `shape.borderRadius 10` (cards; controls 8px / chips pill via `sx`). No
  hex/elevation/text token key is renamed, re-based, or re-valued by this feature.
- **DECISION**: design semantics flow into the app **through the existing MUI theme**, not through new
  global CSS variables and not through a parallel tokens module. The export's use of CSS vars is an
  implementation detail of the prototype bundle, not a contract the MUI app must mirror.
- **CONSEQUENCE**: there is no new global stylesheet of design tokens and no `:root { --bg: … }` layer.
  `styles.css` / `index.html` may gain at most the font wiring (§1.3) — never token vars.

### 1.2 Live / stale / flip semantics map onto EXISTING MUI palette roles (binding)

The new status vocabulary is expressed via roles ALREADY present in the MUI dark theme — no new
palette keys are added for them:

| Design role | MUI home (binding) | Value |
|---|---|---|
| page background | `palette.background.default` | `#0e1117` (kept) |
| cards / panels | `palette.background.paper` | `#161b22` (kept) |
| CTAs / links / active nav / spot line | `palette.primary.main` | `#4f9cff` (kept) |
| calls / positive gamma / +P&L | `palette.success.main` | `#2ecc71` (kept) |
| puts / negative gamma / −P&L | `palette.error.main` | `#ff5c5c` (kept) |
| **LIVE** status / dot / live chart line | `palette.info.main` | MUI dark default cyan ~`#29b6f6` |
| **gamma-flip** line + **stale** / **offline** + **"coming soon"** | `palette.warning.main` | MUI dark default amber |
| borders / tile baseline | `palette.divider` | subtle slate (kept) |

- **Binding**: the three already-load-bearing colors — `primary #4f9cff`, `success #2ecc71` (calls),
  `error #ff5c5c` (puts) — keep their CURRENT hex and semantic role. Code and tests read these by role
  (`color="primary.main"`, `success.main`, `error.main`); the call=green / put=red mapping is a
  domain-meaning invariant and must NOT be inverted or recolored.
- **Binding**: **`info.main` (cyan) is the LIVE role**; **`warning.main` (amber) is the gamma-flip /
  stale / offline / "coming soon" role**. These reuse MUI's existing dark-theme `info`/`warning`
  defaults — they are NOT new theme keys. If the PM/UX want a specific cyan/amber hex, it is set on the
  existing `info.main` / `warning.main` palette entries, not a new key.

### 1.3 The ONLY additive theme change: Roboto Mono numeric handle

- **DECISION**: the **single permitted additive theme change** is adding **Roboto Mono** as the
  theme-sourced numeric type handle (a mono family / numeric typography handle on `theme.ts`,
  self-hosted). Numbers render in mono, 600 weight (`DESIGN_HANDOFF.md` type scale). Inter stays the UI
  body font; if the real Inter face is not yet loaded, loading it is additive (today it resolves to
  system fallbacks — §0).
- **DECISION**: Roboto Mono is exposed to components as **ONE named theme handle** (a custom typography
  variant or a `monoFontFamily`/numeric handle on the theme), NOT a raw `fontFamily: 'Roboto Mono'`
  scattered per component. The exact mechanism is left to UX/FE; the *binding* is: ONE theme-sourced way
  to render numerics in mono, so the numeric-heavy features 2–4 (GEX values, P/L, prices) inherit it.
- **DECISION (self-host)**: the font assets are **self-hosted** (`@font-face` in the global stylesheet /
  `index.html`), consistent with the offline-honesty + `no-secrets-in-image`/deploy posture. (CDN vs
  self-host detail may be confirmed by PM/UX + deploy, but self-host is the binding default here.)
- **Constraint**: typography changes are presentation-only. No test asserts a `fontFamily`; adding the
  mono handle must not change any `data-testid`, text, or layout role that a test queries.
- **Scope note**: existing ad-hoc `fontFamily: 'monospace'` usages (`operator-metrics.tsx`,
  `ai-rec/StateExportDrawer.tsx`, `personas/components.tsx`) are NOT in scope to migrate this feature
  (they are outside the foundation+Landing+AppShell triplet); reconcile later.

### 1.4 Prototype-only extras live in component `sx`, NOT in new theme keys (binding)

Per `DESIGN_HANDOFF.md` → "Design Tokens", the prototype's extra design values are folded into component
`sx`, never promoted to theme keys:

- **panel-raised** `#1c2330` — `sx`-level, where a raised surface above `background.paper` is needed.
- **text-secondary** `#8b949e` and **text-disabled** ~`#5b6675` — `sx`-level. (Components MAY also use
  the existing MUI `text.secondary` / `text.disabled` roles where they suffice; the specific prototype
  hexes are an `sx` choice, not a re-based theme key.)
- **hatched "coming soon" fill** — `sx`-level `repeating-linear-gradient(135deg, paper 0 18–20px,
  #14181f 18–20px 36–40px)` + dashed border, reading as inert.
- **nav `backdrop-filter: blur(12px)`** + the ~82% translucent `background.paper` bar — `sx`-level on
  AppShell.
- **Rule**: a property that is a *theme token* (the kept palette/typography/shape values) lives in the
  theme and is referenced by role (`bgcolor: 'background.paper'`, `color: 'text.secondary'`,
  `borderColor: 'divider'`, the mono handle). A *prototype-only extra* (the four above) lives in
  component `sx`. A raw kept-token hex duplicated inside a component `sx` is the smell this boundary
  prevents; conversely, a prototype-only extra promoted to a NEW theme key is a contract violation.

### 1.5 Both themes keep resolving (HARD)

- **Binding (user-accounts AC-F4 restated)**: theme is **presentation-only** and never touches the
  bundle/score path. After the reskin, ALL THREE of `theme` (dark default), `lightTheme`, and
  `themeForPref('light'|'dark'|'system')` MUST still construct and resolve. Reusing the existing
  `COMMON`-shared + two-export structure (plus the additive Roboto Mono handle) keeps both modes intact;
  the structure may NOT collapse to a single dark-only theme. `app.spec.tsx` imports `{ theme }`
  directly and renders under it; that import + render must keep working unchanged.
- **Binding**: anonymous + never-touched still resolves to `dark` (AC-A3 zero-regression). The default
  export `theme` stays the dark baseline.
- **Note for the PM (not a decision here)**: the redesign is a *dark* design. The light-mode counterpart
  values for any `sx`-level extra (panel-raised, hatched fill) are a product/UX call (§7 Q2). The
  Architect requires only that `lightTheme` keeps resolving to a legible light theme — it must not become
  broken or dark-leaking.

---

## 2. Reskin boundaries for THIS feature (in-scope vs deferred)

### 2.1 In scope (the foundation triplet)

1. **Foundation** — the EXISTING `theme.ts` (both `theme` and `lightTheme`), kept in value, plus the ONE
   additive Roboto Mono numeric handle (§1.3), the font-asset wiring, and any **shared visual primitive**
   the reskin needs that Landing/AppShell both consume. Establishing the role-mapping (info=live,
   warning=flip/stale/coming-soon) and the `sx`-level extras pattern IS the deliverable — features 2–4
   reuse it.
2. **Landing** (`landing/Landing.tsx`) — recreated as the redesign's marketing surface, visually.
3. **AppShell** (`shell/AppShell.tsx`) — the persistent nav chrome reskinned (translucent blur bar via
   `sx`, gradient avatar, tighter type; no structural change). `ConvexaMark` may be restyled visually
   (it is the brand mark both surfaces render) but stays a UI-only, data-free, fetch-free brand component.

### 2.2 Explicitly deferred (NON-GOALS of this feature)

- **Ticker / GEX viewer** (`ticker/TickerDashboard.tsx`, `gex-profile-chart.tsx`, term-structure /
  fresh-positioning / off-exchange / setups / stat-tile internals, the "What's sent" tray, the
  Open-simulated-position dialog) → **feature 2**.
- **Positions portfolio** (`positions/**`) → **feature 3**.
- **Scanner** stub + **Settings/auth** surfaces (`scanner/**`, `auth/**`, `SettingsPage`, `AuthDialog`,
  `GoogleButton`, `AccountControl` internals) → **feature 4**.
- **New full-page `/auth` route** (`DESIGN_HANDOFF.md` §6 + `login-page.png`) — this is **REAL new
  scope** (a new standalone route + page), not part of the foundation reskin. **DEFERRED to feature 4**
  (Settings/auth). It is explicitly OUT of `redesign-foundation`. No `/auth` route, page, or route-table
  entry is added by this feature. (AMENDED · GATE Z.)
- **Operator metrics** (`operator-metrics.tsx`, `/_ops/metrics`) → **NEVER reskinned by this program**;
  it stays off-shell + visually as-is (see §4 `operator-vs-trader-path-separation`).
- These deferred surfaces will *inherit the new theme/mono handle* the moment the foundation lands (they
  render under the same single `<ThemeProvider>`). That inheritance is EXPECTED and acceptable — a stat
  tile picking up the mono numerics is fine. What is NOT done this feature is any *per-component* reskin
  of those surfaces. The boundary is: **theme changes propagate everywhere; component-level reskin work
  is confined to Landing + AppShell (+ ConvexaMark).**
- **Caveat for the PM (§7 Q3)**: because the theme propagates, the foundation MUST keep the deferred
  surfaces' *behavioral* contracts intact — especially the degraded-state visuals (§3). "We only
  reskinned Landing + AppShell" does not excuse a theme change that makes the `opacity: 0.5` offline dim
  indistinguishable, or recolors call/put.

---

## 3. Preservation rules (HARD — the reskin is visual only)

Every rule below is a regression gate. The suite must stay green; the reskin changes *appearance*, never
*structure or behavior*.

1. **Every existing `data-testid` is preserved**, verbatim. The reskin may restyle the element a testid
   is on, wrap it, or restyle its container — it may NOT remove, rename, or move the testid off the
   element a test queries. Inventory of the in-scope testids that tests assert (non-exhaustive, from
   `app.spec.tsx` + `brand.spec.tsx`):
   - AppShell: `app-shell`, `shell-brand`, `nav-ticker`, `nav-positions`, `nav-scanner`,
     `convexa-mark` (inside the mark).
   - Landing: `landing`, `hero-motif`, `cta-primary`, `vp-ticker`, `vp-positions`, `vp-airec`,
     each `vp-*-cta`, `brokerage-block`, `waitlist-button`, `waitlist-ack`, `scanner-block`,
     `scanner-cta`, `footer-disclaimer`.
2. **Component behavior is preserved.** AppShell stays a parent route rendering `<Outlet/>` that mounts
   ONCE and does not remount across in-shell pages (AC-Nav-4); the `active(path)` nav-active logic and
   `aria-current="page"` stay correct; the wordmark still links to `/`. Landing stays STATIC (no fetch,
   no SSE, no compute — `calledNonAuth()` must stay `false` when rendering `/`); the brokerage waitlist
   stays a non-navigating `resting → acknowledged` toggle; every value-prop CTA still navigates into a
   real in-shell route (no dead-end). The visible brand text stays exactly `Convexa` (and never
   "GammaFlow").
3. **Degraded / honesty visuals survive the reskin (restated, binding even though Ticker is out of scope
   for component reskin — the THEME they consume is in scope):**
   - **`live-vs-static-isolation`**: live-derived UI degrades on an SSE drop — **dimmed (`opacity: 0.5`)
     + `⏸ offline` caption, NEVER blanked** — while static reads keep rendering the last bundle. The new
     theme/role mapping must keep the dimmed state visually distinguishable from the normal and the
     "unavailable this cycle" states. The `⚠ Live offline` chip (amber/`warning.main`) stays legible.
   - **Honesty layer**: `SIMULATED` labels, the "coming soon" chips (amber/`warning.main` + hatched
     `sx` fill), and the honest **non-navigating** brokerage/Scanner surfaces stay non-functional +
     **visually honest** — a reskin must not make a coming-soon affordance *look* like a working/primary
     CTA. The footer simulated-disclaimer stays.
4. **No layout/role break that a test reads.** Text strings that tests assert (e.g. the hero hook "See
   the AI read on your real positioning.", "coming soon", value-prop titles, "Convexa") stay present and
   queryable. Roles tests use (`link`, `progressbar` absence on static pages, `aria-current`) stay valid.
5. **Single ThemeProvider + single Router preserved** (AC-Inv-8): the reskin adds NO second
   `<ThemeProvider>` / `<BrowserRouter>`. Everything flows through the one existing theme.

---

## 4. Isolation / non-goals — binding invariants this feature touches

Restated from PROJECT_CONTEXT §5 "Standing build invariants" + the BRIEF "Invariant watch". This feature
is **FE-only, purely visual**; the following are HARD and reopen only via GATE Z.

- **`[additive-keeps-score-byte-identical]`** — visual only. `apps/api` is **untouched**
  (`NO_BACKEND_CHANGE`). The scoring path (`signals`/`opportunity_score`/`opportunity_tier`/the entry
  gate/`state_fingerprint`) is never imported, altered, or fed by anything in this feature. No theme
  token, font, or style becomes a scoring input. Score/tier/`state_fingerprint` stay byte-identical.
- **`[live-vs-static-isolation]`** — the reskin must NOT regress the dim+offline live-derived treatment
  or the static last-bundle rendering (see §3.3). No live vs static datum changes classification.
- **`[no-real-order-path]`** — no affordance becomes a real broker/order/execution path. `SIMULATED` +
  the honest non-navigating "coming soon" brokerage/Scanner surfaces stay non-functional and visually
  honest. The reskin adds NO new functional control here.
- **`[operator-vs-trader-path-separation]`** — `/_ops/metrics` stays **OFF the shell, unlinked, and
  unstyled by this feature**. The reskin adds no nav entry/link/menu item to the operator route; the
  operator surface keeps its own AppBar and is not part of the foundation reskin.
- **`[loss-free-durable-migration]`** — **NO durable-key or durable-shape change**. Keys stay `convexa.*`.
  A visual reskin touches no localStorage key, value, or migration. (Theme *preference* persistence is
  the existing user-accounts mechanism — unchanged; this feature adds no new durable key.)

### Explicit non-goals (this feature)

- No behavior change. No new endpoint, no payload/field change, no `apps/api` edit.
- No scoring / `opportunity_*` / `state_fingerprint` change.
- No NEW tokens module, no `#0a0f16` base, no new `--panel`/`--tx`/elevation/text theme keys (§1).
- **No new `/auth` full-page route** — deferred to feature 4 (§2.2).
- No IA / route-table change — the route table (`/`, `/_ops/metrics`, the AppShell group with
  `/ticker/:symbol`, `/positions`, `/scanner`, `/settings`) is UNCHANGED. The wordmark still → `/`.
- No component-level reskin of Ticker / Positions / Scanner / Settings/auth / operator (features 2–4 /
  never).
- No new global CSS-var token layer (§1.1). No second ThemeProvider/Router (§3.5).
- No font behavior that breaks offline honesty / deploy secret posture — fonts are self-hosted (§1.3).

---

## 5. Data structure / data flow / component boundaries

This feature is presentation-only, so the "data structure" at stake is the **theme model**, not a
runtime payload.

- **Data flow (binding)**: existing `theme.ts` (`theme` + `lightTheme` via `themeForPref`, plus the
  additive Roboto Mono handle) → single `<ThemeProvider>` (`auth/ThemeProvider.tsx`) → every component
  via MUI `palette`/`typography`/`components` + `sx` references (kept tokens by role; prototype-only
  extras as `sx` literals). No component reads a token bypassing the theme; no global CSS var carries a
  token; no new tokens module exists.
- **Component boundaries (unchanged structurally)**:
  - `theme.ts` — the presentation source of truth (reused, not replaced); imports nothing from the
    trading/bundle/auth runtime path; is never imported BY the scoring path.
  - `ThemeProvider.tsx` — the single application point; structure unchanged.
  - `Landing.tsx` — static marketing surface; no fetch/SSE/compute; restyled in place.
  - `AppShell.tsx` — chrome only; owns no feature data, no fetch, no SSE; restyled in place (blur bar +
    gradient avatar via `sx`); stays a parent `<Outlet/>` route that mounts once.
  - `ConvexaMark.tsx` — UI-only brand mark; data-free, fetch-free; may be restyled visually.
- **Error/isolation rules**: a font that fails to load degrades to the fallback stack (`system-ui`,
  `monospace`) — never a blank or error surface. A theme is constructed at module load with literal
  values (no async, no fetch) so there is no runtime failure mode introduced. Page-level errors keep
  rendering inside the Outlet and never blank the AppShell bar (existing AC-Inv-2; unchanged).

---

## 6. What "done" means (architectural acceptance shape, for the PM to turn into ACs)

- The EXISTING `theme.ts` is reused unchanged in role + value (base `#0e1117`, paper `#161b22`,
  primary `#4f9cff`, success `#2ecc71`, error `#ff5c5c`, divider, radius 10); there is NO new tokens
  module, NO `#0a0f16` base, and NO new elevation/text/`--panel`/`--tx` theme keys.
- Live/stale/flip map onto existing MUI roles: `info.main` (cyan) = live; `warning.main` (amber) =
  gamma-flip / stale / offline / "coming soon". `primary/success/error` keep their hex and semantic
  role; call/put coloring is not inverted.
- The ONE additive theme change — a self-hosted, theme-sourced Roboto Mono numeric handle — is loaded
  and available; numerics render in mono with no per-component font/hex duplication of a token.
- Prototype-only extras (panel-raised `#1c2330`, text-secondary `#8b949e`, text-disabled ~`#5b6675`,
  the hatched coming-soon fill, the nav `backdrop-filter: blur`) live in component `sx`, not theme keys.
- Both `theme` and `lightTheme` resolve; `themeForPref` works for all three prefs (AC-F4); the direct
  `{ theme }` import in `app.spec.tsx` still renders.
- Landing + AppShell (+ ConvexaMark) are reskinned to the redesign visually, with every `data-testid`,
  text string, role, `aria-current`, behavior, and the static-no-network property intact.
- The degraded/offline + honesty visuals stay distinguishable and honest under the new role mapping.
- `apps/api` untouched; no durable-key change; no route/IA change (incl. NO new `/auth` route); no
  second ThemeProvider/Router; the existing suite stays green; the deferred surfaces inherit the
  theme/mono handle but get no component reskin.

---

## 7. Open questions for the PM (PM-owned: scope, copy, semantics — not Architect calls)

These are the decisions outside the Architect's lane. (Accent semantics, formerly Q4, are now FIXED by
`DESIGN_HANDOFF.md` and the GATE Z amendment — see the accent note below — so they are no longer open.)

1. **Fidelity bar** — `DESIGN_HANDOFF.md` says **high-fidelity**: "Final colors, type, spacing, and
   interaction intent. Recreate pixel-closely using MUI + the existing theme." The PM confirms how
   aggressively Landing/AppShell are rebuilt against `Convexa.dc.html`, and that the UX lane reads
   `Convexa.dc.html` / `login-page.png` (canonical) over the older screenshots for any value question.
2. **Light-mode counterpart values** — the redesign is a *dark* design. What are the light-theme
   counterparts for any `sx`-level extra (panel-raised, hatched fill, secondary/disabled text) and for
   the info/warning roles in light mode? (The Architect binds only that `lightTheme` keeps resolving to
   a legible light palette, per AC-F4; the actual light values are a product/brand call.)
3. **Elements with no current data source** — if `Convexa.dc.html` shows any tile/section/affordance on
   Landing or the shell chrome that maps to **no existing data or built capability**, how is it treated?
   Default per the honesty floor: omit it, or render it as an honest "coming soon" / non-navigating
   affordance — never a working-looking control over absent data. The PM confirms per-element
   disposition (and whether any such element even appears in the foundation triplet vs the deferred
   surfaces).
4. **Font delivery confirm** — fonts are **self-hosted** by Architect default (§1.3, offline-honesty +
   `no-secrets-in-image`/deploy posture). The PM/UX + deploy confirm the exact self-hosting wiring for
   Inter + Roboto Mono (this is a confirmation, not an open layering question).

> **Accent note — FIXED (supersedes PM PRODUCT_CONTRACT D4; AMENDED · GATE Z).** In THIS feature:
> **cyan = `info.main` = the LIVE role** (§1.2). **Violet `#7b5cff` appears ONLY as the signed-in
> avatar gradient** (`primary → #7b5cff`, AppShell `AccountControl`, via `sx`) — it is NOT a general
> "AI accent" and is NOT a new theme key. The UX/FE lanes honor `DESIGN_HANDOFF.md` on all accent usage;
> `DESIGN_HANDOFF.md` wins on token VALUES (§0a). This correction is recorded here in lieu of a PM
> re-spawn; the rest of PRODUCT_CONTRACT stands.
