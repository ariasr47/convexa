# R3 — pm resolution responses: tradeable-rec-inputs

> One capped exchange. Each section states ACCEPT or RESTATE and then the binding wording that
> replaces my R1 text. Wording here supersedes R1-pm.md where they differ. Settled outcomes in
> `decisions.md` are assumed and not re-litigated.

## 90073ec3 — per-quote live/prior-close basis

**ACCEPT** the architect's split, in full: set-level as-of + session basis carried once; per-contract
presence state; `quote age unknown` as the default third state; the vendor-timestamp question
becomes a falsifiable pre-SPEC check rather than an AC written as though the field existed.

My R3 sentence *"Every candidate quote carries the snapshot's as-of and whether it is a live-session
or prior-close quote"* is **withdrawn** and replaced by:

> **R3 (restated) — The candidate SET declares its basis; no individual quote claims a freshness it
> cannot prove.** One as-of and one session basis for the whole set, stated on the surface. Per
> contract, only presence is claimed. A quote captured at 9 PM is a *last known* set, and the set
> says so.

AC-6 is withdrawn and replaced by three:

| # | Acceptance criterion | Verify by |
|---|---|---|
| AC-6a | Any surface that renders a candidate-derived number displays, without expanding or hovering anything, the candidate set's as-of and whether the set is live-session or prior-close. | test |
| AC-6b | For a rec's cited contract, the app renders the contract's quote presence from a stated state — quoted in this snapshot, or no NBBO in this snapshot — and never leaves the reader to infer it from a blank field. | test |
| AC-6c | Loading the app outside market hours: no individual candidate quote carries a live-session label, a per-quote timestamp, or a per-quote age anywhere in v1 — the only freshness claim on any surface is the set-level one from AC-6a. | review |

Ship-blocking set changes: **AC-6a replaces AC-6 in the ship-blocking list is NOT required** — AC-6
was not ship-blocking and neither are its replacements; AC-5 still is.

**Scope ruling on the pre-commit check.** Its result is recorded as a fact before SPEC. A confirmed
per-row vendor quote timestamp may land in v1 **only** as a like-for-like substitution in the slot
`quote age unknown` already occupies — same surface, same state, a stated age instead of the unknown
— introducing no new literal, no new AC and no new degraded state. Anything larger than that
substitution is **FUTURE-DATED**, trigger: the check confirms the vendor field is populated on
chain-snapshot rows, as its own additive follow-up.

**Risk I accept by accepting this.** My R1 Risk 2 (fabricated precision) is mitigated one notch less
than I wrote it: an illiquid contract inside a live-session set is not individually marked stale. I
take that over the alternative, which is labelling per-contract freshness we cannot measure — that
would be the fabrication the AC existed to prevent.

## 54314ed9 — `position_size` is prose; pre-fill would parse free text

**ACCEPT** the architect's option **(b)**. v1 drops the numeric pre-fill. UX's ask points the same
way and is answered the same way: displayed beside, never pre-populated.

Scope item 7 is restated:

> **7. Loop closure (restated).** The rec's stated size is **displayed verbatim, as the AI's own
> words, beside** the simulated-entry quantity field — it never sets that field's value. The decision
> record additively captures whether a risk block was present at entry.

AC-37 is withdrawn and replaced by three:

| # | Acceptance criterion | Verify by |
|---|---|---|
| AC-37a | Given a rec that states a size, opening the simulated-entry dialog from that rec leaves the quantity field at the same default it shows today; the rec's size text appears beside the field, quoted and attributed to the AI. | test |
| AC-37b | Given a rec that states no size at all, the quantity field opens at the same default and the surface reads *size not suggested*, rather than presenting the default as the AI's suggestion. | test |
| AC-37c | Given a rec whose size text names no whole number of contracts (e.g. "small", "1-2 contracts", "1R"), the text is displayed verbatim and no quantity, anywhere in the app, is derived from it. | test |

