# R3 — architect ⇄ pm resolution: broker-option-grouping

One exchange, six conflicts. Facts below were re-measured at this round against the working tree;
every citation is `path:line` and every number was recomputed, not carried over from R2.

Two claims of my own are **withdrawn** here (conflict 3's "a group net CAN be a credit on this
book", and — already withdrawn at R2, restated as final — the group `pl_pct` field). Both are noted
in place rather than buried.

---

## 1. AC-1's group/lone-leg split — **CONVERGED**

**Resolution.** The captured book is authoritative for the test arm, and it holds **14** broker
positions — **5 equity + 9 option** — whose option legs fall on five tickers as **3 collapsed groups
(TSLA 3 legs, AAPL 2, META 2) + 2 lone legs (NVDA, PLTR)**. AC-1 states that; the parenthetical
"4 collapsed groups + 1 lone leg" is dropped.

**Fact, recomputed at this round** from `apps/api/tests/fixtures/broker/positions_raw.json`
(`"captured": true`, one page, `has_next: false`):

| | equity | option |
|---|---|---|
| rows | AMD, AAPL, INTC, MU, SPCX (5) | NVDA ×1, PLTR ×1, TSLA ×3, AAPL ×2, META ×2 (9) |

TSLA = `1061776505` (+10), `1062038045` (−4), `1062257958` (+4) — **mismatched sizes, not a
vertical**. AAPL = `1061783502` (+10), `1061810138` (−10), plus a **separate equity row**
`913256135`, which is the live instance of the equities-excluded rule. The adapter suite pins the
shape (`apps/api/tests/test_broker_adapter.py:295` → `len(book.positions) == 14`; `:331` →
`{exact: 5, partial: 9, unrecognized: 0}`). The BRIEF's R2 correction block (lines 11–23) already
carries exactly these numbers, so the council canon and the fixture now agree.

**The one residual, and its resolution.** The BRIEF's Decision-impact paragraph still says "the
owner's live **13**-position book" (`BRIEF.md:36`) and PM's R1 risk section repeats it. The fixture
says 14. Nothing in the repo pins a 13-position book, so **13 is unverifiable and 14 is checkable** —
the fixture is authoritative wherever an AC is testable, and any surviving "13" belongs only to a
review-arm anecdote about the owner's live account on a different date, if at all. My R2 ask to PM is
answered by that rule and needs no further round.

---

## 2. "Roughly four times what the owner saw row-by-row" — **CONVERGED**

**Resolution.** The multiplier-of-four framing is dropped. The disclosure rests on a **proportional
per-leg guarantee**, not a dollar band: each leg's reconstructed cost reproduces Webull's own
`total_cost` to within `max($0.01, 0.5% × |total_cost|)`
(`apps/api/src/broker/webull_adapter.py:211-214`, guard 3). The group net is a **signed** sum, so
per-leg residuals cancel as readily as they accumulate. Any number in the copy must be a
percentage-of-cost statement or a measured group figure — never a flat dollar band, and never a
"×N legs" multiple.

**Facts, recomputed leg-by-leg** (Convexa `unit_cost × 100 × qty` minus Webull's `total_cost`;
fixture line numbers from `positions_raw.json`):

| leg | qty | unit_cost | Webull total_cost | Convexa | residual |
|---|---|---|---|---|---|
| NVDA `1058096497` (:83) | +10 | 7.89 | 7,889.00 | 7,890.00 | **+1.00** |
| PLTR `1058322781` (:98) | +2 | 24.95 | 4,990.00 | 4,990.00 | 0.00 |
| TSLA `1061776505` (:113) | +10 | 10.62 | 10,620.00 | 10,620.00 | 0.00 |
| AAPL `1061783502` (:128) | +10 | 6.92 | 6,920.00 | 6,920.00 | 0.00 |
| AAPL `1061810138` (:143) | −10 | 3.07 | −3,070.00 | −3,070.00 | 0.00 |
| TSLA `1062038045` (:158) | −4 | 8.49 | −3,397.00 | −3,396.00 | **+1.00** |
| TSLA `1062257958` (:173) | +4 | 16.34 | 6,537.00 | 6,536.00 | **−1.00** |
| META `1062622359` (:188) | −5 | 10.49 | −5,246.00 | −5,245.00 | **+1.00** |
| META `1062651284` (:203) | +5 | 18.10 | 9,048.00 | 9,050.00 | **+2.00** |

Group level: **TSLA $13,760.00 vs $13,760.00 → $0.00**; **AAPL $3,850.00 vs $3,850.00 → $0.00**;
**META $3,805.00 vs $3,802.00 → $3.00**. The worst permitted (not observed) TSLA-group gap is
Σ max(0.01, 0.5% × |total_cost|) = 0.005 × 20,554 ≈ **$102.77** — which is why the flat band cannot
be promised in either direction.

**Answer to PM's summing-order ask: the order is irrelevant, and there is no cheaper order.** The
residual is fixed per leg *before* the group exists: it is created inside `_derive_multiplier`'s
rounding (`webull_adapter.py:205-206`, `mult = round(total_cost / (unit_cost × qty))`), backend-side,
one leg at a time. The FE only ever sums `legCost` (`positions/leg.ts:74-76`,
`sideSign × entry_price × multiplier × qty`) over legs that already carry that residual. A
"multiply once over a summed per-unit cost" order is not merely worse — it is **undefined**, because
the legs have different `unit_cost` and different `qty`, so there is no shared per-unit figure to
multiply. Nothing about the group's arithmetic changes the number, and no disclosure wording is
constrained by summing order.

---

## 3. `net debit` / `net credit` at group level — **CONVERGED, with one of my own claims withdrawn**

**Withdrawn.** My R2 sentence "a group net CAN be a credit on this book's shape (AAPL: 6,920 − 3,070)"
is wrong: 6,920 − 3,070 = **+3,850, a debit**. Recomputed, **all three groups on the captured book net
to a debit** (TSLA +13,760.00, AAPL +3,850.00, META +3,805.00). A group-level credit is reachable but
is **not** present on this book. I withdraw the "live, not theoretical" framing for the group case.

**The argument does not depend on it, and stands on two facts.**

1. `credit` **ships today on real rows of this very book**, at member level: the short legs
   (`1061810138` −10 @ 3.07, `1062038045` −4 @ 8.49, `1062622359` −5 @ 10.49) each render
   `$X credit` via `brokerView.ts:213-216`
   (`` `$${Math.abs(base.net_entry_cost)…} ${base.net_entry_basis === 'net_debit' ? 'debit' : 'credit'}` ``),
   painted into the visible `Net entry` cell at `BrokerPositionRow.tsx:314-317`. A single-leg NVDA row
   renders `$7,890.00 debit` with no structure to claim, so **the word names the direction of cash, not
   a shape** — the premise "spread vocabulary" is falsified by the shipped surface this feature nests
   inside.
2. `net_entry_text` formats `Math.abs(...)`. **The direction word is the only sign carrier.** Strip it
   and the group's figure is unsigned, which breaks AC-8's "the owner can confirm it by adding the rows
   they can see" — and it would put an unsigned `$3,850.00` directly above `$6,920.00 debit` and
   `$3,070.00 credit` in the same column.

**Resolution.** The group struct carries `basis: 'net_debit' | 'net_credit'`, derived from the sign of
the group's own `Σ legCost` over the union of member legs (`> 0` debit, `< 0` credit —
`positions/leg.ts:86`), **never** copied from a member. A sign carrier is non-negotiable; **which word
renders is UX's copy call**, subject to one binding constraint from my lane: the group and its children
must use the **same** word for the same direction. Removing the word from the shipped per-row surface
is a separate change, not this one.

