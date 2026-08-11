# sim-entry-unification — FRONTEND_EXECUTION_CONTRACT (owner-directed, GATE V/refactor fast-path)

> Owner directive (2026-07-01, items 2+3 of the 5-item program): the Positions page's
> "+ Open simulated position" opens a DIFFERENT dialog component than the Ticker page's — they must be
> ONE underlying component. Then clean the post-redesign duplication: reusable components made
> reusable, provably-dead code deleted, structure made findable. `NO_BACKEND_CHANGE`,
> `NO_INTERFACE_CHANGE` — `apps/api` untouched, no new/changed API call.

## The duplication (ground truth, verified by the conductor)
- Ticker page: `ticker/TickerDashboard.tsx` → `ghost-trade/TradeEntryDialog.tsx` — the REDESIGNED
  dialog (Figma 118:1446: panel-raised surface, Manual/Market/Limit fill-mode segmented control,
  mandatory confirm, `SIMULATED` chip). THIS is the canonical skin.
- Positions page: `positions/PositionsPage.tsx` → `PortfolioPanel.tsx` → `PositionsPanel.tsx` →
  `positions/PositionEntryDialog.tsx` — the OLD (pre-redesign) dialog, parallel implementation of the
  same 3 fill modes.

## In scope (numbered = the verification checklist)
1. **One dialog.** Create `apps/dashboard/src/app/trading/TradeEntryDialog.tsx` as the single shared
   sim-entry dialog — start from the redesigned `ghost-trade/TradeEntryDialog.tsx` (its skin/structure
   are canonical) and ABSORB whatever capabilities `positions/PositionEntryDialog.tsx` has that it
   lacks (read both first; e.g. an editable ticker/contract selector when launched from Positions,
   where no single-ticker context exists). Both launch sites use this ONE component; the two old files
   are deleted (with their spec files' cases migrated, not dropped).
2. **Behavior preserved, not redesigned.** The Positions open-flow keeps: the server gate BEFORE any
   local write (`useGate` → `POST /api/positions/sim-trade/gate`, 403 ⇒ prompt + abort), the
   manual/market/limit semantics incl. the resting-limit `pending → filled/cancelled` lifecycle
   (`positions/entry.ts` — do NOT rewrite the resolver), the mandatory confirm, `SIMULATED`
   everywhere. The Ticker open-flow keeps `useGhostTrade.openTrade` + the AI-rec Accept prefill seam
   (`ai-rec/prefill.ts` → `EntryPrefill`) byte-compatible. `EntryPrefill` moves to the shared module;
   re-export from old paths is NOT wanted — update all imports.
3. **Durable stores untouched.** `positions/store.ts`, `ghost-trade/store.ts`, every localStorage key,
   and the v1→v2/brand migration chains are OUT OF SCOPE — zero edits there.
4. **Dead-code sweep (provable only).** For every module under `apps/dashboard/src/app/**`: if it has
   ZERO non-spec importers (grep/ts-prune style, verify each by hand), delete it + its spec. Known
   suspect to verify: `ghost-trade/GhostTradePanel.tsx` (nothing imports it since the redesign removed
   the ticker portfolio/ghost panels). Do NOT delete exported-but-unused members of live files unless
   trivially safe. List every deletion in your report with the proof (the empty grep).
5. **Findability.** After the sweep, leave a short `apps/dashboard/src/app/README.md` mapping each
   directory to its feature (ticker / positions / ghost-trade[tracked-contract+mark engine] / trading
   [shared sim-entry] / ai-rec / personas / auth / scanner / landing / shell / ui / durable /
   operator-metrics), including the honest note that `ghost-trade/` retains the single-trade tracked-
   contract/mark/reassessment engine the Ticker page uses — rename NOTHING else this pass.

## Out of scope (do NOT touch)
- Merging the ghost-trade single-trade engine into positions (a future feature, riskier).
- Any durable-store shape/key change; any backend file; any scoring/data path.
- The orders/backtest features (items 4–5 of the program) — separate pipeline.

## Invariants (restate in your report, point-by-point)
`[no-real-order-path]` (dialog stays SIMULATED + confirm; no broker/order path),
`[server-side-gate-enforcement]` (the sim-trade write gate call is preserved on the Positions path),
`[additive-keeps-score-byte-identical]` (no API call added/changed),
`[live-vs-static-isolation]` (limit-fill still requires a LIVE cross — never fills off a frozen mark),
theme-token discipline (zero hardcoded hex; the dialog uses `extrasFor(theme)` — see tokens.ts).

## Tests (the floor)
- All existing suites stay green: `npx nx test dashboard` (486 at baseline) — migrate, don't drop, the
  old dialog specs' cases.
- NEW named test: the Positions page and the Ticker page render the SAME dialog component (e.g. both
  paths mount a `data-testid="trade-entry-dialog"` from `app/trading/`).
- NEW named test: Positions-launched entry with fill mode `limit` still produces a `pending` position
  that fills only on a live cross (drive the existing entry-resolver path).
- `npx tsc -p apps/dashboard/tsconfig.app.json --noEmit` clean · `npx nx lint dashboard` 0 errors ·
  `npx nx build @org/dashboard` green.

## Toolchain (hard-won)
Bash: `export PATH="/c/nvm4w/nodejs:$PATH"` before any npx/nx. Do NOT run any server or preview — the
conductor owns the render pass. Do NOT commit — report back with the file list + test/gate outputs.
