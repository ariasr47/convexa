# R5 — ux copy pass: positions-legs

> **Scope: WORDING ONLY.** A narrow, bounded post-synthesis pass closing the four copy gaps `SPEC.md`
> §9 left open (Q1, Q3, Q4, Q5) after the owner's post-R4 Q2 ruling landed. Behaviour, placement,
> component state, token binding, dismissibility, ARIA and timing are already specified in `SPEC.md`
> and are **not touched here** — where I think a specified behaviour is wrong it is filed under
> `## Objections`, not changed.
>
> Ground truth re-read: `SPEC.md` §2.2 · §2.3 · §2.4 · §2.6 · §2.9 · §3 · §4 (in full) · §5 ·
> `council/decisions.md` (incl. the **Post-R4 owner rulings**) · `council/R1-ux.md` ·
> `council/R3-ux.md` · `.claude/DESIGN_RULES.md` · `convexa-design` skill ·
> and the **shipped** strings in `apps/dashboard/src/app/features/trading/`:
> `positions/labels.ts` (`ROW_UNAVAILABLE_TIP`, `PENDING_PL_TIP`, `EMPTY_NO_POSITIONS`, `PL_TIP`,
> `ENTRY_BASIS_META`), `positions/defaults.ts` (`COLUMN_LABELS`, `TABLE_HEADER_LABELS`),
> `model/mark.ts` (`MARK_BASIS_META`), `outcomes/copy.ts` (`TR_REASON_LABEL`, `TR_EXPORT_LABEL`,
> `TR_UNREADABLE_BODY`, `trCoveragePartial`).
>
> Every string below is final and copy-pasteable. Straight apostrophes (`'`) throughout, matching
> `ROW_UNAVAILABLE_TIP` and every new constant already in §4.

---

## Q1 — the word for `pl_pct_state.no_basis`

### The cell literal

```
no basis
```

**Constant:** `NO_BASIS_LABEL` (`positions/labels.ts`) · **testid:** `cell-no-basis` (matching the
shipped `cell-unavailable` and the `cell-not-recorded` I added in R3).

### Its tooltip

```
This position opened at about no net debit or credit, so a percentage has nothing to measure
against and Convexa won't invent one. The dollar P/L beside it is unaffected — only the percentage
is missing.
```

**Constant:** `NO_BASIS_TIP` (`positions/labels.ts`, beside `NOT_RECORDED_TIP` /
`UNPRICEABLE_RECORD_TIP`).

**Renders:** §4 *Component states* → **`P/L% cell`** row, `error / unavailable` column — the third of
that cell's three withheld readings ("or the `no_basis` word (§9 Q1) while the dollar P/L still
renders"). Nowhere else on the surface; never in `pl`, never in `mark` (§2.2).

**Why it cannot be confused with the other three:** `—` says the field does not apply to this
instrument, `unavailable` says the lookup failed this cycle, `not recorded` says the saved record
never held the fact — `no basis` says Convexa holds **both** numbers it needs and the *denominator* is
about zero, which is exactly why the dollar P/L in the neighbouring cell still renders a real figure
while this one does not.

**Two collision checks I ran rather than assumed.** (1) The word *basis* is never rendered as
user-facing text anywhere on this row: `MARK_BASIS_META` labels are `snapshot mid` / `modeled` /
`theoretical` / `last known` / `user-entered` and `ENTRY_BASIS_META` labels are
`user-entered price` / `filled at limit` / `trigger fill` — so "basis" is overloaded in *type names*
only, never in cells, and inside the `P/L %` column AC-27's own tips already teach *basis = what the
percentage is measured against*. (2) It is 8 characters — **shorter** than `unavailable` (11), which
already ships in this cell and in the 393px card's big live block, so it adds no overflow surface.

**Rejected, with the reason, so it is not re-litigated:** `no cost basis` — the word `Cost` is retired
from every surface that can show a credit (§4), and a near-zero net can be either sign. `net zero` /
`zero net` — a value statement in a percent cell reads as `0%`, the exact thing AC-26 bans.

---

## Q3 — the payoff-math copy set

### 3a. The label for the figure

```
Max loss
```

**Constant:** `MAX_LOSS_LABEL` (`positions/labels.ts`); bound into the `COLUMN_LABELS` /
`TABLE_HEADER_LABELS` pair by the FE lane exactly as every other header is.

