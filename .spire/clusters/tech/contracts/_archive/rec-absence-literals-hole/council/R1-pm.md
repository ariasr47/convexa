# R1 — pm position: rec-absence-literals-hole

## Position

### 0. The product problem in one sentence

A card headed **`Trade · long`** can print `Strike(s): —` — and `—` is the app's shipped word for
*"No entry, so there is nothing to size."* The trader cannot tell **"the model never named a
strike"** from **"no strike applies."** The first is a rec you must not act on; the second is a rec
with nothing to act on. Today they are the same three pixels.

This feature exists to make those two facts **different on screen**, and to stop an omission from
becoming a position.

---

### 1. Scope ruling A — all six fields, but they are NOT one class

The BRIEF names six. I am **keeping all six in scope for the display fix** and **splitting them into
two classes with different obligations**. This is not a compromise between "six" and "four" — it is
the ruling that a smaller v1 is *wrong on the display axis* and *too wide on the standing axis*.

| Class | Fields | Why the class exists |
|---|---|---|
| **A — position-defining** | `Structure`, `Strike(s)`, `Expiration`, `Entry trigger` | These answer *what would I hold, and when do I get in*. If one is missing, there is no position to take. An omission here is the wrong-trade failure the BRIEF describes. |
| **B — qualifying** | `Time horizon`, `Confidence` | These *colour* a rec that is already fully specified. A trade with a named structure, strike, expiration and trigger but no stated horizon is still a trade you can enter; it is just less well described. |

**Ruling A1 — all six get the absence literal.** No smaller v1. `Time horizon` and `Confidence`
were discovered late and are softer, but cutting them **re-creates the exact defect on the same
card**: two rows would still print the reserved `—` under a `Trade` heading. A reader who learns
"on this card `—` means the model didn't say" from four rows and then meets two rows where `—` means
something else has been taught a **false rule**, which is strictly worse than today's uniform
ambiguity. It also fails to close `ai-rec-grounding` SPEC §9.5's named residual, which is the stated
reason this feature was selected. The display fix is the same shape at every one of the six sites;
there is no effort argument for a partial pass.

**Ruling A2 — only Class A changes the rec's standing.** Class B renders its literal and nothing
else happens: no card-level line, no change to Accept. A missing confidence figure is a gap in the
description, not a hole in the trade. Making it raise an alarm would spend the alarm's credibility
on the least consequential field on the card, and the alarm is the only part of this feature that
has to be *noticed*.

**This ruling is observable, not a preference** — AC-11 pins it: a card missing only `Time horizon`
and `Confidence` shows literals and **no** standing line; a card missing `Strike(s)` shows both.

---

### 2. Scope ruling B — label AND change the standing, but withhold at the *input* boundary, not the display

The council asked whether a silently-omitted `Strike(s)` on a TRADE verdict should merely be
**labelled**, or should change the rec's **standing**. My ruling is: **both, split by boundary.**

**B1 — The rec is never withheld, blanked, greyed, or re-verdicted.** `ai-rec-grounding` shipped
*"rec never withheld/blanked/greyed"* as a ship-blocking criterion; that holds here unchanged. And
the browser must not overrule the model: if the model said `trade`, the card still says `trade`.
Re-deriving a softer verdict client-side because a field looks empty is precisely the
re-derivation `digested-labels-not-raw-dump` forbids, and it would make the headline a *computed
opinion* that no server produced and no test can anchor.

**B2 — The card carries a distinct standing: *not actionable as given*.** One card-level line, on a
trade card where any Class-A field was never named, saying the rec cannot be acted on as written and
naming the field(s) missing. Absent that line, the omission is discoverable only by scanning six
rows — and the failure this feature prevents is *acting without noticing*. A per-row literal alone
is a correct label that a hurried trader will not read. Ship-blocking (AC-10).

