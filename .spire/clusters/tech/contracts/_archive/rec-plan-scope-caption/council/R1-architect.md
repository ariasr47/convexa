# R1 — architect position: rec-plan-scope-caption

## Position

### Problem (technical shape)

On a **produced `trade`** recommendation, stop / target / invalidation can carry per-figure grounding
clauses while plan fields (`Structure`, `Strike(s)`, `Expiration`, `Entry trigger`, `Time horizon`,
`Confidence`) render as bare stated values or closed absence literals with **no clause**. A reader can
still infer *"no clause means checked"* onto those plan fields. That is the surviving half of
`ai-asserted-numbers-are-traceable` (omission / halo half) after `rec-absence-literals-hole` closed only
the false-`—` half.

Verified surfaces (not assumed):

- Plan row lives in `DecisionCard.tsx` → `DecisionMetadata` (`data-testid="decision-metadata"`), gated
  on `strategy.decision === 'trade'`.
- Long-form analysis re-states a subset of plan fields in `AnalysisSurface.tsx` → `AnalysisSummary`.
- Risk/exit clauses render only on stop / target / invalidation via `FigureClause` + `GroundingNote`.
- Shipped scope-caption idiom: `REASONING_PROSE_NOT_CHECKED` in `copy.ts`, rendered once with the
  reasoning surface in `reasoning.tsx` (unconditional on that surface; closed constant; not a field
  marker).

### Solution shape — one section-level scope boundary

Ship **exactly one** section-level caption whose **content** is a permanent scope fact: the plan-field
set is **not** in the checked set. It is **not** a per-rec diagnosis of why any field is bare, and it
is **not** a new member of the not-a-number vocabulary.

Mechanism (mirror of the shipped prose caption):

1. **Closed constant** in the existing microcopy module (`copy.ts` sibling of
   `REASONING_PROSE_NOT_CHECKED`). UX owns the words; architect owns that it is a single closed string
   looked up by identity, never interpolated from field state.
2. **Pure FE predicate** decides show/hide. No server round-trip, no new wire field, no payload rename.
3. **One attachment point** co-located with the plan-field section (component boundary: plan section,
   not risk grid, not grounding card line, not per-`RiskField` clause slot). Exact visual placement is
   UX / GATE-V; architect requires co-location with plan fields so the caption cannot be read as a
   fourth risk-clause.

### When the caption shows — named predicate

**Show** when all of the following hold:

| Clause | Mechanism |
| --- | --- |
| Produced trade path | Plan section only mounts for `decision === 'trade'` (`DecisionCard` already gates `DecisionMetadata` this way). Caption rides that gate — no separate status machine. |
| Producer is **not** local-rules | Suppress when `rec.grounding?.card === 'local_rules'`. That token is server-emitted by `card_member(..., local_only=true)` in `apps/api/src/services/rec_inputs/grounding.rs` and already closed-looked-up by `cardGroundingLine` / `GROUNDING_CARD.local_rules`. |
| Grounding block absent | Treat as **not** local-rules: `?.card === 'local_rules'` is false when `grounding` is missing. Mechanism: presence lookup on the closed card token only — same discipline as `GROUNDING_BLOCK_ABSENT` (do not re-derive producer from figures). Halo risk is higher when no check reached the browser; suppress only on the positive local-rules member. |

**Do not** gate on:

- **`key_source`**. Verified: `key_source` is the BYO payment path (`own_key` / `shared_admin` /
  `none`). Live local-rules envelopes still carry a real key_source (QA observed
  `grounding.card: "local_rules"` with `key_source: "shared_admin"`). Using key_source as the
  local-rules exclusion is a **false mechanism**. The BRIEF's "key_source already rides the payload"
  claim is imprecise: the payload already carries the correct discriminator (`grounding.card`), so
  `NO_BACKEND_CHANGE` still holds — but the discriminator is **not** `key_source`.
