# browser-quality-gates — pipeline manifest
Stage:        GATE Z — clean immutable feature revision required for authorized candidates
Repos:        frontend plus repository/CI tooling; NO_BACKEND_CHANGE; narrow UI accessibility repair authorized by D7
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked — 45 observable acceptance criteria after D7/D8
  - INTERFACE_CONTRACT.md      locked — NO_BACKEND_CHANGE; empty machine-checkable endpoint set
  - PLAN.md                    locked — 0 backend tasks; F0–F9D plus receipt-bound F10 frontend track
Open amendments: none — D8 folded into SPEC/INTERFACE/PLAN
QA (GATE Q):  not started
Plan:         15 frontend/tooling tasks, all Independent:no; F10 frontend closer; 45/45 AC mapping
Workers:      frontend F0–F9D complete and green; F10 authorization valid; updater correctly refused dirty source; backend n/a
Council review: 16 conflicts folded; D1–D6 ruled A; D7/D8 owner-authorized execution amendments; S2 pass 2 has 0 Critical
Last gateway:  GATE Z @ 2026-08-23 — candidate update requires a scoped local commit/clean revision
