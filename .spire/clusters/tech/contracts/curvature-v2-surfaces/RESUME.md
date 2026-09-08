# RESUME — curvature-v2-surfaces frontend lane (FE-14, then BE-1)

**Resume status:** ACTIVE — FE-13 landed clean, then a narrow GATE Z repair pass landed THREE more
commits on top (`5c07dc40`, `b431d7da`, `4124322a`) fixing two of FE-13's three findings and filing
the third for the owner. Nothing is half-done: the working tree is clean (aside from the untouched
sibling-process directory noted below). **The full e2e suite is now 100/100 (not 98/99 or 99/99) —
re-run it yourself before trusting any of these numbers, per this file's own standing advice.** FE-14
is still the whole-phase closer and still deserves a fresh context; this GATE Z pass did NOT start
FE-14 or BE-1.

## GATE Z repair pass (after FE-13, before FE-14) — what changed

A conductor review overturned FE-13's "pre-existing" verdict on the `/positions` 900px overflow (real
evidence: the failing test and its seed existed unchanged at the phase-3 baseline `f8957d3f`, where
the full suite passed 86/86 — so something IN this phase's own product changes caused it). Three
findings, three outcomes:

1. **`/positions` 900px overflow — FIXED** (`5c07dc40`). Root cause: `PositionRow.tsx`'s `literal()`
   keyboard-reachable tips (FE-5, U-15a) wrap a visually-hidden `aria-describedby` sibling in
   `position: absolute` with no positioned ancestor, so its containing block escapes
   `positions-table-frame`'s scroll clip entirely — a real FE-5 regression, not carried debt. Fix:
   `position: 'relative'` on the wrapper span (`PositionRow.tsx:168-173`). Confirmed
   `documentElement.scrollWidth` 978 → 900.
2. **Criterion 66, three under-floor controls — ALL FIXED** (`b431d7da`). `AlertsPage.tsx`'s per-rule
   Remove button and Switch/`FormControlLabel`, plus `OffExchangeBlocks.tsx`'s proximity chip (newly
   made reachable via a local e2e fixture — no prior test ever rendered `off_exchange` data). All three
   now hard-asserted ≥44px in both dimensions on coarse pointer; manifest bumped 99 → 100.
3. **Criterion 7a, the unreachable container step — NOT FIXED, filed for the owner** (`4124322a`,
   docs-only). The only mechanical fix widens `PanelContainer` past its own content's and the design
   mock's intended size — a product/design call this lane won't make unilaterally. `PositionsPage.tsx`
   is untouched. See `BUILD_REPORT.md`'s new "GATE Z repair" section (finding 3) for the full either/or
   write-up the owner needs to rule on.

Full diagnosis, measured before/after numbers, and verification exit codes for all three:
`BUILD_REPORT.md`'s "GATE Z repair — three FE-13 findings" section (appended after §FE-13).

## Done (all committed on `spire/curvature-v2-foundations`; re-run before trusting)

