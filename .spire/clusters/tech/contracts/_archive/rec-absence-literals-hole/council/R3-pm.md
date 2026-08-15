# R3 — pm resolution: rec-absence-literals-hole

## #6 — AC-10 standing line on the local-rules path (architect → pm)

**CONVERGED: I rule option one — the standing line is EXEMPT on the local-rules path, the exemption
is keyed on that path being affirmatively declared, and the SPEC states the exemption so a later
reader does not book its absence as a regression.**

The line is still *true* on that path (a rec with no strike is not actionable as written), so this is
not a truth call — it is an information call, and a line whose base rate is 1.0 sitting directly
beneath a card-level line that already says the whole plan came from Convexa's rules rather than an
AI read is chrome, not an alarm. The line exists to interrupt an *unexpected* omission; on that path
the omission is structural and already announced. One consequence I am naming rather than hiding:
the free, keyless fixture can no longer demonstrate AC-10, so AC-10's observation moves to a
constructed model-path response — it stays observable, but not on the primary fixture.

AC-10 splits into three, replacing the single row:

- **AC-10a (SB)** — On a trade card that is *not* on the local-rules path and is missing one or more
  of Structure / Strike(s) / Expiration / Entry trigger, exactly one card-level standing line renders,
  stating the rec is not actionable as given and naming the missing field(s). With all four named, no
  such line renders. *Verify by: test.*
- **AC-10b (SB)** — On a trade card that IS on the local-rules path, no standing line renders no
  matter how many of the four are unnamed; the per-row literals still render and the shipped
  local-rules card-level line is unchanged. *Verify by: test.*
- **AC-10c** — On a trade card whose response declares no grounding path at all (pre-feature or
  degraded) with one or more of the four unnamed, the standing line DOES render. The exemption
  requires an affirmative local-rules declaration; missing information is never an exemption.
  *Verify by: test.*

This ruling is conditional on the standing line shipping at all — that is the line-budget question I
already routed to the human, and it is unchanged by this ruling.

## #22 — AC-3 replacement wording (ux → pm)

**CONVERGED: I confirm UX's negative-space restatement with one amendment — UX's own clause "no
literal introduced by this feature renders in that branch" contradicts UX's own conviction-chip
proposal, so the conviction chip must be carved out by name rather than swept in.**

Replacement for AC-3, all on a `no_trade` card:

- **AC-3a (SB)** — The five plan fields (Structure, Strike(s), Expiration, Entry trigger, Time
  horizon) render no row at all: no row, no label, no placeholder, no skeleton, no ghost, no reserved
  mark. *Verify by: test.*
- **AC-3b (SB)** — The four risk slots render the reserved mark with their copy unchanged from today.
  *Verify by: test.*
- **AC-3c (SB)** — No absence literal introduced by this feature renders on any of those five plan
  fields — the negative-space guard against a builder reading AC-3a as an instruction to add rows.
  *Verify by: test.*
- **AC-3d** — The conviction chip is the single carve-out and is ruled separately. If the human rules
  it in, an absent conviction on a `no_trade` card renders the never-stated literal and never the
  reserved mark. If out, the SPEC books it as a named surviving instance of `absent-is-not-none` on
  that card and AC-3c extends to cover it. *Verify by: review.*

I do not carry UX's "`—` appears in exactly the four risk slots" clause into AC-3, because I cannot
verify what else on that card may legitimately carry the mark; that whole-card sweep belongs to
AC-16, where UX's `quoteTextFor` question is still open against me.

## #24 — What the SPEC may claim about §9.5 (ux → pm)

**ACCEPT: UX is right and I withdraw the BRIEF-inherited closure claim — the SPEC may claim §9.5
closed only in half, and full closure only if the section-level caption ships.**

§9.5's residual is an inference about *present* values; the literals remove the false Convexa verdict
on *absent* ones. Those are different halves and I let the BRIEF's one-sentence claim stand at R1
without testing it. Binding on the SPEC and on the record: (1) SPEC §9 states the residual in two
halves and claims outright closure of half one only; (2) half two may be claimed closed only if the
section-level caption ships, otherwise it is re-booked as a surviving named residual with the reason;
(3) no gate report, ledger entry or BACKLOG line records §9.5 as closed while half two stands. The
feature's selection does not depend on full closure — half one is a wrong-trade failure and stands
on its own; half two is a mis-calibration failure and can be honestly carried.

## #14 — Block-absent default (pm → architect)

**CONVERGED: architect withdrew the `unavailable` default and adopted the never-stated default;
nothing remains open on my side.**

The observable I need is unchanged and now agreed by all three: when no per-field reason information
reaches the browser, all six render the never-stated literal, and the missing-input literal is
reachable only from an explicitly declared missing input, never from a fallthrough. Vocabulary stays
at five members — block-absence earns no new word. AC-5 and AC-6 name that literal rather than saying
"an honest absence literal."

## #15 — Off-scale conviction reported as never-stated (pm → architect)

**CONVERGED on the wire fact: architect withdrew reporting an off-scale answer as not-present and
will carry it as its own distinct reason; the copy half remains the human's.**

My requirement was only that the response stop merging "it answered, off our scale" into "it never
answered," and that is met. On the copy: my out-4 ("no new absence word") stands as written for the
five prose/date/array fields; for conviction alone my own R1 risk 6 already named the exit — one
addition with a recorded rationale — so out-4 does not block the human ruling UX's proposed word in.
If the human refuses the word, the collapse must be booked as a named surviving residual, not
absorbed by rendering it as never-stated without comment.

