# RESUME — curvature-v2-surfaces frontend lane (FE-11 → FE-14, then BE-1)

**Resume status:** ACTIVE — FE-8, FE-9, FE-10 landed clean, one commit each, in that order, on
`spire/curvature-v2-foundations`. Nothing is half-done: the working tree was clean at the stop
(aside from the untouched sibling-process directory noted below). This file is written by the lane
that just landed FE-8/9/10, not a conductor overlay.

## Done (all committed on `spire/curvature-v2-foundations`; re-run before trusting)

| Task | Commit | What landed |
|---|---|---|
| FE-1 | `2cace383` | `shared/figure/{figureState,figureFace,FigureMarks,index}` + spec; `FigureCell` is a caller; N-1 needles enforcing behind a live-checked `EXEMPT` map |
| FE-2 | `be7c067b` | liveness fence widened to the four surfaces; banned `genuineIsLive` deleted from `PositionsPage.tsx` |
| FE-3 | `d905d26a` | scanner atoms consume the figure module; U-6 lookup-miss split; `EXEMPT` 14 → 12 |
| FE-4 | `356cea52` | scanner degraded price arm, flash gate, D-A copy |
| FE-5 | `bdc992d8` | positions rows on the module; every `⏸` → stroke icon; keyboard-reachable tips; `EXEMPT` 12 → 6 |
| FE-6 | `ede3ddd4` | positions header readout → `FigureCell`; `netPl.ts` five Net P/L states; `EXEMPT` 6 → 5 |
| FE-7 | `b2a8cf15` | Broker tab register conversion; `not provided` non-synonymy; pause icon; `EXEMPT` 5 → 0 |
| FE-7 follow-up | (see FE-7 log) | conductor: emptied `pauseGlyph.spec.ts`'s own `EXEMPT` map |
| FE-8 | `83af0059` | Settings: risk-input register (Mono/traced, `not set`), neutral save confirmation (`severity="info"`, all FOUR settings-page confirmations — see gotcha 11), U-19 session-resolving line, U-35 panel radius. Two real defects fixed: `useSettings.ts`'s `writeServer` never re-threw (so a failed write STILL showed "Saved"); the ticker draft never reverted on a failed write. New `settings.register.spec.tsx` (15 tests). |
| FE-9 | `589bbc51` | Alerts store read-fault latch (`alertsReadFaulted()`, `store.ts`) — closes the loss-free durable-migration breach where a corrupt blob's next write overwrote it. New `store.spec.ts` (9 tests, all 4 required cases a–d). |
| FE-10 | `81f77222` | Alerts page: closed lookups (`features/alerts/labels.ts`, new), thresholds by rule type (Mono/traced, `not set` never a fabricated default), unread off the coloured-edge-alone, three distinct empties, notify-permission honesty (a real defect: the stored flag could read stale-`true` after a revoked permission), N-5 faulted posture (local `AlertsRefused`/`AlertsFaultedBanner` mirroring `FaultedBanner.tsx`'s attribute set), U-23a/24/27. New `alerts.risk.spec.tsx` (23 tests); `evaluate.ts`/`evaluate.spec.ts` edited. |

**This session's own measurements (FE-8/9/10):** `npm run typecheck` **exit 0** (run cold after every
task, `dist`/`out-tsc`/`*.tsbuildinfo` deleted first) · `npm run lint` **exit 0**, 5 warnings, all
pre-existing, 0 new, every task · targeted `nx test` **exit 0** every task · full dashboard suite run
**twice** after FE-10 (mandated): run 1 **exit 1** (`stage3-amber.spec.ts` — one **environmental**
`ENOENT` on `_mutation_poison_replay_outcome_join.ts`, an UNRELATED file's own mutation-test poison
racing a glob-import under parallel workers; confirmed by isolation re-run, exit 0, 32/32), run 2
**exit 0, 238/238 files, 2844/2844 tests** — Nx itself flagged the pairing a **detected flaky task**,
independently corroborating the diagnosis. Full detail, itemized copy diffs, and both mutation proofs
per task (M/N/O/P — all run red, quoted, then reverted green) are in `BUILD_REPORT.md` §FE-8/§FE-9/§FE-10.

