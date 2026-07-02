# sim-entry-unification — pipeline manifest
Entry:        owner-directed (items 2+3 of the 2026-07-01 five-item program; GATE V/refactor fast-path)
Stage:        ✅ BUILT + VERIFIED — lane delivered app/trading/TradeEntryDialog (one shared dialog,
              7 old specs migrated + 6 new incl. the two contract-mandated flow tests), deleted
              ghost-trade/TradeEntryDialog + positions/PositionEntryDialog(+spec) + GhostTradePanel +
              app.module.css (zero-importer proofs), added app/README.md map. Conductor independent
              gates: tsc clean · nx test 492/492 · lint 0 err · build green. Render pass (:4300):
              Ticker + Positions open the SAME [data-testid=trade-entry-dialog] (SIMULATED, 3 fill
              modes, panel-raised #1c2330 dark); anonymous Positions correctly shows the sign-in gate;
              demo sign-in exercises the server gate then opens the dialog. Light-mode surface bound
              via extrasFor(theme).panelRaised (same mechanism render-proven on the positions pills;
              the one "dark dialog in light" reading was server-wins-signed-in theme, correct behavior).
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
QA (GATE Q):  verified — conductor independent gates (tsc/492/lint/build) + render pass (owner-
              approved fast-path for this refactor class; shipped d704193). Archived at the
              program GATE S 2026-07-02 alongside ai-rec-backtest-orders.
Last gateway:  contract authored @ 2026-07-01
