# RESUME — curvature-v2-surfaces frontend lane (FE-2 → FE-5)

**Resume status:** ACTIVE

## Done (all green, all committed — do not re-verify from scratch, but do re-run before trusting)

| Task | Commit | Files |
|---|---|---|
| FE-2 | `be7c067b` | `shared/liveness/liveClaim.spec.ts`, `pages/positions/PositionsPage.tsx` |
| FE-3 | `d905d26a` | `pages/scanner/{ScanCells,ScanTable,ScanCard,ViewEditorDialog,labels}.tsx/.ts`, new `pages/scanner/scanner.register.spec.tsx`, `shared/theme/{fonts,radius-scale}.spec.ts` |
| FE-4 | `356cea52` | `pages/scanner/{Scanner,ScanTable,ScanCard,ScanCells,labels,scanner.risk.spec,scanner.register.spec}` |

All three: `npm run typecheck` exit 0, `npm run lint` exit 0 (0 errors, baseline warnings only),
targeted `npx vitest run src/app/pages/scanner src/app/shared/theme` exit 0 (246/246 at FE-4's
landing). `BUILD_REPORT.md` has one full section per task (measured numbers, poison-run text,
copy-diff tables, what was seen in the running app). Branch: `spire/curvature-v2-foundations`
(no new branch created, nothing pushed).

**Why stopped here, not mid-FE-5:** FE-5 is the largest remaining task (nine owned files, six
`EXEMPT` deletions, two ship-blocking mutation proofs, a keyboard-reachability retrofit, an orders
face re-point that reopens two baseline-flaky spec files) and the session was already deep after
three completed tasks with substantial exploratory reading (PLAN/SPEC/decisions in full, plus a
real debugging detour — see Gotcha 1 below). Starting FE-5 fresh with full budget is safer than
pushing into it here and leaving it half-verified.

## Next concrete step: FE-5 — Positions rows conversion (one commit)

**Owns (PLAN.md, read FE-5's full section before touching anything — currently lines ~568-621 of
`PLAN.md`, may drift if the file is re-saved):**
`features/trading/positions/{PositionRow.tsx,PositionCard.tsx,PositionsView.tsx,labels.ts,LegDisclosure.tsx,PortfolioPanel.tsx,PositionsPanel.tsx,positions.risk.spec.tsx,offlineLayout.spec.tsx,tint.spec.tsx}`
· `features/trading/outcomes/TrackRecordSection.tsx` ·
`features/trading/orders/{OrderRow.tsx,OrderDetailDialog.tsx}` (**face re-point only**) ·
`shared/theme/fonts.spec.ts` (its six `EXEMPT` entries — listed below, already present in the file,
each names `FE-5` as the removing task).

**Criteria:** 23 (SB), 24 (SB), 25 (SB, sim arm), 26, 27a (SB), 27b (SB), 28 (SB), 29 (SB), U-9,
U-15, U-15a (SB), 30, 31, 32, 33, 35, CF-2 (SB).

