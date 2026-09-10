# R3 — ux resolution exchange: curvature-v2-surfaces

Every `file:line` below was opened and read this round. Folded items (#7 #8 #11 #12 #14 #15 #24 #25 #26)
are not re-litigated; D-A / D-B / D-C are not decided here.

## #0 6c2cf2c5e9 — with architect — role: source

Verdict: CONVERGE

Resolution: I already withdrew the mechanism half of U-1 (self-revision #24, folded); here is the
minimum the extracted module must **return** so the property is still real. For one datum it returns
`{ figureState, mono, isFigure, showDot, showPause, caption }` — `figureState` being one of the nine
names shipped at `FigureCell.tsx:252-300` (`default · loading · live · offline-retained · offline-bare ·
replay · empty · unavailable · untraced`), and every consumer emitting it as `data-figure-state` on the
element that carries the value. Captions are the shipped strings verbatim, not re-authored:
`offline · last known` (`:262`), `offline` (`:271`), `session replay` (`:282`), `${assertedBy} · untraced`
(`:293`). The stroke pause mark ships with it: `PauseMark` (`:154-156`) and `LiveDot` (`:130-148`) are
module-local functions today, **not exported**, so the icon is genuinely unreachable outside the
primitive as pm's ask to you suspects — it must be exported, or rows 12/13/27/28/29 have no icon.
**Chrome exclusions accepted explicitly**, in your words and mine: no `CellCard` (`FigureCell.tsx:72-106`
— no card, no `overflow: 'hidden'` at `:76`, no `translateY(-2px)` hover at `:95`); **no second label
row**, because `ScanTable.tsx:107-145` renders the column header and that IS rule 13's label row; **no
nested focusable button** inside `ScanCard.tsx:54-56`'s single `RouterLink` anchor — the scanner passes
no `info`, keeps `focusableHelp={false}` (`ScanCard.tsx:107`) and keeps its shipped tip +
`aria-describedby` (`ScanCells.tsx:115,132-140`; `ScanCard.tsx:108-110`).
One boundary I am adding, because it is a state call and it is mine: the 20/17/15 ladder
(`FigureCell.tsx:216-221`) and the fixed 15px literal size (`:221`) are `FigureCell`'s **panel-scale
constants** and do **not** travel to off-ladder consumers. A table cell or a 12px list row keeps its
inherited size; what travels is the **register** (Mono vs Sans) and the state. That answers your ask 5
directly: the 12px mono rows are figures for register purposes and are not on the step ladder.

Evidence: `FigureCell.tsx:72-106,130-148,151-156,216-221,250-300,303,307`; `ScanCard.tsx:54-56,70,107,108-110`;
`ScanCells.tsx:44-48,51-61,115,132-140`; `ScanTable.tsx:47-60,62-77,79,107-145`; canon rules 13, 21, 24.

If HOLD — what would settle it: n/a.

## #2 cbef7514e4 — with architect — role: source

Verdict: CONVERGE

Resolution: My sentence is false and I withdraw it. Verified: `OffExchangeBlocks.tsx:24` is
`const MONO = typographyTokens.monoFontFamily;` and `:79-81` renders `{b.shares.toLocaleString()} sh @
${b.price.toFixed(2)}` at `fontFamily: MONO, fontSize: 12`; `FreshPositioning.tsx:15` is the same
constant and `:56-58` interpolates the closed-nine member `'—'` **inside** the mono run
(`{s.volume?.toLocaleString() ?? '—'} contracts`). Only `TermStructure.tsx` and `Setups.tsx` are
genuinely figure-free. I also drop the "four convert, four do not" count — the deliverable is the
property, not a tally: **no widget-local font constant, no closed-nine member inside a mono run, no
untraced figure in the mono register** (pm rows 53/54). Register resolves through the module; layout,
row order and the deliberate 12px size are untouched (pm 7b, folded). Two consequences in my lane:
(a) the lifted `'—'` renders Sans **at the row's own 12px**, never at `FigureCell`'s 15px literal size —
a 15px absent value inside a 12px list inverts the hierarchy; (b) it is a visible diff on shipped
surfaces and must be named in the build report, like my R1 risk 6.

Evidence: `OffExchangeBlocks.tsx:24,46-55,79-81`; `FreshPositioning.tsx:15,41-48,56-58`;
`Setups.tsx:29-56`; `notANumber.ts:26-36`; canon rule 24 ("rendered as Sans text, never as a figure").

If HOLD — what would settle it: n/a.

## #3 b0f85405a7 — with architect — role: source

Verdict: CONVERGE

Resolution: **I sign option (a).** Positions table cells keep `literal()` and its per-member tips; the
`FigureCell` conversion on positions is scoped to the panel-shaped figure — the page header readout at
`PositionsPage.tsx:177-195`, which is where U-12/U-13 land anyway. I reject (b): funding a value-row
help host would put **two** focusable-help affordances in one cell — the label-row `About {label}`
(`FigureCell.tsx:307`) plus a value-row host — inside the primitive that `FigureCell.tsx:2-3` says
replaced `StatTile` at **16 render sites**. That mints the duplicate focusable-help pattern ruling 6
forbids, in the one component that currently proves the pattern is single.
**A11y consequence, stated plainly so nobody reads (a) as free.** The three-way distinction does **not**
depend on the tooltip: three distinct literals with three distinct testids already ship —
`cell-unavailable` (`PositionRow.tsx:164`), `cell-not-recorded` (`:166`), `cell-no-basis` (`:348`) — and
`positions.risk.spec.tsx:858,859,885` already asserts them. The tip carries the **explanation**, not the
distinction. So U-15 stays `Verify by = review` on the three tip texts, and U-14's non-synonymy is
`test` against those three testids. **One defect I will not hide:** `literal()` (`:145-153`) wraps a
plain `<Typography>` with no `tabIndex` and no `describeChild`, so all three explanations are
**hover-only** — canon rule 20 and the Banned "Hover-only affordances" row. `PositionRow.tsx:396-401`
already ships the fix idiom in the same file (`Tooltip describeChild` + `aria-describedby`). If the
council will not fund it here, name it as carried debt with `PositionRow.tsx:147-151` attached; do not
let a `review` mark certify an affordance a keyboard cannot reach.

Evidence: `PositionRow.tsx:139-153,164,166,345-350,396-401`; `FigureCell.tsx:2-3,253,284-288,307`;
`positions.risk.spec.tsx:856-859,882-885`; canon rules 20, 24 + Banned "Hover-only affordances".

If HOLD — what would settle it: n/a.

## #4 50ef9a81be — with architect — role: source

Verdict: CONVERGE

Resolution: The second clause of U-23 is unbuildable and I withdraw it. Verified: `AlertEvent`
(`types.ts:27-37`) persists a pre-rendered `message: string` (`:32`) and carries no `level` and no
`scoreMin`; `AlertsPage.tsx:225` renders `{e.message}` verbatim; `evaluate.ts:83` bakes `rule.scoreMin
?? 60` into a durable `SPY score ≥ 60 (now …)` at `:94` for a rule whose record holds no minimum. My own
R1 assumption forbids a shape change on `convexa.alerts.v1`, so I cannot ask for history repair and
keep that assumption. Split as you propose:
**U-23a** — a firing recorded after this phase builds its label from the closed lookups
(`evaluate.ts:73,94,116`), so a new event and the rule row read the same words. `Verify by = test`.
**U-23b (carried debt, not a criterion)** — event strings written before this phase are legacy content
and are not re-labelled; cite `types.ts:32` and `evaluate.ts:83`.
Copy consequence I own: because history is not repaired, the Recent list must not imply it was. No new
sentence is required — `{e.message}` stays — but the phase may not claim "stored history renders the
same labels". If the council later wants repair, it is an additive read-new-else-old field set with the
old `message` retained as fallback and pm row 70's fixture authored from a pre-phase blob.

Evidence: `features/alerts/types.ts:20-22,27-37,47`; `evaluate.ts:65-104,106-124`; `AlertsPage.tsx:212-234`.

If HOLD — what would settle it: n/a.

## #16 7da0330a44 — with architect — role: raiser

Verdict: CONVERGE

Resolution: Minimum I accept — the extraction carries the **whole** `FigureCell.tsx:250-300` branch, not
the register/vocabulary sub-branch. Concretely, for the scanner and positions degraded arms to be real
on the page: **F4** (retained value, dimmed, stroke pause mark, caption `offline · last known`), **F5**
(closed-nine member, dimmed, stroke pause mark, caption `offline`), **F1/F3** (the dot, only where a
liveness claim exists — subject to D-A, not to me), **F7/F8** (Sans literal, never mono), and
`data-figure-state` emitted by every consumer. Your own R2 ask asked me whether a dimmed value with the
stroke pause icon and an `offline · last known` caption is sufficient for U-5, or whether it needs the
card anatomy: **it is sufficient — yes, no card, no label row, no hover lift.** The state is the
requirement; the chrome never was.
Falsifiable consequence if it ships register-only: U-5, pm rows 12/13 and 27/28 must be **withdrawn**,
not asserted, because there would be no host — `Scanner.tsx:144` swaps one header string and
`:222-240` passes no offline input to `ScanCardList` or `ScanTable`, whose props (`ScanTable.tsx:47-60`;
`ScanCardProps` at `ScanCard.tsx:30-35`) have no offline field. `labels.ts:30-32` would keep promising
"the figures stay, dimmed, and say why" against nothing rendering it. That is your Risk 2's exact shape.

Evidence: `FigureCell.tsx:250-300,303`; `Scanner.tsx:130-157,222-240`; `ScanTable.tsx:47-60`;
`ScanCard.tsx:30-35`; `scanner/labels.ts:25,30-32`; canon rule 13.

If HOLD — what would settle it: n/a.

## #17 66cd71c107 — with architect — role: raiser

Verdict: CONVERGE

Resolution: Minimum I accept is one cell plus one scan, and it is smaller than I first priced it,
because the file already owns the fix. Verified: `PositionRow.tsx:374` styles the `delta_entry` cell
`sx={{ opacity: liveDim, ...MONO, color: 'text.secondary' }}` and `:377` renders `DASH` (`'—'`, `:70`)
inside it when `view.pl_dollar == null`. The shipped remedy is three lines above: `dashCell` (`:167`)
routes `DASH` through `literal()` and already carries `DELTA_ENTRY_TIP` — the same tip `:371` passes.
So: **every absent-value path in `PositionRow.tsx` routes through `literal()`; no cell-local `DASH`
inside a `MONO` sx.** The **word does not change** — `—` stays `—`, so this sits inside pm's narrowed
copy freeze (#15); only the register changes, Mono → Sans, which is rule 24's named inversion being
undone. Enforce with the `?raw` scan extended to `features/trading/positions/`, mutation-proved.
`Verify by = test` (silently regressing, negative space). Name the register diff in the build report;
GATE Q will see it.

Evidence: `PositionRow.tsx:68,70,73-78,145-153,167,368-382`; `notANumber.ts:26-36`; canon rule 24.

If HOLD — what would settle it: n/a.

## #21 154fb2122f — with pm — role: raiser

Verdict: CONVERGE

Resolution: You already agreed the Setups half in your R2 `agree` list. Here are the exact carve-out
sentences I would sign, so row 56 stays a wall:
> Each widget keeps its shipped composition: ordering, grouping and label wording are unchanged by the
> conversion. Wording changes at exactly two named sites. **(a) Value-slot member:** `_kit/copy.ts:355`
> `MC_CELL_EMPTY = 'unavailable this cycle'` occupies a figure **value** slot (`MarketContext.tsx:291,299,375`)
> and is not a member of the closed nine; it splits into the value `unavailable` and the caption
> `this cycle`, as `design/src/components/figure-cell.mjs:40` already draws it. **(b) One sentence for
> two states:** `Setups.tsx:52` renders `No clean setup right now.` for both `undefined` and `[]`
> (`:32`); `[]` keeps that sentence **byte-for-byte** and `undefined` renders `Setups unavailable this
> cycle.` **Nothing else changes.** The `*_WHOLE_EMPTY` prose sentences (`copy.ts:297,352,353,354`) are
> widget-body prose, not values, and are untouched.
Site (b) is genuinely the only collapse among the eight: `FreshPositioning.tsx:41` vs `:45` and
`OffExchangeBlocks.tsx:46` vs `:50` both already split never-checked from checked-and-empty, and no
other quiet-band widget has a list-empty arm at all. `Verify by`: U-29 (`undefined` ≠ `[]`, and the
`undefined` string makes no market claim) `test`; U-31 (no `unavailable this cycle` in a value slot)
`test`; the caption text itself `review`.

Evidence: `Setups.tsx:29-56`; `FreshPositioning.tsx:41-48`; `OffExchangeBlocks.tsx:46-55`;
`_kit/copy.ts:297,352-355`; `MarketContext.tsx:291,299,374-375,425`; `design/src/components/figure-cell.mjs:40`;
canon rule 24.

If HOLD — what would settle it: n/a.

## #22 77667a5927 — with pm — role: raiser

Verdict: CONVERGE

Resolution: Split row 47 by threshold **type** — four arms, verified against `types.ts:10-25` and the
composer's own closed lookups:
1. **Score gate** (`scoreMin?: number`, `types.ts:22` — the 0–100 opportunity index, no unit exists):
   label `Score gate` from the closed `KINDS` lookup; value renders **`≥ 72`** — bare index, **never
   `≥ 72 pts`**, never a fabricated suffix. Absent → the member **`not set`**, never today's
   `≥ ${r.scoreMin ?? 60}` (`AlertsPage.tsx:192`), whose 60 disagrees with the composer's 70 (`:39`).
2. **Price threshold** (`priceThreshold?: number`, `types.ts:20` — dollars, a real unit): label
   `Price threshold` (`AlertsPage.tsx:31`); value renders the currency **prefix** — `$500`. Absent →
   `not set`.
3. **Structure level** (`level?: LevelRef`): label from `LEVELS` — `Gamma flip` / `Call wall` /
   `Put wall`; **no threshold number of the rule's own**, because the level's value is a market fact the
   record does not hold. Absent → a closed-nine member, my read `not recorded`, riding on the routed
   fourth-surface ask (decisions §5), never today's bare word `level` (`:193`).
4. **Tier change**: no threshold at all; `any tier transition` (`:194`) stays byte-identical.
**PRECEDENT — owner/architect line:** what register a **user-entered** number renders in. My read is
`traced` (it is exactly the record, reproducible from it), and the alternative is self-refuting on the
shipped primitive: `register: 'asserted'` drives F9's caption template `${assertedBy} · untraced`
(`FigureCell.tsx:293`), which on the trader's own typed number reads `you · untraced`. I state the read;
I do not rule it — it sets the precedent for every user-entered number in the app.

Evidence: `features/alerts/types.ts:10-25`; `AlertsPage.tsx:20-32,39-40,189-195`; `FigureCell.tsx:289-294`;
`notANumber.ts:26-36`; canon rule 23/24 + Amendments 2026-08-12 ("A bare number with an inferred unit is
forbidden" — the fix was a visible unit **control**, not a suffix).

If HOLD — what would settle it: n/a (the register precedent is the owner's line, not a lane hold).

## #23 338807da91 — with pm — role: raiser

Verdict: CONVERGE

Resolution: You agreed the headline arm in R2. Here is the full Net P/L state set with its copy. Label
`Net P/L (open)` unchanged (`PositionsPage.tsx:178-180`); `data-testid="positions-net-pl"` (`:183`) kept.
- **N1 — no open rows at all.** Value `—` (F7), Sans, **no tint**. A net open P/L is not applicable when
  there is no open book. Today this renders `+$0` in green (`:189,193`).
- **N2 — every open row marked.** Mono figure, direction tint permitted. No coverage caption.
- **N3 — some open rows unmarked.** Mono figure over the marked subset, tint permitted, **mandatory**
  caption `{n} of {m} open marked`.
- **N4 — open rows exist, none marked.** Value `unavailable` (F8), Sans, **no number, no tint**, caption
  `0 of {m} open marked` — same template as N3, so no new sentence is minted. This is the shipped
  fabrication: `:147-154` skips nulls, so the reduce returns `0` and `:189` paints `netPl >= 0` green.
- **N5 / N6 — stream offline.** Replaces the bare `opacity: 0.5` at `:190`: F4 (retained total, pause
  mark, caption `offline · last known`) or F5 (`unavailable`, pause mark, caption `offline`). Offline
  captions **take precedence** over the coverage caption — that is the primitive's shipped behaviour
  (`FigureCell.tsx:253,262,271`), not a new composition rule.
Clause on row 35, exact: *"…signed-P&L direction only, and only where the value is a computed P&L over
marked rows — never a zero standing in for an unmarked or empty book, and never on a closed-vocabulary
member."* `Verify by`: N1/N4 `test` (a fabricated zero regresses silently); N3's caption `test`;
N5/N6 `test`; the caption's wording `review`.

Evidence: `PositionsPage.tsx:75-78,144-154,177-195`; `FigureCell.tsx:250-300`; `notANumber.ts:26-36`;
canon rules 13, 24 + Banned "Green/red as decoration" (direction reservation).

If HOLD — what would settle it: n/a.

## Summary

- #0 → CONVERGE
- #2 → CONVERGE
- #3 → CONVERGE
- #4 → CONVERGE
- #16 → CONVERGE
- #17 → CONVERGE
- #21 → CONVERGE
- #22 → CONVERGE
- #23 → CONVERGE
