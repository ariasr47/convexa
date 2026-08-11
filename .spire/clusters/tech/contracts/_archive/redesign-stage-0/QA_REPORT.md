# redesign-stage-0 — QA_REPORT (GATE Q)

**Verifier:** fresh QA session (Sonnet 5), no build history. Branch `redesign-stage-0` (7 feature
commits over `main` @ `ca92c3c`, HEAD `a881a82`), checked out as-is. No code/contract edits made.

---

## 0. Battery (raw output)

| Command | Result |
|---|---|
| `npx nx test dashboard` | **57 files / 492 tests — all PASS** (matches FE claim). `Duration 19.28s`. Zero skipped. |
| `npx tsc -b apps/dashboard/tsconfig.app.json --force` | **Clean** — no output. |
| `npx nx run @org/dashboard:typecheck --skip-nx-cache` | **PASS.** |
| `npx nx lint dashboard --skip-nx-cache` | **0 errors, 28 warnings** — matches FE claim (all `@typescript-eslint/no-non-null-assertion` + 2 `react-hooks/exhaustive-deps`, all pre-existing files/pattern, none touch new Stage-0 code paths in a way that changes behavior). |
| `npx nx build dashboard --skip-nx-cache` | **Green** — `vite build` succeeds, 1 chunk-size warning (pre-existing, unrelated to Stage 0). |
| `npx nx e2e dashboard-e2e --spec="src/e2e/mobile-no-overflow.cy.ts"` (targeted re-run, independent) | **12/12 passing**, ~4s. Confirms the FE's named Cypress claim independently. |

## 1. Isolation proof (structural — additive-keeps-score-byte-identical)

| Check | Result |
|---|---|
| `git diff main -- apps/api` | **Empty.** (0 lines) |
| `git diff main -- libs/api` | **Empty.** (0 lines) |
| Runtime conformance (`interface_conformance.py`) | **n/a — correctly absent.** No `INTERFACE_CONTRACT.md` exists for this feature (`.spire/clusters/tech/contracts/redesign-stage-0/` has no such file — confirmed by listing); the contract header + `_MANIFEST.md` both declare `NO_BACKEND_CHANGE`/consumes-existing-endpoints-unchanged. Score/tier/`state_fingerprint` cannot move by construction (empty BE diff). |

**Verdict: PASS.** Both invariant riders hold.

---

