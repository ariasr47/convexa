# dealer-flow-projection — pipeline manifest
Entry:        architect-first (owner GATE I 2026-07-02: enrich the downstream-AI's inputs)
Stage:        UX exit (GATE U·X) — split emitted, lanes ready to dispatch
Repos:        both (backend: projection over already-computed net charm/vanna in the engine +
              MarketState field + determinism fix; frontend: display read; AI-state-export is BE-side)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked
  - PRODUCT_CONTRACT.md        locked (17 ACs incl. AC-10b; 8 architect Qs resolved; no amendments)
  - UX_BLUEPRINT.md            locked
  - INTERFACE_CONTRACT.md      locked (conformance spec: .claude/tools/conformance/dealer-flow-projection.json — conductor-authored from the interface's embedded spec)
  - BACKEND_EXECUTION_CONTRACT.md   locked (real BE change — engine projection + determinism fix + additive model field + glossary; NOT NO_BACKEND_CHANGE)
  - FRONTEND_EXECUTION_CONTRACT.md  locked (new static-family Widget after DealerPositioning + Tests-to-write matrix)
Open amendments: none
QA (GATE Q):  n/a until build
Last gateway:  GATE U·X @ 2026-07-02 — split emitted (lint clean). Wire: single nested nullable
               market_state.dealer_flow_projection (charm{projected_delta,per_day_base,horizon_days,
               opex_date} + vanna{projected_delta,move_iv_points=1,illustrative_move_iv_points=5,
               illustrative_projected_delta pre-scaled,reference_direction="increase"} + spot_basis);
               no new endpoint/param/SSE field. Conformance asserts only the score/tier/gate/fingerprint
               FLOOR + market_state presence (additive field optional/nullable — null cycle must PASS).
               NEXT: dispatch Backend ‖ Frontend lanes in parallel.
