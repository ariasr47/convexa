# QA_REPORT

| AC | Verdict | Evidence |
| --- | --- | --- |
| With at least one recent ticker, the pins/recents separator renders as a 1px vertical hairline; no full-width grey rectangle appears, and the recent chip follows the pins on the same line whenever the available width can contain them. | PASS | RUN:frontend.serve_cmd,RUN:qa.focused_frontend_tests |
| With no usable recents, `SPY`, `QQQ`, and `NVDA` render in their existing order and no orphan separator is visible. | PASS | RUN:frontend.serve_cmd,RUN:qa.focused_frontend_tests |
| At 393px, Quick chips wrap only between whole chips, the separator never becomes a horizontal bar, and the Ticker page gains no horizontal overflow. | PASS | RUN:frontend.serve_cmd,RUN:qa.browser_393_touch |
| At 320px, 600px, and the normal desktop chart width, fixtures with clustered put wall, flip, spot, and call wall values render marker-label boxes that do not intersect one another or the fixed chart captions. | PASS | RUN:qa.focused_frontend_tests,ORACLE:ac4_320_600_1152_caption_matrix |
| Put/call wall, flip, spot, and live/mid labels at the left or right domain boundary remain fully inside the canvas; three-, four-, and five-digit fixture values are not cropped. | PASS | RUN:qa.focused_frontend_tests,ORACLE:production_layout_edge_matrix |
| Existing marker text (`put`, `call`, `flip`, `spot`, and `live` or `mid`), values, directional colors, line positions, and offline/static wording remain unchanged apart from collision-safe placement. | PASS | RUN:frontend.serve_cmd,ORACLE:review_qa |
| Quick chips retain their button semantics, selected state, click behavior, focus treatment, and touch behavior; the chart hover probe remains usable. | PASS | RUN:qa.focused_frontend_tests,RUN:qa.browser_interactions |
| The dashboard uses existing theme/chart tokens with no new animation or hardcoded component color, and `apps/api` has no feature diff. | FAIL | RUN:frontend.test_cmd,RUN:qa.structural_theme_motion,RUN:qa.forced_typecheck,RUN:frontend.build_cmd,ORACLE:operator_accepted_five_failure_baseline,ORACLE:no_backend_change,ORACLE:critical_sweep_clean |

SUMMARY: 7 PASS / 1 FAIL / 0 UNVERIFIABLE
GATE Q: FAIL

OPERATOR BASELINE: Option A is recorded. The five reproducible configured-suite failures are `stage3-amber`, `grouping.integration`, `orders.risk`, `positions.risk`, and `positions/readonly`; they are outside this feature's remediation scope. The configured-suite exit still fails AC-8 and strict GATE Q. No new feature-owned failure was found, so no new Frontend bounce was appended. Commit/archive/ship remains paused pending explicit owner approval.

COMMAND EVIDENCE (final bytes):

- `npx vitest run src/app/pages/ticker/widgets/chrome/QuickSymbols.spec.tsx src/app/shared/charts/structure-field/markerLayout.spec.ts src/app/shared/charts/structure-field/StructureFieldCanvas.spec.tsx src/app/pages/ticker/widgets/gex-profile-chart/GexStrikeProfile.spec.tsx` (cwd `apps/dashboard`) — exit 0; 4 files, 19 tests passed.
- `npx nx typecheck @convexa/dashboard --skip-nx-cache -- --force` — exit 0.
- `npx vitest run src/app/shared/theme/hex-discipline.spec.ts src/app/shared/theme/banned-hexes.spec.ts src/app/shared/theme/single-motion-moment.spec.ts src/app/shared/theme/focus-visible.spec.tsx src/app/shared/theme/stage3-amber.spec.ts` (cwd `apps/dashboard`) — exit 1; 4 files passed, `stage3-amber` failed; 38 passed / 1 failed.
- `npx nx test @convexa/dashboard --skip-nx-cache -- --run` — exit 1; 152 files passed / 6 failed, 1766 tests passed / 6 failed. The extra `app.risk` lazy-route timeout did not reproduce in the isolation rerun below.
- `npx vitest run src/app/app.risk.spec.tsx src/app/shared/theme/stage3-amber.spec.ts src/app/features/trading/broker/grouping.integration.spec.tsx src/app/features/trading/orders/orders.risk.spec.tsx src/app/features/trading/positions/positions.risk.spec.tsx src/app/features/trading/positions/readonly.spec.tsx` (cwd `apps/dashboard`) — exit 1; `app.risk` passed 21/21 and exactly the five accepted baseline files failed; 94 passed / 5 failed.
- `npx nx build @convexa/dashboard --configuration=production --skip-nx-cache` — exit 0.
- `npx nx serve @convexa/dashboard` and `npx nx serve api` — running during browser observation; frontend returned 200 and the backend session endpoint returned 200.
- Headless Chrome coarse-pointer browser probe via `py -` — exit 0; 393px, no overflow, 1px × 16px separator, all Quick targets 44px, tap navigated to `/ticker/QQQ`.
- `git diff --check`; `git status --short -- apps/api`; `git diff -- apps/api` — exit 0; no `apps/api` status or diff.

CONFORMANCE: Exempt and no QA receipt generated because `INTERFACE_CONTRACT.md` honestly declares `NO_BACKEND_CHANGE` and the final `apps/api` diff/status is empty.