**One bounded consequence I will name rather than paper over.** A group net can land within
`NET_BASIS_EPS` (0.5, `positions/leg.ts:68`) of zero — much more reachable at group scale than at
position scale, because opposite-side legs on one ticker subtract. At that magnitude the sign is float
noise and the direction word can flip between refreshes. The group inherits the shipped formatting
**unchanged** (no new state, no new literal); making it better requires a stated meaning for a signed
near-zero net, which is the same Future-dated blocker PM named for the group percent, and it stays
Future-dated here too.

---

## 4. AC-16 vs `—` in the group's quantity slot — **CONVERGED (PM self-revised; I take the revision as written)**

**Resolution = PM's own R2 split of AC-16**, which grants what I raised: (a) the only not-a-number
literals reachable in a group's **net entry** and **modeled P/L** slots are `not provided` and
`unavailable`, and `not recorded` and `no basis` render nowhere on a group row; (b) a group row's
**quantity slot renders `—`** — never blank, never a summed or netted quantity, never `0`. AC-3 stands.
Nothing further is in dispute between us.

**The data-layer half, so no executor has to re-decide it.** The group struct carries **no quantity
field of any kind** (R1 non-goal 6: a signed leg set has no scalar size). `—` is therefore not a value
the layer computes and hands over — it is the renderer's not-applicable literal for a slot the data
deliberately does not fill. That makes "a group never renders a summed quantity" true **by absence**
on every form factor, which is the enforcement I asked for.

**PM's open ask to UX about the mobile card is not blocked by anything in my lane.** Whether the card
carries a not-applicable slot or has no quantity slot at all is layout, and the struct is identical
either way; my only constraint is that neither form factor may render a blank where the other renders
a literal, and neither may render a number.