**Parse ruling (satisfies the architect's one-shared-function condition trivially).** v1 parses
exactly one field, `max_risk`, in exactly one place, server-side, for exactly one consumer, the cap
check. `position_size` is **never parsed** by any lane. The parse's failure state is AC-29's
*couldn't check against your cap* — never a pass by default (R1 Risk 3 stands unchanged).

**FUTURE-DATED:** a machine-readable size field on the rec schema, trigger — after the owner has used
the displayed-beside form for a month and asked for it. Explicitly: **if the response schema opens in
this feature for the contract-identity token (conflict 7d618628), a typed size field does NOT ride
along.** A typed size recreates the pre-fill temptation, and that is a product decision, not a
free rider on someone else's schema change.

## 3458de7f — three cap-record shapes; AC-12 unstatable

**ACCEPT** UX's v1 preference: **one cap stored as {value, unit}** where unit is dollars or percent.
It composes exactly with the already-converged ruling that the effective dollar cap is derived once
server-side with closed not-derivable states; the architect's min-of-two adds a third control the
owner must learn for a benefit one owner with one account cannot use yet.

AC-12 is withdrawn and replaced by five — one per outcome, degraded cases split out:

| # | Acceptance criterion | Verify by |
|---|---|---|
| AC-12a | Given an account size entered and a cap entered **in dollars** that exceeds it, the save is refused with a message naming the problem, and reloading shows the previous values. | test |
| AC-12b | Given a cap entered **as a percent** that is not greater than 0 and less than or equal to 100, the save is refused with a message naming the problem, and reloading shows the previous values. | test |
| AC-12c | Given a cap entered **as a percent**, the save is never refused on account-size grounds, at any account size including none entered — no refusal message mentions the account size. | test |
| AC-12d | Given a cap entered in dollars with **no account size entered**, the save succeeds and the effective dollar cap shown equals the figure entered. | test |
| AC-12e | Given a cap entered as a percent with **no account size entered**, the surface shows the effective dollar cap as not derivable and names why — *account size: not set* — never $0, never blank, never a cap verdict. | test |

AC-11 stands as written and now covers both units (zero, negative, non-numeric).

**FUTURE-DATED:** fraction-of-equity plus an absolute ceiling with min-of-two derivation, under my
existing *Richer risk model* trigger — after the owner has lived with one account size and one cap
for a month. If the owner rules it into v1 instead, AC-12a..AC-12e are rewritten against the derived
dollar cap and the form gains a third control plus a labelled derived readout; that is a decision
before wording, not after.

## cb992bd1 — `not entered` vs `not set` vs `size not suggested`

**ACCEPT** `not set`. UX's reasoning holds — the panel's action reads "Set your risk inputs", so the
state and the remedy share a word. My *not entered* is withdrawn everywhere.

**But `size not suggested` is not a second name for this state — it is a different state**, and it
keeps its own literal. The distinction is checkable by a stranger: `not set` means *the owner
supplied no risk block*; *size not suggested* means *the owner's risk block is present and the model
returned no size*. They can be true at the same time on the same screen, and they are cleared by
different people — one by the owner typing, one by the model answering. One word per state, two
states, two words.

**Binding vocabulary sweep — every place my R1 said something else now says `not set`:**

- AC-15: "…reports *account size: not set* and shows no dollar sizing derived from an account size."
- AC-16: "…the surface names the absence as *not set* rather than showing a dash."
- AC-30: unchanged — already *not set*.
- AC-39: "…and reports the risk block as *not set* — the section is present, not omitted."
- AC-12e (above): *account size: not set*.
- R2's three new reasons become: *not in the candidate set* · *no quote* · *not set*.

Where a surface must name which field is missing, it reads `Account size: not set` /
`Per-trade cap: not set` — same literal, field-scoped. The DESIGN_SYSTEM amendment records **one**
member for this state (`not set`) and one for the model-side absence (`size not suggested`), each
with the one-sentence test above for telling them apart. UX owns the treatment.

| # | Acceptance criterion | Verify by |
|---|---|---|
| AC-16b | Across the rec panel, the settings surface, the cap readout and the export drawer, the owner-supplied-nothing state is rendered with the identical literal *not set* — no surface uses a synonym, a dash, or an empty string. | review |

## Asks answered

### [architect] Does "deliberate pull" cover the ANONYMOUS hand-off export (AC-39)? Is that acceptable, and is it the same read the signed-in rec uses?

**Yes, acceptable — and yes, the same read.** Two product reasons and one condition.

1. The candidate band contains **no owner-private data**. It is a re-serialization of the chain
   snapshot that already serves anonymous browsing today (PROJECT_CONTEXT: anonymous browsing of
   Landing/Ticker/Scanner is unchanged; only sim-position writes and the ask-AI call require a
   session, and "manual export floor stays anonymous"). An anonymous caller obtaining the capped band
   learns nothing about the owner. The **risk block never rides an anonymous path** — AC-39 already
   reports it as *not set*, and AC-17 keeps account size off every surface but the owner's own
   settings.
2. "Deliberate" in R1 means *not on the polled bundle, not on page load* — it is a rule about
   passive traffic and the dump line (AC-7), not about authentication. An anonymous export click is
   as deliberate as a signed-in one.

**Same read:** identical band, identical active-window rule, identical expiration cap, identical
cap-disclosure. What differs is only what travels alongside — risk block *not set*, positions digest
whatever the browser holds — and the record budget (see the next ask).

**Condition, and it rests on a fact only you hold:** this is acceptable *because* a pull triggers no
new vendor call (BRIEF: "re-exposure at serialization, no new vendor fetch"). If assembling the
candidate set can cause a vendor fetch on a cache miss, an anonymous pull becomes an unmetered spend
path — then the read is gated exactly as ask-AI is, and **I withdraw AC-39** rather than keep a
criterion that buys an abuse surface. Tell me which it is before SPEC.

### [architect] One assembler at the SMALLER budget, or two budgets with the drawer stating which?

**Two budgets, one assembler, and the drawer never says "what was sent" unqualified.**

Collapsing the hand-off export to ~12 records damages the path where the constraint does not exist —
a human pasting into a full-window chat has no single-turn budget, and the hand-off is the owner's
highest-leverage use of this feature. Collapsing the in-app prompt to ~64 is infeasible. So the
budgets differ; what must not differ is the assembly rule.

Binding:

| # | Acceptance criterion | Verify by |
|---|---|---|
| AC-40 | The export drawer names, in the surface itself, which consumer it is showing (the in-app recommendation request, or the hand-off export) and how many contracts across how many expirations that consumer carried. | test |
| AC-41 | Given the in-app view, the contracts listed are the ones the displayed rec was produced with — opening the drawer after the snapshot has advanced never shows a set the rec did not receive; if the as-sent set cannot be recovered, the drawer states that instead of listing a re-assembled one. | test |
| AC-42 | Both consumers' sets obey the same band, active-window and expiration-cap rules, and each states the count omitted by the cap with its reason. | review |

AC-41's first clause **depends on a fact you hold** and is the same fact as my R1 ask about the risk
block: does the rec artifact retain what it was sent? If it does, the drawer echoes it. If nothing
pins the as-sent set, AC-41 is satisfied by its second clause — the drawer says the exact set sent is
no longer recoverable — and it must never quietly re-derive and call the result "what left the
machine". A drawer that re-derives while claiming provenance is worse than no drawer.

### [ux] Does "flows into the pre-fill" mean pre-populating the quantity field, or displaying beside it?

**Displaying beside it.** The quantity field is never pre-populated from the AI. See 54314ed9 above:
AC-37a/b/c are the binding wording, the field opens at today's default in every case, and the rec's
size text is rendered verbatim and attributed. You are right that the first reading makes the AI's
number the form default, and the brief's binding framing ("better inputs should mostly make no_trade
BETTER-ARGUED, not convert it to trades") is exactly the drift that would enable. No new state is
needed beyond *size not suggested*, which you already have.

### [ux] Is the candidates read reachable anonymously per AC-39?

**Yes, per the previous answer** — the manual export floor is anonymous today and AC-39 stands on
that. What the anonymous path needs from you is small and bounded: the same drawer, the risk-block
section present and reading *not set*, and the egress sentence stated in the same place. It is not a
second design; it is the signed-in drawer with one section in a state you have already designed.

Two things it does **not** get: no risk-block section that could ever show a value, and no
account-size copy. And the whole answer is conditional on the architect's vendor-fetch fact above — if
an anonymous pull can spend, AC-39 is withdrawn and you design nothing new.
