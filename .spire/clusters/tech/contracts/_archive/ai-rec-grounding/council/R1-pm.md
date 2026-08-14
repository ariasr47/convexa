# R1 — pm position: ai-rec-grounding

## Position

### 0. The decision the BRIEF left open

**When a number the AI asserted cannot be traced to something we computed, the user sees the number —
but not as one of Convexa's numbers.** It is demoted out of the field's value slot and re-rendered as
an attributed quotation from the model, beside a state literal saying we could not resolve it.

Formally: **(b), with teeth — demote, never delete, never refuse.**

**Why not (a) drop it.** Dropping collapses "the model said something we could not confirm" into "the
model said nothing". Those are different facts and the second one is *false*. The card already ships
four distinct absence literals (`—`, `not set`, `unavailable`, `not given`) precisely so absence is
never fabricated; a silent drop would make the app assert "no stop was suggested" about a rec that
suggested one. That is `[absent-is-not-none]` violated at the exact place it was promoted to prevent —
a fabricated claim. Dropping also hides the single most useful diagnostic the owner has: *the model is
inventing levels today*.

**Why not (c) refuse the whole rec.** One unresolvable exit stop does not invalidate a thesis, a
verdict, a cited contract or a cap check. Refusal spends the call, the cooldown and the daily cap to
deliver nothing, and it trains the owner to route around the refusal — the failure mode where a safety
feature makes the product less safe. There is also no measured fabrication rate yet to justify it: we
have a scripted liar, not evidence about the real model. Refusal is **Future**, and Future-gated on a
number (see §4).

**What "with teeth" means, because (b) fails if it is a polite footnote.** A number that stays on
screen in fact-position, with a small grey caveat, is still read as fact by a person sizing a trade at
09:32. So the demotion has to remove the *affordances of a fact*, not just add a caveat:

1. **Voice.** The untraced number renders as the model's words, attributed — "The AI said: stop 412" —
   not as a Convexa field value. Shipped precedent exists and worked: `AC-81` on `tradeable-rec-inputs`
   already displays a non-numeric size text verbatim and forbids deriving any quantity from it.
2. **Slot.** Convexa's number slots hold only numbers Convexa traced. An untraced number never
   occupies one; the slot carries the state literal.
3. **Mechanics.** Nothing untraced pre-fills, seeds, defaults, or is arithmetically derived into any
   quantity, price or limit anywhere in the app.
4. **Voice + slot + mechanics are the product rule.** The caveat text is the least important part of it.

**The one whole-card thing I *do* want, which is where (c) had a real point:** a single card-level
grounding summary — "3 of 4 checked numbers traced to Convexa's own figures" — so the owner gets a
go/slow-down judgement at a glance without reading four field states. That captures refusal's benefit
(a verdict on the card as a whole) at none of its cost.

### 1. What "traced" means to the user

A traced number is one that **resolves to a named computed figure, or lies inside a named computed
range** — and the surface says *which*, and names the figure or the range. Equality-to-a-level is the
wrong bar for a forward-looking target: a target that equals no wall exactly is normal, so an
equality-only check would mark the majority of ordinary recs "no match" and the marker would be tuned
out inside a week. The question the check answers is **"is this number inside the world we measured?"**
— not "did we produce this exact number?".

That has a hard product consequence I am accepting on the record: **the marker must be rare on ordinary
recs and must fire on a fabricating one.** Both halves are ship-blocking criteria (AC-36 and AC-33),
deliberately paired, so the noise bar cannot be met by making the check vacuous.

The user-facing state set for a number the model actually stated is closed and three-membered,
**orthogonal to the shipped absence literals** (it applies only where a value exists):

| State | What the owner reads it as |
|---|---|
| **traced** | Convexa found this number in something it computed, and names what. |
| **no match** | Convexa had the reference and this number is not in it. *Suspicious.* |
| **couldn't check** | Convexa did not have the reference this cycle. *Fog, not fraud.* |

