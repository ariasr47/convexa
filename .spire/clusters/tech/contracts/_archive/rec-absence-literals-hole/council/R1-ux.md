# R1 — ux position: rec-absence-literals-hole

## Position

### 0. What I found in the code that the brief does not say

Three things reshape this feature. All three are code-verified this round.

**(a) The six fields never render in the `no_trade` branch at all.** `AiRecPanel.tsx:929-996` mounts only
the four risk fields on `no_trade`. `Structure` / `Strike(s)` / `Expiration` / `Entry trigger` /
`Time horizon` are inside the trade branch only (`:1080-1160`). So the reserved `—` on those five is not
"the right literal in the wrong branch" — **it is a literal that has no legitimate branch on these fields
at all.** That lets me take the strongest available position: `dash` must be made *structurally
unreachable* for them, not merely avoided.

**(b) The defect is deterministic on Convexa's own rules path — no LLM key needed.**
`apps/api/src/services/recommendation.rs:818-835` (the local rules fallback, the one that produces the
shipped `local_rules` grounding card) emits `"decision": "trade"` with `"strikes": []` and
`"expiration": null`, every single time. So **`Trade · long` with `Strike(s): —` and `Expiration: —` is
not a rare model omission — it is the guaranteed output of a shipped code path.** This is the keyless,
deterministic observation fixture that `ai-rec-grounding` GATE Q could not get (its §9 item 6 booked
"with no provider key at GATE Q, nothing observes the live HTTP body"). It should be this feature's
primary observed-by fixture.

**(c) Same path fabricates a conviction level.** `recommendation.rs:811-814`:
`top.get("conviction")...unwrap_or("medium")`. When the setup carries no conviction, the card asserts
**`Confidence: medium`** — a value nobody stated. That is my defining failure mode, already shipped, on
the one field the brief lists last. The same value is also never validated against
`RecConfidence = 'low' | 'medium' | 'high'`, and the browser renders it raw
(`<Chip label={s.confidence ?? '—'} />`, `:1158`) — a `[digested-labels-not-raw-dump]` violation
independent of the absence hole.

I also found two live unvouched claims on **present** values, both mine to fix:

- **Expiration asserts membership it never checked.** `:1091-1096` renders
  `· within your {dteMin}–{dteMax} DTE window` whenever the window exists — *including beside the bare
  `—`*. Today a card can literally print `— · within your 7–45 DTE window`: a claim that a nonexistent
  expiration sits inside your window. And on a present value nothing verifies membership; the type
  comment `expiration: string | null; // YYYY-MM-DD within [dte_min,dte_max]` (`convexa.ts:1440`) is an
  aspiration the wire does not enforce.
- **`?` rendered as a value.** Same lines: `{dteMin ?? '?'}–{dteMax ?? '?'}`. A question mark is not a
  member of any vocabulary.
- **One wire field, two labels.** `s.confidence` is captioned **`Confidence`** in the trade branch
  (`:1156`) and **`conviction · {level}`** in the no_trade branch (`:944`). One of those two is wrong.

### 1. Do the five shipped members serve six *labels and strings*? Mostly yes — one gap, one lie

The shipped union (`literals.ts:41-46`) is `value | dash | not_set | unavailable | not_given`. Ruling
member by member against fields that are a strategy name, a strike list, a date, a trigger sentence, a
horizon phrase and a band token:

| Member | Verdict for the six | Why |
| --- | --- | --- |
| `value` | **Serves.** Unchanged rendering. | — |
| `dash` (`—` + "No entry, so there is nothing to size.") | **Must be unreachable on five of six.** | Its sentence is about *sizing*. It is false on a structure name and on a date. Finding (a) says they never mount in `no_trade`, so unreachability is free — take it. |
| `not_set` (+ `Set your risk inputs`) | **Must be unreachable on all six.** | It names the *owner's* risk block. None of the six depends on owner input. A `Set your risk inputs` button beside `Structure` would send a trader to fix something that cannot fix it. |
| `unavailable` (+ "An input this needed was missing this cycle.") | **Serves — but only on `Strike(s)` and `Expiration`.** | Those two do have a Convexa-supplied dependency: the candidate set. When it is absent the strip above already reads `Candidate set unavailable this cycle.` (`NUMBERS_SAID_UNAVAILABLE`), so the two agree. Structure / trigger / horizon / conviction depend on nothing Convexa sends — `unavailable` there would be a fabricated cause. |
| `not_given` (`not given`) | **Serves all six — but its TIP is now a lie.** | See below. |

