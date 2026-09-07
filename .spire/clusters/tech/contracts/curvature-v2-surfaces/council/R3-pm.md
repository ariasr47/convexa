# R3 — pm resolution exchange: curvature-v2-surfaces

## #1 d09285682d — with architect — role: source

Verdict: CONVERGE

Resolution: Row 11 as written is withdrawn — it cannot be built, and the reason is that the scanner
holds per-symbol **provenance** but no **venue-liveness** fact. `Scanner.tsx:119-126` already decides,
per symbol, whether the displayed price arrived on the stream (`live.prices[r.symbol]` present) or is
the swept one; nothing on the page can answer "is the venue delivering". I sign one of three row-11
variants, per D-A, and I do not choose:
- **(A)** *11A* "No scanner figure — price included — carries a live mark in any connection state."
  (test, SB) · *15 amended*: the basis line states the price cadence and the structure cadence as two
  claims and asserts liveness in **no** state (drop "while the stream is down"). Rows 6, 12, 13, 14
  stand unchanged; a carried-debt line names the under-claim.
- **(B)** *11 kept, re-scoped*: "…a live mark meaning **this displayed number arrived on the stream
  this session**, visibly distinguishable from the desk's live dot, with that meaning readable on the
  page." *6 reworded* to permit exactly one named additional mint. Cost is a product cost: one mark,
  two meanings across two surfaces, plus a visual state no lane has specified.
- **(C)** *11, 6, 12, 13, 14, 15 all stand verbatim*; *67 rewritten* from "zero lines in `apps/api`"
  into a scoped exception — the only SB row in my set that turns from a verification into a negotiation.
Common to all three: rows 12/13 need a per-symbol streamed/swept input and row 14 needs the stream's
own offline flag in the flash gate. That threading is one shared cost at one shared atom, not an
option differentiator, so it must not be priced against any single option.

Evidence: `apps/dashboard/src/app/shared/liveness/liveClaim.ts:29,41-45,47-52,60-62` ·
`apps/dashboard/src/app/pages/scanner/useLivePrices.ts:24-27,36-37,65-70,84-86` ·
`apps/dashboard/src/app/pages/scanner/Scanner.tsx:89,119-126,144` ·
`apps/dashboard/src/app/pages/scanner/ScanCells.tsx:68` ·
`apps/dashboard/src/app/pages/scanner/ScanTable.tsx:47-60,181` ·
`apps/dashboard/src/app/pages/scanner/ScanCard.tsx:95` ·
`apps/dashboard/src/app/pages/scanner/labels.ts:25,32` ·
`apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx:171,174,257-268`

If HOLD — n/a (converged; the option choice is D-A, owner's).

## #13 1f765d5bd8 — with architect — role: raiser

Verdict: CONVERGE

Resolution: I accept "the table keeps its atoms" as **mechanism** and withdraw nothing about
`literal()` — its per-member tips stay (my row 24, UX U-15). The minimum I accept is that the sentence
cannot be read as scope, because the live-derived cells are non-conforming in **three different
directions**, all read this round:
- *27a (amended, SB)* — On a stream drop, a live-derived positions cell holding a last streamed value
  renders that value at reduced emphasis, with the declared pause icon, **and a caption saying it is
  the last known**. Today mark / $ P/L / % P/L dim and caption `⏸ offline` with no last-known clause.
- *27b (new, SB)* — On a stream drop, a live-derived cell with **no** retained value renders a member
  of the closed nine **with the pause icon** and **no** last-known words. Today the null-mark path
  renders the member with no pause icon at all.
- *28 (stands, SB)* — No positions cell renders a bare pause marker with neither a value nor a member
  beside it. *29 (stands)* — the pause mark is the declared stroke icon, never a text character.
Mechanism is the architect's to pick (extracted module, local swap, or the primitive); the rows state
outcomes so GATE Q checks them on the page.

Evidence: `apps/dashboard/src/app/features/trading/positions/PositionRow.tsx:68,139-153,200-210,295,
317,324,338,364,374-379,383-391` · `.spire/clusters/tech/context/DESIGN_SYSTEM.md:168,259`

If HOLD — n/a (converged).

## #21 154fb2122f — with ux — role: source

Verdict: CONVERGE

Resolution: I concede. Both sites verified at their render paths, not just their constants:
`MC_CELL_EMPTY` reaches the **value** position (it replaces the display value, immediately under the
caption label) and is not a member of the closed nine; `Setups` renders one sentence for `undefined`
and `[]` while its own neighbour already splits the two arms correctly. Row 56 is amended and gains a
closed carve-out, which extends the itemized list my self-revision #15 opened (it is classes 4 and 5,
not a new licence):
- *56 (amended, review)* — Each widget keeps its shipped composition: ordering, grouping and label
  wording unchanged; every shipped sentence not named in 56a is byte-identical after the conversion,
  proven by a scan.
- *56a (new, review)* — The set of quiet-band strings this phase may change is exactly two: (i) the
  market-context string occupying a figure's **value** slot becomes a member of the closed nine, with
  the this-cycle meaning moved to that figure's caption (the design draws value `unavailable` + sub
  `this cycle · never a fake zero`); (ii) the setups widget renders **two** sentences where it renders
  one. A third change is a conflict, not a detail. The prose `*_WHOLE_EMPTY` sentences are untouched.
