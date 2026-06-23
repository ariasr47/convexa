# Open Threads (session snapshot)

> Unresolved decisions / deferred work carried out of a long working session. Pairs with
> `GAMMAFLOW_CONTEXT.md` (the standing ground truth) — this file is the "what's still open."
> Decisions, not deliberation. As of the latest commit; the code/docs are all committed & clean.

## 1. Data-vendor decision (OPEN — no change made yet)
Evaluating a possible move off Massive (= Polygon.io rebrand) because Massive does **not**
cover the overnight equity session (see thread 2). Conclusions reached:
- **Massive (current):** ~$200–400/mo flat per asset class; **computes greeks/IV/OI for us**
  (big convenience); covers **4 AM–8 PM ET only (no overnight)**. Best *value* for the core.
- **Databento:** the strongest platform — full OPRA options tape, Blue Ocean **overnight**,
  full-book fidelity, and would let us compute *all* greeks ourselves (unifying the
  vendor-vs-analytic gamma split). BUT: **no greeks provided**, OPRA is a separate plan, and
  **live overnight (Blue Ocean) appears gated to the Plus tier ~$1,500/mo** + license fees +
  separate OPRA. Premium choice; only worth it for a serious fidelity/options-flow upgrade,
  not just to fix overnight display. (Verify: does Standard $199 "US Equities Mini" live feed
  include Blue Ocean? If yes it gets much more attractive.)
- **Webull data API:** official MQTT stream, **carries overnight underlying**, ~free with a
  brokerage account — BUT **no options** (can't be the GEX source), **3 msg/s/connection**
  throttle (fine for price display, too sparse for tick-level flow), broker-gated/region-limited,
  licensing TBD. Only viable as a cheap *supplemental underlying-spot* source.
- **Leaning:** stay on Massive for value; if overnight must be solved cheaply, add Webull as a
  spot-only supplement; reserve Databento for a deliberate platform upgrade. Decision pending.

## 2. Overnight-coverage gap (OPEN — mitigated, not solved)
Massive has no 8 PM–4 AM ET data, so the overnight price (e.g. what Webull shows) can't be
sourced today. **Mitigation already shipped:** session-aware "overnight — no live data /
market closed / no live ticks" messaging + honest live-vs-stale handling (live spot = NBBO mid;
`live`/`market_session` flags). Actually sourcing the overnight price requires thread 1's vendor
decision (Databento Blue Ocean, or Webull supplement).

## 3. Dark-pool block trades + stream isolation (SHIPPED + ARCHIVED — closed)
Contracts archived at `.claude/contracts/_archive/dark-pool-stream-isolation/` (both lanes done).
**Backend (Session 4A) shipped:**
`BlockPrint`/`OffExchange` TypedDicts in `src/providers/base.py`; `blocks[]` derived in the same
off-exchange pass in `src/core/darkpool.py` (top-5 by notional, signed proximity, age, no `side`,
no new fetch); `BLOCK_MIN_SHARES` env (5000 default) + best-effort try/except in `main.py`
(`off_exchange = None` on any failure, bundle/SSE intact); `signals.py` untouched (blocks unscored).
**Frontend (Session 4B) shipped** (repo `C:\Dev\gammaflow-web`): `BlockPrint` + `OffExchange.blocks`
in `libs/api/src/lib/gammaflow.ts`; in `apps/dashboard/src/app/app.tsx` — the "Off-exchange blocks"
section (Normal/Empty/Unavailable/Hidden states, neutral proximity chip, no side), a single
`⚠ Live offline — reconnecting…` connection chip driven by a **payload-gap watchdog** (>15s; a
healthy stream pushes ~every 1.5s even when quiet, so a gap = real drop), live-derived tiles dim +
`⏸ offline` while the static chart/stats/blocks stay from the last bundle, and the cold-start-vs-
refresh-failure split (cold = red error + Retry; post-success poll fail = keep bundle + soft
"Couldn't refresh — showing data from {age} ago"). Verified all 6 acceptance states via a
controllable mock backend behind the Vite proxy. Glossary + GAMMAFLOW_CONTEXT refreshed.
**Contract gap RESOLVED:** `off_exchange.block_min_shares` (int) now rides the payload
(interface-contract amendment); the FE empty-state copy binds to it and only falls back to the
5000 display constant for a pre-amendment bundle. **Archived** under `_archive/` (per DoD).

