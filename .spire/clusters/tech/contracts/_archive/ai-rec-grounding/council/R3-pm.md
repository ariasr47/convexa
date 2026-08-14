# R3 — pm resolutions: ai-rec-grounding

One pass. Nine technical conflicts where I am `source` or `raised_by`. Outcomes are CONVERGED,
CONCEDED, or UNRESOLVED — PROMOTE TO PRODUCT. Every criterion below is stated as an observable
outcome plus a `Verify by`; where a criterion lost its verification path I rewrite or withdraw it
here rather than leave it standing.

Naming note for the synthesizer: I use the reader's names for the figures — **the exit stop**, **the
exit target**, **the invalidation level**, **the cited contract**, **the dollar risk figure**, **the
suggested size**. Numbering below keeps my R1 AC numbers so the deltas are traceable; renumber freely.

---

## T0 — the scripted fabricator harness does not exist (AC-33 / AC-35)

**Outcome: CONVERGED.**

All three lanes reached the same fact independently: the scripted hallucinating provider and its
enable flag are Python-era and are not in this backend. I already self-revised at R2; UX self-revised
at R2; the architect raised it. Nothing is contested. What was missing was the replacement evidence
path, stated precisely enough to build against.

**Settled rule.** The fabricating recommendation is a **hand-written fixture**, never a runtime
source: a server-side fixture proves the untraced states resolve, a browser-side fixture proves they
render, and the live browser arm is the local rule-based recommendation, which needs no key, no
network and no registry. No configuration, request parameter or control on a running server ever
selects a fabricating recommendation source.

The S7 risk is unchanged; only the harness moved. Three criteria replace two.

| # | Acceptance criterion | Verify by |
|---|---|---|
| **AC-33** (rewritten, ship-blocking) | A hand-written fabricated recommendation — an exit stop far from every named Convexa anchor, an exit target outside the computed move for the cited tenor, a cited contract absent from the candidate set, and a risk figure naming two different dollar amounts — is fed through the recommendation's own production path against a fixed reference set, and **every one of those figures resolves to an untraced state, none resolves to traced**, and the card-level result is the *none traced* member. No key, no network, no environment flag. | test |
| **AC-33B** (new, ship-blocking) | Rendering that same fabricated recommendation from a stored response fixture, the card shows the *none traced* card-level line and an authorship clause on **every** value-bearing figure, and **no** figure renders as a Convexa-computed value. | test |
| **AC-35** (rewritten) | The fabricated recommendation is reachable only from stored fixtures: on a running server no request parameter, setting or on-screen control selects an alternate or scripted recommendation source, and the app's own configuration readout reports no such source available. | review |

**What I am withdrawing on the record:** the runtime scripted liar. I am not asking for it to be
built. A configuration flip that can put a fabricating model in front of a trader is a worse standing
liability than the demo is worth, and the *none traced* line would look identical whether the liar
was scripted or real — so the demo would not even prove what it appears to prove.

---

## T2 — "at the stated size" is not computable in v1 (AC-32)

**Outcome: CONCEDED**, and further than my own R2 self-revision went.

The architect is right that reconciling a dollar risk figure against a per-contract cost requires a
contract count, and the count exists only as free prose that no lane reads. My R2 fallback — reconcile
against the quoted cost of **one** contract — I now withdraw too, on my own analysis rather than his:
if the recommendation states five contracts and the risk figure happens to land within tolerance of a
single contract's cost, that rule prints **traced** on the one field the owner's account depends on,
from a coincidence. A false *traced* there is worse than an honest silence.

I also reject the architect's option (a) — traced against the owner's effective cap — and that
rejection is not softened by this concession: being under a cap the owner typed is not traceability,
UX reached the same conclusion at R2 from the copy side, and the shipped cap line already states that
fact once.

**Settled rule.** The dollar risk figure **cannot reach *traced* in v1**. It carries the
not-checkable member on the wire so the wire stays total, and the card renders **no per-figure
grounding clause for it** — the shipped cap line remains the single statement about that figure, per
AC-22. The reconciliation against a contract cost, and the typed machine-readable size that would
make it sound, stay future-dated and barred from this change.

| # | Acceptance criterion | Verify by |
|---|---|---|
| **AC-32** (rewritten, ship-blocking) | The dollar risk figure never renders as traced and never carries a grounding clause, marker, chip or tint anywhere on the card or in the export artifact; the shipped cap line is the only statement on the card about that figure, and the number of statements naming its verdict is exactly one. | test |

