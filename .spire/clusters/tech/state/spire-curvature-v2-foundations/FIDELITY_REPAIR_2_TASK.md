# Repair task — fidelity repair 2: the review's defects on `/ticker` (owner-directed, 2026-09-10)

**Owner:** on the 2026-09-10 fidelity review's recommendation — *"yes do all"*: fix the review's **defects** (not its
owner calls) in one bounded lane on `main`, **before** phase 4's build lane, so the visual baselines are re-accepted once.
Route: a direct repair lane on the same rules as `TICKER_FIDELITY_REPAIR_TASK.md` and `SURFACES_FIDELITY_REPAIR_TASK.md`
(this folder), off the council pipeline — the design source is the spec. Findings list:
`fidelity-review-2026-09-10/VISUAL_REVIEW.md` — items **N1, N2, N4, N5, N6, N7**. N3, N8–N14 are **owner calls filed in
BACKLOG (F-M…F-S)** and are **not** in scope. Branch: `fix/fidelity-repair-2` (cut from `main` `4ca9edc7`; already checked
out). Scope: `apps/dashboard` only.

## Target (read these before touching anything; verify every anchor with `grep -n` — the review's line numbers were
verified on `4ca9edc7`, but verify again)

- The design's desk: `design/src/screens/desk.mjs`; the states page `design/src/screens/desk-states.mjs` (the *Cold load*
  frame and its note: "Skeletons take the exact final shape — masthead, field with ladder, strip — so the first bundle lands
  without a jump"; the *Cold-start failure* frame: "Couldn't load SPY. The structure request failed before any snapshot
  arrived. Nothing is cached for this desk yet." + `Retry`, burnt orange with the icon, toolbar still usable). Rendered
  oracle: `design/site/desk.html`, `design/site/desk-states.html` — serve `design/site/` on :4310 and open beside the app.
- Evidence for each item: `fidelity-review-2026-09-10/pairs/desk-cold-load-1280-dark.png`,
  `pairs/desk-cold-failure-1280-dark.png`, `crops/orders-1440.png`, `crops/orders-1280.png`, `crops/ladder-834.png`,
  `crops/app-ai-read-trade-1280-dark.png`, and the accepted baseline
  `apps/dashboard-e2e/src/quality/snapshots/linux/chromium/ai-recommendation.png` (N5, N6 visible in it).
