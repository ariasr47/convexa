# outcome-ledger — QA_REPORT (GATE Q)

> QA session: fresh, independent of the FE builder. Verified by running the project the standard way
> (`npx nx test dashboard`, `npx nx lint dashboard`, `npx tsc -b apps/dashboard/tsconfig.app.json
> --force`), by reading the shipped source against every contract, and by reading the tests that back
> each `test:`-marked case rather than trusting their names. **No code, no contract, no test was
> edited by this QA pass.**

## Scope confirmation (read before the AC table)

- **This feature is FRONTEND-ONLY (`NO_BACKEND_CHANGE`).** Verified independently:
  `git diff --stat a0aa009..HEAD -- apps/api` is **empty**. No `apps/api` file appears anywhere in the
  33-file, 9277-insertion diff for this feature. This is not cosmetic — it **is** the structural
  no-auto-tuning guarantee (`[additive-keeps-score-byte-identical]`, `[score-change-is-deliberate-and-
  measured]`): a statistic that never leaves the browser cannot reach `signals.py`.
- **`interface_conformance.py` (system-1) does not apply** — this feature consumes no endpoint; there is
  no live backend surface to check a promised field against. Its absence from this report is correct,
  per `INTERFACE_CONTRACT.md`'s own explicit verdict, not a gap.
- **No real-browser click-through was possible in this environment** (no browser tooling; Playwright not
  installed; e2e project is Cypress). Verified instead: `npx nx serve dashboard` was not separately
  re-verified by this QA pass beyond what the FE lane already established (a passing prod-shape build via
  `tsc -b --force` and a green `nx test`/`nx lint`); any AC that would require actually clicking through a
  running browser is marked `UNVERIFIABLE` below with the reason, per the honesty-gap instruction — this
  affects zero ACs in practice, because every AC in this feature is exercised by Testing-Library-driven
  component/integration tests that render real DOM and fire real events (jsdom), which is the available
  substitute.

## Gates run

| Gate | Command | Result |
|---|---|---|
| Test suite | `npx nx test dashboard` | **804/804 passed, 69 test files** — matches the claimed number exactly |
| Typecheck | `npx tsc -b apps/dashboard/tsconfig.app.json --force` | **Clean, zero errors** |
| Lint | `npx nx lint dashboard` | **0 errors, 41 warnings** — all 41 are pre-existing `no-non-null-assertion` warnings outside `outcomes/` (one is inside `ledger.spec.ts`, itself a warning not an error); `@nx/enforce-module-boundaries` raised nothing |
| `apps/api` diff | `git diff --stat a0aa009..HEAD -- apps/api` | **Empty** — confirmed independently |
| `@org/dashboard:typecheck` (project-level) | not run | Per the launch brief, this target is **pre-existing broken** (~960 errors, a `tsconfig.spec.json` gap) and explicitly **not this feature's regression** — not re-litigated here |

## Invariant / structural checks (beyond the AC sweep)

1. **`[additive-keeps-score-byte-identical]` — ledger is a one-way leaf, zero write functions, off the AI
   prompt.** Verified in `boundaries.spec.ts`: an enumerated forbidden-importer list (11 modules, read as
   `?raw` source text) is scanned for any `from '...outcomes'` or `import('...outcomes')`; the ledger
   module's exported functions are scanned for `set/put/save/write/append/delete/remove/clear` name
   prefixes and the ledger + `sources.ts` source text is scanned for `localStorage.setItem` /
   `appendDecision` / `resolveDurable` etc.; the AI-rec panel + persona template are scanned for
   `outcomes`/`TrackRecord`/`computeLedgerRead`/`hit_rate`. **The scan demonstrably bites**: I confirmed
   the file contains a dedicated self-test (`'the guard BITES — it fails on a new via literal and on a
   new close path'`) that mutates real source and asserts the detection regex actually flags the
   mutation, rather than merely existing. This is not a scan that can only pass — verified, not assumed.