## 4. DEX · Vol/OI · IV skew · Term structure (SHIPPED + ARCHIVED — closed)
Contracts archived at `.claude/contracts/_archive/dex-voloi-skew-term/` (both lanes done). Four
always-on, **neutral, snapshot** positioning reads added to the cached bundle — **no toggle, no
side/direction, no score/gate/setup wiring**, and **excluded from the live-offline treatment**
(static fields, like Net GEX).
**Frontend (repo `C:\Dev\gammaflow-web`, committed):** `MarketState`/`StrikeRow` extended in
`libs/api/src/lib/gammaflow.ts`; in `apps/dashboard/src/app/app.tsx` four neutral tiles (Net DEX
`$X.XM`, Vol/OI `×`, IV skew `slope pts · fear|greed|balanced` derived from `slope`, Term structure
`contango|backwardation|flat`, `—` when sparse), a **Term-structure mini-card** (ATM-IV-by-tenor,
sampled to nominal 7/14/30/60/90 DTE nearest-available, absent buckets omitted/never faked) and a
**Fresh positioning (Vol/OI)** list (strikes ≥ `vol_oi_unusual_threshold`, ranked desc, blank-OI
excluded); `gex-profile-chart.tsx` gains a per-strike **Net DEX** series (neutral, secondary X-axis)
+ DEX/Vol-OI/volume in the tooltip. Each metric **independently nullable** → its own "unavailable
this cycle"; on an SSE drop the four stay fully visible and **un-dimmed.** Verified default, per-
metric null, sparse term, empty Vol/OI, and a live-stream drop via a controllable mock backend.
**Backend lane SHIPPED** (`C:\Dev\GammaFlow`): `OptionContract.volume` added to the provider port +
`massive.py` (from snapshot `day.volume`, no new fetch); `engine.process_gex_profile` derives DEX
(vendor delta, signed sum, window-scoped) and Vol/OI (full-chain) in the GEX pass, + guarded
`compute_iv_skew` / `compute_term_structure` helpers; `MarketState` model + `_build_market_state`
surface all fields; `VOL_OI_UNUSUAL_THRESHOLD` env (1.0). `signals.py` untouched — verified score +
`state_fingerprint` byte-identical with/without the four. Verified live (TSLA) + synthetically
(window scope, per-metric nulls, sparse term, vol_oi null-rule). Glossary + GAMMAFLOW_CONTEXT
refreshed; contract archived.

## 5. Ghost-trade tracker / sim (SHIPPED + ARCHIVED — both lanes done)
Contracts archived at `.claude/contracts/_archive/trade-tracker-sim/`. The FE lane had **paused** pending three
"Interface's to finalize" transports (bounce-back: `INTERFACE_AMENDMENTS_REQUESTED.md`). **The
backend lane resolved all of them** with concrete, contract-compliant choices, now pinned in
`INTERFACE_CONTRACT.md` → "Backend resolution amendment" (additive — breaks no prior FE assumption):
1. **Tracked-contract:** `GET /api/contract/{ticker}?expiration&strike&right`, bare-object response;
   **not-in-snapshot → 404**, **present-but-no-NBBO → 200 `option_quote:null`**; filter-independent,
   no new fetch.
2. **Reassessment:** option **(a) operator-mediated artifact** — `prompts/reassessment_prompt.md`; no
   endpoint round-trip; shapes unchanged.
3. **Tiers:** **backend-emitted** `signals.opportunity_tier` + `prime_prompt_eligible`; bands are
   backend env (`TIER_WATCH_SCORE`/`TIER_ACTIONABLE_SCORE`/`TIER_PRIME_SCORE`).
4. **`position_eval`:** `pos_*` query params on `/api/ticker`; absent ⇒ null (FE may also de-dupe on
   its own fingerprint).
**Backend shipped** (`C:\Dev\GammaFlow`): `OptionContract.quote` (Massive `last_quote`, no new fetch);
`/api/contract` lookup off a ticker-keyed snapshot cache; `compute_opportunity_tier` +
`position_fingerprint` in `signals.py`; serve-time tiering + `position_eval` in `_wrap`;
`reassessment_prompt.md`. Verified live (TSLA: contract inside/outside window, no-NBBO→null,
missing→404, tier bands, position_eval once-per-event, full isolation) + entry gate/`opportunity_score`/
`state_fingerprint` byte-identical to pre-feature; **no order path, no LLM call** (grep-confirmed).
Glossary + GAMMAFLOW_CONTEXT refreshed.
**Frontend SHIPPED** (`C:\Dev\gammaflow-web`, committed): `apps/dashboard/src/app/ghost-trade/` —
client-local durable store (localStorage, versioned, exportable; survives reload + SSE drop); honest
mark ladder (snapshot→modeled→theoretical→last-known→frozen) + P/L = (mark−entry)×100×qty;
`useGhostTrade` (tracked-contract fetch via `fetchTrackedContract`, edge-detected alerts armed once
per event + suppressed on stale/offline/closed, reassessment build→paste-verdict→Accept mapping
Exit/Trim/Add-capped/Roll/Hold, decision records); `GhostTradePanel`/`TradeEntryDialog`/
`OpportunityTier` (tier emphasis + Prime banner de-duped on entry into Prime). Bundle position context
fed via `getTicker` `pos_*`. Isolation verified: SSE drop degrades only P/L + current mark (⏸ last
known) while the trade record/stats/history + GEX chart + all tiles persist. Verified via a
controllable mock: entry, reload-persist, SSE drop+self-heal, overnight freeze, tracking-unavailable,
reassess Accept (Add capped), tiers + Prime banner, decision history + Export. `SIMULATED` everywhere;
no real-order path. Glossary + GAMMAFLOW_CONTEXT refreshed; **contract archived** under `_archive/`.
Deferred seams (specified, not built): broker `FillSource`/`PositionStore`, `BundleFeed`+clock replay,
recorded-verdict reassessment, server-side trade store.