## Next concrete step: **FE-11 — the quiet band**, then **FE-12 — the `Widget` frame ⓘ (D-C)**, then **FE-13 — browser/e2e**, then **FE-14 — frontend closer**, then **BE-1 — backend verification**

Dispatch **one fresh Sonnet lane** for FE-11 (its own commit), then a fresh lane (or continuation) for
FE-12, FE-13, FE-14 — PLAN.md's own task boundaries govern; do not batch tasks into one commit. Inputs
each lane must read: this file; `PLAN.md` header + its own task in full (**verify every cited line
number with `grep -n` first — they drift**, confirmed twice this session — RESUME.md's own line
citations for FE-9/10 all held, but do not assume the next task's will); `SPEC.md` §2.4 (quiet band),
§2.8 (Widget frame ⓘ, D-C), §3 F, §4.6, §1 Out; `council/decisions.md` §3 #2/#21, §4 D-C; the relevant
`INTERFACE_CONTRACT.md` sections (none touch the backend — `NO_BACKEND_CHANGE` stands); `BUILD_REPORT.md`
for the format and the FE-1/FE-8/FE-9/FE-10 sections (the helpers/idioms below).

What binds FE-11 (restated from PLAN, not a substitute for reading it in full):
- **Quiet band, split by figure, not widget.** Only `off-exchange-blocks` (`:24,79-81`) and
  `fresh-positioning` (`:15,56-58`) carry mono runs from widget-local constants; `term-structure` and
  `setups` are figure-free in the DOM (no count-shaped criterion — the deliverable is the property).
  Delete the local `MONO`, resolve register through `@/shared/figure`, lift the absent-value token into
  its own Sans span **at the row's own 12px** (never `FigureCell`'s 15px literal — that inverts the
  hierarchy in a 12px list). `lookalikes.spec.ts:22-27,47-55` exempts four OTHER widgets — converting
  these two edits no spec.
- **Container-step hazard.** `Widget.tsx:180`'s `containerName: 'panel'` never fires today because the
  nearest named ancestor is the WHOLE widget body, not each figure. Every converted multi-figure widget
  wraps EACH figure in its own nested `PanelContainer` (same name, nearest-ancestor wins —
  `ReadStrip.tsx:54` is the shipped precedent). Never a second container name, never `containerName` on
  the widget's own grid. Criterion 7a needs a RENDERED assertion at a narrowed container width, never
  rule-presence (`type-floor.spec.tsx` already passes while nothing steps — that is the vacuous-gate
  trap criterion 69 exists to catch).