Collapsing **no match** and **couldn't check** into one "unverified" is the failure I most expect from
the other lanes, and it is the same `[absent-is-not-none]` mistake one level down: "we looked and it
isn't there" and "we couldn't look" are opposite advice to a trader.

### 2. Scope — which classes of asserted number, explicitly

| Class | v1 | Note |
|---|---|---|
| The **max-risk dollar figure** (`max_risk`) | **IN** | Checked two ways: against the owner's effective cap (shipped) **and** reconciled against the quoted cost of the cited contract at the stated size. The cap check alone is not traceability — a fabricated figure that happens to sit under the cap passes it. |
| The **position size** (`position_size`) | **IN** | Reference is the cap and the per-contract quoted cost. Absent either → *couldn't check*. |
| The **exit target** (`exit_plan.target`) | **IN** | Reference is Convexa's computed levels and/or the straddle-implied envelope for the cited expiration, with the anchor spot named. |
| The **exit stop** (`exit_plan.stop`) | **IN** | Same reference class as the target. |
| The **cited contract** (strike / expiration / right) | **IN — vocabulary only** | Already verified and shipped. This feature does **not** re-verify it; it makes the *user-facing wording* one vocabulary instead of two, and must not add a second statement about the same fact. |
| A structured number that **cannot be read as a number** (a range, a ratio, prose in a figure slot) | **IN** | Renders verbatim under *couldn't check — not readable as a figure*. Must not silently vanish. |
| **Numbers inside the free prose** (reasoning, "why", narrative levels) | **OUT of verification — IN for one disclosure** | Exhaustive prose verification is a different, much larger feature. But prose numbers must not borrow the verified fields' credibility, so the card carries exactly one plain statement that prose numbers are not checked. |
| **Non-numeric claims** ("dealers are short gamma", "flow is one-sided") | **OUT** | Not attempted in v1, not disclosed per-claim; covered by the single prose statement. |
| **Refusing / withholding a recommendation** on a grounding failure | **OUT** | Explicitly decided against — §0. |
| **Auto-correcting** an untraced number to Convexa's nearest computed level | **OUT** | That is fabrication wearing a different hat. |
| **Re-asking the model** after a failed grounding pass | **OUT** | Cost, cooldown and daily cap; also an invitation to a retry loop that launders a fabrication into a pass on attempt three. |
| Any change to score / tier / entry gate / fingerprint | **OUT** | `[additive-keeps-score-byte-identical]`. |
| **Future** | | Prose numeric extraction against a bounded vocabulary of named levels · a refusal policy (option (c)), gated on a measured fabrication rate over N≥20 real recs · a grounding-rate history readout per model/persona (needs accumulation) · the typed machine-readable size field (already future-dated at `tradeable-rec-inputs`; **barred from riding this change**) · re-grounding a standing rec against a fresher bundle. |

### 3. The folded-in max-risk prompt defect

**Measured today:** `cap_check: not_checkable` on **4 of 4** after-arm trades, because the model's
risk prose names two different dollar figures in one sentence and the parser correctly refuses to
guess. The parser is **not** reopened. The remedy is prompt wording.

**Product outcome I require:** on a real trade verdict with a cap set, the cap comparison produces a
**real verdict** — within or above, with both numbers shown — rather than a permanent "couldn't check".
A safety check that never fires is not a safety check; it is a caveat the owner learns to skip.

**How it is observed, in two halves — because a stochastic model cannot be unit-tested into
compliance:**

- **Deterministic half (ship-blocking).** The instruction sent for the risk figure, *as displayed on
  the export surface*, requires a single dollar amount (AC-27). A fixture rec whose prose names one
  figure resolves to within/above (AC-28). A fixture rec whose prose names two different figures
  **still** refuses, names the ambiguity as the reason, and never guesses, rounds or picks the larger
  (AC-29, ship-blocking — this is the criterion that pins "the parser is not reopened").
