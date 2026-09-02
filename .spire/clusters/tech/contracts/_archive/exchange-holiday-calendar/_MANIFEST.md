# exchange-holiday-calendar — pipeline manifest
Stage:        GATE S — SHIPPED + ARCHIVED
Repos:        both (backend primary; frontend occupancy copy on existing coverage card)
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked APPROVED 2026-08-31
  - INTERFACE_CONTRACT.md      locked APPROVED 2026-08-31 — occupancy/session clocks; no /api/holidays
  - PLAN.md                    locked 2026-08-31 — B.domain Independent:yes first; FE all-no
Open amendments: none
QA (GATE Q):  PASS — 30 PASS / 0 FAIL / 0 UNVERIFIABLE
Workers:      backend=[JOINED] closer=B.closer JOINED; frontend=[JOINED] closer=F.closer JOINED
Last gateway:  GATE S @ 2026-08-31 — archived after GATE Q PASS 30/0/0; re-pin JSON promoted
