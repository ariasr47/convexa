# R3 — pm ⇄ ux technical resolution: broker-option-grouping

Three conflicts in `r3-pair-pm-ux.json`. **All three resolve.** One converges on ux's own
self-revision, one I concede outright, one converges on a three-way split of my AC-6.

Nothing below reopens a withdrawn conflict. Where I cite the BRIEF I mean the **2026-08-06 corrected**
book: 14 holdings — 5 equity rows + 9 option legs — **TSLA 3 · AAPL 2 · META 2 · NVDA 1 · PLTR 1**,
i.e. **3 groups + 2 lone option legs**.

---

## Conflict 1 — fidelity notes inside an expanded group (raised by pm against ux)

**CONVERGED.** Ux withdrew the dedup by self-revision in R2, so there is nothing left to argue; I am
recording the landing and correcting my own supporting fact rather than restating the case.

**Resolution.** AC-5 stands unchanged for v1 — expanding a group reveals the per-leg rows exactly as
they render today, fidelity notes included, nothing dropped and nothing hoisted. Repeated fidelity
notes inside a large expanded group is recorded as a **future-dated read-density item**, revisited
only **if a real book ever produces a group of more than four option legs**; if the wall is judged
intolerable then, it lands as its own change with its own AC, never as a silent subtraction from
AC-5. My R2 escalation clause ("becomes an owner question at R3") is withdrawn — it was conditional
on ux still wanting the hoist, and ux does not.

**Correction to my own R2 reasoning, on the record.** I argued this partly on "the largest expanded
group is 2 legs and 2 notes". That was the pre-correction book and it is **false** — TSLA carries
**3** legs, so the largest expansion today is 3 rows. The conclusion is unchanged (3 repeated lines
is not a wall), but the *trigger* had to move: my R2 proposal pinned the revisit to "more than three
identical note lines", which the real book would satisfy on day one and would reopen this the moment
it shipped. **Ux's threshold (more than four legs) is the one that goes in the spec**, not mine.

**AC changes:** none. AC-5 as written in R1-pm.

---

## Conflict 2 — a leg count on an ungrouped single-leg option row (raised by ux against pm)

**CONCEDED.** I withdraw "The count is shown on *every* option holding, grouped or not" (R1-pm §2)
and the leg-count clause in AC-23. The leg count renders **only on a group header, i.e. only where a
collapse is hiding rows**.

Ux's argument (b) is the one that decides it and it is mine turned against me: I said the count "is
what makes the collapse safe to trust", and on a row where nothing is collapsed it has no job to do.
Argument (a) then makes it actively harmful — it puts a new visible string on a row the owner
live-verified byte-for-byte on 2026-08-05, spending the zero-regression property for uniformity
nobody asked for. And the corrected BRIEF **strengthens ux, not me**: there are now **two** lone
option legs (NVDA and PLTR), not one, so the string would land on two of the five option entries and
"1 option leg" would be the second-most-common count on the tab.

I also withdraw my R1 assumption that "AC-23's missing expander is the only visible difference
between it and a group". A singleton is not a group with a control removed; it is not a group.

**AC-23, new wording:**

> **AC-23 (S4).** A ticker with exactly one option leg renders as today's ungrouped option row: no
> leg count, no `grouped by underlying` clause, no expander or chevron, no group header styling —
> the same fields, the same not-a-number literals and the same entry figure it renders before this
> feature. On the owner's captured book this covers both the NVDA leg and the PLTR leg.
> **Verify by: test.**

**Verification moves from `review` (non-blocking) to `test` (blocks the ship).** This is now pure
negative space — a count or a chevron leaking onto a singleton is an additive regression a reviewer
scanning a busy tab will not reliably catch on the *second* lone row — and it is exactly what ux's
own R1 §9 already classified: *"A ticker with 1 option leg produces no group and no chevron | test |
Negative space."* Ux's proposal left it `review`/non-blocking, but only inside the branch where I
insisted on uniformity; I did not, so ux's §9 guidance governs and neither of us is being overruled.

**Consequential edit forced by the corrected BRIEF (arithmetic, not a new decision).** AC-1 still
says "4 collapsed groups + 1 lone leg":

> **AC-1 (S1).** With the owner's real captured book served, every underlying holding ≥2 option legs
> renders as ONE collapsed row: the 9 loose option-leg rows become 5 ticker entries — **3 collapsed
> groups (TSLA 3 legs, AAPL 2, META 2) + 2 ungrouped single-leg rows (NVDA, PLTR)** — alongside the
> 5 unchanged equity rows. **Review arm (one-time, owner):** the tickers and leg counts on the tab
> match what the Webull app shows. **Verify by: test + review.**

