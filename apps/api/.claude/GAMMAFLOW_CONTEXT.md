# GammaFlow — Project Context (handoff)

> Self-contained ground truth for fresh, role-scoped sessions (Architect → PM →
> UX/Tech-Writer → Backend/Frontend Executioners). Assume no chat history. Grounded
> against the repo; re-generate from code if it drifts.

## 1. Purpose & scope
GammaFlow is a **single-ticker options-positioning dashboard + analysis engine**. It turns an
equity's option chain into dealer **gamma-exposure (GEX)** structure — call/put walls, the
gamma flip, the magnet — then layers volatility context, real-time order flow, and a
rule-based read of the current setup. It answers: *given dealer positioning, where is price
attracted/repelled, is the regime mean-reverting or trending, and is there an edge now?*
Built for **longer-dated (≈7–45 DTE) swing trading with optional intraday timing**. The
computed bundle also feeds an **external** downstream AI that produces risk-first trade calls.

## 2. Architecture
**Backend** (FastAPI, repo root + `src/`):
- `main.py` — endpoints, response envelope, 60s in-memory cache, config, the `LiveHub`, the
  filter-independent `/api/contract/{ticker}` tracked-contract lookup (off a ticker-keyed snapshot
  cache), serve-time opportunity tiering + `position_eval`.
- `src/providers/base.py` — `MarketDataProvider` **port** (ABC) + TypedDict contracts. Vendor
  swaps = one new adapter; engine/signals/main never import a vendor SDK.
- `src/providers/massive.py` — Massive (Polygon-style) **adapter**; `__init__.py` = `get_provider()` factory (`DATA_PROVIDER` env).
- `src/core/engine.py` — `QuantEngine`: GEX profile, greeks, vectorized gamma flip, + DEX & Vol/OI
  (in the GEX pass) and `compute_iv_skew` / `compute_term_structure` (guarded, full-chain helpers).
- `src/core/signals.py` — regime/vol-regime/setups/opportunity-score + AI gate + fingerprint, +
  `compute_opportunity_tier` (dormant→prime bands) & `position_fingerprint` (open-position dedupe).
- `src/core/live.py` — `LiveSession`/`LiveHub`: live NBBO mid, rolling net flow, live flip,
  session classifier; one ref-counted session per ticker (8s grace teardown).
- `src/core/darkpool.py` — off-exchange (TRF) volume ratio + volume-by-price.
- `src/core/observability.py` — bundle-pipeline instrumentation: span/timer primitive (ContextVar
  trace), per-request `RequestTrace`, process-local rolling `MetricsAggregate` (p50/p95 per stage &
  total, cache hit/miss, vendor latency + min rate-limit headroom; per-ticker rolls up to global),
  structured emitter. `engine/signals/darkpool` do NOT import it (Level-1, orchestration-boundary only).
- `src/models/market_data.py` — `MarketState` Pydantic response model.

**Frontend** (`gammaflow-web/`, Nx monorepo, React 19 + Vite + MUI/Emotion):
- `apps/dashboard/src/app/app.tsx` — dashboard (toolbar, stat tiles, setups, **Off-exchange
  blocks** section), polls bundle (60s) + subscribes SSE. Also four **always-on neutral
  positioning tiles** — `Net DEX`, `Vol/OI`, `IV skew` (slope → fear/greed/balanced), `Term
  structure` (contango/backwardation/flat) — plus a **Term-structure mini-card** (ATM-IV-by-tenor,
  sampled to 7/14/30/60/90 DTE nearest) and a **Fresh positioning (Vol/OI)** unusual-strike list.
  These are static bundle reads (no toggle, no side, no score wiring), independently nullable
  (each → its own "unavailable this cycle"), and **excluded from the live-offline treatment.**
  **Stream isolation:** live-derived tiles (price/net flow/spread/live flip) + one `⚠ Live offline`
  chip degrade on an SSE drop (payload-gap watchdog >15s; dimmed + `⏸ offline`, never blanked),
  while the GEX chart + every static tile/section keep rendering the last bundle; cold-start failure
  is the only blank screen (error + Retry), a post-success poll failure keeps the bundle behind a
  soft "Couldn't refresh" warning.
- `apps/dashboard/src/app/gex-profile-chart.tsx` — recharts horizontal net-GEX-by-strike, plus a
  per-strike **Net DEX** series (neutral, secondary X-axis) and DEX/Vol-OI/volume in the tooltip.
