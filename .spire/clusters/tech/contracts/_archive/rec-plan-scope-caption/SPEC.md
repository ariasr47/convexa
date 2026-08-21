# rec-plan-scope-caption — spec

**Source brief:** .spire/clusters/tech/contracts/rec-plan-scope-caption/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md · R3-pm.md · R3-ux.md (under council/)
**Status:** APPROVED 2026-08-17

## 1. Goal + scope

Close the surviving half of `ai-rec-grounding` SPEC §9.5: on a produced **trade** recommendation, stop /
target / invalidation can carry grounding clauses while the six plan fields (`Structure`, `Strike(s)`,
`Expiration`, `Entry trigger`, `Time horizon`, `Confidence`) render as bare stated values or closed
absence literals with **no clause**. A reader can still infer *"no clause means checked"* onto those
plan fields and enter or size on a field nobody checked — the same wrong-trade class as the last two
AI-grounding ships. This feature ships **one section-level scope caption** on the pinned DecisionCard
plan row stating that those plan fields are not checked, and keeps it off the affirmative local-rules
path so it never becomes standing chrome.

**In scope:**

- Exactly one closed caption constant (`PLAN_FIELDS_NOT_CHECKED`) in the existing ai-rec microcopy
  module, sibling of `REASONING_PROSE_NOT_CHECKED`.
- A pure FE show/hide predicate over already-fetched rec state: produced trade path with the plan
  section mounted, and **not** `grounding.card === 'local_rules'`.
- One render attachment under the pinned plan row on `DecisionCard` (`DecisionMetadata` /
  `data-testid="decision-metadata"`), before the thesis lead.
- Ship-blocking presence, local-rules absence, single-instance, `no_trade` / non-rec negative space,
  sibling-honesty distinctness, SSE isolation, score/backend non-touch, and the §9.5 record rule.
- Frontend-only (`NO_BACKEND_CHANGE`); empty `apps/api` diff.

**Out of scope:**

- Backend / wire / `grounding.card` enum changes; new producer flags; payload renames.
- Extending grounding so plan fields enter the checked set, `counts.checked`, or figure clauses.
- Per-field markers, icons, tints, tooltips, or type-register changes on the six plan slots.
- Merging this caption into the grounding card line, Class-A absence standing line, conditional
  not-actionable line, or `REASONING_PROSE_NOT_CHECKED`.
- Accept / prefill / `TradeEntryDialog` changes.
- Re-opening the DTE-window `?` / containment seam (`dteWindowCaption` already requires both finite
  bounds).
- Prompt or schema changes to make the model ground plan fields.
- Positions / reassessment surfaces; export/egress widening; new animation or palette role.
- Recording `ai-rec-grounding` SPEC §9.5 closed before this feature’s ship-blocking ACs pass.

**Future (deliberately deferred):**

- Measuring whether the caption reduces the "no clause = checked" inference with real readers.
- Extending the same scope-boundary treatment to reassessment recs if those surfaces present the same
  plan fields beside checked risk numbers.
- Work that would *actually check* plan fields against computed state (a different product).

## 2. Architecture

### 2.1 Presentation boundary

This feature is **pure frontend presentation** over the pinned `RecResponse` the DecisionCard already
consumes. No new endpoint, request field, response field, store write, poll, or SSE subscription.

| Concern | Owner boundary | Mechanism |
| --- | --- | --- |
| Caption string | Closed constant in `pages/ticker/widgets/ai-rec/copy.ts` | Single export `PLAN_FIELDS_NOT_CHECKED`; looked up by identity; never interpolated from field state |
| Show/hide predicate | Pure function in the ai-rec widget module (beside literals / presentation helpers — not inside a presentational leaf) | Input: `strategy.decision` + `grounding?.card` (and the existing plan-section mount gate). Output: boolean. No React, no theme, no copy |
| Render attachment | Pinned plan section only — under `DecisionMetadata` on `DecisionCard.tsx` | One site; `data-testid="plan-fields-not-checked"` |
| Out of bounds | `FigureClause`, `GroundingNote`, `planFieldLiteral`, Accept/prefill, backend `envelope_extras` / `card_member` | Do not extend grounding’s checked set; do not add a sixth vocabulary kind; do not touch Accept |

