# rec-plan-scope-caption — interface contract

**Spec:** `.spire/clusters/tech/contracts/rec-plan-scope-caption/SPEC.md` (§6 points here)
**Frontend:** `apps/dashboard` — `pages/ticker/widgets/ai-rec/`
**Status:** draft

## Posture: `NO_BACKEND_CHANGE`

This feature is **frontend-only**. It introduces **no** new endpoint, route, request field, response
field, field-presence rule, status token, stream event, persistence shape, AI prompt, grounding rule,
cap rule, score input, tier, gate, or fingerprint behavior. The `apps/api` diff for this feature must
be **empty**.

`additive-keeps-score-byte-identical` holds by construction: a pure client-side caption cannot reach
`signals` / score / tier / `state_fingerprint`, and the backend cannot observe this feature shipped.

**No live conformance block is invented here.** This feature does not own a new or changed backend
surface for `interface_conformance.mjs` to pin. Existing recommendation endpoints retain their
already-verified contracts (authoritative field lists live on the grounding / absence feature
contracts that introduced them). If any executioner discovers a backend change is actually needed,
that is a GATE Z bounce — it must not be introduced silently.

---

## Existing payload this UI already consumes (unchanged)

The DecisionCard already reads the produced recommendation envelope from
`POST /api/recommendation/{ticker}` (session required; auth outermost). This feature **adds no bytes**
to that envelope. It only **reads** fields already present:

| Path (existing) | Role for this feature |
| --- | --- |
| `strategy.decision` | Plan section mounts only for `trade`; caption rides that gate |
| `grounding.card` | **Discriminator.** Hide caption when `=== 'local_rules'`. Any other value (including missing `grounding`, missing `card`, or `not_applicable`) does **not** hide |
| `key_source` | **Not** a hide/show input. Payment provenance only; may be non-`none` on local_rules envelopes |
| Plan field values + `field_reasons.*` for the six plan keys | Unchanged render via existing `planFieldLiteral` / `PLAN_FIELD_LABEL`; caption does not rewrite them |
| Risk/exit grounding figures (stop / target / invalidation) | Unchanged clauses; caption is not a fourth clause |

**Closed hide set (FE-only rule over existing wire):** affirmative `grounding.card === 'local_rules'`
only. `grounding.card === 'not_applicable'` is an **accept-show residual** under this freeze (SPEC
AC-2r / D4) — not a second hide token and not a new wire member.

**Endpoints touched:** none new. No request body change. No SSE field. No export/egress change.

| Endpoint / channel | Consumed? | Change |
| --- | --- | --- |
| `POST /api/recommendation/{ticker}` | Yes — existing pinned rec body | Unchanged |
| `GET /api/recommendation/status`, export helpers | Unrelated | Unchanged |
| SSE live stream | No (caption is static with pinned rec) | Unchanged |
| Bundle / score / contract routes | No | Unchanged |

---

## Conformance spec

**None required for this feature.** Per the `NO_BACKEND_CHANGE` posture there is no new or changed
backend surface to machine-check, so **no live `endpoints` JSON block is emitted**. Correctness of
show/hide and copy is verified by the frontend test suite named in SPEC §7 against fixtures of the
**existing** rec payload (`grounding.card` as discriminator). Standing interface conformance of the
unchanged recommendation endpoint remains owned by the contracts that last extended it
(`ai-rec-grounding` / `rec-absence-literals-hole`), not by inventing a second live pin here.