- **Measured half (recorded, laddered).** A before/after run of ≥5 real recs across ≥3 tickers, each
  run's verdict recorded with ticker, persona and timestamp in a committed artifact; after-arm ≥4 of 5
  resolving to within/above, against the recorded before-arm 0 of 4 (AC-31).
  **Pre-committed ladder, so this is falsifiable rather than negotiable at the gate:** below 4 of 5 →
  one prompt revision and one re-run; still below → the feature ships with the honest "couldn't check"
  caveat intact, the measured rate recorded in the artifact and in `OPEN_THREADS`, and the seam returns
  to the backlog. **Never a parser loosening. Never a synthesized run** — with no provider key the
  measurement waits and is recorded as not-run (the `tradeable-rec-inputs` V10 refusal is the
  precedent).

**And the reader must be able to tell the two "couldn't check" reasons apart** (AC-30): *the rec gave
no risk figure* and *the risk figure named more than one amount* are different facts about the model,
and the second is the one the prompt fix is supposed to eliminate — if they read identically, nobody
can see whether the fix worked.

### 4. User stories

- **S1 — Only traced numbers sit in Convexa's number slots.** As the owner, I want every figure the
  card presents as a Convexa field value to be one Convexa traced to something it computed, so I never
  size a trade against an invented level.
- **S2 — I still see what the model said.** As the owner, when a number can't be traced I want to read
  it anyway, in the model's voice, so I can judge it myself instead of wondering what was hidden.
- **S3 — One glance at how grounded this rec is.** As the owner, I want one card-level statement of how
  many checked numbers resolved, so I know whether to slow down before reading the details.
- **S4 — Fog and fabrication look different.** As the owner, I want "we looked and it isn't there" to
  read differently from "we couldn't look", because they are opposite advice.
- **S5 — I know where the checking stops.** As the owner, I want the card to say plainly that numbers
  inside the AI's written reasoning are not checked, so I don't extend the verified fields' credibility
  to a sentence.
- **S6 — A cap check that actually checks.** As the owner, I want the cap comparison to reach a real
  verdict on real recs, so the one check that protects my account isn't permanently "couldn't check".
- **S7 — Show me it works against a liar.** As the owner, I want to see the app's behaviour against a
  model that invents levels, so the protection is demonstrated rather than asserted.
- **S8 — Nothing else moves.** As the owner, I want scoring, the page, the stream and the simulated-only
  boundary untouched by any of this.

### 5. Acceptance criteria

