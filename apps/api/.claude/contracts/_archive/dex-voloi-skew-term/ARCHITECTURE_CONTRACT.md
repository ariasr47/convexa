# ARCHITECTURE CONTRACT — DEX · Vol/OI · IV Skew · Term Structure

> Producer: Architect (this session). Consumer: PM (next session).
> Reader has only `.claude/GAMMAFLOW_CONTEXT.md` + this file. No chat history.
> Lane: data structures/contracts, data-flow, component boundaries, isolation/error rules,
> non-goals. **No UI/layout, no endpoint signatures, no payload field names, no copy** — those
> are downstream (PM → UX → Interface).

## Goal
Add four new **chain-snapshot-derived** positioning/volatility measures to the computed bundle:

1. **Net Dealer Delta Exposure (DEX)** — aggregate + per-strike dealer delta exposure (the
   delta analogue of GEX).
2. **Intraday Volume-to-Open-Interest (Vol/OI) Ratio** — today's option volume vs standing OI
   (turnover intensity / fresh-positioning intensity).
3. **IV Skew** ("fear/greed" slope) — put-side vs call-side IV at a single representative tenor.
4. **Option Term Structure** (contango vs backwardation) — ATM IV across expirations.

All four are **static, REST-bundle metrics**: derived from the existing option-chain snapshot in
the engine, carried on the cached bundle. **None touch the SSE/live path.**

## Binding constraints (restated from GAMMAFLOW_CONTEXT — must not be violated)
- **Two gamma sources stay as-is.** Vendor gamma for the per-strike profile/walls; analytic
  Black-Scholes gamma *only* for the gamma-flip ±20% grid. These features add **no third source**
  and do not touch gamma, the flip, walls, peak GEX, or the strike profile's existing fields.
- **No new analytic greek is introduced.** DEX uses the **vendor's first-order delta**
  (`greeks.delta`), exactly mirroring the "vendor gamma for the profile" rule. IV skew and term
  structure consume **vendor IV** directly; Vol/OI uses no greeks. Therefore **r = 4.5%**, the
  dividend yield `q`, and the `MIN_GREEK_T = 1/365` floor are all **untouched** — no BS repricing
  is added by this feature.
- **Spot basis.** Any spot-scaled term (the `S` in dollar DEX) uses `synchronized_spot`
  (`gex_spot`) — the same spot GEX/levels are computed at — not the live/display spot.
- **DTE/expiration-filter scope is per-metric and explicit** (see §"Scope rules"). The existing
  rule holds: the DTE window shapes only the gamma structure; max pain & PCR stay full-chain.
- **No new network I/O.** All four are derived from data already fetched in `compute_ticker`
  (`fetch_options_market_state`). The only port change is surfacing a field the vendor snapshot
  already carries (per-contract volume). Mirrors the "blocks derived in the same pass, no new
  fetch" precedent.
- **Vendor-agnostic port.** Any new field consumed from a contract must be added to the
  `OptionContract` TypedDict in `src/providers/base.py` and populated by **every** adapter; the
  engine must treat it as optional (degrade, never crash) so a vendor that lacks it still works.
- **Best-effort + isolated** (the dark-pool precedent applies). Each metric is computed in its own
  guarded block; a failure in one yields a **null/empty** value for that metric only — never an
  HTTP error, never corruption of `market_state`/`strike_profile`, never any effect on the SSE path.

## Provider-port change (the one contract amendment)
Vol/OI requires per-contract **traded option volume**, which the current `OptionContract` does not
carry. Amend the port:

- Add to `OptionContract` (`src/providers/base.py`):
  - `volume: Optional[float]` — the contract's **session** traded volume (today's, or the last
    completed session's when closed — same session basis the snapshot's spot uses). `None` when
    the vendor does not price/report it.
- **Massive adapter:** populate from the snapshot's per-contract `day.volume` (already in the
  payload the adapter parses; no new request). Missing → `None`.
- **Engine rule:** a `None`/absent `volume`, or `open_interest <= 0`, yields a `None` Vol/OI for
  that contract — it is excluded from any Vol/OI aggregate, and GEX/DEX/everything else is
  unaffected.