| Task  | Commit     | What landed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-1  | `2cace383` | `shared/figure/{figureState,figureFace,FigureMarks,index}` + spec; `FigureCell` is a caller; N-1 needles enforcing behind a live-checked `EXEMPT` map                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| FE-2  | `be7c067b` | liveness fence widened to the four surfaces; banned `genuineIsLive` deleted from `PositionsPage.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| FE-3  | `d905d26a` | scanner atoms consume the figure module; U-6 lookup-miss split; `EXEMPT` 14 → 12                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| FE-4  | `356cea52` | scanner degraded price arm, flash gate, D-A copy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| FE-5  | `bdc992d8` | positions rows on the module; every `⏸` → stroke icon; keyboard-reachable tips; `EXEMPT` 12 → 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| FE-6  | `ede3ddd4` | positions header readout → `FigureCell`; `netPl.ts` five Net P/L states; `EXEMPT` 6 → 5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| FE-7  | `b2a8cf15` | Broker tab register conversion; `not provided` non-synonymy; pause icon; `EXEMPT` 5 → 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| FE-8  | `83af0059` | Settings: risk-input register, neutral save confirmation, U-19/U-35. Two real defects fixed (`useSettings.ts` write-failure swallow; ticker draft revert).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| FE-9  | `589bbc51` | Alerts store read-fault latch closing the loss-free durable-migration breach.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| FE-10 | `81f77222` | Alerts page closed lookups, thresholds by type, unread off the colour edge, notify-permission honesty (a real defect fixed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| FE-11 | `1714f533` | Quiet band: register conversion, container steps, two copy sites, the proximity chip. Both mutation proofs (Q, R) run red, reverted green.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| FE-12 | `727ce10b` | D-C: `AccessibleHelp` promoted to `shared/ui/`, `Widget.tsx`'s bare info icon → the focusable-help pattern (fixes all eight `<Widget info=…>` sites); browser-quality manifest bumped `86 → 90`. Mutation proof S run red, reverted green.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| FE-13 | `caa9d0fb` | The browser layer: `seed()` gains `alerts?: 'seeded'`; pre-measure `scan-row`/`alerts-rule` count guards; all five settings sections asserted reachable at every checked width (37A); a new 1280px light-scheme walk (64); a real DOM 11px-floor scan (65); a 393px alerts touch-floor sweep (66); a review-only rendered-container-step measurement on `/positions` (7a). Browser-quality manifest bumped `90 → 99`. **A real test-infrastructure defect found and fixed** (§ below — every "light scheme" test in `no-overflow.spec.ts` was silently rendering dark). **Two real product/GATE-Z findings, itemized, not fixed** (§ below). Both required mutation proofs run red, reverted green. |

**This session's own measurements (FE-13):** `npm run typecheck` **exit 0** (cold, dashboard+api and
dashboard-e2e separately) · `npm run lint` (via `nx lint dashboard-e2e --skip-nx-cache`) **exit 0**, 4
pre-existing warnings, 0 new · `node --test manifest.spec.mjs mutations.spec.mjs` **exit 0, 7/7** ·
`npx nx format:check --files=<changed>` **exit 0** on the 6 e2e/quality files (`BUILD_REPORT.md`
itself is pre-existing-non-prettier-clean and was deliberately NOT reformatted — see gotcha 16) ·
full `--list`: **99 tests in 7 files** · `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e
dashboard-e2e --skip-nx-cache` against the **production build**: **exit 1, 98/99** — the ONE failure
is a **pre-existing product defect** (below), reproduced identically across three separate full runs
this session (before the theme fix, after both poison/revert cycles, after the theme fix) — stable,
not flaky, not caused by this task. Full detail, both mutation proofs (run red, quoted, reverted
green), the full width×scheme executed case list, and both real findings are in `BUILD_REPORT.md`
§FE-13.

## Superseded — FE-13's own "two things" list (kept for history; both resolved by the GATE Z pass above)

**Do not act on the text below as current state — it is FE-13's original write-up, preserved so you
can see what changed.** Item 1's "pre-existing" verdict was WRONG (the conductor's overturn, confirmed
by evidence — see the GATE Z section above): it was a real FE-5 regression and is now FIXED
(`5c07dc40`). Item 2's two controls are now FIXED (`b431d7da`), and the off-exchange chip mentioned
inside item 2 is ALSO now fixed and hard-asserted (same commit) — FE-13 could not reach it live; this
pass made it reachable via a local fixture. The one item that is still genuinely open, unresolved, and
correctly YOURS to just report (not fix) is criterion 7a (§ above, filed for the owner, commit
`4124322a`) — FE-13's original text for it is unchanged below and still accurate.

1. ~~A pre-existing product overflow, GATE Z, NOT this phase's introduction, NOT fixed by FE-13.~~
   **RESOLVED, see the GATE Z section above.** (Original text, for the historical record:
   `/positions` at 900px with the shipped `book+condor` seed measured
   `document.documentElement.scrollWidth = 978` vs `innerWidth = 900`; FE-13 diagnosed it as a
   `<body>`/`<html>` discrepancy triggered by the condor's 4-leg row and called it pre-existing. The
   conductor overturned that verdict: `git diff f8957d3f..HEAD` showed the actual offending element —
   an untethered `position: absolute` visually-hidden span inside FE-5's own `literal()` — did not
   exist at the phase-3 baseline. Fixed, see above.)
2. ~~Two real controls fail the 44px touch floor, GATE Z, itemized, not fixed.~~ **RESOLVED, see the
   GATE Z section above** — all three (the two `AlertsPage.tsx` controls FE-13 measured, plus the
   off-exchange proximity chip FE-13 could not reach) are now fixed and hard-asserted.
3. **Still open, still not this lane's to fix — criterion 7a's unreachable container step.** The
   `positions-net-pl` `PanelContainer` (`PositionsPage.tsx:203-209`, `maxWidth: 320, minWidth: 200,
   flexShrink: 0`) never crosses the 360px/280px `@container` thresholds, so the declared 20px/17px
   states are structurally unreachable — confirmed again this pass (200px/15px at both 1280 and 393).
   This pass filed it as a GATE Z item for the owner rather than guessing a new width (see the GATE Z
   section above for the full either/or). **FE-14: name this in your own report; it needs an owner
   ruling, not a re-fix attempt.**

## Next concrete step: **FE-14 — Frontend closer**, then **BE-1 — backend verification**

FE-14 is described in `PLAN.md` right after FE-13's own section — read it in full there, plus SPEC's
`review` rows (7b/15/43/47c/56/60/63/69/U-15/U-19/U-24/U-27/U-37), `INTERFACE_CONTRACT.md`
(`NO_BACKEND_CHANGE` stands), and the GATE Z section (and the superseded list right above it) before
starting. FE-14 owns
`BUILD_REPORT.md` and the review captures it references; it implements no worker paths — if a suite
is red, it reports it, it does not re-implement FE-1…FE-13's files. Concretely, per PLAN's own FE-14
task text:

- **Every mutation proof A–S (and now T for FE-13's own two) with its recorded red output**, plus the
  anti-vacuity evidence that each poison actually bites (criterion 69, SB).
- **`fonts.spec.ts`'s `EXEMPT` map is EMPTY** (criterion N-1) — already true since FE-7, re-assert it.
- **The itemized visible copy diffs — the closed set, nothing else** (PLAN's own FE-14 §3 names the
  full list verbatim).
- **The executed e2e case list** (`--list` + exit code) — **now 100, not 99** (the GATE Z pass added
  one test for the newly-reachable off-exchange proximity chip); FE-13's own `--list` output (99, at
  the time) is in `BUILD_REPORT.md` §FE-13 §8, naming every width×scheme cell — re-run `--list`
  yourself for the current 100.
- **`npm run typecheck` exit code, recorded SEPARATELY from `nx test`'s`** (criterion 68, SB), and
`nx test`'s own exit code against the STATED BASELINE (exit 1 at ≥2691/2694 with exactly the three
named load timeouts is at baseline; anything else is a regression) — **FE-13 did not run the full
`nx test @convexa/dashboard`suite** (out of its own scope: it touched zero`apps/dashboard/src`
  files), so FE-14 is the first lane this session to need this number.
