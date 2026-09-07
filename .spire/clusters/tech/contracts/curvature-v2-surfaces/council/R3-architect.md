# R3 — architect resolution exchange: curvature-v2-surfaces

Every `file:line` below was opened and read this round. Nothing here re-litigates the folded items
(#7 #8 #11 #12 #14 #15 #24 #25 #26) and nothing here decides D-A / D-B / D-C.

## #0 6c2cf2c5e9 — with ux — role: raiser
Verdict: CONVERGE
Resolution: I accept ux's self-revision (#24) and sign the split, with one mechanism correction the
proposal left open — **placement**. The module may NOT live in `pages/ticker/widgets/_kit/`: making
`features/trading/positions/PositionRow.tsx` import from `pages/` inverts the repo's binding
dependency direction, which is the exact reason recorded twice in shipped code
(`notANumber.ts:18-23`, `liveClaim.ts:9-14`). It ships as `shared/figure/figureState.ts` (pure, no
JSX) plus `shared/figure/FigureMarks.tsx` (the two marks that are module-private today). Consumers:
`FigureCell` (`FigureCell.tsx:238`), the `ScanCells` atoms (`:51,:68,:82,:98,:161,:178,:218`),
`PositionRow.cellContent` (`PositionRow.tsx:191`), and the positions header readout
(`PositionsPage.tsx:181-194`, which is panel-shaped and keeps `FigureCell` itself). Scanner cells
keep `fontSize: 'inherit'` (`ScanCells.tsx:74`) and do **not** container-step — they are pm 7b-class,
not 7a-class; a criterion that makes them step would fight `ScanTable.tsx:237`'s density sizes.
Evidence: `apps/dashboard/src/app/shared/copy/notANumber.ts:18-23`;
`apps/dashboard/src/app/shared/liveness/liveClaim.ts:9-14`;
`apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx:238,302-329`;
`apps/dashboard/src/app/pages/scanner/ScanCells.tsx:44-48,51,68,74,82,98,161,178,218`;
`apps/dashboard/src/app/pages/scanner/ScanTable.tsx:235-243,257-265`;
`apps/dashboard/src/app/pages/scanner/ScanCard.tsx:54-59,107`;
`apps/dashboard-e2e/src/e2e/no-overflow.spec.ts:938`;
`apps/dashboard/src/app/features/trading/positions/PositionRow.tsx:191`;
`apps/dashboard/src/app/pages/positions/PositionsPage.tsx:181-194`.
If HOLD — n/a.

## #2 cbef7514e4 — with ux — role: raiser
Verdict: CONVERGE
Resolution: Split by figure, not by widget, and state the deliverable as pm rows 53/54's property.
`off-exchange-blocks` and `fresh-positioning` each bind a widget-local mono constant
(`OffExchangeBlocks.tsx:24` → `:79-81`; `FreshPositioning.tsx:15` → `:56-58`) and `fresh-positioning`
interpolates `'—'` INTO the mono run at `:58`. Minimum I sign: (a) the local `MONO` constant is
deleted and the typeface comes from the shared decision; (b) the absent-value token at `:58` renders
in its own Sans span — same characters, corrected register, no wording change and no layout change
(ruling 6); (c) **no size change** — both stay at 12px under the folded 7b, named in the build
report. Two facts that were not on the table: `lookalikes.spec.ts:22-27,47-55` is a shipped, live-
checked exemption list naming four OTHER widgets, and neither of these two is on it, so nothing
checks them today and converting them edits no spec. And `term-structure` is figure-free only in the
DOM — `TermHeatChart.tsx:105-106` paints `${p.atm_iv.toFixed(1)}%` with a hard-coded
`'600 10px "IBM Plex Mono"'` onto a canvas, where no `data-figure-register` and no DOM assertion can
ever reach it. That must be an explicit non-goal with the citation, or the register criterion reads
green over a mono numeral nobody can inspect.
Evidence: `apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.tsx:24,79-81`;
`apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.tsx:15,56-58`;
`apps/dashboard/src/app/pages/ticker/widgets/_kit/lookalikes.spec.ts:22-27,37-45,47-55`;
`apps/dashboard/src/app/pages/ticker/widgets/term-structure/TermHeatChart.tsx:102-106`;
`apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx:216-221`.
If HOLD — n/a.

## #3 b0f85405a7 — with ux — role: raiser
Verdict: CONVERGE
Resolution: Option (a), and I **withdraw option (b)** — I cannot defend funding a value-row help host
on a primitive sixteen shipped sites depend on for one surface's benefit. Positions table cells keep
`literal()` (`PositionRow.tsx:145-153`) and its per-member tips; the non-synonymy criterion is written
against the shipped testids `cell-unavailable` (`:164`), `cell-not-recorded` (`:166`) and
`cell-no-basis` (`:348`). Positions' `FigureCell` conversion is scoped to the panel-shaped header
readout (`PositionsPage.tsx:181-194`), which has no anchor ancestor and hosts the primitive cleanly.
The constraint that forces this stands unchanged: `FigureCell` mounts help only in the LABEL row with
the fixed name `About {label}` (`:307`), and its literal branch renders a bare `ValueGlyph` (`:284-288`)
whose only extra slot is `caption ?? null` (`:253`) — converting those cells deletes the tips.
One boundary note R4 needs: `dashCell` (`:167`) is deliberately untestidded (`:69`), so the `'—'`
member on positions has no DOM hook; do not write an assertion that assumes one.
Evidence: `apps/dashboard/src/app/features/trading/positions/PositionRow.tsx:69,139-153,164,166,167,348`;
`apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx:253,284-288,302-309`;
`apps/dashboard/src/app/pages/positions/PositionsPage.tsx:181-194`.
If HOLD — n/a.

## #4 50ef9a81be — with ux — role: raiser
Verdict: CONVERGE
Resolution: Forward-only criterion plus a named carried debt, and I now price the repair option
exactly rather than only warning about it. Forward: a firing recorded after this phase builds its
label from the closed lookups (`evaluate.ts:73,94,116`), and the live rule list stops rendering a
threshold the record does not hold (`AlertsPage.tsx:192` `≥ ${r.scoreMin ?? 60}` against
`types.ts:22` `scoreMin?: number` and `evaluate.ts:83`'s third copy of `60`). Debt: pre-phase strings
are legacy content, cited at `types.ts:32` + `AlertsPage.tsx:225`. If the council wants history
repaired, the shape is now checkable: `store.ts:59-65` casts `parsed.events` straight to
`AlertEvent[]` with no per-field validation, so **additive** fields survive a read/write round trip
and old events keep `message` — read-new-else-old works with no destructive migration. Two hard
conditions: `message` is never deleted, and the migration is never gated behind a read that can
throw, because `store.ts:66-68` resets to `empty()` on a parse failure and the next `persist`
(`:41-49`) overwrites the durable key — that is the loss-free-durable-migration risk, still live.
Evidence: `apps/dashboard/src/app/features/alerts/types.ts:20-22,27-37`;
`apps/dashboard/src/app/features/alerts/evaluate.ts:73,83,94,116`;
`apps/dashboard/src/app/features/alerts/store.ts:41-49,59-65,66-68,94-98`;
`apps/dashboard/src/app/pages/alerts/AlertsPage.tsx:192-194,225`.
If HOLD — n/a.

## #16 7da0330a44 — with ux — role: source
Verdict: CONVERGE (I concede the scope; my §2.2 under-scoped the extraction)
Resolution: The module carries the whole F1–F9 branch (`FigureCell.tsx:250-300`), not the register
branch. `figureStateOf(input)` is pure and returns **eight** fields — ux's six plus two the branch
actually computes and the six-field list drops: `dim` (set at `:266` and `:275`) and `untraced` (set
at `:294`). Without `dim` the scanner's retained arm has no reduced-emphasis output and `labels.ts:30-32`'s
"the figures stay, dimmed" still has nothing behind it. Signature I sign:
`{ figureState, isLiteral, mono, isFigure, dim, untraced, showDot, showPause, caption }`, from
`{ value, register, live, offline, replay, caption, assertedBy }` — `live` keeps the `LiveClaim`
brand (`FigureCell.tsx:171`, `liveClaim.ts:23-29`) so extraction can never become a back door around
the one-mint rule; a scanner caller holds no `LiveUpdate` and can pass only `NOT_LIVE`.
**Pause icon reachability (pm's ask, answered):** NOT reachable today — `PauseMark` is a module-private
declaration at `FigureCell.tsx:154-156`, and that file exports only `FigureCellProps` (`:158`),
`FigureCell` (`:238`), `StatSkeleton` (`:339`) and the default (`:355`). It becomes reachable by
moving `PauseMark` and `LiveDot` (`:130-149`) into `shared/figure/FigureMarks.tsx` as named exports;
`FigureCell` imports them back. Rows 12/13/27/28/29 therefore need **this** extraction, not a
different mechanism.
**`data-figure-state` emission:** every consumer emits it on the element wrapping the value glyph —
`FigureCell` keeps it on the card root (`:303`) so the nine shipped spec files that key on it are
untouched; the scanner atoms emit it on their own outer span (e.g. `PriceCell`'s `Typography`
`ScanCells.tsx:71-77`, which already carries `data-testid="cell-price"`); positions cells emit it on
the existing cell node (e.g. `PositionRow.tsx:372-379`). GATE Q then asserts the degraded arm as
`[data-testid="cell-price"][data-figure-state="offline-retained"]` on `/scanner` — DOM, not prose.
One caveat R4 must carry: on `FigureCell` the state attr sits on the CARD and the register attr on the
VALUE (`:303` vs `:212`); on the atoms both sit on one element, so an assertion must query state at
the cell testid and not assume co-location.
**Input plumbing:** `ScanTableProps` (`ScanTable.tsx:47-60`) and `ScanCardProps` (`ScanCard.tsx:30-35`)
each gain ONE prop, a per-symbol `{ retained: boolean } | null`, computed once at `Scanner.tsx:119-126`
where `lp` is already in hand: `retained` is true only when the displayed price came from the now-dead
stream (`lp != null`). A symbol that never ticked keeps the swept price, which the poll still
refreshes — no pause mark, no F5. Offline-bare therefore does not occur on scanner prices.
Evidence: `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx:130-149,154-156,158,171,212,238,250-300,303,339,355`;
`apps/dashboard/src/app/shared/liveness/liveClaim.ts:23-29,47-53`;
`apps/dashboard/src/app/pages/scanner/ScanCells.tsx:68-79`;
`apps/dashboard/src/app/pages/scanner/ScanTable.tsx:47-60`;
`apps/dashboard/src/app/pages/scanner/ScanCard.tsx:30-35`;
`apps/dashboard/src/app/pages/scanner/Scanner.tsx:115,119-126,144`;
`apps/dashboard/src/app/pages/scanner/labels.ts:30-32`;
`apps/dashboard/src/app/features/trading/positions/PositionRow.tsx:372-379`.
If HOLD — n/a.

## #17 66cd71c107 — with ux — role: source
Verdict: CONVERGE (my C4 was false on one cell; I withdraw "the vocabulary work is scanner-side")
Resolution: ux is right at source and I add the exact perimeter so the criterion is neither vacuous
nor a re-conversion. Exactly ONE positions cell renders a closed-nine member inside the mono
register: `delta_entry`, `PositionRow.tsx:374` (`...MONO`) with `DASH` at `:377`. `session_delta`
(`:387-388`) renders `DASH` and a bare `'⏸'` in a NON-mono `Typography` — a vocabulary/icon defect
(#13's line 2), not the register inversion. `dte` (`:518`), `entry_time` (`:522`), `stop` (`:526`)
and `target` (`:528`) render `DASH` in Sans and are already correct on register. One more the round
turned up: the positions header readout binds the mono face by hand at `PositionsPage.tsx:185`.
Mechanism: extend the SHIPPED scan at `fonts.spec.ts:154-167` (already `?raw` over `/src/app/**`,
already mutation-guarded at `:157-161`) with two needles — (1) no closed-nine member inside a
mono-bound `sx`, (2) no font-family literal or widget-local `monoFontFamily` binding outside
`shared/theme/tokens.ts` and the shared decision module — scoped to `features/trading/`,
`pages/positions/`, `pages/scanner/`. Extending a shipped scan, not minting a new one, is the cheap
route and the one the repo already knows (49 spec files use this idiom).
Evidence: `apps/dashboard/src/app/features/trading/positions/PositionRow.tsx:70,368-382,383-392,518,522,526,528`;
`apps/dashboard/src/app/pages/positions/PositionsPage.tsx:181-194`;
`apps/dashboard/src/app/shared/theme/fonts.spec.ts:31-35,154-167`;
`apps/dashboard/src/app/shared/copy/notANumber.ts:26-36`;
`apps/dashboard/src/app/pages/scanner/ScanCells.tsx:44-48,51-61`.
If HOLD — n/a.

## #1 d09285682d — with pm — role: raiser
Verdict: CONVERGE on the feasibility/cost table; the choice stays D-A with the owner.
Resolution: I sign the three-option menu with these corrected costs, and I add one option-A repair
that was not on the table.
**(A)** Zero new mints, buildable today: the retained arm rides the unbranded `offline` prop
(`FigureCell.tsx:174,257-268`), derived at `Scanner.tsx:119-126` exactly as #16 states. A inherits one
real defect — `useLivePrices.ts:65-67` calls `setOffline(false)` on ANY frame, including a
payload-less heartbeat, so the pause mark clears while prices are stale. **Repairable with no backend
change and no new mint:** the frame carries `ts` per symbol (`useLivePrices.ts:24-27`), so `retained`
can be driven by the age of that timestamp. Staleness of a timestamp is not a claim about the venue,
so it does not touch `[one-liveness-predicate]`. Copy cost for the owner's eyes only:
`scanner.risk.spec.tsx:869` pins `/Prices (live|offline)/` on the page text, so any header rewording
edits that shipped spec.
**(B)** Still no backend change — and a sharper cost than "re-opens the ledger key". The mechanism
that enforces pm row 6 is a source scan over BANNED **names** (`liveClaim.spec.ts:68-80`), globbed
only at `pages/ticker/widgets/**`. A fourth mint added inside `liveClaim.ts` passes that fence by
construction: the scan sees a second name, never a second answer. B therefore defeats the only shipped
enforcement of the rule it re-opens. Second cost: the desk census builds its worst case from
`market_session:'closed'` + `live:true` (`live-dot-census.spec.tsx:1-31`); the prices frame carries
neither (`useLivePrices.ts:24-27,69`), so B's dot cannot be censused against a closed venue at all —
the precise shape of the phase-1 GATE Q bounce.
**(C)** The client-side cost is small and I will not overstate it: widen the local `LivePrice`
interface (`useLivePrices.ts:24-27` — it is declared there, not in `@convexa/api`) and call
`isDeliveringLive` (`liveClaim.ts:47-53`). The whole cost of C is the backend fence and pm row 67.
Adjacent fact the council should hold: `PositionsPage.tsx:88` still calls the banned `genuineIsLive`,
and the fence's glob does not reach `pages/positions/`. Row 6 becomes enforceable on the four surfaces
by widening that one glob and recording explicit EXEMPT entries — cheap, and independent of A/B/C.
Evidence: `apps/dashboard/src/app/pages/scanner/useLivePrices.ts:24-27,29-33,36-37,63-70,84-86`;
`apps/dashboard/src/app/pages/scanner/Scanner.tsx:115,119-126,144`;
`apps/dashboard/src/app/shared/liveness/liveClaim.ts:23-29,41-53`;
`apps/dashboard/src/app/shared/liveness/liveClaim.spec.ts:68-80,111-116,137-143`;
`apps/dashboard/src/app/pages/ticker/live-dot-census.spec.tsx:1-31`;
`apps/dashboard/src/app/pages/positions/PositionsPage.tsx:88`;
`apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx:869`;
`apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx:174,257-268`.
If HOLD — n/a (the ruling is the owner's; the feasibility half is settled).

## #13 1f765d5bd8 — with pm — role: source
Verdict: CONVERGE — the sentence is mechanism, never scope; I sign the two-line split.
Resolution: (1) `literal()` and its per-member tips stay (`PositionRow.tsx:145-153`), which is also
#3 and U-15. (2) The live-derived cells still owe the offline contract, and they get it from #16's
module, not from a local swap: `mark` (`:284-320`), `pl` (`:321-341`), `pl_pct` (`:342-367`),
`delta_entry` (`:368-382`), `session_delta` (`:383-392`), `trend` (`:393-411`). The three character
marks go: `OFFLINE` (`:68`), the appended `' ⏸'` (`:378`) and the bare `'⏸'` that today replaces the
ENTIRE session-delta value (`:388`). `:388` has a retained arm available — `ctx.sessionDelta` is
ephemeral per-cycle but still in memory on a drop (`RowContext:119-120`) — so it renders the last
value dimmed with the stroke mark and the `offline · last known` caption, not a naked glyph. `dim`
comes from the module's output, never from a cell-local `liveDim` (`:200`), which is what stops the
`PositionsPage.tsx:190` shape (opacity 0.5, no pause, no caption) from being re-minted per cell.
**Your two asks, answered:** `PositionCard.tsx:76-87` roots on a plain `Box`, no anchor — unlike
`ScanCard.tsx:54-59` — so the card CAN host the primitive directly; it should still take the module
route so table and card cannot render one datum two ways (`ScanCells.tsx:1-3` is the shipped
precedent for that rule). And the stroke pause icon is NOT reachable outside the primitive today
(`FigureCell.tsx:154-156` is module-private; exports are `:158,:238,:339,:355`) — it becomes
reachable only via the `shared/figure/FigureMarks.tsx` move in #16. Rows 12/13/27/28/29 depend on
that extraction landing; if #16 were scoped back to register-only, those rows would have no host.
Evidence: `apps/dashboard/src/app/features/trading/positions/PositionRow.tsx:68,115-127,145-153,196-212,284-320,321-341,342-367,368-382,383-392,393-411`;
`apps/dashboard/src/app/features/trading/positions/PositionCard.tsx:45-57,76-87`;
`apps/dashboard/src/app/pages/scanner/ScanCard.tsx:54-59`;
`apps/dashboard/src/app/pages/scanner/ScanCells.tsx:1-13`;
`apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx:154-156,158,238,339,355`;
`apps/dashboard/src/app/pages/positions/PositionsPage.tsx:190`.
If HOLD — n/a.

## Summary
- #0 6c2cf2c5e9 → CONVERGE (module split signed; placement corrected to `shared/figure/`)
- #2 cbef7514e4 → CONVERGE (split by figure; canvas mono numeral named as a non-goal)
- #3 b0f85405a7 → CONVERGE (option (a); I withdraw option (b))
- #4 50ef9a81be → CONVERGE (forward-only + carried debt; additive repair priced, not chosen)
- #16 7da0330a44 → CONVERGE (whole F1–F9 branch, nine fields, `data-figure-state` per consumer)
- #17 66cd71c107 → CONVERGE (my C4 conceded; one mono cell + the header's hand-bound face)
- #1 d09285682d → CONVERGE on feasibility/cost; the ruling stays D-A with the owner
- #13 1f765d5bd8 → CONVERGE (two-line split; both pm asks answered with mechanism)

Ledger note for the controller: `decisions.md` §3 lists `154fb2122f` as #16's id; the inbox's
`conflict_id` for index 16 begins `7da0330a44`. I used the inbox value — worth reconciling at fold
time, same as the flagged `3dba77c9ca` collision on #20/#23.