## Data structures (engine-output shapes — the deliverable)
These describe what the engine produces. **Wire/JSON field names, `MarketState` additions, and
payload shaping are downstream (Interface contract) — not fixed here.** Structure names below are
internal.

**1. DEX** — computed in the SAME per-contract loop as GEX in `process_gex_profile`:
- Per contract: `dollar_dex = delta · open_interest · 100 · synchronized_spot`, using **vendor
  delta**. Sign convention follows the existing per-strike convention (calls contribute with their
  natural delta sign, puts with theirs); the engine emits the **raw signed aggregate** plus the
  per-strike split. (Dealer long/short *interpretation* and any bullish/bearish framing is PM/UX
  copy, not engine math.)
- Aggregate: `net_dex` (signed sum), and optionally `call_dex` / `put_dex` gross split mirroring
  the existing call/put/total-GEX breakdown.
- Per-strike: add `net_dex` (and call/put dex) to each `strike_profile` row, alongside the
  existing `net_gex`/`call_gex`/`put_gex`. DEX rides the **same profile array** as GEX.

**2. Vol/OI** — per-strike + aggregate:
- Per strike: `volume` (summed) and `vol_oi_ratio = volume / total_oi` (`None` when OI = 0 or no
  volume), added to `strike_profile` rows next to the OI fields.
- Aggregate: a chain-level `total_volume` and `chain_vol_oi_ratio` (total option volume / total OI).
- It is a **turnover-intensity** measure only — **no side/direction** is inferred (same caveat
  class as dark-pool: activity ≠ direction). State this in the glossary downstream.

**3. IV Skew** — a small structure at a single anchor tenor:
- Anchor tenor = the **nearest expiration ≥ 7 DTE** (reuse the existing ATM-IV tenor selection so
  skew, ATM IV, and the swing horizon are consistent).
- Primary metric: a **risk-reversal-style slope** = (put-side IV) − (call-side IV) at symmetric
  reference points. Default reference = **±25-delta** using vendor delta to bucket; fall back to
  **fixed-moneyness** (e.g. ±5% OTM by strike) when delta is unavailable. Emit the scalar slope
  plus the two underlying IVs and the chosen tenor/expiration, so it is auditable.
- The reference-point parameters (delta target, moneyness band) are engine constants (tunable);
  whether the PM wants different points is an open question, not a blocker.

**4. Term Structure** — ATM IV across tenors:
- For each available future expiration (or a sampled set), compute **ATM IV** reusing the existing
  per-expiration ATM-strike selection (nearest strike to spot; average call+put IV at it).
- Emit an ordered list of `{expiration, dte, atm_iv}` points **plus** a scalar slope/state
  (e.g. far-tenor IV vs near-tenor IV ratio, and a contango/backwardation sign). Which exact
  tenor buckets to *display* is downstream; the engine emits the available curve.

## Scope rules (DTE/expiration filter — per metric, explicit)
| Metric | Basis | Rationale (binding) |
|---|---|---|
| **DEX** | **Follows the gamma-structure DTE/expiration window** (same filtered contracts as GEX). | DEX is a positioning-structure metric in the GEX family; it must move with the swing window the user selects. |
| **Vol/OI** | **Full chain** (independent of the DTE window). | Pairs volume with OI; OI in the strike profile is already summed full-chain across expirations, so volume must share that basis — same treatment as PCR/max-pain. |
| **IV Skew** | **Single anchor tenor (≥ 7 DTE)**, independent of the window. | A skew slope is defined at one tenor; reuse the ATM-IV tenor anchor for consistency. |
| **Term Structure** | **Spans all/sampled tenors**, independent of the window. | Term structure is *by definition* cross-tenor; the DTE window must not restrict it (like max pain/PCR, it ignores the filter). |

## Data-flow & component boundaries
- **All computation is in the engine layer** (`src/core/engine.py`), inside / alongside
  `process_gex_profile`, and surfaced through `_build_market_state` in `main.py` into the bundle.
  DEX and per-strike Vol/OI fold into the existing single contract loop and the `strike_profile`
  assembly (cheap, no extra pass). IV skew and term structure are separate guarded helpers that
  read the same chain.
