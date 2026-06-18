# GammaFlow `market_state` — Field Glossary (for the trading AI)

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

## OI / sentiment
- `max_pain` — OI-based price minimizing total option-holder payout at `max_pain_expiration`. **Secondary, heuristic pin**; strengthens into that expiry. Different basis than gamma — when it agrees with `peak_gex_strike`, the pin is higher-conviction.
- `max_pain_expiration` — expiration `max_pain` is for (nearest monthly OPEX, YYYY-MM-DD).
- `put_call_ratio` — put OI / call OI, all expirations. >1 put-heavy, <1 call-heavy (positioning, not volume).

## Volatility
- `atm_iv` — ATM implied vol, % annualized (nearest tenor ≥ 7 DTE).
- `hv_30d` — 30-day realized vol, % annualized.
- `iv_hv_ratio` — `atm_iv`/`hv_30d`. **>1 = IV rich** (favors selling vol); **<1 = IV cheap** (favors buying vol).

## Mean-reversion (last completed RTH session)
- `vwap` — session volume-weighted average price.
- `vwap_upper_2/3`, `vwap_lower_2/3` — VWAP ± 2σ/3σ (volume-weighted). Mean-reversion bands; `null` if no session had enough data.

## Not populated yet
- `net_flow` — order-flow aggression. Currently `null` (not computed) — ignore until non-null.

**Reliability order:** gamma structure (`net_gex`, `gamma_flip`, walls, `peak_gex_strike`) > `iv_hv_ratio`/VWAP > `max_pain` > higher-order greeks (directional only).
