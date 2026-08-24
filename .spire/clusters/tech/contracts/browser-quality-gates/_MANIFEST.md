# browser-quality-gates — pipeline manifest
Stage:        GATE Z — GATE Q failed; frontend/tooling repairs required before fresh QA
Repos:        frontend plus repository/CI tooling; NO_BACKEND_CHANGE; narrow UI accessibility repair authorized by D7
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked — 45 observable acceptance criteria after D7/D8
  - INTERFACE_CONTRACT.md      locked — NO_BACKEND_CHANGE; empty machine-checkable endpoint set
  - PLAN.md                    locked — 0 backend tasks; F0–F9D plus receipt-bound F10 frontend track
Open amendments: AC3/AC11/AC19/AC22/AC27/AC28 bounced to Frontend in QA_REPORT.md
QA (GATE Q):  FAIL — 39 PASS / 6 FAIL / 0 UNVERIFIABLE; fresh independent rerun required after repair
Plan:         15 frontend/tooling tasks, all Independent:no; F10 frontend closer; 45/45 AC mapping
Workers:      frontend repair required for retained Scanner overflow, Positions focus order, aggregate root, and complete Positions/AI visual evidence; backend n/a
Council review: 16 conflicts folded; D1–D6 ruled A; D7/D8 owner-authorized execution amendments; S2 pass 2 has 0 Critical
Last gateway:  GATE Q @ 2026-08-24 — FAIL; QA_REPORT.md is the authoritative bounce record
