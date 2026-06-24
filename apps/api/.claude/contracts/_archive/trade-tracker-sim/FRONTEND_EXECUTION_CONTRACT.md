# FRONTEND EXECUTION CONTRACT — Ghost-Trade Tracker · AI Reassessment · Opportunity Escalation

> For the Frontend Executioner. Binds to GAMMAFLOW_CONTEXT.md + ARCHITECTURE_CONTRACT.md +
> INTERFACE_CONTRACT.md + the UX_BLUEPRINT component states. UI work ONLY — no server internals.
> Scope note: most of this feature is FRONTEND — the durable store, mark interpolation, alert
> edge-detection, accept/reject application, decision history, and the escalation UI all live here.

## Files / components to modify (suggested; keep `app.tsx` readable — extract components)
- `libs/api/src/lib/gammaflow.ts` — add types: the tracked-contract stats response
  (`option_quote{bid,ask,mid}|null`, `greeks{...}|null`, `iv|null`, `dte`), `opportunity_tier` +
  `prime_prompt_eligible` on `Signals`, `position_eval{changed,fingerprint}|null`, and the
  `Recommendation{verdict,replacement_contract?,rationale,verdict_id,status}` boundary type. Add the
  client functions: tracked-contract fetch, reassessment request emit + verdict ingest.
- A **client-local durable store** (browser persistent storage), **versioned + exportable**:
  `GhostTrade` + append-only `DecisionRecord[]` (fields per INTERFACE_CONTRACT). Survives reload +
  SSE drop; never on the live failure surface. Provide an **Export** that dumps the full versioned log.
- `apps/dashboard/src/app/` new components: `GhostTradePanel`, `TradeEntryDialog`,
  `ReassessmentCard`, `OpportunityTier` (tile + Prime banner), `TradeAlerts`, `DecisionHistory`.
- `app.tsx` — mount the Prime banner (above headline), the trade panel (below headline), and tier the
  existing `Opportunity` `Stat`.

## Consumes (from INTERFACE_CONTRACT.md)
- Tracked-contract stats (filter-independent): `option_quote{bid,ask,mid}` (null ⇒ theoretical mark),
  `greeks{delta,gamma,theta,vega}`, `iv`, `dte`.
- `live.mid` / `live.live` / `live.market_session` (existing SSE) → the **modeled mark + P/L** and
  the offline/overnight states. **No new SSE field; never put trade state on the stream.**
- `signals.opportunity_tier` + `signals.prime_prompt_eligible` (or derive from `opportunity_score`
  bands + `ai_eval.ready/changed` if Interface chose that) + `ai_eval.changed` / `position_eval` for
  alert + escalation **de-dupe**.
- `Recommendation{verdict,replacement_contract?,rationale,verdict_id,status}` from the boundary.
- `market_state.{gex_spot,call_wall,put_wall,gamma_flip}` for the strike-distance read + wall/flip
  alert thresholds.

## Component states to implement (from UX_BLUEPRINT.md — use its copy verbatim)
- **Opportunity escalation (§A):** tier the `Opportunity` tile (`{score} · {Tier}`, emphasis scales
  Dormant→Prime); **Prime banner** with `Simulate this trade →` appears only at Prime + actionable
  and only on the **change into Prime** (de-duped via `ai_eval.changed`/tier transition), dismissible.
- **Entry (§B):** `TradeEntryDialog` — Expiration/Strike/Right/Qty (default 1), live `Fill: mid $X ·
  Cost = mid × 100 × qty`, persistent `SIMULATED` chip + disclaimer; prefilled from the Prime CTA;
  theoretical-fill note when no quote; one-open-trade-per-ticker block.
- **Trade panel (§C):** durable contract line + entry facts (**never blank**); **P/L (green gain /
  red loss)**; current **mark with a basis chip** (`snapshot mid` / `modeled` `≈` / `theoretical` /
  `last known`) + age; contract stats (price, Δ/Γ/Θ/V, IV, DTE, strike vs spot/walls/flip). States:
  live-anchor / live-estimate / theoretical / **stream-offline (P/L+mark dim + `⏸ offline`, record
  persists)** / **overnight-closed (P/L frozen + `market closed — no overnight pricing`)** / stats-
  stale / **tracking-unavailable** / **closed (realized summary)**.
- **Reassess (§D):** `Reassess` idle/disabled(stale-overnight-closed)/pending/verdict-ready/accepted/
  rejected/failed. Verdict card with Accept/Reject; **nothing auto-applies**. Accept maps:
  Exit→close+book realized P/L; Trim→reduce qty; **Add→increase within the operator cap**; Roll→close
  + open the replacement ghost (must be in the current snapshot, else defer/reject); Hold→unchanged.