- Specs that bind: foundations `SPEC.md` **AC-46 (SB)** ("Cold load shows skeletons in the **final shape**, and the skeleton
  form never appears after the first successful load") and its F2 row (loading = shimmer at label / figure / caption height,
  no text); desk-and-read `SPEC.md` §4.1 (every v2 component's *loading* cell: Structure field → "cold skeleton", Read strip →
  "cold skeleton", Level ladder → "inherits the desk's cold skeleton", AI read → "in-flight indicator; no verdict word
  mounted"); canon rules 3, 13, 16, 20, 21, 23, 24 (`context/DESIGN_SYSTEM.md`).

## Must not change (semantics phases 1–3 paid for; the review found them faithful)

- The single liveness predicate, the branded `LiveClaim`, `useStreamLatch`, the connection chip's six states and copy.
- `figureStateOf` / `faceFor`; the closed not-a-number vocabulary (canon 24); Mono = traced, Sans = asserted-untraced.
- The AI read's **content** in every state; the amber-text closed list (canon 16); `ReadSheet` at phone width.
- The structure hero as repaired (`StructureHeroPanel`, ladder rows' order and register, tape row, path row, foot) — N4 is a
  wrap rule, not a ladder change.
- The masthead as repaired (`TickerHeader`, change 9's headline-row join). N10 (day change, instrument name) is an owner call.
- Canon 11 (field form), 14, 18, 22 (liveness gated), 21 (quiet panels never lift).
- `apps/api` diff stays **0**. `libs/api` stays **0** — N7 is fixed where the dashboard renders the alert, not in the client's
  error string (`libs/api/src/lib/convexa.ts:1338` builds `API error ${status}`; leave it — other consumers assert on it).
- No literal NUL bytes; LF only; no `git stash` (a sibling session may hold uncommitted work); no `nx format:write` unscoped.
- The review's evidence folder (`fidelity-review-2026-09-10/`) is the **baseline** — never write captures into it.
- **No visual baseline is written by this lane.** `npm run browser:visual` will fail on the scenarios this work changes
  (expected: `ticker-desktop`, `ai-recommendation`, possibly `ticker-offline-mobile`); record the failures with their evidence
  paths in the report. Candidate generation needs an owner-authored authorization receipt (`visual-review/README.md`) — the
  conductor requests it; the lane does not run `browser:visual:update`.

## Changes (most severe first; each one RED test first, then GREEN, then the design check)

1. **N1 — the cold-load skeleton takes the final shape.** `TickerDashboard.tsx:86-93` (`StatGridSkeleton`, "AC-Skel-1") and
   `:445-450` (`data-testid="cold-load"`: a 280-px title shimmer + the tile grid) render v1's shape. Replace the
   `cold-load` subtree with shimmer in the v2 desk's shape at every band: masthead (chip row · headline · meta line · quick
   row, bare on the ink — no raised toolbar panel), the hero panel at its final height (`widget-structure-hero` measured
   **483 px** at 1280, **968 px** at 390 in the review; field region + a five-row ladder column ≥ 1000 px, ladder below the
   field under 1000 px), the read strip (eight cells, `1.35fr repeat(7, minmax(0,1fr))` ≥ 1200; a rail below), the work grid
   (`8fr / 4fr` ≥ 1200; stacked below) with an AI-brief block and three side cards, and the band header. Shimmer only — no text,
   no `—`, no "Loading…" (foundations F2). Keep the existing `cold-load` and `cold-skeleton` testids (the absence-after-load
   test keys on them). The toolbar's `TICKER / EXPIRATIONS / PERSONA` controls stay usable during load (design note), rendered
   as the v2 masthead's controls, not the v1 raised panel. RED tests: (a) at 1280 the `cold-load` subtree contains a
   hero-shaped skeleton ≥ 400 px tall and exactly eight strip cells; (b) at 393 the ladder skeleton sits below the field
   skeleton; (c) the existing absence-after-load assertion still passes; (d) no text node inside `cold-load`. Then measure:
   the cold-load page height at 1280 should land within ±10 % of the loaded page's first-fold regions (masthead 215, hero 483,
   strip 131) so the first bundle "lands without a jump".
2. **N2 — the side-column widget title stops truncating.** `features/trading/orders/copy.ts:95` `WIDGET_TITLE =
   `Simulated orders · ${ticker}`` truncates to `Simulated or…` in the 379-px side column at 1280 **and** 1440
   (`crops/orders-1440.png`). Use the design's title `Sim orders · ${ticker}` (design `desk.mjs` side column) **or** let the
   title wrap and remove the fixed reserve the chip + `All orders →` claim — whichever keeps the chip and link on the title
   row at 379 px. RED test: at a 379-px container the rendered title text is not ellipsised (`scrollWidth <= clientWidth`
   on the title node, or the full string present) at 1280 and 1440 viewports. Check the same title inside the phone stack
   (358 px) — the review did not measure it.
3. **N4 — the ladder label stops truncating at 834.** Under 1000 px the ladder renders as one row of five
   (`LevelLadder.tsx:142` `repeat(5, minmax(0, 1fr))`) and `FigureRow`'s label (`_kit/FigureCell.tsx:492` `textOverflow:
   'ellipsis'`) cuts `Gamma flip` to `Gamma f…` (`crops/ladder-834.png`). Let the label wrap (two lines) in the five-up band,
   or drop to the two-column ladder earlier — the design keeps five full labels at 834. RED test: at 834 every ladder label
   renders its full text (no ellipsis). Do not touch the ≥ 1000 px column layout.
4. **N5 — one as-of / expiration formatter.** Raw sites: `ai-rec/DecisionCard.tsx:144` (`As of ${rec.as_of}` — an ISO
   string), `ai-rec/AnalysisSurface.tsx:44` (` · As of ${rec.as_of}`), `ai-rec/AiRecPanelBlocks.tsx:66-76` (`SnapshotHint`:
   `, as of ${bundle.meta.freshness.snapshot_iso}`), the raw `strategy.expiration` at `AnalysisSurface.tsx:58` and the
   expiration in `DecisionCard`'s structure line, and `CitedContractLine` / the candidates line ("Candidates as of
   2026-08-23T16:00:00.000Z · unknown session"). Design forms: `read pinned as of 10:41:52 ET · 48s ago`, `Snapshot as of
   10:41:52 ET`, `Sep 18 (15 DTE)`. Add two pure helpers beside `humanAge` (`_kit/copy.ts:532`): `fmtAsOfEt(iso, now)` →
   `HH:MM:SS ET · <age>` (age via `humanAge`; ET = `America/New_York`, the exchange clock the product already uses for
   session words) and `fmtExpiry(isoDate, now)` → `Sep 18 (15 DTE)` (DTE from the exchange date, never negative; a null or
   unparseable input renders the closed-vocabulary member, never the raw string). Apply them at every site above. RED tests:
   the helpers (fixed clock, DST both sides, null input) and one render test per site asserting the ISO string is **absent**
   from the DOM. `data-rec-as-of` (`DecisionCard.tsx:330`) keeps the raw ISO — it is a machine attribute, not copy.
5. **N6 — the analysis drawer lists "Time horizon" once.** `AnalysisSurface.tsx:59` (structured summary) and `:83` (plan
   fields) both render `PLAN_FIELD_LABEL.timeHorizon`. Keep it in the plan fields (beside Confidence, where the design's
   `MANAGE THE TRADE` sits) and drop it from the structured summary. RED test: exactly one `Time horizon` label in the drawer.
6. **N7 — the cold-start failure reads like the design.** `TickerDashboard.tsx:425` renders the alert with the client's
   `API error ${status}` message. Render the design's copy instead: headline `Couldn't load {TICKER}.`, body `The structure
   request failed before any snapshot arrived. Nothing is cached for this desk yet.`, the `Retry` action beside it, burnt
   orange + icon (`warning`), and keep the status as a Mono detail line (`HTTP 502`) so nothing is hidden. The toolbar stays
   usable. The poll-failure-after-success case is different ("Couldn't refresh — showing data from N min ago. Retrying
   automatically." in the design note) — only change it if it is the same code path; otherwise record it. The accessibility
   scenario `A11Y-8` asserts the literal `API error 503` (`src/quality/fixtures/scenarios.ts:502`) — update the assertion to
   the new headline **in the same commit**; the a11y gate's inventory may need re-baselining through its own receipt — if so,
   stop and report rather than editing the inventory by hand.

## Verification the lane owes (exit codes, not printed summaries; commands run standalone, never overlapping)

| check | command | expected |
|---|---|---|
| typecheck (cold) | `npx nx typecheck @convexa/dashboard --skip-nx-cache` (delete `apps/dashboard/dist` / `out-tsc` / `*.tsbuildinfo` first) | 0 |
| unit + component | `npx nx test @convexa/dashboard --skipNxCache` | 0, and each RED test shown red before its fix (paste the red run's summary line) |
| lint / format | `npm run lint` · `npm run format:check` | 0 / 0 (format scoped to your files if you must write) |
| production build | `npx nx build @convexa/dashboard --configuration=production --skip-nx-cache` | 0 |
| desk e2e | `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e --skip-nx-cache -- --grep "desk\|curvature\|overflow\|cold"` | 0, 0 flaky |
| accessibility gate | `BROWSER_QUALITY_PREBUILD_STATUS=pass npm run browser:a11y` | 0 (A11Y-8 with the new copy) |
| visual gate | `BROWSER_QUALITY_PREBUILD_STATUS=pass npm run browser:visual` | **expected FAIL** on the changed scenarios — list each with its expected / actual / diff evidence path; no PNG written |
| harness | `AUDIT_OUT=<repo>/.spire/clusters/tech/state/spire-curvature-v2-foundations/fidelity-repair-2-after npx playwright test --config apps/dashboard-e2e/playwright.audit.config.ts --grep "desk-real\|desk-trade"` (stop your own :4200 / :4310 first — the harness owns both) | exit 0; then `uv run --with pillow python <after>/_tools/pairs.py` and the numbers in the report |
| cold-load + failure captures | `node --input-type=module -e "$(sed "s#process.argv\[2\]#'<after>'#" fidelity-review-2026-09-10/_tools/coldload.mjs)"` and the 502 variant used by the review | new PNGs beside the review's for the before/after pair |
| NUL scan | `python3 -c "import io,sys;[print(f,io.open(f,'rb').read().count(bytes([0]))) for f in sys.argv[1:]]" $(git diff --name-only)` | all 0 |
| lanes | `git diff --stat main -- apps/api libs/api` | empty |

## Rules

- Reproduce before fixing: open the design page and the app at the width in question and look, then write the RED test.
- Commit per change, on `fix/fidelity-repair-2`, messages in the repo's voice (`fix(dashboard): …`, `test(…): …`); never
  `--amend` a pushed commit; do not push — the conductor pushes.
- Report to `FIDELITY_REPAIR_2_REPORT.md` (this folder): commits, change-by-change with before/after measurements, the
  verification table with real exit codes, the visual gate's failure evidence, residuals named, what you could not verify.
- Stop and report (GATE Z) instead of widening scope: no touching N3 (captions), N8 (tape chrome), N9 (ring), N10 (masthead
  data), N12 (cap idiom), N13 (panel outline), N14 (elevation), the band's density, or anything in `apps/api` / `libs/api`.