- **Field-content heuristics** (empty `strikes`, null `expiration`, "any plan field stated"). LLM
  trades can omit the same fields; local-rules always states `structure` / `entry_trigger` /
  `confidence` when a setup exists (`recommendation.rs` ~841–856: `decision: "trade"`,
  `structure: strategy`, `strikes: []`, `expiration: null`, `entry_trigger: "At/near {name}"`,
  `confidence: conf`). Content heuristics either miss LLM omissions or fire as **standing chrome** on
  the local-rules path — the exact failure the BRIEF forbids.
- **Per-field bare/stated inspection** for the caption text. Caption is a scope boundary; content does
  not change per rec (`digested-labels-not-raw-dump`: do not invent a per-field marker or re-derive a
  label from a scalar).

**Unconditional on non-local-rules trade** (once the plan section mounts) wins the option compare:

| Option | Complexity | Cost | Scalability | Familiarity | Notes |
| --- | --- | --- | --- | --- | --- |
| A. Show on every non-`local_rules` produced trade (plan section present) | Lowest — one token check | One constant + one render site | N/A (client render) | Same as `REASONING_PROSE_NOT_CHECKED` | Preferred |
| B. Show only when ≥1 plan field is `kind === 'value'` | Extra scan of six literals | Same + edge tests | Same | Novel branch | Residual is about *stated* fields, but a scope boundary that vanishes when all six are `not given` teaches the wrong lesson (absence of caption ≠ full check coverage) |
| C. Show only when a risk clause is present | Couples plan chrome to grounding field states | Higher | Same | Novel | Re-opens "browser folds figures" risk |

**Decisive axis: complexity + fidelity to the shipped prose-caption pattern.** Option A.

### Component / module boundaries

| Concern | Owner boundary | Mechanism |
| --- | --- | --- |
| Caption string | `copy.ts` closed constant | Single export; banned-word / disjointness tests can pin it like `REASONING_PROSE_NOT_CHECKED` |
| Show/hide predicate | Pure function in the ai-rec widget module (next to `literals` / presentation helpers — not inside a presentational leaf) | Input: `RecResponse` (needs `strategy.decision` + `grounding?.card` only). Output: boolean. No React, no theme, no copy. |
| Render attachment | Plan-field section only | Prefer **one** site. Candidate hosts already exist: `DecisionMetadata` (pinned card plan row) or analysis plan summary. Dual attachment on card **and** drawer is a line-budget / standing-chrome risk — if UX wants both surfaces, they share the same constant + predicate; architect still treats dual chrome as a cost to justify, not a default. |
| Out of bounds | `FigureClause`, `GroundingNote`, `planFieldLiteral`, Accept/`prefill`, backend `envelope_extras` / `card_member` | Do not extend grounding's checked set, do not add a sixth vocabulary kind, do not touch Accept prefill |

### Isolation and error rules

- **`NO_BACKEND_CHANGE` / empty `apps/api` diff.** Enforcement by construction: no Rust edits; FE reads
  tokens already on the envelope. Score / tier / `state_fingerprint` cannot move because nothing on
  the scoring path is imported (`additive-keeps-score-byte-identical`).
- **`ai-asserted-numbers-are-traceable` (halo half).** Mechanism: an explicit scope caption prevents the
  only remaining path by which "checked" is inferred onto unchecked plan fields without inventing a
  per-field mark that would look like a check result.
- **`absent-is-not-none`.** Caption is **not** a not-a-number literal and must not reuse `—` /
  `not given` / `unavailable` / `unrecognized`. Those stay on the six fields via the shipped closed
  lookup. Caption and field literals remain disjoint closed sets (same discipline as
  `REASONING_PROSE_NOT_CHECKED` vs `GROUNDING_BLOCK_ABSENT`).
- **`digested-labels-not-raw-dump`.** No new per-field marker; no browser re-label from scalars; plan
  labels continue to come from `PLAN_FIELD_LABEL` only.