**Renders:** the table's risk slot header (§4 *Flows* 2 — *"**what I can lose** (the risk slot)"*) and
as the label of **slot 3, item 5** of the §4 *mobile card at 393px* table (*"`Qty` · `Net
debit`/`Net credit` · `Mark` · expiry · **the risk slot**"*), i.e. `Max loss $560`.

**Rationale:** it is the trader's own term, it is the term the owner's ruling and every AC already use,
and it fits the 393px footer inside the proven envelope (`Net credit $115` is 15 characters).

The header keeps saying `Max loss` on a row whose cell carries a withheld reason instead of a figure —
the header names the question, the cell answers it.

**One wording constraint on the figure itself:** it renders as a plain `$560` — **never** `+$560` or
`−$560`. `money()`'s signed prefix is the P/L-direction convention, and a signed figure in an
explicitly untinted slot (§4 tint table: *"The risk slot (max loss / its reason) | a risk figure is not
a P/L direction"*) would make a direction claim in the one place §4 forbids one.

### 3b. The three withheld-reason strings — and the `Unlimited` verdict

Exactly three exist, per the Q2 ruling's closing sentence (*"the reason set is now (1) unbounded risk,
(2) multiple expirations, (3) unrecognised shape (`Custom`)"*). Delivered as one exhaustive
`{ label, tip }` record, matching the shipped `MARK_BASIS_META` / `ENTRY_BASIS_META` shape in the very
files that render this row — so a new member fails the build instead of vanishing:

**Constant:** `MAX_LOSS_WITHHELD_META: Record<MaxLossWithheldReason, { label: string; tip: string }>`
(`positions/labels.ts`). The discriminant's type name and its keys' final spelling are the architect's;
the three keys below mirror the ruling's own three classes.

```
unbounded        label: unlimited risk
multi_expiration label: mixed expiries
unnamed_shape    label: unnamed shape
```

```
unbounded.tip
  There is no worst case to compute here: this position keeps losing as long as the underlying
  keeps moving against it. Convexa won't print a figure it can't bound.

multi_expiration.tip
  This position's legs don't expire together, so there is no single expiration to measure a worst
  case at. Convexa won't pick one expiry and call it the answer.

unnamed_shape.tip
  Convexa doesn't have a name for this leg shape, so it has no payoff to compute a worst case
  from. Nothing is wrong with the position — it is held, priced and counted exactly like any
  other.
```

**Renders:** the `label` is the *one stated reason* in §4 *Component states* → **`Risk slot`** row
(*"one max-loss figure (untinted mono) **or** one stated reason"*), in both the table cell and card
footer slot 5. The `tip` has **two homes, one string** (so they cannot drift): the risk slot's tooltip,
and the assumption line in the leg disclosure — §4 *The leg disclosure*: *"When a max-loss figure or a
withheld reason exists, its assumption sentence also renders here as a line."*

**Rationale (one sentence):** all three labels answer the same question in the same grammar — *why is
there no figure* — in 13–14 characters, none is a number or number-shaped, and each names the
structural fact the closed set already knows rather than a diagnosis the recogniser would have to make.

**Verdict on PM's `Unlimited`: it does not survive as the string; its meaning survives inside
`unlimited risk`.** Bare `Unlimited` sits alone in a mono figure slot under a `Max loss` header and so
reads as a *value of max loss the app computed*, which gives the slot two grammars — one case answering
with a figure-shaped claim and two answering with a reason — and destroys the glanceable
figure-or-reason distinction the single risk slot exists to carry; `unlimited risk` keeps every bit of
the truth while making it unmistakably a statement about the position rather than a number.

**Also rejected, with reasons, so they do not come back:** `undefined risk` — trader-correct vernacular,
but it puts the literal token `undefined` in a cell and AC-26 requires that *"the literal text
`undefined`, `null` and `NaN` never appear in any cell"*, so a `toContain`-style oracle would
false-positive on honest copy and the test would get weakened to accommodate it. `no limit` — shorter and
true, but `limit` is heavily loaded on this exact surface (a pending row's `mark` cell literally renders
`limit $8.40`, plus `LIMIT_TIP` and the `Limit` entry mode), so `no limit` invites the reading "no limit
price was set" — two truths sharing one word, the error class R3 §1.3 exists to prevent.

### 3c. The figure's own assumption

```
Max loss assumes every leg held to expiration. Fees, slippage, assignment and taxes are not
modeled.
```

**Constant:** `MAX_LOSS_ASSUMPTION` (`positions/labels.ts`).

```
The most this position can lose, read from its own legs — not a quote, not a broker figure. It is
static: it doesn't move with the market, so it never dims when the feed drops. Max loss assumes
every leg held to expiration. Fees, slippage, assignment and taxes are not modeled.
```

**Constant:** `MAX_LOSS_TIP` — whose **tail is `MAX_LOSS_ASSUMPTION` verbatim** (compose it, do not
retype it; that is what keeps the tooltip and the disclosure line from drifting).

**Placement — consistent with what §4 already specifies, nothing new invented.** Two homes, both
already fixed: (1) the **cell tip** on the risk slot (§9 Q3: *"the assumption in the cell tip and as a
line in the leg disclosure"*) — that is `MAX_LOSS_TIP`; (2) the **leg-disclosure line** (§4 *The leg
disclosure*, quoted above) — that is `MAX_LOSS_ASSUMPTION` alone, since under a labelled figure the
line needs the assumption, not the definition. No footnote, no inline qualifier beside the figure: the
393px footer slot holds one figure or one reason and nothing else.

**Rationale:** §8 binds `model-read-carries-its-assumptions` (*"max loss carries its at-expiration
assumption"*), and the closing clause is byte-matched to the new `PL_TIP`'s *"Fees, slippage,
assignment and taxes are not modeled."* so the two figures on the same row disclaim identically.

---

## Q4 — the merge notice

```
Trades you tracked on a ticker page and the positions you opened here are now one book —
everything from both is in the list below. Nothing was deleted: your old records are still in this
browser, exactly as they were.
```

**Constant:** `MERGE_NOTICE` (`positions/labels.ts`).

```
Export an archive
```

**Constant:** `MERGE_NOTICE_EXPORT` — the pointer text AC-51 requires (*"points at export"*). It
deliberately mirrors the faulted banner's *"Export an archive of what loaded"* construction and, for
the same reason §4 gives there, it **does not rename the shipped `Export archive` action**
(`TR_EXPORT_LABEL`) and does not duplicate its button.

**Renders:** §4 *Banner region* priority **3** — *"at most ONE dismissible notice — the merge notice
first if pending"* — above the table, `info`-class, never during a faulted session (§4: *"While
faulted, no dismissible notice renders at all"*).

**Rationale:** it names the two places by *where the trader was* rather than by either store's name, so
it needs no jargon; `book` is already this surface's shipped word (`EMPTY_NO_POSITIONS`: *"Open one to
start your book."*); and the second sentence is the same reassurance clause the faulted banner and
`EMPTY_FAULTED` already carry, which is what keeps it from reading as an incident report.

**Verdict on `provenance.source_counts`: the notice states NO counts — not `read`, not `contributed`,
not a total.** Id collisions between the two stores are the **expected** case (§2.6), so `read` and
`contributed` legitimately differ for exactly the trader this notice is written for, and a notice
quoting either number hands that trader arithmetic that looks like a shortfall — "why did I lose
records?" — about a migration that lost nothing; even a single total invites a mismatch against what
they remember seeing across two pages. The counts stay in `provenance`, where §2.6 already makes them
*"inspectable rather than mysterious"* for support, and out of the trader's read.

---

## Q5 — the stale-saved-view notice

**I REPLACED the §4 candidate**, by one word and one binding. The candidate was:

> **"'Tech swings' filtered on a strategy Convexa no longer has. That filter is off — everything else
> in the view is unchanged. Save the view to keep it this way."**

Final:

```
“Tech swings” filtered on a structure Convexa no longer has. That filter is off — everything else
in the view is unchanged. Save the view to keep it this way.
```

**Constant:** `staleViewNotice(viewName: string)` — a camelCase interpolating copy function, matching
the shipped `money` / `pct` in this file and `trEmptyBody` / `trCoverage` / `trEpoch` in
`outcomes/copy.ts`; `“Tech swings”` above is the interpolated `viewName`, shown with the sample name
§4 uses.

**Renders:** §4 *Stale-saved-view notice* — `info`-class, `info.main` link colour, no burnt orange, no
warning icon, one line, dismissible, above the table, priority 3 in the banner region, never during a
faulted session; the store is not written until the user saves. All of that is unchanged.

**What changed and why:** `strategy` → **`structure`**. This feature renames that axis
(§4 *Flows* 5: *"`strategy` → `structure`"*; §1: *"the visible set stays fixed with `strategy` →
`structure`"*), so a notice saying *strategy* would name a concept the surface no longer shows the
trader — DESIGN_RULES §6, name things by what people control. The two remaining sentences are confirmed
**verbatim**, including *"Save the view to keep it this way"* over any "we fixed your view", which is
§4's own stated reason for the phrasing. The view name is wrapped in typographic quotes per the shipped
precedent in `trCoveragePartial` (*“of M”*) rather than the candidate's straight single quotes, which
sit badly beside apostrophes in the same banner region.

---

## Verify by

No `Verify by` marking in §3 changes. For the record, so the synthesizer folds without guessing:

- **AC-26 / AC-29 stay `test`.** What is automated is the *negative space* — never `±Infinity`, never
  `0`, never blank, never a bare `—`, never a computed number, never the literals
  `undefined`/`null`/`NaN` — which regresses silently and is invisible to review.
- **AC-28 stays `test`** for the figure and its eligibility (arithmetic and closed-set membership);
  §7's review list already carries *"the assumption sentence on max loss"*, and the two are consistent:
  presence is assertable, wording is reviewed.
- **AC-51 stays `review`.** The merge notice is visible, intentional copy.
- **One addition to §7's "Verified by review" list:** the **three withheld-reason labels and their
  tips**, alongside the assumption sentence already listed there. Their *wording* is review-class; their
  *presence-instead-of-a-number* stays inside AC-29's `test`.

---

## Register check

- **Subject and stance.** `Convexa` is the actor that declines rather than guesses —
  `Convexa won't invent one`, `Convexa won't print a figure it can't bound`,
  `Convexa won't pick one expiry and call it the answer` — the same construction as the shipped
  `Convexa won't guess it` (`NOT_RECORDED_TIP`) and `Convexa can't price this position`
  (`UNPRICEABLE_RECORD_TIP`).
- **The reassurance clause.** *"Nothing was deleted: your old records are still in this browser, exactly
  as they were"* is the same clause, same order, as `EMPTY_FAULTED` and the faulted banner, and as the
  shipped `TR_IMPORT_FOOTER` (*"Nothing was deleted or overwritten."*) and `TR_UNREADABLE_BODY`.
  No apology, no "oops", no "something went wrong", no error code anywhere in this pass.
- **Cell literals stay short and lowercase.** `no basis` (8) · `unlimited risk` (14) ·
  `mixed expiries` (14) · `unnamed shape` (13) — against the shipped `unavailable` (11) and
  `not recorded` (12). The two longest are still inside the 393px footer envelope `Net credit $115`
  (15) already occupies.
- **Reason-plus-why grammar** matches the shipped `TR_REASON_LABEL` pattern (*"Couldn't link to its
  decision — not counted"*): a short label in the slot, the why in the tip.
- **Vocabulary is house vocabulary.** `book` (`EMPTY_NO_POSITIONS`), `expiry`/`expiries` (the `Expiry`
  header), `shape` (`STRUCTURE_TIP`: *"The shape Convexa reads from your legs"*), `legs` (`LEGS_TIP`),
  `net debit`/`net credit` (§4's Cost-retirement table). The retired word `Cost` appears nowhere,
  including in the `no_basis` tip where it would have been the lazy choice.
- **Punctuation.** Sentence case, em dash for the aside, straight apostrophes as in
  `ROW_UNAVAILABLE_TIP` and every §4 constant, typographic quotes only around the interpolated view
  name. No abbreviations (`Dr`/`Cr`/`max L`) — §4's *"abbreviating into an 11px floor is a slop tell"*.
- **No new tint, no new state, no new placement** is implied by any string here; every one lands in a
  §4 row that already exists.

---

## Objections

Two, both **coverage consequences of the words I was asked to supply** rather than disagreements with a
behaviour. Neither changes a string above; routing them is the conductor's call.

1. **AC-31 now under-counts the cell literals.** It reads *"`—` (not applicable), `unavailable` (failed
   this cycle) and `not recorded` (the saved record never held this fact) are **three** distinct
   literals with **three** distinct testids, never rendered for each other's meaning"* — and §2.2 says
   *"Exactly **three** not-a-number readings exist"*. With `no basis` + `cell-no-basis` delivered per
   council #13 and §4's `P/L% cell` row, the surface renders **four** not-a-number cell literals. Its
   negative space is already covered by AC-26 (near-zero net never shows `±Infinity`, `0` or a blank),
   but **nothing asserts `no basis` is distinct from the other three**, which is precisely the
   distinction §7 invariant 5 calls *"the distinction most likely to regress quietly"*. Recommend AC-31
   be restated as four literals / four testids. I have not touched AC-31.

2. **The risk slot's table home is under-specified against §1.** §4 *Flows* 2 puts the risk slot in the
   row's left→right order (*"**what I can lose** (the risk slot) → **when does it end** (expiry)"*),
   which implies a new visible table column, while §1 Out-of-scope states *"the visible set stays fixed
   with `strategy` → `structure`"* and AC-27 states *"No new column is added"* (of the P/L% basis tip).
   `MAX_LOSS_LABEL` is bound to whichever cell §4 means, and the card footer is unambiguous either way
   (slot 5 of five) — but whether the table gains a `ColumnKey` is an architecture/PM call, and if it
   does, §1's sentence is incomplete. I have not changed either sentence.