Every row is observable without reading source. `Verify by` is risk-based, not one-test-per-row:
`test` where a silent regression under an unrelated change is plausible (a state literal collapsing to
a synonym, a marker quietly disappearing, a derivation creeping back in, two statements about one fact
re-appearing, a closed set gaining a bare-number member), `review` where the behaviour is visible and
intentional and a human notices it on a normal pass (wording, placement, ordering, a committed
measurement artifact). Rows marked **(ship-blocking)** are the ones whose failure produces a wrong
trade or a false claim.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | S1 | On a trade verdict, every one of the four checked numbers that carries a value renders exactly one grounding state — *traced*, *no match*, or *couldn't check* — visible without hovering or expanding anything; a value with no state never renders anywhere. **(ship-blocking)** | test |
| AC-2 | S1 | A *traced* number names, in the same visual block, the computed figure or range it resolved to, in words naming something the reader can find elsewhere on the card or the ticker page. | test |
| AC-3 | S1 | Where a *traced* claim rests on nearness or containment rather than exact equality, the surface states the range or tolerance applied and the anchor it was measured from. | review |
| AC-4 | S1 | A number that fails to resolve never appears in a Convexa field value slot; the slot carries the state literal and the figure appears only as attributed model text. **(ship-blocking)** | test |
| AC-5 | S1 | No untraced number pre-fills, seeds, defaults or is arithmetically derived into any quantity, price or limit anywhere in the app; opening the simulated entry dialog from such a rec leaves every field at the default it shows today. **(ship-blocking)** | test |
| AC-6 | S1 | A stated number the app cannot read as a figure at all (a range, a ratio, prose in a figure slot) renders verbatim under a *not readable as a figure* state and is never silently omitted. | test |
| AC-7 | S1 | Grounding states are pinned to the moment the rec was produced and labelled as of that moment; no state changes or upgrades as newer data arrives, and editing the risk inputs afterwards shows the shipped superseded-inputs strip rather than a changed grounding state. | test |
| AC-8 | S2 | A rec whose exit stop resolves to nothing still shows the stop the model gave, readable without expanding anything. | test |
| AC-9 | S2 | Untraced model text renders as a quotation attributed to the AI and is distinguishable from a Convexa field value in a black-and-white screenshot — never by colour alone. | review |
| AC-10 | S2 | The recommendation is never withheld, blanked, greyed or disabled because a number failed to resolve: the verdict, the reasoning, the levels section and the entry action all render exactly as on a fully traced rec. **(ship-blocking)** | test |
| AC-11 | S2 | No grounding state adds or removes a copy, export or accept affordance anywhere on the card. | review |
| AC-12 | S3 | The card carries one summary line naming how many of the checked numbers resolved and how many did not, visible without expanding, and present on a fully traced rec too — it states the positive rather than disappearing. | test |
| AC-13 | S3 | The summary counts only numbers the model actually stated: absent numbers appear in neither the numerator nor the denominator, and a rec stating none of the four renders a distinct literal rather than *0 of 0*. | test |
| AC-14 | S3 | The summary's wording scopes itself to the numbers Convexa checks and never claims the recommendation as a whole is verified. | review |
| AC-15 | S3 | On a `no_trade` verdict no grounding state, summary, marker or caveat renders anywhere on the card — with a cap set and with none — and the shipped `—` plus its not-applicable tip remains the card's only not-applicable statement. **(ship-blocking)** | test |
| AC-16 | S3 | On a rec produced by the local rule-based fallback, no per-number grounding state renders and the card states the figures are Convexa's own rules rather than a model's. | review |
| AC-17 | S4 | *Couldn't check — the figure we compare against was unavailable this cycle* renders as a literal distinct from *no match in what Convexa computed*, and both are distinct from every shipped absence literal (`—`, `not set`, `unavailable`, `not given`). **(ship-blocking)** | test |
| AC-18 | S4 | A *couldn't check* state names which missing input blocked the check. | test |
| AC-19 | S4 | A field carrying no value at all (`not given`, `not set`, `unavailable`, `—`) carries no grounding state, marker, chip or tint. | test |
| AC-20 | S4 | On a live-stream drop no grounding state dims, changes, or flips to *couldn't check*; the grounding block renders un-dimmed with no offline marker while live-derived tiles degrade. | test |
| AC-21 | S4 | When the grounding pass itself fails, the rec still returns and the card renders one *grounding unavailable for this recommendation* statement in place of per-number states, no figure is presented as traced, and the ticker page, bundle and stream are untouched — no error page, no HTTP error. **(ship-blocking)** | test |
| AC-22 | S4 | Exactly one statement on the card explains any one fact: with a risk figure that cannot be read, the number of statements on the card naming that ambiguity is one. | test |
| AC-23 | S4 | The export / hand-off surface carries the same grounding states, in words, for the same numbers; a figure untraced on the card is untraced in the artifact. | test |
| AC-24 | S5 | One statement, placed with the reasoning and not with the fields, says that numbers inside the AI's written reasoning are not checked. | review |
| AC-25 | S5 | No number inside the reasoning text acquires a grounding state, marker, chip, tint, link or tooltip. | test |
| AC-26 | S5 | Prose numbers are excluded from the summary's counts, and no surface implies they were checked. | review |
| AC-27 | S6 | The instruction sent for the risk figure, as displayed on the export surface, requires a single dollar amount. | review |
| AC-28 | S6 | With a risk figure readable as one dollar amount and an effective cap present, the cap surface shows *within* or *above* with both numbers — shipped behaviour unchanged. | test |
| AC-29 | S6 | With a risk figure naming two different dollar amounts, the cap surface still refuses to decide and names the ambiguity as the reason; nothing guesses, rounds, picks the larger, or reports a pass by default. **(ship-blocking)** | test |
| AC-30 | S6 | *The rec gave no risk figure* and *the risk figure named more than one amount* render as distinct literals. | test |
| AC-31 | S6 | A committed before/after artifact records ≥5 real recommendations across ≥3 tickers with per-run verdict, ticker, persona and timestamp; the after-arm shows ≥4 of 5 resolving to *within* or *above* against the recorded before-arm 0 of 4. No run is synthesized; with no provider key the measurement is recorded as not-run and the pre-committed ladder in §3 applies. | review |
| AC-32 | S6 | The max-risk figure is reconciled against the quoted cost of the cited contract at the stated size wherever both are present; where either is absent the state is *couldn't check* and never *traced*. Being under the cap alone never renders as traced. | test |
| AC-33 | S7 | With the scripted fabricating scenario enabled, a rec asserting an exit stop and target that exist nowhere in the bundle renders both as *no match* with the model's text quoted, no figure in either value slot, and the summary reporting the shortfall. **(ship-blocking)** | test |
| AC-34 | S7 | With the same scenario asserting a contract outside the candidate set, the shipped off-set literal renders and the grounding vocabulary adds no second statement about that same fact. | test |
| AC-35 | S7 | The fabricating scenario is unreachable unless the scenario registry is explicitly enabled, and is not reachable on the deployed public surface. | test |
| AC-36 | S7 | Across the same measured run of ≥5 ordinary real recommendations with all inputs available, at least 4 show zero *no match* markers — the check is rare on honest recs while AC-33 proves it still fires on a fabricating one. **(ship-blocking)** | review |
| AC-37 | S8 | The opportunity score, tier and state fingerprint are byte-identical with and without grounding, on both bundle branches. **(ship-blocking)** | test |
| AC-38 | S8 | Weakening or removing the grounding requirement on any one of the four checked numbers makes the build go red, and that poison test is proven non-vacuous. **(ship-blocking)** | test |
| AC-39 | S8 | Adding a fifth stated number to the rec without a grounding state is build-breaking rather than merely discouraged. | test |
| AC-40 | S8 | Grounding states render from a closed token through a lookup; no surface compares two figures, re-derives a match, or picks a literal by inspecting a null in the browser. | test |
| AC-41 | S8 | Entry from a rec remains simulated behind the existing confirm regardless of grounding state, and no grounding state enables or reaches any real order path. | review |
| AC-42 | S8 | The AI cooldown and daily-cap counters advance for a rec request exactly as before, and a failed grounding pass never triggers a re-request to the model. | test |

