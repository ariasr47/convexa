# broker-connect — pipeline manifest
Stage:        GATE S — SHIPPED + ARCHIVED 2026-08-05 (QA_REPORT PASS after one GATE Z security cycle; live-verified by the owner against their real Webull book — 13 positions, every net-entry figure arithmetically confirmed)
Repos:        both
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked (owner-approved 2026-08-01)
  - INTERFACE_CONTRACT.md      locked (owner-approved 2026-08-01; changes henceforth = GATE Z amendments)
Open amendments: none
QA (GATE Q):  QA_REPORT PASS (re-run) — 22 PASS · 0 FAIL · 2 UNVERIFIABLE-by-QA-role (AC-2 fetch-succeeds + AC-6a review arm), BOTH since closed by the owner's live connect 2026-08-05
Last gateway:  GATE S @ 2026-08-05
Notes:        Owner HOLDS approved Webull Individual API keys (payload capture = build task #1; per-user
              credential via Settings, NEVER env). Council record: conflicts.json (7 entries) ·
              decisions.md (incl. owner P/L ruling B-dynamic, C-1 two-axis controller ruling, owner's
              cross-account-isolation AC-23) · S2-findings.md (16 findings; verification pass ALL FIXED).
              system-6 red-team scope fenced in SPEC; fires during build/QA.
