# R1 — architect position: rec-absence-literals-hole

## Position

### 0. The one-sentence shape

The six fields get a **wire-authoritative absence token of the SAME shipped type (`FieldReason`)**,
keyed by a **NEW, disjoint backend enum** — not by widening `RecField` — and render through the
**already-shipped five-member `FieldLiteral` union with no new member**. Enforcement is a
three-layer stack (type · folder source scan · DOM regression), and the whole change is confined to
a path allow-list that makes score/fingerprint byte-identity structural rather than careful.

---

### 1. Do NOT widen `RecField`. Add a disjoint sibling enum.

The BRIEF says "extend the backend's `RecField` enum." I am taking the opposite position on the
mechanism while preserving the BRIEF's actual outcome (a wire reason token per field). The reason is
mechanical, not stylistic: **`RecField` is a shared key across two consumers, and only one of them
applies to these six.**

`grounding.rs:4` states the coupling in the source itself: *"`field_reasons` answers 'the field is
null — why?'; this answers 'the field is non-null — where did that number come from?'. Two
consumers, one `RecField` vocabulary, both exhaustive, no wildcard arm."* And `grounding.rs:227-229`
makes the exhaustiveness load-bearing: *"`match RecField` with **no wildcard arm and no exemption**,
so a sixth stated number cannot ship without a rule (guard 1 / AC-49)."*

Three consequences of widening, each concrete:

1. **`resolve_field(field: RecField, asserted: Option<f64>, …)` (`grounding.rs:230`) takes an
   `Option<f64>` and nothing else.** `structure` / `entry_trigger` / `time_horizon` are model prose,
   `confidence` is a three-member label, `expiration` is a date string, `strikes` is `number[]`.
   There is no `f64` to pass. Six new arms would all have to return
   `FieldGrounding::bare(GroundingState::NotApplicable)` — a **lie-shaped arm**, because in that
   function `not_applicable` already means "the field carries no value" (`:242`, `:246`, `:251`), so
   a *present* `structure` would land in the branch that says it is absent.
2. **It leaks into the grounding card's denominator.** `recommendation.rs:524` folds the five
   `FieldGrounding`s into `all`, `counts()` derives `checked`, and `card_member()` turns that into
   the user-visible `some_traced (n of m)` line. `grounding.rs:613`
   (`the_denominator_excludes_the_dollar_risk_figure_and_the_suggested_size`) pins `checked == 4`.
   Nothing structurally stops a later hand from adding the six to `all`; a *display* fix would then
   silently move a shipped feature's counted claim.
3. **It forces an edit to two shipped guard tests** —
   `the_structurally_unchecked_set_is_exactly_position_size_and_max_risk` (`grounding.rs:519`) and
   `an_absent_value_is_not_applicable_on_every_field` (`:559`) both enumerate the five by hand.
   Widening the enum means hand-editing guards written to red the build when the set changes. A fix
   whose first act is to relax a guard is the wrong shape.

**Therefore:** `field_reasons.rs` gains a second enum — call it `RecPlanField` — with exactly six
members (`Structure`, `Strikes`, `Expiration`, `EntryTrigger`, `TimeHorizon`, `Confidence`), and a
second pure function `plan_field_reason(field, value_present, presence) -> Option<FieldReason>`
returning the **existing `FieldReason` struct unchanged**. `RecField` stays exactly five members;
grounding stays total over exactly the numbers it can trace.

Cost I accept and state plainly: two enums where the BRIEF assumed one, and a reader must learn that
"which fields have absence reasons" and "which fields have grounding" are now two different sets.
That cost is paid once, in one file, against a coupling that would otherwise re-surface on every
future field. **Options rejected:** a generic `&'static str` field key (destroys the exhaustive-match
property that is the entire enforcement); FE-side derivation from the null (forbidden outright —
`[digested-labels-not-raw-dump]`: the browser must never re-derive a literal by testing a null, and
it could not distinguish `not_given` from `unavailable` anyway).

---

### 2. Data-structure CONTENT: what the wire carries for the six

Six keys **added to the existing `field_reasons` object** (`recommendation.rs:478-484`), each
`FieldReason | null` with the shipped two-key shape `{ reason, missing_input }`. No new wire type, no
new response block, no new endpoint.