Modules expected to change (frontend only):

- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts` — new closed constant.
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx` (plan row / `DecisionMetadata`) — one caption render site.
- A pure predicate helper colocated with existing ai-rec presentation helpers.
- Existing DecisionCard / ai-rec DOM tests (presence, absence, single-instance, disjointness).

`AnalysisSurface.tsx` may continue to re-state a subset of plan labels; it **must not** gain a second
`plan-fields-not-checked` instance.

### 2.2 Show / hide predicate (structural only)

**Show** exactly one plan-scope caption when **all** of the following hold:

1. The rec is on the produced **trade** path and the plan section mounts (today: `strategy.decision === 'trade'` → `DecisionMetadata` / `decision-metadata`).
2. The producer is **not** affirmative local-rules: `rec.grounding?.card !== 'local_rules'` (strict inequality on the closed card token).

When `grounding` is missing or `card` is any non-`local_rules` member (including `not_applicable`), the
local-rules exclusion does **not** fire — see residual below.

**Do not** gate on:

- **`key_source`** (`own_key` / `shared_admin` / `none`). That field is BYO payment provenance. Live
  local-rules envelopes can carry a real key_source (observed `grounding.card: "local_rules"` with
  `key_source: "shared_admin"`). Using keyless/`key_source` as the exclusion is a false mechanism.
- **Field-content heuristics** — empty `strikes`, null `expiration`, “≥1 plan field is `kind === 'value'`”,
  or “≥1 risk/exit clause rendered.” Content heuristics either miss LLM omissions or fire as standing
  chrome on the local-rules path (which always states structure / entry_trigger / confidence when a
  setup exists). A scope boundary that vanishes when every plan field is an absence literal, or when no
  risk clause rendered, teaches “no caption means full check coverage.”
- **Per-field bare/stated inspection** for the caption text. The string is fixed; content does not change
  per rec.

**Hide** when:

| Situation | Caption |
| --- | --- |
| `grounding.card === 'local_rules'` | Absent — including when `key_source` is non-`none` and when structure / entry trigger / confidence are stated with empty or absent strikes/expiration |
| `decision === 'no_trade'` | Absent — plan section does not mount; reserved no-entry `—` unchanged |
| Non-rec panel states (loading, error, cooldown, daily cap, no key, signed-out, empty / not asked) | Absent — DecisionCard body not mounted for a produced trade plan row |
| Dual attachment (card **and** analysis) | Forbidden — single instance only |

**Accept-show residual (`not_applicable`):** under `NO_BACKEND_CHANGE`, the closed hide set is affirmative
`card === 'local_rules'` only. When a local-only body has nothing checkable, server `card_member` can
emit `grounding.card === 'not_applicable'` **before** `local_rules`. That envelope is still a local-only
producer in spirit but does **not** match the hide token. If such a body mounts a trade plan row, the
caption **shows**. Scope statement remains true (plan fields are not AI-checked). GATE Q must not treat
show-on-`not_applicable` as a miss. A second hide token would require a wire producer flag and breaks
this feature’s backend freeze.

### 2.3 Placement boundary

One caption on the **pinned DecisionCard plan row**, immediately under the six plan fields
(`DecisionMetadata`), before the thesis lead. Not inside any risk-grid cell, `FigureClause`,
`GroundingNote` / `grounding-card-line`, or `rec-not-actionable`. Act affordances live on the card; a
trader can enter without opening analysis. **Drawer-only** of the only instance fails co-location.
**Dual attachment** (card + analysis both rendering `plan-fields-not-checked`) fails single-instance and
re-opens the line-budget cut that deferred this work. Analysis may re-state plan labels without a second
instance; `REASONING_PROSE_NOT_CHECKED` remains the only prose-scope caption in the drawer.

