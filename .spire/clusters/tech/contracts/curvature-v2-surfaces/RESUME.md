# RESUME — curvature-v2-surfaces frontend lane (FE-6 → FE-10)

**Resume status:** ACTIVE

## Done (all green, all committed — do not re-verify from scratch, but do re-run before trusting)

| Task | Commit | Files |
|---|---|---|
| FE-2 | `be7c067b` | `shared/liveness/liveClaim.spec.ts`, `pages/positions/PositionsPage.tsx` |
| FE-3 | `d905d26a` | `pages/scanner/{ScanCells,ScanTable,ScanCard,ViewEditorDialog,labels}.tsx/.ts`, new `pages/scanner/scanner.register.spec.tsx`, `shared/theme/{fonts,radius-scale}.spec.ts` |
| FE-4 | `356cea52` | `pages/scanner/{Scanner,ScanTable,ScanCard,ScanCells,labels,scanner.risk.spec,scanner.register.spec}` |
| FE-5 | `bdc992d8` | `features/trading/positions/{PositionRow,PositionCard,PositionsView,labels,LegDisclosure}`, new `positions/pauseGlyph.spec.ts`, `features/trading/outcomes/TrackRecordSection.tsx`, `features/trading/orders/{OrderRow,OrderDetailDialog}` (face only), `shared/theme/fonts.spec.ts`, `positions.risk.spec.tsx`, `offlineLayout.spec.tsx`, `tint.spec.tsx`, `pages/positions/positions.integration.spec.tsx` |