**Consequent — AC-13's denominator.** If the counted card-level line survives the human's ruling on
count-vs-qualitative (that conflict is tagged product and is not mine to settle here), its denominator
is **the figures this feature checks that this recommendation actually stated** — the exit stop, the
exit target, the invalidation level and the cited contract, at most four. The dollar risk figure and
the suggested size are in neither numerator nor denominator. An honest recommendation must never read
"2 of 6" forever; that is the caveat wall in a different costume.

**Stated limit the SPEC must carry in one sentence:** in v1 this feature checks the exit stop, the
exit target, the invalidation level and the cited contract. It does not check the dollar risk figure
or the suggested size. That is a smaller feature than the BRIEF's goal sentence and it should be said
plainly rather than papered over with a cap-anchored badge.

---

## T3 — the suggested size is booked IN against a reference it cannot be compared to

**Outcome: CONCEDED.**

Same root as T2, and the architect's honest form is right: booking it **IN** while it can only ever
return *couldn't check* claims coverage the feature does not have. A per-figure state that is constant
across every recommendation that will ever ship carries zero information and costs a line on every
card — which is the exact shape of the Critical `tradeable-rec-inputs` already shipped once, and the
fastest way to teach the owner that these clauses are furniture.

**Settled rule.** The suggested size moves out of the checked set. It carries the not-checkable
member on the wire (omitting it would be the `absent-is-not-none` collapse) and the card renders **no
per-figure clause** for it. What is and is not checked is stated **once**, on the card's definition
surface, permanently true, instead of once per card forever.

Scope table change: the row reads **IN the wire vocabulary · OUT of the checked set — structurally
not checkable in v1 (Convexa does not read a size out of prose)**, with the typed size field staying
future-dated.

| # | Acceptance criterion | Verify by |
|---|---|---|
| **AC-1** (rewritten, ship-blocking) | On a trade verdict, every figure in the checked set that carries a value renders exactly one grounding state, visible without hovering or expanding anything, and a value with no state never renders anywhere. The checked set is exactly: the exit stop, the exit target, the invalidation level, the cited contract. | test |
| **AC-1B** (new) | No per-figure grounding clause, marker, chip or tint renders on the suggested size or the dollar risk figure on any recommendation. | test |
| **AC-1C** (new) | One statement on the card's definition surface names what this feature checks and states plainly that the suggested size is not checked; that statement names no figure the feature does not actually check. | review |
| **AC-39** (reworded) | A stated number added to the recommendation without a grounding member makes the build go red rather than merely being discouraged, and that guard has no documented exemption. | test |

AC-39's old wording fixed a count ("a fifth stated number"). Counting was what made it unbuildable —
the count-free wording survives the invalidation-level scope ruling either way.

**Carried forward, not settled here:** whether the invalidation level ships in the checked set is
tagged `product` by both peers and routes to the human. My R2 pricing stands as my recommendation —
**IN**, four checked figures. If the human cuts it, the checked set is three, AC-1C's list drops it,
and the SPEC states in one sentence that the BRIEF's goal is not met for it on ship.

---

## T10 — AC-21 pins a failure mode that does not exist

**Outcome: CONCEDED.**

The architect's read is decisive and it is the kind I want to lose to: a pure, total, synchronous
resolver with no I/O and no fallible return cannot fail at runtime, so "when the grounding pass itself
fails" names a state the server can never emit. A ship-blocking criterion on an unreachable state
either cannot be tested or gets a failure mode manufactured to satisfy it, which is worse than not
having the criterion. AC-21 as written is withdrawn.

**Settled rule.** The isolation guarantee is delivered **structurally** — the check is total, so every
figure on every return path gets a member and missing inputs are expressed as *couldn't check* on the
affected figure, never as an omitted block. The two reachable degraded states are split and each gets
its own criterion.

| # | Acceptance criterion | Verify by |
|---|---|---|
| **AC-21** (rewritten, ship-blocking) | When a response carries no grounding information at all — a browser talking to a server that predates this feature — the card renders one card-level statement in place of every per-figure clause, no figure renders as a Convexa-traced value, and the recommendation, the ticker page, the bundle and the live stream are otherwise unaffected: no error page, no HTTP error, no blanked card. Observed from a stored response fixture with the grounding information omitted. | test |
| **AC-21B** (new, ship-blocking) | A recommendation for which **every** reference input is missing still returns and renders in full: every figure in the checked set carries the *couldn't check* state, and the verdict, the reasoning, the levels section and the entry action render exactly as on a fully traced recommendation. | test |

