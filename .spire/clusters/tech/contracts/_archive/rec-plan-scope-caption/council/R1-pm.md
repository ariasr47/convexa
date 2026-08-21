# R1 — pm position: rec-plan-scope-caption

## Position

### 0. The product problem in one sentence

A trader can read a produced **trade** recommendation where stop / target / invalidation carry
**checked** grounding clauses, while plan fields — `Structure`, `Strike(s)`, `Expiration`,
`Entry trigger`, `Time horizon`, `Confidence` — sit beside them as bare stated values. Nothing on
the surface says those plan fields were never checked. The natural inference is *"no clause means
checked."* That inference is a **wrong trade**: the same failure class as the last two AI-grounding
ships (asserted numbers, then omitted numbers). Half one of §9.5 (false not-applicability on
absent fields) already shipped. **This feature is half two, and only half two.**

---

### 1. What ships

**One section-level caption** co-located with the plan fields, stating a permanent **scope
boundary**: those plan fields are not checked. It is the surviving half of `ai-rec-grounding`
SPEC §9.5. Pattern already approved and shipped for the same class of problem: the reasoning-prose
caption that sits with the reasoning and says numbers written out there are not checked.

This is a **scope statement**, not a diagnosis. It does not explain why a given field is bare, does
not add a per-field marker / tint / clause / tooltip on any of the six, and does not re-derive a
label from a scalar. The closed plan-field vocabulary stays closed; the caption points at that set
as a whole.

---

### 2. Scope

#### In

1. **One** section-level plan-scope caption on the AI recommendation surface the trader already uses
   (the decision card and/or the analysis surface that holds the long form after
   `ai-rec-decision-card` — placement is a presentation call; product binds **co-location**, not
   pixels).
2. **Path rule (ship-blocking):** the caption appears on **LLM-produced trade** recommendations. It
   must **not** become standing chrome on the **local-rules / keyless** path — that path still emits
   a trade with stated structure / trigger / confidence whenever a setup exists, so an always-on
   banner there is permanent noise and was the exact condition that cut this caption on line-budget
   last time.
3. **Co-location rule (ship-blocking):** when a trader is looking at a stated plan-field value, the
   caption is on the **same surface/section** as those values — not only on a surface the trader
   never opens. Exactly **one** instance is visible for a given rec view (no duplicate on card *and*
   drawer, no per-row repeats).
4. **§9.5 record rule (ship-blocking, process):** after this feature ships and its ship-blocking ACs
   pass, gate reports / ledger rows / BACKLOG lines **may** record §9.5 closed. **Until then they
   must not.** Closing half two is the only remaining condition.
5. Frontend-only expected (`NO_BACKEND_CHANGE`). Score / tier / fingerprint stay byte-identical.

#### Out

1. **No re-open of the DTE-window `?` / containment caption.** That seam is already closed; wording
   is a property of the request, not a containment claim. Not this feature.
2. **No per-field grounding markers** on the six plan fields. They stay outside the checked set.
3. **No change** to stop / target / invalidation grounding clauses, counts, or card-level grounding
   line.
4. **No change** to absence literals, the Class-A standing line, Accept empty-with-reason, or the
   reserved no-entry `—` on `no_trade` — all shipped by `rec-absence-literals-hole` and stay.
5. **No change** to the shipped reasoning-prose caption (sibling scope boundary; remains distinct).
6. **No prompt change** to make the model emit or ground plan fields. This caption must work when
   the model states unchecked plan content anyway.
7. **No backend / wire change** required for path discrimination if the rec already carries enough
   to tell LLM-produced from local-rules (BRIEF says it does). If it does not, that is an R2
   conflict — do not silently drop the local-rules exclusion.
8. **No export/egress widening**, no score change, no new animation, no new palette role.
9. **Not** Positions / reassessment surfaces. Entry recs only.
10. **Not** user-research instrumentation of whether readers still over-generalize after ship.

#### Future-dated (named so they are not absorbed)

- Measuring whether the caption actually reduces the "no clause = checked" inference with real
  readers (the residual was "reviewed but never measured").
- Extending the same scope-boundary treatment to reassessment recs, if those surfaces ever present
  the same plan fields beside checked risk numbers.
