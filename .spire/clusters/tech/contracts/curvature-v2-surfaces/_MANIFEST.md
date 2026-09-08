# curvature-v2-surfaces — pipeline manifest
Stage:        **SHIPPED — closed at GATE S 2026-09-07** (phase 3 of 4 of the Curvature Terminal v2 build).
              GATE Q **PASS 95/0/0** at pass 4, after three FAIL passes and four GATE Z repair passes. Branch
              `spire/curvature-v2-foundations`, **pushed as a backup only, no PR** — the owner's call. Not archived:
              phases 1 and 2 also stay under `contracts/` until the four-phase build closes, and later phases cite
              their paths.
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    **APPROVED — owner, 2026-09-06** (option A: with the two S2 pass-2 U-32 repairs folded first);
                               **amended once at GATE Z 2026-09-07 by owner ruling D-E** (row 7a). (R4 ×2 + one targeted fold, 2026-09-06, **1218 lines**) — 95
                               acceptance criteria, 53 `SB`; 27/27 council conflicts folded with inline markers (receipt verified
                               27/27); four OWNER rulings + two CONDUCTOR calls tagged inline; `contract_lint` **0 errors** (12
                               size warnings, advisory). S2 pass 1: 1 Critical + 2 Important + 2 Minor, **all five CLOSED at
                               source** by R4 pass 2. S2 pass 2: **1 Critical + 1 Important still OPEN, both on U-32** (the
                               ⓘ criterion's own verification never exercises the desk hero's frame ⓘ; the promoted button's
                               accessible name is unpinned) — loop capped, owner to rule.
  - INTERFACE_CONTRACT.md      **APPROVED with the spec, 2026-09-06; unchanged since** (187 lines) — NO_BACKEND_CHANGE measured three-dot; Conformance
                               block pins `GET /api/scan` + the `/api/ticker/{ticker}` spine, deliberately NOT `PUT /api/scan/view`
                               or `/api/broker/*`; `GET /api/stream/prices` wire facts (heartbeats are SSE comments; `ts_ns`);
                               durable client stores named with their loss-free rule.
Open amendments: **both APPLIED at GATE S 2026-09-07.** (1) Rule 13 — owner ruling D-D: the traced clause now reads
                 "traced to Convexa's computation **or to a record the trader entered**", so a user-entered number (alert
                 threshold, risk input, sim entry) renders Mono with no dotted rule and the `· untraced` caption is
                 unreachable for it. Written into `DESIGN_SYSTEM.md` rule 13 with its date and ruling id. (2) Icons row —
                 the `U+26A0` question is **filed inline in the canon's Icons row as an OPEN OWNER QUESTION**, not answered:
                 does the colour-emoji clause reach `⚠` in a scanner chip label (`pages/scanner/labels.ts:196,205,211`), or
                 is it a deliberate third truth mark? Phase 3 shipped those chips byte-identical either way; the next phase
                 to touch scanner chips should get an answer first.
                 A THIRD amendment was made during this phase and is recorded in `council/decisions.md` as **D-E**: criterion
                 7a scopes to figures whose panel can reach the 20px base (owner ruling at GATE Z, with its reversal).
                 Phase 2 filed four (canon rules **11**, **14**, **16**, **17**); this phase
                 inherits them as settled. One named, non-blocking gap carries in: the **`tooltip` z-rung
                 is undeclared in the canon** while `theme.ts:83` already ships a working, consumed value
                 of **60** (`AppShell.tsx:42` reads `tooltip + 1`). Closing it means declaring 60, not
                 inventing a number.
