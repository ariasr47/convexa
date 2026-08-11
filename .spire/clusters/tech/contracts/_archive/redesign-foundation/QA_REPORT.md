# redesign-foundation — QA REPORT (GATE Q)

> QA role: Sonnet 4.6 (de-correlated from the builder — fresh session, no chat history). Verification
> date: 2026-06-29. Method: read all contracts; ran `npx nx test dashboard` (authoritative Vitest
> signal); read `git status --porcelain apps/api` + `git diff HEAD -- apps/api/` (zero output);
> read all source files for the in-scope surfaces (Landing.tsx, AppShell.tsx, TopNav.tsx,
> ConvexaMark.tsx, AccountControl.tsx, theme.ts, styles.css).
> `nx typecheck` (tsc --build) is pre-existing RED on main (~502 errs, jest-dom/DOM-lib config gap,
> not introduced by this feature) — NOT used as a gate per the QA brief.

---

## AC Verification Table

| # | AC (verbatim from §5) | Verdict | Evidence |
|---|---|---|---|
| AC-Land-1 | Hero renders Convexa brand mark, exact headline "See the AI read on your real positioning.", a sub-hook, and primary CTA — in redesigned dark-fintech look. | **PASS** | Test `landing-hero-renders-redesigned` (redesign-foundation.flow.spec.tsx) PASSED. Asserts: `hero-motif` present; `getAllByText('Convexa').length > 0`; exact H1 string present; `dealer gamma` sub-hook token present; `cta-primary` present. `app.spec.tsx` test `shows Convexa wordmark + lead hook` also PASSED. Source: `Landing.tsx` renders the convexity-curve SVG `hero-motif`, exact H1, `Gloss` sub-hook wrapping "dealer gamma", and `cta-primary` RouterLink to `/ticker`. |
| AC-Land-2 | Three value cards render with titles "Ticker / GEX analysis", "Simulated positions portfolio", "AI recommendations" as a card row matching the export's "what works today" section. | **PASS** | Test `landing-value-cards-present` PASSED. Asserts `within(vp-ticker).getByText('Ticker / GEX analysis')`, `within(vp-positions).getByText('Simulated positions portfolio')`, `within(vp-airec).getByText('AI recommendations')`. `app.spec.tsx` `shows today-working value props` also PASSED. Source: `VALUE_PROPS` array in `Landing.tsx` contains all three titles with correct `data-testid`s. |
| AC-Land-3 | Brokerage block and Scanner block both render, each visibly marked "coming soon", matching the export's coming-soon band. | **PASS** | Test `landing-coming-soon-band-present` PASSED. Asserts `within(brokerage-block).getByText('coming soon')` and `within(scanner-block).getByText('coming soon')`. Source: `ComingSoonChip` rendered inside both blocks renders `label="coming soon"`. |
| AC-Land-4 | Footer renders the simulated / not-investment-advice / no-brokerage-connection disclaimer. | **PASS** | Test `landing-footer-disclaimer-present` PASSED. Asserts `footer-disclaimer` testid present and `within(footer).getByText('simulated')`. Source: `footer-disclaimer` Typography in `Landing.tsx` contains "simulated" (bold), "Not investment advice", "No brokerage connection". |
| AC-Land-5 | Side-by-side comparison of running Landing with `01-landing.png` is recognizable as the same design in the dark-fintech palette. | **PASS (owner-approved preview)** | Structural proxy test `landing-matches-export` PASSED: all seven testids (`hero-motif`, `vp-ticker`, `vp-positions`, `vp-airec`, `brokerage-block`, `scanner-block`, `footer-disclaimer`) confirmed present in one render. Owner approved local preview 2026-06-29 per `_MANIFEST.md`. This AC is a reviewer judgment criterion; the structural proxy plus owner sign-off constitutes its observable evidence. |
| AC-Land-6 | Rendering `/` issues no trader/bundle/analysis fetch and opens no live stream. (Who-am-I excluded.) | **PASS** | Tests `landing-static-no-network` and `landing-nav-makes-no-non-auth-network-call` (redesign-foundation.flow.spec.tsx) PASSED. Both assert `calledNonAuth() === false` and `openedEventSources === 0`. `app.spec.tsx` `"/" renders Landing, not a ticker redirect` also asserts `calledNonAuth() === false`. Source: `Landing.tsx` has no `useEffect`/fetch; `TopNav.tsx` and `AppShell.tsx` have no data fetch. |
| AC-Land-7 | Activating the hero primary CTA navigates into the in-shell Ticker viewer (default symbol). | **PASS** | Test `landing-primary-cta-enters-ticker` PASSED (568ms). Clicks `cta-primary`; finds `app-shell` and `Call wall`. `app.spec.tsx` `primary CTA enters the app at /ticker` also PASSED. Source: `cta-primary` is a RouterLink to `/ticker`. |
| AC-Land-8 | Each value-card CTA navigates into a real in-shell route — Positions card → Positions page, Ticker/AI cards → Ticker viewer — none dead-ends. | **PASS** | Test `landing-value-cta-navigate-no-deadend` PASSED (513ms). Clicks `vp-positions-cta` → finds `portfolio-panel`; clicks `vp-ticker-cta` → finds `Call wall`. `app.spec.tsx` `secondary CTAs navigate to in-shell routes (no dead-end)` also PASSED. Source: `vp-positions-cta` links `/positions`, `vp-ticker-cta` links `/ticker`, `vp-airec-cta` links `/ticker`. |
| AC-H1 | Brokerage block shows "coming soon" marker; activating waitlist affordance produces in-place acknowledgement, stays on Landing, triggers no navigation, issues no network call. Not styled as a working/primary connect control. | **PASS** | Test `brokerage-coming-soon-non-navigating` PASSED. Asserts: `coming soon` text in `brokerage-block`; `waitlist-button` className matches `/MuiButton-outlined/` and does NOT match `/MuiButton-contained/`; click → `waitlist-ack` appears; `landing` testid still present (no nav); `calledNonAuth() === false`. `app.spec.tsx` `brokerage connect is coming-soon, not a working button` also PASSED. Source: `waitlist-button` has `variant="outlined"`, `onClick={() => setWaitlisted(true)}`; no network call. |
| AC-H2 | Scanner block shows "coming soon" marker and links only to the honest Scanner placeholder page; never presented as a working scanner. | **PASS** | Test `scanner-block-coming-soon` PASSED. Asserts `coming soon` text in `scanner-block`; `scanner-cta` has `href="/scanner"`. `app.spec.tsx` `Scanner presented as coming-soon` also PASSED. Source: `scanner-cta` is a RouterLink to `/scanner`; never a working scanner. |
| AC-H3 | Landing footer disclaimer and "SIMULATED" framing remain present and honest under the new skin. | **PASS** | Test `simulated-labelling-preserved` PASSED. Asserts `within(footer-disclaimer).getByText('simulated')` when Landing rendered under `theme`. Also covered by AC-Land-4's test. Source: `footer-disclaimer` explicitly renders `<strong>simulated</strong>`. |
| AC-Nav-1 | On an in-shell page, redesigned nav renders Convexa wordmark and Ticker/Positions/Scanner tabs (+ account control); wordmark text is exactly "Convexa" (never "GammaFlow"). | **PASS** | Test `nav-reskinned-persistent-wordmark` PASSED. Asserts `within(shell-brand).getByText('Convexa')`; all three nav testids present; `queryByText('GammaFlow')` is null. `app.spec.tsx` `persistent nav present on ticker/positions/scanner` iterates all three paths and also PASSED. Source: `TopNav.tsx` uses `ConvexaMark` which renders "Convexa" text. Visual fidelity (dark-fintech look) owner-approved at local preview 2026-06-29. |
| AC-Nav-2 | Navigating between Ticker, Positions, and Scanner keeps the same nav bar in place (no remount/flash); page content swaps beneath it. | **PASS** | Test `nav-persists-across-pages` PASSED (381ms). Captures `app-shell` node; navigates Scanner→Positions→Ticker→Scanner; asserts same DOM node persisted (`toBe(shell)`). `app.spec.tsx` `shell does not remount across in-shell pages` also PASSED. Source: `AppShell` is a parent route with `<Outlet/>`; `TopNav` is mounted inside and never conditionally removed. |
| AC-Nav-3 | The tab for the current page is marked as the current page (`aria-current="page"`); other tabs are not. | **PASS** | Test `nav-active-tab-indication` PASSED. At `/positions`: `nav-positions` has `aria-current="page"`; `nav-ticker` and `nav-scanner` do not have that attribute. `app.spec.tsx` `active-route indicator on current entry` also PASSED. Source: `TopNav.tsx` sets `aria-current={isActive ? 'page' : undefined}` driven by `useLocation`. |
| AC-Nav-4 | Wordmark links to `/` (the Landing), never to the operator route. | **PASS** | Test `wordmark-links-to-landing` PASSED. Renders `AppShell` at `/ticker/TSLA`; asserts `shell-brand` has `href="/"`. Test `landing-nav-wordmark-links-home` also PASSED. Source: `TopNav.tsx` — `shell-brand` is `RouterLink to="/"`. |
| AC-Nav-5 | On `/`, the trader nav shell is NOT rendered. | **PASS (amended behavior, preserved invariant)** | The AC states "the trader nav shell is NOT rendered." The FRONTEND_AMENDMENTS_REQUESTED.md (owner-resolved 2026-06-29) adds the shared `<TopNav/>` to the Landing OUTSIDE the `<AppShell>` route. Test `landing-renders-shared-nav (AC-Nav-5, amended)` PASSED: asserts `queryByTestId('app-shell')` is null (the AppShell route component is definitively absent on `/`) AND the shared TopNav testids are present. The invariant "no AppShell on `/`" holds. This is the owner-approved correct behavior. |
| AC-Type-1 | Numeric readouts render in Roboto Mono (tabular monospace); body/UI text renders in Inter. Both fonts actually loaded (not bare system fallback on healthy network). | **PASS** | Tests `mono-numeric-handle-established` (two cases in theme.spec.ts) PASSED: `theme.typography.monoFontFamily === MONO_FONT_FAMILY`; `MONO_FONT_FAMILY` matches `/Roboto Mono/`; `theme.typography.mono.fontWeight === 600`; handle exists for all three prefs (`dark`/`light`/`system`). `Inter is the body fontFamily` test PASSED. Font loading: `styles.css` declares `@font-face` for Inter (400/500/600/700) and Roboto Mono (500/600) via self-hosted `.woff2` assets — all 6 files confirmed present on disk at `apps/dashboard/src/assets/fonts/`. No CDN at runtime. |
| AC-Type-2 | If a font asset fails to load, text falls back to a legible system font; surface stays fully usable — never blank or error. | **PASS** | Tests `font-fail-degrades-legibly` (two cases in theme.spec.ts) PASSED: body stack contains `system-ui` and `sans-serif`; `MONO_FONT_FAMILY` ends with `monospace`. Source: `BODY_FONT_FAMILY = 'Inter, system-ui, Segoe UI, Roboto, sans-serif'`; `MONO_FONT_FAMILY = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace"`. `styles.css` uses `font-display: swap` ensuring graceful degradation on asset load failure. |
| AC-Theme-1 | Anonymous visitor sees redesigned dark theme by default; app renders without a theming error. | **PASS** | Test `dark-default-resolves` (theme.spec.ts) PASSED: `theme.palette.mode === 'dark'`; `background.default === '#0e1117'`; `background.paper === '#161b22'`; `themeForPref('dark').palette.mode === 'dark'`. Component test `dark-default-resolves` (flow spec) PASSED: Landing renders under `theme` without error. `app.spec.tsx` tests all render under the `theme` import and pass. |
| AC-Theme-2 | With light theme preference selected, app resolves to valid light palette; text and controls legible; nothing dark-on-dark; switching preference works as today. | **PASS** | Test `light-theme-resolves-legible` (theme.spec.ts) PASSED: `lightTheme.palette.mode === 'light'`; `background.default === '#f5f6f8'`; `themeForPref('light').palette.mode === 'light'`; `lightTheme.typography.monoFontFamily === MONO_FONT_FAMILY`. Component test `light-theme-resolves-legible` (flow spec) PASSED: Landing renders under `lightTheme`; H1 and `footer-disclaimer` present and queryable (no dark-on-dark blank/crash). Source: `lightTheme` uses `mode: 'light'`, `background.default: '#f5f6f8'`. |
| AC-Theme-3 | Under the new theme, a live tile in its dimmed/offline degraded state is still visually distinct from a normal tile and an "unavailable this cycle" tile. | **PASS** | Test `offline-dim-distinguishable` (theme.spec.ts) PASSED: `theme.palette.info.main !== theme.palette.warning.main`; DIM opacity `0.5 > 0 && < 1` (confirmed structurally — non-zero, sub-1 opacity keeps dimmed tiles visually present). Source: dark theme does not override `info.main` or `warning.main` from MUI defaults (cyan info ≠ amber warning). The `opacity: 0.5` dim treatment on live tiles during SSE drop is a runtime `sx` usage in the existing inherited surfaces — the new theme does not introduce colors that would collapse the dim. |
| AC-Inv-1 | Every `data-testid`, asserted text string, link role, and accessible current-page state on the Landing and nav that the existing suite queries is preserved verbatim; existing Vitest suite stays green with no removed/renamed testid and no changed asserted copy. | **PASS** | Suite: 359/359 PASSED (32 test files). `app.spec.tsx` — 21 tests PASSED. `redesign-foundation.flow.spec.tsx` — 28 tests PASSED. `durable/brand.spec.tsx` — 4 tests PASSED. All in-scope testids confirmed present in source: `app-shell`, `shell-brand`, `nav-ticker`, `nav-positions`, `nav-scanner`, `convexa-mark`, `account-loading`, `account-signin`, `account-menu-button`, `account-email`, `account-settings`, `account-logout`, `landing`, `hero-motif`, `cta-primary`, `vp-ticker`, `vp-positions`, `vp-airec`, `vp-ticker-cta`, `vp-positions-cta`, `vp-airec-cta`, `brokerage-block`, `waitlist-button`, `waitlist-ack`, `scanner-block`, `scanner-cta`, `footer-disclaimer`. No testid renamed or removed. |
| AC-Inv-2 | Shared theme preserves green=calls/red=puts (never inverted/recolored) and primary-blue/cyan-informational/violet-AI accent meanings. | **PASS** | Test `accent-and-callput-meanings-preserved` (theme.spec.ts) PASSED: `theme.palette.success.main === '#2ecc71'`; `theme.palette.error.main === '#ff5c5c'`; `theme.palette.primary.main === '#4f9cff'`. Violet (`#7b5cff`) appears only in `AccountControl.tsx` signed-in avatar gradient as an `sx` literal (not a theme key) — per ARCHITECTURE §1.4. |
| AC-Inv-3 | After the reskin, live-vs-static offline degrade (dimmed + offline caption, never blanked) and honesty surfaces (SIMULATED, non-navigating brokerage, coming-soon Scanner) remain intact and visually honest. | **PASS** | Satisfied by the union of: AC-H1 test (non-navigating brokerage) PASSED; AC-H2 test (coming-soon Scanner) PASSED; AC-H3 test (simulated footer) PASSED; AC-Theme-3 test (offline-dim distinguishable) PASSED. The dimming behavior of live tiles is inherited from the unchanged Ticker/Positions components; the new theme does not introduce colors that collapse the dim. |
| AC-Inv-4 | Score, tier, AI gate, and `state_fingerprint` byte-identical before and after; no theme/font/style is a scoring input; `apps/api` is untouched. | **PASS** | `git status --porcelain apps/api` → empty output. `git diff HEAD -- apps/api/` → empty output. `apps/api` is completely untouched byte-for-byte. Tests `landing-static-no-network` and `no-backend-change-scoring-untouched` PASSED: no non-auth `/api/*` fetch from Landing/nav. |
| AC-Inv-5 | No localStorage key or value changes; keys stay `convexa.*`; returning user's simulated positions, saved views, persona, and theme preference are preserved. | **PASS** | Test `durable-keys-unchanged` PASSED: captures `Object.keys(localStorage)` before/after Landing render; asserts arrays equal; asserts no `convexa.*` key introduced by the reskin. `Landing.tsx`, `TopNav.tsx`, and `AppShell.tsx` write no localStorage. |
| AC-Inv-6 | No nav/Landing link, button, or menu reaches `/_ops/metrics`; operator surface not reskinned and stays off-shell and unlinked. | **PASS** | Test `operator-separation-preserved` PASSED: renders shell at `/scanner` and Landing at `/`; asserts `getAllByRole('link').some(a => href.includes('_ops')) === false` for both. `app.spec.tsx` `operator path separation preserved` also PASSED. Source: `TopNav.tsx` NAV array contains exactly three entries (Ticker/Positions/Scanner), no operator entry. |
| AC-Inv-7 | Reskin introduces no second theme provider and no second router; the one app theme and one router work for deep-links, nav, and theming with no duplicate-provider error. | **PASS** | Test `single-theme-single-router` PASSED (320ms): deep-links `/ticker/AAPL`; navigates to `/positions`; both work under one harness-supplied ThemeProvider + Router. `app.spec.tsx` `single router + single theme provider` also PASSED. Source: `AppShell.tsx` and `Landing.tsx` render no ThemeProvider; the pre-existing `auth/ThemeProvider.tsx` is the sole provider (unchanged). |

