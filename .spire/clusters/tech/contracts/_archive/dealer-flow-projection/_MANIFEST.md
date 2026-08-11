# dealer-flow-projection — pipeline manifest
Entry:        architect-first (owner GATE I 2026-07-02: enrich the downstream-AI's inputs)
Stage:        BOTH LANES ✅ DONE + CONDUCTOR GATES ✅ GREEN (2026-07-02) → at GATE Q
              BE (4 files): market_data.py 3 nested sub-models + MarketState field · engine.py
              determinism fix [math.fsum] + _build_dealer_flow_projection · main.py wiring ·
              market_state_glossary.md AC-15. Byte-identity BOTH ways (with/without + before/after fix);
              live cold==warm; null family + horizon + window-scoping proven; signals.py 0 changes.
              FE (new DealerFlowProjection widget after DealerPositioning + libs/api MarketState type +
              copy helpers; +22 tests incl. the static-on-SSE-drop contrast centerpiece).
              Conductor independent gates: nx test dashboard 617/617 · @org/api 13/13 · tsc exit 0 ·
              lint 0 err · nx build green · live field present+typed (spot_basis=gex_spot not live;
              horizon 11→2026-07-17; vanna 1.0/5.0 increase) · conformance 6 specs ALL PASS.
              No amendments from either lane. Nothing committed.
Repos:        both (backend: projection over already-computed net charm/vanna in the engine +
              MarketState field + determinism fix; frontend: display read; AI-state-export is BE-side)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked
  - PRODUCT_CONTRACT.md        locked (17 ACs incl. AC-10b; 8 architect Qs resolved; no amendments)
  - UX_BLUEPRINT.md            locked
  - INTERFACE_CONTRACT.md      locked (conformance spec: .spire/clusters/tech/state/conformance/dealer-flow-projection.json — conductor-authored from the interface's embedded spec)
  - BACKEND_EXECUTION_CONTRACT.md   locked (real BE change — engine projection + determinism fix + additive model field + glossary; NOT NO_BACKEND_CHANGE)
  - FRONTEND_EXECUTION_CONTRACT.md  locked (new static-family Widget after DealerPositioning + Tests-to-write matrix)
Open amendments: none
QA (GATE Q):  pending — fresh de-correlated qa-verify (sonnet) dispatched 2026-07-02
Last gateway:  GATE U·X @ 2026-07-02 — split emitted (lint clean). Wire: single nested nullable
               market_state.dealer_flow_projection (charm{projected_delta,per_day_base,horizon_days,
               opex_date} + vanna{projected_delta,move_iv_points=1,illustrative_move_iv_points=5,
               illustrative_projected_delta pre-scaled,reference_direction="increase"} + spot_basis);
               no new endpoint/param/SSE field. Conformance asserts only the score/tier/gate/fingerprint
               FLOOR + market_state presence (additive field optional/nullable — null cycle must PASS).
               NEXT: dispatch Backend ‖ Frontend lanes in parallel.
