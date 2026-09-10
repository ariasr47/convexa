# Surfaces fidelity repair — report (2026-09-08)

Direct repair lane on `SURFACES_FIDELITY_REPAIR_TASK.md`, off the council pipeline, per the owner's
"proceed with the surfaces lane." Scope: `/positions`, `/alerts`, `/settings`, `/scanner` (F5–F8 in
`fidelity-audit-2026-09-08/FIDELITY_AUDIT.md`). `NO_BACKEND_CHANGE`: `apps/api` diff stays empty
throughout (measured, see Gates below). One build lane, no resume needed.

## Commits (chronological)

| commit     | change                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------- |
| `debbd55f` | **1 — Positions** (F5): mast, control row, track record                                       |
| `75ffd1f2` | **2 — Alerts** (F6): two-column layout, score presets, rules filter                           |
| `209ad8da` | **3 — Settings** (F7): content column width, Preferences/Risk-inputs composition              |
| `7746422e` | **4 — Scanner** (F8): header, controls, score bar, tier palette, note cards                   |
| `c2e194ea` | fixup on 4: score-bar track token (full-suite `nx test` caught a live-consumer guard)         |
| `fd60c4ed` | fixup on 3: AI-providers grid → real tabs (harness measurement showed the grid fell short)    |
| `d81900ab` | fixup on 1: un-nest `tr-breakdown` from the new disclosure (the e2e gate caught a regression) |

All local, none pushed. 19 files touched (18 `apps/dashboard` source/spec files + this report);
`apps/api` untouched.

---

## Change 1 — Positions (F5)

**Design anchor:** `design/src/screens/positions.mjs:56-92` — the mast (title/subtitle left, two
figure cells + CTA right, `:60-67`), one control row (`:68-75`), the table (`:78`), four quiet
track-record cards on `repeat(4, minmax(0,1fr))` (`:87-90`).

**Files:** `pages/positions/PositionsPage.tsx`, `pages/positions/capitalAtRisk.ts` (+ `.spec.ts`,
new), `features/trading/positions/PortfolioPanel.tsx`, `features/trading/positions/
CustomizationToolbar.tsx`, `features/trading/outcomes/TrackRecordSection.tsx`,
`features/trading/outcomes/ArchiveBlock.tsx`.

**What changed:**

- **Mast:** a new **Capital at risk** figure cell (`capitalAtRisk.ts`, TDD red-first, 7 tests) joins
  the existing **Net P/L (open)** cell, both through the same `FigureCell`/`PanelContainer`
  composition. Capital at risk is the open book's max-loss sum (`maxLossOf`'s own closed eligible
  set) — `—` for an empty book, `unavailable` + a coverage caption when no open row has a computed
  max-loss figure, the sum + a coverage caption otherwise. Unlike Net P/L it is **static**
  (`maxLoss.ts`: "never live-derived"), so there is no offline arm.
- **Simulated/Broker tabs** (`PortfolioPanel.tsx`) restyle from underline to the design's
  segmented-pill look — same testids/handlers, sx only.
- **Control row** (`CustomizationToolbar.tsx`): the controls row and the status-pill row merge into
  one wrapping flex row; the four status pills gain live counts (`open · N`, etc.) and `History`
  gains a count; `flexWrap` is unconditional `wrap` (previously `lg: 'nowrap'`) since the row now
  carries more groups.
- **Track record** (`TrackRecordSection.tsx`): the five families always render (dropped the
  `body !== 'empty' && 'unreadable'` guard) as a responsive card grid instead of a vertical stack —
  `FamilyView`/`CellView` content and every testid/string are byte-identical. The honesty copy and
  definitions move behind a new `▸ How this is counted` disclosure, per the task's own instruction
  that this content "stays reachable — behind a disclosure … never deleted." `ArchiveBlock.tsx`
  collapses three stacked lines into one row.