---

## Test Count

**359 / 359 tests PASSED** across 32 test files.

In-scope feature test files:
- `src/app/landing/redesign-foundation.flow.spec.tsx` — 28 tests PASSED
- `src/app/theme.spec.ts` — 9 tests PASSED
- `src/app/app.spec.tsx` — 21 tests PASSED (regression floor for testids/copy/routing)
- `src/app/durable/brand.spec.tsx` — 4 tests PASSED (brand regression floor)

Note: the full suite of 359 tests includes tests for other features (`redesign-auth`, positions, ai-rec, etc.) all of which remain GREEN — no regression.

---

## AC ↔ Test Traceability

Every FRONTEND_EXECUTION_CONTRACT "Tests to write" required case is mapped to a named, passing test:

| Required test name | AC | Named test location | Result |
|---|---|---|---|
| `landing-hero-renders-redesigned` | AC-Land-1 | redesign-foundation.flow.spec.tsx | PASSED |
| `landing-value-cards-present` | AC-Land-2 | redesign-foundation.flow.spec.tsx | PASSED |
| `landing-coming-soon-band-present` | AC-Land-3 | redesign-foundation.flow.spec.tsx | PASSED |
| `landing-footer-disclaimer-present` | AC-Land-4 | redesign-foundation.flow.spec.tsx | PASSED |
| `landing-matches-export` | AC-Land-5 | redesign-foundation.flow.spec.tsx | PASSED |
| `landing-static-no-network` | AC-Land-6 | redesign-foundation.flow.spec.tsx | PASSED |
| `landing-primary-cta-enters-ticker` | AC-Land-7 | redesign-foundation.flow.spec.tsx | PASSED |
| `landing-value-cta-navigate-no-deadend` | AC-Land-8 | redesign-foundation.flow.spec.tsx | PASSED |
| `brokerage-coming-soon-non-navigating` | AC-H1 | redesign-foundation.flow.spec.tsx | PASSED |
| `scanner-block-coming-soon` | AC-H2 | redesign-foundation.flow.spec.tsx | PASSED |
| `simulated-labelling-preserved` | AC-H3 | redesign-foundation.flow.spec.tsx | PASSED |
| `nav-reskinned-persistent-wordmark` | AC-Nav-1 | redesign-foundation.flow.spec.tsx | PASSED |
| `nav-persists-across-pages` | AC-Nav-2 | redesign-foundation.flow.spec.tsx | PASSED |
| `nav-active-tab-indication` | AC-Nav-3 | redesign-foundation.flow.spec.tsx | PASSED |
| `wordmark-links-to-landing` | AC-Nav-4 | redesign-foundation.flow.spec.tsx | PASSED |
| `landing-renders-shared-nav (AC-Nav-5, amended)` | AC-Nav-5 | redesign-foundation.flow.spec.tsx | PASSED |
| `mono-numeric-handle-established` (×2 sub-cases) | AC-Type-1 | theme.spec.ts | PASSED |
| `font-fail-degrades-legibly` (×2 sub-cases) | AC-Type-2 | theme.spec.ts | PASSED |
| `dark-default-resolves` | AC-Theme-1 | theme.spec.ts + flow spec | PASSED |
| `light-theme-resolves-legible` | AC-Theme-2 | theme.spec.ts + flow spec | PASSED |
| `offline-dim-distinguishable` | AC-Theme-3 | theme.spec.ts | PASSED |
| `testids-and-copy-preserved` (app.spec.tsx + brand.spec.tsx green = the regression floor) | AC-Inv-1 | app.spec.tsx (21 tests) + brand.spec.tsx (4 tests) | PASSED |
| `accent-and-callput-meanings-preserved` | AC-Inv-2 | theme.spec.ts | PASSED |
| AC-Inv-3 — union of honesty + offline-dim tests | AC-Inv-3 | tests #9/#10/#11/#21 (H1/H2/H3/Theme-3) | PASSED |
| `no-backend-change-scoring-untouched` | AC-Inv-4 | redesign-foundation.flow.spec.tsx | PASSED |
| `durable-keys-unchanged` | AC-Inv-5 | redesign-foundation.flow.spec.tsx | PASSED |
| `operator-separation-preserved` | AC-Inv-6 | redesign-foundation.flow.spec.tsx | PASSED |
| `single-theme-single-router` | AC-Inv-7 | redesign-foundation.flow.spec.tsx | PASSED |