- **Alerts (§E):** edge-triggered **once per event**; bundle-class via `position_eval.changed`/tier
  change/DTE threshold; live-class via `live.mid` crossing a wall/`gamma_flip` + P/L crossing
  target/stop (armed/fired state). **No alert while `live=false`/overnight/closed or data stale.**
- **Decision history (§F):** per-trade list (newest first) + `Export`.

## Mark + P/L computation (FE-owned, honest)
- **Anchor:** at each chain refresh, set the mark to the option's `option_quote.mid` (basis
  `snapshot mid`).
- **Between snapshots:** re-price from the **live underlying** move × the contract's cached greeks
  (delta primary; gamma optional), re-anchored to the last snapshot mid (basis `modeled`, shown `≈`).
- **No quote:** Black-Scholes from cached `iv` (basis `theoretical`).
- **Stream offline:** keep the last computed mark, basis `last known`, dim + `⏸ offline`.
- **Overnight/closed:** freeze; no fake ticks.
- **P/L** = `(mark − entry_mark) × 100 × qty` ($) and the % vs entry cost. 100× multiplier in; fees/
  slippage out (stated). Realized P/L booked on close/Exit.

## Degradation behavior (isolation — binding)
- **Live-stream drop** degrades **only** the P/L + current mark (`⏸ offline`, `last known`, keep last,
  never framed as live) and the existing live tiles + connection chip. The **trade record, entry
  facts, contract stats, and decision history persist**; **live-class alerts pause**; self-heals on
  reconnect — no manual refresh.
- **Bundle-refresh failure after a prior success** → existing `Couldn't refresh — showing data from
  {age} ago.`; contract stats carry that age; **Reassess disabled** while stale; entry facts + P/L
  unaffected; nothing blanks.
- **Cold-start** (no bundle ever) → the only blank/error screen (existing error + `Retry`); the
  durable ghost trade still shows entry facts + last-known (stale) P/L; contract stats show
  `unavailable until data loads`.
- **Per-feature failure** → tracking `Trade tracking unavailable this cycle — your position is
  safe.`; reassess `Couldn't reach the AI — try again.`; alerts silent. GEX chart + all other stats
  render normally.
- **Simulation unmistakable:** persistent `SIMULATED` marker everywhere the trade shows; **no control
  may place a real order.**

## Verification
- [ ] Open a sim long call/put → panel shows entry price/time/qty + `SIMULATED`; P/L = `(mark−entry)×
      100×qty`, green above entry / red below.
- [ ] Reload the page → the open trade + entry facts + decision history persist.
- [ ] Kill the SSE → P/L + mark go `⏸ offline` (`last known`), while contract line, entry facts,
      stats, decision history, and the GEX chart stay visible; restore → P/L resumes, no manual
      refresh.
- [ ] Simulate overnight/closed (`live=false`) → P/L frozen with `market closed — no overnight
      pricing`; no alerts fire.
- [ ] Track a contract **outside** the current Expirations filter → it keeps marking/tracking.
- [ ] Reassess → verdict card {Hold,Trim,Add,Exit,Roll}; Accept applies the mapped change (Add
      respects the cap; Roll opens the replacement; Exit books realized P/L); Reject leaves it; both
      write a decision record; Export downloads the versioned log.
- [ ] Alerts fire once per event (wall/flip cross, tier change, P/L target/stop, DTE threshold) and
      do not repeat while the condition persists; none fire while stale/overnight/closed.
- [ ] Opportunity tile shows tiered emphasis; the Prime banner appears only at Prime + actionable, on
      entry into Prime, and not every poll; absent below Prime.
- [ ] No UI path can place a real order; the trade reads as simulated everywhere.
- [ ] Force a tracking/reassess/alert failure → only that area shows "unavailable"; chart + stats
      normal.

## Out of scope
- No backend/server internals. No data-shape changes (bind to the interface contract). No real-order
  path, no LLM call, no auto-execution. No multi-leg/short/multiple concurrent trades/portfolio P/L.
  No fees/slippage/assignment modeling. No back-test/replay driver or external notifications (the
  durable record is built export-ready, but consumption is future). Do not preclude the deferred
  seams (broker swap, replay/clock, server-side store).

## Definition of done
- [ ] UI implemented to spec and verified (see Verification).
- [ ] `.claude/GAMMAFLOW_CONTEXT.md` refreshed if the UI changed the system's described behavior/state
      (re-read touched files; same section structure).
- [ ] This feature's `.claude/contracts/<feature>/` folder archived once both lanes land, and
      `.claude/OPEN_THREADS.md` updated. Coordinate with backend so the folder is archived once both
      land.
- [ ] Committed.