**The tip repair (one string, repairs eleven call sites).** `RISK_FIELD_COPY.notGiven.tip` currently
reads *"The AI produced a trade read but didn't fill this in. Nothing failed — it declined to answer."*
On the local-rules path there **is no AI** — the card itself says so
(`GROUNDING_CARD.local_rules`: "No AI read here — these figures come from Convexa's own rules"). The tip
names an actor that did not exist. That is already false today on the four shipped risk fields on that
path; adding six more call sites multiplies it. One literal must have one tip (the 2026-08-12 Amendment's
rule: "Distinct literals, never synonyms" — its converse is one literal, one string), so the fix is to
make the tip producer-neutral, not to fork it:

> **`not given`** — *"Nothing failed — this read didn't state one. Convexa never fills in a value nobody
> gave."*

I am **not** adding a sixth member for "Convexa's own rules don't name this field." The reader's
epistemic state is identical (nobody stated it), and *who* didn't state it is already carried, exactly
once, by the card-level grounding line. Duplicating it per field would add a second signal to
generalize from — the halo, re-created by my own hand.

**The one genuine gap: a stated answer outside the closed vocabulary.** `confidence` is the only banded
field of the six, and it can carry a string that is not `low|medium|high` (finding (c)). None of the five
members can say *"it answered, and the answer is not on our scale."* Collapsing that into `not_given`
("it didn't state one") is the `absent-is-not-none` collapse in miniature: the read *did* answer.
Collapsing it into `unavailable` invents a missing input. So one member is missing, and it is narrow:

> **`unrecognized`** — *"The read named a conviction outside Convexa's scale. Convexa shows low, medium
> or high only — it won't repeat an answer it can't place."*

Rejected alternatives, on my own failure-mode grounds: **`off scale`** (reads idiomatically as "off the
charts", i.e. *very high* — a fabricated direction); **`unreadable`** (visually and phonetically collides
with `unavailable` at 11–13px); showing the raw string (a raw dump the wire never vouched).

**Preferred shape:** the backend validates against the closed enum at the serializer and emits
`confidence: null` + the reason token. The browser then only looks a token up — it never inspects the
string. That is the `[digested-labels-not-raw-dump]` shape, and it keeps the sixth member cheap.

**This new member is a DESIGN_SYSTEM Amendments event by precedent** — the 2026-08-12 row records "Two
new members of the closed not-a-number vocabulary" for exactly this. I will raise it as an R2 `product`
conflict; I will not append it myself and I will not restate the vocabulary in SPEC §4.

### 2. Exact copy, per field

The `not given` / `unavailable` strings are **shipped constants reused verbatim** — I am proposing no
new absence word except `unrecognized`.

| Field | Label | Value render | Absent, no cause | Absent, Convexa input missing |
| --- | --- | --- | --- | --- |
| Structure | `Structure` (unchanged) | model string verbatim | `not given` | unreachable |
| Strike(s) | `Strike(s)` (unchanged) | `$450 / $460` | `not given` | `unavailable` |
| Expiration | `Expiration` (unchanged) | `2026-09-19 · your DTE window: 7–45` | `not given`, **caption suppressed** | `unavailable`, **caption suppressed** |
| Entry trigger | `Entry trigger` (unchanged) | verbatim | `not given` | unreachable |
| Time horizon | `Time horizon` (unchanged) | verbatim | `not given` | unreachable |
| conviction | **`Stated conviction`** (both branches) | chip `low` / `medium` / `high` | `not given`, **as text, chip suppressed** | unreachable; `unrecognized` when off-scale |

**Expiration caption — the exact wording change.** From `· within your {min}–{max} DTE window` to
**`· your DTE window: {min}–{max}`**. The old phrasing asserts a property *of the value* that nothing
checked. The new phrasing states a property *of the request*, which is vouched by the owner's own
filter. It renders only beside a stated expiration, and **not at all if either bound is unknown** — a
literal `?` never renders. If the council would rather keep the membership claim, the backend must
actually check the returned date against `[dte_min, dte_max]` and emit a token for it; I would rather
withdraw the claim than buy a check, because withdrawing costs nothing and the check is a
grounding-shaped surface I am arguing hard to keep closed.