- **Copy — exactly two sites, closed (56a).** (i) `_kit/copy.ts:355` `MC_CELL_EMPTY = 'unavailable this
  cycle'` sits in a figure VALUE slot → split into value `unavailable` + caption `this cycle`. (ii)
  `Setups.tsx:52` renders one sentence for both `undefined` and `[]` → `[]` keeps
  `No clean setup right now.` byte-for-byte; `undefined` renders `Setups unavailable this cycle.`
  **Nothing else** — `*_WHOLE_EMPTY` prose (`copy.ts:297,352-354`) is untouched; a third change is a
  conflict, not a detail (U-30 on `Setups.tsx:41`'s `.toUpperCase()` is WITHDRAWN, carried debt).
- **Criteria 53/54/58/59** (SB): stated register on every figure; no untraced figure ever renders Mono
  in any state; no live mark in any connection state; every hover-revealed help control (incl. the
  off-exchange proximity chip, outside ruling 6's four widgets) reachable by tap AND keyboard focus.

**Carried mechanism notes (from FE-1/8/9/10, apply as needed):**
- Consume `figureStateOf`/`faceFor` from `@/shared/figure`, never the card. `faceFor(true)` = Mono
  (`fontFamily` + `tabular-nums` + `letterSpacing:0`); spread it, don't hand-roll a local `MONO`.
- `data-figure-register` sits on the VALUE's own node when there's no `FigureCell` card; never assume
  co-location with `data-figure-state`.
- The ladder (20/17/15) is `FigureCell`'s own panel-scale constant and does NOT travel — a 12px list
  row keeps 12px.
- MUI `sx` compiles to a class; never assert `getAttribute('style')` — use `className` identity/regex
  (`toMatch(/colorInfo|MuiAlert-standardInfo/)` is the established idiom, see `settings.register.spec.tsx`)
  or structural DOM assertions.

## What binds FE-12 (D-C, the `Widget` frame ⓘ) — read SPEC §2.8 in full before starting

- Promote `AccessibleHelp` (today `pages/ticker/widgets/ai-rec/AccessibleHelp.tsx:37`) into `shared/ui/`
  — the SAME `pages/` → `shared/` inversion §2.1 already refused for the figure module. Nine existing
  importers re-point with ZERO behaviour change (same props, same `aria-label`, same `stopPropagation`,
  same `enterTouchDelay={0}`).
- `Widget.tsx:245-249`'s bare hover-tooltip `info` icon becomes the ONE shipped focusable-help pattern,
  at all **eight** live `info=` sites (count corrected after S2 — `LiveTape.tsx:179` was missed at the
  original count of seven).
- The promoted call's accessible name is **`About {title}`** (the widget's OWN `title` prop) — not a
  style choice, it's how AC-35's `.first()` resolution reaches the right control (§2.8's own worked
  example of why a differently-named button reads green while testing nothing).
- **The ticker desk is reopened for this ONE shared-frame change and NOTHING else** — no desk layout,
  copy, state or spec content changes. Five shipped desk specs re-run inside this criterion (not merely
  after it) and must stay green for BOTH the hero and the live tape — SPEC §2.8 names all five with
  exact line ranges.
- **Poison, required:** rename the promoted header button or drop the `About ` prefix — AC-35 must go
  red at ALL EIGHT sites, or the enforcement is the vacuous gate criterion 69 exists to catch.

## Gotchas (carried from lanes 2–10; do not rediscover)

1. **A price-merge bug in `Scanner.tsx`'s zero-state lead grouping was found and NOT fixed** (carried
   debt, `BUILD_REPORT.md` FE-4 §3) — still unfixed, still not this lane's job.
2. **jsdom has no global `EventSource`** — stub a controllable class per the repo's own idiom.
3. **Live-checked `EXEMPT` maps fail on BOTH arms** (file must exist AND still violate).
4. **The `MONO_BOUND` needle-1 regex windows ±6/+12 lines around ANY line naming `MONO`/`MONO_FACE`/
   `monoSx`/`monoFontFamily` — including inside a comment.** Reword the comment or name the string as a
   constant; never restyle a render to dodge a heuristic.
5. **Scripted `sed`/heredoc edits risk silently no-op'ing on CRLF files.** Use the Edit tool; grep-verify
   after any scripted replace. (`git add` prints a harmless `LF will be replaced by CRLF` warning on this
   Windows box every commit — that is expected, not a defect; the committed blob stays LF per
   `.gitattributes`.)
6. **`npm run ports:free`** at the start and the end of any app-verification pass (both IPv4 and `[::1]`).
7. **Seeding a populated `/positions` in a fresh `npm run dev` is a two-step trap** (sign up a throwaway
   account; `localStorage.removeItem('convexa.positions.v3')` in the SAME `page.evaluate` that seeds
   `convexa.positions.v2`, before the reload).
8. **Forcing a live SSE drop against the real dev backend is unreliable in lane time** — the
   `EventSource`-stub tests are the reliable coverage; the browser pass is for reachable states only.