- **Fixup (`d81900ab`):** the e2e gate caught that nesting the shipped `tr-breakdown`
  ("What wasn't counted — and why") disclosure inside the new one collapsed its `<summary>` to zero
  size while the outer `<details>` was closed (three `no-overflow.spec.ts` GATE Z criterion-66
  failures — real in a browser, invisible to jsdom unit tests). `tr-breakdown` moved back to a
  top-level sibling, exactly where it shipped; `tr-coverage` stays inside the new disclosure per the
  task's explicit instruction. This closed the regression, at the cost of the height gain described
  in the table below (+33px at 1280/1440 for the now-always-visible breakdown summary line).

**Assertion edits:** `debbd55f` — none. `d81900ab` — none (the fix is a structural JSX move; all 667
positions/outcomes specs pass unchanged, including the AC-17 non-containment check).

**Residual, not fixed:** `OrdersPanel` ("Simulated orders," 158 px) stays mounted above the table on
the Simulated tab, unlike the design (no separate orders card). `orders.risk.spec.tsx`'s two tests
call `renderAt('/positions')` and immediately `findByTestId('orders-panel')` with **no prior
interaction** — it must be visible by default, so hiding it behind a filter (my first read of
"Pending absorbs the Simulated-orders panel") was not viable. It is the single largest contributor
to the remaining height gap (see table).

---

## Change 2 — Alerts (F6)

**Design anchor:** `design/src/screens/alerts.mjs:6-49` — `minmax(0,5fr) minmax(0,7fr)` (`:6`), the
composer (`:18-28`), Rules (`:29-38`), Fired (`:39-45`).

**Files:** `pages/alerts/AlertsPage.tsx`.

**What changed:** a CSS grid at the `laptop` breakpoint (1100 px, `theme.ts:93` — the same custom
breakpoint `CommandDeck.tsx` already uses) splits the page into the New-rule composer (5fr, so its
share of the grid stays under 45% of the page width by construction) and Rules + Fired stacked
(7fr); one column below 1100px, unchanged. Page `maxWidth` widens 720 → 1160. Score-gate presets
(50/70/85, filling the same `scoreMin` field) and a Rules filter (All/Armed/Paused, a read-side
derivation over `a.rules`, default `all`) are new, additive controls. The Kind select, the Level
select and the notify button are **unchanged** (same element, role, text) — the design shows a
segmented Kind control and an "Allow notifications" label, but `no-overflow.spec.ts:1444` pins
`getByRole('combobox', { name: 'Kind' })` and `alerts.risk.spec.tsx` pins the notify button's exact
text in three states; converting either needs assertion edits no criterion requires, so this stayed
compositional-only.

**Assertion edits:** none.

**Residuals, not built:** the "universe member" chip beside Symbol (would add a new network read to
a page that today makes none); the Fired row's "desk open" live chip and its chevron-to-ticker link
(the live chip risks criterion 49, "no live mark anywhere on this page," if built carelessly).

---

## Change 3 — Settings (F7)

**Design anchor:** `design/src/screens/settings.mjs:5,27-64` — the 760 px content column (`:5`, rail
deferred by owner ruling D-B), Preferences (`:36`), Risk inputs (`:43-50`), AI providers (`:52-64`).

**Files:** `features/auth/SettingsPage.tsx`, `features/auth/RiskInputsSection.tsx`,
`features/auth/AiKeySection.tsx`, `features/auth/aiProviders.flow.spec.tsx`.

**What changed:**