| field | `value_present` predicate (server-side, on the parsed `strategy: Value`) | declared deps | resulting token |
|---|---|---|---|
| `structure` | non-null **and** trimmed-non-empty string | none | always `not_given` |
| `strikes` | non-null array with **≥1 finite number** | candidate set non-empty | `unavailable` + `candidate_set`, else `not_given` |
| `expiration` | non-null **and** trimmed-non-empty string | candidate set non-empty | `unavailable` + `candidate_set`, else `not_given` |
| `entry_trigger` | non-null **and** trimmed-non-empty string | none | always `not_given` |
| `time_horizon` | non-null **and** trimmed-non-empty string | none | always `not_given` |
| `confidence` | non-null **and** a member of `{low, medium, high}` | none | always `not_given` |

Three content decisions inside that table, each with its mechanism:

**(a) The presence predicate must be PER-FIELD and TYPE-AWARE — the shipped shared one is a defect
here.** `recommendation.rs:470` is `present = |v| v.map(|x| !x.is_null()).unwrap_or(false)` —
null-only. Under it, `"strikes": []`, `"structure": ""`, and `"confidence": "moderate"` all read
**present**, so `plan_field_reason` returns `None`, the wire carries `null`, and
`fieldLiteral` falls to its default arm (`literals.ts:62`) → **`unavailable`**. That renders "we
tried and failed this cycle" over a field the model simply never named. **That is the exact
`absent-is-not-none` collapse this feature exists to close, reproduced one layer up by the fix
itself.** Reusing the shared `present` closure for the six is a ship-blocking error, not a nit.

**(b) `strikes` / `expiration` carry a real dependency, which is what keeps the token non-vacuous.**
If the candidate set the assembler inserted was empty, the model had nothing to name a strike or
tenor from — that is `unavailable`, and it is fixable information. This reuses the existing
`InputPresence` machinery pattern; `candidate_quotes` (`set.has_quoted_contract()`,
`recommendation.rs:460`) is the wrong flag — a set can hold unquoted contracts the model can still
name — so the presence flag is a **new, distinct** `candidate_set` boolean (set non-empty). It
implies one additive member on `MissingInput`. **This is the attackable part of my position:** if
council judges the extra `MissingInput` member too costly for the copy it obliges, the fallback is
"all six are always `not_given`," which still fixes the defect but makes the wire token
constant-valued and therefore easy to argue is ceremony. I prefer (b) and will withdraw it if the
copy cost is shown to exceed the value.

**(c) `confidence` is a closed vocabulary and must be treated as one.** `RecConfidence` is
`'low' | 'medium' | 'high'` (`convexa.ts:1374`), but `AiRecPanel.tsx:1158` renders
`s.confidence ?? '—'` — raw model text straight into a chip label. An out-of-set value ("moderate",
"fairly high") paints today. Under `[digested-labels-not-raw-dump]` the wire token is authoritative
and the FE renders by closed lookup: the server reports `value_present = false` for an out-of-set
confidence, and the FE **additionally** maps through a closed table so a nonconformant server still
cannot paint raw model prose. Two-sided, because either side alone is a single point of failure.
**Behavior change PM should ratify:** a chip that today shows "moderate" would show an absence
literal.

**Degenerate case, already handled by the shipped shape:** `envelope_extras` is called with
`strategy = Value::Null` on early-return branches (`recommendation.rs:438-440`). All six predicates
read false, all six emit `not_given`. Identical to how the existing five behave. No special case.

---

### 3. Data flow (one direction, named hops)

1. Model JSON → `strategy: Value` in `recommendation.rs`.
2. `envelope_extras(...)` computes six per-field `value_present` booleans + a
   `PlanInputPresence { candidate_set: bool }`.
3. `plan_field_reason` — a **pure leaf**: no app state, no route import, no HTTP client, no async,
   no `Instant`, no env read, no `Result` (the leaf contract stated at `grounding.rs:1-3` and
   `rec_inputs/mod.rs:1-3`).
4. Serialized into the SAME `field_reasons` object, reusing the existing
   `serde_json::to_value(...).unwrap_or(Value::Null)` degradation at `recommendation.rs:473-474`.
