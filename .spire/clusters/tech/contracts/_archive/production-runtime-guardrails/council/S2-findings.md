# S2 — skeptic findings: production-runtime-guardrails

## Critical  (blocks — must loop back to R4)
- None. All eight R2 conflicts remain folded into the repaired specification and folding manifest; no Critical finding remains and no R4 loop is required — evidence: `SPEC.md:2 Architecture`, `SPEC.md:9 Open questions`, `SPEC.md:council-folding:v1`.

## Important  (should fix)
- None. The previous one-startup-owner gap is closed: AC26 is explicitly `review`, and the transport receipt now requires a release-bound `migration_startup_owner` with replica count, complete target-release startup-id set, ordered schema/listener timestamps, operator/platform/configuration evidence, and ship-blocking failure on missing or duplicate startup evidence — evidence: `SPEC.md:3` AC26; `SPEC.md:7 Testing strategy`; `INTERFACE_CONTRACT.md:Required verification receipts`.

## Minor / advisory
- None. AC7 is now honestly classified as `review`, while §7 explicitly marks AC7 and AC26 as unavailable in local-only runs and requires deployment-operator evidence plus QA review before PASS — evidence: `SPEC.md:3` AC7/AC26; `SPEC.md:7 Testing strategy`; `INTERFACE_CONTRACT.md:Required verification receipts`.

## Checked and clean
- Dropped conflicts: checked all 2 R2 architect, 3 R2 PM, and 3 R2 UX conflicts against the folding manifest; all are folded.
- Unobservable acceptance criteria: rechecked all 26 ACs; deployment-only AC7/AC26 are explicitly review-gated with named receipts and owners rather than mislabeled as executable local tests.
- Unspecified component states: rechecked §4 default/loading/empty/error/offline-stale rows; no named process-output state lacks behavior.
- Interface mismatch: rechecked §2 data flow against endpoint fields, health semantics, CORS/cookie policy, and transport/volume receipts; no mismatch found.
- Internal contradiction: rechecked §§1–9; archive durability, health semantics, current-migration scope, one-owner evidence, CORS inventory, and verification classifications agree.
- Guardrail breach: checked all seven §8 invariants; no direct breach found. No implementation or runtime files were changed.