- *57b (new, test)* — A widget whose input was never delivered says so in its own words and states **no**
  market fact about a ticker nobody scored; the checked-and-empty arm keeps its shipped sentence.

Evidence: `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts:346-355` ·
`apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.tsx:121-127,184-218,291,299,375` ·
`apps/dashboard/src/app/pages/ticker/widgets/setups/Setups.tsx:32,52` ·
`apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.tsx:41,45` ·
`apps/dashboard/src/app/shared/copy/notANumber.ts:26-36` · `design/src/components/figure-cell.mjs:40`

If HOLD — n/a (converged).

## #22 77667a5927 — with ux — role: source

Verdict: CONVERGE

Resolution: I concede the unit half and add a fact that makes the split larger than UX priced it:
a **price** threshold does not render on the rule list **at all** today — it is stored and evaluated,
and the rule reads back as the raw level token, so the trader cannot read back the dollar figure they
typed. Row 47 is therefore not merely unsatisfiable for score gates; it is unmet for the threshold
that has a real unit. Rows I sign:
- *47a (new, test, SB)* — A rule carrying a price threshold displays that threshold in its own summary
  line, in the traced register, with the currency prefix on the number.
- *47b (new, test)* — A rule carrying a score gate displays the bare index beside its closed-lookup
  label; no unit, no suffix, none invented (`≥ 72`, never `≥ 72 pts`).
- *47c (new, review)* — No numeric control on this surface takes a value whose unit is only implied by
  its label: a money input states its unit as part of the control.
- **PRECEDENT — owner/architect line.** Register of a **user-entered** number. My lane's position:
  **traced**. The register answers "is this number Convexa's, or asserted-but-untraceable"; a number
  the trader typed is reproducible from the record exactly, with no inference and no model in the
  path. Reading it as a third thing needs a **third** register value, and the canon declares exactly
  two — that is an Amendments event, not a phase-3 call. I state this and do not decide it: it binds
  every user-entered number the app renders (risk inputs, sim entry, alert thresholds).

Evidence: `apps/dashboard/src/app/features/alerts/types.ts:20-22` ·
`apps/dashboard/src/app/pages/alerts/AlertsPage.tsx:39,48,100-108,126-134,191-195` ·
`apps/dashboard/src/app/features/alerts/evaluate.ts:83,110` ·
`.spire/clusters/tech/context/DESIGN_SYSTEM.md:168,178,252`

If HOLD — n/a (converged; the register question is flagged, not decided).

## #23 338807da91 — with ux — role: source

Verdict: CONVERGE

Resolution: I concede — row 35 as written certifies the defect, and the file's own comment calls this
readout a live P&L, so it owes the degraded arm. One refinement with its own evidence: the reduce
starts at zero over an **empty** book too, so `+$0` in green is reachable by three different paths and
`unavailable` would be wrong for one of them (it asserts an input failed). Each state gets its own row:
- *35 (amended, test)* — Tinting stays signed-P&L direction only — never by side, never call-vs-put,
  never by tier — **and only where the tinted value is a computed P&L**; a figure standing in for an
  unmarked book carries no direction colour.
- *35a (new, SB)* — With no open positions at all, the Net P/L (open) readout renders `—`: no number,
  no direction colour.
- *35b (new, SB)* — With open positions but **none** marked, it renders `unavailable`: never a number,
  never a zero, never a direction colour.
- *35c (new)* — With **some** open rows marked, it renders the sum it can compute and carries a caption
  naming how many of the open rows it covers.
- *35d (new)* — With **every** open row marked, it renders the total and carries **no** coverage caption.
- *35e (new)* — On a stream drop it renders the degraded arm: reduced emphasis, the declared pause icon,
  and the last-known clause exactly when a retained value exists — never a bare dimming with no marker
  and no caption.
Feasibility note: coverage is countable from the same set the sum already walks, so 35c needs no new data.

Evidence: `apps/dashboard/src/app/pages/positions/PositionsPage.tsx:76-78,144-154,178-179,181-194,207-209` ·
`apps/dashboard/src/app/shared/copy/notANumber.ts:26-36` ·
`apps/dashboard/src/app/features/trading/positions/PositionRow.tsx:70` ·
`.spire/clusters/tech/context/DESIGN_SYSTEM.md:168,255,259`

If HOLD — n/a (converged).

## Summary

- #1 → CONVERGE (row 11 withdrawn as written; three signed variants priced, choice stays D-A)
- #13 → CONVERGE (mechanism accepted; rows 27a/27b/28/29 keep the offline contract, three defect shapes)
- #21 → CONVERGE (row 56 amended + closed two-site carve-out 56a; new row 57b)
- #22 → CONVERGE (row 47 split into 47a/47b/47c; register of a user-entered number flagged PRECEDENT)
- #23 → CONVERGE (row 35 amended + five state rows 35a–35e)

**Record hazard for the fold, not a conflict:** `council/decisions.md` §3's id column is shifted by one
row across the `pm ↔ ux` block — it lists #21 `77667a5927`, #22 `338807da91`, #23 `3dba77c9ca`, while
`R3-inbox-pm.json` carries #21 `154fb2122f`, #22 `77667a5927`, #23 `338807da91` (and `3dba77c9ca` is
#20, per §4). The ids above are the inbox's. Folding against the §3 column would attach each of these
three resolutions to the wrong row.