**B3 — Accept must not seed, default, infer, or guess a Class-A field the model never named.** This
is where I take the strongest position, and the shipped precedent is exact: `ai-rec-grounding`'s
prefill gate already **withholds a seed** for an untraced figure, and the withheld field **says
why**. The moment a figure stops being a display and becomes an *input* to a simulated position, an
un-named value is no longer a cosmetic gap — it is a fabricated trade parameter with a human's
confirm stamped on it. `[no-real-order-path]` keeps this in paper today; that is a reason to fix it
now, cheaply, not a reason to tolerate it.

**B4 — But Accept opens empty-with-reason; it is not hard-blocked.** I considered and reject a hard
block. A block mints a new refusal vocabulary, takes agency from a trader who may well know the
strike he wants, and creates a dead-end state with no exit. Empty-with-reason forces a *deliberate
human keystroke* at the exact point the omission would otherwise become an input — which is the
whole safety property — while leaving the trader in control. It also reuses a surface that already
ships (the withheld-prefill reason line) instead of inventing one.

**What would change my mind at R2:** if the entry surface cannot leave a field empty without
producing an invalid or silently-defaulted entry, then empty-with-reason is not safe and the block
becomes correct. I want that stated, not discovered at build.

---

### 3. Scope ruling C — what is OUT, so this does not re-open `ai-rec-grounding`

**Out (this feature must not do these):**

1. **No grounding marker, tint, clause, or tooltip on the six fields.** They stay *outside* the
   checked set. "The model didn't say it" and "we didn't check it" are different facts; wiring the
   six into grounding's marked set would merge them and re-open the allowlist §9.5 closed.
2. **No change to what counts as traced / untraced / not-checkable**, to the untraced-rate
   measurement, or to that feature's measurement ladder.
3. **No prompt change to make the model emit these fields more often.** Even a perfect prompt cannot
   guarantee emission; this fix must work *when the model omits anyway*. Prompt tuning is a separate,
   future-dated item and must not be a precondition here.
4. **No new absence word.** Every literal rendered must come from the vocabulary already shipped. A
   fifth or sixth synonym for "missing" is how a closed vocabulary stops being closed.
5. **No change to the `no_trade` branch.** `—` there is *correct* and stays. This feature narrows
   `—` to that one meaning; it does not retire it.
6. **No export/egress widening.** `ai-rec-grounding` ruled that out under `egress-copy-tracks-payload`
   and recorded that its export half was vacuously true — *do not chase it*.
7. **No score, tier, or fingerprint movement.** The rec is not a scoring input.
8. **Not the Positions / reassessment surface.** Entry recs only.
9. **No aggregate null-rate dashboard.** That is `degradation-visibility`, flagged RISING for three
   gates; naming it here does not license building it here.

**Future-dated (named so they are not silently absorbed):** an omission-rate metric across recs;
a prompt revision measured against the omission rate this feature makes visible; carrying the same
treatment to the position-aware reassessment rec; a machine-readable "actionable" flag other surfaces
could consume.

---

### 4. Product behavior — the facts the vocabulary must keep apart

The card must let a reader distinguish these, **on screen, without hovering and without a tooltip**:

| Fact | When it is true |
|---|---|
| **Not applicable** | There is no entry, so this field has nothing to describe. `no_trade` cards only. This is the reserved `—`. |
| **The model never said** | A trade verdict came back and this field is simply absent from the model's answer. |
| **Couldn't read it this cycle** | The response arrived but carries no usable reason for this field — an older or degraded response. |
| **We didn't check it** *(already shipped)* | `ai-rec-grounding`'s existing states. Must not be confused with any of the above. |

Exact wording is UX's call from the shipped set. My binding requirement is **mutual distinctness**
and that **"the model never said" never renders as "not applicable."**

**Standing states of a trade rec:**

- **Fully specified** — all four Class-A fields named. No standing line. Accept behaves exactly as
  today.
- **Not actionable as given** — one or more Class-A fields never named. Standing line present and
  names the field(s). Accept opens with those fields empty and their reason.
- **Under-described** — only Class-B fields missing. Literals on those rows. No standing line, no
  Accept change.

---