- Any work that would *actually check* plan fields against computed state (a different product; this
  feature only states that they are not checked today).

---

### 3. Product behavior

| Situation | What the trader sees |
|---|---|
| **LLM-produced `trade` rec**, plan fields section visible | Exactly **one** section-level caption with the plan fields, stating those plan fields are not checked. Checked risk/exit fields keep their grounding treatment unchanged. |
| **Local-rules / keyless `trade` rec** (stated structure/trigger/confidence common) | **No** plan-scope caption. Existing local-rules / no-AI honesty treatment (if any) is unchanged. The caption must not become a permanent banner on this path. |
| **`no_trade` rec** | **No** plan-scope caption. Plan rows keep the reserved no-entry treatment. |
| **Non-rec states** (loading, error, cooldown, daily cap, no key, signed-out, empty) | **No** plan-scope caption. Those states keep their current copy. |
| **Live stream drops** while a rec is on screen | Caption stays with the pinned rec content. No flip to absent, no offline dim on the caption alone. |
| **Rec goes stale** (newer bundle) | Caption stays with the pinned rec; only existing as-of / stale treatment changes. |
| **Card already carries other honesty lines** (grounding card line, absence standing line, reasoning-prose caption) | Plan-scope caption is **visibly distinct** from each; it does not merge facts, does not restate them, and does not replace them. |

**What the caption is allowed to assert (product, not copy):**

- Scope boundary only: the plan fields are not checked (by design, for this rec surface).
- May name or clearly point at the closed set of six plan fields as a group.
- May contrast with the fields that *are* checked (stop / target / invalidation), the same way the
  reasoning-prose caption contrasts prose numbers with the checked levels — without accusing the
  model, without banned trust words, and without inventing a new per-field state.

**What the caption must not assert:**

- That a particular field is missing, wrong, or fabricated on *this* rec (that is the absence /
  standing-line lane, already shipped).
- That the plan is safe, verified, untrusted, or hallucinated.
- Anything about DTE-window containment or request bounds.

**Placement (product constraint only):** co-located with the plan fields the trader reads. Whether
that is the pinned plan row, the analysis drawer/sheet, or both-with-a-single-visible-instance is
UX's call under the co-location and single-instance rules above. I am not laying out the card.

---

### 4. User stories

- **US-1** — As a trader reading an LLM-produced **trade** rec where risk/exit figures look checked
  and plan fields are stated, I want a clear section-level statement that those plan fields are not
  checked, **so that** I do not enter or size on a structure, strike, expiration, or trigger nobody
  verified.
- **US-2** — As a trader (or as CI/demo) on the **local-rules / keyless** path, I want **no**
  permanent plan-scope banner, **so that** the caption keeps its meaning and the always-on trade
  shape on that path does not look broken.
- **US-3** — As a trader reading a **no_trade** or non-rec state, I want no plan-scope caption,
  **so that** honesty chrome only appears where there is a plan a reader could act on.
- **US-4** — As a trader looking at plan-field values, I want the caption on the **same surface** as
  those values, **so that** the scope boundary is visible at the moment of the wrong-trade risk.
- **US-5** — As a trader, I want existing grounding, absence, reserved-`—`, Accept, and
  reasoning-prose behavior unchanged, **so that** this ship adds one missing boundary rather than
  reopening closed honesty work.
- **US-6** — As the owner, I want §9.5 recorded closed **only after** this caption ships,
  **so that** reports cannot claim the residual is gone while half two still stands.

---

### 5. Acceptance criteria

