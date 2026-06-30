# FRONTEND_EXECUTION_CONTRACT — convexa-redesign · SURFACE: Ticker (code re-skin + componentize)

Bound to: `PROJECT_CONTEXT.md`, `README` (design authority), `THEME_TOKENS.md`, `MUI_KIT_KEYS.md`.
**NO_BACKEND_CHANGE / NO_INTERFACE_CHANGE** — consumes the existing bundle (poll) + SSE + AI-rec endpoints unchanged.

## Goal
Re-skin the React Ticker viewer (`apps/dashboard/src/app/ticker/TickerDashboard.tsx`) to match the Figma
Ticker design (file `4Njtm8QGWIgm4rA0UESg8n`, page **"Screens - Ticker"**, Live `135:3` + Stale + Offline),
and **break the monolith into reusable section components**. The AI-rec UI under `apps/dashboard/src/app/
ai-rec/` is **re-skinned to the new design, preserving its logic + tests**. PRESERVE all behavior; keep the
full dashboard + ai-rec spec suites GREEN.

## Hard rules
- **Re-skin + componentize, NOT a logic rewrite.** Do NOT change the bundle poll (~60s), the SSE
  subscription/page-scoping, the AI-rec hook (`useAiRecommendation`: cooldown / daily-cap / gating
  states / Accept→paper-sim ghost-trade / state-export), skeleton-first load, or any scoring/`?debug`
  wiring. No new fetches.
- **CRITICAL carryover — NO "Connection (demo)" toggle.** The Figma mock shows a Live/Stale/Offline
  *toggle*; the real app's connection state is **stream-driven** (live/stale/offline derived from the SSE
  payload-gap watchdog + session classifier — see `[live-vs-static-isolation]`). Implement it as a
  **status indicator**, NOT a user toggle. The 3 Figma screens are mock states of the one component.
- **Token discipline (THEME_TOKENS.md): NO hardcoded hex.** Inter via theme Typography; `color/*` palette
  tokens (`background.default`=page, `background.paper`=cards, recessed surface for inputs,
  `text.*`, `divider`, `primary.main`, `success/error/warning/info.main`); mono (Roboto Mono) for figures.
- **Invariants:** `[additive-keeps-score-byte-identical]` (Ticker never feeds scoring; AI-rec stays an
  advisory consumer), `[live-vs-static-isolation]` (live-derived tiles dim on SSE drop; static reads keep
  the last bundle; cold-load skeleton distinct from offline-degrade and from "unavailable this cycle"),
  `[best-effort-isolated-or-null]` (each metric independently nullable → its own "unavailable" state),
  `[no-real-order-path]` (Accept = paper-sim ghost trade + confirm; no broker), `[operator-vs-trader-path-
  separation]` (NO link to `/_ops/metrics`; trader dashboard ignores `meta.trace_id`/`timings`).

## Components to create (React; under `ticker/sections/` unless noted) + recompose `TickerDashboard`
- **StatTile** (shared atom) — the upgraded tile: rounded (r12) card, `background.paper`, subtle `divider`
  border, an optional **colored left-accent bar** (success/error/none) clipped to the radius, a label row
  (label + ⓘ info icon), and a mono value (optionally colored). Drives both tile grids.
- **TickerToolbar** — ticker / expirations / persona selects + the **stream-driven connection status**
  (NOT a toggle).
- **TickerHeader** — regime chip + connection-status chip (live/stale/offline) + `TSLA · $price` title +
  the display-only **last-trade** readout (degrades with the live fields).
- **LiveTape** — 5 StatTiles (Net flow 5m / Spread / Gamma flip (live) / VWAP / Last trade); **live-derived
  → dim on SSE drop** ("paused, levels below stay current").
- **DealerPositioning** — 10 StatTiles (Call wall, Put wall, Net GEX, Net DEX, Max pain, IV/HV, Vol/OI,
  IV skew, Term structure, Opportunity); **static reads** (stay rendered on SSE drop). "snapshot, never live" caption.
- **GexStrikeProfile** — card chrome + legend wrapping the existing `gex-profile-chart.tsx` (recharts; keep
  the chart logic, re-skin the frame).
- **TermStructure** — ATM-IV-by-tenor mini card.
- **AiRecommendation** — in `ai-rec/` (re-skin `AiRecPanel`): the new card design (persona select, snapshot
  timestamp, gate/cap/no-key/produced states, Ask-anyway, "View what's sent" → existing `StateExportDrawer`,
  Accept). **Preserve `useAiRecommendation` + all gating/Accept/export logic + the ai-rec.spec tests.**
- **FreshPositioning** (Vol/OI list) · **OffExchangeBlocks** (blocks list) · **Setups** (HIGH/MEDIUM tags).
- `TickerDashboard.tsx` becomes the composition + data wiring (poll/SSE/AI-rec hooks) over these sections.

## Reference
Figma page "Screens - Ticker" (Live `135:3` = the componentized design; section components on their own
`Ticker · …` pages). Token IDs/recipes → `THEME_TOKENS.md`. **Lane has NO Figma access** — match the
structural spec above + the existing shipped behavior; read `ticker/TickerDashboard.tsx`, `gex-profile-
chart.tsx`, and `ai-rec/*` to preserve logic + testids.

## Tests (+ keep all existing green)
- Component tests for StatTile (accent/label/ⓘ/value), LiveTape (dims on SSE drop), DealerPositioning
  (static persists), GexStrikeProfile, AiRecommendation (re-skin keeps gate/cap/Accept/export states).
- ALL existing `ticker`/`ai-rec` specs MUST stay green (cold/stale/offline, four-metrics nulls, Accept flow,
  byte-identical score, no `/_ops` link). `npx nx test dashboard` green (+ `@org/api` if touched).

## Verify
`npx nx test dashboard` green; lint + build clean; `/ticker/TSLA` serves. (Conductor preview-verifies Live/
stale/offline + the AI-rec card after the lane reports done.)