### 2.4 Failure modes + isolation

- **`NO_BACKEND_CHANGE` / empty `apps/api` diff.** Enforcement by construction: no Rust edits; FE reads
  tokens already on the envelope. Score / tier / `state_fingerprint` cannot move
  (`additive-keeps-score-byte-identical`).
- **`ai-asserted-numbers-are-traceable` (halo half).** Explicit scope caption blocks the remaining path
  by which “checked” is inferred onto unchecked plan fields without inventing a per-field mark.
- **`absent-is-not-none`.** Caption is not a not-a-number literal and must not reuse `—` / `not given` /
  `unavailable` / `unrecognized`. Field literals and the caption remain disjoint closed sets.
- **`digested-labels-not-raw-dump`.** No new per-field marker; no browser re-label from scalars; plan
  labels continue from `PLAN_FIELD_LABEL` only.
- **Scope boundary, never diagnosis.** Fixed string; no interpolation of which fields were bare; no
  “because strikes empty” branch.
- **SSE / live isolation.** Caption is static presentation of the pinned rec — no live derivation, no
  dim / `⏸` / blank on SSE drop (`live-vs-static-isolation`).
- **Stale / stale-born / superseded.** Caption stays with the pinned rec when the predicate holds;
  existing freshness strips own freshness — they do not remove or absorb the caption.
- **Sibling honesty lines.** Grounding card line, Class-A absence standing line, conditional
  not-actionable line, and `REASONING_PROSE_NOT_CHECKED` each own a different fact. This caption does
  not merge with any of them.

### 2.5 Not buildable / rejected approaches

- Gating show/hide on `key_source` / “keyless” (false mechanism; standing chrome or over-hide).
- Content-heuristic presence (stated plan field and/or risk clause required) — Options B/C; wrong lesson.
- Drawer-only placement of the only instance (unprotected act path; fails BRIEF observed-by).
- Dual card+drawer chrome (single-instance + line-budget failure).
- Per-field “not checked” chips / clauses / tints on the six plan slots.
- Extending grounding’s checked set or inventing a new wire producer flag under this feature.
- Merging into grounding / absence / not-actionable / prose-scope strings.
- New animation family or warning-amber chrome for permanent quiet scope.
- Recording §9.5 closed before ship-blocking ACs pass.

## 3. Acceptance criteria (with user stories)

Stories (condensed):

- **US-1** — As a trader reading a produced non-local_rules **trade** rec, I want a clear section-level
  statement that the plan fields are not checked, so I do not enter or size on a structure, strike,
  expiration, or trigger nobody verified.
- **US-2** — As a trader on the **local_rules** path, I want no permanent plan-scope banner, so the
  caption keeps its meaning and the always-on trade shape on that path does not look broken.
- **US-3** — As a trader on **no_trade** or non-rec states, I want no plan-scope caption, so honesty
  chrome only appears where there is a plan a reader could act on.
- **US-4** — As a trader looking at plan-field values on the primary act surface, I want the caption on
  that same DecisionCard plan row, so I never open analysis solely to learn the plan fields are unchecked.
- **US-5** — As a trader, I want existing grounding, absence, reserved-`—`, Accept, reasoning-prose,
  DTE-window, and score behavior unchanged.
- **US-6** — As the owner, I want §9.5 recorded closed only after this caption ships and its
  ship-blocking ACs pass.