- **`SettingsPage.tsx`:** `Container maxWidth` widens 640 → 760 (design `:5`; the section rail at
  `:28` stays deferred per D-B, not built). Preferences: Active persona + Default ticker run side by
  side at `tablet` (768 px, `theme.ts:91`, the design's own breakpoint). Theme keeps its three-way
  segmented control, additively gains a stroke icon per option.
- **`RiskInputsSection.tsx`:** Account size + the capped field run side by side at `tablet` (design
  `:45-48`); the cap-unit toggle relabels `$`/`%` to `% of account`/`$ per trade` (no test pins the
  bare glyphs); the effective-cap readout moves into its own full-width `cap-row` frame below both
  fields (design `:49`) — same testid, same server-verbatim copy.
- **`AiKeySection.tsx`, two passes:**
  1. First pass: the four BYO provider cards moved from one stacked column to a 2-column grid.
  2. **Fixup (`fd60c4ed`):** the harness's own region census measured `settings-ai-key-panel` at
     **837 px** against the task's 420 px target after the grid — a 2-column grid of four full
     provider forms could not get anywhere near that number. Converted to **provider tabs**
     (Anthropic/OpenAI/Grok/Gemini, `settings-ai-key-tab-{provider}`) with `ProviderRow` rendering
     once for `selectedProvider` (default `anthropic`, the design's own first tab) — this is what
     the design actually draws. Deliberately plain buttons with `aria-pressed`, not
     `role="tab"`/`"tablist"`: a real ARIA tab pattern wants `aria-controls` + a `role="tabpanel"`
     on the other end, and `/settings` is one of the axe-scanned routes
     (`accessibility.spec.ts` A11Y-4) — an incomplete tablist is a worse a11y story than an honest
     button group. The Grok subscription card is unchanged, above the tabs — it is a genuinely
     different flow (OAuth subscription vs. a BYO key) the design's mock conflates but this build
     does not.

**Assertion edits:** `fd60c4ed` only, in `aiProviders.flow.spec.tsx` (the flow-integration
centerpiece this repair initially avoided touching — edited once the measured gap showed the grid
compromise was insufficient): the "add / replace / remove isolate per provider" test now clicks
each provider's tab before typing into its fields (previously all four providers' forms were
simultaneously in the DOM); its post-replace "Anthropic is untouched" check now reads backend state
for the other three slots and switches to the Anthropic tab before reading its masked-key DOM text;
the "Use this key" test clicks the OpenAI tab before its `settings-ai-key-use-openai` button. No
other assertion in that file changed; all 9 of its tests plus the other 83 auth-surface tests pass.

**Residual, not built:** `BrokerageSection.tsx` is untouched. The design's "Connect reveals the two
inputs" progressive disclosure would hide `settings-brokerage-app-key`/`-app-secret` behind a new
reveal click, breaking `brokerageSection.spec.tsx`'s connect-flow tests, which type into those
fields immediately after mount. Not F7's stated complaint (Brokerage isn't named in the audit's
"far" finding).

---

## Change 4 — Scanner (F8)

**Design anchor:** `design/src/screens/scanner.mjs:60-111` — header (`:65-72`), `.scan-tools`
(`:73-81`), the table (`:84-98`, score bar `:35`, tier chip `:25`), the note cards (`:106-110`).

**Files:** `pages/scanner/Scanner.tsx`, `pages/scanner/ScanToolbar.tsx`,
`pages/scanner/ScanTable.tsx`, `pages/scanner/ScanCells.tsx`, `pages/scanner/labels.ts`,
`pages/scanner/scanner.register.spec.tsx`, `pages/scanner/scanner.risk.spec.tsx`.

**What changed:**

- **`Scanner.tsx`:** the header right cluster (session chip + the cadence line + Structure as-of)
  moves up beside the title, out of the toolbar row. Three note cards render below the table/card
  body (in the same condition that renders it). New copy is deliberately **not** added to
  `SCAN_COPY` — it would trip the CF-1 frozen-copy scan (`scanner.register.spec.tsx`'s
  `cf1Offenders`, "new string-valued key with no frozen entry") — it lives in a separate local
  constant. `ScanTable.tsx`'s `maxHeight: '70vh'`/`overflowY: 'auto'` internal scroller is gone: the
  page scrolls with the design now; `overflowX: 'auto'` (criterion 21's own requirement) stays.
- **`ScanToolbar.tsx`:** session/structureAsOf props removed (relocated); the view-label row and the
  filter-chip row merge into one wrapping row with a new "N names" count.
- **`labels.ts`:** the thirteen filter presets prune to the design's seven (Prime/Actionable/Watch,
  IV cheap/IV rich, Score ≥70, |Flip| ≤1%) — a preset-list change only (`ScanFilters.tier`/
  `minScore` stay bare `string | null`/`number | null`, so the dropped values remain valid filter
  state, just without a button). Not part of `SCAN_COPY`. The `updated` column's display label
  renames "Updated" → "As-of" (its key/testids/`updatedText()` copy unchanged); STATUS stays its own
  column.
