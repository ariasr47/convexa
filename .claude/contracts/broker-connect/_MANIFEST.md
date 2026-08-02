# broker-connect — pipeline manifest
Stage:        GATE C — council COMPLETE (R1–R4 + S2 loop 1 + verification: ALL FIXED); awaiting OWNER SPEC APPROVAL → GATE PLAN
Repos:        both
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    draft (synthesized + S2-amended; locks on owner approval)
  - INTERFACE_CONTRACT.md      draft (locks on owner approval; conformance block S2-verified)
Open amendments: none
QA (GATE Q):  n/a
Last gateway:  GATE C @ 2026-08-01
Notes:        Owner HOLDS approved Webull Individual API keys (payload capture = build task #1; per-user
              credential via Settings, NEVER env). Council record: conflicts.json (7 entries) ·
              decisions.md (incl. owner P/L ruling B-dynamic, C-1 two-axis controller ruling, owner's
              cross-account-isolation AC-23) · S2-findings.md (16 findings; verification pass ALL FIXED).
              system-6 red-team scope fenced in SPEC; fires during build/QA.
