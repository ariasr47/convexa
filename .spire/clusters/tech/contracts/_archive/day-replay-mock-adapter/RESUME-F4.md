# RESUME-F4 — day-replay-mock-adapter (frontend closer)

**Resume status:** DONE

**Done (F1→F4):**
- F1: `sessionTapeStanding.ts` (+spec), `liveTapeStore` genuine isLive/displayActive/lastSessionPhase, `useTickerStream` gap retains live
- F2: `connectionChip` S1 branch before liveStatus; LastTradeReadout S1 hollow ○; CommandDeck/TickerHeader displayActive; copy constants
- F3: LiveTape Session tape title/subtitle/net-flow/gamma; no ⏸ offline on S1 drop
- F4: `tickFromLive` + PositionsPage genuineIsLive; orderPlan.liveMid on genuine isLive; S1 fixture + structural specs; 393px chip helper

**Tests (exit 0):**
```
npx vitest run --config apps/dashboard/vite.config.mts \
  apps/dashboard/src/app/day-replay-mock-adapter.spec.tsx \
  apps/dashboard/src/app/day-replay-mock-adapter.structural.spec.ts \
  apps/dashboard/src/app/features/trading/orders/engine.spec.ts \
  apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.spec.tsx \
  apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.spec.tsx \
  apps/dashboard/src/app/pages/ticker/sessionTapeStanding.spec.ts
```
→ 6 files / 58 tests passed. Also ticker.risk + TickerHeader.faulted green.
Typecheck: `tsc -p tsconfig.app.json` then `tsc -p tsconfig.spec.json --noEmit` → exit 0.

**Visual:** Vite up on :4200 (`npx vite --config apps/dashboard/vite.config.mts`). chrome-devtools MCP blocked (profile already running) → **VISUAL_EVIDENCE_UNAVAILABLE**. Structural evidence via jsdom specs for S0/S1 chip+LiveTape states. Nx serve broken by `.worktrees` duplicate projects (known).

**Next:** GATE Q / V-track after backend B8. No frontend leftover in this lane.