### 5. User stories

- **US-1** — As a trader reading a `Trade` verdict, I want to see plainly when the model never named
  a field, **so that** I do not act on a strike or expiration nobody actually chose.
- **US-2** — As a trader reading a `no_trade` verdict, I want `—` to keep meaning "no entry, nothing
  to size," **so that** the one mark I already trust does not quietly acquire a second meaning.
- **US-3** — As a trader clicking Accept, I want a field the model never named to arrive **empty with
  its reason**, **so that** an omission cannot become a tracked position by default.
- **US-4** — As a trader looking at a degraded or older response, I want an honest literal rather than
  a blank, a `—`, or a null-looking cell, **so that** I can tell a data problem from a model omission.
- **US-5** — As a trader, I want the rec to stay fully readable in every one of these states, **so
  that** an honesty improvement never costs me the advice I asked for.
- **US-6** — As the owner, I want to know **how often** the model actually omits a position-defining
  field, **so that** I can judge whether the next fix is a prompt change or nothing at all.

---

### 6. Acceptance criteria

Every row states an outcome someone can observe on a running card or in a build result, without
reading source. **(SB)** = ship-blocking. `Verify by` is risk-based: automated where a silent
regression under an unrelated refactor is plausible, review where the behavior is visible and
intentional.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1 | On a card headed with a **trade** verdict where the model named none of the six fields, each of the six rows displays an absence literal drawn from the app's existing closed absence vocabulary, and the character `—` appears in none of those six rows. | test |
| AC-2 | US-1 | On a **trade** card where three of the six were named and three were not: the three named rows display the model's own text exactly as they do today, and only the three unnamed rows change. A fully-specified rec renders identically to before this feature. | test |
| AC-3 **(SB)** | US-2 | On a **no_trade** card, all six rows still display `—`, unchanged from today, and **no** absence literal from this feature appears anywhere on that card. | test |
| AC-4 **(SB)** | US-1, US-4 | On a single card exercising all three states at once — one field the model never named, one field whose reason could not be read this cycle, one field that is not applicable — the three rows display **three different strings**, no two identical, legible without hover, tooltip, colour, or focus. | test |
| AC-5 **(SB)** | US-4 | When the response carries **no per-field reason information at all** (an older or degraded response), the card still renders in full, every one of the six rows shows an honest absence literal, and no row shows `—`, an empty cell, or any of `null` / `undefined` / `NaN`. No error state, no HTTP failure surfaces to the user. | test |
| AC-6 | US-4 | When a field's reason value is one this build does not recognise, that row falls back to a single defined absence literal — it never prints the raw value and never leaves the cell blank. | test |
| AC-7 | US-1 | When the model returns a field whose value is empty or whitespace only, the row is treated as **not named** and shows the absence literal — not a named value rendered as a blank cell. | test |
| AC-8 | US-5 | While a rec is on screen and the live stream drops, all six rows keep exactly what they were showing. No row flips to an absence literal, to `—`, or to a dimmed/offline treatment because of the drop. | test |
| AC-9 | US-5 | When the rec goes stale because a newer bundle landed, the six rows are unchanged; only the existing as-of / stale treatment changes. | review |
| AC-10 **(SB)** | US-1 | A **trade** card missing one or more of `Structure` / `Strike(s)` / `Expiration` / `Entry trigger` displays **exactly one** card-level line stating the rec is not actionable as given and naming the missing field(s). A trade card with all four named displays **no** such line. | test |
| AC-11 **(SB)** | US-1 | A **trade** card missing **only** `Time horizon` and/or `Confidence` displays the absence literal on those rows, displays **no** card-level standing line, and its Accept behaves exactly as on a fully-specified card. | test |
| AC-12 **(SB)** | US-3 | Clicking **Accept** on a trade card where `Structure`, `Strike(s)` or `Expiration` was never named opens the simulated entry surface with **no value pre-typed** in the corresponding field, and a one-line reason stating the model did not give it. No value is inferred from the option chain, the ticker, a prior position, or a default. | test |
| AC-13 | US-3 | Clicking **Accept** on a trade card where those fields **were** named seeds the entry surface exactly as it does today — this feature changes nothing on the fully-specified path. | test |
| AC-14 **(SB)** | US-5 | In every state above, the rec itself is never withheld, blanked, greyed, hidden, or re-verdicted: the verdict headline text for a given response is identical to what it is today, and the model's own words for every named field render unchanged. | test |
| AC-15 | US-1 | On a card that carries both this feature's standing line and `ai-rec-grounding`'s existing card-level line, both are present, visibly distinguishable, and neither restates the other's fact. | review |
| AC-16 | US-2 | Across a sweep of the card in every state exercised by AC-1 through AC-14, the character `—` appears **only** on `no_trade` cards. | test |
| AC-17 **(SB)** | US-2 | Reintroducing a bare `—` fallback at any of the six field render sites makes an automated check go **red**; restoring the code makes it green; and the check is demonstrated non-vacuous (it passes for a reason, not by never firing). | test |
| AC-18 | US-1 | No absence word outside the already-shipped closed vocabulary appears on the card; the set of distinct absence strings rendered is a subset of the shipped set. | review |
| AC-19 | US-5 | The panel's existing non-rec states — unavailable, error, cooldown, daily cap, no key, signed-out — display their current copy unchanged, and no absence literal from this feature appears on a card that carries no rec. | review |
| AC-20 | — | For the same request, `opportunity_score`, `opportunity_tier` and `state_fingerprint` are byte-identical before and after this feature. | test |
| AC-21 | US-6 | A committed artifact records, over **N ≥ 10 real trade-verdict recs**, how many times each of the six fields was omitted. The number is recorded honestly with no tolerance and no threshold; it does **not** gate ship. A **zero** observed rate does **not** retire the feature — a deliberately forced omission must still render correctly per AC-1. | review |