Every row is one observable outcome a stranger can check without reading source. **(SB)** =
ship-blocking. `Verify by` is risk-based: `test` where silent regression under an unrelated change
is plausible; `review` where the behavior is visible/intentional copy or process. Never
one-test-per-AC theater.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1 | On an **LLM-produced trade** recommendation that shows at least one **stated** plan field among the six and at least one grounding clause on stop / target / invalidation, the plan section shows **exactly one** section-level caption stating that the plan fields are not checked. | test |
| AC-2 **(SB)** | US-2 | On a **local-rules / keyless trade** recommendation (including one with stated structure / entry trigger / confidence and empty or absent strikes/expiration), the plan-scope caption is **absent** — zero instances on the card and on any open analysis surface. | test |
| AC-3 **(SB)** | US-1, US-4 | For a single rec view that shows plan fields, the trader can see **at most one** plan-scope caption instance at a time (no per-row copies; no simultaneous duplicate on pinned surface and analysis surface). | test |
| AC-4 **(SB)** | US-1 | The caption is a **scope-boundary** statement about the plan fields as a group: it does not name a per-rec reason a field is bare, does not attach a new marker/tint/clause/tooltip to any individual plan-field row, and does not change any plan-field value string. | review |
| AC-5 **(SB)** | US-3 | On a **no_trade** recommendation, the plan-scope caption is absent, and the reserved no-entry `—` treatment on plan rows is unchanged. | test |
| AC-6 | US-3 | In every non-rec panel state (loading, error, cooldown, daily cap, no key, signed-out, empty / not asked), the plan-scope caption is absent. | review |
| AC-7 | US-4 | When plan-field values are visible to the trader, the caption is present on that same surface/section (a reader does not have to open a second surface solely to learn the plan fields are unchecked). | review |
| AC-8 | US-5 | While a rec is on screen and the live stream drops, the plan-scope caption (if present) and the six plan-field values stay exactly as they were; nothing flips to absent, offline-dim, or blank because of the drop. | test |
| AC-9 | US-5 | When the rec is marked stale by a newer bundle, the plan-scope caption and plan-field values are unchanged; only the existing as-of / stale treatment changes. | review |
| AC-10 | US-5 | On the same LLM trade rec, stop / target / invalidation still show their existing grounding treatment, and the existing grounding card-level line (when present) still appears and is **textually distinct** from the plan-scope caption. | review |
| AC-11 | US-5 | On a rec that also shows the shipped reasoning-prose "not checked" caption, both captions are present when their sections are shown, **textually distinct**, and neither replaces the other. | review |
| AC-12 | US-5 | Absence treatment of the six plan fields (including Class-A standing line and Accept empty-with-reason when fields were never named) is unchanged from the pre-feature behavior for the same response. | review |
| AC-13 | US-5 | The DTE-window caption behavior is unchanged: both bounds still required for that caption; no new `?` value and no new containment claim is introduced by this feature. | review |
| AC-14 **(SB)** | US-5 | For the same request, `opportunity_score`, `opportunity_tier`, and `state_fingerprint` are byte-identical before and after this feature, and the feature diff does not change backend trading/recommendation computation. | test |
| AC-15 **(SB)** | US-6 | No gate report, decision-ledger row, or BACKLOG line produced for this feature records §9.5 as closed **before** the ship-blocking ACs above pass. After they pass, such records **may** state §9.5 closed. | review |
| AC-16 | US-1 | Caption copy does not use trust/accusation wording reserved elsewhere (e.g. verified / confirmed / hallucinated / safe / trusted as claims about the plan), matching the shipped reasoning-prose caption discipline. Exact wording is UX. | review |

**Method notes (risk-based).**

- **`test` concentrates on silent wrong-trade regressions:** presence on the LLM trade fixture
  (AC-1), **absence** on local-rules (AC-2 — the always-on path that would make this standing chrome),
  single-instance (AC-3), `no_trade` non-appearance (AC-5), SSE isolation (AC-8), and score/backend
  non-touch (AC-14). Those can die under a refactor while the card still "looks fine" in a casual
  pass.
- **`review` owns copy, co-location, and sibling honesty lines** (AC-4/6/7/9–13/15/16): visible and
  intentional; brittle snapshots buy little. AC-15 is a process check on the written record, not UI.
- Prefer **one** integration/render check that covers AC-1+AC-2+AC-3+AC-5 over four near-identical
  component pokes. DOM harness already ships for this card family; no new harness is demanded by
  these rows.
- AC-7 is `review` because "same surface" is a product co-location judgment, not a pure function —
  but it is ship-relevant: a caption only inside an unopened drawer fails US-4 even if AC-1's string
  exists in the tree.

---

### 6. When §9.5 may be recorded closed