QA (GATE Q):  **PASS 95 / 0 FAIL / 0 UNVERIFIABLE** — pass 4, 2026-09-07, `QA_REPORT.md` (all four passes retained).
              Pass 1 FAIL 91/4/0 · pass 2 FAIL 93/2/0 · pass 3 FAIL 94/1/0 · pass 4 PASS 95/0/0. QA ran on a different
              model tier from the build lanes by construction. It found two user-facing defects no green suite could see
              (the scanner table and card disagreeing on one price; a retained-price claim over an em-dash), corrected its
              own pass-3 advice in pass 4, and independently re-ran the conformance receipt (PASS, matching BE-1's).
Workers:      council R1x3 blind (402 / 273 / 422 lines), R2x3 sighted (27 conflicts, 27/27 quotes verified), R3x3 one
              exchange (22/22 CONVERGE) + 1 architect addendum; R4 synthesizer x2 + 1 targeted fold; S2 skeptic x2 — all
              2026-09-06
Last gateway:  GATE C @ 2026-09-06 — council complete; owner approval pending

## Gate trail
- GATE I @ 2026-09-05 — brief + cull recorded (6 candidates, 1 chosen, 5 culled with cause). Five facts read
  at source rather than asserted (`[cited-code-is-verified-not-assumed]`), one of which **corrects phase 2's
  own brief**: the eight ticker quiet-band widgets do **not** consume `FigureCell` (zero of eight), and
  neither do scanner / positions / alerts / settings. `StatTile` is gone as a component; every surviving
  mention is a comment. Settings lives at `features/auth/SettingsPage.tsx`, not `pages/`. Alerts already
  ships `level_touch` + price threshold to `convexa.alerts.v1`.
- GATE C (in progress) @ 2026-09-06 — R1 ×3 blind (architect 402 / pm 273 / ux 422 lines); R2 ×3 sighted: **27 conflicts,
  27/27 quotes machine-verified**; 7 self-revisions folded, 2 technical converged by them, 11 technical settled in ONE
  exchange at **22/22 CONVERGE, zero promoted**. Four product calls to the owner, one card at a time: D-A scanner price
  liveness · D-B settings section navigation (net-new construction) · D-C `Widget`-frame ⓘ (desk reopened for one shared
  change) · D-D register of a user-entered number. **All three R1s falsified BRIEF facts:** the scanner runs a real price
  SSE (`useLivePrices.ts:39-57`) so "scanner rows are snapshot surfaces" was false as an absolute; Settings has **no rail**
  (`SettingsPage.tsx:156`), so "rail → tabs at 900" is construction, not a responsive fix; four of the eight quiet-band
  widgets carry no mono figure, and `term-structure`'s only numeral is painted on a canvas (`TermHeatChart.tsx:105-106`).
  **Shipped defects found by the council:** green `+$0` on a fully-unmarked book (`PositionsPage.tsx:147-154,189`); a
  fabricated `≥ 60` on alerts rules with no threshold (`AlertsPage.tsx:192`) and a price threshold that never renders at all;
  `Widget`'s ⓘ non-focusable at seven live sites (`Widget.tsx:245-249`) despite phase-1 ruling 6 declaring AC-35 satisfied;
  `PositionsPage.tsx:88` calling the banned `genuineIsLive` outside the fence's glob; `alerts/store.ts:66-68` resetting to
  empty on a parse failure while the next write overwrites the key — a live `loss-free-durable-migration` breach;
  `PauseMark`/`LiveDot` module-private in `FigureCell.tsx`, so no surface outside the primitive can render the declared
  pause icon today.
- GATE C (R4 + S2) @ 2026-09-06 — four owner rulings (D-A → A · D-B → OUT, phase 4 · D-C → IN · D-D → TRACED) taken one
  card at a time; two CONDUCTOR calls, both reversible and recorded (hover-only positions tips fixed IN; D-A's closed set is the
  header **and its gloss**, after R4 read `labels.ts:26-29` at source). R4 wrote SPEC (95 criteria / 53 SB) + INTERFACE_CONTRACT
  (NO_BACKEND_CHANGE). **S2 pass 1:** 1 Critical — the D-C count was **eight** `info=` sites, not seven (`LiveTape.tsx:179`
  missed; the miscount began in the conductor's decision card, ruling unaffected) — plus 2 Important (a mutation guard that
  covered neither new lint needle; an unstated `retained` cutoff) and 2 Minor. An architect addendum settled the cutoff with
  a finding of its own: the proposed `ts`-age repair was **arithmetically wrong** (`ts_ns` is nanoseconds or `0 if missing`,
  `price.rs:18-19`) and heartbeats are SSE comments never seen by `onmessage` (`stream.rs:434,446,500`) — so `retained` =
  the shipped 45 s watchdog ∧ stream provenance, no new constant; and D-C's fix needs `AccessibleHelp` promoted from
  `pages/ticker/widgets/ai-rec/` to `shared/` or `shared/` imports from `pages/`. R4 pass 2 repaired all five. **S2 pass 2:**
  5/5 CLOSED at source; **1 new Critical + 1 Important, both on U-32**, left open at the cap and surfaced to the owner.
- Owner approval @ 2026-09-06 — **option A: approved with the two U-32 repairs folded first** (hero-scoped assertion named;
  promoted button named `About {title}`). One targeted synthesizer fold applies them; the conductor flips the status.
- Baseline @ 2026-09-06 — conductor's own runs on `spire/curvature-v2-foundations` @ `dd1326d9`, **exit codes checked**:
  `npm run typecheck` **exit 0** · `npm run lint` **exit 0** · `npx nx test @convexa/dashboard --skip-nx-cache` **exit 1** —
  **2691 / 2694 tests, 3 timeouts** (`app.risk.spec.tsx` "/_ops/metrics renders WITHOUT the trader shell" 23.9 s;
  `orders.risk.spec.tsx` `act_confirm_live_cross_fill…` 20.4 s and `cancel_is_terminal…` 8.4 s, all against a 15 s
  `testTimeout`) while a synthesizer lane was loading the machine. **Re-run of those two files in isolation: exit 0, 31/31,
  the three at 1.2 s / 6.5 s / 0.8 s.** `git diff --stat f8957d3f..HEAD -- apps libs` is **empty** — no source has changed since
  phase 2 closed at 231 files / 2694 tests exit 0 — so the baseline is treated as green with the load-timeout named. e2e
  honestly **NOT RUN** at baseline (phase 2 closed it at 86/86 against the production build).
- GATE PLAN @ 2026-09-07 — PLAN.md: **15 tasks** (BE-1 verification-only closer · FE-1…FE-14), 3 tracks, verification rows
  V1–V20, **19 mutation proofs** each with a red-going poison, **all 95 criteria mapped / all 53 SB rows poisoned**;
  Independence all-`no` on measured grounds (one sequential frontend lane, run as shorter lanes committing per task; FE-1 on
  Opus — the `shared/figure/` extraction every later task consumes — the rest Sonnet). **No GATE Z bounce**; three scope
  readings (Z-1 orders `⏸` OUT as debt, Z-2 tooltip-string glyph deleted under class (1), U-8 residual) ruled by the
  conductor in `council/decisions.md` §8, each with its reversal.
- BUILD lane 1 @ 2026-09-07 — **FE-1 landed `2cace383`** (Opus; 8 files, +945/−102): `shared/figure/{figureState,figureFace,
  FigureMarks,index}.ts(x)` + `figureState.spec.ts`; `FigureCell.tsx` 355 → 313 lines and now a caller (`fontFamily` count 0);
  N-1's two needles enforcing in `fonts.spec.ts` behind a **14-entry live-checked `EXEMPT` map** (FE-3 ×2 · FE-5 ×6 · FE-6 ×1
  · FE-7 ×5). Lane's measurements: typecheck 0 · targeted 4 files / 50 tests 0 · the nine `data-figure-state` specs 10 files /
  137 tests 0 with **zero assertion edits** · full suite exit 1 at **2715/2716** (sole failure the baseline load timeout;
  isolated re-run 31/31) · lint 0 · verify-tokens 34/34. Poisons A/B/C red-then-green with output quoted; B′/C′ (needles
  disabled) → 4 failures, guards non-vacuous. **Conductor's cold re-check:** typecheck **0**, `fonts`/`figureState`/`FigureCell`
  **53/53 exit 0**, `apps/api` three-dot diff **0 lines**. Two recorded deviations from PLAN's illustrative regex, both
  strict supersets. IDE diagnostics showed mid-edit phantom errors on this tree after the commit; the cold typecheck is the
  evidence, as in phase 2.