All four: `npm run typecheck` exit 0, `npm run lint` exit 0 (0 errors, 5 warnings — all
pre-existing, 0 new). FE-5's targeted run: `npx nx test @convexa/dashboard --skip-nx-cache --
src/app/features/trading/positions src/app/pages/positions src/app/shared/theme
src/app/shared/figure` → 52 files / 650 tests, exit 0. Full suite
(`npx nx test @convexa/dashboard --skip-nx-cache`, no path filter) → **234/234 files, 2782/2782
tests, exit 0** on a clean second run (the first run hit an Nx-flagged **flaky** worker crash — no
named assertion failed, one worker fork died — the same infra-flake class the baseline's own three
load-timeout files already document; re-run confirmed clean). `BUILD_REPORT.md` has one full
section per task. Branch: `spire/curvature-v2-foundations` (no new branch created, nothing
pushed).

**Why stopped here, not mid-FE-6:** FE-5 landed clean and the session was already deep (reading five
council/plan/spec sections in full, building six source files' worth of a new mechanism, tracing and
fixing three needle-1 false positives, and a real browser-verification detour that needed a
localStorage-seeding fix before it produced evidence — see Gotcha 7). Starting FE-6 fresh with full
budget is safer than pushing into the header-readout task half-verified.

## Next concrete step: FE-6 — The positions header readout (`FigureCell`, five Net P/L states, the rendered container step)

**Owns (PLAN.md, read FE-6's full section before touching anything — currently lines ~638-679 of
`PLAN.md`, may drift if the file is re-saved):**
`pages/positions/PositionsPage.tsx` · new `pages/positions/netPl.ts` + `netPl.spec.ts` ·
`pages/positions/positions-page.spec.tsx` · `shared/theme/fonts.spec.ts` (its **one** remaining
EXEMPT entry, `pages/positions/PositionsPage.tsx`).

**Depends on:** FE-1 (done, `shared/figure` module ships `figureStateOf`/`FigureCell` is already
re-pointed to it), FE-2 (done, `PositionsPage.tsx:31,88` already reads `isDeliveringLive` — do not
re-touch those two lines). **Independent: no** — FE-2 already edited this same file; re-read it
fresh rather than trusting the FE-2 section's line citations, which will have drifted after FE-6's
own edits land on top.

**Criteria:** 35a (SB), 35b (SB), 35c, 35d, 35e (SB), 7a, 7b, 8, 23 (SB, header only — the sim-book
half of 23 is FE-5's, already shipped).

**Read before building:** PLAN.md FE-6 section in full (verify every cited line number with `grep -n`
first — the gotcha below is not hypothetical, it already cost FE-5 real time); SPEC.md §2.2's last
block (the offline caption precedence) and §4.3 (positions copy — the Net P/L five-state table);
`council/decisions.md` §3 #23 (the full 35a-35e ruling with the shipped defect it closes: `+$0` green
on a fully-unmarked book) and §2.4's container-step hazard section (`PanelContainer`, why
`containerName` on a widget's own grid never fires). Source: `PositionsPage.tsx` in full (small file,
read all of it) — its current `:177-195` (FE-1's citation) or wherever the header readout block has
drifted to; `FigureCell.tsx` for the exact props it takes (`value`, `register`, `caption`, `offline`,
`live`) since FE-6 renders THROUGH it (not through `figureStateOf` directly, unlike FE-5's cells) —
this is the phase's only remaining `FigureCell` conversion outside the ticker desk.

### The shape (from PLAN, restated)
1. Pure `netPlStateOf({ views, streamOffline, retainedTotal }) → { value, register, caption, tint,
   offline }`, over the same set the sum already walks. Five arms: no open rows → `—`/F7/no
   tint/caller's basis line (**closes the shipped `+$0` green defect** — verify this defect is still
   present before claiming the fix, the same way every lane in this phase re-verifies a cited defect
   rather than trusting the citation); open+none marked → `unavailable`/F8/no tint/caption `0 of {m}
   open marked`; some marked → the sum/Mono/direction permitted/caption `{n} of {m} open marked`
   (**mandatory** whenever some-but-not-all are marked); all marked → total/no caption; stream drop →
   F4 or F5, **offline caption overrides the coverage caption** (this is the primitive's own shipped
   precedence at `FigureCell.tsx:253,262,271` — not a new rule FE-6 invents).
2. Render through `FigureCell` itself (the header readout is the ONE positions surface that uses the
   card, per SPEC §2.3 — everywhere else stays FE-5's module-only route). Delete the hand-bound mono
   face and the bare `opacity: 0.5` this absorbs, and delete the file's one remaining `fonts.spec.ts`
   EXEMPT entry in the same commit (live-checked — same "must still violate before you delete" trap
   FE-5 hit repeatedly, see Gotcha 3 below).
3. Wrap the readout in `PanelContainer` (`shared/ui/PanelContainer.tsx`) — without a named ancestor
   the container-query step never fires at any viewport, with a fully green build. No second
   container name anywhere. The RENDERED proof (does it actually step at a narrow container width) is
   FE-13's job, not FE-6's — jsdom cannot evaluate a container query; FE-6's own test only asserts a
   `PanelContainer` ancestor exists and no second name does.
4. 7b — name the off-ladder sites in the build report (scanner's `fontSize: 'inherit'`, the two
   quiet-band 12px list rows, positions' own `0.86rem` cells) with their reason; these are NOT bugs,
   they're intentional and already correct — 7b is a documentation criterion, not a code change.

### Two mutation proofs required (both SB)
**Proof J (35b):** make the unmarked-book arm return `0` instead of `unavailable` — the 35b test must
go red on a number AND on a direction colour appearing. **Proof K (35e):** let the coverage caption
win over the offline caption during a drop — the 35e test must go red on `{n} of {m} open marked`
appearing where the offline caption should have overridden it. Both: run red, capture the exact
assertion text, revert, confirm `git diff` on the touched file is the real diff only.

### Verification checklist (mirror FE-5's pattern in `BUILD_REPORT.md`)
1. `npx vitest run src/app/pages/positions` — record files/tests/exit code.
2. `npm run typecheck` — exit 0, recorded separately.
3. `npm run lint` — exit 0, compare warning count to FE-5's landing (5 warnings, all pre-existing —
   see `BUILD_REPORT.md` FE-5 §6).
4. Both mutation proofs, red text quoted, then reverted.
5. Run the app: `npm run ports:free`, `npm run dev`, sign up a throwaway account, seed at least one
   OPEN and one MARKED position (see Gotcha 7 — the dev-seed account only auto-populates when the
   backend advertises `SEED_TEST_ACCOUNT`, which a fresh local `npm run dev` does NOT; seed
   `localStorage['convexa.positions.v2']` directly instead, shape below), open `/positions` at 1280
   and 393, and specifically look at the header readout in each reachable state (no rows / some
   marked / all marked). Force an offline drop if feasible to see F4/F5 on the header; if not
   reachable in the time available, say so explicitly and point to the automated 35e test — FE-5's own
   session tried this for 20+ minutes against the real dev backend and could not get `offline-banner`
   to flip within 60s via a blocked SSE route; do not burn the same budget twice without a new idea.

## Gotchas hit this session (don't rediscover them)

1. **A price-merge bug in `Scanner.tsx`'s zero-state lead grouping was found and NOT fixed** (out of
   scope, filed as carried debt in `BUILD_REPORT.md` FE-4 §3) — `ScanTable` renders from
   `groups[*].rows` instead of the `rows` prop whenever `groups` is present. Still unfixed; still not
   this lane's job unless a task explicitly owns it.
2. **jsdom has no global `EventSource`.** Stub a controllable class (`ticker-hierarchy.spec.tsx:24-30`'s
   `SilentEventSource`, or FE-3/4's `CapturingEventSource`) — never assume `new EventSource(...)`
   degrades gracefully in a test.
3. **`fonts.spec.ts`'s `EXEMPT` map is live-checked on BOTH arms** (file must exist AND still
   violate) — fixing the violation without deleting your task's entry ALSO red-builds ("must still
   violate" fails). Do both edits in the same pass. FE-6 has exactly **one** entry left to delete
   (`pages/positions/PositionsPage.tsx`) — do not touch the other five (FE-7's).
4. **The `MONO_BOUND` needle-1 regex windows ±6/+12 lines around ANY line naming
   `MONO`/`MONO_FACE`/`monoSx`/`monoFontFamily` — including inside a comment.** FE-5 lost real time to
   this twice: a doc-comment mentioning `` `no basis` `` or `` `—` `` in backticks near an unrelated
   mono-styled line read as "a closed-nine member inside a mono run" to the raw-text scan. If FE-6's
   own edit to `PositionsPage.tsx` introduces a new `MONO_FACE` usage (it will, absorbing `:185`'s
   hand-bound face) and the scan complains about an unrelated nearby literal, the fix is almost always
   rewording a comment (drop the backticks) or naming a fallback string as a constant — never restyle
   the actual render to dodge a heuristic.
5. **Scripted `sed`/heredoc edits risk silently no-op'ing on this repo's CRLF files.** Use the Edit
   tool for all source changes; grep-verify after any scripted replace if one is ever unavoidable.
6. **`npm run ports:free`** at both the start and the end of any app-verification pass — confirmed
   both times this session ("all clear" / "Freed N listener(s)").
7. **Seeding a populated `/positions` in a fresh `npm run dev` is a two-step trap.** The demo account
   (`demo@convexa.io` / `convexa-test-2026`, from `testSeed.ts`) only auto-populates when the backend
   reports `demoSeed` active (`SEED_TEST_ACCOUNT` env var) — a bare `npm run dev` does NOT set this,
   so logging in with those credentials fails with "those credentials didn't match" (no such account
   exists yet). Sign UP a throwaway account instead. **Then**, merely visiting `/positions` once
   already triggers the store's mount-time read, which — finding no `convexa.positions.v3` — runs the
   (empty) union and WRITES an empty v3 blob. Because "once v3 exists, no source is read again, for
   any reason" (the store's own anti-resurrection rule), seeding `convexa.positions.v2` AFTER that
   point and reloading does nothing. Fix: `localStorage.removeItem('convexa.positions.v3')` in the
   SAME `page.evaluate` call that sets `convexa.positions.v2`, before the reload. The v2 shape is an
   OBJECT, not a bare array — `{ schema_version: 2, positions: { [id]: PositionRecord, ... },
   decisions: [] }` (`readLogicalSource`'s `recordsOf: (b) => b.positions` in `store.ts` expects a
   map, and `Object.values` unwraps it) — a bare array of records silently reads as zero
   (`source_counts` reports `read:0` with no error, no throw, just an empty book). Confirmed working
   this session against the real dev backend with `testSeed.ts`'s own `SEED_POSITIONS` shape (a legacy
   flat `Position` record, e.g. `{ id, ticker, expiration, strike, right, side, qty, entry_mark,
   entry_basis, entry_mode, entry_time, status: 'open', schema_version: 2 }`).
8. **Forcing a live SSE drop against the real dev backend is unreliable in the time this lane has.**
   `page.route('**/api/stream/**', r => r.abort())` + reload did not flip `offline-banner` within 60s
   in FE-5's session (same limitation FE-3/4's own `BUILD_REPORT.md` section records). The automated
   `EventSource`-stub tests are the reliable coverage for every offline arm; the browser pass is for
   the reachable states (empty/populated/wall) and should say so explicitly rather than burning
   another 20 minutes on the same approach.
9. **Debug/scratch files:** throwaway Playwright driver scripts (`_tmp_*.mjs`) at the repo root —
   chromium is pre-installed via `dashboard-e2e`'s Playwright dependency, no extra install needed.
   Delete them before finishing; screenshots go to the session scratchpad, never the repo.

## `EXEMPT` map size after FE-2/3/4/5

**6 entries remain** (started at 14 after FE-1; FE-3 removed 2 → 12; FE-5 removed 6 → 6). All six
remaining are FE-6's one (`pages/positions/PositionsPage.tsx`) and FE-7's five
(`features/trading/broker/{BrokerPositionRow,BrokerPositionCard,BrokerGroupHeader,ProvenanceHeader,
reassess}.tsx`). FE-6 should land the map at **5**; FE-14 asserts it **empty**.

## After FE-6: the remaining arc (unchanged from PLAN, restated for orientation only)

FE-7 (Broker tab register + `not provided` non-synonymy, read-only) → FE-8 (settings) → FE-9/FE-10
(alerts) → FE-11 (quiet band) → FE-12 (D-C's shared-frame change) → FE-13 (the browser/e2e layer,
Playwright `testMatch` allowlist extension) → FE-14 (frontend closer: whole-phase verification,
asserts the `EXEMPT` map empty). Each of these is a **separate lane** per the conductor's own
sequencing note in `decisions.md` §8 — do not start FE-7+ from this resume; write a fresh RESUME.md
when FE-6 lands.