5. `libs/api` `FieldReasons` gains six keys, typed `FieldReason | null` and **optional (`?:`)**.
6. `AiRecPanel` trade branch: each of the six calls the shipped
   `fieldLiteral({ decision, value, reason })` → `FieldLiteral`.
7. One renderer maps `FieldLiteral` → element.

Nothing flows the other way. The model is never asked why it omitted a field —
`field_reasons.rs:34`: *"What the ASSEMBLER actually inserted — never a question put to the model."*
No prompt or output-schema change.

---

### 4. Component boundaries (FE)

- **`literals.ts` gains no new function and no new union member.** `fieldLiteral` already accepts
  `string | number | null | undefined` and already short-circuits `no_trade` first (`:55`). Five of
  the six call sites are a straight substitution. `strikes` pre-joins at the call site and passes
  `null` (not `''`) when empty.
- **The `FieldLiteral` → (text, tip, action) mapping must be extracted to ONE place.** It currently
  lives as a nested ternary inside `RiskField` (`AiRecPanel.tsx:791-798`). `confidence` renders as a
  `Chip`, not a `Field`, so a second renderer is unavoidable — and a second renderer must not become
  a second copy table. Mechanism: export one `literalCopy(l: FieldLiteral)` from `copy.ts` over the
  existing `RISK_FIELD_COPY`, consumed by both `RiskField` and the chip. One table, two renderers; a
  new call site cannot invent copy.
- **`Expiration`'s DTE caption is an isolation bug in its own right.** `AiRecPanel.tsx:1091` renders
  `· within your {dteMin}–{dteMax} DTE window` gated **only** on the window being set — never on the
  expiration existing. Today the card can print `Expiration: — · within your 7–45 DTE window`: a
  containment claim about an expiration that does not exist. **Rule: the caption renders on the
  `value` member of `FieldLiteral` and on no other member.** This is a `[absent-is-not-none]`
  violation independent of the `—` itself and it is in scope by mechanism, not by preference.
- **`confidence` branch asymmetry is deliberate and must be stated, not stumbled into.** The
  `no_trade` hero renders the conviction chip **conditionally** (`:943` — absent → nothing renders),
  while the trade branch will render an absence literal. That asymmetry is correct: on a no-entry
  card conviction is decoration; on a trade card its absence is decision-relevant. Copy is UX's.
- **`RiskField`'s `groundingState` prop stays absent on all six.** Its own doc (`:775`) already names
  Structure / Strike(s) / Expiration / Entry trigger as fields that never pass it. That stays true —
  see non-goal 2.

---

### 5. Isolation / error rules

- **A missing token degrades to a literal, never an HTTP error** (`[best-effort-isolated-or-null]`).
  Mechanism, not intent: `plan_field_reason` has no `Result` and no fallible call in it, so there is
  no error to propagate; the route path reuses the shipped
  `to_value(...).unwrap_or(Value::Null)`; the FE keys are optional, so `undefined` is a valid,
  renderable state at every hop.
- **An ABSENT `field_reasons` block renders `unavailable`, and I am NOT adding a sixth
  `FieldLiteral` member for it.** The counter-precedent is real and I name it so R2 can attack it:
  `prefillGate` (`literals.ts:322-334`) gives block-absence its **own third reason**, arguing that
  folding it into `not_checkable` "would collapse 'we could not check this figure' into 'no check
  reached this browser at all'." That precedent explicitly bounds itself — same comment, `:322-323`:
  *"at the one boundary where a number stops being a display and becomes an input."* These six are
  display-only; none seeds `TradeEntryDialog`. And the only way the block is absent is a pre-feature
  server or a local fallback, where `unavailable` is *true*. Adding a sixth member would oblige new
  copy across every shipped `fieldLiteral` consumer for a state that is honest as-is.
- **SSE untouched.** These six are **static bundle-adjacent reads** on the
  `POST /api/recommendation/{ticker}` response. Nothing new is live-derived, so
  `[live-vs-static-isolation]` is satisfied by the SSE path carrying zero new bytes.
- **`—` stays reserved.** The `no_trade` branch (`AiRecPanel.tsx:956-996`) gets a **zero-line diff**.
  That is verifiable, not aspirational: a diff over that range is either empty or it is not.