- BUILD lane 2 @ 2026-09-07 — **FE-2 `be7c067b` · FE-3 `d905d26a` · FE-4 `356cea52`** (Sonnet; 549k tokens, 308 tool uses,
  67 min), then a deliberate **checkpoint before FE-5** with a handover at `contracts/curvature-v2-surfaces/RESUME.md`
  (`5f310588`). FE-2: liveness fence widened to the four surfaces, banned `genuineIsLive` deleted from `/positions` (proof D
  red on a planted call, reverted). FE-3: scanner atoms consume the figure module, U-6 lookup-miss split, new
  `scanner.register.spec.tsx`, a string-radius needle in `radius-scale.spec.ts`, 2 `EXEMPT` entries burned (14 → 12), zero
  copy diffs (proof E red on a raw-enum poison). FE-4: scanner degraded price arm on `live.offline ∧ provenance`, flash gate on
  the stream flag, **D-A copy landed** — `Prices per tick · structure ~3 min · hot names sooner` and the gloss without its
  liveness sentence — T5 measured (the shipped `scanner.risk.spec.tsx:869` stayed green on the offline arm; both arms now pinned
  separately), proofs F/G red-then-green; the lane ran the app in headless Chromium against the live backend and recorded
  what it saw (F4 not naturally reachable in dev — covered by the `EventSource`-driven test, said so). One pre-existing
  out-of-scope defect filed as debt: `ScanTable`'s zero-state grouping drops the live-price overlay. Full suite not run
  (owed by the closer). **Conductor's cold re-check @ `5f310588`:** typecheck **0**; scanner + positions + liveness + theme
  **26 files / 290 tests exit 0**; `apps/api` three-dot diff **0 lines**; `labels.ts:29` reads the new header verbatim.