---

## 5. `entry_known` / `multiplier_known` AND-booleans vs counts — **CONCEDED**

**I withdraw the two-boolean struct.** PM and UX are right and the counts are buildable today with no
wire change and no re-projection.

**Answer to PM's reachability ask: YES, without `buildPositionView`.**
`BrokerPositionView.broker: BrokerPosition` (declared `brokerView.ts:128`, assigned `:257`) carries the
**raw wire position**, so for each member and each of its legs the layer can read
`member.broker.legs[i].cost_basis.state` — the closed tri-state `'supplied' | 'not_supplied' |
'unparseable'` (`libs/api/src/lib/broker.ts:46`) — and `member.broker.legs[i].multiplier`
(`broker.ts:79`, `number?`, omitted rather than defaulted). `brokerView.ts:192-198` already performs
exactly these two reads at position level; the group performs the same reads one level up. **AC-17 does
not need re-cutting.**

**What the struct carries** (replacing the two booleans), all over **contributing legs** only — i.e.
legs of group members, which by the §5 membership rules are all `kind: 'option'` and exclude every
equity leg and every `unrecognized` entry:

```
leg_count                 : number   // Σ member.broker.legs.length  — the copy's DENOMINATOR
legs_basis_not_supplied   : number   // cost_basis.state === 'not_supplied'   (permanent)
legs_basis_unparseable    : number   // cost_basis.state === 'unparseable'    (transient)
legs_multiplier_unknown   : number   // broker leg `multiplier == null`       (permanent)
legs_withholding_permanent: number   // |{ l : not_supplied OR multiplier == null }|   — UNION
legs_withholding_transient: number   // |{ l : unparseable AND NOT in the permanent set }|
```

**The union counts are the load-bearing part, and omitting them ships a defect.**
`legs_basis_not_supplied + legs_multiplier_unknown` **double-counts** a leg that is missing both facts,
so a 2-leg group with one doubly-broken leg would state "2 of 2 legs" when one leg is fine. The number
beside the literal must be the **set cardinality**, computed as a union over legs, never a sum of two
cause counts.

**Which number the copy uses is then determined, not chosen:**

- The literal is `not provided` **iff** `legs_withholding_permanent > 0` (permanence-first, the rule all
  three lanes already agreed) — and the count rendered beside it is `legs_withholding_permanent`.
- The literal is `unavailable` **iff** `legs_withholding_permanent === 0 && legs_withholding_transient > 0`
  — and the count rendered beside it is `legs_withholding_transient`.
- The denominator is always `leg_count`. The rendered count is **always** the one belonging to the
  literal actually shown — never the other, never their sum, never `leg_count − supplied`.

`entry_known` and `multiplier_known` **may** remain on the struct, but only as derived zero-tests
(`legs_basis_not_supplied + legs_basis_unparseable === 0` and `legs_multiplier_unknown === 0`), so the
booleans and the counts cannot disagree. If a synthesizer prefers one source of truth, drop them; the
counts are sufficient.

**Checkable invariant for the spec:** `legs_basis_not_supplied + legs_basis_unparseable ≤ leg_count`,
and `legs_withholding_permanent + legs_withholding_transient ≤ leg_count`, with both equal to the count
of legs that are not fully supplied. On the captured book all six counts are **0** for all three groups
(every option leg has `unit_cost` present and every multiplier reconstructs), so the withholding path is
**not** exercised by the fixture and must be covered by constructed fixtures — including the mixed case
(one `not_supplied` member + one `unparseable` member on one ticker) that is the only thing that catches
the permanence-first ordering.

---

## 6. Group-level percent and `no basis` — **CONCEDED (already self-revised at R2; final here)**

**I withdraw `pl_pct` from the group struct entirely**, and with it my R1 assumption 9 and my R1 §6.4
rule. PM's stronger option is the one I take: **drop the field**, do not carry it unrendered. The group
computes no percentage, calls no `plPctStateOf`, and holds no denominator, so `no basis` is unreachable
at group level **by absence** rather than by rule — the same enforcement shape as every other non-goal
in my position, and immune to the "a later refactor renders the dead field by accident" failure PM and
UX both named. `no basis` remains reachable on leg rows exactly as today. A group percent, if ever
wanted, arrives together with a stated meaning for a signed near-zero denominator, and `plPctStateOf` is
called then.

---

## Risk 9 — the ×100 provenance, stated as a fact (requested; not one of the six)

**FACT 1 — the reconstruction is decided PER LEG, not adapter-wide.** `_map_option_entry` reads
`contract_multiplier` off **each entry** and uses it when present; `_derive_multiplier` fires **only as
a fallback** when that key is absent or unparseable, and only then is
`_NOTE_MULTIPLIER_RECONSTRUCTED` appended (`apps/api/src/broker/webull_adapter.py:310-316`). A feed that
supplied the multiplier on some option rows and not others would therefore produce **mixed provenance
inside one group**, and the adapter as written already handles that case. So the answer to the question
posed is: **it can vary per leg.**