---

### 6. Structural enforcement — three layers, and the honest bounds of each

The bar (`[structural-over-prose-enforcement]`): *poison the thing the rule forbids and the build
must go red, and the poison test must itself be proven non-vacuous.* "The build" here means
`npm run ci` (lint → typecheck → test → build) — layers 1 and 2/3 red at different stages, which is
a feature, not a gap.

**Layer 1 — the type (reds `nx typecheck`).** The six call sites stop taking `value: ReactNode` and
take `literal: FieldLiteral`. A bare `?? '—'` at any of them is then a type error: `string` does not
inhabit the union. This is the strongest layer because it is not text-matching — it cannot be evaded
by escaping a character. Its bound: it protects the six sites that adopt it, not a *new* seventh
site that reaches for the untyped `Field` directly.

**Layer 2 — a folder source scan (reds `nx test`).** Modeled byte-for-byte on the scan already
shipped in this exact folder, `bannedWords.scan.spec.ts` (same `import.meta.glob('./**/*.{ts,tsx}',
{ query: '?raw', eager: true })`, same comment-stripping, same anti-vacuity pair). Rule: **U+2014 may
not appear in `AiRecPanel.tsx` at all**; its only permitted home is the named constant in `copy.ts`,
listed in an EXEMPT set, with an **every-EXEMPT-path-still-exists** assertion so an exemption cannot
outlive its file.

Two honest weaknesses of layer 2, stated rather than glossed:
- **Escape evasion.** `—` is one character and trivially written `—` or `&mdash;`. The scan
  must normalize escapes and HTML entities **before** matching, and the anti-vacuity mutation must
  poison with an **escaped** form, not just the literal glyph. Otherwise an editor's autocorrect
  defeats the guard.
- **Line endings.** This repo has `core.autocrlf = true` and no `.gitattributes`; the
  `ai-rec-grounding` guard-8c pin failed closed on a fresh Windows checkout for exactly this
  (OPEN_THREADS §7ae, F-2). Normalize `\r\n` → `\n` before matching. Never weaken the assertion to
  make it pass.
- **Scope bound.** The glob is relative to the spec file, so the guard is **folder-scoped**: a
  seventh bare `—` inside `pages/ticker/widgets/ai-rec/` is caught; one elsewhere is not. I am
  claiming folder coverage, not repo coverage.

**Layer 3 — a render regression (reds `nx test`).** A fixture: `decision: 'trade'`, all six fields
omitted → each of the six test-ids renders its own in-vocabulary literal, and **no `—` appears in
the trade card's DOM**. Plus the inverse fixture: `no_trade` → `—` in exactly the four risk slots.
This is DOM-level and therefore immune to layer 2's regex fragility.

**Layer 3 has a known collision I must name rather than assert away.** `literals.ts:101-102`
(`quoteTextFor`) contains **two more bare `'—'` fallbacks** — for a null `iv` and a null
`greeks.delta` on the cited-contract line, which renders on **trade** cards. They are the same defect
class as the six and they will fire the DOM assertion. Disposition is a scope call for PM; the
architectural requirement either way is that **they be explicitly enumerated in the scan's EXEMPT set
with a still-exists assertion**, so they are a *named* exemption rather than a silent hole.

**Backend guards to match:** (i) a unit test per field asserting `""` / `[]` / `"moderate"` →
`not_given`, not `unavailable` — the §2(a) trap, poison-provable; (ii) a route-level test pinning the
`field_reasons` object at **exactly eleven keys with exact spellings** — the keys are hand-built with
`json!`, not serde-derived, so nothing pins them today and a typo'd key silently becomes `undefined`
→ `unavailable` on every field; (iii) a tally test asserting `RecField` has exactly 5 members and
`RecPlanField` exactly 6, so a later hand cannot quietly merge them.

---

### 7. Score / fingerprint byte-identity — the mechanism, not the promise

`[additive-keeps-score-byte-identical]`. The enforcement is the **module boundary already in the
source**: `rec_inputs/mod.rs:1-3` declares these leaves as things `routes/` and
`services/recommendation.rs` call — *"never a scoring input, never on SSE."* The direction is one-way:
`quant_engine` / signals / scoring do not import `services::rec_inputs`, and the new enum lives
inside that leaf.