- **Caption states a scope boundary, never a diagnosis.** Fixed string; no interpolation of which
  fields were bare this cycle; no "because strikes empty" branch.
- **`theme-token-discipline`.** Render uses theme text tokens only (shipped pattern: `text.secondary`
  caption). Zero hardcoded hex; no new palette.
- **`single-motion-moment`.** No new animation family, keyframe, or motion prop.
- **SSE / live isolation.** Caption is static presentation of the pinned rec — no live derivation, no
  poll, no store write.
- **`local_rules` standing-chrome rule (binding).** Verified always-on condition: when setups exist,
  `local_strategy_from_bundle` emits a trade with **stated** structure / entry_trigger / confidence and
  empty strikes / null expiration (`recommendation.rs` ~841–856). Any caption gated only on "trade +
  stated plan fields" becomes permanent chrome on that path. Exclusion is the closed
  `grounding.card === 'local_rules'` member, not field content.

### Explicit non-goals

- Backend / wire / `grounding.card` enum changes; new producer flags; payload field renames.
- Extending grounding to check plan fields (structure / strikes / expiration / trigger / horizon /
  confidence).
- Per-field markers, icons, or tint on the six plan slots for "unchecked."
- Extending the grounding definition tooltip with a negative enumeration (withdrawn already in the
  prior council; positive allowlist on stop/target/invalidation stays as-is).
- Re-opening the DTE-window `?` / containment seam (`dteWindowCaption` already requires both finite
  bounds).
- Accept / prefill / TradeEntryDialog changes.
- Recording `ai-rec-grounding` SPEC §9.5 closed before this caption ships (binding record rule from
  OPEN_THREADS §7af / §7ah).
- UI layout, endpoint signatures, JSON field names, or final copy wording (other lanes).

### Binding constraints restated (touched by this position)

- **`ai-asserted-numbers-are-traceable` (HARD — omission/halo half):** absent check must not render as
  another state's reserved literal and must not be inferable as "checked." Caption is the remaining
  mechanism for the inference half on stated plan fields.
- **`absent-is-not-none`:** keep the six plan literals and the scope caption in disjoint closed sets.
- **`digested-labels-not-raw-dump`:** one section caption; no new per-field mark; no scalar→label
  re-derivation.
- **Scope boundary, not diagnosis:** fixed constant; no per-rec causal wording.
- **`theme-token-discipline`:** theme tokens only.
- **`single-motion-moment`:** no new motion.
- **`additive-keeps-score-byte-identical`:** copy/render only; empty `apps/api` diff.
- **`cited-code-is-verified-not-assumed`:** cites verified against `DecisionCard.tsx`, `copy.ts`,
  `recommendation.rs` ~841–856, `grounding.rs` `card_member`, `AnalysisSurface.tsx`, `reasoning.tsx`
  — not Python-era `AiRecPanel` line numbers.

### Option compare — placement host (boundary only, not layout)

| Host | Complexity | Cost | Standing-chrome risk | Familiarity |
| --- | --- | --- | --- | --- |
| Pinned plan row (`DecisionMetadata`) | Lowest for the residual (halo is on the same card as clauses) | One render | Low if local-rules excluded | Same card as plan fields today |
| Analysis surface only | Leaves the above-the-fold plan row without the scope fact | Misses readers who never open analysis | Low | Analysis already holds `REASONING_PROSE_NOT_CHECKED` |
| Both | Dual chrome | Highest line budget | Higher | Two sites to keep in sync |

**Architect preference on technical grounds:** attach to the **pinned plan row** so the scope fact
sits where the unchecked stated fields and the checked risk clauses are visible together — that is
where the false inference forms. Analysis-only fails the residual for readers who act from the card.
Final placement remains UX / GATE-V; this is the attackable technical preference, not a layout design.

## Risks I see