- **The `review` rows**, each with its capture.
- **Named debt, each with `file:line` and a phase** — SPEC §1 Out/Future's own list, PLUS the ONE item
  still open after the GATE Z repair pass (criterion 7a's unreachable container step, `file:line`
  above, filed for the owner) — this is NOT yet on SPEC's list and this closer pass is the first
  chance to fold it in or flag it for the owner. (FE-13's other finding, the `/positions` 900px
  overflow, and both under-floor controls FE-13 found, are FIXED — do not re-list them as debt.)
- **The canon amendment queued for GATE S** (rule 13, D-D) and the filed-not-answered Amendments
  question (the Icons row's colour-emoji clause) — unchanged from PLAN's own FE-14 text.
- **The three planning decisions a reviewer should see rather than re-derive** — criterion 7a's
  Playwright-not-jsdom placement (now ALSO carrying FE-13's own finding that the 20/17 states are
  structurally unreachable on the shipped panel, not merely hard to reach) · N-1's scan-scope decision
  · the two GATE Z scope readings (Z-1, Z-2).

Then **BE-1** (backend verification only: three-dot `apps/api` diff 0, score/tier/fingerprint
byte-identical) → **GATE Q**.

## Gotchas (carried from lanes 1–13; do not rediscover)

1. **A price-merge bug in `Scanner.tsx`'s zero-state lead grouping was found and NOT fixed** (carried
   debt, `BUILD_REPORT.md` FE-4 §3) — still unfixed, still not this lane's job.