- **Rides the cached REST bundle** (`market_state` + `strike_profile`), polled ~60s, behind the
  existing 60s cache and freshness/`stale` flag. **No new endpoint** is implied here (downstream).
- **SSE/live path is untouched.** `LiveSession`/`LiveHub` continue to stream only
  mid/spread/net-flow/live-flip. None of these four metrics are recomputed per-tick or live; they
  do not enter the live payload. **Stream isolation is preserved by construction.**
- **Signals/scoring default = read-only display + AI context.** `signals.py`, the
  `opportunity_score`, the AI gate, and `state_fingerprint` are **not** modified by default; the
  four metrics are added to `market_state` for display and as downstream-AI context. Wiring any of
  them into setups/score is a **PM decision** (open question) and, if taken, must stay **capped /
  confluence-only**, consistent with the over-trading-guard philosophy.

## Error-isolation rules (the deliverable)
1. **Per-metric guarding.** DEX folds into the existing per-contract `try/except continue` loop
   (a bad contract is skipped, as today). IV skew and term structure run in their **own
   try/except** helpers that return `None`/`[]` on any failure. A failure in one metric never
   affects the others or the core GEX result.
2. **Missing inputs degrade to null.** Absent vendor `volume` → null Vol/OI; absent vendor
   `delta` → that contract contributes 0 to DEX (skipped), never raises; too few/zero-IV contracts
   at a tenor → null skew / fewer term-structure points.
3. **Core GEX is authoritative.** `process_gex_profile` must still return a valid GEX result
   (including `_empty_gex_result()` on no usable contracts) regardless of the state of the four new
   metrics. The new fields are additive and independently nullable.
4. **No HTTP error path.** None of these can turn a `200` bundle into an error; they are best-effort
   context, like off-exchange.

## Non-goals (out of scope)
- **No UI/layout, no component states, no endpoint signatures, no payload/JSON field names, no
  copy/labels.** (PM/UX/Interface own those.)
- **No new analytic greek source**; no change to gamma, the gamma flip, walls, peak GEX, max pain,
  PCR, VWAP, or HV.
- **No SSE/live-path changes**; nothing is recomputed per tick.
- **No new network fetch** beyond surfacing the volume already in the chain snapshot.
- **No directional / "smart-money" claim for Vol/OI** — it is turnover intensity, not a side.
- **No multi-session history** (term structure & skew are single-snapshot; Vol/OI is single
  session). Historical skew/term trends are future work.
- **No default scoring/gate integration** (deferred to PM).

## Open questions for the PM (downstream decisions)
1. **Surfacing granularity** for each metric: scalar headline only, per-strike curve, or both
   (DEX & Vol/OI both have a natural per-strike form on the existing profile).
2. **DEX framing**: how to present dealer long/short delta and any bullish/bearish read (engine
   emits raw signed values; the directional narrative is product copy).
3. **Vol/OI "unusual" threshold**: the per-strike cutoff at which Vol/OI is highlighted as fresh
   positioning, and whether to emphasize chain-wide vs per-strike.
4. **IV skew reference points**: accept the ±25-delta (fixed-moneyness fallback) default, or
   specify different points; how to express "fear vs greed" in copy.
5. **Term-structure display buckets**: which tenors to show (e.g. 7/14/30/60/90 DTE) and how to
   label contango vs backwardation; the engine emits the full available curve.
6. **Scoring/gate**: should any metric feed `opportunity_score` / new setups / the AI gate, or
   stay display-+-AI-context only? (Default: display/context only; if wired, keep capped.)
7. **Toggle**: always-on (recommended — cheap, no extra fetch) vs a request flag like `dark_pool`.
8. **Wire contract**: `market_state` field names, `strike_profile` row additions, and any new
   bundle sub-objects → defer to the Interface contract.
9. **Glossary/AI contract**: new fields need `market_state_glossary.md` entries (reliability,
   caveats — esp. Vol/OI "no side") → Tech-Writer.