- BUILD lane 3 @ 2026-09-07 — **FE-5 `bdc992d8`** + handover `9172eafa` (Sonnet; 562k tokens, 266 tool uses, 74 min). Six
  live-derived positions cells route through `figureStateOf`+`faceFor` (exported `markFigure`/`plFigure`/`plPctFigure`);
  `PositionCard` consumes the same helpers — closing a real "one datum, two ways" divergence (card showed `—`/empty where the
  row showed `unavailable`); every `⏸` text mark in positions gone (six class-(1) replacements itemized, Z-2 included);
  `literal()` tips keyboard-reachable (U-15a, CONDUCTOR call); new `pauseGlyph.spec.ts` (proof H red on a restored glyph);
  proof I red on a forced last-known clause; orders files face-re-pointed only (Z-1's `⏸` at `OrderRow.tsx:172` untouched —
  confirmed by sweep); `EXEMPT` 12 → **6** (FE-6 ×1, FE-7 ×5). Lane's measurements: typecheck 0 · targeted 52 files / 650
  tests 0 · **full suite 234/234 files, 2782/2782, exit 0** on the second run (first run an Nx-flagged worker crash with no
  named failure) · flaky pair 31/31 · lint 0. App run: seeded AMD call with an unresolvable mark rendered `unavailable`
  identically in table and card at 1280/393; offline visual not reachable against the dev backend (said so; covered by four
  SB tests + the SSE-drop flow). **Conductor's cold re-check @ `9172eafa`:** typecheck **0**; positions + figure + theme +
  orders **57 files / 694 tests exit 0**; `apps/api` diff **0**; remaining `⏸` sources are broker-only (FE-7's).
- BUILD lane 4 @ 2026-09-07 — **FE-6 `5e1fa577`** (positions header readout → `FigureCell` in `PanelContainer`; `netPl.ts`
  five Net P/L states — the green `+$0` defect closed) · **FE-7 `b2a8cf15`** (Broker tab register conversion, `not provided`
  non-synonymy, pause icon; N-1 `EXEMPT` map **5 → 0**). **Lane stopped by the conductor immediately after FE-7's commit, at
  the owner's request (machine restart)** — FE-8/9/10 not started; working tree clean at the stop. **Conductor's cold
  re-check @ `b2a8cf15`:** typecheck **0**; broker + positions + theme + figure 70 files / 955 tests → **954 pass + 1 real
  failure**: `pauseGlyph.spec.ts`'s own live-checked `EXEMPT` map still named the two Broker files FE-7 had just cleaned
  ("no longer violates — DELETE the entry"); the lane's targeted run had not included that spec. **Fixed by the conductor**
  in a follow-up `fix(dashboard)` commit (map emptied; affected suites re-run green; typecheck 0; lint 0). `apps/api` diff
  **0**; no `⏸` left in code under `apps/dashboard/src/app`. Handover for FE-8 → FE-10 rewritten by the conductor in
  `contracts/curvature-v2-surfaces/RESUME.md` (gotcha 10 added: run every spec whose `EXEMPT` map names your task).

## Inherited (do not rediscover)
`state/spire-curvature-v2-foundations/RESUME.md` carries the phase table and the trap that cost phase 2 the
most time (a stale `node_modules/.vite` glob transform that `--skip-nx-cache` does **not** clear).
`contracts/curvature-v2-desk-and-read/_MANIFEST.md` carries phase 2's gate trail, the **four defects it found
in previously-shipped code**, and the carried-debt list with phases attached.
`contracts/curvature-v2-foundations/council/decisions.md` — phase 1's eight owner rulings; **ruling 6 assigns
this phase its quiet-band work by name**.
`state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md` — phase 2's seven DELEGATED calls, each with its
reversal, including the two later found wrong on their facts.

## Debt this phase is scoped to inherit
The eight quiet-band widgets' register enforcement and container steps (phase 1 ruling 6, deferred by name).
**Not** this phase: the curve text-equivalent (DELEGATED P1) and the spacing-exemption remainder — both phase 4.

---

## GATE S — close-out, 2026-09-07

**Verdict: SHIPPED.** GATE Q **PASS 95 / 0 / 0** (pass 4). Fifteen build tasks (FE-1…FE-14, BE-1) plus **four** GATE Z
repair passes. Branch `spire/curvature-v2-foundations`, pushed as a backup only, **no PR** — the owner's call.

### The conductor's own final runs (not the lanes', not QA's)
| check | result |
|---|---|
| `npx nx run-many -t typecheck -p @convexa/dashboard,dashboard-e2e --skip-nx-cache` (cold, build outputs deleted) | **0** |
| `npx nx test @convexa/dashboard --skip-nx-cache` | **0** @ 239 files / **2857** tests |
| `npm run lint` | **0**, 5 pre-existing warnings, 0 new |
| `npm run build` (production) | **0** |
| `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e --skip-nx-cache` (repo root, production build) | **0** @ **108/108**, 0 flaky |
| `node design/src/verify-tokens.mjs` | **0** @ 34/34 (v1 **and** the v2 additions) |
| `git diff --name-only origin/main...HEAD -- apps/api` (three-dot) | **0 files** — also 0 for `libs/quant-engine` and the Cargo manifests |
| independent conformance (QA's receipt vs BE-1's) | **PASS**, 2 endpoints, `/api/scan` first, byte-identical apart from `checked_at` |
| `node .claude/tools/gates.mjs contract_lint curvature-v2-surfaces` | **0 errors** (14 advisory size warnings) |

e2e grew **86 → 108** across this phase. Both live-checked `EXEMPT` maps end **empty**; `liveClaim.spec.ts` keeps exactly
its one justified entry (`LiveTape.tsx`).

### What the gate actually caught — the case for the pipeline
GATE Q **failed this phase three times** while every suite was green, which is the same shape as phase 1's first pass:
- **Pass 1 (FAIL 91/4/0)** — the scanner table and card rendered **different prices for the same symbol in the same frame**
  (`ScanTable.tsx:290` preferred `groups` and discarded the live-price overlay `Scanner.tsx:121` had built), and the
  degraded arm then claimed **`offline · last known` over an em-dash** — a "last known" statement where nothing was known.
  The unit test could not reach either: it rendered `ScanTable` with no `groups` prop and a fixture that skipped grouping.
- **Pass 2 (FAIL 93/2/0)** — four controls under the 44px coarse-pointer floor that the build report itemized nowhere.
- **Pass 3 (FAIL 94/1/0)** — criterion 7a unreachable; escalated to the owner rather than converted (→ ruling **D-E**).
- **Pass 4 (PASS)** — and QA **corrected its own pass-3 advice**: the fix it had named (`display: block`) also removes the
  disclosure marker, and the `::marker` signal it relied on cannot go red for that defect. A lane caught the reviewer.

**A regression this phase introduced, found late and fixed within it:** FE-5's `literal()` wrapper
(`PositionRow.tsx:168-173`) declared `display:'inline-block'` with no `position`, so its absolutely-positioned
visually-hidden description sibling escaped `positions-table-frame`'s `overflow-x:auto` clip and widened
`documentElement.scrollWidth` to **978** at a 900px viewport. FE-13 first recorded it as pre-existing; the conductor
**overturned that** against phase 2's close-out evidence (86/86, exit 0, twice, QA-re-run at baseline `f8957d3f`) and the
repair lane confirmed at source that the block did not exist at baseline. Fixed at `5c07dc40` (978 → 900); one latent
duplicate fixed at `141b2a74`; a third instance measured harmless and itemized.

### Process notes for phase 4
- **A lane broke the no-`git stash` rule** during FE-13 (recorded as gotcha 17). The conductor verified immediately that
  nothing was lost — all 27 of the sibling process's untracked files present and unmodified, no stash entry left behind.
  The rule stands and the warning carries forward.
- **The IDE's diagnostics were wrong on every lane's tree this phase** — dozens of phantom errors on trees that cold-typecheck
  at exit 0. The cold exit code was the only evidence, every time.
- **Two dispatch anchors the conductor supplied were wrong** and lanes corrected them at source (`Widget.tsx` already lived in
  `shared/ui/`; `AccessibleHelp` had nine importers, not ten). A third (`TrackRecordSection.tsx`'s directory) the conductor
  got wrong and QA had right. Verify every cited line and path with `grep -n` before acting on it — this held every time.
