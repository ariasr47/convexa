# curvature-v2-foundations — pipeline manifest
Stage:        GATE C — spec approved by the owner 2026-09-03 (phase 1 of 4 of the Curvature Terminal v2 build)
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked (872 lines, 52 acceptance criteria, 30 ship-blocking; 3 marked UNVERIFIABLE by design)
  - INTERFACE_CONTRACT.md      locked — NO_BACKEND_CHANGE + a Conformance spec block pinning the read fields the honesty rules depend on
Open amendments: none contested. Three canon Amendments are OWED at close (owner rulings 2/3 and the rule-18 reading); two §9 questions await an owner ruling (steel2 light-mode contrast floor; the undeclared `tooltip` z-rung). Neither blocks the build.
QA (GATE Q):  n/a
Workers:      council: R1 x3, R2 x3, R3 x3, R4 synthesizer (2 passes), S2 skeptic, scribe (Edit-capable, applied the pass-2 repairs)
Last gateway:  GATE C @ 2026-09-03

## Gate trail
- GATE I @ 2026-09-03 — brief + cull recorded (`BRIEF.md` `Considered:`), backlog harvest written.
- Baseline @ 2026-09-03 — `_baseline-2026-09-03.md`: 127 tests / 17 files green, typecheck clean, e2e honestly NOT run.
- GATE C @ 2026-09-03 — 32 conflicts all quote-verified; 9 self-revisions folded; 13 technical settled voice-to-voice
  with zero promotions; 6 owner rulings in `council/decisions.md`; S2 returned 0 Critical / 6 Important / 3 Minor,
  all repaired; `contract_lint` 0 errors; all 32 conflict ids independently re-derived from the live R2 bytes.