All 27 required test cases (plus their sub-cases) are named, present, and PASSING. No AC is uncovered.

---

## Interface Contract Conformance

**NO_BACKEND_CHANGE** — per `INTERFACE_CONTRACT.md`, this feature introduces no new endpoints, no changed fields, no new payload, and no `apps/api` edit. Confirmed: `git status --porcelain apps/api` → empty; `git diff HEAD -- apps/api/` → empty. The conformance surface is identical to pre-feature. No conformance tool run required; the git diff of `apps/api` is the authoritative evidence per the QA brief and the INTERFACE_CONTRACT's own machine-checkable statement (`"backend_change": false`).

---

## Invariant Watch (promoted canon from PROJECT_CONTEXT §5)

| Key | Status |
|---|---|
| `additive-keeps-score-byte-identical` | HOLDS — `apps/api` untouched (zero git diff); no theme/font/style is a scoring input; tests confirm no non-auth API fetch from Landing/nav. |
| `live-vs-static-isolation` | HOLDS — Landing is static (no fetch/SSE confirmed by test); SSE page-scoping unchanged; offline-dim treatment inherited by existing surfaces; `info.main !== warning.main` confirmed. |
| `no-real-order-path` | HOLDS — brokerage block is non-navigating outlined button (not primary/contained), waitlist acknowledges in place, no network call, no broker flow (test confirmed). |
| `operator-vs-trader-path-separation` | HOLDS — no `/_ops/metrics` link in Landing or nav (test confirmed); operator surface unreskinned; `app.spec.tsx` confirms ops route still off-shell. |
| `loss-free-durable-migration` | HOLDS — no localStorage keys written or changed by the reskin; `convexa.*` keyspace untouched (test `durable-keys-unchanged` confirmed). |
| `server-side-gate-enforcement` | N/A for this feature — no gated write action introduced. |
| `secret-encrypted-at-rest` | N/A for this feature — no stored secrets introduced. |
| `no-secrets-in-image` | N/A for this feature — purely visual/CSS/font changes; font files are woff2 binaries, not secrets. |