**Read before building** (all already read once this session, re-read fresh in the new lane):
PLAN.md FE-5 section in full; SPEC.md §2.3 (positions mechanism), §4.3 (positions copy table);
`council/decisions.md` §3 #3 (literal() stays), #13 (six live-derived cells), #17 (the one
inversion); §8 Z-1/Z-2 rulings (both already ruled — Z-1 OUT, Z-2 delete-under-class-1 — do not
re-litigate them, just implement per the ruling). Source: `PositionRow.tsx` in full (it's the
biggest file — read all of it, not just the cited line ranges, since line numbers may have drifted
slightly from the plan's citations — verify with `grep -n` before trusting any PLAN line number).

### The six live-derived cells → the `shared/figure` module (mechanism, from FE-1)
`mark` (`:284-320`), `pl` (`:321-341`), `pl_pct` (`:342-367`), `delta_entry` (`:368-382`),
`session_delta` (`:383-392`), `trend` (`:393-411`) all route through `figureStateOf` + `faceFor`
imported from `@/shared/figure` — same pattern FE-3/FE-4 already proved out on the scanner atoms.
`dim` MUST come from the module's output, never a cell-local `liveDim` (`:200` today).

### What does NOT convert
`literal()` (`PositionRow.tsx:145-153`) and its three per-member tips **stay** — do not route them
through `FigureCell` or the module (it would delete the three distinct tips, and the
non-synonymy criterion would read green while the distinction went invisible). `dashCell` (`:167`)
is deliberately **untestidded** (`:69`) — no new assertion may assume a DOM hook for `—`.

### The `⏸` removal — six sites, one deletion pattern each
Replace the text glyph with `PauseMark` (from `@/shared/figure`, renders MUI's `PauseIcon`) plus
either a retained value or a closed-nine member beside it — never a bare pause marker (criterion 28):
1. `PositionRow.tsx:68` (`'⏸ offline'`)
2. `PositionRow.tsx:378` (`' ⏸'`)
3. `PositionRow.tsx:388` (bare `'⏸'` — today replaces the WHOLE `session_delta` value; it has a
   retained arm available at `ctx.sessionDelta`, `RowContext:119-120` — render the retained value
   dimmed + `PauseMark` + `offline · last known`, never a naked glyph — criterion 27a)
4. `PositionRow.tsx:549` (`Paused — resumes pricing when the live feed returns. ⏸`)
5. `PositionsView.tsx:367` (bare `'⏸'`)
6. `features/trading/positions/labels.ts:57` (`SESSION_DELTA_TIP`, ` (⏸)` inside a frozen tooltip
   **string** — Z-2's ruling: delete the three characters ` (⏸)` under §2.7 class (1), change
   nothing else in that sentence, itemize it in the build report)

`features/trading/orders/OrderRow.tsx:172` (`⏸ offline`) is **Z-1: OUT of scope, carried debt.**
Do not touch it, do not add it to any scan's fixed set.

### The one inversion
`delta_entry` (`PositionRow.tsx:374` `...MONO` + `:377` `DASH`) routes through the shipped
`dashCell` (`:167`, same `DELTA_ENTRY_TIP`) — the word `—` stays byte-identical, only the register
moves Mono → Sans.

### U-15a — keyboard-reachable tips (CONDUCTOR, reversible, already ruled IN)
Use the file's own idiom 300 lines down (`PositionRow.tsx:396-401`: `Tooltip describeChild` +
`aria-describedby` + focusability) on `literal()`'s three tips. Attributes only, zero wording change.

### Face re-point (needle 2) — six `EXEMPT` entries, delete each in the SAME commit as its fix
Already in `shared/theme/fonts.spec.ts` (live-checked on both arms — exists AND still violates):
```
features/trading/positions/PositionRow.tsx        → FE-5, needle-1 sites 70:—, 345:no basis, 495:—
features/trading/positions/PositionCard.tsx        → FE-5, needle-1 sites 69:—, 158:—
features/trading/positions/LegDisclosure.tsx       → FE-5
features/trading/outcomes/TrackRecordSection.tsx   → FE-5
features/trading/orders/OrderRow.tsx               → FE-5 (face only — the ⏸ at :172 is Z-1 debt)
features/trading/orders/OrderDetailDialog.tsx      → FE-5
```
Delete local face bindings, spread `...MONO_FACE` instead, byte-identical render. **`OrderRow.tsx`
is shared with the desk** — the re-point must change zero rendered bytes; re-run
`LiveTape.spec.tsx` and `orders.risk.spec.tsx` as evidence it stayed clean. `orders.risk.spec.tsx`
is one of the baseline's own flaky-under-load files (`act_confirm_live_cross_fill…`,
`cancel_is_terminal…`) — if the full-suite run times it out, re-run it alone and record both
results, exactly like the conductor's own baseline note says.

### Non-synonymy, sim arm (24, 25, 26)
Three different fixtures must reach three different arms against the shipped testids
`cell-unavailable` (`:164`), `cell-not-recorded` (`:166`), `cell-no-basis` (`:348`). Extend
`positions.risk.spec.tsx:851-869` with "the sim book never renders `not provided`"; keep the
existing `:882-887` cell-level `no basis` proof.

