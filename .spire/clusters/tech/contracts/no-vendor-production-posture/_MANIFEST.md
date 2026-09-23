# no-vendor-production-posture — pipeline manifest
Stage:        SPEC approved-by-plan 2026-09-23 (owner plan A: step 1 prod WARM_ENABLED=0 applied; step 2 build; step 3 prod MARKET_DATA_MODE=paused after merge)
Repos:        both (backend B1–B6, then frontend F1–F4)
Brief:        n/a — BACKLOG "Parked — 2026-09-22" `no-vendor-production-posture` + carry `api-boot-dials-vendor-without-warm`
Contracts:
  - SPEC.md                    conductor-authored (council skipped by design: one switch, one state); mock docs/mockups/2026-09-23-market-data-paused.html
  - INTERFACE_CONTRACT.md      folded into SPEC §2 B2–B5 (503 paused body, health `market_data`, scan `market_data`, AppErrorBody.code)
Open amendments: none
QA (GATE Q):  pending
Last gateway:  SPEC @ 2026-09-23 → backend lane