2. **NO AUTO-TUNING (4 boundaries).** All four re-verified structurally: (1) empty `apps/api` diff
   (above); (2) one-way-leaf source scan (above); (3) `ledger.ts` read end-to-end — zero write functions,
   confirmed by reading the file in full; (4) AI-rec panel / persona template scanned for any reference to
   the outcomes surface — none found.
3. **`[loss-free-durable-migration]` — never-delete, promote-forward, idempotent, never-throw.** Read
   `archive.ts` in full: `importArchive` reads sources first and **declines before any write** if any
   store failed to read (`store_unreadable`) — this is exactly what prevents the store APIs from silently
   rewriting (and thereby destroying) an unreadable blob. Merge logic is keep-existing-on-conflict via a
   `stable()` key-order-independent equality check, never overwrite. `parseArchive` never writes. Verified
   against tests: `archive.spec.ts` and `track-record.flow.spec.tsx`'s `AC-E15 class B` test asserts the
   corrupt blob (`'{ this is not json'`) is **byte-identical** in `localStorage` after a declined import
   attempt (`expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(corrupt)`), and the `AC-E5` test asserts
   the same for the plain read path. The harvest (`sources.ts`) is read-only by construction — it reads
   raw blobs directly rather than through `resolveDurable` (which promotes-forward, i.e. writes),
   specifically to avoid mutating a corrupt blob while reading it.
4. **`[model-read-carries-its-assumptions]`.** The `Cohort` type (`types.ts`) is a discriminated union:
   `building` carries no rate field at all; `computed` carries rate + interval + n + mean + stdev + window
   + basis as non-optional siblings. This is a TypeScript-level structural guarantee, not a runtime check
   — a UI cannot compile code that reads `hit_rate` off a `building` cohort. Confirmed by reading
   `types.ts` and `ledger.ts`'s `cohortFor`.
