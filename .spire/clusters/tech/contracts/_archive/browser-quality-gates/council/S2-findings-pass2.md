# S2 — skeptic findings: browser-quality-gates (pass 2)

## Critical  (blocks — must loop back to R4)

- No remaining Critical finding. The prior conflict-accounting blocker is closed: the contract now states “All 16 R2 conflicts (4 architect + 5 PM + 7 UX)” and the machine ledger contains exactly 16 conflicts and 16 folded resolutions. — evidence: `SPEC.md:§9`; `council/conflicts.json` (`conflicts.Count = 16`, `resolutions.Count = 16`)

- No remaining Critical finding. D6's human decisions are now externally inspectable and command-independent: authorization, candidate-set, and acceptance receipts have fixed paths, schemas, actors, hashes, state transitions, and mutation tests; the update command cannot create either human decision. — evidence: `SPEC.md:§2` visual-review receipt schemas and state machine; `SPEC.md:§3 AC14–AC16`; `SPEC.md:§4` receipt-bound acceptance flow

## Important  (should fix)

- The offline accessibility anchor is not expressed as an unambiguous selector. A11Y-9 and A11Y-B6 name bare `command-deck` and `widget-bento`, unlike the explicit `[data-testid="command-deck"]` and `[data-testid="widget-bento"]` selectors used in A11Y-3. If interpreted as CSS selectors, these target custom-element tags (or no node), so the offline/static-retention gate can pass against the wrong surface or fail before observing the required state. Normalize these two rows to the same explicit selector contract. — evidence: `SPEC.md:§4` A11Y-3 versus A11Y-9 and A11Y-B6

## Minor / advisory

- `SPEC.md:§2` still calls the pre-synthesis `dashboard-e2e:e2e` seam “inferred,” but the aggregate itself is now concretely executable through the specified Node runner, `shell:false`, fixed four-child array, `npx(.cmd) nx run` argument vector, and `Promise.allSettled`; implementation should source-check that named target before build. — evidence: `SPEC.md:§2` architecture/runner paragraphs; `SPEC.md:§8` `[cited-code-is-verified-not-assumed]`

## Checked and clean

- Dropped conflicts: re-counted all R2 files/ledger entries and matched every one to a folded resolution; §9 now reports 16 and no open conflict is omitted.
- Unobservable acceptance criteria: rechecked the prior AC14–AC17 concerns; authorization/acceptance receipts, hashes, actor roles, state transitions, Linux workflow, and two-run stability are externally inspectable and mutation-testable.
- Unspecified component states: rechecked the §4 default/loading/empty/error/offline-stale table; all named gate/report states have behavior, and all nine accessibility readiness rows plus seven A11Y-B sequences now have route/state, selectors, predicates, and pass/fail oracles.
- Interface mismatch: `INTERFACE_CONTRACT.md` remains intentionally empty (`endpoints: []`), matching `NO_BACKEND_CHANGE` and the SPEC's deterministic intercepted-fixture boundary.
- Internal contradiction: checked 16-conflict accounting, four-child aggregate versus six visual scenarios, nine scans/seven behavioral sequences, local versus hosted `NOT RUN`, receipt state transitions, and Linux bootstrap sequencing; no new contradiction was found beyond the selector ambiguity reported above.
- Guardrail breach: checked structural manifests, absent-is-not-none, hermetic live/static isolation, no-update check paths, no UI/backend/runtime changes, and cited-code verification; no direct breach was found.
- Local/hosted honesty and Linux bootstrap: local evidence remains explicitly local; hosted remains exact `NOT RUN`; the protected `workflow_dispatch` Linux candidate flow is compare-initialized, read-only, upload-only, and unreachable from PR/push/aggregate/check paths.
- Full-suite/compatibility overlap and Node aggregate: the closed manifest separates the 52 Chromium identities from five compatibility journeys, while `run-quality.mjs` launches exactly four children once, waits for all, validates receipts, and cannot reach visual update.
