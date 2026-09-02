# RESUME-F1 — day-replay-mock-adapter

**Resume status:** DONE

**Done:**
- Created `sessionTapeStanding.ts` + `sessionTapeStanding.spec.ts` (genuineIsLive, displayActive, consumeStanding, formatPlayingChipText, sessionTapeChip)
- Updated `liveTapeStore.ts` — isLive via genuineIsLive; exposes displayActive + lastSessionPhase (survives payload-gap)
- Annotated `useTickerStream.ts` — gap keeps last live/phase for drop standing

**Tests:** `npx vitest run --config apps/dashboard/vite.config.mts apps/dashboard/src/app/pages/ticker/sessionTapeStanding.spec.ts` → exit 0 (7 passed)

**Next:** F2 — connectionChip / LastTradeReadout / CommandDeck displayActive / copy.ts