**Method notes (risk-based).** The `test` marks concentrate on the two things that die silently
under an unrelated refactor: the **reserved-mark discipline** (AC-1/3/4/5/16/17) and the **input
boundary** (AC-12/13). AC-4 is marked `test` rather than `review` because string distinctness is
exactly the property that collapses quietly when two literals are edited months apart. Copy,
placement and non-rec states (AC-9/15/18/19) are marked `review` — they are visible and intentional,
and a snapshot there buys brittleness rather than safety. AC-21 is `review` of a committed artifact,
not automation. **No one-test-per-AC**: AC-1, AC-12 and AC-16 are each set-scoped over their fields
on purpose — one check protecting the behavior beats six near-identical pokes.

---

## Risks I see

1. **Literal blindness.** This card already carries grounding clauses and markers. Adding six more
   absence strings risks a wall of caveats a trader stops reading — the very halo effect this
   feature exists to close, re-created in a new form. My mitigation is the class split: the
   card-level standing line (Class A only) is the thing that must be *noticed*; the row literals are
   the *detail* you read once you have been stopped. If R2 pushes the standing line onto Class B too,
   this risk goes from managed to realised.
2. **A second card-level line competing with grounding's.** Two card-level honesty lines on one card
   is one more than a reader will parse. AC-15 makes it checkable, but if UX finds no room, the
   right answer may be *one merged line*, not two — and that is a scope conversation I want at R2,
   not at build.
3. **Unknown base rate.** Nobody has measured how often the model actually omits a Class-A field on
   a trade verdict. If it is near zero, we ship a real safety property that almost never fires, and
   someone later calls it dead weight; if it is high, the card will frequently read "not actionable
   as given" and the AI rec will look broken to its only user. AC-21 forces the number onto paper
   *without* letting it gate ship — deliberately mirroring the honest-measurement discipline
   `ai-rec-grounding` used for its untraced rate.
4. **The Accept ruling is an owner-visible behavior change.** A rec that used to Accept in one click
   may now require typing a strike. That is the point, but it is friction the owner did not ask for,
   and it should be a conscious ruling rather than a surprise at first use.
