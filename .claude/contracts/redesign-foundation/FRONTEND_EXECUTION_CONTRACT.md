# redesign-foundation — FRONTEND EXECUTION CONTRACT

> Role: Delivery UX / Tech-Writer, compressor #3 output. The FE lane's build sheet for the visual reskin
> of the **theme foundation + Landing (`/`) + AppShell nav (+ ConvexaMark, AccountControl avatar/pill)**.
> Self-contained against `PROJECT_CONTEXT.md` (§7 FE-tests rule), `UX_BLUEPRINT.md`, the AMENDED
> `ARCHITECTURE_CONTRACT.md`, the canonical `DESIGN_HANDOFF.md`, and `01-landing.png` / `02-ticker.png`.
> Backend lane = NO_BACKEND_CHANGE. This is the **only** execution file with real work.

## Scope (build exactly this — nothing more)

1. **Theme foundation** (`apps/dashboard/src/app/theme.ts`) — REUSE the existing tokens; add ONE
   self-hosted Roboto Mono numeric handle. All prototype-only extras go in component `sx`, NOT theme keys.
2. **Landing** (`apps/dashboard/src/app/landing/Landing.tsx`) — reskin per `DESIGN_HANDOFF.md` §2.
3. **AppShell** (`apps/dashboard/src/app/shell/AppShell.tsx`) — translucent blur bar + tighter type.
4. **ConvexaMark** (`apps/dashboard/src/app/shell/ConvexaMark.tsx`) — may be restyled visually (data-free).
5. **AccountControl** (`apps/dashboard/src/app/auth/AccountControl.tsx`) — ONLY the signed-in **gradient
   avatar** + the signed-out **outlined "Sign in" pill** `sx` styling. Everything else in AccountControl
   is a deferred surface — preserve every `data-testid`, copy string, menu behavior, auth-degraded path.

OUT (do not touch): Ticker / Positions / Scanner page internals, Settings/auth pages, `AuthDialog`,
`GoogleButton`, the operator surface, and the new `/auth` route (deferred to features 2–4). No route-table
change, no new nav entry, no backend.

---

## A. Theme foundation work

- **Keep `theme.ts` tokens unchanged in role + value**: `background.default #0e1117`, `background.paper
  #161b22`, `primary.main #4f9cff`, `success.main #2ecc71` (calls/+), `error.main #ff5c5c` (puts/−),
  `divider`, `shape.borderRadius 10`, `typography.fontFamily 'Inter, …'`. Do NOT rename, re-base, or
  re-value any key. Do NOT add `#0a0f16`, `--panel`/`--tx`, or any new elevation/text theme key.
- **Add ONE Roboto Mono numeric handle** — a single theme-sourced way to render numerics in mono, 600
  weight (e.g. a `monoFontFamily` field on the theme, a custom typography variant, or a `components`
  override). Expose it as ONE named handle; do NOT scatter raw `fontFamily: 'Roboto Mono'` per component.
  Features 2–4 (GEX values, P/L, prices) inherit it. No Landing/nav numeric uses it yet — establishing it
  is the deliverable.
- **Self-host the fonts** — Roboto Mono (and, if you load the real Inter face, Inter) via `@font-face` in
  the global stylesheet (`styles.css`) / `index.html`. No third-party font CDN at runtime (offline-honesty
  + `no-secrets-in-image` posture). Font-load failure degrades to the existing fallback stack
  (`Inter→system-ui→Segoe UI→Roboto→sans-serif`; mono→`monospace`) — never a blank/error surface.
- **Both themes keep resolving** — `theme`, `lightTheme`, and `themeForPref('light'|'dark'|'system')` all
  construct + resolve; the `COMMON`-shared two-export structure stays (the mono handle is additive, e.g.
  in `COMMON` so both modes inherit it). The direct `import { theme }` in `app.spec.tsx` must keep
  rendering. Do NOT collapse to a dark-only theme. Light stays legible (D2).
- **info/warning roles**: `info.main` (cyan ~`#29b6f6`) = LIVE (features 2–4); `warning.main` (amber) =
  gamma-flip/stale/offline/"coming soon". These reuse MUI's dark defaults — NOT new keys. If a specific
  cyan/amber hex is wanted, set it on the existing `info.main`/`warning.main` entries, never a new key.
- **No second ThemeProvider / Router** (AC-Inv-7). Tokens flow through the one existing
  `auth/ThemeProvider.tsx` + the one `BrowserRouter` in `main.tsx`.

