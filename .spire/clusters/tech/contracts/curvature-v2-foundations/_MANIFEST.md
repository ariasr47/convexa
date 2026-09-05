# curvature-v2-foundations — pipeline manifest
Stage:        GATE S — closed 2026-09-03 (phase 1 of 4 of the Curvature Terminal v2 build)
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked — 886 lines, 81 acceptance criteria (30 ship-blocking); AC-13b amended by owner ruling 8; AC-20b honestly UNVERIFIABLE
  - INTERFACE_CONTRACT.md      locked — NO_BACKEND_CHANGE + a Conformance spec block; QA's independent run PASSED live, 2/2 endpoints, 22 required fields
Open amendments: none. Five canon Amendments filed at close (rule 13 conditional clause, rule 18 chip-scoped + wordless placeholder, rule 24 → nine members, `steel2` light floor, data-signal class predicate enforced). One §9 item stays open for the owner: the undeclared `tooltip` z-rung.
QA (GATE Q):  QA_REPORT PASS on the re-run — 79 PASS / 1 FAIL / 1 UNVERIFIABLE over 81 rows. First pass FAILed 72/8/1 and bounced; both reports preserved.
Workers:      council R1×3, R2×3, R3×3, R4 synthesizer (2 passes), S2 skeptic, scribe (spec edits); planner; frontend lane (build), frontend lane (GATE Z bounce fix), frontend lane (steel2 floor), frontend lane (proof cleanup); QA ×2
Last gateway:  GATE S @ 2026-09-03

## Gate trail
- GATE I @ 2026-09-03 — brief + cull recorded; backlog harvest written.
- Baseline @ 2026-09-03 — 127 tests / 17 files green, typecheck clean, e2e honestly NOT run.
- GATE C @ 2026-09-03 — 32 quote-verified conflicts; 9 self-revisions; 13 technical settled voice-to-voice, zero promotions;
  6 owner rulings; S2 0 Critical / 6 Important / 3 Minor, all repaired; `contract_lint` 0 errors.
- GATE PLAN @ 2026-09-03 — 12 tasks, 13 verification commands, 7 mutation proofs; independence all-`no` with stated grounds;
  backend track verification-only (empty diff).
- BUILD @ 2026-09-03 — 4 browser-only defects found and fixed; the e2e `testMatch` allowlist trap cleared with a `--list` proof.
- GATE Q #1 @ 2026-09-03 — **FAIL** 72/8/1. A fully green suite over a broken `[live-vs-static-isolation]`: two predicates
  answered "is this live?", and the census test that would have caught it had never been written.
- GATE Z @ 2026-09-03 — fixed at the cause: one predicate, one home, two consumers; census written (fails 7/13 pre-fix);
  motion class predicate encoded with a real-source mutation proof; the fabricated age removed at its source.
- GATE Q #2 @ 2026-09-03 — **PASS** 79/1/1, verified by mutation in an isolated copy outside the repo. Rejected two vacuous
  "MUTATION PROOF" tests; both replaced or deleted. Rulings 7 and 8 issued and applied.
- GATE S @ 2026-09-03 — 6 commits on `spire/curvature-v2-foundations`, not pushed. Canon amended, ledger and IN_FLIGHT updated.

## Final measurements (conductor's own runs, not the lanes')
typecheck 0 · dashboard suite 0 @ 215 files / 2376 tests · lint 0 · e2e 0 @ 75/75 against the production build ·
`verify-tokens` 0 · `apps/api` diff 0 lines · `contract_lint` 0 errors · all 32 conflict ids re-derive from the live R2 bytes.

## Owed to phase 2 (carried, not lost)
The `LiveTape` last-non-null retention latch and its no-re-flash test (ruling 2); `verify-tokens.mjs`'s structured checks
cover only the 10 v1 tokens, not the 7 v2 additions; the spacing exemption list's burn-down; the itemized 44px carried debt
in `BUILD_REPORT.md` §4; the `tooltip` z-rung.