1. **Wrong exclusion signal.** If implementers follow the BRIEF's imprecise `key_source` wording
   literally, local-rules trades with `shared_admin` / `own_key` still show the caption → standing
   chrome on the path the BRIEF forbids. Mechanism to pin in tests: fixture with
   `grounding.card === 'local_rules'` and a non-`none` key_source must **not** show the caption.
2. **Dual-surface double caption.** Card plan row + analysis plan summary both render plan fields;
   attaching without a single-host rule produces two identical scope lines and re-opens the line-budget
   cut that deferred this work (`rec-absence-literals-hole` decisions.md §C #17/#23).
3. **Predicate creep into diagnosis.** Conditioning the string (or visibility) on which of the six are
   bare turns a scope boundary into a per-rec claim and collides with
   `digested-labels-not-raw-dump` / the BRIEF's "never a per-rec diagnosis" rule.
4. **Collapsing into grounding chrome.** Placing the caption next to `GroundingNote` or inside a
   `FigureClause` teaches that it is a check result, not a permanent scope limit — same halo class in
   reverse.
5. **Vocabulary collision.** Reusing `GROUNDING_BLOCK_ABSENT` / `not given` / `wasn't checked` wording
   would blur "server check missing this cycle" with "these fields are never in the checked set"
   (the prose caption deliberately stayed disjoint for that reason).
6. **`not_applicable` local-rules edge.** When local-only has nothing checkable, `card_member`
   returns `not_applicable` **before** `local_rules` (`grounding.rs` order: checked==0 preempts).
   Those envelopes are still local-rules **producer** but will **not** match
   `grounding.card === 'local_rules'`. If such a body still mounts a trade plan row with stated
   structure/trigger, Option A's token check would show the caption. Attackable residual: either
   accept the caption there (scope statement is still true — plan fields aren't AI-checked) or require
   a second producer signal. I prefer **accept show** — the standing-chrome ban targets the common
   local_rules trade with clauses + stated plan fields, not the null-flip empty card. If PM/UX need
   zero caption on every local-only body, that needs a wire producer flag (`NO_BACKEND_CHANGE` breaks)
   or a FE heuristic I currently reject.
7. **Recording §9.5 closed early.** Process risk, not code: shipping without the caption, or with
   caption only on analysis, must not close the residual in ledger/BACKLOG.

## Assumptions I'm making about the other two lanes

- **UX** will author exactly one closed caption string in the `REASONING_PROSE_NOT_CHECKED` idiom
  (scope boundary; no banned verification words; disjoint from every grounding / absence literal) and
  will not introduce per-field unchecked marks on the six plan slots.
- **UX** will pick a single primary attachment host for v1 (I prefer the pinned plan row on technical
  grounds); if they choose analysis-only, they accept that the residual remains for card-only readers
  and §9.5 half two stays open under that choice.
- **UX** will not place the caption inside `FigureClause`, `GroundingNote`, or a risk-grid cell, and
  will use theme `text.secondary` caption chrome with no new motion.
- **PM** will treat `grounding.card === 'local_rules'` (not `key_source`) as the acceptance criterion
  for the local-rules exclusion, and will require a test where local_rules coexists with a non-`none`
  key_source.
- **PM** will keep `NO_BACKEND_CHANGE` / empty `apps/api` diff and `additive-keeps-score-byte-identical`
  as ship gates, and will not demand a new wire producer flag for the `not_applicable`-preempts-
  `local_rules` edge unless the council reopens backend scope.
- **PM** will not allow any gate report, ledger row, or BACKLOG line to record `ai-rec-grounding`
  SPEC §9.5 closed until this caption is observed on a produced LLM trade with a stated unchecked plan
  field and absent on the common local_rules trade path.
- **PM** will price line budget as one additive caption (not a merge into the grounding card line or
  the conditional "not actionable" standing line) — merge would assert a false causal link between
  check-coverage and actionability, already ruled against at `rec-absence-literals-hole` §C #17/#23.
- **UX / PM** will leave Accept/prefill, DTE-window caption, and confidence dual-label residuals
  outside this feature's acceptance set.