## B. Prototype-only extras — `sx` literals only (ARCHITECTURE §1.4, binding)

Use these as `sx` values where the design calls for them; NEVER promote to a theme key:
- panel-raised `#1c2330`; text-secondary `#8b949e`; text-disabled ~`#5b6675`.
- hatched coming-soon fill: `repeating-linear-gradient(135deg, <paper> 0 18–20px, #14181f 18–20px
  36–40px)` + dashed border — on the brokerage + Scanner blocks (reads as inert).
- nav: `background.paper` @ ~82% alpha + `backdrop-filter: blur(12px)` — on the AppShell bar.
- signed-in avatar gradient: `linear-gradient(<primary.main> → #7b5cff)` — ONLY on the signed-in avatar.
  `#7b5cff` violet appears ONLY here (accent note — FIXED).
- A kept-token hex duplicated inside `sx` is the smell to avoid (reference the role: `bgcolor:
  'background.paper'`, `borderColor: 'divider'`, etc.). A prototype-only extra promoted to a theme key is a
  contract violation.

## C. Landing reskin (per UX_BLUEPRINT §3 + `01-landing.png`)

- **Hero**: keep the `hero-motif` SVG (both bezier paths, `aria-hidden`, ~0.12–0.16 opacity, `primary.main`)
  + add a soft radial primary glow top-right (`sx`). Add the eyebrow pill **"Dealer-gamma analytics"**
  (primary-tinted). Keep ConvexaMark at hero scale, the H1 **"See the AI read on your real positioning."**
  (700, −0.02em, lh ~1.08–1.15), the sub-hook with the dotted **dealer gamma** tooltip, and the contained
  primary CTA **"Open the Ticker viewer →"** (`cta-primary` → `/ticker`). The secondary outlined CTA
  **"See a live example"** (→`/ticker`) is OPTIONAL fidelity — if added, it must navigate (no dead-end).
