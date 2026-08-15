```json
{
  "role": "pm",
  "agree": [
    "So **`Trade · long` with `Strike(s): —` and `Expiration: —` is not a rare model omission — it is the guaranteed output of a shipped code path.**",
    "It should be this feature's primary observed-by fixture.",
    "When the setup carries no conviction, the card asserts **`Confidence: medium`** — a value nobody stated.",
    "One wire field must have one label.",
    "when any of the six carries a value, its rendering is byte-identical to `main`. Only the absent case changes.",
    "**(a) The presence predicate must be PER-FIELD and TYPE-AWARE — the shipped shared one is a defect here.**",
    "Reusing the shared `present` closure for the six is a ship-blocking error, not a nit.",
    "**PM will rule on whether an out-of-vocabulary `confidence` (e.g. \"moderate\") renders as an absence literal instead of raw model text.**"
  ],
  "conflicts": [
    {
      "quote": "Accept currently seeds contract fields from the rec.",
      "source": "pm",
      "why": "Withdrawn — I flagged this as my most falsifiable assumption and the architect settles it: the six are display-only and none of them seeds the entry surface. My B3 and B4 rulings and AC-12 and AC-13 were all built on the opposite footing. As written AC-12 pins a behavior that already holds today and reads as a change the build would have to invent, which is a silent no-op criterion — the exact thing my lane exists to keep off the list.",
      "proposal": "Withdraw B4 entirely: with no prefill of these fields there is nothing to leave empty, so the empty-with-reason versus hard-block question is moot and no new refusal vocabulary is minted. Restate B3 as a standing prohibition rather than a change — this feature must not introduce seeding of a never-named structure, strike or expiration into the entry surface. AC-12 becomes negative space: accepting a trade rec whose structure, strike or expiration was never named puts no value into the entry surface and infers none from the chain, the ticker, a prior position or a default; verify by review of the entry path, not by a new automated test. AC-13 stands and is now trivially satisfied. Net effect: this feature narrows by half a ruling, and the safety property it was protecting turns out to be already true.",
      "kind": "technical"
    },
    {
      "quote": "On a **no_trade** card, all six rows still display `—`, unchanged from today, and **no** absence literal from this feature appears anywhere on that card.",
      "source": "pm",
      "why": "Withdrawn — factually wrong, and it was ship-blocking. UX and the architect independently establish that five of the six rows never mount on a no-trade card at all, and that the sixth renders as a chip that shows nothing when absent. AC-3 therefore asks a checker to observe six rows that do not exist. The reserved mark on that card belongs to the four risk fields, not to these six.",
      "proposal": "Split into two observable criteria. (a) On a no-trade card, the four position-defining rows and the horizon row do not render at all — no row, no literal, no reserved mark, no skeleton, no ghost. (b) On a no-trade card the four risk fields keep the reserved mark and their current copy, unchanged from today. US-2 is unharmed and better served: the reserved mark keeps exactly one meaning, on exactly the fields entitled to carry it. My AC-16 (the reserved mark appears only where no entry exists) survives unchanged and becomes the sweep that protects both halves.",
      "kind": "technical"
    },
    {
      "quote": "The response arrived but carries no usable reason for this field — an older or degraded response.",
      "source": "pm",
      "why": "Withdrawn. I filed the degraded and pre-feature case under the shipped literal whose copy tells the reader an input this rec needed was missing this cycle. On a response from a build that never learned these reasons, nothing was attempted and nothing failed — so that literal states a cause no producer ever gave. That is a fabricated cause, which is this feature's own defect pointed the other way, and it is my defining failure mode: a degraded state buried under the happy-path vocabulary instead of being ruled on its own terms.",
      "proposal": "Two corrections. (1) The degraded and pre-feature state renders the never-stated literal; the missing-input literal is reachable only when the response explicitly declares a missing input, never as a fallback. AC-5 and AC-6 name the literal instead of saying an honest absence literal. (2) AC-4's three-distinct-strings fixture is restated on the corrected footing: the three facts a reader must keep apart are never-stated, Convexa's own input missing (reachable only on Strike(s) and Expiration), and the reserved no-entry mark on the risk fields. There is no longer a distinct degraded-response fact for these six, and no criterion may imply one.",
      "kind": "technical"
    },
    {
      "quote": "**No change to the `no_trade` branch.** `—` there is *correct* and stays.",
      "source": "pm",
      "why": "Narrowed. I wrote that fence believing the six rendered the reserved mark on no-trade cards, which my AC-3 withdrawal now retracts. Its actual purpose — the reserved mark keeps exactly one meaning — is untouched by UX's finding that an absent conviction on a no-trade card renders nothing at all. Rendering nothing is not neutral: it teaches a reader that the card has no conviction field, which is the same absence-collapse expressed as layout rather than as copy. The architect's zero-diff commitment names a line range that does not contain that chip, so both commitments can stand.",
      "proposal": "Narrow the fence to: on a no-trade card, the four risk fields, their reserved mark and their copy do not change. Admit exactly one addition — an absent conviction on a no-trade card renders the never-stated literal rather than nothing, and never the reserved mark. This is a one-field, one-branch scope expansion and I am flagging it as such rather than absorbing it: if the human prices it out, it is future-dated as a named residual, not silently dropped.",
      "kind": "product"
    },
    {
      "quote": "A committed artifact records, over **N ≥ 10 real trade-verdict recs**, how many times each of the six fields was omitted.",
      "source": "pm",
      "why": "Withdrawn as written. UX establishes the omission is deterministic on Convexa's own rules path, and the architect states that a rate across model-produced recs needs live calls, a supplied key and daily cap spend. A floor of ten real recs therefore makes a deliberately non-gating measurement depend on a resource the gate may not have — an unverifiable criterion. My unknown-base-rate risk is also half-answered already: on the keyless path the rate is one hundred percent.",
      "proposal": "Restate: the gate records, across whatever trade-verdict recs it actually observes, how many carried an unnamed position-defining field, and records N honestly — no floor, no threshold, still non-gating, and a zero observed rate on the model path still does not retire the feature. Any rate across model-produced recs over time is future-dated to the degradation-visibility item, which is already flagged rising. The primary observed-by fixture becomes the keyless rules-path card, which needs no key and spends no cap.",
      "kind": "product"
    },
    {
      "quote": "An ABSENT `field_reasons` block renders `unavailable`, and I am NOT adding a sixth `FieldLiteral` member for it.",
      "source": "architect",
      "why": "The second half I ratify — no new vocabulary member for block-absence. The first half cannot stand. The shipped copy behind that literal tells the reader an input this rec needed was missing this cycle. When no reason information reaches the browser at all, the only true statement is that nothing was stated and Convexa is naming no cause; asserting a missing input is a cause no producer gave. UX rules the same way on its degraded row, so two of three voices land on the opposite default, and the architect's own justification for it — that the block is absent only on a pre-feature server or a local fallback, where the missing-input reading is true — is undercut by the architect's own degenerate-case handling, which makes the rules path emit reasons rather than omit the block.",
      "proposal": "Keep the vocabulary at five members. Change only the default: when no per-field reason reaches the browser, all six render the never-stated literal, and the missing-input literal becomes reachable only from an explicitly declared missing input. No new member, no new copy, and the architect's argument that block-absence does not earn its own word is preserved intact.",
      "kind": "technical"
    },
    {
      "quote": "Under `[digested-labels-not-raw-dump]` the wire token is authoritative and the FE renders by closed lookup: the server reports `value_present = false` for an out-of-set confidence, and the FE **additionally** maps through a closed table so a nonconformant server still cannot paint raw model prose.",
      "source": "architect",
      "why": "I ratify the behavior change this explicitly asks me to ratify: an off-scale conviction must never paint raw text on the card. But reporting it as not-present routes it to the never-stated literal, and the read did state something — it stated something off Convexa's scale. Collapsing it answered off our scale into it never answered is the hard absent-is-not-none rule broken by the fix itself, which is precisely the argument the architect makes against reusing the shared presence closure. Ratifying one half and swallowing the other ships a smaller copy of the defect this feature exists to close.",
      "proposal": "Report a stated-but-off-scale conviction as its own reason, distinct from never-stated and from missing-input, so the browser can separate the two by lookup rather than by inspecting the string. Whether the browser then spends a new vocabulary word on it or reuses an existing one is the copy decision UX is already routing to the human as an amendments event; this conflict asks only that the response stop merging two facts into one. If the human refuses a new word, the resulting collapse must be booked as a named surviving residual, not absorbed silently.",
      "kind": "technical"
    },
    {
      "quote": "| `confidence` | non-null **and** a member of `{low, medium, high}` | none | always `not_given` |",
      "source": "architect",
      "why": "This predicate cannot see the defect UX found. On the rules path the server itself supplies a conviction level when the setup states none, and that supplied level is a member of the scale — so the predicate reads it as stated, no reason fires, and the card goes on asserting a conviction nobody gave, on every keyless rec. Taking the position the dispatch asks for, and ruling it rather than routing it: the fabricated value is IN SCOPE for this feature. It sits on one of the six named fields; it is the most severe instance of the defect on this card, because an absence rendered as a confident assertion carries nothing on screen to flag it, unlike an absence rendered as the wrong mark; and no display-side change can repair a value the server invents. My Class B ruling still holds — this field gets no card-level standing line — but a class being softer is not a licence to let a fabrication through. The architect's own note says PM ratifies this behavior change, so it is mine to rule and I have; what remains between us is the mechanical fact that the stated predicate cannot detect it.",
      "proposal": "Stop supplying a conviction the producer did not state; emit no value plus the never-stated reason, and let the closed lookup render it. I ratify the visible consequence in advance: cards that today read a stated middling conviction will read the never-stated literal, and on the rules path that is every card. Ship-blocking criterion: no conviction level renders on the card that its producer did not state — observable by producing a rules-path rec whose setup states no conviction.",
      "kind": "technical"
    },
    {
      "quote": "To close half two **without a per-field marker**, I want exactly one thing: a **section-level caption under the plan row**, an instance of the pattern already shipped and council-approved for precisely this problem (`REASONING_PROSE_NOT_CHECKED`, which sits with the reasoning and says prose numbers are not checked).",
      "source": "ux",
      "why": "This caption and my card-level not-actionable-as-given line are two card-level honesty statements proposed independently, on a card that already carries the grounding line and a refusal line. UX counts four such statements with the caption; with mine it is five, and the risk both of us named — a wall of caveats a trader stops reading — becomes the thing we shipped. They are not the same fact and neither is redundant: mine is conditional and instance-specific (this rec is missing a named field, so it cannot be acted on as written) and fires only when something is actually wrong; the caption is unconditional and scope-general (Convexa never checks these fields) and fires on every trade card. Neither collides with the grounding line's fact, so the collision is line budget, not meaning — and UX's own rules-path finding makes it concrete: on the keyless path both lines would fire on one hundred percent of cards. Which statement earns the space is a value call, not a fact.",
      "proposal": "My recommendation, for the human to accept or overturn: ship the conditional standing line as ship-blocking, future-date the unconditional caption. The failure this feature exists to prevent is acting without noticing, and only the conditional line interrupts that; a line printed on every card is read once and then never again. If the caption is cut I adopt UX's own condition without argument — the spec must NOT claim the grounding residual closes, and must re-book the inference half as a surviving, named residual. If the human prefers the caption, then the per-row literals plus the caption carry the feature and I withdraw the standing line rather than ship both. What I will not accept is shipping both and discovering the budget at first use.",
      "kind": "product"
    }
  ],
  "asks": [
    "architect — beyond the conviction level, does any other Convexa-supplied default fill one of the six fields before the presence check runs? A second server-side default would be ratified as stated by exactly the same mechanism and would pass every criterion in this feature silently.",
    "architect — does removing the conviction default change anything a user or the record already sees (the rules-path grounding card, the stored evaluation record, the cited-contract line), or is it confined to that field's own display? I need that before I make the no-fabricated-conviction criterion ship-blocking.",
    "ux — if the human keeps only one card-level line, can a single surviving line carry both the conditional fact (this rec is missing a named field) and the scope fact (Convexa never checks these fields) without becoming a claim that supports neither, or is the honest answer one line plus a booked residual?"
  ]
}
```