**(SB)** = ship-blocking. `Verify by`: `test` where silent regression under an unrelated change is
plausible; `review` where the behavior is visible/intentional copy, placement, or process.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1 | On every produced **trade** recommendation whose plan section is mounted and whose `grounding.card` is **not** `local_rules`, the plan section shows **exactly one** section-level caption stating that the plan fields are not checked — independent of which plan fields are bare or stated, and independent of whether a risk/exit grounding clause rendered this cycle. | test |
| AC-1f | US-1 | **Primary review fixture (not a gate predicate):** an LLM-produced trade that shows at least one **stated** plan field among the six and at least one grounding clause on stop / target / invalidation still shows exactly that one caption (the wrong-trade story for human review). | review |
| AC-2 **(SB)** | US-2 | On a produced trade with `grounding.card === 'local_rules'` (including stated structure / entry trigger / confidence and empty or absent strikes/expiration, **regardless of `key_source`** — fixture must include a non-`none` key_source such as `shared_admin`), the plan-scope caption is **absent** — zero instances on the card and on any open analysis surface. Do not treat `key_source` alone as the exclusion. | test |
| AC-2r | US-2 | **Accept-show residual:** when `grounding.card === 'not_applicable'` on a trade plan row that mounts, the caption is **present** (closed hide set is affirmative `local_rules` only under `NO_BACKEND_CHANGE`). GATE Q does not treat this as a miss. | test |
| AC-3 **(SB)** | US-1, US-4 | For a single rec view that shows plan fields, the trader can see **at most one** plan-scope caption instance at a time (no per-row copies; no simultaneous duplicate on pinned card and analysis surface — including when analysis is open and re-states plan labels). | test |
| AC-4 **(SB)** | US-1 | The caption is a **scope-boundary** statement about the plan fields as a group: it does not name a per-rec reason a field is bare, does not attach a new marker/tint/clause/tooltip to any individual plan-field row, and does not change any plan-field value string. | review |
| AC-5 **(SB)** | US-3 | On a **no_trade** recommendation, the plan-scope caption is absent, and the reserved no-entry `—` treatment on plan rows is unchanged. | test |
| AC-6 | US-3 | In every non-rec panel state (loading, error, cooldown, daily cap, no key, signed-out, empty / not asked), the plan-scope caption is absent (no skeleton, ghost, or deferred mount). | review |
| AC-7 **(SB)** | US-4 | On a produced trade that shows the plan-scope caption, that caption is present on the **primary act surface** — the pinned plan row of the DecisionCard — so a reader never has to open analysis solely to learn the plan fields are unchecked. The analysis surface may re-state plan-field labels without a second plan-scope caption instance. Drawer-only placement of the only instance fails this criterion. | review |
| AC-8 | US-5 | While a rec is on screen and the live stream drops, the plan-scope caption (if present) and the six plan-field values stay exactly as they were; nothing flips to absent, offline-dim, or blank because of the drop. | test |
| AC-9 | US-5 | When the rec is marked stale by a newer bundle, the plan-scope caption and plan-field values are unchanged; only the existing as-of / stale treatment changes. | review |
| AC-10 | US-5 | On the same non-local_rules trade rec, stop / target / invalidation still show their existing grounding treatment, and the existing grounding card-level line (when present) still appears and is **textually distinct** from the plan-scope caption. | review |
| AC-11 | US-5 | On a rec that also shows the shipped reasoning-prose “not checked” caption, both captions are present when their sections are shown, **textually distinct**, and neither replaces the other. Analysis drawer gains no second `plan-fields-not-checked`. | review |
| AC-12 | US-5 | Absence treatment of the six plan fields (including Class-A standing line and Accept empty-with-reason when fields were never named) is unchanged from the pre-feature behavior for the same response. | review |
| AC-13 | US-5 | The DTE-window caption behavior is unchanged: both bounds still required for that caption; no new `?` value and no new containment claim is introduced by this feature. | review |
| AC-14 **(SB)** | US-5 | For the same request, `opportunity_score`, `opportunity_tier`, and `state_fingerprint` are byte-identical before and after this feature, and the feature diff does not change backend trading/recommendation computation (`apps/api` empty). | test |
| AC-15 **(SB)** | US-6 | No gate report, decision-ledger row, or BACKLOG line produced for this feature records §9.5 as closed **before** the ship-blocking ACs above pass. After they pass, such records **may** state §9.5 closed. | review |
| AC-16 | US-1 | Caption copy is exactly `PLAN_FIELDS_NOT_CHECKED` (names the six `PLAN_FIELD_LABEL` strings and the stop/target/invalidation allowlist) and does not use trust/accusation wording reserved elsewhere (verified / confirmed / hallucinated / safe / trusted as claims about the plan), matching the shipped reasoning-prose caption discipline. | review |
| AC-17 | US-1 | Caption chrome is quiet theme caption (`text.secondary`, block display); not inside a `clause-*` node, not inside `grounding-card-line`, not inside `rec-not-actionable`; zero hardcoded hex; no new animation family. | review |