- **Value cards** (`vp-ticker`/`vp-positions`/`vp-airec`): 3-col `background.paper` outlined cards, each with
  a tinted 40px rounded icon square + a primary-blue MUI glyph (`BarChart` / `AccountBalanceWallet` /
  `AutoAwesome`), the title (700, immutable), the `text.secondary` body (keep the dotted **Dealer
  gamma**/**SIMULATED** tooltips), and the primary text-link CTA (`vp-*-cta`) to its destination. Hover:
  border brightens / optional panel-raise, ≤180ms, no layout shift.
- **Honesty band** (`brokerage-block` 2fr / `scanner-block` 1fr): hatched fill + dashed border on both;
  amber **"coming soon"** chip on each. Brokerage = the non-navigating waitlist toggle (`waitlist-button`
  resting → `waitlist-ack` acknowledged in place, no nav, no network; the button is OUTLINED, never a
  primary/working connect control). Scanner = `scanner-cta` link to `/scanner` only.
- **Footer**: `Divider` + small ConvexaMark + the `footer-disclaimer` simulated/not-advice/no-broker caption.
- **Static**: Landing fetches nothing and opens no stream. Do not add any data read.

## D. AppShell + ConvexaMark + AccountControl reskin

- **Bar**: `background.paper` @ ~82% + `backdrop-filter: blur(12px)`, 1px bottom `divider`, max-width 1240
  centered, 24px gutters, ~60px tall. Structure unchanged: parent `<Outlet/>` route, mounts once, no
  remount across in-shell pages. NO operator link.
- **Nav entries**: keep the existing active rules + `aria-current="page"` + `nav-*` testids. Active =
  `primary.main` label + 2px primary bottom-border; inactive = `text.secondary`; inactive hover →
  `text.primary`. Tighter type per the design.
- **ConvexaMark**: may be restyled visually; stays the single visible "Convexa" wordmark (never
  "GammaFlow"), data-free, fetch-free; keeps `convexa-mark` + the wordmark text.
- **AccountControl** (visual-only delta): signed-out → outlined "Sign in" pill (`AccountCircleIcon` +
  label, `white-space:nowrap`); signed-in → name button + a **32px gradient avatar** (`primary → #7b5cff`,
  links to Settings via the existing menu). Preserve `account-loading` / `account-signin` /
  `account-menu-button` / `account-email` / `account-settings` / `account-logout`, the existing
  `AUTH_COPY.account.*` strings, the menu behavior, and the auth-degraded→"signed out" treatment.

## E. Preservation rules (HARD — every one is a regression gate)

- **Preserve verbatim every `data-testid`** the suite queries. In-scope inventory:
  - AppShell: `app-shell`, `shell-brand`, `nav-ticker`, `nav-positions`, `nav-scanner`, `convexa-mark`.
  - AccountControl: `account-loading`, `account-signin`, `account-menu-button`, `account-email`,
    `account-settings`, `account-logout`.
  - Landing: `landing`, `hero-motif`, `cta-primary`, `vp-ticker`, `vp-positions`, `vp-airec`,
    `vp-ticker-cta`, `vp-positions-cta`, `vp-airec-cta`, `brokerage-block`, `waitlist-button`,
    `waitlist-ack`, `scanner-block`, `scanner-cta`, `footer-disclaimer`.
- **Preserve test-asserted copy verbatim**: `See the AI read on your real positioning.`; the three value
  titles (`Ticker / GEX analysis`, `Simulated positions portfolio`, `AI recommendations`); `coming soon`
  (within each block); `Notify me — coming soon`; `Thanks — we'll let you know when brokerage connect is
  live.`; `Preview the Scanner →`; the footer disclaimer (incl. **simulated**); `Convexa` (never
  "GammaFlow"); the existing `AUTH_COPY.account.signIn` string. Tooltip glosses kept verbatim (UX §3.1).
- **Preserve behavior**: Landing static (no network on `/`, who-am-I excluded); waitlist non-navigating
  resting→ack with no network; every value-card CTA navigates a real route (no dead-end); AppShell mounts
  once + no remount; `aria-current` correct; wordmark → `/`; no `/_ops/metrics` link; one ThemeProvider +
  one Router; both themes resolve.
- **Fidelity never licenses** removing/renaming a testid, changing asserted copy, or making a coming-soon
  affordance look like a working/primary control. Where pixel-exactness conflicts with a preservation rule
  or the honesty floor, preservation wins (note the deviation).

---

## Tests to write (REQUIRED — the FE implements this set; it does NOT choose it)

> Per `PROJECT_CONTEXT.md` §7: unit + component + flow-integration, mocking ONLY the network boundary
> (`fetch` + `EventSource`), never a live backend. This matrix = every in-scope AC × component state ×
> edge/invariant (UX_BLUEPRINT §6). The existing `app.spec.tsx` + `durable/brand.spec.tsx` already cover
> much of this; KEEP them green (do not delete/weaken) and add/extend the named cases below. QA traces
> AC↔test at GATE Q — an uncovered AC is a FAIL even if the suite is green. This is a FLOOR; the FE may add
> unit tests (ceiling) but may never silently drop a required case (untestable → GATE Z bounce).

**Landing — visual fidelity + behavior**
1. `landing-hero-renders-redesigned` (AC-Land-1) — render `/`; assert `hero-motif`, the ConvexaMark
   "Convexa", the exact H1 string, a sub-hook, and `cta-primary` all present.
2. `landing-value-cards-present` (AC-Land-2) — assert the three titles within `vp-ticker`/`vp-positions`/
   `vp-airec`.
3. `landing-coming-soon-band-present` (AC-Land-3) — assert `brokerage-block` + `scanner-block` both render
   and each contains the text `coming soon`.
4. `landing-footer-disclaimer-present` (AC-Land-4) — assert `footer-disclaimer` text incl. "simulated".
5. `landing-matches-export` (AC-Land-5) — structural proxy: assert hero + value-card row + coming-soon
   band + footer all present in one render (reviewer compares to `01-landing.png`).
6. `landing-static-no-network` (AC-Land-6) — render `/`; assert NO non-auth fetch (`calledNonAuth()===false`)
   and `EventSource` opened 0 times (who-am-I `/api/auth/*` excluded).
7. `landing-primary-cta-enters-ticker` (AC-Land-7) — click `cta-primary`; assert the shell mounts
   (`app-shell`) on the Ticker viewer (default TSLA, e.g. `Call wall` appears).
8. `landing-value-cta-navigate-no-deadend` (AC-Land-8) — click `vp-positions-cta` → `portfolio-panel`;
   click `vp-ticker-cta` → Ticker (`Call wall`); neither dead-ends.

**Honesty surfaces**
9. `brokerage-coming-soon-non-navigating` (AC-H1) — `brokerage-block` shows `coming soon`; click
   `waitlist-button` → `waitlist-ack` appears in place, still on `landing`, `calledNonAuth()===false`, no
   navigation. The waitlist control is not styled as a primary/contained connect button.
10. `scanner-block-coming-soon` (AC-H2) — `scanner-block` shows `coming soon` + `scanner-cta` present and
    targets `/scanner` (the honest placeholder); not a working scanner.
11. `simulated-labelling-preserved` (AC-H3) — footer "simulated" framing present + honest (covered with #4).

**AppShell nav**
12. `nav-reskinned-persistent-wordmark` (AC-Nav-1) — on an in-shell page assert `shell-brand` +
    `nav-ticker`/`nav-positions`/`nav-scanner` + the wordmark text `Convexa` and NO `GammaFlow`.
13. `nav-persists-across-pages` (AC-Nav-2) — capture the `app-shell` node; navigate Scanner→Positions→
    Ticker→Scanner; assert the SAME DOM node persisted (no remount/flash).
14. `nav-active-tab-indication` (AC-Nav-3) — on `/positions`, `nav-positions` has `aria-current="page"`;
    `nav-ticker`/`nav-scanner` do not.
15. `wordmark-links-to-landing` (AC-Nav-4) — `shell-brand` href/route is `/`, never `_ops`.
16. `landing-has-no-trader-nav` (AC-Nav-5) — on `/`, `app-shell` + `nav-ticker` are absent.

**Typography**
17. `mono-numeric-handle-established` (AC-Type-1) — assert the theme exposes the named mono handle (unit
    test on `theme`/`themeForPref`); Inter is the body `fontFamily`. (Component-level: a numeric inheriting
    the handle is exercised by features 2–4; here assert the handle exists + resolves for all 3 prefs.)
18. `font-fail-degrades-legibly` (AC-Type-2) — assert the fallback stack is present in the resolved font
    family so a font-load failure degrades to a legible system font (no blank/error surface).

**Theming + isolation**
19. `dark-default-resolves` (AC-Theme-1) — `themeForPref('dark')`/default `theme` resolves to a dark
    palette with no error; the direct `{ theme }` import renders an in-scope surface.
20. `light-theme-resolves-legible` (AC-Theme-2) — `lightTheme` + `themeForPref('light')` resolve to a
    valid light palette (mode `light`, light background); render an in-scope surface under it without
    dark-on-dark leak.
21. `offline-dim-distinguishable` (AC-Theme-3) — unit-assert the role mapping keeps the offline-dim
    distinguishable: `info.main` ≠ `warning.main`, the kept call/put roles are unchanged, and the dim
    `opacity: 0.5` treatment remains visually distinct (theme-level invariant the inherited surfaces rely on).

**Invariants**
22. `testids-and-copy-preserved` (AC-Inv-1) — the existing `app.spec.tsx` + `brand.spec.tsx` stay green;
    no removed/renamed in-scope testid; no changed asserted copy. (This is the regression floor — run it.)
23. `accent-and-callput-meanings-preserved` (AC-Inv-2) — unit-assert the theme keeps `success.main`
    `#2ecc71` (calls) + `error.main` `#ff5c5c` (puts) un-inverted and the primary/info/violet accent
    semantics (violet only on the avatar gradient).
24. `no-backend-change-scoring-untouched` (AC-Inv-4) — render the in-scope surfaces; assert no non-auth
    `/api/*` fetch originates from Landing/nav (the scoring path is never touched; `apps/api` unedited).
25. `durable-keys-unchanged` (AC-Inv-5) — assert rendering the in-scope surfaces writes no new localStorage
    key and the `convexa.*` keyspace is untouched by the reskin.
26. `operator-separation-preserved` (AC-Inv-6) — on a shell page AND on `/`, no rendered link href contains
    `_ops`.
27. `single-theme-single-router` (AC-Inv-7) — deep-link `/ticker/AAPL` + nav to `/positions` work under the
    one harness-supplied ThemeProvider + Router with no duplicate-provider error (the app nests neither).

**Note for the FE:** AC-Inv-3 (degraded + honesty visuals survive) is satisfied by the union of tests
#9/#10/#11 (honesty) + #21 (offline-dim distinguishable) — no separate test required, but it must be
traceable to those at GATE Q. AC-Land-5 is partly a reviewer judgment (side-by-side vs `01-landing.png`);
test #5 is the structural proxy QA traces.