- **`ScanCells.tsx`:** `ScoreCell` gains a bar on every row with a real numeric score — **neutral**
  fill (`text.secondary`), never the design's conditional-amber, because `stage3-amber.spec.ts`'s
  own invariant is "the scan surface's ONE amber spend is the per-row tier chip." `TierCell`
  reserves that one amber spend for `Prime` specifically; every other resolved tier renders the same
  chip shape in the neutral tone.
- **Fixup (`c2e194ea`):** the full-suite `nx test` (not the scoped scanner run) caught that the bar's
  track bound to `extrasFor(t).panelRaised2`, and `steel2-contrast.spec.ts`'s own LIVENESS GUARD
  asserts that token has zero real consumers app-wide. Moved to `action.disabledBackground`.

**Assertion edits (`7746422e`):** `scanner.register.spec.tsx`'s "filter matches nothing" test
clicked the now-pruned `scan-filter-tier-dormant`; swapped to `scan-filter-tier-actionable` (an
equally guaranteed zero-match value against that test's own two-row fixture, and a preset that
stays rendered). `scanner.risk.spec.tsx`'s two direct `<ScanToolbar>` mounts drop the
`session`/`structureAsOf` props the interface no longer accepts.

**Residuals, not built (task explicitly permits omitting the second):** STATUS folding into the
per-row age/stale chip; the hover preview card — canon 20 requires a tap + keyboard path for any
hover-revealed control, and the task says omit rather than ship hover-only.

---

## Before → after, measured