### Record fields / faulted / closed rows
U-9: contract, structure line, qty, net entry, max loss, expiry, status never dim, never mark.
Criterion 30: faulted (durable store) is NOT offline — write affordances refused-but-focusable-and-
explained, nothing dims, no pause mark (mirror `FaultedBanner.tsx:92-117`'s attribute set).
Criterion 31: closed/cancelled rows carry neither mark in any connection state.

### Mutation proofs required (both SB, both must be run red then reverted, text captured verbatim)
- **Proof H (criterion 29):** restore `'⏸'` at `PositionRow.tsx:388`. A **new** `?raw` scan (author
  it in this task — not inherited from `fonts.spec.ts`) over
  `features/trading/{positions,broker}/**` + `pages/positions/**` for `/⏸/` must go red naming the
  file. This scan is itself a new deliverable of FE-5 (the enforcement mechanism for criterion 29).
- **Proof I (criterion 27b):** give the bare/no-retained arm the `offline · last known` caption
  instead of a closed-nine member with no last-known words. The 27b test must go red on "last known"
  appearing where nothing was retained.

### Specs this task edits (fixtures/assertions, not new files except where noted)
`positions.risk.spec.tsx` (`:420-424` `'⏸ offline'` query → query the rendered icon, not the
character; extend `:851-869` per the non-synonymy note above), `offlineLayout.spec.tsx:60`,
`tint.spec.tsx:202`, `positions.integration.spec.tsx:497-498,523`.

### Commit
One commit for FE-5 (conventional scope `feat(dashboard):`), `BUILD_REPORT.md` FE-5 section in the
same commit, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Stage only FE-5's
files (never `git add -A`) — `git status --porcelain` should show exactly FE-5's owned files plus
`BUILD_REPORT.md` before committing.

### Verification checklist (mirror FE-2/3/4's pattern in `BUILD_REPORT.md`)
1. `npx vitest run src/app/features/trading src/app/pages/positions` — record files/tests/exit code.
2. `npm run typecheck` — exit 0, recorded separately (force `--skip-nx-cache` on the dashboard
   project once if you did any poison/revert cycles, to rule out a stale cache masking a real error).
3. `npm run lint` — exit 0, compare warning count to baseline (5 warnings at FE-4's landing — see
   `BUILD_REPORT.md` FE-4 §6).
4. Both mutation proofs, red text quoted, then reverted (`git diff --stat` on the touched file = the
   real diff only, zero residual poison).
5. Run the app: `npm run ports:free`, `npm run dev`, sign up a throwaway account (route is behind
   `RequireAuth` — same pattern as `/scanner`; `/positions` also needs seeded position(s), the repo's
   own dev-seed mechanism (`testSeed.ts`, referenced in `PositionsPage.tsx`'s import list) may
   already do this on signup — check `features/trading/positions/testSeed.ts` for
   `seedTestPositionsIfNeeded`), open `/positions` at 1280 and 393. Force an offline drop if
   feasible (kill/observe the SSE) to see the pause-icon treatment live; if not feasible in the time
   available, say so explicitly (FE-4 hit this same limit on scanner and said so rather than
   fabricating a screenshot).

## Gotchas hit this session (don't rediscover them)

1. **A price-merge bug in `Scanner.tsx`'s zero-state lead grouping was found and NOT fixed** (out of
   FE-4's scope, filed as carried debt in `BUILD_REPORT.md` FE-4 §3): `ScanTable` renders from
   `groups[*].rows` (pre-live-merge) instead of the `rows` prop (`displayRows`, post-merge) whenever
   `groups` is present. If FE-5/FE-6/FE-7's positions work ever touches a similar
   grouped-vs-merged-rows split, check for the same class of defect before assuming a live update
   isn't reaching the DOM — verify with `console.log`-driven instrumentation (add, observe, remove
   before committing — confirmed via `git diff` = 0 lines) rather than assuming the test fixture is
   wrong.
2. **jsdom has no global `EventSource`.** Any component that calls `new EventSource(...)` directly
   (not through a stub) will have its `offline`-style flag flip true almost immediately (the
   constructor throws, caught, flag set). If positions' live-derived cells need an "online" fixture,
   stub a controllable class first (`ticker-hierarchy.spec.tsx:24-30`'s `SilentEventSource` idiom, or
   this session's `CapturingEventSource` in `scanner.register.spec.tsx` if you need to fire messages).
3. **Scripted `sed`/heredoc edits risk silently no-op'ing on this repo's CRLF files** — this session
   confirmed the Edit tool is reliable; a `py -3` heredoc attempt hung/backgrounded once for no
   diagnosed reason and was abandoned in favor of the Edit tool. Prefer Edit tool for all source
   changes; grep-verify after any scripted replace if one is ever necessary.
4. **New `EXEMPT` map entries in `fonts.spec.ts` are live-checked on BOTH arms** (exists AND still
   violates) — deleting a task's own entries without actually fixing the violation red-builds by
   design; fixing the violation without deleting the entry ALSO red-builds (the "must still violate"
   check fails). Do both in the same edit pass before running the test.
5. **Debug/scratch files:** this session used throwaway `_tmp_shot*.mjs` Playwright driver scripts
   at the repo root for browser verification (chromium is already installed via the
   `dashboard-e2e`'s Playwright dependency — `npx playwright --version` confirmed 1.62.1 with no
   extra install needed). Delete them before finishing (`rm _tmp_shot*.mjs`) — they must never be
   staged or committed. Screenshots went to the session scratchpad, not the repo.
6. **`npm run ports:free`** was run both before starting `npm run dev` and again before ending the
   session — confirmed both times ("Nothing listening" / "Freed N listener(s)"). Do the same at the
   end of the FE-5 lane's app-verification pass.

## `EXEMPT` map size after FE-2/3/4

12 entries remain (started at 14 after FE-1; FE-3 removed 2). FE-5 removes 6 more (down to 6, all
FE-6/FE-7's remaining entries: `PositionsPage.tsx` for FE-6, five `broker/*.tsx` files for FE-7).