AC-21B is the observable proxy for what AC-21 was really protecting — that this new check cannot take
the card down with it. It is reachable from a fixture with an empty reference set, which the withdrawn
version was not.

---

## T17 — where the local rule-based recommendation lands (AC-16)

**Outcome: CONVERGED**, with one concession from me and one from UX.

**I concede the suppression half of AC-16.** The architect established that the local rule-based
recommendation sets its own stop and invalidation level from a named Convexa level. Suppressing the
per-figure clauses there would hide a fact that is *true and useful* — every figure traces, because
Convexa computed all of them — and it would delete the only live, browser-observable evidence arm this
feature has now that the scripted registry is gone (T0). I do not spend evidence for tidiness.

**UX concedes the routing.** The warning-chrome *wasn't checked* member is false on that card and
falsely alarming: those figures **are** Convexa's own numbers. Telling the owner his most trustworthy
card was not checked against Convexa's numbers, in amber, inverts the truth and trains him to discount
the amber everywhere else. "No model asserted anything here" and "a model asserted things and nothing
checked them" are as far apart as any two states in this feature.

**Settled rule.** A recommendation produced by the local rule-based source renders its per-figure
grounding clauses normally, and the **card-level line is its own closed member** stating that the
figures are Convexa's own rules rather than a model's — quiet caption idiom, no warning colour, no
warning icon, because nothing is wrong on that card. It never renders the *wasn't checked* member.