5. **AC-E3 — the 3-for-3 trap.** Read the test directly (`track-record.flow.spec.tsx:85-100` and the
   parallel `ledger.spec.ts` case): a 3-winner-of-3 cell is asserted to render `'Building history — 3 of
   20 closed trades'` and **not** contain `'100%'` or `'3 of 3 won'`, **and** not match
   `/plausibly|avg |±|quoted fills only/`, **and** `cell.querySelector('[role="progressbar"]')` is null.
   No meter anywhere in the `building` cell (checked directly, not inferred). No dollar figures anywhere
   in rendered copy (`RENDERED_COPY` scan in `boundaries.spec.ts` — `$` absent; `expectancy` appears only
   inside `TR_RETURN_DEF`'s own disclaimer). Cell Ns are never summed — checked via a regex scan for
   `totalN`/`sumOfCells`/a `.reduce` over cell Ns, and structurally: `attributed` is computed from the
   outcome population (a `Set` of keys per outcome), never by summing bucket lengths — verified by reading
   `buildFamily` in `ledger.ts` and by the dedicated fixture (`one outcome firing THREE setups ⇒
   attributed is 1, not 3`) in `ledger.spec.ts`.
6. **AC-14 / AC-E17 — no semantic tint, no dimming on stream drop.** Read `TrackRecordSection.tsx` in
   full: it takes exactly one prop (`personaLabel`) — no `live`/`isLive`/`streamOffline`/`offline`/`data`.
   Confirmed in `PositionsPage.tsx` that `<TrackRecordSection personaLabel={personaLabelOf} />` passes
   nothing else, while the **adjacent** Net P/L header (lines 187-188, same file) does contain exactly the
   two forbidden patterns the contract warned about (`color: netPl >= 0 ? 'success.main' : 'error.main'`
   and `opacity: streamOffline ? 0.5 : 1`) — confirming the trap is real in this codebase and that the new
   surface did not inherit it. Crucially, I checked for the exact "vacuous assertion" failure mode the
   launch brief warned about (MUI `sx` compiles to classes; `getAttribute('style')` is always empty in
   jsdom) — **the tests avoid it**: AC-14's test (`track-record.flow.spec.tsx:142`) compares
   `winner.className` to `loser.className` for a 90%-hit cell vs a 10%-hit cell (an assertion that CAN
   fail — different `sx` colors produce different emotion class names even though `getAttribute('style')`
   would not show it), and separately asserts no `<svg>` is present (no arrow/check/gauge icon). AC-E17's
   test (`positions-page.spec.tsx`, new `AC-E17 — a REAL stream drop…` case) drives an actual `EventSource`
   message + a fake-timer gap-watchdog trip, asserts the **live** Net P/L header's `className` DOES change
   (`expect(netPl.className).not.toBe(netPlClassBefore)`), and asserts the **static** track-record
   section's `innerHTML` is **byte-identical** before/after (`expect(section.innerHTML).toBe
   (trackRecordBefore)`). This is a real, non-vacuous, real-DOM-diff test of exactly the failure mode
   flagged as a prior catch elsewhere in this pipeline. `boundaries.spec.ts` additionally source-scans the
   rendered UI for `success.main`/`error.main`/`warning.main`/red/green literals,
   `ArrowUpward`/`TrendingUp`/`CheckCircle`/`Cancel`, `LinearProgress`/`CircularProgress`/`Sparkline`/
   `Gauge`/`BarChart`, and `severity="error"` — none present.
7. **A3's join predicate (§2/Q3.5) — the close-bearing rule.** Read `isCloseBearing` in `ledger.ts`
   directly: `close` ⇒ true; `roll` ⇒ true; `accept` ⇒ `ai_verdict === 'Exit'` exactly; everything else ⇒
   false. This is the ruled predicate, verbatim (not the naive "`close`|`accept`|`roll`" widen the
   contract explicitly forbids). Verified against the two named traps as actual test cases: `case 3`
   (a non-closing `accept` on Hold/Trim/Add with no close-bearing record ⇒ `unresolved_join`, not
   counted) and `case 4` ("THE TRAP INSIDE THE TRAP" — a replacement-less deferred Roll, `accept` +
   `ai_verdict: 'Roll'`, with no `roll` event ⇒ `unresolved_join`, not counted — confirming the
   implementation does **not** use the tempting-but-wrong `ai_verdict ∈ {Exit, Roll}` symmetric guess).
   `unresolved_join` is confirmed LIVE, not dead: `ledger.spec.ts` has explicit `case 7a` (valid entry, no
   close-bearing record) and `case 7b` (`origin_order_id` set, no matching `SimOrder`) fixtures that both
   produce `unresolved_join === 1`, and a dedicated regression fixture asserts `M is IDENTICAL before and
   after the join changes` across four outcome shapes including one landing in `unresolved_join`.
8. **The coverage denominator M spans both position stores.** Read `sources.ts`'s `harvest()`: the
   position index is explicitly built from `[...valuesOf(raw.positions.positions),
   ...valuesOf(raw.ghost.trades)]`, de-duped by `id` with v2-first (keep-existing-on-conflict). Verified
   against the dedicated test (`ledger.spec.ts:207-241`, `'a closed position that exists ONLY in the v1
   trades map appears in BOTH counted and M'`) and the balance identity (`M == counted + Σ
   excluded_by_reason`) is asserted via a shared `expectBalances(read)` helper called after **every**
   fixture in the join/exclusion describe blocks (dozens of call sites) — not a single isolated assertion.
9. **The roll ruling (PM §11.6).** Verified precisely against both pinned cases:
   - **Case 2** (`ledger.spec.ts:434-448`): a roll-closed leg is counted (`coverage.counted === 1`,
     `unresolved_join === 0`), and — the strongest available negative-space check — `JSON.stringify(read)`
     is asserted **not to match** `/roll/i` anywhere in the whole computed read value. No marker of any
     kind survives into the data.
   - **Case 10** (`ledger.spec.ts:646-676`): a closed position whose only record is the `roll` that opened
     it lands under `no_decision_record` (not `unresolved_join`), reaches no rate, and appears in zero
     family cells.
   - `EXCLUSION_PRECEDENCE` is asserted to equal exactly `['malformed', 'no_decision_record',
     'unresolved_join', 'scenario_sourced', 'unpriced_basis', 'modeled_basis']` — the pre-named slot after
     `scenario_sourced` is empty, no `rolled_continuation` exists.
   - `TR_HIT_DEF` is confirmed as the **sole** exemption in the roll-vocabulary negative-space scan
     (`boundaries.spec.ts`'s `AC-E21` test filters every string in the `copy` module for `/\broll/i` and
     asserts the only key matching is excluded by name — i.e. `TR_HIT_DEF` is the only string permitted to
     mention a roll, and the scan proves it, rather than merely trusting the exemption list).
   - `TR_HIT_DEF`'s exact string in `copy.ts` matches the GATE Z round-3 ruling **verbatim**, including the
     added third sentence ("Closing by rolling is closing: a position you closed by rolling counts like
     any other close, hit or miss.").
   - `TR_REASON_LABEL.no_decision_record` in `copy.ts` matches the GATE Z ruling-2 verbatim string ("No
     entry decision recorded — it can't tell us whether entering was a good call"), and the docstring
     immediately above it was updated to state the bucket is live/growing/ordinary, not seed-only.

## Acceptance criteria — verdicts

Evidence-kind tag: `test:<name/file>` = automated test read and confirmed non-vacuous · `review` = visible
copy/placement/ordering, confirmed by reading source/copy against the blueprint · `runtime` = confirmed by
running a project command directly.

### Placement & framing

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 — reachable from Positions, not on `/_ops/metrics`, not on Ticker, no new nav | **PASS** | `review` + `test:positions-page.spec.tsx "AC-1"` (two new cases: renders on `/positions` below the book, absent on `/ticker/*` and `/_ops/metrics`) + `test:boundaries.spec.ts` forbidden-importer scan (negative space) + `review` of `shell/TopNav.tsx` — its `NAV_ITEMS` are exactly `Ticker`/`Positions`/`Scanner`, no `Track record` entry added |
| AC-2 — readable signed out + storage disclosure | **PASS** | `test:boundaries.spec.ts "the import fences hold"` — zero `features/auth` import anywhere in the outcomes source · `review: TR_STORAGE` matches UX_BLUEPRINT §5.1 verbatim in `copy.ts` |
| AC-3 — advisory framing | **PASS** | `review: TR_ADVISORY` matches verbatim |
| AC-4 — SIMULATED, six facts | **PASS** | `review: TR_SIM_DISCLOSURE` — all six named facts present verbatim (slippage, partial fills, queue, assignment, commissions/fees, instant unlimited limit fill), rendered as body text via `<Line testid="tr-sim-disclosure">`, not a tooltip |
| AC-5 — multiplicity caution | **PASS** | `review: TR_MULTIPLICITY` matches verbatim, rendered as the last frame line before families |
| AC-6 — no score-change control/copy | **PASS** | `test:boundaries.spec.ts "AC-6"` — `RENDERED_COPY` scanned for `gate_score/threshold/weight/tune/calibrat/suggest`; UI scanned for `<Switch/<Checkbox/<Slider/<Select/onSort/setFilter/includeExcluded`; zero write functions confirmed by reading `ledger.ts` |

### The counted read

| AC | Verdict | Evidence |
|---|---|---|
| AC-7 — 7 facts together, no interaction | **PASS** | `test:track-record.flow.spec.tsx "AC-7/8/9"` — rate/range/N/mean/dispersion/window/basis all rendered together in one `<Typography>` (`tr-read-{key}`) + a second (`tr-basis-{key}`), no interaction required |
| AC-8 — no rate without N/range/window/basis | **PASS** | structural: `Cohort.computed` type carries all as non-optional siblings; `TR_COUNTED_READ`/basis builder is one function, one string, no decomposable path (read `copy.ts`, `TrackRecordSection.tsx`) |
| AC-9 — no rate without mean+dispersion | **PASS** | same one-string builder; confirmed no code path renders any substring of it |
| AC-10 — mean%, size-unweighted, never $ | **PASS** | `test:boundaries.spec.ts "AC-10/AC-16"` — `$` absent from all rendered copy; `expectancy` appears only inside `TR_RETURN_DEF`'s own disclaimer · `review: TR_RETURN_DEF` states "size-unweighted" + "not dollar expectancy" |
| AC-11 — plain range, not bare ±, not hidden | **PASS** | `test:track-record.flow.spec.tsx "AC-7/8/9"` renders `plausibly {lo}–{hi}%`, always visible (not inside the `<details>` breakdown) |
| AC-12 — >20pp ⇒ "still wide" | **PASS** | `test:track-record.flow.spec.tsx "AC-12"` — width-`>20pp` case renders `TR_STILL_WIDE`; strict `>` confirmed in `copy.ts`'s builder logic |
| AC-13 — hit definition incl. rolling | **PASS** | `review: TR_HIT_DEF` — all three sentences present, exact GATE Z round-3 string, rendered unconditionally via `<Line testid="tr-hit-def">` |
| AC-14 — no semantic tint | **PASS** | `test:track-record.flow.spec.tsx "AC-14"` (90%-vs-10% className-identity check, confirmed non-vacuous — see invariant §6 above) + `test:boundaries.spec.ts` negative-space scan |
| AC-15 — five families, fixed order | **PASS** | `review`: `FAMILY_ORDER` in `types.ts` is `tier, ai_rec, setup, iv_band, persona`; `TrackRecordSection.tsx` maps `read.families` (which is built via `FAMILY_ORDER.map(...)`) directly, no re-sort |
| AC-16 — overlap stated, no summed total | **PASS** | `review: TR_OVERLAP` verbatim + `test:boundaries.spec.ts "AC-10/AC-16"` negative-space scan for a summed total, plus structural: `attributed` derived from population not summed cell Ns (§5 above) |

### Coverage & honesty

| AC | Verdict | Evidence |
|---|---|---|
| AC-17 — coverage without interaction | **PASS** | `test:track-record.flow.spec.tsx "AC-17"` — `tr-coverage` renders outside the `<details>` breakdown element |
| AC-18 — full breakdown on demand, plain reasons | **PASS** | `test:boundaries.spec.ts` — `TR_REASON_LABEL: Record<ExclusionReason, string>` is exhaustive by TypeScript construction (a missing key is a compile error) · `review`: each label distinct, `unpriced_basis`/`modeled_basis` collision resolved per UX §2.9 |
| AC-19 — epoch date + explanation | **PASS** | `test:ledger.spec.ts "AC-19 — the capture epoch is DERIVED FROM THE DATA"` — an older digest-carrying fixture record yields the older date, confirming it is not hardcoded · `review: trEpoch` matches verbatim |

### Archive

| AC | Verdict | Evidence |
|---|---|---|
| AC-20 — one file, three stores, filename stem | **PASS** | `review`/`test:archive.spec.ts` — `archiveFilename()` produces `convexa-archive-{YYYY-MM-DD}.json`; `buildArchive()` spans `ghost_trade`+`positions`+`orders` in one envelope |
| AC-21 — export w/ zero history says empty | **PASS** | `test:track-record.flow.spec.tsx "AC-21"` + `isArchiveEmpty()` in `archive.ts` |
| AC-22 — confirm before any write | **PASS** | `test:archive.ts` design — `parseArchive` writes nothing; `importArchive` is only called on confirm click, verified in `track-record.flow.spec.tsx "AC-22/23/25"` |
| AC-23 — result report every attempt | **PASS** | `test:track-record.flow.spec.tsx` — added/skipped/collided all render, including zeros (`ImportReport` shape enforces all three fields) |
| AC-24 — re-import ⇒ 0 added, readout unchanged | **PASS** | `test:track-record.flow.spec.tsx "AC-24"` — identical counted N, rates, coverage before/after |
| AC-25 — import not gated | **PASS** | `test:track-record.flow.spec.tsx "AC-22/23/25 — a SIGNED-OUT user completes an import"` + `test:boundaries.spec.ts "no gate call exists anywhere"` (`useGate`/`simTradeGate`/`SignInPrompt`/`gate.guard`/`gate.prompt` all absent) |

### Edge / degraded

| AC | Verdict | Evidence |
|---|---|---|
| AC-E1 — no history ⇒ honest empty | **PASS** | `test:track-record.flow.spec.tsx "the journey starts"` |
| AC-E2 — 1–19 ⇒ count only | **PASS** | `test:track-record.flow.spec.tsx "AC-E2 — 19 counted still shows only 19 of 20"` |
| AC-E3 — 3-for-3 trap | **PASS** | `test:track-record.flow.spec.tsx "AC-E3"` — confirmed exact-string + negative-space + no-progressbar (see invariant §5) |
| AC-E4 — day one, every cell building | **PASS** | `test:track-record.flow.spec.tsx "AC-E4"` |
| AC-E5 — corrupt ⇒ empty/partial, no throw, data intact | **PASS** | `test:track-record.flow.spec.tsx "AC-E5"` — asserts `localStorage.getItem(PORTFOLIO_V2_KEY)` byte-identical to the corrupt input string |
| AC-E6 — one malformed record | **PASS** | `test:track-record.flow.spec.tsx "AC-E6"` + `ledger.spec.ts` |
| AC-E7 — typed/theoretical excluded | **PASS** | `test:ledger.spec.ts "AC-E7"` |
| AC-E8 — modeled excluded, not a cohort | **PASS** | `test:ledger.spec.ts "AC-E8"` |
| AC-E9 — scripted scenario excluded | **PASS** | `test:ledger.spec.ts "AC-E9"` — confirmed evaluated BEFORE basis reasons per precedence |
| AC-E10 — no ENTRY decision record (seed + rolled-into leg) | **PASS** | `test:ledger.spec.ts "AC-E10"` + `test:boundaries.spec.ts "AC-E10"` (negative space: `seed`/`demo`/`test data`/`sample` absent from rendered copy AND from source of every outcomes module) · `review`: label true of both members |
| AC-E11 — open, mark never moves a rate | **PASS** | `test:ledger.spec.ts "AC-E11/AC-E12"` |
| AC-E12 — never-filled | **PASS** | same test |
| AC-E13 — pre-capture counts for tier | **PASS** | `test:ledger.spec.ts "AC-E13"` — tier `pre_capture === 0` asserted **from the data**, not hardcoded |
| AC-E14 — captured-but-unavailable distinct | **PASS** | `test:ledger.spec.ts "AC-E14"` |
| AC-E15 — declined import, both classes | **PASS** | `test:track-record.flow.spec.tsx "AC-E15"` and `"AC-E15 class B"` — both the file-problem and store-unreadable classes verified, class-B body confirmed to NOT reuse class A's "existing data was not changed" tail (self-contained string, per GATE Z ruling 1) |
| AC-E16 — conflict ⇒ existing wins | **PASS** | `test:track-record.flow.spec.tsx "AC-E16"` |
| AC-E17 — stream drop unchanged/un-dimmed | **PASS** | `test:positions-page.spec.tsx "AC-E17 — a REAL stream drop"` — real EventSource + fake-timer-driven drop, confirmed non-vacuous via `innerHTML` byte-identity (see invariant §6) |
| AC-E18 — AI-rec partial attribution both directions | **PASS** | `test:ledger.spec.ts "AC-E18"` — `not_attributable_by_path` derived from data both ways; `review`: the wired implementation actually threads the rec identity through the host-remembers-what-it-prefilled seam (`TickerDashboard.tsx`'s `entryRecFingerprint` state, passed to `useGhostTrade`/`usePortfolio` without forking `TradeEntryDialog`), so this count is structurally 0 for records written by the app today and the note self-cancels per the data-driven rule |
| AC-E19 — rolled-OUT leg, plain outcome, no marker | **PASS** | `test:ledger.spec.ts "case 2 (PINNED)"` (see invariant §9) · `review`: no marker/badge/asterisk in `CellView` render path |
| AC-E20 — no-entry-record label true of rolled-into leg | **PASS** | `review: TR_REASON_LABEL.no_decision_record` matches the GATE Z ruling-2 string verbatim (see invariant §9) |
| AC-E21 — no roll category (negative space) | **PASS** | `test:boundaries.spec.ts "AC-E21"` — confirmed the scan actually filters and asserts the empty precedence slot, the `TR_HIT_DEF`-only exemption, and a UI regex scan for `\broll(ed|s|_|C|Co)` (see invariant §9) |

## Overall verdict

**46 PASS / 0 FAIL / 0 UNVERIFIABLE** across the 46 numbered ACs (AC-1…AC-25 = 25, plus AC-E1…AC-E21 = 21).

**GATE Q verdict: PASS.**

> **Count correction (post-review, 2026-07-16).** The line above originally read *"52 PASS / 0 FAIL / 0
> UNVERIFIABLE across the 52 numbered ACs"* — an arithmetic slip **in the headline only**: AC-1…AC-25 = 25
> plus AC-E1…AC-E21 = 21 is **46**, not 52. Caught by the Conductor's GATE Q cross-check. **No verdict, no
> evidence and no AC row was changed** — the error was confined to the total, and every row below it was
> already correct.
>
> **Coverage was then re-verified by set comparison rather than restated:** the distinct AC ids *defined*
> in `PRODUCT_CONTRACT.md` (46) were diffed against the distinct AC ids *carrying a verdict* in the table
> above (46). The comparison returns **zero ids defined-but-not-verdicted** and **zero ids
> verdicted-but-not-defined** — a perfect 1:1 match: no gaps, no extras, no invented ids. The corrected
> total is therefore an audited count, not an asserted one. Recorded here so a future auditor can see the
> number was checked.
>
> This report is the GATE S ship gate, and a headline that disagrees with its own table undermines every
> other number in it — including the 804/804 and the empty `apps/api` diff. Both of those were
> independently re-confirmed by the Conductor and stand.

Every acceptance criterion holds under direct observation (running the test suite, reading the tests that
back each `test:`-marked case to confirm they are non-vacuous, reading the shipped source against every
named contract clause, and independently confirming the `apps/api` diff is empty). No invariant is broken:
the four no-auto-tuning boundaries, `[loss-free-durable-migration]`, `[model-read-carries-its-assumptions]`,
`[live-vs-static-isolation]`, and the GATE Z round-2/round-3 roll ruling (A3's close-bearing predicate, the
two pinned roll cases, the two ruled copy strings) are all independently verified against source and tests,
not merely against the FE lane's own self-report. The two areas this pipeline's history flagged as its
sharpest prior traps — a source-scan that can't actually fail, and MUI `sx`-based style assertions that
can't actually fail in jsdom — were specifically probed and found **not** to recur: the boundaries scan has
a dedicated self-test proving it detects a mutation, and the AC-14/AC-E17 tests use `className`/`innerHTML`
comparison rather than `getAttribute('style')`.

No amendments are bounced. No GATE Z re-entry is required.