**The conviction label.** One wire field must have one label. I propose **`Stated conviction`** in both
branches: it names the datum as the read's self-report, which is exactly what it is, and it aligns the
UI with the word the wire itself uses (`top.get("conviction")`). "Confidence" in a trading product reads
as a statistical confidence and nothing here is calibrated against an outcome. I will defend
`Stated conviction`, but the *unacceptable* outcome is the status quo — two words for one field. If PM
prefers `Confidence`, the `no_trade` chip must change to match, and I will render that instead.

**Absence literals carry no warning chrome.** No `warning.*`, no icon, no tint, no chip. DESIGN_SYSTEM
Components rule 5 makes `warning.*` icon-mandatory, so warning severity would drag an icon onto six
fields — the exact "second signal to generalize from" `ai-rec-grounding` AC-25 forbade. And "Even
sprinkling of accent" is a named rejection: amber is spent, green/red are reserved for signed direction.
These literals are ordinary body text in the value slot, styled exactly as the shipped four already are.

### 3. Clause / register / tint: deliberately none per field, and one section caption

**Per field: none.** No grounding clause, no `GroundingField` entry, no marker, no chip, no tint, no
tooltip on a value, and **no type-register change**. `ai-rec-grounding` SPEC.md:75-79 says these fields
"carry no grounding clause, marker, chip, tint or tooltip in v1"; that stands, and I am carrying it
forward as a tested AC rather than letting it lapse. Specifically on the register: the DESIGN_SYSTEM
2026-08-13 Amendment scopes itself — *"Applies only where a grounding state exists (the AI-rec card and
the entry dialog); no other surface changes."* No grounding state exists for these six, so flipping
`Strike(s)` or `Expiration` into the sans register would *manufacture* an authorship claim out of a
field that has none. That is the halo in reverse and I refuse it.

**The rule I want written down, because it is what makes this safe:** *when any of the six carries a
value, its rendering is byte-identical to `main`. Only the absent case changes.* AC-25 was about not
implying a check on a **stated** figure. An absence literal replaces a value that does not exist; it
cannot imply anything was checked, because there is nothing to check. That distinction is the whole
argument that this feature does not re-open grounding, and it should be a ship-blocking test.

**How the copy closes §9.5's halo — honestly, in two halves.**

The residual is: *"A trader who sees clauses on three fields may still generalize 'no clause means
checked' onto the four fields left bare."*

- **Half one closes outright.** Today those fields are not "bare" — they carry `—`, which the card's own
  vocabulary defines as a Convexa verdict of not-applicability. The reader is not *inferring* a check;
  the card is *asserting* one, falsely, on a trade card. Replacing `—` removes the only Convexa verdict
  those six ever rendered. Afterwards they carry no Convexa verdict of any kind, so there is nothing
  left to generalize *from*.
- **Half two does not close by itself,** and I will not let the SPEC say it does. A reader can still
  infer, from clauses on stop/target/invalidation, that a *stated* structure or entry trigger was
  vouched. Nothing in the literals touches present values.

To close half two **without a per-field marker**, I want exactly one thing: a **section-level caption
under the plan row**, an instance of the pattern already shipped and council-approved for precisely this
problem (`REASONING_PROSE_NOT_CHECKED`, which sits with the reasoning and says prose numbers are not
checked). Copy:

> **"Convexa doesn't check the structure, the trigger, the horizon or the conviction — only the contract
> named, on the line below."**

