# GammaFlow

A **single-ticker options-positioning dashboard and analysis engine**. It pulls an
equity's full option chain and turns dealer **gamma exposure (GEX)** into the structural
price levels that tend to govern intraday/swing behavior — the call/put "walls," the gamma
flip, the magnet — then layers on volatility context, real-time order flow, and a
rule-based read of the current setup.

It answers: *given how dealers are positioned, where is price likely to be attracted to or
repelled from, is the regime mean-reverting or trending, and is there an actionable edge
right now?*

Built for **longer-dated (≈7–45 DTE) trading with optional intraday timing** — hence the
selectable expiration window (stable swing levels, not 0DTE noise) and the live order-flow
layer. The computed bundle is also designed to feed a **downstream AI** that produces
risk-first trade recommendations; the dashboard is the human view of the same data.

- Backend: FastAPI (`main.py`, `src/`), data via the Massive (Polygon-style) API.
- Frontend: React + Vite + MUI (separate repo, `gammaflow-web`), consumes the API over a
  `/api` proxy + SSE.
- Field-level reference for the AI: [`market_state_glossary.md`](market_state_glossary.md).
- AI hand-off contract: [`prompts/strategy_prompt.md`](prompts/strategy_prompt.md).

---

## Data sources (Massive / Polygon-style API)

| Data | Endpoint | Used for |
|---|---|---|
| Option-chain snapshot | v3 options snapshot | strikes, OI, IV, vendor gamma, underlying price |
| Daily bars (~60d) | aggregates | 30-day historical volatility |
| 1-min bars (~4d) | aggregates | session-anchored VWAP bands |
| Stock snapshot | snapshot ticker | session-close spot when market closed |
| **NBBO + trades (WebSocket)** | `Q.{tkr}` / `T.{tkr}` | live mid, spread, order flow |
| Recent trades (REST) | `list_trades` | order-flow backfill on connect |

**Coverage caveat:** stock data is **4 AM–8 PM ET** (pre-market + RTH + after-hours). The
8 PM–4 AM overnight session is **not** covered, so an overnight ATS print (e.g. Blue Ocean)
won't appear — the live layer correctly shows "no live ticks · last $X" in that window.

---

## A note on gamma: two sources

This matters for interpreting the numbers:

- **Vendor gamma (`api_gamma`)** — Massive computes per-contract greeks (delta/gamma/theta/
  vega) with its own model. We use that gamma **as-is** for the **per-strike GEX profile,
  walls, peak GEX, and net/call/put GEX**.
- **Analytic gamma (our Black-Scholes `_calc_gamma`)** — used **only for the gamma flip**
  (and its live recompute), because the flip requires gamma evaluated at *hypothetical*
  spot levels (a ±20% grid), which a single vendor value at the current spot cannot give.

Because vendor gamma ≠ textbook European BS gamma, a wall from `api_gamma` can differ from
one derived analytically — so the live layer recomputes **only the flip** (consistent in
both static and live paths) and leaves the **walls on vendor gamma**. The second-order
greeks (vanna/charm/volga) are computed entirely by us (the vendor only supplies
first-order greeks).

---

## What we calculate

Greeks use a **generalized Black-Scholes** with cost-of-carry `b = r − q` (r = 4.5%, q =
dividend yield). Time-to-expiry is floored at `MIN_GREEK_T = 1/365` so near-expiry greeks
stay finite. IV arrives as a decimal.

**d₁ / d₂**
```
d1 = [ln(S/K) + (b + 0.5σ²)·t] / (σ·√t)
d2 = d1 − σ·√t
```

### Gamma exposure (core)
- Per-contract gamma (analytic): `Γ = e^(−qt)·φ(d1) / (S·σ·√t)`
- **Dollar GEX per contract**: `gamma · OI · 100 · S² · 0.01`, signed **+ calls / − puts**.
  (Walls/profile use vendor gamma; the flip uses analytic gamma — see above.)
- **Net GEX** = Σ signed dollar GEX. **>0 = positive gamma** (dealers dampen → mean-revert);
  **<0 = negative gamma** (dealers amplify → trend).
- **Call/Put/Total GEX** = Σcall (≥0), Σput (≤0), |call|+|put|.
- **Call wall** = strike with **max** net GEX (resistance). **Put wall** = strike with
  **min/most-negative** net GEX (support).
- **Peak GEX strike (magnet)** = strike with the most **gross** gamma `|call_gex|+|put_gex|`.

### Gamma flip (zero-gamma level)
Reprice net GEX analytically across a 100-point grid over **spot ±20%**, find every zero
crossing (linearly interpolated), return the crossing **nearest current spot** — the regime
boundary. Vectorized; the live layer recomputes it at the live mid.

### Higher-order dealer greeks (directional — sign/trend, not absolute scale)
- **Vanna** `= −e^(−qt)·φ(d1)·(d2/σ)` → `$vanna = vanna · 0.01 · OI · 100 · S`
- **Charm** (dDelta/dTime, generalized) → `$charm = charm · (1/365) · OI · 100 · S`
- **Volga** `= S·e^(−qt)·√t·φ(d1)·(d1·d2/σ)` → `$volga = volga · 0.0001 · OI · 100`
- Net values = signed sums (puts negated).