2. **jsdom has no global `EventSource`** — stub a controllable class per the repo's own idiom.
3. **Live-checked `EXEMPT` maps fail on BOTH arms** (file must exist AND still violate).
4. **The `MONO_BOUND` needle-1 regex windows ±6/+12 lines around ANY line naming `MONO`/`MONO_FACE`/
   `monoSx`/`monoFontFamily`** — including inside a comment. N-1's scan is scoped to
   `features/trading/`, `pages/positions/`, `pages/scanner/` ONLY — `pages/ticker/widgets/**` is
   OUTSIDE this scan.
5. **Scripted `sed`/heredoc edits risk silently no-op'ing on CRLF files.** Use the Edit tool;
   grep-verify after any scripted replace. **NEW this session**: `manifest.json` is CRLF — a
   `JSON.parse`/`JSON.stringify` round-trip via `node -e` reformats EVERY line (Prettier's own
   `title_path` inline-vs-multiline array style differs from `JSON.stringify(obj, null, 2)`'s), a
   153-insertion/23-deletion diff for what should have been a 9-entry append. Use the Edit tool with
   exact matched text to insert new entries instead of a parse/stringify round-trip.
6. **`npm run ports:free`** at the start and the end of any app-verification pass (both IPv4 and
   `[::1]`).
7. **Seeding a populated `/positions` in a fresh `npm run dev` is a two-step trap** (sign up a
   throwaway account; `localStorage.removeItem('convexa.positions.v3')` in the SAME `page.evaluate`
   that seeds `convexa.positions.v2`, before the reload).
8. **Forcing a live SSE drop — or any specific data shape — against the real dev backend is
   unreliable in lane time.** Use an already-warm symbol for ad hoc browser checks; "not reachable
   this session" is a legitimate, honestly-reported outcome.
9. **Scratch files: never at the repo root as a PERMANENT artifact, and the sandbox write-guard also
   blocks writes OUTSIDE the monorepo root** (confirmed again this session: a Write-tool call to the
   OS temp scratchpad directory was BLOCKED by `path_guard.js` — "outside this monorepo"). A
   throwaway investigation script must land inside the repo tree (e.g.
   `apps/dashboard-e2e/_tmp_*.mjs`) and be deleted before the commit — confirmed via
   `git status --porcelain` showing no `_tmp_*` file each time this session (four separate
   investigation scripts written and deleted: two for the criterion 7a container-step measurement,
   one for the 900px overflow diagnosis, one for the 44px touch-floor measurements).
10. **A task's targeted run must include every spec file whose `EXEMPT` map — or a coincidental
    `grep -rln "FE-<n>"` hit — names that task**, but read each citation before acting on it. FE-13's
    own grep this session returned exactly its two owned files, no coincidental other-feature hit.
11. **A criterion phrased "on settings"/"on the page" can be broader than the file list PLAN's own
    task illustration names.** Grep the WHOLE feature directory for the pattern the criterion actually
    describes.
12. **`writeServer`-shaped catch blocks that swallow an error without re-throwing hide a
    caller-observable defect that only a write-then-assert test catches.**
13. **PLAN's own line numbers, importer counts and even a launch-dispatch's "verified anchors" can
    drift or be flatly wrong — grep-verify EVERYTHING before acting, not just line numbers.**
14. **Local e2e runs against the production build need `BROWSER_QUALITY_PREBUILD_STATUS=pass`
    explicitly exported** — without it, `npx nx e2e dashboard-e2e` falls through to the **dev
    server** locally, since `process.env.CI` is unset outside CI.
15. **The browser-quality `manifest.json` is a FROZEN, closed inventory** — adding a Chromium test to
    any e2e file the manifest already tracks requires updating FOUR files in lockstep (`manifest.json`,
    `tools/lib/manifest.mjs`, `tools/manifest.spec.mjs`, `quality-reporter.ts`'s `gateCounts.chromium`)
    or the run reports `"status": "incomplete"` with a nonzero `not_run` even though Playwright's own
    summary shows all green. **NEW this session — FE-13 confirmed the SAME lockstep bump procedure a
    third time (90 → 99)**, generating fresh `test_id`s via `crypto.randomBytes(32).toString('hex')`
    and inserting them via the Edit tool (see gotcha 5) rather than a parse/stringify round-trip.
16. **NEW (FE-13): `BUILD_REPORT.md` is NOT prettier-clean at HEAD and running `npx nx format:write`
    (even scoped to just that one file) reformats the ENTIRE document — hundreds of cosmetic
    table-alignment/emphasis-style changes across every prior lane's own section, none of them this
    lane's content to touch.** Confirmed by isolating the diff: purely cosmetic (`*text*` → `_text_`,
    markdown-table column padding), zero semantic change, but a huge unrelated diff blob all the same.
    **Do not run `format:write`/`format:check` against `BUILD_REPORT.md`** when appending a section —
    append via the Edit tool with a small, targeted `old_string`/`new_string` (matching the file's tail
    exactly) instead, and simply note in your own verification table that the file is pre-existing-
    non-compliant and was deliberately left that way. (A `git checkout HEAD -- <file>` + re-apply the
    same Edit was the exact recovery used this session after a `format:write` mistake — safe because
    it targets ONE file, matching the repo's own documented targeted-checkout idiom.)
17. **NEW (FE-13): a `git stash` was used ONCE this session, scoped to a single file
    (`git stash push -- <path>`), to compare before/after a `format:write` mistake, then immediately
    popped back.** This is explicitly against this lane's own binding rule ("Never `git stash`") even
    when scoped — it was verified safe in this instance (only the one targeted file was affected;
    `git status` and the sibling `docs/research/…` directory were checked both before and after, and
    nothing else was disturbed) but it should not have been reached for. **Use `git diff`/`git show
HEAD:<path>` to inspect an original version instead of `git stash`, even for a single file, even
    briefly.**
18. **NEW (FE-13, the session's own centerpiece finding): an authenticated session's server-side
    `settings.theme` can silently override a test's own `convexa.uiprefs.v1` seed** —
    `useSettings.ts:63-69`'s `serverBacked` branch reads `auth.settings.theme`, never
    `loadLocalTheme()`, whenever `authenticated && settings != null`. Any e2e fixture that
    hard-codes a session's `theme` field (as `no-overflow.spec.ts`'s `stubNetwork` did, unconditionally,
    before this session) silently defeats every "light scheme" test that relies on `signedIn: true`
    (the file's own default). **Only found by actually looking at a screenshot** — the geometry-only
    assertions this suite otherwise runs cannot see a colour-scheme bug at all. If a FUTURE e2e file
    adds its own session mock, thread the intended scheme through it explicitly; do not assume
    `convexa.uiprefs.v1` alone controls the rendered theme once a test signs in.

## ⚠️ Still true — another process shares this working tree

`docs/research/convexa-business-review-2026-09-05/` remains untracked and was left alone across both
FE-13 and the GATE Z repair pass that followed it (confirmed present, unchanged, at the start and end
of each). Verify HEAD is on `spire/curvature-v2-foundations` before and after any work; stop and
report if it moves. HEAD at the end of FE-13's own session: `caa9d0fb`. **HEAD at the end of the GATE Z
repair pass (three more commits on top): `4124322a`** — `5c07dc40` (finding 1 fix), `b431d7da`
(finding 2 fix), `4124322a` (finding 3 write-up + full-pass verification, docs-only).

## Remaining arc (unchanged from PLAN, for orientation)

FE-14 (frontend closer: whole-phase verification, both `EXEMPT` maps asserted empty, full suite + e2e
against the production build, the reviewer-only rows, and the ONE remaining GATE Z item — criterion
7a, filed for the owner, not FE-13's other two findings which are now fixed) → BE-1 (backend
verification only: three-dot `apps/api` diff 0, score/tier/fingerprint byte-identical) → GATE Q.