## 2. The six §3 scope items

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Mobile: kill 393px overflow + real mobile nav | **PASS** | Cypress `mobile-no-overflow.cy.ts` 12/12 (independently re-run) — `/`, `/ticker/TSLA`, `/positions`, `/scanner`, `/settings` × dark+light, `scrollWidth ≤ innerWidth`; drawer carries all 4 entries incl. Blog. RENDER_PASS.md confirms real-browser scrollWidth 378 vs 393 (was 580), dark AND light, held through the degraded state. `TopNav.tsx` diff shows hamburger (`md`-gated), `Drawer` (right-anchor, unmounts links when closed), NAV const includes `Ticker/Positions/Scanner/Blog`. `Widget.tsx`/`TickerHeader.tsx`/`TickerToolbar.tsx`/`CustomizationToolbar.tsx`/`TickerDashboard.tsx`/`OrdersPanel.tsx`/`OrdersWidget.tsx` diffs show the wrap/track/sr-only fixes (see commit `a881a82`, which shows the enforcement row genuinely caught 3 real offenders on first run — non-vacuous). Positions cards-below-`md` confirmed via `PositionsView.tsx` diff (`useMediaQuery(down('md'))` forces `card` regardless of saved pref) + `positions-stage0.spec.tsx`. GEX chart dir untouched (`git diff --stat` for `gex-profile-chart/` empty). |
| 2 | Authored `:focus-visible` rings app-wide | **PASS** | `theme.ts` `MuiCssBaseline.styleOverrides` — ONE global rule (`*:focus-visible` + `.MuiButtonBase-root:focus-visible,.MuiButtonBase-root.Mui-focusVisible`), token-bound to `theme.palette.primary.main`, both modes. `Widget.tsx` frame gained its own `&:focus-visible` ring alongside the retained `outline:'none'` (mouse case). `focus-visible.spec.tsx` asserts the injected CSS text in both dark+light AND runs a mutation-tested source-scan (40+ files) proving no other component strips `outline:none` without an in-file `:focus-visible` replacement. RENDER_PASS confirms visually: "authored `solid 2px rgb(79,156,255)`… not UA default." |
| 3 | Semantic repair on `/ticker` | **PASS** | `StatTile.tsx` gained `component="p"` on the `variant="h6"` Typography (styling preserved, element changed). Swept beyond the named 29 sites: `DealerFlowProjection.tsx` (charm/vanna `h6`→`p`), `IvRank.tsx` (`h4`→`p`) — both data-value headings, correctly caught by the "sweep every other… data value" clause. `AppShell.tsx` wraps `<Outlet/>` in `Box component="main"` (covers all in-shell routes incl. `/ticker`, `/positions`). `Widget.tsx` title `variant="h6"` gained `component="h2"`. `ticker-semantics.spec.tsx` (real App mount via route table) asserts exactly one `h1`, widget titles are `h2`, no heading levels below h2, and NO heading text matches the data-value regex. RENDER_PASS independently measured: h1=1, h6=0 (was 29), `<main>` present. |
| 4 | Floors: touch ≥44px, chip/label type ≥11px | **PASS** | `TintChip.tsx` 9→11px; `TickerToolbar.tsx` Segment label 10.5→11; `AiRecPanel.tsx` (×3) and `StateExportDrawer.tsx` (×2) 10→11; SVG-chart-tick exemption list correctly excludes `gex-profile-chart/chart.tsx`, `term-structure/TermStructure.tsx`, `operator-metrics/LatencyTrend.tsx` (each still confirmed to carry a sub-floor size — the exemption-list-liveness test passes). `type-floor.spec.tsx` renders TintChip and asserts the emotion-injected CSS text (never `getAttribute('style')`), plus a mutation-tested, vacuity-guarded source-scan across `pages/`,`features/`,`shared/ui/` for px AND rem sub-floor sizes. Touch floor: theme-level `@media (pointer: coarse) { 'button, [role="button"], a': { minHeight:44, minWidth:44 } }` in `MuiCssBaseline` — applies globally (buttons, icon buttons, CTA links) without per-component edits; correctly does NOT affect inline prose links (CSS spec: min-height/width don't apply to `display:inline`). Asserted present in `focus-visible.spec.tsx`'s rendered-stylesheet check. Keyboard operability: `positions-stage0.spec.tsx` proves every click affordance in `PositionRow`/`PositionCard`/`PositionsView` (table Close, pending Cancel, order-backlink, empty-state CTAs, card Close) is a native `<button>`, Tab-reachable, Enter+Space-operable — resolves §10.4 in the rendered DOM as required. `autoFocus` ×2 in `CustomizationToolbar.tsx` kept with one-line justification comments at both sites (rename + save-view dialogs), matching the exact contract wording. |
| 5 | Copy fixes (§4 verbatim) | **PASS** | `copy.ts`: `subtitleSignedIn: 'Saved to your account.'` / `subtitleAnonymous: 'Stored in this browser.'`, `SettingsPage.tsx` picks by `auth.authenticated`. `operator-metrics.tsx:300`: `Rolling window: {data.window.size_desc} · uptime …` (hardcoded `last ` prefix dropped — `size_desc` already carries it). `Landing.tsx`: H1 → `See the dealer positioning behind the price.`; body → `Gamma walls, the flip, and live order flow for any ticker — plus an AI read on the setup and a simulated portfolio to practice it. Grounded in live [dealer gamma], not vibes.` — all three strings byte-match §4 verbatim, diffed directly against source. |
| 6 | `<meta name="theme-color">` follows mode | **PASS** | `theme-color.spec.tsx`: dark pref → `darkTheme.palette.background.default`; switch to light → `lightTheme.palette.background.default`; `system` pref resolving (via `matchMedia` stub) → light background — all read from the live theme object, no literal. RENDER_PASS independently measured both directions (`#f5f6f8` light / `#0e1117` dark, both = live `background.default`). |

**§3 summary: 6/6 PASS.**

---

## 3. §8 "Tests to write" matrix — traceability

| # | Kind | Case | Verdict | Named test / evidence |
|---|---|---|---|---|
| 1 | test: | 393px no-overflow, dark+light, 5 routes | **PASS** | `apps/dashboard-e2e/src/e2e/mobile-no-overflow.cy.ts` — 12/12, independently re-run by QA (not just trusted from the FE's claim). Interface-shaped stub bundle avoids a vacuous blank-page pass (`ready()` gate per route before measuring). |
| 2 | test: | Focus-visible presence + outline:none mutation guard | **PASS** | `shared/theme/focus-visible.spec.tsx` — rendered-stylesheet assertion (both modes) + `outlineViolations()` mutation guard proven to fail on a synthetic violator and pass on a synthetic in-file-replacement case; scans 40+ real files, zero violations; `Widget.tsx` accounted case explicitly asserted (`outline:none` + `&:focus-visible` + `outlineOffset` all present in source). |
| 3 | test: | Heading-semantics guard on `/ticker` | **PASS** | `pages/ticker/ticker-semantics.spec.tsx` — real `App` mount via route table, network-mocked; asserts exactly one `h1` matching `TSLA · $`, widget titles are `h2` (`live tape`, `dealer positioning`), heading-level set is exactly `{h1,h2}`, and zero headings match the data-value regex (`/^[+−$-]?[\d,.]+/` or `%`/`$` figure). Second `it` also confirms the StatTile fix's positive case (the Call-wall `$` figure lives in a `<p>`, `h6` is null in that tile). |
| 4 | test: | Chip/type floor (TintChip 11px + source-scan) | **PASS** | `pages/ticker/widgets/_kit/type-floor.spec.tsx` — renders `TintChip`, asserts the emotion class's injected CSS declares `font-size:11px` (never `getAttribute('style')`); mutation-tested + vacuity-guarded scan across `pages/features/shared-ui` for sub-11px px/rem `fontSize`, exemption list (3 SVG-chart-tick files) proven both present and still sub-floor (live, not stale). |
| 5 | test: | theme-color follows mode | **PASS** | `features/auth/theme-color.spec.tsx` — 3 cases (dark, switch-to-light, system-resolves-to-light), all comparing `meta.content` to the live theme object's `palette.background.default`. |
| 6 | test: | Keyboard operability of position row/card actions | **PASS** | `features/trading/positions/positions-stage0.spec.tsx` §1 — table Close (Tab+Enter+Space), pending Cancel + order-backlink (Enter), empty-state CTAs ×2 (Enter, Space), card Close (Enter). All assert `tagName === 'BUTTON'` — the negative-space guard (a clickable div/span would fail these assertions). Resolves §10.4 in the rendered DOM as the contract required. |
| 7 | test: | Degraded-state suite stays green + PositionCard added case | **PASS** | Full suite green (492/492) with **zero diff** on `pages/ticker/ticker.risk.spec.tsx` and `pages/positions/positions-page.spec.tsx` (confirmed via `git diff main...redesign-stage-0` — empty for both), i.e. no deletions/weakenings. Added case confirmed in `positions-stage0.spec.tsx` §2: card projection preserves `pending-affordance`, `Closed · realized…` text, and `card-pl`/`card-mark` testids across online/offline with className-identity dim assertions (never blanked). |
| 8 | test: | Nav drawer safety (exactly 4 entries, no `/_ops`, `aria-current`) | **PASS** | `app.risk.spec.tsx` "mobile nav drawer" describe block (added in this feature's diff, +51 lines to the pre-existing file) — drawer carries exactly `{ticker,positions,scanner,blog}`, 4 links total (no operator link), `aria-current="page"` on the active entry only, navigate-and-close proven. Folds into the pre-existing `expectNoOpsLink()` invariant helper reused from the route-table walk. |
| 9 | test: | Hex-discipline + reduced-motion suites stay green | **PASS** | `shared/theme/hex-discipline.spec.ts` — **zero diff** vs `main` (confirmed), included in the green 492/492 run. `useReducedMotion` consumption specs (2 files) likewise untouched and green. Zero new hex literals anywhere in the FE diff (`git diff main...redesign-stage-0 -- apps/dashboard \| grep -E '#[0-9a-fA-F]{3,8}'` on added lines → empty). |
| 10 | review: | Copy strings §4 | **PASS (review)** | Verified directly against source (§3 item 5 above). No copy-string unit test needed/expected — `pages/landing/landing.spec.tsx` explicitly documents H1/body text as **out of scope for automated assertion** ("H1, disclaimer wording… NOT asserted here" — pre-existing risk-based migration decision), and no settings-subtitle test exists to "update" (none pre-existed). The contract's "update the exact-string specs" clause has nothing to update against — correctly a review-only case. |
| 11 | review: | Hamburger presence + drawer behavior below `md` | **PASS (review)** | RENDER_PASS.md: "hamburger present, drawer = exactly {Ticker, Positions, Scanner, Blog}, no /_ops, Escape closes" (real browser, `s0-drawer-393-light.jpeg`). Corroborated by Cypress case #12 (`below md the nav collapses…`) and `app.risk.spec.tsx`'s drawer describe block. |
| 12 | review: | Touch-target spot-check ≥44px at 393 (coarse-pointer) | **PASS (mechanism verified; no independent pixel spot-check by QA)** | The global rule (`theme.ts` `@media (pointer:coarse){'button,[role="button"],a':{minHeight:44,minWidth:44}}`) is source-confirmed and its presence is asserted in `focus-visible.spec.tsx`'s rendered-stylesheet check. QA has no browser/DevTools tool to independently bounding-box-measure; RENDER_PASS.md does not explicitly walk this item either (not in its 8-row table). **Flagged as the one item resting on mechanism + injected-CSS evidence rather than a live pixel measurement** — see "Unverifiable" note below; not treated as a FAIL because the CSS mechanism is structurally sound (native buttons/links/role=button all covered; MUI ButtonBase-based CTAs — nav links, AccountControl, row actions, widget toolbar icons — are all `<a>`/`button`/`[role=button]` by construction, confirmed via the `positions-stage0.spec.tsx` native-button proof for row actions). |
| 13 | review: | Sticky bar + stacked hero at 393 walk (skeleton→live→offline) | **PASS (review, partial live evidence)** | RENDER_PASS.md covers the offline leg with a REAL backend-kill: "⚠ Live offline — reconnecting…" chip, live tiles → "⏸ offline", static GEX chart + 19 stat values persist un-blanked, no layout shift, at 393 dark (`s0-393-dark-offline-degrade.jpeg`). RENDER_PASS explicitly records the cold-skeleton leg of this same walk as an **accepted residual, "verified by component tests only"** — not silently skipped, honestly flagged. Component-level cold-skeleton testids (`cold-skeleton`, `last-trade-skeleton`) are unchanged (no diff) and covered by the pre-existing, still-green skeleton specs. |
| 14 | review: | `<main>` landmark + heading outline on `/ticker`, `/positions` | **PASS** | RENDER_PASS: `<main>` landmark present (one-shot DOM check). `AppShell.tsx` diff confirms `Box component="main"` wraps `<Outlet/>` for every in-shell route including `/positions` (Orders widget h1→h2 fix rides the same `Widget.tsx component="h2"` change — contract §3.3 note). `ticker-semantics.spec.tsx` independently proves the heading outline on `/ticker`. |
| 15 | review: | `autoFocus` justification comments | **PASS** | `CustomizationToolbar.tsx` diff — both sites (rename dialog, save-view dialog) carry the one-line justification comment verbatim-consistent with the contract's WCAG "sparingly" carve-out language. |

**§8 summary: 15/15 verified — 9 `test:` PASS with named, non-vacuous, mutation-guarded specs; 6 `review:` PASS (5 by direct evidence, 1 — item 12 — by mechanism + injected-CSS evidence without an independent live pixel measurement, honestly flagged, not a FAIL).**

---

## 4. The two named FE flags

| Flag | Judgment |
|---|---|
| (a) Cypress substituted for Playwright at §8.1 | **Enforcement intent met.** The repo's e2e runner is genuinely Cypress project-wide (`cypress.config.ts` header: "replaces the prior Playwright setup"; `dashboard-e2e` has zero `.spec.ts` Playwright files, only `.cy.ts`). The substitution is documented in-file with a clear comment. The test itself delivers the exact contract-specified assertion (`scrollWidth <= innerWidth`, both schemes, 5 routes) plus the mobile-nav presence check — nothing was weakened by the tool swap, and QA independently re-ran it (12/12). No bounce warranted. |
| (b) ≥44px touch floor is `pointer: coarse`-gated | **Confirmed.** `theme.ts` line 43: `'@media (pointer: coarse)': { 'button, [role="button"], a': { minHeight: 44, minWidth: 44 } }`. The rule's presence (media query text + min-height/min-width values) is asserted in `focus-visible.spec.tsx`'s rendered-stylesheet check (`expect(css).toContain('@media(pointer:coarse)')`, etc. — both dark and light theme instantiations). Desktop/fine-pointer density is correctly unaffected. |

---

## 5. Known context (per the task brief)

- **2 timing-based positions/settings specs "known cold-run flaky"**: not observed flaky on this QA run — `nx test dashboard` was green 492/492 on the first, only run (no retries needed). Tiebreaker satisfied by a clean run; no further action.
- **28 lint warnings, pre-existing class**: confirmed — all are `@typescript-eslint/no-non-null-assertion` (26) + `react-hooks/exhaustive-deps` (2), scattered across both touched and untouched files, none introduce a new lint category, 0 errors. Matches the FE's claim exactly (count and shape).

---

## 6. §10 open questions — rulings honored

| # | Ruling | Honored? |
|---|---|---|
| 1 | SVG chart tick text at 10px stays exempt from the ≥11px floor | **YES** — `type-floor.spec.tsx`'s exemption list names exactly the 3 files (`chart.tsx`, `TermStructure.tsx`, `LatencyTrend.tsx`); none were touched in the diff; the exemption-liveness sub-test proves each still carries a sub-floor size (not stale). |
| 2 | `<main>` lands at `AppShell` level, not on `Landing.tsx` (Landing deferred to Stage 2) | **YES** — `AppShell.tsx` diff shows the wrap; `Landing.tsx` diff (8 lines, copy-only) has no `component="main"` addition. |
| 3 | 393px route set excludes `/_ops/metrics` | **YES** — `mobile-no-overflow.cy.ts`'s `ROUTES` array is exactly `/`, `/ticker/TSLA`, `/positions`, `/scanner`, `/settings`; no operator route. |
| 4 | Clickable-Box/div discrepancy resolved in the rendered DOM (source said native buttons already) | **YES** — `positions-stage0.spec.tsx` proves every flagged click affordance is a real `<button>` (`tagName === 'BUTTON'`) in the rendered output; no non-native target found or needed converting; matches the contract's expected "false positive" resolution. |
| 5 | Rebase risk — report conflict shape before hand-resolving an invariant surface, don't improvise a nav design | **YES, moot in a good way** — the branch history (`b4ad26f` shell, `9b9eb80` positions) shows the rebase landed cleanly onto an already-restructured `main` (folder-per-kind refactor, `features/trading/positions/`), reusing the EXISTING `PositionCard.tsx`/`TopNav.tsx` shape rather than reintroducing a parked, stale one; no invariant-surface conflict was hand-resolved silently — the diffs are additive breakpoint/wrap changes only, consistent with a mechanical rebase. |

**§10: 5/5 rulings honored.**

---

## 7. Discrepancy noted (not a FAIL)

The `FRONTEND_EXECUTION_CONTRACT.md` (§8 intro, §9.3) and `CONTEXT_PACK.md` cite a stale **"804/804"** pre-existing suite baseline. The actual pre-feature baseline (confirmed via `_MANIFEST.md`'s own note — "the test baseline changed under it — 467/52" — and independently via `git ls-tree main` showing 52 spec files vs. 57 on the branch) was **467 tests / 52 files**, not 804. Post-feature: **492 tests / 57 files** (+25 tests, +5 new files — exactly the 5 new §8 spec files: `focus-visible`, `ticker-semantics`, `type-floor`, `theme-color`, `positions-stage0`). This is a **documentation error inherited into the contract's boilerplate** (804 appears to be copied from an unrelated, later-superseded feature's final count — `OPEN_THREADS.md` §7t shows 804 was the `outcome-ledger` feature's 2026-07-16 total). It does not indicate any test loss or weakening by this feature: the diff-based audit above (§3.7 of this report) confirms zero deletions to degraded-state/motion/hex-discipline specs, only additions. **Not a GATE Q FAIL** — the binding invariant ("zero skipped/deleted degraded-state or motion guards") is independently verified true regardless of the wrong headline number.

---

## 8. Summary

- **§3 scope items:** 6 PASS / 0 FAIL / 0 UNVERIFIABLE
- **§8 test/review matrix:** 15 PASS / 0 FAIL / 0 UNVERIFIABLE (1 item — #12 touch-target spot-check — verified by mechanism + injected-CSS evidence rather than an independent live pixel measurement; not downgraded to UNVERIFIABLE because the structural evidence is conclusive and consistent with the render pass's own scope)
- **Process battery:** all 5 commands PASS (test, tsc -b, typecheck, lint, build) + independent Cypress re-run PASS
- **Isolation proof:** PASS (both diffs empty; conformance correctly n/a)
- **§10 rulings:** 5/5 honored
- **Invariants:** `[theme-token-discipline]` PASS (zero new hex, hex-discipline.spec.ts unchanged+green) · `[additive-keeps-score-byte-identical]` PASS (empty apps/api diff) · `[live-vs-static-isolation]` PASS (degraded-state suite unchanged+green, card-projection parity added) · `[no-real-order-path]` PASS (hero copy verified) · `[single-shared-sim-entry-dialog]` PASS (TradeEntryDialog/AuthDialog diffs are breakpoint-props only) · vertical-GEX-chart lock PASS (zero diff in `gex-profile-chart/`) · `[loss-free-durable-migration]` PASS (not exercised; zero schema/key diff)

## OVERALL GATE Q VERDICT: **PASS**

No amendments to bounce.
