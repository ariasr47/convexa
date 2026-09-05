# R3 — pm resolutions: curvature-v2-desk-and-read

One exchange, ten technical conflicts. **Zero promoted to a product call.** Every verdict below is
settled on a `file:line` read or a canon rule number. Two resolutions name an owner ruling they wait
on for *one clause*; neither is promoted by me, and both were already routed by another lane.

| # | raised by | subject | verdict |
|---|---|---|---|
| 1 | architect | AC-78 / AC-24 "both schemes" at all four widths | **conceded** |
| 2 | architect | "834 → phase 4" | **conceded** |
| 3 | architect | AC-16 "distance from the mid" | **conceded** |
| 4 | pm → ux | UX-32 "a useful primary action" | **resolved-agree** |
| 5 | pm → architect | eight strip cells / the off-exchange cell | **position-stands** |
| 6 | pm → ux | idle's marker vs the quiet gate note | **position-stands** (one clause waits on a ruling) |
| 7 | ux | AC-16 "distance from the mid" | **conceded** (same as 3) |
| 8 | ux | AC-31 "the **only** amber-rendered element" | **conceded** (one clause waits on a ruling) |
| 9 | ux | AC-64 "has already received a value" | **conceded** |
| 10 | ux | AC-20 "the member that matches **why**" | **conceded** on the clause; requirement stands |

---

## 1 — AC-78 / AC-24: "in both schemes" at 393, 834, 900 and 1280 · **conceded**

