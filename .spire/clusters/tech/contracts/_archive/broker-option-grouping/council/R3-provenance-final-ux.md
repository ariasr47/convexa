# R3 final — the ×100 provenance clause (ux, settling copy only)

**Verdict: KEEP, gated on the derived boolean.** I withdraw the unconditional drop in
`R3-architect-ux-ux.md` §C4, and I withdraw the `test` AC I added there that bans the claim.

Scope: this file settles the provenance clause and nothing else. Conflicts 2 and 3 are withdrawn by
both voices and there is no group-level fidelity-note line; I am not reopening them. Every other
string in my R3 file stands byte-identical.

---

## 1. Why the mechanism changes the answer

My falsification condition was *"if the answer is 'sometimes supplied,' the clause drops."* Applied
mechanically that would drop it. Applied to what it was actually protecting, it does not.

The variable doing the work in that condition was never "sometimes" — it was **undetectably**
sometimes. I dropped the clause because a hardcoded sentence would keep asserting reconstruction
after the feed changed, on a zero-line diff, with nothing to notice. The correct form of my
condition is: *the clause drops iff the FE cannot distinguish the two cases at render time.* It can
— `_NOTE_MULTIPLIER_RECONSTRUCTED` is appended only on the fallback branch
(`webull_adapter.py:231-232`), rides to `BrokerPositionView.fidelity_notes` (`brokerView.ts:259`),
and is already held verbatim in the FE (`fixtures.ts:165-166`). A **derived** clause does not go
stale on the zero-line diff; it disappears on it. That was the entire objection.

## 2. The residual, judged rather than waved through

The architect names it honestly: the predicate is a prose-string match across the FE/BE seam, and
the api suite pins only the *withheld* note (`test_broker_adapter.py:478`). A backend copy edit
silently flips the boolean false. They call that fail-safe. I checked the claim rather than accept
it, because a silently-vanishing honesty clause is exactly the thing I would normally refuse.

It survives, for a reason stronger than "no false claim is made":

- **KEEP's failure floor is DROP's ceiling.** If the boolean wrongly goes false, what renders is
  precisely the composition-only copy I declared final in my R3 — copy I already vouched as
  defensible on its own. Nothing becomes false; one disclosure layer is lost.
- **The disclosure does not actually vanish.** A backend copy edit changes the note's *wording*, not
  its *presence*. Member rows render `fidelity_notes` verbatim on expand (PM AC-5, my C2
  concession), so after the drift the provenance is still stated — by the party that knows it, on
  the legs it is true of, in that party's new words. That is the posture I argued was *better* than
  the group sentence. The degraded state of KEEP is the state I was advocating for.
- **The inverse failure is not reachable by a copy edit.** For the clause to render falsely the note
  would have to appear off the reconstruction branch — a backend *behavior* change, and one that
  would already be lying verbatim on the leg row. The group clause is never more false than the leg
  note it mirrors.

So there is no state reachable under KEEP that is worse than DROP. The residual stands as an
accepted limitation, stated, not asserted away.

## 3. Gate

One boolean per position, derived in `brokerView.ts` from the presence of the reconstructed-multiplier
note matched against **one exported production constant in `brokerView.ts`** (never against
`fixtures.ts`, which no render code imports); **OR'd across the group's members**. The struct field
name is the synthesizer's — I consume it as "the net rests on at least one contract size Convexa
derived".

Two boundaries the copy needs:

- **The clause renders only where the group's net *figure* renders.** If the net is withheld
  (`not provided` / `unavailable`, my C6 cascade), the withheld tooltips and reason line render
  unchanged and the clause is absent — it has no figure to qualify. It **does** render on the
  `$0.00`-with-no-direction-word case from my C5 residue, which is still a figure.
- **Mixed groups get "at least one", never a count.** The note is position-granular; the counts in
  my C6 strings are leg-granular off `member.broker.legs`. Interpolating one into a sentence about
  the other is a number with no vouched source — the architect's own conflict-6 precision 1. The
  clause is deliberately countless and points at the expand, where the per-leg notes say exactly
  which legs. One string covers all-reconstructed and mixed alike, and is true of both.