## Risks I see

- **Crying wolf.** The single biggest product risk. If *no match* fires on ordinary recs — most likely
  by demanding equality to a computed level for a forward-looking target — the marker becomes
  wallpaper within a week and the feature makes the app *less* trustworthy, because a real fabrication
  arrives dressed identically to the noise. AC-36 is the bar; AC-33 and AC-38 stop the bar being met
  by gutting the check.
- **Caveat pile-up.** `tradeable-rec-inputs` shipped a Critical exactly here: three individually
  correct rules composed into a "couldn't check your cap" caveat on *every* no-trade card. This
  feature adds up to four field states plus a summary plus a prose disclosure to the same card. AC-15,
  AC-19 and AC-22 exist specifically to stop the recurrence, and I expect the composed-states render
  to be the hardest thing to get right at QA — the pass that finds it will be observation, not a suite.
- **A demoted number is still a number on a screen.** Voice, slot and mechanics reduce the chance the
  owner acts on an untraced stop; they do not eliminate it. I am accepting that residual risk over the
  larger risk of hiding what the model said. If real use shows the owner acting on quoted figures, the
  correct escalation is the Future refusal policy, not a bigger warning.
- **The prompt fix cannot be guaranteed.** The model is stochastic and the vendor can change it under
  us. The prompt instruction is deterministic and testable; the *compliance rate* is a measurement with
  a ladder. Anyone treating AC-31 as a pass/fail gate on a single run will either block a good feature
  or wave through a bad measurement.
