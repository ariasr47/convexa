# S2 — skeptic findings: archive-coverage-guardrails

## Critical  (blocks — must loop back to R4)
- None found after checking all ten R2 conflict IDs against the folded markers and `council/decisions.md`.

## Important  (should fix)
- None found. R4 pass 2 fully specifies the unavailable shape: a computed range is retained, `books=[]`, all six counts are null, per-symbol last-readable values are null, and no completeness claim is made; range endpoints are null only when range computation failed before producing a range. — evidence: `SPEC.md:AC-9`, `SPEC.md:§5 Error handling`; `INTERFACE_CONTRACT.md:Success` fields `range`, `books[]`, `counts`, and `unavailable` semantics.

## Minor / advisory
- None found.

## Checked and clean
- Dropped conflicts: all 10 conflict IDs in `council/conflicts.json` are represented by folded `spire:council-resolution` markers in `SPEC.md` and settled in `council/decisions.md`.
- Prior-finding closure: verified `metrics_auth` is absent from the conformance required response fields; the calendar now names artifact path, ID, schema/version, domain, vocabulary, observance tokens, and out-of-domain behavior; AC-7 names the exact same-date audit command; AC-9 and the interface contract close the unavailable-shape issue.
- Unobservable acceptance criteria: checked AC-1 through AC-23; each has a test or review verification method and externally observable outcome.
- Unspecified component states: checked §4 default/current, loading, empty/not-due, error, and stale behavior for metrics, audit, and warnings; no missing required browser state because this is `NO_UI_CHANGE`.
- Interface/data-flow alignment: checked §2.2–§2.5 against `INTERFACE_CONTRACT.md`; `metrics_auth` and the unavailable range/matrix/counts issue are closed, and coverage status/count/nullability, token denial, and additive response shape align.
- Internal contradictions: checked §1–§9, including checkpoint, bounded window, zero-expected audit, warning deduplication, stale/unavailable semantics, and startup behavior; none found.
- Guardrails: checked all §8 rules, including operator/trader separation, production fail-closed behavior, scoring isolation, zero-vendor/read-only inspection, security redaction, and no UI/subscription expansion; no direct breach found.