5. **Scope drift into prompt tuning.** "Just make the model always emit a strike" is the tempting
   answer and it is not a fix — it is unenforceable, and it would make this feature's shipping
   conditional on an LLM behaving. Named OUT above; I expect it to resurface.
6. **Vocabulary inflation.** Three distinct facts must be distinguishable using words already
   shipped. If the shipped set genuinely lacks a string meaning "the model never said," the honest
   answer is one addition with a recorded rationale — not three synonyms, and not overloading an
   existing word to mean two things.
7. **The `no_trade` branch is a regression target, not a bystander.** The single easiest way to ship
   a *worse* card than today is to accidentally route the `no_trade` rows through the new lookup and
   turn `—` into "not given." AC-3 and AC-16 exist for exactly this.
8. **A partial ship is worse than no ship.** If effort pressure at build time cuts two of the six,
   the card teaches a false rule (see Ruling A1). If a cut becomes necessary, the correct cut is the
   **Accept/standing half** (B2–B4), keeping all six literals — never a subset of the six.

---

## Assumptions I'm making about the other two lanes

**About the technical shape (architect):**

- The response the card already fetches can carry a per-field reason for **all six** fields in the
  **same single call** — no second request, no new fetch, no new endpoint, and no change to when the
  card is fetched.
- The server can distinguish **"the model did not return this field"** from **"the model returned it
  empty."** If it cannot, AC-7 collapses into AC-1 and I need that said at R2, not discovered at
  build.
- A **`no_trade`** response either carries no such reason for these fields, or carries one the card
  can ignore — either way the card can keep rendering the reserved `—` on `no_trade` without
  re-deriving anything from a null. AC-3 depends on this.
- A response that carries **no reason information at all** (older or degraded) still returns a
  rendered card, never an HTTP error — `[best-effort-isolated-or-null]` holds for this addition.
- Widening the wire's reason set leaves `opportunity_score` / `opportunity_tier` /
  `state_fingerprint` **byte-identical**, and the rec remains outside the scoring path.
- The six render sites can be brought under the **same build-breaking closed-lookup enforcement that
  already ships in the target file** — so AC-17's poison-and-go-red is buildable without a new
  subsystem or a new scanning tool.
- The frontend test setup already runs DOM-level rendering assertions for this card (the rec panel
  and the literal lookup both have shipped specs), so my `test` marks on rendering rows are
  achievable without adding a harness.
- **Accept currently seeds contract fields from the rec.** If it turns out Accept never seeds
  structure/strike/expiration at all today, AC-12 reduces to the reason line alone and my B3 ruling
  is largely already satisfied — I want that correction at R2 rather than a silent no-op AC.
- The entry surface can present a field **empty** without producing an invalid or silently-defaulted
  entry. If it cannot, B4 is unsafe and the hard block becomes the correct ruling.

**About the presentation (ux):**

- The shipped closed vocabulary already contains **three mutually distinct strings** covering "not
  applicable," "the model never said," and "couldn't read it this cycle" — so AC-4 is satisfiable
  **without minting a new word**. If it does not, that is an R2 item, not a build-time improvisation.
- The three states are distinguishable **by text alone** — no reliance on colour, tint, hover, or
  focus — so a screenshot and a screen reader both convey the same fact.
- **One** card-level standing line can be placed without displacing or visually colliding with
  `ai-rec-grounding`'s existing card-level line, and the two read as different facts (AC-15).
- The entry surface already has a **per-field reason slot** — the withheld-prefill reason shipped
  there — so AC-12's reason line reuses an existing region rather than adding a new dialog area.
- Six absence literals plus the existing grounding treatment do not push the card past what a reader
  will scan. If UX's judgement is that it does, I want that at R2, because the answer is a
  presentation change, not a scope cut to the six.
- The standing line is **factual, not alarming** — it states the rec is not actionable as given; it
  does not accuse the model, does not use warning-red semantics reserved for direction, and does not
  read as an app error.
