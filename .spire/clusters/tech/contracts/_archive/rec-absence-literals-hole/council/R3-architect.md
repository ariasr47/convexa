# R3 — architect resolution: rec-absence-literals-hole

One exchange. Verdict line first, mechanism second, citations throughout. Where I could not verify by
running anything (I have no Bash by design), I say so rather than assert.

---

## #0

**CONVERGED:** `RecField` stays at exactly five members and a disjoint `RecPlanField` (six) carries
the absence reasons — UX ratified this in its R2 `agree` list ("architect: `RecField` stays exactly
five members; grounding stays total over exactly the numbers it can trace"), so nothing is open.

Pinned mechanism: `field_reasons.rs:5-11` keeps `RecField { MaxRisk, PositionSize, ExitTarget,
ExitStop, InvalidationLevel }`; the same file gains `RecPlanField` (six) and
`plan_field_reason(field, value_present, presence) -> Option<FieldReason>` returning the **shipped**
`FieldReason` struct (`field_reasons.rs:28-32`) unchanged. Every wire consequence UX assumed survives
verbatim: the six keys are added to the same `field_reasons` object built at
`recommendation.rs:478-484`. A tally test pins 5 and 6 so a later hand cannot merge them.

## #1

**CONVERGED:** UX withdrew `candidate_quotes` at R2 self-revision and adopted my empty-set token; the
name to pin is `candidate_set` and the predicate is `!set.contracts().is_empty()`.

`candidate_quotes` is `set.has_quoted_contract()` (`recommendation.rs:460` → `candidates.rs:190-192`,
`any(|c| c.quote_presence == Quoted)`), which is strictly stronger than "the assembler gave the read
contracts to name". The token I need already has a shipped accessor: `CandidateSet::contracts()`
(`candidates.rs:181-183`) returns `&[CandidateContract]`, so `candidate_set` is
`!set.contracts().is_empty()` — **no new `quant_engine` API**, which keeps the empty-diff-under-
`libs/quant-engine/` commitment structural. It costs one additive member on `MissingInput`
(`field_reasons.rs:22-26`) → wire token `"candidate_set"` and one member on the TS union at
`convexa.ts:1536`. If the owner refuses the copy that member obliges, the fallback is unchanged: all
six always `not_given`, `unavailable` structurally unreachable on all six.

## #2

**CONVERGED:** UX-3 is scoped to the absence branch — which ABSENCE literal renders is a closed
lookup on the token; the value-versus-absent decision stays the shipped value test.

UX's R2 requirement is "it stays a closed lookup on the token and never becomes a null test", and the
scoping satisfies it verbatim: no null test decides *which absence literal* renders. The shipped
arms it protects are `literals.ts:57-59` (`typeof v === 'number' && Number.isFinite(v) && v !== 0`,
`typeof v === 'string' && v.trim() !== ''`), which produce `{ kind: 'value' }` — a member of
`FieldLiteral` (`literals.ts:41-46`) pinned by `literals.spec.ts`. `strikes` is `number[]` on the
wire, so some `.length` join must run at the call site before any lookup; that join decides
value-vs-absent, never which literal.

## #3

**CONVERGED:** the invariant is unchanged-ness, not a number — UX withdrew "three" at R2 and I now
withdraw the implication that "4" is the universal value.

`counts` (`grounding.rs:300-323`) is a function of the five field states plus `cited_as_state`
(`:288-294`). The shipped guard `the_denominator_excludes_the_dollar_risk_figure_and_the_suggested_size`
(`grounding.rs:613-615`) pins `checked == 4` for **one shape only**: a fully-traced model rec with a
cited contract (`full_model_rec_fields()` at `:596-600` + `CitedState::Cited`). On the local-rules
fixture that shape does not hold — `strikes: []` forces `CitedState::None` (`cited.rs:50-52`) which
contributes 0, `max_risk` / `position_size` are structurally unchecked and contribute 0
(`grounding.rs:304`), so `checked` is at most 2 and is 0 when `gamma_flip` is null. Answering UX's
ask precisely: **the `some_traced (n of m)` line never prints on the local-rules card at all** —
`card_member` returns `LocalRules` at member 2, ahead of `SomeTraced` at member 5
(`grounding.rs:327-344`), and `NotApplicable` preempts even that when `checked == 0` (`:328-329`,
guard at `:622`). The AC must therefore pin byte-identity of `grounding` against an observed
baseline, and the observed pair must be recorded at GATE Q; I derived the above from source and did
not run the server.

## #4

**Facts only — no scope ruling, per the controller.** The decisive fact neither lane had: the
`unwrap_or` fallbacks in `local_strategy_from_bundle` are **unreachable on the shipped path**, because
`Setup` (`libs/quant-engine/src/signals.rs:61-67`) declares `name`, `bias`, `strategy`, `rationale`
and `conviction` as **non-optional `String`s** with a plain `Serialize` derive and no skip attribute,
and `Signals.setups: Vec<Setup>` (`:105-111`) is the only producer of `/signals/setups`
(`routes/market.rs:118` / `:121`, from `quant_engine::generate_signals`; `recommendation.rs` has no
scenario injection — `"scenario": null` is hardcoded at `:687`). So every setup carries all five keys
as strings.

| field on the local-rules trade card | what it is | category | citation |
|---|---|---|---|
| `structure` | `Setup.strategy`, e.g. `"long straddle / long vol"` | **(b) authored, named author** = the `generate_signals` rule that emitted the setup | `recommendation.rs:803-806, 821`; `signals.rs:64`, set at `:262-266, 271` |
| `strikes` | `[]`, hardcoded, independent of the set | **neither (a)/(b)/(c) — no value is asserted**; this is the genuine absence the feature targets | `recommendation.rs:822` |
| `expiration` | `null`, hardcoded | **neither — no value is asserted**; genuine absence | `recommendation.rs:823` |
| `entry_trigger` | `format!("At/near {name}")` over `Setup.name` | **(b)** — template authored by `local_strategy_from_bundle`, the name authored by the signals rule | `recommendation.rs:802, 824`; `signals.rs:62, 269` |
| `time_horizon` | the constant `"1–5 sessions"` | **(b) by author, (c) by derivation** — it has a named author (`local_strategy_from_bundle`) but **zero input dependence**: no rule and no read computed it, and it is the same string on every card | `recommendation.rs:829` |
| `confidence` | `Setup.conviction`, always `"low"`/`"medium"`/`"high"` | **(b) authored, named author** = the signals rule | `recommendation.rs:811-814, 830`; `signals.rs:66`, set at `:277, 306, 328, 340, 353, 374, 398, 419, 434, 452` |

Dead-fallback list, stated so the owner is not deciding against phantom code: `unwrap_or("defined-risk
structure")` (`:806`), `unwrap_or("Setup")` (`:802`) and `unwrap_or("medium")` (`:814`) cannot fire
while `/signals/setups` comes from the typed `Signals` struct. Adjacent and the same class, for the
owner's awareness only: `max_risk: "1R defined-risk"` (`:826`) and `position_size: "small (rule-based
local rec; not LLM)"` (`:827`) are also input-independent constants, but they are two of the shipped
five, not two of my six.