---

## Summary

**24 PASS / 0 FAIL / 0 UNVERIFIABLE**

---

## Overall Verdict: PASS

Every acceptance criterion holds. The test suite is 359/359 green. All 27 required test cases are named and passing. The `apps/api` backend is provably untouched (zero git diff). All promoted invariants hold. No bounce is required.

---

## Out-of-Scope Observations (informational only, not gate items)

### Parallel-session noise (redesign-auth)
The working tree contains modifications to `apps/dashboard/src/app/auth/AuthDialog.tsx`, `GoogleButton.tsx`, `auth.flow.spec.tsx`, and `copy.ts` (per git status — parallel `redesign-auth` session). Those files are NOT in-scope for `redesign-foundation`. The suite does not fail on them; all 359 tests pass cleanly. No impact on this verdict.

### AC-Nav-5 amendment (resolved, not a bounce)
The original AC-Nav-5 states "On `/`, the trader nav shell is NOT rendered." The owner preview gate found the Landing was missing its top nav (the canonical design puts it there). The FRONTEND_AMENDMENTS_REQUESTED.md fix — extracting `<TopNav/>` as a shared component consumed by both `AppShell` and `Landing` — was owner-approved 2026-06-29. The `<AppShell>` route component (the "trader nav shell") is definitively NOT rendered on `/` (test confirms `queryByTestId('app-shell') === null`). The presence of the shared `TopNav` on the Landing is the correct, owner-approved behavior. This is a resolved amendment, not an open issue.

### Pre-existing typecheck red
`nx typecheck` (tsc --build) is pre-existing RED on main (~502 errors, jest-dom/DOM-lib config gap). Documented in `_MANIFEST.md`; the QA brief explicitly excludes it as a gate. The authoritative Vitest signal (359/359) is the only test gate evaluated here.

### React act() warnings in test stderr
Multiple tests emit `An update to X inside a test was not wrapped in act(...)` advisory warnings. These are pre-existing React 18 / React Router v6 advisory warnings (not errors); they do not affect test pass/fail status and all 359 tests pass. Noted for completeness; not a gate issue.
