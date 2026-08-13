# tradeable-rec-inputs — pipeline manifest
Stage:        GATE S — SHIPPED + ARCHIVED 2026-08-13 (QA_REPORT PASS 100/100, 13/13 ship-blocking;
              conformance spec promoted to state/conformance/tradeable-rec-inputs.json; canon folded:
              OPEN_THREADS §7ad + PROJECT_CONTEXT §6 + BACKLOG; ledger 8 rows [6 C + 2 Q], tally →
              no graduations, `egress-copy-tracks-payload` new watch key at 1).
              History: GATE C 22/22 conflicts folded · owner ruling A · S2 FAIL→fix→PASS · AC-29a ·
              build fan-out both lanes · GATE Q 93/7 → GATE Z (FE ×6 + BE AC-89) → 99/1 → owner
              ruling B (RTH-only sample accepted, dated in artifact) → 100/100 PASS.
Repos:        both (backend: new GET /api/candidates/{ticker} + expected-move/risk-block wire;
              frontend: risk-block settings entry, digested strip line, rec-surface states)
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked (owner approved 2026-08-12 after S2 pass 2 PASS)
  - INTERFACE_CONTRACT.md      locked (6 endpoints; 4 in the machine-checkable Conformance spec —
                               PUT settings + rec POST prose-documented, excluded: request-body +
                               cap/key spend; auth'd settings check needs --auth-cookie, exit 2
                               without one is config-error not FAIL)
Open amendments: none
QA (GATE Q):  QA_REPORT PASS 2026-08-13 — 100 PASS / 0 FAIL / 0 UNVERIFIABLE (final, after one
              GATE Z cycle: initial 93/7 [FE AC-3/8/62/64/69/70 + the orders.risk qty test proved
              feature-caused-not-flake; BE AC-89 artifact absent] → FE fix pass verified by
              observation + poison-proof → V10 real both-arms run → AC-89 PASS on the dated owner
              ruling [RTH-only sample accepted]). Conformance: QA independent receipt PASS 4/4,
              agrees with builder receipt. Identity triple re-proved; no Critical across 3 passes;
              key-material sweep clean.
Last gateway:  GATE C (R4) @ 2026-08-12
