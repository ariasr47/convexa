# redesign-ticker — pipeline manifest
Entry:        gate-v (UX → Frontend; PM/Architect skipped — architecture settled by redesign-foundation)
Stage:        UX exit (GATE V) — split written; FRONTEND_EXECUTION locked. **Frontend build HELD**
              (owner 2026-06-29) pending the parallel `redesign-auth` session settling, for a clean
              `nx test dashboard` baseline. Ready to spawn delivery-frontend on the owner's signal.
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (GATE V — settled by redesign-foundation)
  - PRODUCT_CONTRACT.md        n/a (GATE V)
  - UX_BLUEPRINT.md            n/a (reuses redesign-foundation UX_BLUEPRINT + DESIGN_HANDOFF §3)
  - INTERFACE_CONTRACT.md      locked — NO_BACKEND_CHANGE (existing /api/ticker + /api/stream + ai-rec unchanged; conformance surface unchanged)
  - BACKEND_EXECUTION_CONTRACT.md   NO_BACKEND_CHANGE (one-line no-build)
  - FRONTEND_EXECUTION_CONTRACT.md  locked (UX @ GATE V — per-component reskin blueprint + state matrix + Preserve lists + 9 net-new visual cases)
Design ref:   ../redesign-foundation/DESIGN_HANDOFF.md §3 (Ticker / GEX viewer)
              + C:\Users\rodri\OneDrive\Desktop\convexa-redesign-screens\{02-ticker,10-ticker-offline,
              11-ticker-stale,12-ticker-trade-dialog}.png
              + C:\Users\rodri\OneDrive\Desktop\Convexa (standalone).html
Scope files:  apps/dashboard/src/app/ticker/TickerDashboard.tsx + gex-profile-chart.tsx
              + ai-rec/{AiRecPanel,StateExportDrawer}.tsx + ghost-trade/TradeEntryDialog.tsx
OUT of scope: auth modal (parallel redesign-auth session); embedded positions portfolio + ghost-trade
              panel internals (render as today — reskinned later in redesign-positions); the prototype
              "Connection (demo)" control (demo-only, do NOT build)
Owner gate:   LOCAL PREVIEW + owner approval required AFTER Frontend, BEFORE GATE Q (per the program)
QA (GATE Q):  n/a
Last gateway:  GATE V (UX exit) @ 2026-06-29
UX deviation:  trade dialog — UX chose PRESERVATION-WINS: keep the shipped `TradeEntryDialog` title
              (`Open simulated trade · {ticker}`) + single fill mode (honesty-floor copy); the 3-mode
              Manual/Market/Limit entry DESIGN_HANDOFF §3 describes lives on the Positions
              `PositionEntryDialog` path → feature 3 (`redesign-positions`). Flagged `[DEVIATION]` in
              the INTERFACE contract §I. (Scope clarification, not an invariant change.)
Note:         depends on redesign-foundation's landed (uncommitted) theme — coordinate the Frontend lane
              so it edits ONLY ticker / gex-chart / ai-rec / trade-dialog files (theme.ts, auth, shell,
              positions stay with their owners)