9. **Scratch files: never at the repo root as a PERMANENT artifact** — the sandbox write-guard blocks
   the OS temp dir directly, so a throwaway browser-driver script has to land at the repo root
   temporarily; delete it and its screenshots before the commit (confirmed via `git status --porcelain`
   showing no `_tmp_*` file each time this session).
10. **A task's targeted run must include every spec file whose `EXEMPT` map names that task.** Before
    committing: `grep -rln "FE-<n>" apps/dashboard/src --include=*.spec.*` and run every file it names —
    but **read each citation before acting on it**: this session's own FE-9/FE-10 greps each returned
    4–5 files, and all but the lane's own new file were a DIFFERENT feature's unrelated task numbering
    (`curvature-v2-desk-and-read FE-8/FE-9`) — confirmed by opening each citation, not by the grep count
    alone. Don't let a coincidental task-ID collision across features cost a wasted detour, and don't
    skip the check because most hits turn out to be noise.
11. **NEW (FE-8): a criterion phrased "on settings"/"on the page" can be broader than the file list
    PLAN's own task illustration names.** FE-8's PLAN item 3 illustrated criterion 41 with exactly two
    files (`SettingsPage.tsx`, `RiskInputsSection.tsx`), but the criterion's own text ("no confirmation
    **on settings** renders in the direction-reserved colours") reached two MORE files rendered on the
    same page (`AiKeySection.tsx`, `BrokerageSection.tsx`) that PLAN's illustration simply didn't
    enumerate. Before writing an SB test scoped to only the files a task's "Owns" line names, grep the
    WHOLE feature directory for the pattern the criterion actually describes — a narrowly-scoped SB test
    that passes while an un-enumerated sibling file still violates the same plain-English criterion is
    the vacuous-gate failure criterion 69 exists to catch, even if PLAN itself didn't spot the gap.
12. **NEW (FE-9/10): `writeServer`-shaped catch blocks that swallow an error without re-throwing hide
    a caller-observable defect that only a write-then-assert test catches — grep for `catch {` blocks
    that set an error flag but don't propagate, near any handler that also fires an unconditional
    "success" side-effect on the next line.** This exact shape caused FE-8's fixed defect
    (`useSettings.ts`) and is worth a glance in any task touching a save/write flow.

## `EXEMPT` maps (both live-checked on both arms, both empty)

- `shared/theme/fonts.spec.ts` (N-1, two needles): **0 entries**. FE-14 asserts it empty.
- `features/trading/positions/pauseGlyph.spec.ts` (criterion 29): **0 entries**.

Neither map moved this session — FE-8/9/10 touch `features/auth/`, `features/alerts/`,
`pages/alerts/`, all outside N-1's three scanned trees (`features/trading/`, `pages/positions/`,
`pages/scanner/`).

## ⚠️ Still true — another process shares this working tree

`docs/research/convexa-business-review-2026-09-05/` remains untracked and was left alone all session
(confirmed present, unchanged, at both the start and the end of this lane's work). Verify HEAD is on
`spire/curvature-v2-foundations` before and after any work; stop and report if it moves. HEAD at the
end of this session: `81f77222` (`fix(dashboard): FE-10 …`).

## Remaining arc (unchanged from PLAN, for orientation)

FE-11 (quiet band) → FE-12 (D-C: `Widget` frame ⓘ via `AccessibleHelp` promoted to `shared/`, AC-35
extended to all eight `widget-{id}` frame roots, desk specs re-run) → FE-13 (browser/e2e layer;
Playwright `testMatch` allowlist extension — a spec not listed there never runs) → FE-14 (frontend
closer: whole-phase verification, both `EXEMPT` maps asserted empty, full suite + e2e against the
production build) → BE-1 (backend verification only: three-dot `apps/api` diff 0, score/tier/
fingerprint byte-identical) → GATE Q.