<!-- spire:council-resolution:v1 17f09d160052911f391419b704af0a3cdb605c44bd4d027233f07c5916220c34 folded -->
<!-- spire:council-resolution:v1 bbcc2d1037f9aea66a88ab6d5e880c881049d69a666d52a65ecbc6f1c3eb3582 folded -->
<!-- spire:council-resolution:v1 4ed7da949ea9719621d3badc41291f3da9d9127f18fa00659ddc939f280b83c6 folded -->
<!-- spire:council-resolution:v1 7bfc6efd120f36df8b5b15121fdb4fdc67323c953a00596407618049ffede36a folded -->
<!-- spire:council-resolution:v1 98da122401b510fcb6dad5e67ebc8979489b950c9087f118725cc2c66df6e6f1 folded -->
<!-- spire:council-resolution:v1 577c6987c8f546853cbadfa907e45b08bc8a728d7ef79f1442ea5c902a85ccad folded -->

**Method notes (risk-based).**

- **`test` concentrates on silent wrong-trade regressions:** structural presence (AC-1), local_rules
  absence including non-`none` key_source (AC-2), `not_applicable` accept-show (AC-2r), single-instance
  (AC-3), `no_trade` non-appearance (AC-5), SSE isolation (AC-8), score/backend non-touch (AC-14).
- **`review` owns copy, co-location, and sibling honesty lines** (AC-1f/4/6/7/9–13/15–17): visible and
  intentional; brittle snapshots buy little. AC-15 is a process check on the written record, not UI.
- Prefer **one** integration/render check that covers AC-1 + AC-2 + AC-3 + AC-5 over four near-identical
  component pokes. DOM harness already ships for this card family.
- AC-1f documents the wrong-trade story for review; it is **not** the show predicate (D1).

**When §9.5 may be recorded closed**

| Gate | May record §9.5 closed? |
|---|---|
| Before this feature’s ship-blocking ACs pass | **No** — half two still stands |
| After AC-1, AC-2, AC-3, AC-5, AC-14 (and AC-15’s “before” half) pass on the shipped product | **Yes** — half two is closed |

## 4. UI + interaction

**Flows**

1. Trader has a produced **trade** rec on the DecisionCard (model path / any non-`local_rules` card token).
2. Under the six plan fields, one quiet caption states the plan fields are not checked; risk/exit clauses
   and grounding card line behave as today.
3. Trader may open Full analysis — analysis may re-state plan labels; no second plan-scope caption; prose
   scope caption remains only for long-form reasoning.
4. On `local_rules` trades, the plan row shows without this caption (no permanent banner).
5. On `no_trade` and non-rec states, no caption.

**Placement (locked):** immediately **under** `DecisionMetadata` (after the six plan fields), **before**
the thesis lead. `data-testid="plan-fields-not-checked"`. Not a tooltip. Not warning chrome.

<!-- spire:council-resolution:v1 2a12f654b72bf069afe7210a368b27f8c0f5dd51542704339057a851eafde05e folded -->

**Component states** — plan-scope caption only:

| Component | default (non-local_rules produced trade) | loading | empty | error / gated / no-key / BYO | offline / stale |
|---|---|---|---|---|---|
| Plan-scope caption (`plan-fields-not-checked`) | Exactly one quiet caption under plan row | Absent | Absent | Absent | Unchanged with pinned rec (stale strips do not remove it; SSE drop does not dim/blank it) |
| Same, `grounding.card === 'local_rules'` | Absent | — | — | — | — |
| Same, `no_trade` | Absent (no plan row) | — | — | — | — |
| Analysis surface | No second `plan-fields-not-checked`; `REASONING_PROSE_NOT_CHECKED` only | — | — | — | — |

