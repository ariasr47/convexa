# Convexa `market_state` — Field Glossary (for the trading AI)

**Pre-market reading:** every gamma level is computed from the **last completed session's
close** (`gex_spot`), so they describe dealer positioning *going into today*. `price` is the
current/indicative (pre-market, ~15-min delayed) quote. **Anchor the levels to `gex_spot`,
not `price`** — then compare `price` vs `gamma_flip`/walls to read the regime the open is
heading into. If `timestamp` looks stale, down-weight all greek/GEX fields.

## Identity & spot
- `ticker` — underlying symbol.
- `price` — current (delayed / pre-market) spot. Display only.
- `gex_spot` — spot the GEX/greek levels were computed at (last session close when closed; == `price` during RTH). **The levels are anchored here.**
- `timestamp` / `timestamp_iso` — options-snapshot time (ns epoch / UTC ISO). Staleness here = stale greeks/GEX.

## Dealer gamma structure (primary — gamma-based, most reliable)
- `net_gex` — net dealer $ gamma (calls +, puts −), per 1% move. **>0 = positive-gamma** (dealers dampen moves → vol-suppressed, mean-reverting); **<0 = negative-gamma** (dealers amplify → trending/volatile).
- `call_gex` / `put_gex` / `total_gex` — gross split: call gamma (≥0), put gamma (≤0), and |call|+|put|.
- `gamma_flip` — zero-gamma price nearest spot. **Above = positive-gamma regime; below = negative.** Key regime trigger.
- `call_wall` — strike with the most net-positive gamma → upside **resistance**.
- `put_wall` — strike with the most net-negative gamma → downside **support**.
- `peak_gex_strike` — strike with the most *total* gamma → **magnet/pin** (price gravitates here). Distinct from the walls; may or may not equal `call_wall`.

## Higher-order dealer greeks (use DIRECTIONALLY — sign/relative only)
- `net_vanna` — $ vanna (dDelta/dVol). Absolute magnitude is convention-dependent; read the sign and trend.
- `net_charm` — $ charm (dDelta/dTime; daily delta bleed). Directional.
- `net_volga` — $ volga (dVega/dVol). Directional.

## Projected dealer flow (`dealer_flow_projection`) — forward-looking, advisory CONTEXT only

A forward-looking projection of the delta dealers are expected to hedge, built from the same
window-scoped net-charm / net-vanna aggregates (`net_charm`/`net_vanna`) already in this bundle. Two
independently-nullable limbs. **Advisory context to sharpen TIMING + conviction — NEVER a scored input,
NEVER a price forecast, NEVER a guarantee.** It does not feed `opportunity_score`, `opportunity_tier`,
the entry gate, `state_fingerprint`, or any setup. `null` (whole object) when both limbs are
unavailable.