The architect is right, and the decisive evidence is stronger than the one it cited: my criterion
contradicts the canon rule it was written to serve. **`DESIGN_SYSTEM.md:172`, rule 17**, states the
matrix in terms — *"the suite … enforces **393** (both schemes), **900** and **1280** today; **834**
is added at build and **900 stays**"*. So "both schemes" was never scoped to the wide bands by the
canon either. `no-overflow.spec.ts:43-45` records the same decision with its reason (*"ONE SCHEME for
the wider bands, deliberately: horizontal overflow is box geometry and dark/light change no widths"*),
and `:47-53` shows `WIDE_VIEWPORTS` carrying 834 / 900 / 1280 with no scheme axis at all.

Written as I wrote it, AC-78 was exactly risk 9 in my own R1 — a criterion certified by a suite that
never ran half of what it claims. I withdraw it.

**AC-78 (corrected).** At 393px the desk renders with no horizontal page overflow in **both** colour
schemes; at 834, 900 and 1280 it renders with no horizontal page overflow in the **one** scheme the
standing suite runs. *Verify by:* **test** (browser) — **ship-blocking**. The row is proved by the
suite's enumerated case list before GATE Q, not by a passing summary: the browser config is an
explicit allowlist, so an unregistered spec reports green by never running.

**AC-24 (corrected).** At 393px in both schemes, and at 834, 900 and 1280 in the scheme the standing
suite runs, the read strip scrolls sideways when its cells do not fit and **the page itself never
scrolls sideways**. *Verify by:* **test** (browser) — **ship-blocking**.

**AC-78b (new).** The suite's executed case list, captured before GATE Q, names every width × scheme
combination the two rows above claim; any combination claimed but not executed is a FAIL of this row
rather than a PASS of the row that claimed it. *Verify by:* **review** (build report, against the
captured list).

Widening the wide bands to two schemes is available to the owner, but it is a deliberate reversal of a
documented suite decision with a runtime cost, and it is not something I will take silently as a
criterion. I am not routing it: nothing in this phase's value depends on it, and rule 17 already
answers it.

---

## 2 — "834 added to the standing overflow suite — phase 4" · **conceded**

Withdrawn at R2 as a self-revision and I do not re-argue it. `no-overflow.spec.ts:51` ships
`{ label: 'tablet 834', width: 834, height: 1112 }` inside `WIDE_VIEWPORTS`, and `DESIGN_SYSTEM.md:172`
records 834 as *"added at build"* — i.e. phase 1, not phase 4. The Future-dated row and the Scope-Out
clause are deleted. The true obligation is smaller: **834 is already green and this phase keeps it
green through the desk rebuild**, which AC-78 as corrected now asserts.

I adopt the architect's coupling finding, which my set did not cover. `no-overflow.spec.ts:398` uses
the on-page text `Call wall` as the readiness anchor for the ticker route at every width, and this
phase deletes the widget that renders it. The ladder keeps the word — decisions §2 records that the
side lives in the label words — but that must hold deliberately, not by luck, so it gets a row.

**AC-15b (new).** The level ladder renders the level names **`Call wall`** and **`Put wall`** as
visible text, unchanged in wording from the grid it replaces. *Verify by:* **test**. (Rationale, not
part of the criterion: this exact string is the browser suite's readiness anchor for the ticker route
at every width; a rename reds roughly twelve cases for a reason nobody connects to a copy change.)

---

## 3 and 7 — AC-16, "distance from the mid" · **conceded**

Two lanes raised this independently and I self-revised on it at R2 on the same reading. I verified the
anchor myself this round: `_kit/distanceToLevel.ts:11-14` defines `levelSpot(m) = m.gex_spot ?? m.price`
and `DealerPositioning.tsx:61` passes exactly that; `_kit/copy.ts:318` labels `gex_spot` *"levels spot,
// NOT 'spot' — the levels anchor is not the live display price"*. Anchoring the column on the mid
would silently change every distance the trader has read for months **and** make all four structure
rows recompute on every tick — five live rows, which `DESIGN_SYSTEM.md:169` forbids in the same
sentence my criterion was drawn from.

The architect's proposal and ux's proposal are the same criterion; I adopt the joint form.

**AC-16 (corrected).** Every non-mid ladder row shows its distance from the levels anchor
(`gex_spot`, falling back to `price`); the mid row's distance cell renders the not-applicable member
`—`, never a computed zero and never an empty cell. *Verify by:* **test**.

**AC-17 (unchanged).** The ladder states, once, which price the distances are measured from.
*Verify by:* **review**.

One thing I am *not* doing, so it is on the record rather than absorbed: the mid-versus-anchor
divergence is a real, computable number, and rendering `—` there declines to show it. I accept the
decline — the column's meaning is "how far is this level from the anchor", and putting a
data-quality divergence in that cell changes the column's meaning for one row. Both other lanes and
the shipped drawing reached `—` independently; inventing a third answer at R3 with no new evidence
would be scope, not convergence. AC-17 keeps the divergence discoverable by naming the anchor.

AC-16 as corrected does **not** wait on the canon rule 14 amendment (ux's product conflict). The
criterion is written to the code and is checkable today; the amendment only stops rule 14 red-flagging
correct code at GATE Q.

---

## 4 — UX-32, "and a useful primary action" · **resolved-agree**

ux reached the same conclusion in its own R2 and split the row itself, in a stronger form than I
proposed: UX-32a covers **every** control the state renders, not just the primary, and adds "no
disabled placeholder and no control naming an unbuilt capability". I withdraw my narrower wording in
favour of ux's.

**This does not wait on a product ruling.** ux answered the alerts question in-lane in its `agree`
block — the price moves out of the control and into the statement (`Re-engage when {conditions}`
carrying the level as a *condition*), and the primary control is the shipped refresh / re-ask control.
That is option (b) of my R2 alerts conflict, taken by the lane that owns the copy, and it satisfies
AC-45 with no new alerting entry point and no phase-3 scope. My R2 framing already withdrew the claim
that alerts is unshipped (`AlertsPage.tsx:24-49` ships `level_touch` with a price threshold), so the
only thing left was a scope preference and ux has taken the conservative one. I agree with it.

**AC-45 (corrected, converged with UX-32a).** In the *produced (no trade)* state the panel offers no
simulated entry, states why there is nothing to review, and **every control it renders performs an
action this build actually performs** — no disabled placeholder and no control whose label names a
capability this build does not have. *Verify by:* **test**.

**AC-44 (unchanged).** *Produced (no trade)* renders at the same typographic weight as a trade, with
no warning or error chrome and no red, and names the conditions that would change the read.
*Verify by:* **test** — **ship-blocking**.

---

## 5 — "eight cells at every state; an unavailable metric is an `unavailable` cell" · **position-stands**

The architect withdrew its own rule for the off-exchange cell and landed on ux's answer: the cell is
**absent** when the object is absent, and the strip's cardinality becomes 7-or-8. I hold my R2
position — eight fixed slots, always — and I have the fact that was missing from both proposals.

**The member exists and it asserts nothing about cause.** `shared/copy/notANumber.ts:35,48` ships
`not provided` and `:9` documents its meaning verbatim: *"`not provided` the feed did not send it"*.
That is true when `INCLUDE_DARK_POOL=false` and true when the best-effort computation failed — it is a
statement about what arrived, which is the only thing the frontend can observe. It fabricates no
cause, which is the whole of the architect's reason for withdrawing `unavailable`.

**Nothing blocks using it here.** Ruling 3 (`decisions.md:140-141`) is explicit: *"the caller picks the
member; the type enforces closure, not choice"*, and `notANumber.ts:14` says the same
(*"THE TYPE ENFORCES CLOSURE; THE CALLER PICKS THE MEMBER"*). `decisions.md:144-146` accepts one shared
vocabulary across surfaces as a named cost, so a ticker surface picking a member seeded on the broker
surface is the ruling working, not a violation. This is not a substitution of one member for another —
the meaning matches the situation exactly.

**The cost of the architect's version is one the architect named itself** (R2: *"a rail whose
cardinality varies makes an off-screen cell indistinguishable from an absent one"*, ux risk 5). A
variable-cardinality rail reintroduces `[absent-is-not-none]` on the scroll axis at 393px, and unlike
the fabricated-cause problem it has no repair inside the closed vocabulary. Fixed slots have a repair;
variable cardinality does not. That asymmetry decides it.

**AC-26 (corrected).** A read-strip cell whose datum is absent this cycle keeps its slot and its
label, renders a member of the closed not-a-number vocabulary in body type, and its neighbours keep
rendering their values; the rail's cell count does not change between states. *Verify by:* **test**.

**AC-26b (new).** The off-exchange cell renders **`not provided`** whenever the bundle carries no
off-exchange object, in both the disabled-source and failed-computation cases, and never renders
`unavailable` or any other member that names a cause the app was not told. *Verify by:* **test**.
The missing attempted-versus-failed wire discriminator is recorded as named debt with a phase
attached, per ux CI-6 — not repaired here, because the `apps/api` diff must stay empty.

**AC-28 (unchanged).** The off-exchange cell renders neutrally, states that it is context only with
no side, and never in the success/direction register. *Verify by:* **test**.

---

## 6 — "| A1 | idle | body | … | 'Ready to read this snapshot.' + the composer |" · **position-stands**

The criterion-shape defect stands and it is independent of any ruling: **no acceptance criterion may
key a state on a marker that another reachable state also renders.** ux itself adopted exactly this
shape in its R2 self-revision when it added A10 (request failure) as its own named case with its own
marker. The rule has not yet been applied to `no_edge`, which the architect read at
`presentationPolicy.ts:18` with a shipped `askAnyway` action at `:168`, drawn as a footnote *inside*
the idle panel at `design/src/screens/ai-read.mjs:62`. Under ux's A1 marker, plain idle and
idle-with-a-quiet-gate-note render identically — so UX-28 would pass while certifying the collapse it
exists to prevent. My own AC-39 has the same hole and I am fixing it here rather than defending it.

**AC-38(b) (corrected).** Each exclusive body case of the AI read renders at least one observable
marker that no other reachable body case renders; no case is identified in a criterion, a test or the
build report by a marker another reachable case also renders. *Verify by:* **test** (non-synonymy,
never a tally) — **ship-blocking**.

**AC-39 (corrected).** *Idle* — the panel states it is ready to read this snapshot, names the persona
and model that would be used, states the snapshot's as-of time, and offers the ask control; no verdict
word and no risk fields are present, **and the panel carries no quiet-gate note or ask-anyway control
in this arm**. *Verify by:* **test**.

**The one clause that waits on a ruling.** Whether `no_edge` becomes its own named case (with the gate
note plus the ask-anyway control as its marker) or is disposed of some other way is inside the
**AI-read failure-state / homeless-states owner ruling** that ux routed and the architect asked for.
AC-38(b) and AC-39 as written above hold under every disposition — that is deliberate. What the ruling
settles is only whether a *second* row is added naming the gate-note arm. I add none pre-emptively and
I am not routing anything new.

`superseded_inputs` and `incomplete_trade` sit in the same ruling. Until it lands, no criterion of
mine keys idle, no-trade or add-a-key on a marker any of them could render.

---

## 8 — AC-31, "the verdict word is the **only** amber-rendered element" · **conceded**

ux is right and the evidence is a canon rule, not a preference. **`DESIGN_SYSTEM.md:161`, rule 6** —
*"**Focus** — authored `:focus-visible` ring (text-grade amber); no bare `outline: none` without
replacement"* — mandates amber on focus, and this panel is required to contain focusable controls
(the `AccessibleHelp` ⓘ on each risk field per ruling 6, the ask control, the drawer trigger, the
review-simulated-trade control). A focused panel therefore always contains a second amber element **by
canon**. My criterion was unsatisfiable in any focused state. This is the rules 13-vs-18 shape again
and it takes the same repair: a scope clarification, not a build choice.

**AC-31 (corrected).** In the AI panel's **resting** render, the verdict word is the only element
spending amber as text or fill. The authored `:focus-visible` ring required by canon rule 6 is outside
this criterion. *Verify by:* **test** (a colour census of the resting render).

**The one clause that waits on a ruling.** Whether the design source's three resting amber spends —
the header icon tint, the pinned-read provenance dot and the loading pulse — are permitted is the
**rule 16 amber-scope owner ruling**, already routed by me at R2 and not re-raised here. AC-31 above is
written to the canon as it stands today (`DESIGN_SYSTEM.md:171`: *"nothing else in the panel spends
amber"*), which makes those three defects to regenerate out of the drawings. If the owner amends rule
16 to name permitted spends, AC-31 gains one clause — a closed list the census asserts — and nothing
else moves. That is a text change to a criterion, not a branch shipped inside one; I am holding the
line I set at R2 against a criterion that branches on a pending ruling.

ux's lane answer (the drawings are regenerated; `design/` is not authority) is the answer I expect the
ruling to confirm, and I have no disagreement with it. It answers my R1 assumption 11, which was the
falsifiable thing I asked for.

---

## 9 — AC-64, "has already received a value" · **conceded**

ux is right that the phrase does not say received *from where*, and I verified today's answer at
source myself: `LiveTape.tsx:96` composes `flipValue = (numbersActive ? live?.gamma_flip : null) ??
m.gamma_flip`, and `:190` passes `offline={tileOffline ? { retained: flipValue != null } : null}`. The
call site's own comment at `:180-184` states it plainly — *"its offline arm is RETAINED whenever a
fallback exists"* — so on a drop the cell prints the retention caption over a REST bundle number that
never came off the stream. AC-64 as worded certified that render as passing. It is ruling 2's
fabrication in its second form: a caption over the wrong value rather than a caption without one.

**AC-64 (corrected).** On a stream drop, a live-derived figure that has already received a value
**on the stream** shows that value at reduced opacity with the pause marker and says it is the last
known value. *Verify by:* **test** — **ship-blocking**.

**AC-65 (unchanged).** On a drop before any value arrived on the stream, the same cell shows a
not-a-number member with the pause marker and **no** "last known" words. *Verify by:* **test** —
**ship-blocking**.

**AC-64b (new).** No figure anywhere on the desk renders the "last known" retention wording over a
value sourced from the REST bundle rather than the stream. *Verify by:* **test** — **ship-blocking**.

**AC-64c (new).** A widget-level subtitle claiming it is showing last-known ticks renders only when at
least one cell in that widget is actually holding a retained stream value; otherwise the widget's
offline subtitle makes no retention claim. *Verify by:* **test**. (Not ship-blocking: it is one
instance, at widget scope, of the rule AC-64b states generally, and AC-64b's failing arm catches the
same defect class. Rationale, not part of the criterion: `LiveTape.tsx:110` selects that subtitle on
the stream flag alone today, so the claim is made unconditionally on every drop.)

---

## 10 — AC-20, "the member … that matches **why** it is absent" · **conceded** on the clause

ux is right that the clause asserts knowledge the frontend does not have, and I checked the wire
myself rather than take it on report. The five levels arrive as bare nullable numbers with **no
per-level status field**: `libs/api/src/lib/convexa.ts:209-216` declares `gex_spot: number | null`,
`max_pain: number | null`, `peak_gex_strike: number | null` alongside non-nullable `call_wall`,
`put_wall` and `gamma_flip`, and the generated schema at `schema.ts:1687,1703,1716` carries all of
them as optional `number | null`. Nothing anywhere carries a reason code. So there is no discriminator,
choosing between `—` and `unavailable` invents one, and — ux's sharper point — a row whose test is
"does the literal match the reason" cannot fail honestly, because any shipped literal can be argued
to match.

This also answers ux's ask 1 to the architect, with the source read rather than a lane opinion: **no
discriminator exists**, so the SPEC names one member for all level absences.

**AC-20 (corrected).** A level the current bundle does not carry keeps its row and its label, renders
**`not provided`** in the not-a-number register in its value cell, renders `—` in its distance cell,
and is never rendered as a zero, as another member's literal, or as an empty row. *Verify by:*
**test** (closure and non-synonymy, never a count).

The rule behind the member is one the frontend can actually evaluate — *the bundle field is absent or
null* — and `not provided` states exactly and only that, per `notANumber.ts:9`. The distance cell
takes `—` on the architect's reasoning against ux's UX-15: the distance is undefined because the level
is, not because a computation failed, and an empty cell in a column is indistinguishable from a render
bug. That reconciles all three lanes' proposals into one row: value cell typed by what arrived,
distance cell typed as not-applicable, no cell left blank.

The missing attempted-versus-failed discriminator is recorded as named debt with a phase attached —
the same treatment as the off-exchange gap in conflict 5, and for the same reason (the `apps/api` diff
stays empty this phase). Two gaps, one cause, one debt entry.

---

## Ship-blocking set after this round

Unchanged except as noted: AC-14, AC-18, AC-24, AC-27, AC-36, AC-38, AC-44, AC-46, AC-52, AC-56,
AC-57, AC-58, AC-63, AC-64, **AC-64b**, AC-65, AC-73, AC-78.

Added: AC-64b (the general form of the retention fabrication). Not added: AC-15b, AC-26b, AC-64c,
AC-78b — each is a defect to fix, not a gate, and each sits behind a row that already gates its
class.

## Rulings my rows wait on (neither routed by me at R3)

1. **The AI-read failure state / homeless shipped states** (routed by ux and the architect) — decides
   whether a second idle-arm row is added under conflict 6. AC-38(b) and AC-39 hold either way.
2. **Rule 16's amber scope** (routed by me at R2) — decides whether AC-31 gains a closed list of
   permitted resting spends. AC-31 is checkable today without it.

No row of mine waits on the AC-12 canvas text-equivalent ruling, the canon rule 14 amendment, or the
hero's light-mode scope: all three change what the *canon* says or what the *phase buys*, not whether
any criterion above is observable.
