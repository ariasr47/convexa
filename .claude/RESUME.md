# RESUME — session handoff (2026-07-13) — OWNER dev/refactor session (NOT a pipeline build)

> For a fresh session (normal chat OR `/conductor`). Overlay on canon — WINS on current status.
> This session was **ad-hoc owner-driven dev + refactor** (owner is learning the codebase), not a
> conductor feature pipeline. Everything is committed to `main` and **pushed** (`origin/main` @ `301ab83`,
> in sync, working tree clean).

## ⏭ IMMEDIATE NEXT — owner-directed, feature-by-feature
The owner will name what to do next. The main go-forward thread is **migrating the test suite to the
risk-based rule, ONE FEATURE AT A TIME** (only the Landing spec is done). **Do NOT mass-migrate specs or
touch other features' tests unprompted** — wait for the owner to name the feature.

## Shipped this session (all on `main`, pushed)
- **Prettier enterprise config** + repo-wide format (earlier commits, pushed).
- **Theme system** (`caeeaba`): elevation ladder (`tokens.ts` `elevation`/`elevationFor` — `e1/e2/e4`,
  mode-aware), snackbar→overlay theming (`MuiSnackbarContent` = `panelRaised` + `e4`), full
  token-discipline sweep (every landing/auth color literal → `alpha(theme.palette…)` / the new
  single-sourced `brandGradient`), footer copyright, `docs/THEME_AUDIT.md` (theme coverage audit +
  changelog; the 10 palette/theme gaps — `secondary` unset, derived `contrastText`, light `text.primary`,
  dark `shadows`, etc. — are documented but mostly OPEN).
- **Phase 1 SEO** (`5a56c80`, `9a42d61`): `index.html` meta + OG + Twitter cards, `public/robots.txt`,
  `public/sitemap.xml`, `public/og-image.png` (1200×630 on-brand PLACEHOLDER — owner to refine).
- **Owner folder refactor** (`6a84a65`): `gex-profile-chart` + `operator-metrics` → their own folders.
- **Spec typecheck repair** (`8637435`): `tsconfig.spec.json` was missing the DOM lib + jest-dom types +
  the setup file → **1119 phantom IDE errors → 0**; fixes the broken `@org/dashboard:typecheck` backlog
  item. (Tests were always green — Vitest doesn't typecheck.)
- **QA rule → RISK-BASED** (`d6d2207`): `.claude/agents/qa-verify.md` §4 (authoritative) + an
  `ORCHESTRATOR.md` pointer.
- **Landing test rewrite** (`301ab83`): **15 → 4** invariant tests.

## Established decisions / philosophy — IMPORTANT
- **Risk-based testing (owner directive, codified in `qa-verify.md` §4):** automate a test ONLY when a
  silent regression is *plausible AND invisible to review* — invariants, negative-space guarantees
  (`no-real-order-path`, zero-network, byte-identity), silently-regressing motion/visual/stateful
  behavior. **Copy / element-presence / cosmetic layout → verified by review/QA, NOT a brittle automated
  assertion.** Choose the test LAYER by risk. **Not** "one named test per AC."
- **Testing layers in this repo:** `@org/dashboard` = Vitest + RTL in **jsdom** (co-located
  `src/**/*.spec.tsx`; unit + component + integration/`*.flow.spec.tsx`; **674 tests**, network mocked).
  `dashboard-e2e` = **Playwright, real browser** — currently ONE trivial smoke (`app-loads.spec.ts`);
  real e2e flows deferred.
- **Test baseline is now 674** (was 685; −11 from the Landing trim).

## Open threads / next candidates (owner will direct)
1. **Test migration, feature-by-feature** (main thread) — apply the risk-based trim to other specs, one
   feature at a time, only when the owner names it.
2. **Phase 2 SEO prerendering** — CHECKPOINTED. Plan + findings in
   `~/.claude/plans/we-are-concerned-with-shiny-pnueli.md`: needs a router restructure to `RouteRecord[]`
   (touches the 674-test entry) + a **hand-written Emotion SSR collector** (`vite-react-ssg` only ships a
   styled-components one). Fork UNDECIDED: `vite-react-ssg` vs a custom Vite SSR prerender script. Do it
   on a **branch**. Also a `ThemeProvider` theme-hydration fix.
3. **Toast → app-root `ToastProvider`** (owner idea, reuse across pages) — belongs at the **app root**
   (`app.tsx` providers), NOT `AppShell`; separate feature. The Landing tests are behavior-based so they
   survive the move.
4. **Cypress e2e** — owner prefers Cypress. Component/integration STAYS Vitest. If a real-browser e2e
   layer is wanted, set up Cypress e2e (replace the minimal Playwright) as its own task.
5. **Delivery-kit sync (ACTION NEEDED)** — the risk-based rule is in the repo `.claude/` ONLY. The
   external kit `C:/Dev/delivery-kit` is **outside the write-fence** (`path_guard.js`), so it could NOT be
   updated automatically. Owner must mirror `qa-verify.md` §4 + the `ORCHESTRATOR.md` pointer into the kit
   (manually, or via the kit's extract script).
6. Theme audit gaps (`docs/THEME_AUDIT.md`) — `palette.secondary` unset (MUI purple leaks), explicit
   `contrastText`, light `text.primary`, dark `shadows` — small high-value fixes when scheduled.
7. Backlog: `market-backdrop` (blocked-on a Massive plan upgrade), volume-profile/CVD, `scanner` (BRIEF
   exists).

## Gotchas (carried)
- App typecheck: `npx tsc -b apps/dashboard/tsconfig.app.json --force`. Spec typecheck:
  `npx tsc -p apps/dashboard/tsconfig.spec.json --noEmit` (now **0**). Always `npx nx test dashboard`
  (never bare vitest).
- **Write-fence** (`path_guard.js`) blocks writes outside `C:/Dev/gammaflow-web` — the scratchpad AND
  `C:/Dev/delivery-kit` are OUT of bounds.
- CI/CD not wired: push ≠ deploy (owner deploys `convexa.pages.dev` via the runbook).
- Owner git pattern: commit to `main` + push after gates pass; no feature branches (EXCEPT Phase 2 SEO,
  which should be a branch).
- Cold-run suite flakiness: 2 timing-based positions/settings specs occasionally fail on a cold run; a
  clean `--skip-nx-cache` run is 674/674.
- Browser-pane screenshots were flaky against the live dev server this session.