---

## Conflict 3 — AC-6 equates a leg count with a position count (raised by ux against pm)

**CONVERGED on ux's split, with the third criterion sharpened so it cannot pass by coincidence.**

Ux is right and the flaw is mine: AC-6 as written is satisfied today only because every Webull option
row maps to exactly one leg. A test written to it pins that coincidence, stays green on the day the
two integers diverge, and the thing that breaks first is not the arithmetic — it is the **copy**, a
header reading "4 option legs" above a disclosure containing three rows.

### Which integer the user-facing count is counting

**The visible count on a group header is the LEG count** — the architect's `leg_count` (Σ over the
group's members), never `position_count`. Three reasons, and they are the ruling:

1. The BRIEF's deliverable is "a **leg count**", and the honest unit of "what am I carrying on this
   name" is legs. A broker position is a bookkeeping artifact of the adapter; the trader never sees
   one and cannot act on one.
2. The count's job is to make the collapse trustworthy — to tell the reader **how much is behind the
   chevron**. That is a statement about what the disclosure contains, and what it contains is legs.
3. `position_count` keeps its own separate job, below, where it is load-bearing and invisible.

**The position count is the invariant's integer, not the copy's.** Nothing-is-lost is a claim about
the broker's book, so it is counted in the broker's own unit.

### AC-6 replaced by three criteria

> **AC-6 (S5) — nothing is lost.** With every group collapsed, the number of broker positions
> reachable on the Broker tab equals the position count the broker reported for that book: the sum
> of every group's member-position count, plus every ungrouped top-level entry (single-leg option
> rows, equity rows, and any `unrecognized` entry). Collapsing never makes a position unreachable or
> uncounted. **Verify by: test. Blocks the ship.**
>
> *Verification note for GATE Q:* this must be exercised on at least one book in which a member
> position carries more than one option leg, so that a leg-counting implementation fails it. On the
> owner's captured book alone the criterion is indistinguishable from the old one.

> **AC-6b (S1, S4) — what the header's number means.** A collapsed group header states the number of
> option **legs** in the group, with the noun "legs", and states no other count: never a number of
> positions, rows, holdings, contracts, or trades. On the captured book the three group headers read
> 3, 2 and 2. **Verify by: review.**

> **AC-6c (S5) — the noun tracks the number.** Expanding a group reveals exactly as many option legs
> as its header counted. The surface never states a leg count it cannot show behind its own chevron.
> **Verify by: test. Blocks the ship.**
>
> *Verification note for GATE Q:* same requirement as AC-6 — exercised on a book where at least one
> member position carries two option legs, so the criterion distinguishes legs from rows instead of
> passing on today's one-leg-per-row coincidence.

Together these say: today AC-6 and AC-6c are satisfied by the same book; the day a multi-leg adapter
lands they are satisfied by different facts, and **AC-6c is the criterion that goes red first** —
which is the correct place for the failure, because the copy is what would otherwise quietly start
lying. This also closes ux's own R1 Risk 5 ("the count noun must track what expands, or the copy must
change with it") as a checkable property rather than a note.

I am deliberately **not** ruling here what the copy becomes when the two integers diverge. That is a
question for the adapter that causes it, with a real book in hand; AC-6c makes it impossible for that
day to arrive silently, which is all v1 owes it.

---

## Every AC touched by this exchange

| AC | Change | Verify by |
|---|---|---|
| AC-1 | Restated to the corrected book: 3 groups + 2 lone legs, not 4 + 1 | test + review (unchanged) |
| AC-5 | **Unchanged** — dedup rejected by both lanes; density future-dated at >4 legs | test (unchanged) |
| AC-6 | Replaced: nothing-is-lost restated over **positions**, with an anti-coincidence verification note | test, blocks (unchanged) |
| AC-6b | **New** — the header's visible number is the **leg** count, noun "legs", no other count | review |
| AC-6c | **New** — expanding reveals exactly the counted number of legs | test, **blocks** |
| AC-23 | Rewritten: a single-leg ticker renders today's row with **no leg count**, no clause, no expander | **review → test**, **non-blocking → blocks** |

Withdrawn from R1-pm: §2's "The count is shown on *every* option holding, grouped or not"; the
assumption that a missing expander is the only visible difference between a singleton and a group;
and the R2 dedup-revisit threshold of three identical note lines.

**Unresolved: none. Promoted to the owner from this pair: none.** The two product questions on this
feature (`Build reassessment` placement, and the `unrecognized` mobile-parity scope call) are routed
elsewhere and are untouched by this exchange.
