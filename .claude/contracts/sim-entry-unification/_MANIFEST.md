# sim-entry-unification — pipeline manifest
Entry:        owner-directed (items 2+3 of the 2026-07-01 five-item program; GATE V/refactor fast-path)
Stage:        FRONTEND_EXECUTION_CONTRACT written — delivery-frontend lane dispatched
Branch:       main (working tree; conductor commits after gates + render pass)
Repos:        frontend (NO_BACKEND_CHANGE, NO_INTERFACE_CHANGE)
Brief:        n/a (owner-directed; this contract is the spec)
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (FE refactor)
  - PRODUCT_CONTRACT.md        n/a
  - UX_BLUEPRINT.md            n/a (redesigned TradeEntryDialog skin is canonical)
  - INTERFACE_CONTRACT.md      n/a (consumes existing endpoints unchanged)
  - BACKEND_EXECUTION_CONTRACT.md   NO_BACKEND_CHANGE
  - FRONTEND_EXECUTION_CONTRACT.md  locked — one shared sim-entry dialog + provable dead-code sweep
Open amendments: none
QA (GATE Q):  pending — lane build → conductor gates + render pass
Last gateway:  contract authored @ 2026-07-01
