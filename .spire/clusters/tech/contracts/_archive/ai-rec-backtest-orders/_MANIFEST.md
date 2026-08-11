# ai-rec-backtest-orders — pipeline manifest
Entry:        architect-first (owner directive 2026-07-01 item 4; GATE I brief)
Stage:        BOTH LANES ✅ DONE + CONDUCTOR GATES ✅ GREEN (2026-07-02) → at GATE Q
              BE: 3 files (NEW src/core/ai_scenarios.py + ai_recommendation.py + main.py); runtime
              proofs AC-35..43; byte-identity flag ON==OFF + scenario-vs-not (fp 86bcafd6bc22 /
              e5c284aa926d). FE: orders/ module (store convexa.orders.v1 + pure engine + widget/panel
              /row/detail) + order-variant TradeEntryDialog seam + AiRecPanel scenario picker +
              libs/api additive types; +102 tests incl. 44-test flow centerpiece.
              Conductor independent gates: nx test dashboard 594/594 · @org/api 13/13 · tsc exit 0 ·
              lint 0 err · nx build green · live conformance 6 specs / 12 endpoints ALL PASS ·
              contract_lint clean.
              GATE Z ×2 (FE-flagged) ACCEPTED by conductor 2026-07-02: scenario_name added to arch §2
              provenance list; RecStatus.scenarios optional-typing resilience note on the interface.
              NOTE for GATE Q: conformance MUST be invoked with
              --spec .claude/tools/conformance/ai_rec_backtest_orders.json (standalone-file
              convention, like byo-ai-key) — the --contract form exits 2 by design.
Repos:        both (backend scenario provider behind the LLMProvider seam · frontend orders store/engine/widget)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked
  - PRODUCT_CONTRACT.md        locked
  - UX_BLUEPRINT.md            locked
  - INTERFACE_CONTRACT.md      locked (conformance spec: .claude/tools/conformance/ai_rec_backtest_orders.json)
  - BACKEND_EXECUTION_CONTRACT.md   locked
  - FRONTEND_EXECUTION_CONTRACT.md  locked
Open amendments: none (2 FE-flagged items accepted + folded into ARCH/INTERFACE 2026-07-02)
QA (GATE Q):  QA_REPORT PASS — 48/48 ACs, 0 FAIL, 0 UNVERIFIABLE (fresh de-correlated Sonnet,
              2026-07-02; all 5 invariants verified live + at source; conformance new spec +
              5-spec no-regression sweep PASS; AC↔test traceability confirmed non-vacuous).
Render pass:  ✅ 2026-07-02 (conductor, live :4300 + flag-ON seeded :8000) — flag-OFF: no picker,
              widget empty-state + SIMULATED chip, signed-out sign-in CTA; flag-ON signed-in:
              9-entry picker verbatim → real no_fresh_edge gate honored (Ask anyway, AC-43) →
              scenario produced + SCRIPTED strip → Act → order dialog (prefill/trigger-seed/
              verbatim words/good-til) → confirm → Waiting order watching live (distance ticked
              427.46→427.81) → same order in Positions panel → two-step cancel → History;
              light theme verified (server-wins flip). Console clean (one benign MUI popover
              max-height dev advisory in the small preview viewport).
              ONE GATE Z RENDER CATCH (post-QA): AiRecPanel !inAppEnabled branch lacked the
              !scenarioSelected exemption — keyless deployment disabled "Run scenario" (mocked
              tests hardcoded in_app_enabled:true so a green suite hid it). Conductor inline fix
              (mirrors cap/cooldown bypass; precedent: 7m stagger catch) + harness override +
              named test run_scenario_not_blocked_by_no_key_availability → suite 595/595; the
              fixed path then render-proven live end-to-end (the flow above ran through it).
Last gateway:  GATE U·X @ 2026-07-01 (lint re-verified clean 2026-07-02) — lanes dispatched 2026-07-02;
               NEXT on lane reports: conductor gates (nx test [baseline 492] · tsc · lint · build ·
               backend boot + interface_conformance) → GATE Q (fresh de-correlated qa-verify) →
               render pass → commit/push → program GATE S