The verifiable artifact is a **diff path allow-list**. The change set may touch only:
`apps/api/src/services/rec_inputs/field_reasons.rs` · `apps/api/src/services/recommendation.rs` ·
`libs/api/src/lib/convexa.ts` · `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/**`. **Empty diff
under `libs/quant-engine/`** and under every signals/scoring/SSE module — the `outcome-ledger`
precedent's "empty `apps/api` diff," restated for this shape.

Second, independent line of defense: the six keys ride only on
`POST /api/recommendation/{ticker}`. `opportunity_score` / `opportunity_tier` / `state_fingerprint`
are served on `GET /api/ticker/{ticker}` and are already pinned by the conformance suite. Byte
identity there is **true by construction** (different endpoint, zero new bytes), not by care. And
the rec is not an input to the fingerprint at all (PROJECT_CONTEXT §8: the LLM *"never feeds
signals/score/tier/gate/`state_fingerprint`"*).

`[theme-token-discipline]` — the six render through existing components; **zero new hex, zero new
sx colour**, dark/light parity inherited. If a new colour is proposed, it is out of this feature.

---

### 8. Explicit non-goals

1. **No sixth `FieldLiteral` member.** Five ship, five remain. (§5 argues why block-absence does not
   earn one.)
2. **No grounding for the six.** No clause, tint, anchor, `GroundingState`, tooltip, or register
   change; `counts` / `card_member` / `checked` are byte-identical. The six are model *labels*, not
   price-scale numbers — there is nothing to trace them to.
3. **Zero-line diff in the `no_trade` branch** (`AiRecPanel.tsx:956-996`). `—` stays reserved to it.
4. **No prompt or output-schema change.** The model is never asked why it omitted a field.
5. **No change to** `ai_eval` / cooldown / cap / `cited_contract` / the candidate set / the export
   surface.
6. **No new endpoint, no new response block, no SSE bytes, no durable-store key** — so
   `[loss-free-durable-migration]` is not engaged.
7. **No repo-wide absence-literal retrofit** (positions, straddle-move, operator metrics). This
   feature is scoped to the ai-rec folder; the guard is honestly folder-scoped to match.
8. **`strikes` / `expiration` are not validated against the candidate set here.** That is
   `cited_contract`'s existing job. We report absence only.

---

### 9. Restated binding constraints

- **`[absent-is-not-none]` (HARD)** — enforced in the type (`FieldLiteral`) and the closed
  vocabulary (`FieldReason`), never in prose. Specifically: `""`, `[]`, and an out-of-set
  `confidence` are **absent**, and absent-because-never-named (`not_given`) must not collapse into
  absent-because-we-failed (`unavailable`).
- **`[digested-labels-not-raw-dump]`** — the wire token is authoritative; the browser never
  re-derives a literal by testing a null; `confidence` renders through a closed lookup, never as raw
  model text.
- **`[structural-over-prose-enforcement]`** — three layers (§6), each poison-proved, each with its
  bound stated.
- **`[best-effort-isolated-or-null]`** — no fallible call added; a missing token is a literal, never
  an HTTP error.
- **`[additive-keeps-score-byte-identical]`** — module boundary + diff path allow-list + different
  endpoint (§7).
- **`[theme-token-discipline]`** — tokens only, dark/light parity, zero new hex.
- **`[live-vs-static-isolation]`** — every new datum is **static**; SSE carries zero new bytes.
- **`[ai-asserted-numbers-are-traceable]`** — this feature's second instance, covering what the model
  *omits* rather than what it *asserts*.

---

## Risks I see

1. **The fix reproducing its own defect (highest).** If the shared null-only `present` closure
   (`recommendation.rs:470`) is reused for the six, `""` / `[]` / `"moderate"` emit no token and the
   card renders `unavailable` where `not given` is true. Ship-blocking; mitigated by §6 backend
   guard (i).
2. **Unpinned JSON keys.** `field_reasons` is hand-built with `json!`. A typo'd key is invisible on
   both sides: FE reads `undefined`, `fieldLiteral` returns `unavailable`, the card looks plausible
   and is wrong on all six at once. Mitigated by §6 guard (ii). No existing test covers this.
3. **The scan is defeatable by escaping.** A source scan for a single character is the weakest layer
   in the stack; escape-normalization + an escaped-form mutation are required, and even then layer 1
   (the type) is what actually carries the weight. I am not claiming the scan alone meets the bar.
4. **CRLF.** Precedent exists in this exact area (OPEN_THREADS §7ae F-2). Normalize before matching.
5. **The two `quoteTextFor` `'—'` sites** (`literals.ts:101-102`) collide with layer 3's DOM
   assertion and are, on the merits, the same defect. Unresolved scope question for PM; the
   architectural floor is that they be named in the EXEMPT set, never silently skipped.
6. **`MissingInput` gaining a `candidate_set` member** obliges a copy decision I do not own. If that
   copy is judged not worth it, my §2(b) position falls back to "all six always `not_given`" and the
   wire token becomes constant-valued — weaker, still correct, and I will say so rather than defend
   the richer shape past its value.
7. **The two-enum split has a documentation cost.** A future reader must learn that absence-reasons
   and grounding now cover different field sets. Mitigated by a comment at both enum sites; not
   eliminated. If council prefers the single-enum shape, the price is §1's three consequences, and
   consequence 2 (the moving `checked` denominator) is the one I would not accept.
8. **Six fields is the count as of GATE I re-grounding.** The BRIEF itself found two more than the
   backlog named. There may be a seventh. That is precisely what layers 1 and 2 exist to make loud
   rather than silent — but the enum, the wire keys and the tests are all sized to six today.

---

## Assumptions I'm making about the other two lanes

- **PM accepts that this is a BOTH-LANES change**, and specifically that the backend emits six new
  `field_reasons` keys — i.e. the FE-only variant of this feature is off the table, because without
  a wire token the browser would have to test a null, which `[digested-labels-not-raw-dump]`
  forbids outright.
- **PM will rule on whether an out-of-vocabulary `confidence` (e.g. "moderate") renders as an
  absence literal instead of raw model text.** I am asserting it must, on invariant grounds; it is a
  visible behavior change and PM owns ratifying it.
- **PM will rule on the two `quoteTextFor` em-dashes** (`literals.ts:101-102`, null IV / null delta
  on the cited-contract line) — in scope as a seventh/eighth site, or an enumerated exemption. My
  design works either way; the DOM assertion in §6 layer 3 must be scoped to match the ruling.
- **PM does not require a new `FieldLiteral` member.** I am spending my one structural
  simplification on keeping the union at five, which means an absent `field_reasons` block renders
  `unavailable` rather than a distinct block-absent literal.
- **UX will write copy for at most the EXISTING literals** (`not given` / `unavailable` / `not set`),
  and will not require a per-field bespoke sentence for each of the six — if six distinct sentences
  are needed, the single `literalCopy` table in §4 has to become field-parameterized and my
  "one table, two renderers" boundary weakens.
- **UX accepts that the six render inside the existing `Field` / `Chip` chrome** — no new tile, no
  new section, no new tooltip surface, no new icon. If a marker or tint is wanted on these six, that
  contradicts non-goal 2 and reopens the grounding coupling I removed in §1.
- **UX accepts the `no_trade` conviction chip staying conditional** (absent → renders nothing) while
  the trade card's confidence renders a literal. If UX wants symmetry, say which direction, because
  making `no_trade` render a literal touches the zero-line-diff commitment in §5.
- **UX accepts that a `not given` / `unavailable` Expiration renders WITHOUT the
  `· within your N–M DTE window` caption.** The caption is a containment claim and cannot sit beside
  a non-existent expiration.
- **PM will not ask for a measured before/after on the rec's own numbers.** This feature changes no
  figure and no score, so `[score-change-is-deliberate-and-measured]` is not engaged; if PM wants a
  measurement it would have to be a rate ("how often are these six omitted"), which needs live
  `POST /api/recommendation` calls and a BYO key, and that is an effort call I am not making.
- **Neither lane needs the six on the export surface.** OPEN_THREADS §7ae records that widening the
  export was ruled out under `egress-copy-tracks-payload`; I am assuming that ruling still holds and
  the export stays untouched.