**Copy (verbatim closed constant)**

```text
PLAN_FIELDS_NOT_CHECKED =
  "Structure, Strike(s), Expiration, Entry trigger, Time horizon and Confidence aren't checked — only the stop, target and invalidation level are."
```

Integrity:

| Clause | Vouched by |
| --- | --- |
| Names the six plan labels | `PLAN_FIELD_LABEL` (closed, already rendered) |
| “aren't checked” | Permanent scope: none of the six enters figure-grounding clauses / `counts.checked` |
| “only the stop, target and invalidation level are” | Shipped grounding allowlist + per-figure clauses on those three only |
| No spatial “above/below” | Layout can drift; name the allowlist, not the y-axis |
| No banned halo words | Avoids verified / confirmed / validated / approved / safe / trusted / grounding / hallucinated / suspect / invalid |
| Scope, not diagnosis | Does not say why a field is bare; does not name a producer |

**Chrome:** `Typography variant="caption"`, `color: 'text.secondary'`, `display: 'block'`. No
`WarningAmberIcon`, no `warning.*` alone (permanent quiet scope, not an alarm). No new keyframes
(`single-motion-moment`). Tokens only (`theme-token-discipline`).

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET` — The Curvature
Terminal).

**Design direction:** Reuse the shipped quiet honesty caption pattern already used for
`REASONING_PROSE_NOT_CHECKED` — one factual scope sentence under its section, theme secondary text, no
new component family, no new token, no new motion, no DESIGN_SYSTEM amendment required for this constant.
Amber/warning chrome is not spent; green/red untouched; no fourth convex arc.

## 5. Error handling

| Class | User-visible behavior |
| --- | --- |
| Missing `grounding` block on a produced trade plan row | Caption **shows** (exemption requires affirmative `card === 'local_rules'`; missing information is never an exemption) |
| `grounding.card === 'not_applicable'` on a mounted trade plan row | Caption **shows** (D4 accept-show residual) |
| `grounding.card === 'local_rules'` | Caption **absent** |
| Unrecognized `grounding.card` token | Treated as not `local_rules` → caption shows if plan section mounts (closed hide is affirmative only) |
| SSE / live-tape drop | Caption and plan values byte-identical; no offline dim on this static chrome |
| Request failure / loading / gated / no-key | No caption (DecisionCard produced plan row not mounted) |
| Incomplete trade (not-actionable line present) | Caption still shows when predicate holds; two distinct strings — never merged |
| Backend / score path | Unchanged; this feature never calls or mutates them |

No new logging, retry, or toast for this caption. No partial application: either the closed constant
renders once under the plan row or it does not render.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/rec-plan-scope-caption/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** Frontend-only (`NO_BACKEND_CHANGE`). Consumes the existing
`POST /api/recommendation/{ticker}` envelope already on the DecisionCard — discriminator
`grounding.card` (hide only when `=== 'local_rules'`), plus `strategy.decision` for the plan-section
mount. No new endpoint, field, or wire token. Authoritative consumption notes and the empty-backend
posture live in that file; this SPEC does not restate field lists.

## 7. Testing strategy

Risk-based — not one-test-per-AC theater.

**Automate (`test`):**

- Structural presence: produced trade + plan section + non-`local_rules` → exactly one
  `plan-fields-not-checked` with exact `PLAN_FIELDS_NOT_CHECKED` text (AC-1).
- Local_rules absence: fixture with `grounding.card === 'local_rules'` **and** non-`none` `key_source`
  → zero caption on card and with analysis open (AC-2).
- `not_applicable` accept-show residual (AC-2r).
- Single-instance with analysis open (AC-3).
- `no_trade` → absent (AC-5).
- SSE drop leaves caption + plan values unchanged (AC-8).
- Empty `apps/api` diff / no score path touch (AC-14) — structural or CI path check as the lane already
  uses for `NO_BACKEND_CHANGE` features.
- Prefer one focused DecisionCard/ai-rec DOM integration covering AC-1+AC-2+AC-3+AC-5.

**Review:**

- Copy integrity and banned-word scan (AC-16).
- Placement under plan row / not inside clause or grounding nodes (AC-7, AC-17).
- Sibling distinctness from grounding line and `REASONING_PROSE_NOT_CHECKED` (AC-10, AC-11).
- Absence / DTE / Accept unchanged (AC-12, AC-13).
- Process: §9.5 not closed early (AC-15).
- Primary wrong-trade fixture narrative (AC-1f).

**Harness:** existing jsdom DecisionCard / ai-rec suite — no new harness demanded. Integration tests mock
the network boundary only (fixtures supply rec envelopes).

**Invariants that must never silently regress:** local_rules exclusion on the closed card token (not
key_source); structural presence without content heuristics; single instance; no second analysis
instance; disjointness from absence literals and sibling honesty strings; empty backend diff.

## 8. Guardrails this feature must not break

From BRIEF invariant watch and standing build invariants:

- **`ai-asserted-numbers-are-traceable` (HARD — omission/halo half):** absent check must not render as a
  reserved literal of another state, and must not be inferable as “checked.” Caption is the remaining
  mechanism for the inference half on plan fields.
- **`absent-is-not-none`:** keep the six plan literals and the scope caption in disjoint closed sets.
- **`digested-labels-not-raw-dump`:** one section caption; no new per-field mark; no scalar→label
  re-derivation; closed `PLAN_FIELD_LABEL` only.
- **Scope boundary, never diagnosis:** fixed constant; no per-rec causal wording.
- **`theme-token-discipline`:** theme tokens only; zero hardcoded hex; dark/light parity.
- **`single-motion-moment`:** no new animation family, keyframe, or motion prop.
- **`additive-keeps-score-byte-identical`:** copy/render only; empty `apps/api` diff; score / tier /
  fingerprint byte-identical.
- **`live-vs-static-isolation`:** caption is static with the pinned rec; SSE drop does not degrade it.
- **`cited-code-is-verified-not-assumed`:** cite `DecisionCard.tsx`, `copy.ts`, `AnalysisSurface.tsx`,
  `reasoning.tsx`, and current recommendation/grounding paths — not Python-era `AiRecPanel` line numbers.
- **Card-level statement budget (carry-forward):** this caption is **section-level under the plan row**,
  not a third card-level merge into grounding + not-actionable lines (rec-absence-literals-hole §C #17/#23).
- **§9.5 record rule:** do not record half two closed until ship-blocking ACs pass.

## 9. Open questions

None. All seven R2 conflicts folded in `council/decisions.md` (D1–D4); no human product calls; no residual
product disagreement for the skeptic beyond the named **accept-show** residual on
`grounding.card === 'not_applicable'` (D4), which is settled behavior under `NO_BACKEND_CHANGE`, not an
open question.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"17f09d160052911f391419b704af0a3cdb605c44bd4d027233f07c5916220c34","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":1,"conflict_id":"7bfc6efd120f36df8b5b15121fdb4fdc67323c953a00596407618049ffede36a","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":0,"conflict_id":"bbcc2d1037f9aea66a88ab6d5e880c881049d69a666d52a65ecbc6f1c3eb3582","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":1,"conflict_id":"98da122401b510fcb6dad5e67ebc8979489b950c9087f118725cc2c66df6e6f1","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":0,"conflict_id":"4ed7da949ea9719621d3badc41291f3da9d9127f18fa00659ddc939f280b83c6","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":1,"conflict_id":"577c6987c8f546853cbadfa907e45b08bc8a728d7ef79f1442ea5c902a85ccad","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":2,"conflict_id":"2a12f654b72bf069afe7210a368b27f8c0f5dd51542704339057a851eafde05e","disposition":"folded","section":"§4"}]}
-->