Every clause of that is true and already shipped: the cited-contract line directly beneath the plan row
*does* check strike + expiration against the candidate set (`OFF_SET_LITERAL` = "Not in the candidate set
Convexa sent"; `UNDETERMINED_RIGHT_TIP` = "Convexa only draws a quote when it can match the exact
contract — strike, expiration and call/put").

**What I deliberately do NOT do:** extend the grounding definition tooltip. It already carries the
allowlist positively — *"Convexa checks the stop, the target and the invalidation level"* — which is
exhaustive and therefore already excludes the six. Appending a negative enumeration would lengthen an
already-long tooltip and would risk implying the negative list is itself complete. **I withdraw that
idea; the positive allowlist is stronger than anything I would add to it.**

**The cost, stated:** the caption is a fourth "not checked" statement on one card (card grounding line,
prose caption, cap refusal, this). That is a real line-budget cost and PM should price it. **If the
council cuts the caption, then the SPEC must not claim §9.5 closes** — it must re-book the inference
half as a surviving residual. I would rather ship the literals with an honest residual than ship a
closure claim the copy does not support.

### 4. Full state matrix

The six live **only inside `status === 'produced'`**. Every gated, loading, error and no-key state
replaces the whole card body, so the six have no skeleton, no placeholder and no ghost row in any of
them. That is the matrix's most important line and it is negative space, so it is a test.

| State | Structure / Entry trigger / Time horizon | Strike(s) / Expiration | Stated conviction |
| --- | --- | --- | --- |
| **default (value present)** | verbatim, byte-identical to `main` | verbatim (+ DTE caption on Expiration) | chip `low`/`medium`/`high` |
| **absent, no declared dependency** | `not given` | `not given` | `not given` (text, chip suppressed) |
| **absent, candidate set missing** | unreachable | `unavailable`; Expiration caption suppressed | unreachable |
| **stated but off-vocabulary** | n/a (free text) | n/a | `unrecognized` |
| **`no_trade`** | not rendered at all (unchanged) | not rendered at all (unchanged) | **`not given` when absent** — see below |
| **loading (`Thinking…`)** | not rendered | not rendered | not rendered |
| **empty (no rec requested yet)** | not rendered | not rendered | not rendered |
| **error (`AI unavailable — try again`)** | not rendered | not rendered | not rendered |
| **gated (no_edge / cooling down / cap / no key / BYO)** | not rendered | not rendered | not rendered |
| **stale · stale-born · superseded** | unchanged; the strips are card-level and touch no field | unchanged | unchanged |
| **offline (SSE drop)** | **unchanged — no dim, no `⏸`, no blank** | unchanged | unchanged |
| **degraded (pre-feature backend, no token for the six)** | `not given` | `not given` | `not given` |

**Offline, justified.** The rec card is a **static** read under `[live-vs-static-isolation]`: it is
pinned to its snapshot and already says so (`COPY.tooltip.asOf` — "Pinned to the snapshot it was
generated from. It won't refresh itself"). Dimming these six on an SSE drop would assert that a pinned
historical read went stale because a stream dropped, which is false. The `⚠ Live offline` treatment stays
where it belongs, on live-derived tiles.

**Degraded, justified.** `fieldLiteral`'s current fallthrough is `unavailable` (`literals.ts:62`). For
the six that is the wrong default: a backend that never learned these tokens is not saying an input
failed this cycle. The honest default is `not given` — *no value was stated, and Convexa is naming no
cause.* This means `unavailable` on the six must be reachable **only** from an explicit
`missing_input: candidate_quotes` token, never from a fallthrough. Whether that is a sibling selector or
a parameterised one is the architect's call; my requirement is only that it stays a closed lookup on the
token and never becomes a null test.

**`no_trade` conviction — the one place the six touch that branch.** Today `:943` renders
`{s.confidence && <Chip label={'conviction · ' + s.confidence} />}` — an absent conviction renders
*nothing*, silently. A "no trade" read absolutely can carry conviction, so this is `absent-is-not-none`
collapsing at the render boundary. It must render `not given`. It must **not** render `—`: `—` means
"no entry, so there is nothing to size", and conviction is not a sizing field — it applies perfectly
well to a decision to stand aside. **This is why `fieldLiteral`'s unconditional `no_trade`-first
short-circuit cannot simply be pointed at conviction.**

### 5. Acceptance criteria → component state → Verify by

`test` = invariant, negative space, or silently-regressing behavior. `review` = visible and intentional
(copy, presence, ordering). These marks land in SPEC §3's table.

| ID | Acceptance criterion | Component state(s) | Verify by |
| --- | --- | --- | --- |
| UX-1 | On a `produced` card with `decision: trade`, none of the six renders `—`. | absent (all six) | test |
| UX-2 | `—` reaches the card only via `RISK_FIELD_COPY.dash`; no bare `'—'` literal survives in `AiRecPanel.tsx`, and reintroducing one turns a source scan red — the scan proven non-vacuous. | reserved-vocabulary invariant | test |
| UX-3 | Each of the six selects its literal by closed lookup on the wire token alone. No `??`, no `.length`, no `''`/`0`/`null`/`undefined` test decides which literal renders. | all absent states | test |
| UX-4 | `not given`, `unavailable`, `unrecognized` and their tips render verbatim as §2. | absent (all six) | review |
| UX-5 | `not set` and its `Set your risk inputs` action never render on any of the six. | negative space | test |
| UX-6 | `unavailable` renders on `Strike(s)`/`Expiration` only, and only under `missing_input: candidate_quotes`. | absent, input missing | test |
| UX-7 | The DTE caption renders only beside a stated expiration, and never when either bound is unknown (no `?` reaches the DOM). | value / absent | test |
| UX-8 | The DTE caption reads `· your DTE window: {min}–{max}` — a statement about the request, not about the value. | value | review |
| UX-9 | One label for `confidence` across both verdict branches. | value + no_trade | review |
| UX-10 | Conviction renders through a closed lookup over `low`/`medium`/`high`; an off-vocabulary token never reaches the chip. | value / unrecognized | test |
| UX-11 | No conviction level renders that the producer did not state — the defaulted `medium` is gone. | value (local-rules path) | test |
| UX-12 | On `no_trade`, an absent conviction renders `not given` — never `—`, never nothing. | no_trade | test |
| UX-13 | **(SB)** When any of the six carries a value it is byte-identical to `main`: no clause, marker, chip, tint, type-register change or tooltip. Carries `ai-rec-grounding` AC-25 forward. | default | test |
| UX-14 | The plan-row scope caption renders exactly once, on produced trade verdicts only. | produced-trade | test |
| UX-15 | The plan-row caption reads verbatim as §3 and sits with the plan row, above the cited-contract line. | produced-trade | review |
| UX-16 | Loading, empty, error, no-key and every gated state render no field row at all — no skeleton, placeholder or ghost for the six. | loading / empty / error / gated | test |
| UX-17 | An SSE drop leaves all six byte-identical — no dim, no `⏸`, no blank. | offline | test |
| UX-18 | Stale, stale-born and superseded strips change none of the six. | stale | test |
| UX-19 | On a pre-feature backend that omits the six tokens, each renders `not given` — never `unavailable`, never `—`, never a throw. | degraded | test |
| UX-20 | Every absence literal is real text in the value slot (a screen reader reads it without hover), ≥11px, and meets contrast in dark **and** light. | absent (all six) | test |
| UX-21 | Composition review on the local-rules card (`trade`, `strikes: []`, `expiration: null`): both literals present, the `not given` tip names no AI, and the card reads coherently beside `GROUNDING_CARD.local_rules`. | produced-trade (local_rules) | review |

### 6. Intended user, job, vocabulary

**User:** the operator/swing trader of DESIGN_SYSTEM's "Curvature Terminal" — someone who distrusts UIs
that overclaim and reads degraded states as styled truth. **Primary job at this moment:** decide whether
this rec is actionable *at all* before deciding whether it is good. **Information structure:** unchanged
— verdict → grounding line → risk → plan → cited contract → exits → size → read context → reasoning.
This feature adds no section and moves nothing. **Vocabulary:** the trader's own words are already
canon here (`not given`, `unavailable`, `not set`, `—`, `no basis`, `not recorded`); the correct move is
to spend the shipped vocabulary and add exactly one member where the shipped set genuinely cannot speak.
No feature-local synonyms.

## Risks I see

1. **The tip repair touches shipped, verbatim-reviewed copy.** Changing `RISK_FIELD_COPY.notGiven.tip`
   changes four shipped risk fields as well as the six new ones. That is the point — it repairs a live
   lie on the local-rules path — but it is a copy change PM must knowingly price, not a silent edit.
2. **I am proposing four repairs the brief does not name** (the tip, the DTE caption, the conviction
   label, the `no_trade` conviction absence) plus a sixth vocabulary member and a section caption. If PM
   prices only the six literals, the feature still ships something true, but the card retains a
   fabricated `medium`, a false window claim and two labels for one field. I would rather that be an
   explicit council decision than an implicit cut.
3. **Line budget.** The plan-row caption makes four scope statements on one card. There is a real risk
   the honesty chrome starts drowning the read it is qualifying. If the reviewer's judgement is that it
   does, cut the caption — and re-book the §9.5 residual instead of claiming closure.
4. **`unrecognized` could become the escape hatch.** If the backend ever routes an unhandled case into
   it, it silently becomes a second `unavailable`. It must be emittable from exactly one place: the
   `confidence` enum validation. Anything else reaching it is a defect, and that is worth a test.
5. **My own halo, freshly created.** By giving the six an absence treatment, I create a state where five
   card fields carry a per-field honesty word and the rest do not. UX-13 (values byte-identical to
   `main`) is what stops this becoming a new signal to generalize from. If UX-13 is cut, my whole "this
   does not re-open grounding" argument collapses and I would withdraw the caption too.
6. **`Strike(s)` absence versus structural inapplicability.** A trade card whose structure has no strikes
   (say, long underlying) would render `not given` when the truthful literal is "not applicable". I am
   **deliberately not** filling that gap: the only way to detect it is to parse the model's free-text
   `structure`, which is exactly the re-derived label `[digested-labels-not-raw-dump]` forbids. The
   server cannot vouch for "not applicable" here, so nothing may claim it. Booked as a known,
   deliberately unclosed corner rather than a fabricated literal.
7. **Product question I am raising, not answering:** should a `trade` verdict with no structure *and* no
   strikes be presented as a trade at all? Honest literals make the emptiness legible; they do not make
   the card actionable. That is a product scope call and I will raise it at R2 rather than scope it here.

## Assumptions I'm making about the other two lanes

- **Backend widens `RecField` (`apps/api/src/services/rec_inputs/field_reasons.rs:5`) with six members**
  — `Structure`, `Strikes`, `Expiration`, `EntryTrigger`, `TimeHorizon`, `Confidence` — and
  `FieldReasons` on the wire gains the matching six optional keys, emitted on **every** `produced`
  response including the local-rules fallback. Falsifiable: if only four are added, `Time horizon` and
  `Stated conviction` keep their bare `—` and UX-1 fails.
- **Backend declares `candidate_quotes` as the only dependency of `strikes` and `expiration`, and NO
  dependency for structure / entry_trigger / time_horizon / confidence** — so `unavailable` is
  unreachable on those four and `missing_input: 'risk_block'` (hence the `not set` literal and its
  `Set your risk inputs` button) is unreachable on all six.
- **Backend validates `confidence` against `low|medium|high` at the serializer** and emits
  `confidence: null` plus a distinct reason token for anything else, so the browser never receives an
  off-vocabulary string. If the backend instead coerces off-vocabulary values to `null` with a
  `not_given` reason, it converts "it answered oddly" into "it declined to answer" and UX-10 fails.
- **Backend deletes the `unwrap_or("medium")` fabrication at `recommendation.rs:811-814`** and emits
  `confidence: null` + `not_given` when the setup carries no conviction. My copy cannot fix a value the
  server invents.
- **Backend adds NO `GroundingField`, anchor kind, tolerance or grounding state for any of the six.**
  `grounding.counts.checked` stays at three. If grounding grows to cover strike or expiration, my §3
  argument (and UX-13) is void and I need to re-position at R2.
- **The rec is not a scoring input:** `opportunity_score`, `opportunity_tier` and `state_fingerprint`
  stay byte-identical, per `[additive-keeps-score-byte-identical]`.
- **Architect keeps the vocabulary closed as a discriminated union** and keeps the poison test —
  reintroduce a bare `?? '—'` in `AiRecPanel.tsx` and a scan goes red, with the scan's non-vacuity proved
  (`[structural-over-prose-enforcement]`, and the mutation-tested `?raw` scan precedent this file already
  ships).
- **Architect exposes the six through a closed-lookup selector whose degraded default is `not_given`,
  not `unavailable`** — a different default from the shipped `fieldLiteral` fallthrough
  (`literals.ts:62`). If the architect insists on reusing `fieldLiteral` unchanged, UX-19 fails and a
  pre-feature backend will tell six honest fields that an input failed.
- **The shared `Field` component gains no new prop capable of carrying a tint, icon or marker** — only
  the existing `valueSx`, and none of the six passes it.
- **PM prices the four adjacent copy repairs inside this feature** (notGiven tip, DTE caption, conviction
  label unification, `no_trade` conviction absence). If any is deferred I need to know at R2, because the
  SPEC's "closes the §9.5 residual" claim depends on which survive.
- **PM accepts the local-rules fallback as the primary observed-by fixture**, so GATE Q can observe a
  real `Trade · long` card with two absent plan fields **without an `ANTHROPIC_API_KEY` and without
  spending the daily cap** — closing the observability gap `ai-rec-grounding` §9 item 6 booked.
- **PM treats the sixth vocabulary member (`unrecognized`) as a DESIGN_SYSTEM Amendments event**, on the
  2026-08-12 precedent, appended by the synthesizer after the human rules — not restated as a design
  system in SPEC §4.
- **Nobody else writes user-facing strings.** Every literal, tip and caption on this card comes from
  `copy.ts` and is reviewed verbatim; the backend emits tokens, never sentences.