**Methodology note (a harness lesson worth recording next to the ones already in
`FIDELITY_AUDIT.md`'s footer):** the harness's `settle()` grows the viewport to 1800 px and
re-measures whenever a page "fits" inside 900 px — written for the scanner's now-removed internal
scroller. For a page whose real content is genuinely **short**, `document.documentElement.
scrollHeight` at that point reads back the (artificially tall) **viewport** height, not the content
height, because the app shell fills available height with background. Alerts and Scanner both hit
this branch. The table below reports **both** numbers: `pageHeight` (the harness's raw field, for
apples-to-apples continuity with the audit's own before-numbers) and the **real content bottom**
(`max(region.y + region.h)` from the same JSON's `regions` array — confirmed against the actual PNG
screenshots), which is what the thresholds below are actually checked against. Before-numbers are
the audit's own (`pageHeight`, its only field).

**Positions** (before 1,889 / 1,120 at 1280, 1.69×) — threshold: page ≤ design × 1.20 at 1280/1440,
× 1.25 at 390; track-record block ≤ 320 px.

| width | app real | design real | ratio     | vs threshold   |
| ----- | -------- | ----------- | --------- | -------------- |
| 1440  | 1,446    | 1,032       | **1.401** | over 1.20      |
| 1280  | 1,446    | 1,120       | **1.291** | over 1.20      |
| 390   | 3,075    | 2,787       | **1.103** | **under 1.25** |

`tr-families` (the four-plus card grid) measures **327 px** at 1280 (design target ≤ 320 — 7 px
over). The whole `track-record` region (header + both disclosures + families + archive) is 557 px.
Region evidence for the 1280 gap (`surfaces-repair-after/app/positions-dense-1280-dark.json`):
mast 65→207 (142 px, two figure cells + tabs), then `orders-panel` 158 px + `customization-toolbar`
88 px + the table 256 px inside `portfolio-panel`'s 627 px — `orders-panel` alone is over half the
excess above the design's ~297 px table-area equivalent, and it is load-bearing (see Change 1's
residual). Improved from 1.69× → 1.29–1.40×; does not clear the 1.20× line at 1280/1440.

**Alerts** (before 1,059 / 947 at 1280, 1.12×) — threshold: two columns at 1280/1440 (composer
≤ 45% of page width); page ≤ design × 1.20; 390 ≤ × 1.25.

| width | app real | design real | ratio     | vs threshold   |
| ----- | -------- | ----------- | --------- | -------------- |
| 1440  | 848      | 948         | **0.895** | **under 1.20** |
| 1280  | 848      | 947         | **0.895** | **under 1.20** |
| 390   | 1,484    | 1,945       | **0.763** | **under 1.25** |

Two columns confirmed in the region census: `alerts-composer` at x=84, w=455; `alerts-rules`/
`alerts-events` at x=576, w=603 — composer share of the 1,160 px content width = **39.2%**, under
the 45% cap. All three widths pass; the app is now shorter than the design's own mock.

**Settings** (before 2,827 / 1,873 at 1280, 1.51×) — threshold: page ≤ design × 1.20 at 1280/1440,
× 1.25 at 390; AI-providers panel ≤ 420 px.

| width | app real | design real | ratio     | vs threshold   |
| ----- | -------- | ----------- | --------- | -------------- |
| 1440  | 2,169    | 1,874       | **1.157** | **under 1.20** |
| 1280  | 2,169    | 1,873       | **1.158** | **under 1.20** |
| 390   | 2,532    | 2,841       | **0.891** | **under 1.25** |

`settings-ai-key-panel` measures **633 px** at 1280 (down from 837 px pre-tabs, from 1,142 px in the
original audit; design target ≤ 420 — still over). Breakdown (region census): header+helper ~69 px +
Grok subscription card 124 px + tabs+one provider row 144 px + model section 63 px + padding ≈ 633.
The Grok card is now the largest single piece; kept unchanged and full-size per Change 3's reasoning.
Page-level threshold passes at all three widths; the AI-providers sub-threshold does not.

**Scanner** (before 603 content / 1,296 at 1280) — no page-height threshold (data-dependent, three
fixture rows); explicit checks: score bar on every row, notes row present, no `overflowX` anywhere,
cards at 390 as today.

| width/scheme     | app real | design real | overflowX (app / design) |
| ---------------- | -------- | ----------- | ------------------------ |
| 1440 dark        | 771      | 1,275       | False / False            |
| 1280 dark        | 771      | 1,296       | False / False            |
| 1280 light       | 771      | 1,296       | False / False            |
| 834 dark (cards) | 1,011    | 2,161       | False / False            |
| 390 dark (cards) | 1,891    | 3,639       | False / False            |

`overflowX` is `False` on **every** captured width/scheme, both sides. Score bar (`cell-score-bar`)
confirmed present on every row by direct visual inspection of
`surfaces-repair-after/app/scanner-dense-{1280,390}-dark.png` (SPY/QQQ/NVDA all show a proportional
bar beside the score number; `Prime` renders amber, `Watch` renders neutral). `scan-notes` (the
three note cards) present, h=106 px at 1280, confirmed in both the region census and the screenshot.
Cards render at 390/834 with the score bar carried through (`ScoreCell` is shared between
`ScanTable` and `ScanCard`).

---

## Gates (exit codes — commands run standalone, never overlapping)

| gate                                      | command                                                                                                                                                     | exit                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| dashboard typecheck                       | `npx nx typecheck @convexa/dashboard --skip-nx-cache`                                                                                                       | **0**                                                     |
| root typecheck                            | `npm run typecheck`                                                                                                                                         | **0**                                                     |
| dashboard unit suite, alone               | `npx nx test @convexa/dashboard --skipNxCache`                                                                                                              | **0** — 240 files / 2,921 tests, 0 failed                 |
| lint                                      | `npm run lint`                                                                                                                                              | **0** (pre-existing warnings only, none in touched files) |
| format                                    | `npm run format:check`                                                                                                                                      | **0**                                                     |
| `apps/api` diff                           | `git diff --stat origin/main...HEAD -- apps/api`                                                                                                            | **0 lines**                                               |
| NUL scan                                  | byte scan, every touched file (19 files)                                                                                                                    | **0** NUL bytes, **0** CRLF, all 19                       |
| composition harness                       | `AUDIT_OUT=…surfaces-repair-after npx playwright test --config apps/dashboard-e2e/playwright.audit.config.ts --grep "positions\|alerts\|settings\|scanner"` | **0** — 28/28 captures                                    |
| e2e, full chromium gate, production build | `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e`                                                                                             | **0** — **108/108 passed, 0 flaky**                       |

The e2e gate's first run (before the `d81900ab` fixup) reported **3 failed / 105 passed** — all
three the `tr-breakdown` nesting regression described in Change 1; the second run after the fixup is
the 108/108 recorded above. The dashboard unit suite's first full run (before `c2e194ea`) reported
**2 failed / 2,919 passed** — the `panelRaised2` liveness guard (a real defect, fixed) and one
`ai-rec.absence.spec.tsx` timeout on an unrelated ticker-desk file I never touched, which did not
recur on re-run (consistent with the task's own documented "six phantom failures" full-suite
flakiness warning) — the 2,921/2,921 recorded above is the clean re-run after the fix, reproduced a
third time identically.

## GATE Z

None filed. No change in this lane required touching a must-not-change item; every judgment call
(OrdersPanel staying mounted, Kind/notify-button staying unchanged in Alerts, Brokerage staying
unchanged, the AI-providers tabs conversion, the tier-palette restriction to Prime) was resolved by
evidence already in the repo (a hard test dependency, a measured threshold miss, or a stated
architectural invariant) and is recorded above with its reasoning, not blocked on an owner question.

## Residuals (seen, not fixed — carried, not silently dropped)

1. **Positions:** `OrdersPanel` stays a distinct 158 px card (design has none) — `orders.risk.spec.
ts` requires it mounted and visible with no prior interaction. Page height stays 1.29–1.40× the
   design at 1280/1440 (threshold 1.20×) for this reason plus the fifth track-record family (real
   data has 5 families; the design's mock shows 4) wrapping to a second row. `tr-families` measures
   327 px against a 320 px target (7 px over).
2. **Settings:** the AI-providers panel measures 633 px against a 420 px design target (down from
   1,142 px pre-repair) — the Grok subscription card's own 124 px, kept full-size and separate from
   the BYO tabs by deliberate choice (see Change 3).
3. **Settings:** `BrokerageSection.tsx`'s "Connect reveals the inputs" progressive disclosure not
   built (test dependency; not F7's named complaint).
4. **Alerts:** the "universe member" chip and the Fired row's live "desk open" chip / chevron-to-
   ticker link not built (new network read / criterion-49 risk respectively).
5. **Scanner:** STATUS does not fold into the per-row age/stale chip; the hover preview card is not
   built (task explicitly permits omitting a hover-only control).
6. **Vocabulary residual, not this lane's to fix, noted for completeness:** the scanner fixture's
   `sweep_last_completed: 1` sentinel still renders `Structure as-of 496527h` (L2 in the original
   audit) — visible in this lane's own screenshots; a pre-existing fixture defect, unrelated to any
   of the four changes above.

## Visual baselines

`positions-dense` and `scanner-dense` are two of the six receipt-bound baselines in
`apps/dashboard-e2e/visual-review/`. Per the task, `visual-update` was **not** run and that
directory was **not** touched (confirmed: `git diff --stat` against it is empty). Both surfaces
changed materially by design in this lane (Positions: mast, control row, track-record cards;
Scanner: header, controls, score bar, tier palette, notes) — the six baselines need the owner's
authorization → candidates → acceptance flow before the visual gate can be re-run against them.

## Composition harness artifacts

`surfaces-repair-after/` (this folder) — `app/<id>.json`+`.png`, `design/<id>.json`+`.png` for all
14 plans × 2 sides = 28 captures, `_tools/` (copied from the audit folder), `.gitignore` (raw PNGs
excluded, JSON/tools committed). Never written to `fidelity-audit-2026-09-08/`, `ticker-repair-
after/` or `ticker-repair-verify/` (the pre-existing baseline folders).

---

## Conductor's cold re-verification (2026-09-08, the Mac session — not the lane's numbers)

**Procedure.** Fresh production build (`npx nx build @convexa/dashboard --configuration=production
--skip-nx-cache`, Vite 8, 1,572 modules), the harness `--grep "positions|alerts|settings|scanner"`
into `surfaces-repair-verify/` (28/28 captures, exit 0), the census compared against the lane's own
`surfaces-repair-after/` JSON, composites viewed, then every gate on the final tree.

**Run 1 — the lane's tree (`cf4727b9`), before any conductor change.** Every capture matched the
lane's JSON to the pixel: content bottom, `overflowX`, and every named region's y/h/w/x
(positions 1,446 vs 1,120 = 1.291× at 1280, 1.401× at 1440, 1.103× at 390; alerts 848 vs 947 =
0.895×; settings 2,169 vs 1,873 = 1.158×; scanner 771 px content, `overflowX` false on all five
captures, both sides). The lane's methodology note is confirmed, not just repeated: `pageHeight`
read **1,800** (the viewport `settle()` grew) on alerts and scanner at 1280/1440 while their
regions end at 848 and 771. The lane's numbers stand.

**Review findings → four conductor fixups (three commits, on top of the lane's eight).**

| commit    | what                                                                                                                                                       | why (evidence)                                                                                                                                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| alerts    | drop the **"Prime starts around 80"** caption                                                                                                              | a number with no vouched source: the tier band is a server env the client never receives (`TIER_PRIME_SCORE`, default **75**, Prime also requires `ai_eval.ready` — `PROJECT_CONTEXT.md` env table); the ledger's byte-identity rows record 78 and 79 as `prime`. The design mock's caption; not the data's. |
| alerts    | "You will see fired alerts here **and on the desk**" → "Fired alerts are listed here. Browser notifications, once allowed, also pop while a desk is open." | the desk evaluates rules on each REST poll (`TickerDashboard.tsx:270-293` → `evaluateSnap`) and fires a browser Notification if allowed; nothing on the desk displays a fired alert. The design's nav bell does not exist in the app.                                                                        |
| alerts    | **"Mark N read"** moves from the Rules header to the Recent header                                                                                         | it calls `markAllEventsRead` — it acts on the events list, not the rules. Same element, text, handler and `AlertsRefused` guard.                                                                                                                                                                             |
| positions | `tr-families`: **five** cards on one row at ≥ lg                                                                                                           | the design draws four cards on one row; the app's fifth family (Persona) wrapped alone under `md: repeat(4, …)`, 327 px vs the ≤ 320 target. At 1,192 px content width five cards are ~229 px — the design's own card width.                                                                                 |
| harness   | `contentBottom` field in the census (additive); `pairs.py`/`regions.py` print it                                                                           | the blind spot the lane found, made a field instead of a post-hoc derivation; existing fields byte-comparable with earlier runs.                                                                                                                                                                             |

Also checked and **accepted as written**: the three scanner note cards against `methodology/copy.ts:63-66`
("How a score is built" names the same components — proximity, |IV/HV − 1| stretch, setups, flip-transition
bonus — and omits only the optional dark-pool confluence, acceptable for a summary; the zero-state and
stream-drop notes describe shipped behaviour); "Rules evaluate against structure snapshots while a ticker
desk is open" (true of `useAlerts.ts:55-70`); "Stored in this browser · N rules" (the store is local);
"Capital at risk" = the open book's max-loss sum with an honest coverage caption. The lane's judgment calls
— `OrdersPanel` mounted (test dependency), the Kind select kept (`no-overflow.spec.ts` pins the combobox),
AI providers as `aria-pressed` buttons rather than a half-built ARIA tablist, amber reserved for `Prime`
(the `stage3-amber` invariant), the preset prune leaving filter state valid — are each backed by a named
test or invariant and stand.

**Run 2 — the final tree, after the fixups** (same procedure, fresh build; content bottom from the new
field; design measured in the same run):

| capture                                           | app content                     | design content                        | ratio     | threshold                                      | verdict                                                                                                                    |
| ------------------------------------------------- | ------------------------------- | ------------------------------------- | --------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| positions 1280                                    | **1,298**                       | 1,120                                 | **1.159** | ≤ 1.20                                         | **met** (lane: 1.291)                                                                                                      |
| positions 1440                                    | 1,298                           | 1,032                                 | 1.258     | ≤ 1.20                                         | missed (lane: 1.401) — the app's 1,240 px max column does not reflow between 1280 and 1440; the design's fluid column does |
| positions 390                                     | 3,075                           | 2,787                                 | 1.103     | ≤ 1.25                                         | met                                                                                                                        |
| `tr-families` 1280                                | **176**                         | —                                     | —         | ≤ 320                                          | **met** (lane: 327)                                                                                                        |
| alerts 1280 / 1440                                | 855                             | 947 / 948                             | 0.903     | ≤ 1.20, two columns, composer ≤ 45%            | met — composer 455 px of 1,160 = 39.2%                                                                                     |
| alerts 390                                        | 1,484                           | 1,945                                 | 0.763     | ≤ 1.25                                         | met                                                                                                                        |
| settings 1280 / 1440                              | 2,169                           | 1,873 / 1,874                         | 1.158     | ≤ 1.20                                         | met                                                                                                                        |
| settings 390                                      | 2,532                           | 2,841                                 | 0.891     | ≤ 1.25                                         | met                                                                                                                        |
| `settings-ai-key-panel`                           | 633                             | —                                     | —         | ≤ 420                                          | missed (was 1,142 in the audit) — Grok subscription card 124 px kept whole                                                 |
| scanner 1440 / 1280 dark / 1280 light / 834 / 390 | 771 / 771 / 771 / 1,011 / 1,891 | 1,275 / 1,296 / 1,296 / 2,161 / 3,639 | —         | no `overflowX`; score bar every row; notes row | met — `overflowX` false on all five, both sides; `cell-score-bar` on every scored row; `scan-notes` 106 px at 1280         |

Composites for every capture: `surfaces-repair-verify/pairs/*.jpg` (app left, design right, same scale).

**Gates — final tree, each run standalone, exit codes:**

| gate                                           | result                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| production build, uncached                     | **0**                                                                                              |
| composition harness (28 captures)              | **0** — 28/28                                                                                      |
| whole chromium e2e, production build           | **0** — **108/108, 0 flaky**, Nx cache 0/1 hit (a real run, 30.6 s on 5 workers)                   |
| dashboard unit suite, **alone**                | **0** — 240 files / **2,921** tests                                                                |
| `npm run typecheck`                            | **0**                                                                                              |
| `tsc -p apps/dashboard-e2e --noEmit` (harness) | **0**                                                                                              |
| `npm run lint`                                 | **0** — 5 pre-existing warnings (4 `no-explicit-any`, 1 `exhaustive-deps`), none in a touched file |
| `npm run format:check`                         | **0**                                                                                              |
| `git diff origin/main...HEAD -- apps/api`      | **0 lines**                                                                                        |
| NUL / CRLF byte scan                           | **0 / 0** across the 59 files the lane and the conductor touched                                   |

**Verdict.** The lane's work is accepted. Composition on all four surfaces now follows the design's
layout (two-column alerts, the 760 px settings column with side-by-side fields and provider tabs, the
positions mast/control row/card grid, the scanner header/controls/score bar/notes), the v2 vocabulary
is intact, and two copy claims that overreached the data are gone. Open, carried forward (owner's call):
positions at 1440 (1.258×, structural: `OrdersPanel` 158 px + the max-width column); the AI-providers
panel 633 vs 420; the lane's residual list above; the two visual baselines (`positions-dense`,
`scanner-dense`) changed by design and need the authorization → candidates → acceptance receipt flow
before the visual gate is re-run; and the pre-existing scanner fixture sentinel that renders
"Structure as-of 496527h" / "Sweep last ran 20688 d ago" (audit L2), visible in every scanner capture.