- **Verification going stale.** A number traced at 10:00 against a 10:00 bundle is not traced at 14:00.
  AC-7 pins the state as-of production time; the risk is a lane implementing a live re-check that
  silently upgrades a *no match* to *traced* as the market drifts into the number.
- **Scope creep into prose.** Half-implemented prose checking is worse than none: it makes the
  unchecked prose numbers look checked. AC-25 makes the boundary observable so a partial implementation
  is visible rather than plausible.
- **A grounding failure taking the rec down with it.** The pass is new code between the model's answer
  and the render. If it can throw, it can blank the card. AC-21 makes that a ship-blocker.
- **Two vocabularies for one idea.** The card already says *off the candidate set* for a bad contract.
  If grounding adds a parallel word for the same fact, the owner has to learn two dialects. AC-34.

## Assumptions I'm making about the other two lanes

**Architect**

1. The rec response can carry, per checked number, a grounding state token **plus a human-readable
   source name plus the compared figure(s)**, all decided server-side at serialization on the same
   request — no second round trip, no client-side comparison. If any part of that must be derived in
   the browser, AC-40 fails and I need to know at R2.
2. The reference set for the exit target and stop (Convexa's computed levels and/or the
   straddle-implied envelope for the cited expiration) is available on the request that serializes the
   rec, **without a new vendor call and without forcing a snapshot refresh**.
3. Traceability for a forward-looking price can be expressed as **containment in a named computed
   range**, not only equality to a computed level. If the architect's position is exact-match-only, that
   is a direct conflict with AC-36 and I will raise it at R2 rather than accept the noise.
4. Any tolerance or range used is **a single stated constant**, not per-field tuning — otherwise AC-3
   becomes unwritable copy and the check becomes unfalsifiable.
5. The max-risk parser can expose **why** it refused (nothing given vs. two different figures) as a
   distinguishable reason **without loosening the ambiguity rule**. AC-30 depends entirely on this. If
   it cannot, the prompt fix becomes unobservable and I want that surfaced at R2, not at GATE Q.
6. Max risk can be reconciled against the cited contract's quoted cost at the stated size when both are
   present; where the arithmetic is not sound (no two-sided quote, undetermined right, a size that is
   not a whole number of contracts) it degrades to *couldn't check* rather than being dropped or
   assumed traced.
7. The existing four-field enumeration can carry the new state without any path from it to the entry
   gate, the score, the tier or the fingerprint — so AC-37 is structural, not a passing measurement.
8. The scenario provider registry can host a fabricating scenario that is off unless explicitly
   enabled and unreachable in production (AC-35).
9. Adding a fifth stated number without a grounding state can be made **build-breaking** (AC-39) — the
   `[structural-over-prose-enforcement]` bar, with a non-vacuous poison test.

**UX**

10. The card can carry one summary line **plus** up to four field states without pushing the verdict
    below the fold or producing the caveat wall described in Risks — and if it cannot, UX tells me at
    R2 which of the two must go, rather than shrinking the states into a tooltip.
11. There is a treatment for *the model's words, quoted* that a person distinguishes from a Convexa
    field value **at a glance and in a black-and-white screenshot** — using existing theme tokens, no
    new palette slot, no success/error slot for a no-side state (AC-9).
12. *No match* can use the `warning.*` + icon treatment (the shipped cap-annotation precedent) **without
    competing visually with the cap warning when both fire on the same card**, and the two do not read
    as one doubled alarm.
13. The three states can be rendered as **words that survive a text-only artifact** — the export drawer
    has no colour, so the state must be legible without styling (AC-23).
14. The prose disclosure can live once, near the reasoning, without becoming a second banner (AC-24).
15. No new animation family is needed for any of this — `[single-motion-moment]` holds.
16. UX will treat the four absence literals as **already settled and off-limits**: grounding adds states
    *beside* them, never a synonym for one of them (AC-17, AC-19).