## 4. The three final strings

**(a) Basis label — ungated, unchanged, never carried the claim:**

> **`netted by Convexa`**

**(b) Tooltip on that label.** Boolean **false** — byte-identical to my R3 string:

> `Convexa added these legs up: for each one, per-contract cost × contract size × number of
> contracts, with money received counted against money paid. Webull doesn't publish a combined cost
> for legs it reports separately, so this is Convexa's arithmetic, not a Webull figure — expand the
> group for each leg's own numbers and notes.`

Boolean **true** — one sentence inserted before the existing tail, nothing else altered:

> `Convexa added these legs up: for each one, per-contract cost × contract size × number of
> contracts, with money received counted against money paid. Webull doesn't publish a combined cost
> for legs it reports separately, so this is Convexa's arithmetic, not a Webull figure. For at least
> one of these legs Webull doesn't state the contract size either, so Convexa worked that size out
> from the leg's own Webull totals — expand the group for each leg's own numbers and notes.`

**(c) Sentence in the expanded disclosure panel** (`leg-max-loss-note` slot). Boolean **false** —
byte-identical to my R3 string:

> `Net entry is Convexa's arithmetic over the legs below, not a figure Webull sent. Advisory
> context, not a broker figure.`

Boolean **true**:

> `Net entry is Convexa's arithmetic over the legs below, not a figure Webull sent — and for at
> least one leg Convexa also worked out the contract size it used, because Webull didn't state one.
> The legs it applies to say so on their own rows. Advisory context, not a broker figure.`

Still **absent from all four variants**: any tolerance figure. The 0.5% round-trip bound is a
backend guard constant; the FE cannot vouch it. "Worked out from the leg's own Webull totals" is the
whole of what the FE knows, and it is deliberately weaker than the backend's own "reproduced
exactly" — I do not restate someone else's vouch in my own voice.

## 5. Acceptance criteria — replacing my R3 §C4 block

| AC | Restatement | Verify by |
|---|---|---|
| **AC-9** | The group's net-entry figure carries a visible basis label naming **who** computed it; the label's tooltip names the **composition** (per-contract cost × contract size × contracts, signed); and when the net rests on at least one contract size Convexa derived, the tooltip and the expanded sentence **say so**. | `review` |
| **AC-10** | The copy discloses that the group net is Convexa's own arithmetic and may not match a total Webull displays. | `review` |
| **AC-P1** *(replaces the banning AC — that one is withdrawn)* | The provenance clause renders **iff** the derived boolean is true: a group whose members carry no reconstructed-multiplier note renders neither the tooltip clause nor the expanded clause, and no group-level string asserts a contract-size origin in that state. | `test` |
| **AC-P2** | The boolean is derived from the note's presence via the single exported `brokerView.ts` constant, which equals `fixtures.ts`'s `NOTE_MULTIPLIER_RECONSTRUCTED` and is present on the captured option fixtures. | `test` |
| **AC-P3** | The clause is absent whenever the net is withheld, and present on a `$0.00` net. | `test` |

The `test` markings are not ceremony. Every one of the owner's 9 captured option legs takes the
reconstruction fallback, so **the true branch is review-visible on the real book and the false
branch is reachable only through a synthetic fixture** — a reviewer cannot see the state AC-P1
governs. That asymmetry is precisely the risk-based rule's `test` case, and it is why a `review`
marking on P1–P3 would mean unverified.

## 6. What this changes for the synthesizer

Against my R3 file: §C4's verdict line flips from "dropped, unconditional" to "kept, gated"; the
three strings gain a second variant each; the banning `test` AC is struck and AC-P1/P2/P3 take its
place. The C4 summary row should read: *provenance clause kept, gated on a boolean derived in
`brokerView.ts` from the per-position reconstructed-multiplier note and OR'd across members; the
composition-only strings are the false-state copy.* Everything else in both R3 files stands.