## #16 — The predicate cannot see a fabricated value (pm → architect)

**CONVERGED on the mechanism, and architect's R2 answer enlarges my ruling: it is four fields, not
one — conviction, structure, time horizon, and part of the entry trigger.**

My ship-blocking criterion generalizes accordingly: *no value renders on a rec card, on any of the
six fields, that its named producer did not state.* Whether the deletions happen inside this feature
is owner question (a) below, not mine to close. One thing I still need from architect before I make
that criterion ship-blocking, and my R2 ask on it is unanswered: does removing those defaults change
anything a user or the record already sees — the rules-path grounding card, the stored evaluation
record, the cited-contract line — or is each confined to its own field's display? If it is not
confined, the criterion needs its own ACs for the surfaces it moves.

## Correction — Accept DOES seed: B3, B4, AC-12, AC-13 restated

**My R2 self-revision #9 is VOID.** It rested on architect's R1 sentence "These six are display-only;
none seeds `TradeEntryDialog`," which architect's own R2 conflict supersedes. Restated on the footing
that the seeding is real, and that an omitted strike already becomes a chain-derived strike and an
omitted structure already becomes a defaulted option right at the entry surface:

**B3 — reinstated as a CHANGE, not a standing prohibition.** The defect is live and worse than I
assumed at R1: an unnamed field does not arrive empty, it arrives as a plausible, valid, submittable
value with nothing on that surface distinguishing it from one the read actually chose. That is a
fabricated trade parameter carrying a human's confirm — already shipped.

**B4 — I rule the OUTCOME, not the mechanism, and yes, it is worth architect's price.** The
requirement is: *no value the producer did not state is pre-typed, and none is submittable by a single
confirm.* "Literally empty" is one mechanism; if the entry surface already has a no-rec state for
these fields that is not itself a default, that is a cheaper one and architect should say so. What is
not acceptable is any option that leaves a valid un-stated value in the field — labelling it, tinting
it, or captioning it all leave the wrong trade one click away, and the whole safety property is the
deliberate human keystroke at the moment the omission becomes an input. The price architect quoted
(widening the shared prefill seam, a third file tree pinned by a shipped guard, effort off S–M) is not
an argument against the outcome — it is the argument for owner question (b).

Replacing AC-12 and AC-13, all ship-blocking only if the Accept half is ruled in:

- **AC-12a (SB)** — Accepting a trade rec whose strike was never named opens the entry surface with no
  strike a single confirm can submit: no chain-derived strike, no nearest-available snap, no zero,
  plus a one-line reason naming the field. *Verify by: test.*
- **AC-12b (SB)** — Same for expiration: no defaulted, inferred or carried-over expiration.
  *Verify by: test.*
- **AC-12c (SB)** — Accepting a trade rec whose structure was never named produces no option
  direction a single confirm can submit, and the surface states the read named no structure. This is
  the re-wording architect asked for: there is no structure input to leave empty, so the observable is
  the derived direction. *Verify by: test.*
- **AC-12d** — The reason line states only that the read did not give the field. It names no cause.
  *Verify by: review.*
- **AC-12e (degraded, split out)** — The refusal to seed keys on the VALUE being absent, not on a
  reason token being present. A response carrying no reason information at all but an absent strike
  still refuses to seed; the reason line then says only that the read did not give it. This keeps
  AC-12 satisfiable against a pre-feature or degraded response and keeps a degraded response from
  becoming a blocked Accept. *Verify by: test.*
- **AC-13 (SB, promoted)** — Accepting a trade rec whose structure, strike and expiration WERE named
  seeds the entry surface exactly as today, byte-identical. Under the corrected fact this stops being
  trivial and becomes the load-bearing guard that widening the prefill seam does not disturb the path
  every existing user actually hits. *Verify by: test.*

**If architect's fact comes back the other way** (Accept genuinely never seeds these): B3 reverts to a
standing prohibition — this feature must not *introduce* seeding; B4 is moot and mints no refusal
vocabulary; AC-12 collapses to one negative-space criterion verified by review; AC-13 returns to
trivially satisfied; owner question (b) evaporates and effort stays S–M with two file trees.

## Owner decision consequences

**(a) Are the server-side fabricated defaults (conviction, structure, time horizon, entry trigger)
fixed in this feature?**

- **IN** — The one card we can observe for free stops asserting up to four values nobody stated, and
  the conviction absence literal becomes reachable at all instead of shipping as a dead branch; the
  price is that the keyless demo and CI card visibly thins out — rows that today read as confident
  text read as "not given" — and more fields become unnamed there, which is exactly why #6's
  local-rules exemption matters.
- **OUT** — The six literals ship, but on the primary fixture four of the six still render
  Convexa-invented values as though the read said them; then `confidence` must be struck from the six
  in the SPEC (its literal is unreachable on any path we can observe), the defaults are booked as a
  named open defect, and the SPEC may not claim absence is closed on that card.

**(b) Is the Accept/prefill fix in this feature or split out?**

- **IN** — The wrong-trade failure the BRIEF was selected for is actually closed: an omitted strike
  stops becoming a real chain strike behind one confirm; the price is effort off S–M, a third file
  tree in the allow-list, an edit to a shipped path-pinned guard, and a rec that used to Accept in one
  click now sometimes requiring a keystroke.
- **SPLIT** — This feature ships an honest label over a live fabrication: the card says the read named
  no strike while Accept still puts one in the ticket; then the SPEC must say that in those words, the
  split item must be booked at the same gate, and no artifact may claim this feature stops an omission
  from becoming a position — it only stops one from going unremarked.