**The card-level set does not grow.** UX withdrew the *nothing to check* member at R2 (no grounding
surface renders on a no-trade verdict at all — my AC-15, unchanged). This member takes that slot. The
set stays at six: four server-emitted grounding outcomes (all traced / some untraced / none traced /
couldn't check), one server-emitted source member (Convexa's own rules), and one client-only branch
(no grounding information present → *wasn't checked*). Exactly one renders on a produced trade
verdict; none renders on a no-trade verdict.

**Priced cost, stated rather than assumed:** this requires the response to be able to say which source
produced the recommendation. The architect established that cost is incurred either way — suppression
would have needed the same discriminator — so it buys the honest card-level line for free.

| # | Acceptance criterion | Verify by |
|---|---|---|
| **AC-16** (rewritten) | On a recommendation produced by the local rule-based source, the card-level line states that the figures are Convexa's own rules rather than a model's, in the same quiet treatment as the all-traced line, with no warning colour and no warning icon; the *wasn't checked* statement does not appear. | test |
| **AC-16B** (new) | On that same recommendation, viewed live with no provider key and no network, the exit stop renders as traced and names the Convexa level it was set from, and the shipped cap line renders its own couldn't-check verdict — both visible in a browser without expanding anything. | review |

AC-16B is the live evidence arm. It is `review` deliberately: it is a visible, intentional
demonstration a human performs, not a silent-regression risk — AC-33/AC-33B carry the regression guard.

---

## T19 — "the model's words, attributed" on a numeric field

**Outcome: CONCEDED.** UX is right and the correction lands squarely on my own stated failure mode.

The exit stop is a numeric field in the recommendation's own structure, not a sentence the model
uttered. Rendering it as *The AI said: stop 412* attributes to the model a string of words the model
never produced — a fabricated quotation, inside a feature whose entire purpose is that the app must not
fabricate. It also restates the field's label inside its value, which is a second statement about one
fact and collides with my own AC-22. The precedent I cited does not carry: that case quoted a genuinely
non-numeric text the model actually wrote.

**Settled rule.** "The model's voice" **does not survive as a mechanism**. It survives in two places
and no others:

1. **As copy** — an authorship clause in *Convexa's* voice stating that the figure is the AI's own and
   was not computed by Convexa. UX spells it; my criteria name the state, not the string.
2. **As type register** — the value itself renders in the model-asserted register, distinct at a glance
   from the Convexa-computed register, and legible in a black-and-white screenshot.

**True quotation marks are reserved for exactly one class:** a stated figure the app cannot read as a
number at all, where the model's literal characters *are* the payload and must render verbatim
(AC-6, unchanged). That is the only place we have wording to quote.

| # | Acceptance criterion | Verify by |
|---|---|---|
| **AC-9** (rewritten) | A figure that failed to trace and a figure that traced, both carrying values, are distinguishable from each other in a black-and-white screenshot without hovering or expanding — never by colour alone — and the untraced one carries a visible clause naming it as the AI's own rather than Convexa's. | review |
| **AC-9B** (new) | No numeric figure renders as an attributed quotation from the model; quotation of the model's literal characters occurs only where the stated figure cannot be read as a number at all (AC-6). | test |

AC-8 stands unchanged: a recommendation whose exit stop traces to nothing still shows the stop the
model gave, readable without expanding anything. That was always the load-bearing half of S2 — the
quotation was the mechanism, not the outcome, and the outcome survives intact.

Note for the synthesizer: **whether the untraced value stays in its slot in the model's type register,
or moves out of the slot entirely, is the open product conflict** and routes to the human. AC-9 above
is written to be the observable outcome under either ruling.

---

## T23 — the literal `grounding unavailable for this recommendation`

**Outcome: CONCEDED.** Two defects in seven words, and one of them is my own criterion turned on me.

`grounding` is the internal feature name. Component names may use it; a string a trader reads may not.
And `unavailable` is one of the four shipped absence literals, where it means *the value is missing*.
Reusing it for a card-level machinery statement makes it a synonym of a settled absence literal —
exactly what my AC-17 forbids and what my R1 assumption 16 promised UX I would not do. The card would
carry `unavailable` in a field slot meaning *no value* and `unavailable` at card level meaning
something else entirely, four inches apart.

**Settled rule.** The literal is withdrawn. The card-level statement for that member is UX's to spell,
in the user's vocabulary, and it contains neither the feature's internal name nor any of the four
shipped absence literals. My criteria name states, not strings — as I already conceded to UX at R2 on
copy generally. Behaviour is unchanged; this is a literal swap.

The criterion that carried the literal is the one T10 already rewrote, so **AC-21 (rewritten) above is
the surviving text** — it states the behaviour and names no literal.

| # | Acceptance criterion | Verify by |
|---|---|---|
| **AC-17** (extended, ship-blocking) | Every card-level and per-figure grounding literal is distinct from every other one **and** from all four shipped absence literals; no grounding literal contains the feature's internal name; *we looked and it is not there* and *we could not look* never render as the same string. | test |

The disjointness half is a genuine silent-regression risk — a copy edit collapses two literals into a
synonym and nothing else notices — which is why this one stays `test` rather than `review`.

---

## T24 — the pre-existing bare-dash hole on five fields (AC-19)

**Outcome: CONVERGED**, on UX's factual premise and my scope ruling together.

UX's premise is correct and I do not contest it: on those five fields absence is rendered outside the
shipped closed literal set, so a model that simply omitted a value renders identically to a
not-applicable dash. AC-19 as written assumed absence was already correctly stated, and on those five
fields it is not.

**My R2 ruling stands, and here is the argument that makes the cut safe rather than merely cheap.**
UX's objection is "attaching a grounding clause to a field whose absence is already mis-stated is
grounding a lie." That objection is exactly right — and it applies to precisely one of the five. Only
the **invalidation level** acquires a grounding clause under this feature. The other four acquire
none: the cited contract's strike and expiration are covered by the shipped contract line and must not
gain a second statement (AC-34), and the remaining two are not figures this feature checks. So the cut
grounds no lie, and I make that testable rather than asserted.

**Settled rule.** The invalidation level moves onto the shipped closed absence-literal set as part of
this feature — ship-blocking, and it is the priced cost of taking the invalidation level into the
checked set. The other four are **OUT**, raised as a named backlog item **`rec-absence-literals-hole`**
(`absent-is-not-none`, HARD class; first-instance evidence supplied by this council) so the cut is on
the record rather than silent. This feature neither creates nor worsens that defect.

| # | Acceptance criterion | Verify by |
|---|---|---|
| **AC-19** (rewritten, ship-blocking) | A field carrying no value renders its absence through the shipped closed absence-literal set and carries no grounding state, marker, chip or tint. This holds for the invalidation level, which moves onto that set as part of this feature. | test |
| **AC-19B** (new, ship-blocking) | No grounding state, marker, chip, tint or clause renders on the structure, the strikes, the expiration or the entry trigger — so no grounding claim ever attaches to a field whose absence this feature leaves mis-stated. | test |

**Stated limit the SPEC must carry:** on those four fields a missing value still renders a bare dash
indistinguishable from the not-applicable dash. It is a real pre-existing defect, it is named and
booked, and it is not fixed here. If the human wants all five, that is a named add with the diff cost
on the record — not a footnote.

**One consequence I confirm from R2:** the named-levels row is cut regardless, because numbers inside
the free prose are OUT of verification in my scope and the single prose-exclusion statement carries
that claim instead (AC-24, placed with the reasoning). So UX's stated trade costs nothing.

---

## T25 — what the tolerance clause does to rendered copy (AC-3)

**Outcome: CONCEDED** on the mechanism, **CONVERGED** on the outcome.

UX is right that a percentage in a per-figure clause is worse than useless: "within 0.1%" is not a
quantity a trader applies to a level in his head at 09:32, "0.1% of what" is not answerable from the
clause, and the rule behind it is a two-branch formula no honest short clause can state. It also turns
a *source* claim into a *threshold* claim, which is a harder thing to defend and a longer thing to read.

My intent behind AC-3 was that a nearness claim must never masquerade as an equality claim. UX's
proposal discharges that intent better than mine did: show **both numbers** and the reader sees the
actual gap instead of inferring it from a percentage. I take it.

**Settled rule.** A traced clause names the anchor **and the anchor's own value**; a containment match
names the range, its endpoints and the tenor it belongs to. No per-figure clause states a percentage or
a tolerance. The tolerance actually applied is stated **exactly once**, on the card's definition
surface, as a single number taken from the response and never composed in the browser. A traced clause
that names a source with no value is a badge and is a defect.

| # | Acceptance criterion | Verify by |
|---|---|---|
| **AC-3** (rewritten, ship-blocking) | Every traced clause carries the anchor's own value alongside the anchor's name — or, for a containment match, the range's endpoints — so the reader can see the gap between the model's figure and Convexa's; a traced clause naming a source with no value renders nowhere. | test |
| **AC-3B** (new) | A containment match reads as containment in a named range for the cited tenor and never as a match to an exact level; the two shapes are visibly different sentences. | review |
| **AC-3C** (new) | The tolerance is stated once on the card's definition surface, as one number taken from the response, and appears in no per-figure clause anywhere on the card or in the export artifact. | review |

AC-3 is `test` because a badge-shaped regression — the value quietly dropped in a refactor, leaving the
name — is silent, plausible and destroys the criterion's whole point. AC-3B and AC-3C are visible,
intentional copy decisions a human sees on a normal pass.

---

## Ledger of criteria changed in this round

| Criterion | What happened |
|---|---|
| AC-1 | rewritten — checked set named explicitly (four figures), count removed from the prose |
| AC-1B, AC-1C | new — no clause on the two unchecked figures; the what-is-checked statement said once |
| AC-3 | rewritten + split into AC-3, AC-3B, AC-3C — anchor value, containment shape, tolerance once |
| AC-9 | rewritten — distinguishability outcome survives, quotation mechanism does not |
| AC-9B | new — no fabricated quotation of a numeric figure |
| AC-13 | denominator settled, conditional on the human's count-vs-qualitative ruling |
| AC-16 | rewritten — local source gets its own quiet card-level member; per-figure clauses kept |
| AC-16B | new — live browser evidence arm |
| AC-17 | extended — literal disjointness made testable |
| AC-19 | rewritten — premise repaired; invalidation level moved onto the closed set |
| AC-19B | new — the four cut fields provably gain no grounding clause |
| AC-21 | rewritten — unreachable failure mode replaced by the reachable no-block state |
| AC-21B | new — all-inputs-missing recommendation still renders in full |
| AC-32 | rewritten — the dollar risk figure cannot reach traced in v1 and carries no clause |
| AC-33 | rewritten + AC-33B new — fixture-based evidence path replacing the scripted registry |
| AC-35 | rewritten — fabrication lives only in fixtures; no runtime path exists |
| AC-39 | reworded — count-free, so the guard has no exemption |

**Withdrawn outright, with nothing replacing them:** the runtime scripted fabricating provider
(T0); the reconciliation of the dollar risk figure against a contract cost (T2); the suggested size as
a checked figure (T3); the runtime grounding-failure state (T10); attributed quotation as the mechanism
for untraced numeric figures (T19); the literal `grounding unavailable for this recommendation` (T23);
the tolerance percentage in per-figure copy (T25).

**Still routing to the human (tagged `product`, untouched here):** the invalidation level in or out of
the checked set · slot relocation vs type register for an untraced value · counted vs qualitative
card-level line · the ship-gate shape for the untraced rate · whether all five bare-dash fields are
bought as a named add.