### Open-interest metrics (always full-chain; NOT affected by the DTE filter)
- **Max pain** — on the nearest **monthly OPEX**: the strike minimizing total intrinsic
  payout to holders, `Σ_K [(test−K)·call_OI·100 if test>K] + [(K−test)·put_OI·100 if test<K]`.
- **Put/call ratio** = total put OI / total call OI.

### Volatility
- **30-day HV** = `stdev(ln(Pₜ/Pₜ₋₁), ddof=1)` over the last 31 closes `· √252 · 100`.
- **ATM IV** = average call+put IV at the ATM strike of the nearest expiration **≥ 7 DTE** (`·100`).
- **IV/HV ratio** — **>1.10 = IV rich** (sell premium); **<0.90 = IV cheap** (buy premium).

### VWAP (session-anchored; latest session with ≥10 RTH 1-min bars)
```
VWAP = Σ(vwᵢ·vᵢ) / Σvᵢ
σ    = √[ Σ vᵢ·(vwᵢ − VWAP)² / Σvᵢ ]
bands = VWAP ± 2σ, ± 3σ
```

### Spot selection
- `gex_spot` (level anchor) = live spot during RTH, else the relevant **session close**
  (today's after the close; prior session pre-market/weekend).
- `price` / `current_spot` = live/delayed snapshot underlying, for display.

### Filtering
`min_dte` / `max_dte` / `expirations` shape the **gamma structure** (walls, GEX, flip)
only; max pain & put/call ratio stay full-chain. DTE = whole **calendar days in ET**.

### Signals (interpretation layer — `src/core/signals.py`)
- **Regime** = sign of net GEX. **Vol regime** = IV/HV thresholds. **Distances** = signed %
  from price to each level.
- **Setups** (rule-based): Fade call/put wall, VWAP band reversion, Range premium sell,
  Put-wall breakdown, Call-wall breakout (squeeze), Gamma-flip transition, Pin confluence,
  Trend regime — each with bias, strategy, rationale, conviction.
- **Opportunity score (0–100)** = proximity to nearest level (≤40) + vol extremity (≤25) +
  setup count (≤25) + flip-transition bonus (10).
- **AI gate** (`ai_eval`): `ready` when score ≥ threshold (50), or a medium/high-conviction
  setup, or price near the flip; plus a coarse `state_fingerprint` for dedup and a `changed`
  flag. Forced off when data is stale.

### Live layer (real-time, market hours — `src/core/live.py`)
- **Mid** = (bid+ask)/2 from NBBO; **spread** = ask − bid.
- **Net flow (5-min rolling)** = signed trade volume; each trade classified by the **quote
  rule** (≥ask buy, ≤bid sell, else tick-rule fallback); reports net + buy/sell volume.
- **Live gamma flip** = recomputed analytically at the live mid.
- **`live` flag** = a real tick within 30s (else the mid is shown as stale "last-known").

### Serving (`main.py`)
60-second response **cache**; **freshness** = snapshot age + `stale` flag (default >1200s);
live updates pushed over **SSE**, one ref-counted session per ticker (8s grace teardown).

**Endpoints:** `GET /{ticker}` and `/api/ticker/{ticker}` (full bundle); `/api/market-data`,
`/api/signals`, `/api/strike-profile` (slices); `/api/stream/{ticker}` (SSE). All accept
`min_dte` / `max_dte` / `expirations`.

---

## What the UI displays

- **Toolbar:** ticker input · **Expirations** multi-select (All/Clear) · regime chip ·
  **live chip** ("● live …" / "○ no live ticks · last $X") · stale banner · loading spinner.
- **Header:** `TICKER · $price` (live mid when live, else display spot) · "levels @
  $gex_spot · N expirations".
- **Stat tiles:** Call wall · Put wall · Gamma flip *(labeled "(live)" when streaming)* ·
  **Net flow (5m)** (green buy / red sell) · **Spread** · Net GEX · Max pain · IV/HV ·
  **VWAP** · Opportunity.
- **GEX strike profile chart:** horizontal net-GEX bars per strike (green = call-dominated
  net+, red = put-dominated net−), call/put walls outlined, window always includes the walls,
  dashed reference lines for **spot**, **gamma flip**, and a bright **live** marker.
- **Setups list:** each detected setup with conviction chip and plain-English rationale.

**In the bundle but not on the dashboard** (consumed by the signals layer / downstream AI):
the ±2σ/3σ VWAP bands, the higher-order greeks (net vanna/charm/volga), the full per-strike
OI columns, and `ai_eval` / fingerprint.

---

## Run

```bash
# backend (from repo root)
.venv/Scripts/python.exe main.py        # uvicorn on 127.0.0.1:8000

# frontend (gammaflow-web)
npx nx serve dashboard                   # Vite on localhost:4200, proxies /api -> :8000
```
Config via `.env`: `MASSIVE_API_KEY`, `DATA_FEED` (realtime/delayed), `CACHE_TTL_SECONDS`,
`STALE_AFTER_SECONDS`, `GATE_SCORE`, `FLOW_WINDOW_SECONDS`, `LIVE_THROTTLE_SECONDS`,
`CHAIN_REFRESH_SECONDS`.