- `apps/dashboard/src/app/ghost-trade/` — **paper-sim ghost-trade tracker** (no real order anywhere).
  Client-local durable store (`localStorage`, versioned, exportable) for the open `GhostTrade` +
  append-only `DecisionRecord[]` (survive reload + SSE drop). `useGhostTrade` owns the honest **mark
  ladder** (snapshot anchor → modeled between snapshots off the live underlying × cached greeks →
  theoretical BS → last-known offline → frozen overnight/closed), P/L = (mark−entry)×100×qty,
  edge-detected **reassessment alerts** (once per event; suppressed while stale/offline/closed), the
  operator-mediated **reassessment boundary** (build request → paste verdict → Accept maps Exit/Trim/
  Add-capped/Roll/Hold), and the **opportunity tier** read (`signals.opportunity_tier`). Components:
  `GhostTradePanel`, `TradeEntryDialog`, `OpportunityTier` (tier emphasis + Prime banner). Tracked
  contract stats come from `GET /api/contract` (filter-independent; 404 → tracking-unavailable,
  `option_quote:null` → theoretical mark). Isolation: an SSE drop degrades only P/L + current mark
  (⏸ last known); the trade record/stats/history + GEX chart + all tiles persist.
- `libs/api/src/lib/gammaflow.ts` — typed API client (`@org/api`): `getTicker`, `streamTicker`,
  `fetchTrackedContract`.
- Vite dev proxy `/api → 127.0.0.1:8000` (no CORS); SSE via `EventSource`.

**Transport:** heavy bundle over REST (polled ~60s, cached); light live payload over **SSE**.

## 3. Core math constraints
- **Two gamma sources (do not unify casually):** the per-strike **profile + walls + net/call/
  put GEX use the VENDOR's gamma** (`api_gamma`); the **gamma flip uses our ANALYTIC
  Black-Scholes gamma** (`_gex_curve`), because the flip reprices across a hypothetical spot
  grid and the vendor only gives gamma at the current spot. They can disagree (e.g. wall 450
  vs analytic 420) — intentional. Live flip is analytic too (consistent with the static flip).
- Generalized BS, cost-of-carry `b = r − q`: **r = 4.5%**, q = dividend yield (0 for non-payers).
- **Time-to-expiry floored at `MIN_GREEK_T = 1/365`** (keeps near-expiry greeks finite).
- Gamma flip = zero-crossing of net GEX over a **spot ±20%, 100-pt grid**, nearest crossing to
  spot, linearly interpolated.
- Dollar GEX = `gamma·OI·100·S²·0.01` (calls +, puts −); walls = max/min net-GEX strike; peak
  GEX = max gross-gamma strike. Vanna/charm/volga computed in-house (vendor gives only 1st-order).
- Max pain = nearest **monthly OPEX** payout-minimizing strike; PCR = put OI / call OI. **Max
  pain & PCR stay full-chain**; the DTE/expiration filter shapes only the gamma structure.
- Dollar DEX = `delta·OI·100·S` using **VENDOR delta** (signed: calls +, puts −, so the net is a
  signed sum — no analytic repricing). Window-scoped like GEX; `S = synchronized_spot`. Vol/OI is
  **full-chain** (`volume/total_oi`, null when no volume or OI ≤ 0). IV skew = put−call IV at ±25Δ
  (moneyness fallback) on the ≥7-DTE ATM tenor; term structure = ATM-IV-by-tenor across all
  expirations (`flat` band ≈1% of near IV). These four touch **no** gamma/flip/wall math.
- 30-day HV = stdev of daily log returns (ddof=1) ×√252 ×100. ATM IV = avg call+put IV at the
  ATM strike of the nearest tenor ≥ 7 DTE. IV/HV: >1.10 rich, <0.90 cheap.
- VWAP (session-anchored, ≥10 RTH 1-min bars): VWAP ± 2σ/3σ volume-weighted bands.
- `gex_spot` = spot levels are anchored to (last session close when market closed; live in RTH);
  `price`/`current_spot` = live/delayed display spot.

## 4. Data sources & coverage
- **Massive = Polygon.io rebrand** (hostnames `*.massive.com`). REST + WebSocket.
- **Stock coverage 4 AM–8 PM ET** (pre-market + RTH + after-hours). **NO overnight (8 PM–4 AM)** —
  the overnight ATS (Blue Ocean) price seen on Webull is NOT sourceable here.
