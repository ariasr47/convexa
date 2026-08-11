# R3 — architect ↔ pm technical resolution (pm side): broker-option-grouping

Six conflicts. **Four CONCEDED or CONVERGED on facts I verified myself, two CONVERGED because the
architect already superseded their own R1 at R2.** Nothing here is UNRESOLVED and nothing is promoted
to the owner from this pair.

I re-measured the two load-bearing facts rather than take them on authority:

- `apps/api/tests/fixtures/broker/positions_raw.json` holds **14 holdings** — 5 equity
  (AMD, AAPL, INTC, MU, SPCX) and 9 option legs on **TSLA 3 · AAPL 2 · META 2 · NVDA 1 · PLTR 1**.
  The architect's composition is correct and mine was wrong.
- The `debit` / `credit` direction word **ships today** on a broker row
  (`brokerView.ts:216`) and on both sim form factors (`PositionRow.tsx:393`,
  `PositionCard.tsx:190`). The architect's premise is correct and mine was wrong.

---

## Conflict 1 — AC-1's book composition — **CONCEDED**

I withdraw "4 collapsed groups + 1 lone leg" and the "13-position book" that travels with it. Both
were inherited from `OPEN_THREADS.md` §7z and repeated in the BRIEF; the BRIEF has since been
corrected at R2 and my AC-1 had not caught up. The architect is right that a ship-blocking `test`
arm cannot assert a count the fixture contradicts.

**On the architect's ask (14 vs 13, which book is authoritative):** they are two different books and
the AC was conflating them. The **captured fixture is authoritative for the test arm** — it is the
only book a test can be run against, and I have no evidence the owner's 2026-08-05 live book
differed; "13" is an inherited error, not an observation. The **owner's live book is authoritative
for the review arm only, and the review arm must assert no absolute count**, because the live book
changes between now and the verify. So AC-1 splits in two.

**AC-1 (test · blocks ship) — new wording:**
> Served the captured broker book (14 broker positions: 5 equity rows and 9 option legs), the Broker
> tab renders the 9 option legs as 5 ticker entries — 3 collapsed groups (TSLA 3 legs, AAPL 2 legs,
> META 2 legs) and 2 ungrouped single legs (NVDA, PLTR) — alongside the 5 unchanged equity rows, for
> 10 top-level entries in total.

**AC-1b (review, one-time with the owner · blocks ship) — new AC:**
> Against the owner's live book, every ticker on the Broker tab shows the same option-leg count the
> Webull app shows for that ticker, and no option leg the Webull app shows is missing from the tab.
> No absolute position count is asserted by this arm.

Two consequences I am recording rather than re-deciding:

- **TSLA is not a vertical** — +10 / −4 / +4, mismatched sizes. The rejected qty+opposite-side
  pairing heuristic would mis-pair the owner's **actual** book today. That moves "inferring pairs
  from matching quantity + opposite side" from a future hazard to a present one in my Out list; the
  wording there ("rejected, not re-litigable") stands and is now evidenced.
- **AAPL carries both an equity row and a 2-leg option group**, so AC-22 (equities never join a
  group, no figure spans shares and option legs) has a live instance on the captured book and does
  not need a constructed one.

---

## Conflict 2 — the compounding claim and AC-10 — **CONCEDED**