| Gate | May record §9.5 closed? |
|---|---|
| Before this feature's ship-blocking ACs pass | **No** — half two still stands. |
| After AC-1, AC-2, AC-3, AC-5, AC-14 (and AC-15's "before" half) pass on the shipped product | **Yes** — half two is closed; the residual named in OPEN_THREADS §7af / §7ah is done. |

This is not optional bookkeeping. Claiming §9.5 closed without the caption is the same class of
false closure the residual was invented to prevent.

---

## Risks I see

1. **Local-rules standing chrome returns under a wrong path predicate.** If the caption keys only on
   "trade + stated plan field," it fires on every local-rules trade — the condition that killed this
   caption last council. AC-2 is the whole design constraint; if path discrimination is not already
   available to the frontend, that is a technical conflict, not a reason to drop the exclusion.
2. **Caption only in the analysis drawer while plan values stay on the card (or the reverse).** Then
   the scope boundary is true in the tree and false in the trader's eye. Co-location (AC-7) is the
   product fix; layout is UX, but "must open analysis to learn plan fields are unchecked" is a
   product fail.
3. **Honesty wall.** The card already carries grounding clauses, a grounding card line, an absence
   standing line, and a reasoning-prose caption. One more line is correct and still easy to stop
   reading. Mitigation: exactly one plan-scope caption, scope-boundary tone (not alarm), and no
   merge with grounding or absence facts — merging would invent a causal link none of them own.
4. **Softening into a diagnosis.** "These fields look incomplete on this rec" is the wrong product.
   The residual is structural: even fully stated plan fields are unchecked. Diagnosis language
   re-opens the absence feature and fails when every plan field is filled.
5. **False §9.5 closure in planning surfaces.** Pressure to tidy OPEN_THREADS / BACKLOG after GATE I
   can record §9.5 closed before the caption exists. AC-15 exists so that is a failed check, not a
   shrug.
6. **Re-opening closed DTE work** under "while we're in the caption file." Named OUT; do not absorb.
7. **Scope creep into actually checking plan fields.** Valuable later; different feature; would need
   backend math and a new grounding class. This ship only states the boundary honestly.
8. **Treating `no_trade` or empty panel as a place for the caption.** That trains the eye to ignore
   it. AC-5 and AC-6 hold the negative space.

---

## Assumptions I'm making about the other two lanes

**About the technical shape (architect):**

- The frontend can already distinguish an **LLM-produced** recommendation from a **local-rules /
  keyless** one using information on the rec the card already has — **without** a new endpoint,
  field, or backend change. AC-2 depends on this; if false, raise it as a conflict rather than
  shipping an always-on caption.
- Plan-field values the trader reads are available on a single known surface family (decision card
  and/or analysis drawer) so co-location does not require a new data fetch.
- Showing or hiding this caption is a pure presentation decision from already-fetched rec state; it
  does not recompute score, tier, fingerprint, or any bundle field.
- SSE drop isolation for static rec content still holds; attaching a caption does not couple the
  plan section to live-derived degradation.
- The frontend test setup for this card family can assert presence/absence of a named caption
  region in DOM tests today (as it does for the reasoning-prose caption), so my `test` marks on
  AC-1/2/3/5/8 are achievable without adding a new harness.
- `NO_BACKEND_CHANGE` remains true: empty feature diff under the backend tree for trading and
  recommendation computation.

**About the presentation (ux):**

- Exact caption wording is UX's lane and will follow the shipped reasoning-prose idiom: one factual
  scope sentence, no banned trust/accusation words, disjoint from grounding and absence copy.
- UX can place **exactly one** caption co-located with the plan fields without merging it into the
  grounding card line or the absence standing line, and without a new animation or palette role.
- Whether the long-form plan lives on the pinned card, in the analysis drawer/sheet, or both, UX
  will keep the caption on the surface where the trader actually reads the plan values (AC-7), not
  only in an unopened region.
- The six plan-field rows keep their current value presentation; the caption is section-level, not a
  seventh row of per-field chrome.
- Dark/light parity and theme tokens cover the caption without hardcoded hex
  (`theme-token-discipline`).