- Options chain snapshot supplies **OI + greeks (Δ/Γ/Θ/V) + IV** (big convenience).
- Daily bars (~60d) → HV; 1-min bars (~4d) → VWAP; stock snapshot → session close spot.
- **Live:** WebSocket `Q.{tkr}` (NBBO) + `T.{tkr}` (trades). REST `list_trades` backfills flow.
- Trades carry **`trf_id`** → non-null = off-exchange ("dark pool"/internalized) print.

## 5. Key decisions & rationale
- **Single-ticker, on-demand** (dropped the watchlist scan) — bulk per-cycle calc was too slow.
- **Selectable DTE/expiration window** (`min_dte/max_dte/expirations`) — stabler swing levels,
  free of 0DTE noise; shapes gamma structure only.
- **60s cache + freshness/`stale` flag** — pollable without hammering; honest data age.
- **AI gate** (`ai_eval.ready/changed/state_fingerprint`) — escalate to the AI only when
  actionable AND changed; keeps it off a firehose (user is prone to over-trading).
- **Live spot = NBBO mid, not last trade** — smoother, always-current, better for anchoring;
  Webull shows last trade, hence small benign differences.
- **Honest live-vs-stale + session classifier** — never present a frozen price as "live";
  distinguishes overnight (uncovered) / closed / feed-lagging.
- **Dark-pool = context only, capped, toggleable** — off-exchange volume includes internalized
  retail and has no reliable side; small capped confluence bonus; omitted from bundle AND score
  when `dark_pool=false`. **Block prints** (`blocks[]`, largest-notional off-exchange prints from
  the same recent tape, no new fetch) are **display-only**: they do not feed `opportunity_score`
  or `dark_pool_confluence`. The whole off-exchange computation is **best-effort + isolated** —
  any failure yields `off_exchange = None` (object omitted, not an HTTP error), leaving
  `market_state`/`strike_profile` and the SSE path untouched.
- **Vectorized gamma flip** — ~330× faster than the scalar loop, identical output.
- **Vendor-agnostic provider port** — so Massive↔another vendor is a contained swap.

## 6. Current feature state (works end-to-end)
- On-demand bundle: `GET /{ticker}` & `/api/ticker/{ticker}` (+ slices) with DTE/expiration filter.
- GEX strike-profile chart (walls always in-window, spot/flip/live reference lines, tooltips).
- Live SSE: mid, spread, **net flow (5m, signed)**, live gamma flip; session-aware status chip.
- AI gate + glossary + `prompts/strategy_prompt.md` hand-off contract (AI external).
- Dark-pool/off-exchange ratio + levels + capped confluence + largest-notional **block prints**
  (top-5, `blocks[]`: price/shares/notional/signed proximity/age — display-only, unscored), UI toggle.
- **Four always-on positioning metrics** in the bundle (no toggle, no side, **unscored**, each
  independently nullable): **DEX** (`net_dex`/`call_dex`/`put_dex` + per-strike, vendor delta,
  window-scoped like GEX), **Vol/OI** (`chain_vol_oi_ratio`/`total_volume`/`vol_oi_unusual_threshold`
  + per-strike `volume`/`vol_oi_ratio`, **full-chain**), **IV skew** (`iv_skew` at the nearest
  ≥7-DTE tenor, ±25Δ w/ moneyness fallback), **term structure** (`term_structure` ATM-IV-by-tenor
  curve + contango/backwardation/flat, cross-tenor).
- **Ghost-trade tracker (sim) backend surface** (FE owns the durable store + mark/P-L math): the
  filter-independent `GET /api/contract/{ticker}` tracked-contract lookup (`option_quote{bid,ask,mid}
  |null`, greeks, iv, dte — 404 if not in snapshot, `option_quote:null` if no NBBO); the provider-port
  **option NBBO quote** (`OptionContract.quote` from Massive `last_quote`, no new fetch); backend-emitted
  `signals.opportunity_tier` (dormant→watch→actionable→prime) + `prime_prompt_eligible`;
  `position_eval{changed,fingerprint}|null` (sibling of `ai_eval`, via `pos_*` query params);
  `prompts/reassessment_prompt.md` hand-off. All best-effort/isolated; **stateless server, no order
  path, no LLM call**; the entry gate + `opportunity_score` + `state_fingerprint` are unchanged.