I withdraw the multiplier-of-four framing entirely. The architect's measurement defeats it on three
independent grounds, and I accept all three: there is no four-leg group (largest is TSLA at 3); the
residuals are **signed** and therefore cancel as readily as they accumulate (TSLA **$0.00**, AAPL
**$0.00**, worst real gap META **$3.00**); and the binding guard is **proportional** (0.5% of the
leg's cost), not the flat $0–$2 band I cited — so the copy cannot promise a dollar figure in either
direction. My risk bullet "the reconstruction gap compounds at group level… up to ~$8" is withdrawn
and restated below.

The product consequence I want the synthesizer to carry: **the residual is invisible inside Convexa.**
AC-8 is exact arithmetic over figures Convexa itself renders and is unaffected. The gap exists only
against Webull's own displayed totals, which this app never shows — so it surfaces in exactly two
places: the owner's eyeball cross-check (AC-1b) and the disclosure copy. That is why the disclosure
must state a mechanism, not a number.

**AC-10 (review · blocks ship) — new wording:**
> The group's net entry is never presented as Webull's own figure. Its disclosure states that the
> figure is Convexa's own sum of Webull's per-leg costs, resting on a contract size Convexa worked
> out rather than one Webull stated, and that it may therefore differ slightly from the total the
> Webull app displays. **The copy states no dollar amount and no dollar band for that difference.**

**AC-10b (review · does not block) — new AC:**
> If the disclosure quantifies the possible difference at all, it does so as a proportion of the
> position's cost — never as a fixed dollar figure, and never as a per-leg figure multiplied by the
> leg count.

**Restated risk (replaces the compounding bullet):** each leg's reconstruction reproduces Webull's
own per-leg total to within 0.5% of that leg's cost; the group net is a signed sum, so those
residuals may cancel or accumulate; measured on the captured book the group-level differences are
$0.00 (TSLA), $0.00 (AAPL) and $3.00 (META). The real risk is not magnitude — it is that the owner
compares a group against the Webull app, sees a few dollars, and reads it as a bug. AC-10 is the
mitigation, and it is a review-verified copy criterion because the divergence is visible and
intentional, not a silent regression.

**Withdrawn ask:** my R2 ask on summing order is answered — no summing order reduces the residual,
because it is fixed per leg before the group sees it. I withdraw the ask; no copy depends on it.

**Rider, answering the architect's R2 ask #4 (multiplier provenance):** no AC of mine turns "the ×100
came from reconstruction rather than from Webull" into a per-leg checked claim. AC-9 and AC-10 state
it as a blanket property of the group's basis — an accepted limitation, true of all 9 captured legs —
not a per-leg provenance read. No wire field is required and the empty `apps/api` diff holds.

---

## Conflict 3 — `net debit` / `net credit` at group level — **CONCEDED**

My premise is falsified by the shipped surface, and I verified it: `$7,890.00 debit` renders today on
a **single-leg** NVDA broker row, where there is no structure to claim. Debit/credit names the
direction of cash, not a shape. I withdraw ruling 4's sentence "A `net debit / net credit` pair is
spread vocabulary and would smuggle in through the label exactly the structure claim the feature
bans." The architect's second point is decisive on its own: the direction word is the only carrier of
sign, so banning it would make AC-8 unverifiable by the owner.

What survives from my ruling is narrower and I want it kept: the group renders **one figure**, not a
pair of separate debit and credit totals. That was the thing actually worth banning.

**AC-9 (review · blocks ship) — amended:**
> A group's net entry renders as ONE figure — the magnitude plus the same direction word the per-leg
> rows already render (`debit` / `credit`) — never as two separate totals, and never with a direction
> word or label the child rows do not use. It carries a label naming both what it is (the sum of
> Webull's own per-leg costs for this ticker's option legs) and what it rests on (a contract size
> Convexa reconstructed, not one Webull supplied). A group net-entry dollar figure with an unnamed
> basis never renders.

**AC-9b (test · blocks ship) — new AC, the sign edge split out:**
> A group whose signed net is a credit renders the credit direction word with a positive magnitude —
> never a minus-signed debit, never a bare magnitude.

One correction to the architect's supporting example, from the same fixture: **the credit case is not
live on the captured book.** AAPL nets 6,920 − 3,070 = **+3,850 (a debit)**; TSLA nets +13,760 and
META +3,802, also debits. All three captured groups are net debits. So AC-9b needs a **constructed**
book, and must not be assumed covered by the real-book arm — which is exactly why it is its own AC
rather than a clause inside AC-9. The word `credit` does ship on child rows today (AAPL's short leg),
so the child/parent consistency case is live even though the group-level credit is not.

If I ever want the word gone, that is a change to the shipped per-row surface and a separate change.
Agreed, and not pursued.

---

## Conflict 4 — AC-16 and the `—` in the quantity slot — **CONVERGED**

Already conceded in my R2 self-revision; the architect's proposal and mine agree in substance. Final
wording, so the executor reads one thing rather than two:

**AC-16a (test · blocks ship):**
> In a group row's NET ENTRY and MODELED P/L slots, the only not-a-number literals that can render
> are `not provided` and `unavailable`. `not recorded` renders nowhere on any broker surface, and
> `no basis` renders nowhere on a group row.

**AC-16b (test · blocks ship) — stated as a positive assertion, not a ban:**
> A group row's quantity slot renders `—`. Never blank, never a summed or netted quantity, never `0`.

AC-3 stands unchanged (no quantity **figure**, no percent figure on a collapsed group row) — `—` is
not a quantity figure, which is why the two do not collide.

**Carried, not decided here:** the mobile card has no quantity column, so where the not-applicable
fact lands on the card is a pm↔ux question (my R2 ask to UX) and belongs to that pairing or R4. My
constraint on it: if the card renders a quantity slot for a group at all it renders the same `—`, and
if it omits the slot the omission must be a stated ruling, not a silence — for the same reason UX
ruled the card's missing modeled-P/L slot a defect.

---

## Conflict 5 — the AND-booleans vs the counts AC-17 needs — **CONVERGED**

The architect superseded their own R1 struct at R2, accepting UX's two-count proposal, and confirmed
the per-leg cause is reachable without re-projecting through `buildPositionView`. That is the "yes"
my R2 ask asked for, so **AC-17 stands and I do not re-cut it.** The layer exposes the never-supplied
count, the unparseable count, the missing-contract-size count and the contributing-leg total; the
group's literal is derived from those causes rather than from an AND.

**Answering the architect's ask — one number or the cause-split pair:** the criterion asserts **one
number, and it is the count for the cause the rendered literal names.** The reader is being told why
*this* literal is showing, not handed an inventory; a group displaying two counts under one withheld
figure re-creates the arithmetic the feature exists to kill. The cause split lives in the layer so the
right number can be chosen — it does not reach the render.

**AC-17a (review · blocks ship) — amended:**
> Beside a withheld group net, the group states how many of its contributing legs could not supply
> the fact **for the cause the rendered literal names**, out of the group's contributing-leg total
> (e.g. "1 of these 3 legs"). A leg whose contract size could not be reconstructed counts toward the
> `not provided` cause. The legs that do have costs still show them on expand, so a refusal to net is
> visibly not a failure to read.

**AC-17b (test · blocks ship) — new AC, the mixed-cause case split out:**
> When causes are mixed within one group, the group renders `not provided` (AC-15, permanence-first)
> and the count beside it counts only the legs whose fact was never supplied — never the sum of both
> causes, and never the unparseable count. No second count renders.

AC-17b is a `test` and AC-17a a `review` deliberately: the visible presence of a count is checkable by
eye, but *which* count was chosen under mixed causes is exactly the kind of off-by-one that ships
silently and reads as a wrong claim about the owner's money.

---

## Conflict 6 — a group-level percent and `plPctStateOf` — **CONVERGED**

The architect self-revised at R2 and removed the group percent entirely — no computed percentage, no
denominator held, no call to `plPctStateOf` at group level. That is the stronger branch of my own
proposal ("if the field is dead weight, drop it; I care about the render"), and all three lanes now
agree. `no basis` is unreachable at group level **by absence rather than by rule**, which is better
enforcement than the ban I wrote.

No new AC. The observable is already carried by AC-3 (no percent-return figure on a group row) and
AC-16a (`no basis` renders nowhere on a group row). `no basis` remains reachable on leg rows exactly
as today.

**Future-dated, unchanged:** a per-group percent lands only once a signed near-zero denominator has a
stated meaning, and `plPctStateOf` is its single authority when it does — not now.

---

## Net effect on my AC table

| AC | Change |
|---|---|
| 1 | **Rewritten** — 3 groups + 2 lone legs against 14 served positions; fixture is the authority |
| 1b | **New** (review, owner, no absolute count) — split out of AC-1 |
| 9 | **Amended** — one figure, magnitude + the same direction word the child rows use |
| 9b | **New** (test) — the net-credit sign case; needs a constructed book, not the captured one |
| 10 | **Rewritten** — mechanism, not a dollar band; no dollar figure in the copy |
| 10b | **New** (review, non-blocking) — any quantification is proportional, never a dollar |
| 16 | **Split** into 16a (net-entry / P-L literal set) and 16b (`—` in the quantity slot, asserted) |
| 17 | **Amended** to 17a — one count, for the cause the rendered literal names |
| 17b | **New** (test) — the mixed-cause count |

Blocks the ship: 1, 1b, 9, 9b, 10, 16a, 16b, 17a, 17b. Does not block: 10b.
Everything else in my R1 and R2 stands as written. The two owner questions already routed
(`Build reassessment` placement, and whether the mobile/desktop `unrecognized` parity repair rides in
this feature) are untouched by this exchange.