- `dealer_flow_projection.charm` — the **charm limb**: expected cumulative delta drift dealers must
  hedge from time-decay alone **to the next monthly OPEX**, holding spot & vol constant.
  - `charm.projected_delta` — **dollar-delta** (signed, dealer-book convention: calls +, puts −, put
    contributions already negated). = `net_charm · horizon_days`. **Linear, first-order** — NOT
    path-integrated across a time grid (charm itself drifts as t→expiry; this is the honest
    first-order read). `null` if `net_charm` is unavailable or the horizon can't be determined.
  - `charm.per_day_base` — **dollar-delta per +1 calendar day** (= the bundle's `net_charm`). The
    quantity the projection is built from.
  - `charm.horizon_days` — **calendar days** to the next monthly OPEX (3rd-Friday expiration), `>= 1`.
  - `charm.opex_date` — the monthly-OPEX date (`YYYY-MM-DD`) the drift is projected to.
  - **Window-scoped:** built over the SELECTED DTE/expiration window (moves with the window, like
    GEX/DEX — NOT full-chain). If the selected window excludes the OPEX date, the read still targets
    that OPEX and surfaces `horizon_days`/`opex_date`, so a window/horizon mismatch is visible, not
    hidden ("the flow the currently-selected window will generate by that date").
- `dealer_flow_projection.vanna` — the **vanna limb**: expected delta change dealers must hedge **if
  implied vol moves**. Instantaneous (no time horizon — its "horizon" is the vol-move magnitude).
  - `vanna.projected_delta` — **dollar-delta** (signed) for the base `move_iv_points` move (= +1 IV
    point ⇒ equals `net_vanna`). `null` if `net_vanna` unavailable.
  - `vanna.move_iv_points` — the base assumed vol move, in **IV points** (= `1.0`).
  - `vanna.illustrative_move_iv_points` / `vanna.illustrative_projected_delta` — an illustrative
    **+5 IV-point** shock and its pre-scaled flow (= `net_vanna · 5`); pure linear scaling, no new
    computation. Labeled with its move size so the magnitude is never ambiguous.
  - `vanna.reference_direction` — `"increase"`: the quote assumes a vol **increase** (+Δσ). A vol
    **decrease is the exact negation** (same magnitude, opposite sign). Read the sign from the
    reference direction — never guess it.
- `dealer_flow_projection.spot_basis` — the spot (`synchronized_spot`/`gex_spot`, close-anchored, NOT
  live) the projection was computed at.

**How to cite it:** use it for dealer-flow TIMING — e.g. "charm flow supports upward delta drift into
Friday's OPEX" or "a +5-pt vol spike would push dealers to hedge ~$X of delta." State the direction as
dealer-hedging flow, NOT as a price prediction. **Reliability tier:** directional/advisory context
only, alongside the higher-order greeks — magnitudes are model-dependent; read sign + horizon + relative
size, and always carry the assumptions (linear/first-order, vol-increase reference, snapshot-pinned).
It is **STATIC** (snapshot-pinned; does not update on the live stream).

## Market context (`market_context`) — pre-digested regime/shape/flow/range reads, advisory CONTEXT only

Four digested reads computed from data already in this bundle (daily bars, the window-scoped net-GEX
profile, the chain snapshot). **Advisory context only — NEVER a scoring input, NEVER a forecast, NEVER
a guarantee.** None of it feeds `opportunity_score`, `opportunity_tier`, the entry gate, or
`state_fingerprint`. Every read carries its own window/thresholds/basis in-payload (self-describing).
Each of the four children is independently nullable — a null means "could not be computed honestly
this cycle" (commonly insufficient history or an empty basis), never zero. The whole object is `null`
only when all four are unavailable. **STATIC:** snapshot-pinned to the bundle; never updated by the
live stream.

- `market_context.trend_momentum` — trend/momentum regime from the fetched daily-close series (may
  include the in-progress session's partial bar; `as_of_session` = the last bar's session date). Three
  independently-nullable labels, each with its generating scalar(s) + window + thresholds:
  - `direction.label` ∈ `uptrend | downtrend | mixed` — close vs EMA20 vs EMA50 (strict chains;
    ties = `mixed`). Scalars: `close`, `ema20`, `ema50`. Warm-up ≥ 100 bars, else null.
  - `strength.label` ∈ `weak | moderate | strong` — Wilder ADX(14): `< 20` weak, `20–25` moderate,
    `>= 25` strong. Scalar: `adx`. Warm-up ≥ 43 bars with valid high/low, else null. ADX is
    strength-only (no direction) — read with `direction`.
  - `momentum.label` ∈ `overbought | bullish | neutral | bearish | oversold` — Wilder RSI(14):
    `>= 70`, `[55,70)`, `[45,55)`, `(30,45)`, `<= 30`. Scalar: `rsi`. Warm-up ≥ 42 bars, else null.
  - **How to cite:** regime context for whether mean-reversion around the GEX levels is trustworthy
    (e.g. "trend read is Mixed with Weak ADX — chop; fading levels is better supported"). Never a
    standalone entry/exit signal.
- `market_context.gex_profile_shape` — shape scalars over the SAME window-scoped per-strike `net_gex`
  the profile/walls use (vendor gamma; anchored at `spot_basis` = `gex_spot`). Requires ≥ 5 strikes
  with non-zero net GEX (`eligible_strikes` is carried), else null (all-or-null):
  - `concentration` — normalized HHI ∈ [0,1] (0 = uniform, 1 = one strike);
    `concentration_label` ∈ `concentrated (>= 0.35) | mixed (0.15–0.35) | dispersed (< 0.15)`.
  - `balance` — (|net GEX| share strictly above spot − share strictly below) ∈ [−1,+1];
    `balance_label` ∈ `above_skewed (>= +0.20) | balanced | below_skewed (<= −0.20)`.
  - `center_of_mass_distance` — the |net GEX|-weighted average strike's signed distance from
    `spot_basis`, as a FRACTION of spot (+ above / − below). No label.
  - **How to cite:** structure quality — a `concentrated` + `above_skewed` profile means the levels
    the walls mark carry most of the weight above spot; a `dispersed` profile weakens wall conviction.
    The DTE window basis is the bundle's `dte_min`/`dte_max`.
- `market_context.flow_vs_positioning` — whether TODAY's option activity sits where the STANDING
  positioning sits. **Flow basis (pinned, also carried as `flow_basis`): today's session cumulative
  per-contract option volume from the chain snapshot — full-chain, UNSIGNED (no buy/sell side, no
  aggressor inference, never a "smart money" claim), captured at the snapshot and aging under the
  bundle's `stale` flag. NOT the SSE stock-tape net flow.** Two independently-nullable sub-components:
  - `location` — `distribution_shift` ∈ [0,1]: the strike-share distribution of today's volume vs the
    strike-share distribution of standing OI (0 = identical, 1 = entirely elsewhere);
    `label` ∈ `aligned (< 0.35) | rotating (0.35–0.60) | divergent (>= 0.60)`. Null when today's
    volume or OI totals are unusable.
  - `composition` — `volume_pcr` (today's put/call VOLUME ratio), `oi_pcr` (the standing full-chain
    put/call OI ratio — same value as `put_call_ratio`), `tilt_ratio = volume_pcr / oi_pcr`;
    `label` ∈ `flow_put_tilted (>= 1.25) | consistent | flow_call_tilted (<= 0.80)`. Null when a
    ratio is undeterminable (e.g. zero call volume or OI).
  - **How to cite:** composition/location ONLY — e.g. "today's flow is rotating away from standing OI
    and put-tilted vs the book." NEVER as buying/selling pressure or accumulation/distribution.
- `market_context.atr` — typical daily range over `atr_5d` / `atr_14d` / `atr_30d` (each
  independently nullable): `value` ($), `pct_of_close` (% of the last close, `close_basis`),
  `window_bars`. Method (also carried as `method`): **simple mean of True Range over the last n
  bars**, `TR = max(high − low, |high − prevClose|, |low − prevClose|)`; a horizon needs its full
  `n+1`-bar tail with valid high/low, else null (never a close-to-close fallback, never 0).
  `as_of_session` carried.
  - **How to cite:** range REALISM — sanity-check whether a hoped-for move or a distance to a level is
    plausible within a horizon ("a move to the call wall is ~1.8× the 14-day ATR — ambitious for one
    session"). The app deliberately does NOT compute stops/targets/distances from it.

**Reliability tier:** advisory context, same tier as the higher-order greeks and
`dealer_flow_projection` — labels are threshold-digests of standard indicators, not signals. Read them
WITH the gamma structure, never instead of it.

## OI / sentiment
- `max_pain` — OI-based price minimizing total option-holder payout at `max_pain_expiration`. **Secondary, heuristic pin**; strengthens into that expiry. Different basis than gamma — when it agrees with `peak_gex_strike`, the pin is higher-conviction.
- `max_pain_expiration` — expiration `max_pain` is for (nearest monthly OPEX, YYYY-MM-DD).
- `put_call_ratio` — put OI / call OI, all expirations. >1 put-heavy, <1 call-heavy (positioning, not volume).

## Expiration (DTE) window
- `dte_min` / `dte_max` — the days-to-expiry window the **gamma structure** (`net_gex`, walls, `peak_gex_strike`, `gamma_flip`, gross GEX, higher-order greeks) was computed over. `null` = full chain. Set via the `min_dte` / `max_dte` query params. **Does NOT affect `max_pain` or `put_call_ratio`** — those always use the full chain. Restricting to e.g. 7–45 DTE gives stabler swing levels, free of the 0DTE/weekly noise that shifts intraday.

## Volatility
- `atm_iv` — ATM implied vol, % annualized (nearest tenor ≥ 7 DTE).
- `hv_30d` — 30-day realized vol, % annualized.
- `iv_hv_ratio` — `atm_iv`/`hv_30d`. **>1 = IV rich** (favors selling vol); **<1 = IV cheap** (favors buying vol).

## Mean-reversion (last completed RTH session)
- `vwap` — session volume-weighted average price.
- `vwap_upper_2/3`, `vwap_lower_2/3` — VWAP ± 2σ/3σ (volume-weighted). Mean-reversion bands; `null` if no session had enough data.

## Not populated yet
- `net_flow` — order-flow aggression. Currently `null` (not computed) — ignore until non-null.

**Reliability order:** gamma structure (`net_gex`, `gamma_flip`, walls, `peak_gex_strike`) > `iv_hv_ratio`/VWAP > `max_pain` > higher-order greeks + `dealer_flow_projection` + `market_context` (directional / advisory context only).

---

# Endpoints — one ticker, on demand

The API computes on request for ONE ticker (no background loop, no watchlist) and caches
the result for a short TTL (default 60s) so polling at that cadence is instant and the
upstream feed isn't hammered. Every endpoint accepts the symbol plus an optional DTE window:

- `GET /{ticker}` — friendly URL (e.g. `/TSLA`). Returns the **full envelope** (below).
- `GET /api/ticker/{ticker}` — identical full envelope (canonical machine path).
- `GET /api/market-data?ticker=` — just the `market_state` slice.
- `GET /api/signals?ticker=` — just the `signals` slice.
- `GET /api/strike-profile?ticker=` — just the per-strike profile.

**Query params (all routes):** `min_dte`, `max_dte` — bound the expiration window the
gamma structure is computed over (omit for the full chain). For longer-dated / swing
levels use e.g. `?min_dte=7&max_dte=45`; the chosen window is echoed back as
`dte_min`/`dte_max`. The window shapes the gamma fields only — `max_pain` and
`put_call_ratio` stay on the full chain.

Unknown symbols (no option chain) return **404**. All routes share the cache, so a slice
request right after a bundle request is free; AI consumers should use the bundle route to
get `ai_eval` + `meta` in one call.

## Response envelope (bundle routes)

```json
{
  "market_state": { ... }, "signals": { ... }, "strike_profile": { ... },
  "ai_eval": { "ready": true, "reasons": ["score>=50", "setup:Fade call wall(high)"],
               "changed": true, "state_fingerprint": "a1b2c3d4e5f6", "score_threshold": 50 },
  "meta": {
    "served_at": "2026-06-21T13:45:01+00:00",
    "cache":     { "hit": false, "age_seconds": 0, "ttl_seconds": 60 },
    "freshness": { "snapshot_iso": "2026-06-21T13:30:00+00:00",
                   "data_age_seconds": 901, "stale": false, "stale_after_seconds": 1200 }
  }
}
```

- `meta.cache` — `hit` = served from memory (no upstream fetch); `age_seconds` since the
  cached compute; `ttl_seconds` = poll cadence the cache is tuned to.
- `meta.freshness` — **how old the actual market snapshot is.** `data_age_seconds` = now −
  options-snapshot time; `stale` = it exceeds `stale_after_seconds` (default 1200 ≈ the
  15-min delay + slack; lower to ~120 on a real-time tier). **Always check `stale` before
  trusting the greeks/GEX.** Note `data_age_seconds` includes the feed's inherent delay,
  so on the delayed tier expect ~900s+ even when everything is healthy.
- `ai_eval` — the **gate** that decides if this snapshot is worth the downstream strategy
  AI. `ready` = the rule layer found something actionable (score ≥ `score_threshold`, a
  medium/high-conviction setup, or price near the gamma flip); `reasons` lists what fired.
  `ready` is forced `false` (and `"stale data"` added to `reasons`) when `meta.freshness.stale`.
  `changed` = the picture differs from the last distinct compute for this ticker (dedupe),
  and `state_fingerprint` is a coarse, stable hash a consumer dedupes on. **Invoke the AI
  only when `ready && changed` and the fingerprint is new** — see `prompts/strategy_prompt.md`
  for the full hand-off contract and required output schema.
- `off_exchange` — **present only when `dark_pool=true`.** Off-exchange (TRF-reported)
  volume over a recent window: `ratio_pct` (off-lit share of volume), and `levels[]`
  (volume-by-price: `price`, `shares`, `share_of_offex_pct`, `proximity_pct`). **Context
  only — NOT directional.** Off-exchange volume includes dark pools/ATS *and* internalized
  retail, and prints carry no reliable side, so do not infer accumulation/distribution.
  When a level coincides with a gamma wall/flip it adds a small capped confluence bonus to
  `opportunity_score` (reflected in `signals.dark_pool_confluence`). If absent, the user
  disabled it — ignore entirely.
  Additionally, `off_exchange.blocks[]` lists individual large off-exchange prints from the same
  recent window (present only when `dark_pool=true`; the whole `off_exchange` object may be absent
  on a best-effort failure). Each block: `price`, `shares`, `notional` (= price·shares),
  `proximity_pct` (signed, vs spot), `age_seconds`. Ordered largest-`notional` first, capped to a
  top-N short list. A "block" is a single off-exchange print at/above a fixed share-count threshold
  (`BLOCK_MIN_SHARES`, operator-tunable; ADV-relative sizing is a future option, not in v1). The
  active threshold is echoed in the payload as `off_exchange.block_min_shares` (int) so consumers
  can label "no blocks ≥ N" without hardcoding the backend default.
  **Display/context only — NOT directional and NOT scored.** Prints have no reliable side and
  include internalized retail; blocks add nothing to `opportunity_score` in v1. Do not infer
  accumulation/distribution. Blocks travel in the cached bundle (REST), never in the live stream.

## Dealer delta structure (secondary — vendor-delta-based)
- `net_dex` — net dealer **delta** exposure (the delta analogue of `net_gex`), signed, in $ per
  the same scaling as dollar GEX, over the **selected DTE/expiration window** (moves with the
  gamma structure). `call_dex`/`put_dex` = gross split. **Positioning context, not an instruction:**
  it indicates which way dealer hedging pressure leans; the hedging implication is indirect. **Do
  not** read it as "dealers are bullish/bearish, so buy/sell." `null` when vendor delta is missing
  chain-wide (best-effort). Reliability: below the gamma structure (uses 1st-order vendor delta).
- `strike_profile[].net_dex` — per-strike DEX on the same rows as `net_gex`.

## Turnover (Vol/OI — activity, NOT direction)
- `chain_vol_oi_ratio` — chain-wide option **volume ÷ open interest** (full chain, ignores the DTE
  filter — same basis as PCR/max pain). Turnover intensity / fresh-positioning intensity. **No side,
  no direction** — never bullish/bearish or "smart money." `null` when the vendor reports no
  per-contract volume.
- `total_volume` — full-chain session option volume. `vol_oi_unusual_threshold` — the single
  cutoff (default 1.0) above which a strike is flagged "unusual / fresh positioning."
- `strike_profile[].vol_oi_ratio` / `.volume` — per strike; `null` when OI ≤ 0 or no volume (blank,
  not zero, not flagged). Reliability: context heuristic; single session, no history.

## Volatility surface (single snapshot, no history)
- `iv_skew` — `{ slope (put-side IV − call-side IV, IV pts), put_iv, call_iv, dte, expiration,
  reference }` at the nearest tenor ≥ 7 DTE (±25-delta, fixed-moneyness fallback; `reference`
  records which). A read of **what volatility is paying for**: downside richer = fear/hedging bid;
  upside richer/flat = greed/complacency; near-symmetric = balanced. **Not a price-direction call.**
  `null` when too few/zero-IV contracts at the tenor.
- `term_structure` — `{ points: [{ dte, expiration, atm_iv }], state, near_iv, far_iv, slope }`:
  ATM IV across expirations (cross-tenor; ignores the DTE filter). `contango` = near-term vol calm
  vs longer ("normal"); `backwardation` = near-term vol elevated ("near-term stress / event");
  `flat` within ~1% of near IV. **Single snapshot, no trend/history.** Sparse/absent tenors are
  omitted, never faked; `null` when no usable tenor.

**Reliability note:** all four are **display + AI-context only** — none feeds `opportunity_score`,
setups, the AI gate, or `state_fingerprint`.

## Ghost-trade tracker (simulation — paper only)
- The ghost trade is a **simulated** long single-leg option (no broker, no real order, **no real
  order path exists anywhere in the API**). Fill basis = option **mid**; the **100× multiplier** is
  included; **fees/slippage/taxes/assignment are not modeled.** One open ghost trade per ticker. The
  trade + decision history are a **client-local durable store**; the server stays stateless.
- **Tracked-contract stats** (`GET /api/contract/{ticker}?expiration&strike&right`): the held
  contract's `option_quote{bid,ask,mid}|null`, `greeks`, `iv`, `dte`, resolved from the **full chain
  snapshot** — **filter-independent** (a held contract keeps resolving even when outside the DTE
  window) and **no new vendor fetch**. Contract not in the snapshot → 404; present but no NBBO →
  `option_quote: null` (use a theoretical mark — not an error).
- **Modeled mark:** live P/L uses the option's snapshot NBBO mid (exact at each ~2-min chain
  snapshot — the *anchor*), **estimated between snapshots** from the live underlying move + the
  contract's greeks (the *modeled* state), or **theoretical** (Black-Scholes from cached IV) when no
  quote exists. It is **not a real traded price**, is labeled accordingly, **freezes honestly**
  overnight/closed, and goes **offline (last known)** on a live-stream drop — never frozen-as-live.
  The interpolation itself is the FE's; the backend only surfaces the quote + greeks + IV.
- **Position eval** (`position_eval{changed,fingerprint}`) is a sibling of `ai_eval`, present only
  while a trade is open (pass the held contract via the `pos_*` query params): a coarse
  position-aware fingerprint (held contract vs walls/flip, P/L band, DTE band, tier) + `changed`,
  used to fire reassessment **alerts once per event** (same de-dupe as the entry gate). It does
  **not** alter the entry gate. Stale/overnight alert suppression is applied by the FE.
- **Reassessment** routes the open position + current `market_state` through the **external-AI
  boundary** (`prompts/reassessment_prompt.md`, an extension of the existing hand-off) and returns a
  risk-first verdict ∈ {Hold, Trim, Add, Exit, Roll} (Roll's replacement must be in the current
  snapshot). Convexa does **not** call an LLM; the verdict may be operator-mediated. **Nothing is
  auto-applied** — the user accepts or rejects, recorded in a versioned, exportable decision history.
- **Opportunity tiers:** `signals.opportunity_tier` ∈ `Dormant → Watch → Actionable → Prime`,
  derived from `opportunity_score` (operator env bands) + `ai_eval.ready` (**Prime also requires
  `ready`**). `signals.prime_prompt_eligible` is true only at Prime and gates the guided sim-entry
  prompt (FE fires it only on the change **into** Prime, de-duped). Display/context — not a trade
  instruction; the tier does not change `opportunity_score` or the entry gate.

# `/api/signals` — pre-digested setups for ONE ticker

This is the backend's interpretation of `market_state` (same source of truth). Prefer
reasoning over these fields rather than re-deriving regime/levels yourself.

```json
{
  "ticker": "TSLA",
  "regime": "positive_gamma | negative_gamma",
  "regime_note": "plain-English description of the regime",
  "vol_regime": "iv_rich | iv_cheap | neutral",
  "distances": { "call_wall_pct": 0.0057, "put_wall_pct": -0.0446, "gamma_flip_pct": -0.0251,
                 "peak_gex_pct": 0.0057, "max_pain_pct": 0.0057 },
  "setups": [ { "name": "...", "bias": "...", "strategy": "...", "rationale": "...", "conviction": "low|medium|high" } ],
  "opportunity_score": 53
}
```

- `regime` — the master switch. **`positive_gamma`** = dealers dampen moves → range-bound / mean-reverting (favor fading levels, selling premium). **`negative_gamma`** = dealers amplify → trending / breakout-prone (favor momentum, buying premium; do NOT fade).
- `regime_note` — human-readable expansion of the regime.
- `vol_regime` — `iv_rich` (IV/HV ≥ 1.10 → favor selling premium), `iv_cheap` (≤ 0.90 → favor buying premium), else `neutral`.
- `distances` — signed distance from `price` to each level, as a fraction of price. **Positive = level is above price; negative = below.** (e.g. `call_wall_pct: 0.0057` = call wall 0.57% above; `put_wall_pct: -0.0446` = put wall 4.46% below.)
- `setups[]` — detected confluence trades, **most actionable first**. Per setup:
  - `name` — e.g. `Fade call wall`, `Fade put wall`, `VWAP band reversion`, `Range premium sell`, `Put-wall breakdown`, `Call-wall breakout (squeeze)`, `Gamma-flip transition`, `Pin confluence`, `Trend regime`.
  - `bias` — `long`, `short`, `neutral`, `directional`, or `volatility`.
  - `strategy` — suggested structure (e.g. "short / call credit spread", "iron condor", "long puts").
  - `rationale` — why it fired (cites the specific levels). **Use this as the explanation.**
  - `conviction` — `low` / `medium` / `high` (rises with confluence and IV alignment).
- `opportunity_score` — 0–100, how actionable this ticker is right now (proximity to a level + IV extremity + number of setups + transition bonus). Higher = more setups stacking near a tradeable level.

**How to read it:** lead with `regime`, take the top 1–2 `setups`, confirm direction against `distances` (is price actually near the level the setup names?) and `vol_regime` (does the structure fit — sell premium only when `iv_rich`, buy only when `iv_cheap`). An empty `setups` list means no clean edge right now — say so rather than forcing a trade.

**Caveat:** `conviction`/`opportunity_score` are heuristic, not probabilities. Treat them as triage, not certainty; size and stop accordingly.

---

# Operator observability (NOT trader/AI-facing — ignore for trade decisions)

> The trader bundle's computed values, cache semantics, and SSE are **unchanged**. The only
> bundle-path additions are `meta.trace_id` (always, when instrumentation is enabled) and an
> optional `meta.timings` block (verbose only). The trading AI should **ignore both**. This section
> documents the operator metrics readout (`GET /api/_metrics`).

- **Pipeline stages (fixed vocabulary):** `vendor_fetch` (vendor REST: chain + daily/intraday bars,
  + recent trades when dark_pool) · `engine_build` (GEX/greeks/walls/flip/DEX/Vol-OI/skew/term + HV +
  VWAP) · `off_exchange` (off-exchange/blocks pass; `skipped` when dark_pool off — never a fake 0) ·
  `signals` (setups/score + gate) · `context_pack` (the market-context pack — best-effort, after
  signals) · `persist` (writes the ticker JSON files to disk) ·
  `serialize_wrap` (envelope + tiering + position_eval + serialization).
- **I/O vs CPU tag (`kind`):** `io_vendor`/`io_disk` → **I/O** (network/disk — parallelizable and/or
  cacheable at fan-out); `cpu_engine`/`cpu_signals`/`serialize` → **CPU** (needs worker/process
  parallelism). Load-bearing for a future multi-ticker scanner's fan-out plan.
- **Percentiles:** `p50_ms`/`p95_ms` (+ `max_ms`, `count`) per stage and for the total, over the
  rolling window; p95 catches the slow tail a mean hides.
- **Cache:** `hits`/`misses`/`hit_ratio` + `current_data_age_seconds`. A cache-HIT trace records only
  `serialize_wrap` (near-zero compute) so warm vs cold cost is never conflated.
- **Rate-limit headroom:** `vendor.min_rate_limit_headroom` = the tightest `{remaining, limit}` seen
  this window (bounds safe scanner fan-out). **Best-effort:** `null` ⇒ render **"unknown"**, never a
  fabricated number. (Massive's SDK doesn't surface rate-limit headers, so it reads `unknown`.)
- **Trace id (correlation):** one `trace_id` per served bundle, appearing in that request's structured
  logs (`trace request …`), its verbose `meta.timings`, and the readout's `recent_traces`. On a cache
  hit, `computed_trace_id` points back to the miss-trace that produced the served bundle.
- **Per-ticker → global:** `per_ticker[TICKER]` rolls up into `global` (same shape).
- **Ephemeral window:** the aggregate is **process-local and resets on restart** (a live baseline
  tool, not a historical store). `window.uptime_seconds` reflects this.
- **Config:** `OBSERVABILITY_ENABLED` (env, default **ON**; off ⇒ no `trace_id`/`timings`, no metrics,
  bundle byte-identical) · `METRICS_WINDOW_SIZE` (default **500** requests) · `METRICS_RECENT_TRACES`
  (default 25) · per-request verbose switch **`?debug=1`** (default off ⇒ no `meta.timings`).
- **Isolation:** every span/metric/emit is best-effort — an instrumentation failure leaves the bundle
  **200 with identical computed values** (only the affected span/metric missing); reading the readout
  is side-effect-free (no vendor fetch, no recompute, no cache mutation); **SSE is not instrumented**.

---

# Trader personas (prompt-layer projection only — NOT analytics)

> Operator/strategy-AI note. A **persona** reframes the external-AI hand-off prompts only; it is a
> read-only projection applied **after FREEZE** and is **not** a field in this bundle.

- A **persona** reframes the external-AI hand-off prompts (`strategy_prompt`, `reassessment_prompt`)
  for the trader's objective + risk tolerance. It changes **how the AI is briefed**, never
  `opportunity_score`, `opportunity_tier`, `ai_eval` (`ready`/`changed`/`state_fingerprint`), the
  gate, or any analytics — those are **byte-identical** across personas, and switching persona
  triggers **no recompute**. Convexa still never calls an LLM. The 7 built-in `PersonaDefinition`s +
  the decomposed template are served read-only at `GET /api/personas`; the FE assembles the prompt.
- **FIXED (persona-invariant) sections:** when-to-invoke / when-to-reassess (gate + dedupe); what to
  send (full bundle + glossary + DTE window — no field dropped); the output / verdict **schema**; the
  reassessment **Add cap, no-auto-apply, Roll constraint, and `status` semantics**; and the
  **universal risk-first floor** (lead with risk; `no_trade`/Hold is valid; JSON-only; anchor
  `gex_spot`; reliability order; respect regime). This floor carries **no** characterization of who
  the trader is.
- **PERSONA-VARIABLE slots:** objective framing (income/premium-selling · directional swing ·
  hedging) · risk calibration (conservative/moderate/aggressive) · the **trader-disposition
  characterization** (A1) · the reassessment **disposition lean** (within the fixed caps/schema) · an
  optional bounded **emphasis note** · an optional **DTE-preference** framing line. Slots fill **text
  only** — a hostile customization cannot escape its slot to alter any FIXED section.
- **Default (no persona)** reproduces today's prompt **verbatim** — including the "prone to greed and
  poor risk management" line, which is **relocated to the persona-variable disposition slot (A1), not
  deleted.** The harsh phrase appears **only** under Default and the **conservative** register —
  never under moderate/aggressive, never as a universal assertion.
- **Dark-pool stays neutral context** under every persona (it lives in the FIXED "what to send" set;
  no persona reframes it as directional / "smart money").
- **Best-effort:** any persona/assembly failure falls back to the default one-size prompt; never an
  error, never blocks the bundle, gate, or hand-off.