**I withdraw my R2 ratification of UX's conviction claim.** My R2 `agree` said "verified at
`recommendation.rs:811-814`" — I verified the line existed, not that it was reachable. It is not.

## #8

**REJECT** — PM's withdrawal rests on my superseded R1 sentence, and the R1 sentence is false: Accept
**does** seed from the rec, and three of the six feed the seed.

Live wiring, end to end: `useTickerTradeFlows.ts:67` calls `recToPrefill(rec.strategy, …)` →
`openEntry(pf)` → `TickerDashboard.tsx:689` `prefill={entryPrefill}` → the dialog. `recToPrefill`
(`prefill.ts:71-85`) reads `expiration`, `strikes` and `structure`. My R1 §5 sentence "These six are
display-only; none seeds `TradeEntryDialog`" is **withdrawn**.

**Now the yes/no the controller asked for: NO — Accept does not seed a chain-derived STRIKE when the
rec named none.** My own R2 conflict #5 said it does; that is **also withdrawn**, and here is the
mechanism it missed. `prefill.ts:73` sets `strike: strategy.strikes.length ? strategy.strikes[0] : 0`
→ the literal `0`. The dialog then does `strike: prefill?.strike ?? nearest`
(`TradeEntryDialogView.tsx:214`), and `??` is **nullish** coalescing: `0` is not nullish, so the
`nearest`-to-spot reduction at `:204-206` never runs. The doc comment at `prefill.ts:51` ("the dialog
snaps to the nearest available strike from there") describes behavior the `??` does not implement —
that comment is what I read in R2 instead of the operator, and it is the source of my error.

What actually happens instead, and it is not benign: the draft holds strike `0`, the Strike control
is a `Select` whose only options come from the chain (`LegFields.tsx:139-153`), so no `MenuItem`
matches `"0"` unless the chain contains a 0 strike; and the submit predicate tests `d.strike !== ''`
(`TradeEntryDialogView.tsx:363`), which `0` passes, so the form is submittable and records
`strike: 0` (`:316`, `:420`). Two sibling seeds on the same path **are** derived from something the
rec never said: **expiration IS chain-derived** — `prefill.ts:72` yields `''` for a null expiration
and `TradeEntryDialogView.tsx:207` is `prefill?.expiration || expirations[0] || ''`, so the **first
chain expiration** seeds; and an omitted `structure` yields `right: 'call'` via `biasToRight`
(`prefill.ts:40-46`, default at `:45`), reasserted by `right: prefill?.right ?? 'call'` at `:215`.
PM's B3/B4/AC-12 therefore have a real subject; my R2 conflict #5's *split* recommendation stands
unchanged, and only its strike sentence is wrong.

## #14

**ACCEPT — the withdrawal is confirmed and final.** The clause "an ABSENT `field_reasons` block
renders `unavailable`" is withdrawn. The second clause stands: block-absence earns **no** sixth
`FieldLiteral` member.

Replacement, pinned: the six render `not_given` when no token reaches the browser, and `unavailable`
on the six is reachable **only** from an explicit `missing_input`, never from a fallthrough.
Mechanism, because the shipped fallthrough must not move: `fieldLiteral`'s last line is
`return { kind: 'unavailable' }` (`literals.ts:62`) and five shipped fields plus `literals.spec.ts`
depend on it. The six take a **sibling selector in the same file** that shares the value arms
(`:57-59`) and the `no_trade`-first short-circuit (`:55`) and inverts only the final fallthrough to
`{ kind: 'not_given' }`. One test pins BOTH defaults, so a later merge of the two functions reds.

## #15

**CONVERGED:** the token name is `unrecognized_value`, and the emit site is the `Confidence` arm of
`plan_field_reason` — the only place in the codebase permitted to construct it.

Exactly: `ReasonKind` (`field_reasons.rs:13-18`, `#[serde(rename_all = "snake_case")]`) gains
`UnrecognizedValue`, whose wire spelling is `"unrecognized_value"`. It is constructed in exactly one
expression — the `RecPlanField::Confidence` arm of `plan_field_reason` — and forbidden on the shipped
five by a test over `field_reason` (`field_reasons.rs:42-63`), which cannot produce it because that
function has no such arm. Confirming the two things the controller asked me to confirm about the
**backend** side: **(1) no new wire type** — the six keys stay `FieldReason | null` with the shipped
`{ reason, missing_input }` shape (`field_reasons.rs:28-32`), no new block, no new endpoint, and the
object is still the one built at `recommendation.rs:478-484`; **(2) no new FE render-vocabulary
member is required by the backend** — `FieldLiteral` (`literals.ts:41-46`) can stay at five and map
the token to an existing member; whether it gains a sixth is UX's and PM's vocabulary call and my
mechanism serves either. One consequence I must not leave implicit: the mirror union at
`convexa.ts:1541` (`reason: 'not_given' | 'unavailable'`) **does** gain the third string, and the
sibling selector from #14 **must carry an explicit arm for it**, because an unmapped third token
would fall through to that selector's `not_given` default — i.e. it would re-collapse "answered off
our scale" into "never answered" inside the fix. A test pins that arm.

## #16

**REJECT the premise; the mechanism-level point I accept and state separately.**

PM's sentence is "On the rules path the server itself supplies a conviction level when the setup
states none." A setup can never state none: `Setup.conviction` is a non-optional `String`
(`signals.rs:66`) set at every one of the ten construction sites (`:277, 306, 328, 340, 353, 374,
398, 419, 434, 452`), and it reaches `local_strategy_from_bundle` through the typed `Signals` struct
only. `unwrap_or("medium")` (`recommendation.rs:811-814`) is therefore **dead code on every shipped
path**; the level on the local-rules card is authored by the signals rule that produced the setup,
and the card already attributes it at card level via `card_member` → `LocalRules`
(`grounding.rs:331-333`, fed `local_only` at `recommendation.rs:526`). Deleting the `unwrap_or` would
change **nothing a user sees** — which also answers PM's ask: no other backend consumer reads
`strategy.confidence` (the only other occurrences are the prompt schema at `llm.rs:146` and the
pass-through at `llm.rs:423`), it is not in `build_export` (`recommendation.rs:386`), not in
`ai_eval`, and not in `grounding`; the only consumers are the two FE chips.

What I accept, and it is the durable half of PM's conflict: **my predicate table cannot see an
upstream fill, and no display-side predicate ever could** — `envelope_extras` (`recommendation.rs:441`)
receives the already-assembled `strategy: Value`, so anything the assembler filled before that point
is indistinguishable from a stated value by construction. If the owner ever rules an assembler
constant to be a fill rather than an authored value, the **only** fix site is the assembler line
itself, not the predicate. The live instance of that shape on this card is `time_horizon`
(`recommendation.rs:829`) — a constant with a named author and no input — not `confidence`.

## #18

**CONVERGED — same resolution as #15**, and UX's proposed name is the one I pin: `unrecognized_value`
on the existing `ReasonKind`, one enum member on an existing type, emitted from the single
`RecPlanField::Confidence` arm. I withdrew `value_present = false` for an off-scale conviction at R2
and do not reopen it. One bound worth stating so the SPEC does not overclaim: on the shipped local-
rules path this token is **unreachable** (conviction is always in-scale, per #4), so its only live
producer is the LLM path, where `llm.rs:423` copies `confidence` through with no validation. It is
therefore correct-but-unobservable on the keyless fixture, and any AC for it needs a unit fixture,
not the rules-path card.

---

## Settled facts

The SPEC may rely on each of these; each is code-verified at the cited line, none is observed at
runtime (I cannot run anything).

1. `RecField` has exactly five members — `field_reasons.rs:5-11`.
2. `FieldReason` on the wire is `{ reason, missing_input }`, `ReasonKind` has two members today, `MissingInput` three — `field_reasons.rs:13-32`; TS mirror `convexa.ts:1536-1543`.
3. The `field_reasons` object is hand-built with `json!` at exactly one site and rides **every** envelope, including the local-rules and the early-return `Value::Null` branches — `recommendation.rs:478-484`, called from `base()` at `:664`. (This answers UX's ask: yes, the six keys ride the local-rules response.)
4. The shipped presence closure is null-only: `present = |v| v.map(|x| !x.is_null()).unwrap_or(false)` — `recommendation.rs:470`. `""`, `[]` and `"moderate"` all read present under it.
5. `candidate_quotes` is `set.has_quoted_contract()` = "some contract has a two-sided quote" — `recommendation.rs:460`, `candidates.rs:190-192`. It is NOT "the set was non-empty".
6. "The set was non-empty" is expressible today with no new `quant_engine` API: `!set.contracts().is_empty()` — `candidates.rs:181-183`.
7. `fieldLiteral` decides value-vs-absent by testing the value and falls through to `unavailable` — `literals.ts:55-63`. `FieldLiteral` has five members — `:41-46`.
8. `counts.checked == 4` is pinned for one shape only (fully-traced model rec + cited contract) — `grounding.rs:613-615` over `:596-600`. It is not the universal value.
9. The local-rules card prints the `local_rules` card member, never `some_traced (n of m)`; `not_applicable` preempts even that when `checked == 0` — `grounding.rs:327-344`, guard `:622`.
10. `Setup { name, bias, strategy, rationale, conviction }` are all non-optional `String`s, serialized plainly — `signals.rs:61-67`; `Signals.setups: Vec<Setup>` — `:105-111`; sole producer `generate_signals` via `routes/market.rs:118, 121`.
11. Therefore the three `unwrap_or` fallbacks at `recommendation.rs:802, 806, 814` are unreachable on every shipped path, and `structure` / `entry_trigger` / `confidence` on the local-rules card are Convexa-**authored** values with a named author (the signals rule).
12. `strikes: []` and `expiration: null` on the local-rules trade card are unconditional and independent of the candidate set — `recommendation.rs:822-823`. These two are the genuine absences.
13. `time_horizon: "1–5 sessions"` is an input-independent constant emitted by the assembler — `recommendation.rs:829`.
14. `AI_REC_LOCAL_ONLY` is read at `recommendation.rs:659-661` and selects `local_strategy_from_bundle` at `:722-723`.
15. **The local-rules fixture is not fully free.** `if !resolved.usable() { return base("unavailable", Value::Null, …) }` at `recommendation.rs:704` runs BEFORE the `local_only` branch, and `usable()` requires `key_material.is_some() && key_source != "none"` (`llm.rs:114-116`). It also runs `commit_query()` at `:742`, which increments the daily count and arms the cooldown (`:274-283`). Honest restatement of the claim all three lanes ratified: the fixture spends **no provider money and makes no provider call**, but it **does require configured key material and does consume one in-process cap unit**, and the `no_fresh_edge` gate (`:710`) and cooldown (`:716`) short-circuit ahead of it.
16. Accept seeds the entry dialog from the rec — `useTickerTradeFlows.ts:67` → `TickerDashboard.tsx:689`.
17. An omitted strike seeds the literal `0`, **not** a chain-derived strike: `prefill.ts:73` then `strike: prefill?.strike ?? nearest` at `TradeEntryDialogView.tsx:214` (`0` is not nullish, so `:204-206` never runs). The Strike `Select` has no option for it (`LegFields.tsx:139-153`) and submit accepts it (`TradeEntryDialogView.tsx:363`).
18. An omitted expiration **is** chain-derived: `prefill.ts:72` yields `''`, and `TradeEntryDialogView.tsx:207` is `prefill?.expiration || expirations[0] || ''`.
19. An omitted structure yields `right: 'call'` — `prefill.ts:40-46` (`:45`), reasserted at `TradeEntryDialogView.tsx:215`.
20. `confidence` is passed through from the model unvalidated — `llm.rs:423`; the prompt asks for `low|medium|high|null` — `llm.rs:146`. The off-scale case is reachable on the LLM path only.
21. No backend consumer other than the rec envelope reads `strategy.confidence`; it is absent from `build_export` (`recommendation.rs:386`), `ai_eval` and `grounding`.