## 6. Backend observability (SHIPPED + ARCHIVED — both lanes done)
Contracts archived at `.claude/contracts/_archive/backend-observability/`. Operator-facing
bundle-pipeline instrumentation; **trader path + computed values + cache + SSE unchanged.**
**Backend shipped** (`C:\Dev\GammaFlow`): new `src/core/observability.py` (span/timer ContextVar
trace, process-local rolling `MetricsAggregate`, structured emitter; `engine/signals/darkpool`
untouched — Level-1). `main.py` times the six stages (`vendor_fetch`/`engine_build`/`off_exchange`/
`signals`/`persist`/`serialize_wrap`), creates the trace at serve entry, carries it into
`to_thread`, folds on the loop after the response; `meta.trace_id` (always when enabled) +
`meta.timings` (`?debug=1`); read-only `GET /api/_metrics`. `base.py` optional `metrics_sink` +
`VendorCallMetric` seam (no signature change); `massive.py` documents it surfaces no rate-limit
headroom (SDK exposes no response headers ⇒ readout `min_rate_limit_headroom: null` = "unknown").
Env: `OBSERVABILITY_ENABLED` (ON), `METRICS_WINDOW_SIZE` (500), `METRICS_RECENT_TRACES` (25).
Verified: miss records all 6 stages / hit records only `serialize_wrap` (+ lineage), per-ticker→global
roll-up, readout read-only (0 vendor fetches), OFF ⇒ byte-identical bundle, forced span exception ⇒
200 + identical values, SSE uninstrumented, structured logs additive (not doubled). Glossary
(operator section) + GAMMAFLOW_CONTEXT refreshed.
**Finalized (were "Interface's call"):** verbose switch `?debug=1`; readout `GET /api/_metrics`; env
flag names + window default — pinned in INTERFACE_CONTRACT (amendment note) + operator doc.
**Frontend SHIPPED** (`C:\Dev\gammaflow-web`, committed): **Obligation 1** — `Meta` gains optional
`trace_id?` + `timings?` (StageName/StageKind/MetaTimings) so bundles parse cleanly; the **trader
dashboard renders neither** (verified unchanged with trace_id/verbose-timings present, no leak, no
console errors). **Obligation 2** — `fetchMetrics` (read-only `GET /api/_metrics`, side-effect-free)
+ `operator-metrics.tsx` on route **`/_ops/metrics`** (its own AppBar, OFF the trader routes, not
linked): global + per-ticker stage tables (stage · I/O|CPU from `kind` · p50/p95/max/count ·
ok/err/skip), total/cache/vendor lines, recent-traces with warm/cold inspect + lineage,
window/uptime caption, instrumentation ON/OFF, glossary tooltips. Honest presentation: empty → `—`
(not 0), `skipped` shown, headroom `null` → `unknown`, low headroom factual + **non-alerting**.
Verified via a controllable mock (trader unchanged; readout populated/empty/unknown/disabled/
unavailable/trace warm-vs-cold); endpoint path + readout field names cross-checked against the
shipped backend. **Archived** under `_archive/` (per DoD).
**Deferred (specified, not built):** OTel/Prometheus export, latency/headroom alert thresholds,
persisted/cross-restart baselines, the multi-ticker scanner (baseline data supports it).

## 7. Smaller deferred items (proposed, not implemented)
- **Live gamma-flip anchoring:** when not in RTH, anchor the flip search to `gex_spot` (the
  close) instead of the live mid, for consistency with the bundle and to avoid a gapped
  pre-market anchor selecting a different crossing when multiple exist. Also lower the per-tick
  `Gamma flip $…` INFO log to debug (it spams every ~1.5s). Numerically near-zero impact; do for
  cleanliness. (User confirmed the displayed flip is fine as-is.)
- **Wall-selection guard:** walls are the global max/min net-GEX strike, so a deep-OTM
  round-number LEAP strike could in principle become "the wall" far from spot. Not biting now
  (the expiration filter mitigates). Add a distance/DTE guard only if it shows up live.
- **Multi-session dark-pool accumulation map:** current dark-pool is a bounded recent window;
  true multi-session block history needs a heavier batched pull. Future.

## 8. Resolved decisions (do NOT revisit)
- **Live spot = NBBO mid, not last trade** — smoother, better for anchoring; Webull shows last
  trade, hence small benign differences. Keep mid; do not add last-trade.
- **Gamma sourcing** — vendor gamma for walls/profile, analytic BS for the flip; the divergence
  is immaterial. Don't "fix" it via interpolation or borrow-rate calibration.
- **Dark pool** — context only, capped confluence, toggleable; never a directional "smart money"
  signal (off-exchange includes internalized retail; prints have no reliable side).