- **Backend observability** (operator-facing; trader path unchanged): the six bundle stages
  (`vendor_fetch` io_vendor, `engine_build`/`off_exchange` cpu_engine, `signals` cpu_signals,
  `persist` io_disk, `serialize_wrap` serialize) are timed into a per-request trace; `meta.trace_id`
  (always when enabled) + `meta.timings` (only with `?debug=1`); read-only `GET /api/_metrics`
  rolling readout (p50/p95/max/count per stage+total, cache hit/miss/ratio/age, vendor count/latency/
  min rate-limit headroom→null="unknown" for Massive, per-ticker→global, recent traces w/ lineage);
  additive structured `trace request` log lines. Best-effort (never a non-200), **SSE uninstrumented**,
  ephemeral (resets on restart), computed values frozen.
- Explanatory hover tooltips on every jargon stat/chip/chart.

## 7. Conventions
- **Env (`.env`):** `MASSIVE_API_KEY`, `DATA_FEED` (realtime|delayed), `CACHE_TTL_SECONDS` (60),
  `STALE_AFTER_SECONDS` (1200; drop to ~120 on real-time), `GATE_SCORE` (50),
  `FLOW_WINDOW_SECONDS` (300), `LIVE_THROTTLE_SECONDS` (1.5), `CHAIN_REFRESH_SECONDS` (120),
  `INCLUDE_DARK_POOL` (true), `DARKPOOL_LOOKBACK_SECONDS` (3600), `BLOCK_MIN_SHARES` (5000;
  fixed institutional-size threshold for an off-exchange block print), `VOL_OI_UNUSUAL_THRESHOLD`
  (1.0; cutoff above which a strike's vol/OI reads "unusual", echoed as `vol_oi_unusual_threshold`),
  `TIER_WATCH_SCORE` (25) / `TIER_ACTIONABLE_SCORE` (=`GATE_SCORE`) / `TIER_PRIME_SCORE` (75;
  opportunity-tier bands — Prime also requires `ai_eval.ready`), `OBSERVABILITY_ENABLED` (true;
  off ⇒ no `meta.trace_id`/`timings`, no metrics, bundle identical), `METRICS_WINDOW_SIZE` (500;
  rolling-window request count), `METRICS_RECENT_TRACES` (25). Per-request verbose switch: `?debug=1`.
- **Add a vendor:** implement `MarketDataProvider` in `src/providers/<name>.py`, register in
  `_PROVIDERS`, set `DATA_PROVIDER`. Nothing else changes.
- **Run:** backend `.venv/Scripts/python.exe main.py` (uvicorn :8000); frontend
  `npx nx serve dashboard` (Vite :4200, proxies /api). Node via nvm-windows at `C:\nvm4w\nodejs`.
- Two git repos: `C:\Dev\GammaFlow` (backend) and `C:\Dev\gammaflow-web` (frontend); no remotes.

## 8. Downstream-AI contract
- `market_state_glossary.md` = field-level reference (reliability order, regimes, envelope,
  off_exchange, ghost-trade tracker). `prompts/strategy_prompt.md` = when to invoke (gate + dedupe) +
  required risk-first output schema (entry). `prompts/reassessment_prompt.md` = the position-aware
  sibling: an OPEN trade + current `market_state` + decision digest → risk-first verdict ∈
  {Hold,Trim,Add,Exit,Roll}. The AI is **external** — GammaFlow defines the contract + gate only,
  it does **not** call an LLM.

## 9. Open items / under consideration
- **Vendor evaluation:** Massive (cheap ~$400/mo flat, greeks included, no overnight) vs
  **Databento** (overnight via Blue Ocean + full OPRA + fidelity, but live-overnight likely
  Plus tier ~$1,500/mo + separate OPRA + build own greeks) vs **Webull data API** (cheap
  overnight underlying but no options, 3 msg/s/conn throttle, broker-gated). Overnight coverage
  is the core gap driving this.
- **Dark pool is a bounded recent-window view** (not multi-session block accumulation — that
  needs a heavier batched pull).
- **Gamma-flip model divergence** (vendor vs analytic) judged immaterial; measure before any
  calibration. The bigger latent modeling choice is fixed-IV-under-spot-move in the flip search.