**FACT 2 — on the captured book it does not vary, and that is a property of the payload, not of the
code.** `positions_raw.json` contains **zero** occurrences of `contract_multiplier` across all 14
holdings (grep count: 0), so all 9 option legs took the reconstruction branch and all 9 carry
`_NOTE_MULTIPLIER_RECONSTRUCTED`. `brokerView.ts:194-197` says the same thing in its own comment.

**FACT 3 — the number carries no provenance; only the note does.** `BrokerLeg.multiplier` is a bare
`number?` (`libs/api/src/lib/broker.ts:79`) with no discriminator, so provenance is **unobtainable from
the figure**. The only provenance carrier that reaches the FE is the fixed string
`_NOTE_MULTIPLIER_RECONSTRUCTED` (`webull_adapter.py:231-232`) inside `fidelity_notes`
(`broker.ts:91`) — which is **position-level**, and is attributable to a leg today only because every
Webull position maps to exactly one leg. No production FE code reads note *content* today: the strings
exist FE-side only as test fixtures (`broker/fixtures.ts:166-168`) and `FidelityNotes` renders them
opaquely (`BrokerPositionRow.tsx:305`, `BrokerPositionCard.tsx:98`).

**Consequence for the three pieces of copy — the ruling.** A group-level sentence that *asserts*
provenance in its own words (of the shape "a size Convexa worked out from Webull's own totals, not one
Webull stated") is **true on today's feed but is not a fact the layer checks**, and it becomes false the
first time one leg's multiplier is broker-supplied. **UX-authored provenance prose at group level is
therefore out.** What is in, and is checkable with no wire field, no backend change and no FE dependency
on backend copy:

> The group carries, as its provenance line, the **set intersection of its members'
> `fidelity_notes`** — string equality between members, never a comparison against a literal. Notes not
> common to every member stay where they are, on their member rows.

The mechanism is content-agnostic (it compares members' strings to each other, so no backend copy string
ever enters FE logic), and it **self-corrects**: the day one leg's multiplier is broker-supplied, that
leg carries no reconstruction note, the note drops out of the intersection, and the group silently stops
making the claim. On the captured book the intersection is exactly the two notes all nine legs share, so
today's collapsed group states precisely what today's nine rows state.

**Why this matters more than a copy preference.** `FidelityNotes` renders in the **visible** row body
today (`BrokerPositionRow.tsx:305`), not behind a disclosure. Default-collapsed grouping would otherwise
put a reconstructed-multiplier-dependent dollar figure on screen with its assumption hidden one click
away — a regression against `[model-read-carries-its-assumptions]` introduced by this feature. Hoisting
by intersection repairs that. It must be **additive**: nothing is removed from the member rows, so PM's
AC-5 ("nothing dropped, nothing added" on the expanded leg rows) holds unchanged.

**Unchanged from R1:** no `multiplier_source` wire field, no `apps/api` diff. If a lane needs provenance
as a *typed, per-leg, checked* fact rather than as the adapter's own hoisted words, the feature stops
being FE-only and that is a GATE-Z conversation — but nothing in the three lanes' copy requires it, given
the intersection mechanism above.

---

## Summary

| # | conflict | outcome |
|---|---|---|
| 1 | AC-1's 4+1 vs 3+2 split | **CONVERGED** — 14 positions; 3 groups (TSLA 3, AAPL 2, META 2) + 2 lone legs (NVDA, PLTR); fixture is authoritative for the test arm |
| 2 | "roughly four times" | **CONVERGED** — proportional 0.5%-per-leg guarantee, signed sum, measured $0.00 / $0.00 / $3.00; summing order is irrelevant and the alternative order is undefined |
| 3 | `net debit` / `net credit` | **CONVERGED** — sign carrier non-negotiable, struct carries `basis`, group and children use the same word; my "AAPL nets to a credit" sub-claim **withdrawn** |
| 4 | AC-16 vs `—` in Qty | **CONVERGED** — PM's split (a)/(b) as written; struct carries no quantity field, so `—` is a render literal, not data |
| 5 | booleans vs counts | **CONCEDED** — six counts specified above; the **union** counts are the ones the copy renders |
| 6 | group percent / `no basis` | **CONCEDED** — `pl_pct` removed from the struct entirely; `no basis` unreachable at group level by absence |

Nothing in this pair is a product call in disguise. Nothing here reopens the seven author-withdrawn
conflicts, the `Build reassessment` owner question, or the mobile `unrecognized` parity scope question.
