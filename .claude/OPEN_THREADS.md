# Open Threads (session snapshot)

> Unresolved decisions / deferred work carried out of a long working session. Pairs with
> `PROJECT_CONTEXT.md` (the standing ground truth) — this file is the "what's still open."
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
controllable mock backend behind the Vite proxy. Glossary + PROJECT_CONTEXT refreshed.
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
(window scope, per-metric nulls, sparse term, vol_oi null-rule). Glossary + PROJECT_CONTEXT
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
Glossary + PROJECT_CONTEXT refreshed.
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
no real-order path. Glossary + PROJECT_CONTEXT refreshed; **contract archived** under `_archive/`.
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
(operator section) + PROJECT_CONTEXT refreshed.
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
**Local-visualization slice SHIPPED (latency-visualizer, FE-only `NO_BACKEND_CHANGE`, 2026-06-23,
committed `39f1b17`; contract `_archive/latency-visualizer/`):** a `LatencyTrend` card atop
`/_ops/metrics` trends the existing `GET /api/_metrics` windowed snapshots locally. `useLatencyTrend`
is now the page's **single fetcher** (one stable poll loop feeds both the trend and the snapshot
tables — still only `GET /api/_metrics`, once per cadence); bounded **ephemeral** in-browser ring
buffer (raw per-scope snapshots → metric/percentile/scope/stage switches re-derive with no refetch);
gaps = broken line (never 0/interpolated), restart = broken line + `Service restarted` marker (never
stitched), stale-repeat distinct, headroom `unknown`, failed poll keeps-last + self-heals (no retry
storm), auto-pause when hidden, local JSON Export (no server state); non-semantic palette, no
thresholds/alerts; persistent windowed-snapshot caveat + ephemerality + non-alerting copy. Verified
all states via a drivable mock (single 5s-cadence `GET /api/_metrics`, kill-backend→failed-poll→
self-heal→restart-break, headroom unknown, stale-repeat, off-gap, export). GATE S logged
`[operator-vs-trader-path-separation]` (now 2 binding:yes → at promotion threshold) +
`[best-effort-isolated-or-null]`.
**Deferred (specified, not built):** OTel/Prometheus export, latency/headroom alert thresholds,
persisted/cross-restart baselines, the multi-ticker scanner (baseline data supports it).

## 7. Trader personas (SHIPPED + ARCHIVED — both lanes done)
Contracts in `.claude/contracts/trader-personas/` (A1 RESOLVED·ACCEPTED). Persona is a **read-only,
post-FREEZE prompt projection** — a non-input to scoring by construction. **Backend shipped**
(`C:\Dev\GammaFlow`): `prompts/strategy_prompt.md` + `reassessment_prompt.md` decomposed (FIXED vs
PERSONA, annotation appended; bodies byte-identical) with the **A1 move** (trader-disposition lifted
out of the universal risk floor); new `src/core/personas.py` (decomposed template + 7 built-in
`PersonaDefinition`s + A1 disposition/objective/risk maps + reference `assemble()`); read-only
`GET /api/personas` serving the template + presets. `signals.py`/`generate_signals`/
`_opportunity_score`/`state_fingerprint`/`evaluate_gate`/engine **NOT modified** (the enforcement
boundary). **No `meta.handoff`, no `?persona=` param, no LLM, SSE untouched.** Verified: Default ==
today **verbatim** (entry+reassessment); `market_state`/`signals`/`ai_eval` **byte-identical** across
`?persona=A/B/none` (param ignored) with **no recompute**; greed line only under Default + conservative;
FIXED floor/schema/Add-cap present under every persona; hostile emphasis note stays in its slot.
Glossary + PROJECT_CONTEXT refreshed.
**Resolved (filed in INTERFACE amendment):** (1) transport = read-only `GET /api/personas` (the
contract shipped no transport for the separate-repo FE); (2) **contract inconsistency** — the A1 map
gives conservative the *softened* text, but the prose + BACKEND Verification require conservative to
contain "prone to greed"; resolved by the **superset** clause (harsh phrase + verbatim map text).
Flag for clean-up amendment if conservative was meant to be softened-only.
**Frontend SHIPPED** (`C:\Dev\gammaflow-web`, committed `6dcdbe1`/`1233718`): `apps/dashboard/src/app/
personas/` — `PersonaDefinition`/`Handoff` types; a **FE-embedded faithful decomposed template**
(canonical strategy/reassessment prompts; Default byte-identical incl. greed line; A1 disposition slot
relocated) with `assembleHandoff` (pure + synchronous + default-prompt fallback); 7 presets (exact
UX §B copy) + client-local custom personas + `active_persona_id` persisted; `usePersona`;
`PersonaPicker`/`HandoffDialog` (Entry/Reassessment tabs, FIXED/PERSONA badges, invariance readout,
Copy)/`PersonaCustomizeForm` (binding caveat); toolbar `View AI hand-off` + visible/overridable DTE
pre-fill (one-shot, applied only on explicit navigation — no recompute on switch); ReassessCard
`Briefing:` label. Verified: materially different prompt per persona; Default verbatim; switching kept
the invariance readout identical with **zero `/api/ticker`|`/api/stream` calls** (devtools 3→3);
FIXED/PERSONA badges; hostile "ignore the Add cap" note stayed in its PERSONA slot; DTE pre-fill;
reload persistence. Conservative disposition fixed to the **superset** (contains "prone to greed").
**Reconciliation flag (FE↔BE seam):** the backend ships the canonical template + presets at
**`GET /api/personas`** (its chosen transport, filed as an interface amendment AFTER the FE's frozen
interface), but the FE **embeds** a faithful copy and assembles client-side (matching the user's
explicit "assemble client-side, no `meta.handoff`/`?persona=`" FE directive + the FE-rendered
"avoid round-trip" rationale). Output is correct + verified, but the canonical preset/prompt data is
now **dual-sourced** (drift risk). **Recommended follow-up:** have the FE hydrate presets/template
from `GET /api/personas` with the embedded copy as offline/assembly-failure fallback — single-sources
the operator-editable canonical data. (Not blocking; behaviour is correct today.)
**Archived** under `_archive/` (per DoD).
**Deferred (specified, not built):** multi-device sync, operator-shared persona library, richer
customization, per-persona acceptance analytics.

## 7b. In-app AI recommendations (SHIPPED + ARCHIVED — both lanes done)
Contracts archived at `.claude/contracts/_archive/ai-recommendations/`. GammaFlow's **first in-app LLM
call** — a best-effort, isolated, gated, **advisory consumer** of already-computed state. **Demoted the
`ai-external-no-llm` canon** (system-7, narrowed not erased — CONTEXT §8 + DECISION_LEDGER "Demoted").
**Backend** (`C:\Dev\GammaFlow`, commit `eec3a3a`): new one-way-leaf `src/core/ai_recommendation.py`
(`signals`/`engine`/`live`/`darkpool` don't import it) — `LLMProvider` seam (Anthropic forced tool-use
structured output; `StubLLMProvider` for keyless/no-cost verify), read+serialize state exporter (no
recompute), `ai_eval`-derived gating + 60s cooldown + 50/day cap (env-configurable); `POST
/api/recommendation/{ticker}` (best-effort, always-200 + `status`), `GET …/export/{ticker}` (no-LLM floor,
404 if un-fetched), `GET …/status/{ticker}`. Server-side `ANTHROPIC_API_KEY` (never in browser, gitignored).
Verified live: conformance 4/4, score/tier/`state_fingerprint` byte-identical, forced fault → 200 + clean
status (bundle/SSE intact), import-boundary AST-checked, egress/404. **Frontend** (`C:\Dev\gammaflow-web`,
commits `42212f5` + `a2f6ae3`): `apps/dashboard/src/app/ai-rec/*` (`AiRecPanel`, `StateExportDrawer`,
`useAiRecommendation`, `copy`, `prefill`) — the 12-state rec surface, gating/cap/availability UI from
`/status`, **Accept** → the shipped `TradeEntryDialog` prefill seam (paper-sim, editable, mandatory
confirm, `SIMULATED`), manual export floor; persona from canonical `GET /api/personas`; new `@org/api`
fetchers. Tests: `ai-rec.spec.tsx` (T1–T18 + E1–E7, incl. E3) — `nx test dashboard` 26/26 green. **QA
(GATE Q)**: verified by a fresh qa-verify on **Sonnet** (de-correlated) — 18/18 ACs, conformance 4/4,
invariants clean; initial FAIL on the missing E3 named test (the AC↔test traceability rule catching a gap
a green suite hid) RESOLVED + re-verified → **PASS**. **GATE Z**: the conformance-spec convention was
reconciled to **standalone-file canonical** (`.claude/tools/conformance/ai_recommendations.json`;
`interface_conformance.py` gained POST-body support); the full doc/linter standardization is tracked as
BACKLOG §E **system-12**.
**Deferred seams (specified, not built):** BYO-key / per-user credentials (provider-port-like seam);
in-app LLM **reassessment** of an open position (entry only shipped — the position-aware sibling reuses
the same surface); token streaming (whole-rec render shipped); AI-rec acceptance/outcome analytics
(leverages the ghost-trade decision history); a vendor/model swap behind the LLM seam.

## 7c. Positions portfolio (SHIPPED + ARCHIVED — both lanes done)
Contracts archived at `.claude/contracts/_archive/positions-portfolio/`. FE-only (`NO_BACKEND_CHANGE`)
multi-position evolution of the ghost-trade tracker. **Frontend shipped** (`apps/dashboard/src/app/
positions/`): flat id-keyed durable collection (loss-free v1→v2 migration); central all-positions +
per-ticker views; per-position P/L + Δ-since-entry + ephemeral session delta + a P/L **trend sparkline**
(reuses the latency-trend ring buffer); grouping (ticker / strategy=long-call vs long-put / expiry) + P/L
subtotals; customization (columns/sort/filter, table↔card, density) + **durable named saved views**;
closed/history view; the entry simulator's 3 fill modes (manual / market / **limit**) with a
`pending→filled/cancelled` resting-limit that fills only on a **live cross at the limit price** (never off
a frozen mark). Two tabs: **Simulated** (functional) + **Live** (a **zero-import LOCKED** "coming soon /
not connected" placeholder — no broker, no order path). Reuses `ghost-trade/mark.ts` (P/L) + `GET
/api/contract` + SSE `mid`. **QA (GATE Q)** verified on Sonnet (de-correlated from the Opus builder):
41/41 ACs PASS, 130 tests green, AC↔test traceability confirmed, invariants clean. **GATE S promoted
`no-real-order-path`** into canon (2 binding: ai-recommendations + this — see §9 + DECISION_LEDGER).
Backend untouched. **Deferred seams (specified, not built):** the real **Live** broker integration
(blocked on the vendor/broker decision — §1; the locked tab marks the seam); same-contract merge/average
(chose stack); closed-position pruning/archive policy; multi-leg strategy grouping beyond long-call/put.

## 7d. Convexa multi-page shell + landing (SHIPPED + ARCHIVED — FE-only)
Contracts archived at `.claude/contracts/_archive/app-shell-landing/`. Feature 1 of the **owner pivot**
(positions-centric, brokerage-connected, multi-page — see BACKLOG "Last GATE I — OWNER PIVOT"). The
**rebrand to "Convexa"** (UI wordmark only) + the IA restructure: single `BrowserRouter`/dark-MUI theme —
`/` Convexa landing (dark-fintech splash, hero hook, convexity-curve motif, value cards, honest
non-navigating "coming soon" brokerage + Scanner), a persistent `AppShell` nav (Ticker/Positions/Scanner;
`/_ops/metrics` off-shell + unlinked), the **relocated** `/ticker/:symbol` GEX viewer + `/positions`
portfolio (relocate-don't-change — internals byte-identical), a static `/scanner` stub. Live SSE
**page-scoped** to the Ticker page (open on mount / close on nav-away / reopen on return / never
double-subscribe); positions store persists across nav. `NO_BACKEND_CHANGE`; scoring path untouched.
**QA (GATE Q)** on Sonnet (de-correlated): 42/42 ACs PASS, 171 tests green, no regression of the
pre-existing suites, invariants clean, brand-UI-only (durable keys `gammaflow.positions.v2` /
`gammaflow.ghost-trade.v1` unchanged). **GATE Z** (RESOLVED): standalone `/positions` degraded-mark
wording reuses the existing `PositionRow` wording rather than editing the forbidden internal — observable
behavior satisfies AC-PosLive-2/3/4 (a one-off carve-out, not a demotion). **Deferred / next in the
program:** `scanner` (Track A, next — revisits the single-ticker decision, needs perf design),
`positions-page-expansion` (AI recs on positions + open-sim-trade), and the gated `broker-connect`
(Webull-direct read-only positions → the `no-real-order-path` narrowing + the Security/system-6 role).

## 7e. Ticker-page load experience (SHIPPED + ARCHIVED — both lanes done)
Contracts archived at `.claude/contracts/_archive/ticker-load-experience/`. Owner request 2026-06-25
(redirect off `scanner`): make `/ticker/:symbol` load fast + feel instant + show a trusted price. Measured
first (live Massive feed): warm cache hit ~7ms but cold miss p50 3.5s (worst 9.6s), of which `vendor_fetch`
~87% and the SINGLE options-chain call ~75% (~54 serial paginated round-trips for SPY's 13k contracts).
**Backend** (`apps/api`, commit `10971f3`): new `src/core/chain_store.py` shared **chain-INPUT** store —
`LiveSession._refresh_chain` produces the FULL unfiltered `market_data`; the REST cold-miss path
short-circuits the chain fetch to it (freshness-gated, best-effort fallback, read-only, no behavior change
without an active session) yielding cold **7.8s to 1.2s** on an active session; the 3 vendor fetches run
concurrently (per-stage isolation preserved); request-coalescing on `_serve`; SSE emits live `last_trade`
(display-only); `STALE_AFTER_SECONDS` default 1200 to 120 (+ `CHAIN_PREWARM_MAX_AGE_SECONDS`); pre-warm
recorded honestly as a `shared_hit`. **Frontend** (`apps/dashboard` + `libs/api`): skeleton-first load
(per-source skeletons, cold-load distinct from offline and from "unavailable this cycle"); secondary "Last
trade" readout (4 honest states, degrades with live fields); relabeled the mislabeled `last $X` chip to
`mid $X`; `LiveUpdate.last_trade` type. **QA (GATE Q)** on Sonnet (de-correlated): 26/26 ACs PASS,
conformance 2/2, `nx test dashboard` 196/196, AC-Invariant-1 byte-identical (score 44, fp `b5c70f93c2d5`)
independently re-proven. **GATE S narrowed** the §9 "live spot = NBBO mid / do not add last-trade" resolved
decision to "mid stays the anchor; a display-only last-trade readout may be added" (system-7). Additive —
score/tier/gate/`state_fingerprint` byte-identical. **Deferred seams (named, not built):** chain-pagination
parallelization (vendor-capability-blocked, adapter-internal); `engine.process_gex_profile` vectorization
(~10% CPU); any bundle-splitting (permanently gated behind the request-coalescing now added). **Latent
finding logged (BACKLOG §B):** pre-existing ~9th-sig-digit float-ordering jitter in `net_vanna`/`net_charm`/
`net_volga` (does NOT affect `opportunity_score`/score inputs/`state_fingerprint`; engine untouched here).

## 7f. User accounts — auth + sessions + per-user settings (SHIPPED + ARCHIVED — both lanes done)
Contracts archived at `.claude/contracts/_archive/user-accounts/`. Owner-directed 2026-06-25: the project's
**first stateful backend surface + first credential store**. Advances the OWNER PIVOT (accounts are the
prerequisite for Track B `broker-connect`).
**Backend** (`apps/api`): new one-way-leaf `src/auth/` subpackage (`ports.py` 3 storage ports +
`sqlite_store.py` single-shared `:memory:` adapter + env factory `__init__.py` mirroring the provider port;
`passwords.py` argon2; `cookies.py` HMAC signed cookie; `service.py` signup/login/logout/session-resolution
+ settings + Google identity mapping; `google_oauth.py` Authorization-Code flow **config-gated OFF**;
`errors.py`; `router.py` `/api/auth/*`). `main.py` mounts the router (sole boundary that imports the leaf),
wires the auth gate **outermost** on `POST /api/recommendation/{ticker}`, and adds `POST
/api/positions/sim-trade/gate`. New deps `argon2-cffi` + `authlib`. Verified: conformance 2/2, score
byte-identical anonymous-vs-signed-in (score 24, fp `79373ef9194e`), import-boundary 0/12 scoring modules
import auth, 47 runtime assertions, security-floor log scan clean.
**Frontend** (`apps/dashboard` + `libs/api`): `src/app/auth/` (AuthContext degrade-to-anonymous; login-by-email
/ signup; GoogleButton present-but-disabled-when-unconfigured; useGate **server-gate-before-write**; the
3 light-pref Settings + ThemeProvider) + gating wired into Positions writes + the ai-rec ask-AI path; `@org/api`
auth surface (incl. `simTradeGate`). `nx test dashboard` 246/246 + `@org/api` 7/7.
**QA (GATE Q)** on Sonnet (de-correlated from the Opus builders): initial **FAIL on AC-E7** — the Positions
sim-trade write gate was **FE-only** (never called the server endpoint) → **GATE Z bounce to Frontend** →
FE wired `POST /api/positions/sim-trade/gate` into the write path (403 aborts the local write) → **GATE Q
RE-RUN PASS** 30/30, conformance 2/2, both suites green, AC-E7 → 3 named tests.
**GATE Z (cross-feature, resolved):** the auth gate makes `POST /api/recommendation/{ticker}` return 403 to
anonymous, so the archived `ai_recommendations.json` conformance spec (which asserted anonymous 200) was
amended — that POST removed from the **anonymous** sweep (now verified under user-accounts' signed-in tests);
the export/status/personas reads stay anonymous-200 and are still checked.
**GATE S:** the three touched promoted keys (`additive-keeps-score-byte-identical`,
`best-effort-isolated-or-null` WITH the auth-error-class carve-out, `no-real-order-path` → now 3 binding)
each gained an instance → **no new graduation**. The informal "stateless server" property is **narrowed to
the trading path** (auth = a contained, swappable state store outside it — a descriptive narrowing, NOT a
Promoted-canon demotion; single-sourced in CONTEXT §5). New watch-list key `server-side-gate-enforcement`.
**Deferred seams (specified, not built):** provision the real **Google Cloud OAuth client** (then Google
flips on, config-only) + the account-linking **explicit-confirm** consent UX; the **persistent-DB adapter**
(behind the existing ports — replaces the reset-on-restart in-memory store; set `AUTH_SESSION_SIGNING_KEY`
for cross-restart cookies); **password-reset / email-verification** (Future — needs durable store + email
sender); **"log out everywhere"** + multi-device session sync (SessionStore supports revoke-all); migrating
the **heavy client-local stores** (positions portfolio, saved views) to be account-scoped server-side; and —
on the **go-live trigger** (real persistence / public exposure) — the deferred **Security/red-team role
(system-6)** + first-class credential handling.

## 7g. Full Convexa rebrand (SHIPPED + ARCHIVED — both lanes + conductor doc sweep)
Contracts archived at `.claude/contracts/_archive/rebrand-convexa/`. Owner-directed 2026-06-28: complete the
GammaFlow→Convexa rebrand — extend it from **UI-only to the whole codebase** (134 refs / 51 files).
**REVERSES the app-shell-landing "Convexa = UI-only / don't rename code/keys" decision** (§7d; CONTEXT
§1/§6) — a feature decision, updated in place, NOT a Promoted-canon demotion.
**Frontend** (`apps/dashboard` + `libs/api`): new reusable `apps/dashboard/src/app/durable/resolveDurable.ts`
migrate-on-read helper (read-new-else-old, promote-forward-once, never-delete, idempotent, never-throw) wired
into all 4 durable stores, flipping each key `gammaflow.*`→`convexa.*` and keeping the `gammaflow.*` literal
ONLY as the migration source; the positions store keeps the 4-case brand×version chain (the legacy
`gammaflow.ghost-trade.v1` still lands whole in `convexa.positions.v2`); `libs/api/src/lib/gammaflow.ts`→
`convexa.ts` (consumed via `@org/api`, zero export churn); brand strings + `convexa-` download stems; stale
brand-assertion tests reconciled. `nx test dashboard` 283/283 (+37), `@org/api` 7/7.
**Backend** (`apps/api`): cosmetic only — logger "Convexa", FastAPI title "Convexa Volatility API",
ContextVar `convexa_request_trace`, comment/prompt/glossary prose; **no env/field/path/`DATA_DIR` renamed**
(nothing orphaned); engine byte-identical; conformance 8/8.
**Conductor doc sweep** (outside both lane fences): root `README.md`, `CLAUDE.md`, `docs/SYSTEM_ANALYSIS.md`,
`docs/blog/*` (+ rebuilt HTML), `.claude/project.json` `project_name`, and the CONTEXT §1 brand line.
**QA (GATE Q)** on Sonnet (de-correlated): **23/23 ACs PASS**, conformance unchanged, both suites green;
`[loss-free durable migration]` proven (carried-whole per store, the cross-brand v1→v2 chain, idempotency,
never-delete/rollback-safe, corrupt→no-throw-no-wipe, absent→clean-new-user). **STAYS unrenamed (non-goals):**
`@org/*` scope, `DATA_DIR`, the local working folder `C:\Dev\gammaflow-web`, archived/ledger history.
**GATE S:** GitHub repo renamed `gammaflow`→`convexa`; dev servers restarted on the renamed code. New
watch-list key `loss-free-durable-migration`. **Deferred/known:** the stale `gammaflow-web` references in
`apps/api/README.md` (pre-merge "separate repo" wording) — minor doc cleanup, not blocking.

## 7h. Hybrid bring-your-own AI key (SHIPPED + ARCHIVED — both lanes done)
Contracts archived at `.claude/contracts/_archive/byo-ai-key/`. Owner-directed 2026-06-29: a **hybrid**
per-user AI-key model realizing the deferred ai-rec BYO-key seam (§7b). Each signed-in user stores their own
Anthropic key (encrypted); the AI rec calls with THEIR key (own-key-first, even for admins). The shared
`ANTHROPIC_API_KEY` gives a free allowance ONLY to admin users (`AI_REC_ADMIN_EMAILS`; `AI_REC_ADMIN_FREE_DAILY`
default 3/day); regular users get 0 → must BYO. **Five resolution states** incl. the owner-added
`shared_key_unconfigured` (admin, allowance left, but no shared key set up — the common state until the shared
key is configured).
**Backend** (`apps/api`): per-request key resolution at the `main.py` boundary (own → admin-shared-if-configured
→ none with distinguished reason); new `UserCredentialStore` (4th port, in-memory) + `src/auth/crypto.py` Fernet
leaf keyed by gitignored `AI_KEY_ENCRYPTION_KEY` (ephemeral fallback); `/api/auth/ai-key` GET/PUT/DELETE
(write-only, masked hint only); per-identity metering (per-admin daily allowance, own-key unmetered); admin
allowlist; new dep `cryptography`. The AI rec stays a one-way leaf — score/tier/`state_fingerprint`
byte-identical (24 / actionable / `79373ef9194e`) across all 6 conditions; conformance 2/2 + no regression;
security-floor log scan clean.
**Frontend** (`apps/dashboard` + `libs/api`): the 5-state AiRecPanel + the write-only "AI key" Settings section
(masked, Replace/Remove, no reveal) + the `@org/api` credential fns/types. `nx test dashboard` 313/313,
`@org/api` 13/13; egress proven (the raw key rides only the PUT body, never any response/DOM/console).
**QA (GATE Q)** on Sonnet (de-correlated): initial FAIL on **AC-19** (admin-removed-from-allowlist had no named
test though the behavior worked — AC↔test traceability) → GATE Z bounce → FE added the test → **RE-RUN PASS
26/26**.
**GATE S:** `server-side-gate-enforcement` GRADUATED (2 binding: user-accounts AC-E7 + this) → Promoted canon
(CONTEXT §5 + §9). New watch-list key `secret-encrypted-at-rest`. **Deferred/known:** `system-6` Security/
red-team still deferred (encrypt+hygiene floor now) — credential custody makes byo-ai-key its eventual first
client at go-live; `interface_conformance.py` is cookieless so the auth-gated key endpoints are verified by
runtime/FE tests not the sweep (a small build-system follow-up: teach the tool cookie/bootstrap auth);
`AI_KEY_ENCRYPTION_KEY` must be set to a stable value once a persistent store lands (else stored keys reset).

## 7i. Containerize the apps (SHIPPED + ARCHIVED — infra fast-path, author-only)
Contracts archived at `.claude/contracts/_archive/containerize-apps/`. Owner-directed 2026-06-29, step 1 of
the infra/deploy program. **GATE-M-style infra fast-path** (architect → one infra build pass → conductor
static review; PM/UX skipped — no product surface, `NO_INTERFACE_CHANGE`). **7 new files, no app-code change:**
`apps/api/Dockerfile` (python:3.12-slim, WORKDIR /app, explicit COPYs of `main.py`/`src`/`prompts`/
`market_state_glossary.md` — no `COPY . .`, non-root uid 10001, writable `/app/data`, Python-socket
HEALTHCHECK on :8000, `uvicorn main:app --host 0.0.0.0` no-reload), `apps/dashboard/Dockerfile` (multi-stage:
`node:20-alpine` → `npm ci` → `npx nx build @org/dashboard` at **repo-root context** because `@org/api` is
source-consumed → `nginxinc/nginx-unprivileged` serving `apps/dashboard/dist` with SPA fallback + SSE-safe
`/api`→`api:8000` proxy), `apps/dashboard/nginx.conf`, root + `apps/api` `.dockerignore` (the structural
`[no-secrets-in-image]` guard — exclude `.env*`/`.venv`/`conf/token.txt`/`node_modules`/`.git`/`dist`/`.nx`/
`data/`/caches; root keeps `libs/`+lockfile+nx config IN context), root `docker-compose.yml` (one-command
local stack; backend secrets via runtime `env_file: ./apps/api/.env`, NEVER baked; `web depends_on api:
service_healthy`), and a value-less `apps/api/.env.example` (tracked via a `!apps/api/.env.example` gitignore
negation).
**Verification:** **Docker is NOT installed in this environment** → the artifacts were authored
correct-by-construction + the architect's §8 review checklist run by the executioner + a **conductor static
review** (secret-leak scan clean; both `.dockerignore`s + explicit-COPY backend confirm no secret can enter a
layer; non-root + healthcheck + correctness PASS; `git status` shows only new files). The **runtime
build-verify is DEFERRED to the owner installing Docker Desktop** — `docker compose up --build` then open
http://localhost:8080 (spot checks: `docker compose exec api whoami`→appuser, `docker history convexa-api`→
no `.env`/`.venv` layer, restart→state resets). New ledger watch-list key **`no-secrets-in-image`**.
**Known follow-on (documented, NOT solved):** both containers are **stateless / restart-resettable** — the
in-memory SQLite resets all accounts/sessions/AI-keys and isn't shared across replicas → **`persistent-db`
is the required NEXT feature** (in-memory → managed Postgres behind the existing store ports + a stable
`AI_KEY_ENCRYPTION_KEY`), then **`deploy`** (host pick) → **activate Security/red-team (system-6)** at
go-live (the adversarial review of the deploy/secret-handling artifacts lands there).

## 7j. Persistent datastore — in-memory → Postgres (SHIPPED + ARCHIVED — backend infra fast-path)
Contracts archived at `.claude/contracts/_archive/persistent-db/`. Owner-directed 2026-06-29, step 2 of the
infra/deploy program. **GATE-M-style infra fast-path** (architect → backend build → conductor static review;
PM/UX skipped, `NO_INTERFACE_CHANGE`/`NO_UI_CHANGE`). Adds a **persistent Postgres adapter behind the
existing 4 auth ports** so accounts/sessions/settings/encrypted-AI-keys survive restarts + span replicas.
**Backend** (`apps/api`, new files + edits): new `src/auth/postgres_store.py` (psycopg3 **sync** raw-SQL,
mirrors `sqlite_store.py` statement-for-statement; single `psycopg_pool.ConnectionPool`; idempotent
`CREATE TABLE/INDEX IF NOT EXISTS` bootstrap; 4 tables w/ Postgres dialect — `%s`, `ON CONFLICT`,
`DOUBLE PRECISION`, native `BOOLEAN`, `email_lower`/`google_sub` UNIQUE, `idx_sessions_user_id`; **ciphertext
+ last4 columns only**); `__init__.py` env factory gains `ACCOUNT_STORE=postgres` (+ `DATABASE_URL`,
`DATABASE_POOL_MAX`), **in-memory stays the default**; `service.py` hardened so `get_settings`/`write_settings`
map a store fault into the auth-class 503 (and `router.py` GET `/settings` now catches `AuthError` so it
surfaces correctly — the one file beyond the original list, transparently flagged, no interface change);
`requirements.txt` += `psycopg[binary]` + `psycopg-pool`; `.env.example` += `DATABASE_URL` + a prominent
**STABLE-KEY** block (`AI_KEY_ENCRYPTION_KEY`/`AUTH_SESSION_SIGNING_KEY` must be stable in persistent mode or
durable encrypted keys/cookies break on restart). `sqlite_store.py`/`ports.py`/`crypto.py`/`main.py`/scoring
all untouched.
**DB-outage fail mode:** the adapter raises (never false-success) → existing machinery yields 503
`auth_unavailable` (signup/login/gated) or anonymous (who-am-I); the **anonymous bundle/SSE/trader path
never touches the DB and stays fully up** — auth fails closed.
**Verification:** **no Postgres in the dev box** → live-DB verify DEFERRED; verified by the **in-memory-
default conformance (PASS, no regression)** + statement-level SQL parity review + ciphertext-only/no-crypto-
import/leaf-boundary AST checks + a secret scan (clean — only the value-less `DATABASE_URL` doc placeholder).
**GATE S:** `secret-encrypted-at-rest` GRADUATED into canon (2 binding: byo-ai-key + this — ciphertext-only
held across the new store); `no-secrets-in-image` at 2 instances but **held to `deploy`** (governs published
artifacts). **Owner runtime-verify (when a `DATABASE_URL` exists — local Docker Postgres or managed):** set
`ACCOUNT_STORE=postgres` + stable keys → sign up / save settings / save an AI key → **restart → still there**;
+ a 2-replica share test + a Postgres-outage drill. **Deferred seam:** the per-admin AI metering counters are
process-local (not behind the stores) → not shared across replicas — a future centralization item, out of
scope here. **Next:** `deploy` (Railway backend + Cloudflare Pages frontend; cross-origin `/api` wiring) →
Security/red-team (system-6) at go-live.

## 7k. Deploy — Railway + Cloudflare Pages + system-6 go-live review (SHIPPED artifacts; live-deploy owner-applied)
Contracts archived at `.claude/contracts/_archive/deploy/` (incl. `SECURITY_REVIEW.md`). Owner-directed
2026-06-29, step 3 of the infra program. Backend → **Railway** (the `apps/api/Dockerfile` + managed Postgres
→ `DATABASE_URL`, `ACCOUNT_STORE=postgres`); frontend → **Cloudflare Pages**. Cross-origin `/api` = a
**streaming Cloudflare Pages Function** (`apps/dashboard/functions/api/[[path]].ts`, reads `API_ORIGIN` env;
SSE-safe; relative-`/api` client unchanged). Infra fast-path (architect → infra build → **system-6**).
**Repo changes (R1–R4):** R1 Dockerfile CMD+HEALTHCHECK honor `$PORT`; R2 `main.py` CORS env-gated
(`ALLOWED_ORIGINS`, localhost default); R3 the Pages Function; R4 edge-404 of `/api/_metrics`. No scoring/
engine change (conformance PASS, no regression).
**system-6 Security/red-team — FIRST ACTIVATION** (the deferred role, triggered by going public; run on a
different model): verdict **GO-WITH-REQUIRED-FIXES**. **3 HIGH closed before ship:** HIGH-1 token-gate
`GET /api/_metrics` (`METRICS_SECRET_TOKEN`, constant-time compare, reachable-via-direct-Railway-URL closed);
HIGH-2 per-IP rate-limit on the anon cost-bearing `/api/ticker`+`/api/stream` (new `src/core/ratelimit.py`,
`PUBLIC_RATE_LIMIT_PER_MIN`, owner-chosen approach; 429 before any vendor call; fail-open leaf; IP via
`CF-Connecting-IP`/`X-Forwarded-For`); HIGH-3 conspicuous startup WARNING when `ACCOUNT_STORE=postgres` + a
stable key is missing. All runtime-demonstrated + conductor-spot-checked. **Fast-follows (NOT go-live
blockers, in `SECURITY_REVIEW.md`):** 3 MED (CORS localhost-default-in-prod, `AUTH_COOKIE_SECURE` misconfig
risk, no SSE connection ceiling), 3 LOW (public OpenAPI docs, broad CORS methods/headers, Google OAuth state
cleanup). **GATE S graduated `no-secrets-in-image`** (3 binding — real registry push). **PENDING OWNER
ACTION (the live deploy itself):** apply the runbook — create the Railway service + Postgres, set the env/
secrets (incl. the new `METRICS_SECRET_TOKEN` + `PUBLIC_RATE_LIMIT_PER_MIN` + **stable**
`AUTH_SESSION_SIGNING_KEY`/`AI_KEY_ENCRYPTION_KEY` + `ALLOWED_ORIGINS`), set the Cloudflare Pages build +
`API_ORIGIN`.
**✅ LIVE 2026-06-29** — deployed end-to-end and verified: **frontend https://convexa.pages.dev** (Cloudflare
Pages) → Pages Function proxy → **backend https://convexa-production.up.railway.app** (Railway; app bound to
`$PORT`=**8080**; domain target port corrected 8000→8080) → **Postgres**. Smoke test PASS: SPA 200;
`convexa.pages.dev/api/auth/session` returns the real backend JSON through the proxy (Postgres-backed;
`google_available:false` since Google OAuth is unconfigured — correct). The deferred Docker/Postgres runtime
verifications from `containerize-apps`/`persistent-db` are now exercised for real on Railway. **Remaining
hardening (NOT blocking — post-launch):** set `ALLOWED_ORIGINS=https://convexa.pages.dev` in Railway (the
proxy is same-origin so CORS isn't hit, but lock it per the security review); the 6 MED/LOW security
fast-follows (`_archive/deploy/SECURITY_REVIEW.md`); CI/CD; custom domain; prerender/SEO (BACKLOG §B);
provision Google OAuth creds to enable "Continue with Google".

## 7l. Convexa redesign — full FE re-skin to the Figma DS (SHIPPED + ARCHIVED — merged to main)
Contracts archived at `.claude/contracts/_archive/convexa-redesign/`. A **presentation-only** full-app
re-skin to the Figma dark-fintech design system, delivered as ~30 commits on the `convexa-redesign` branch
(GATE-V-per-surface: implement-from-Figma). Surfaces: theme/token bridge (`theme.ts`/`tokens.ts` +
`scripts/sync-figma-tokens.mjs`), Landing, global nav/shell + Footer, Settings + Auth modal (`AuthModal`
component set), Scanner, Positions (PositionRow/PositionCard/PositionsPanel), the Ticker viewer
(`TickerDashboard`→`ticker/sections/*`: Toolbar/Header/LiveTape/DealerPositioning/GexStrikeProfile[vertical
diverging chart]/TermStructure/FreshPositioning/OffExchangeBlocks/Setups/StatTile/TintChip), the AI-rec
panel, `StateExportDrawer` (Figma 137:1639, theme-native), and `TradeEntryDialog` (Figma 118:1446 —
gained a Manual/Market/Limit fill-mode control). Plus an **app-wide contained-button treatment** (deep
`#1d6fe0` + white on filled primary via a `MuiButton` `root`+`ownerState` override — MUI 9.1.1 dropped the
`containedPrimary` slot) and Ticker quick UX wins (compact `$B/M/K` formatting + a `FreshnessLine`).
**Owner scope cut:** the full-page `/auth` route was DROPPED (the `AuthDialog` modal stays the auth surface).
**`NO_BACKEND_CHANGE`** — `apps/api` diff vs main is EMPTY, so score/tier/`state_fingerprint` are
byte-identical structurally. **QA (GATE Q)** on a fresh de-correlated qa-verify: **PASS** — nx test
dashboard 425/425, `@org/api` 13/13, lint 0 errors, `tsc --noEmit` clean, **`nx build @org/dashboard`
succeeded**, all invariants hold (no-real-order-path, live-vs-static, token discipline, no demo toggle).
**Pre-QA fix:** a pre-existing build blocker TS17001 (duplicate `sx` in `SettingsPage.tsx:242`) was found +
fixed (`5bd4358`) — Vitest doesn't typecheck, so only `tsc`/`nx build` caught it. Merged to `main` at GATE S.
**Deferred (BACKLOG §B "Ticker UX quick wins"):** distance-to-level tiles, recent-ticker chips, sticky
header, input ergonomics. **Known non-blocker:** a >500kB JS chunk-size build advisory (code-split later).
**Owner Figma follow-up (design file, not code):** publish the re-themed MUI kit → update the library → set
screen frames to dark mode (per `THEME_TOKENS.md`).

## 8. Smaller deferred items (proposed, not implemented)
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

## 9. Resolved decisions (do NOT revisit)
- **Live spot ANCHOR = NBBO mid** — smoother, better for anchoring; the mid stays the sole anchor for
  the headline, levels, and live flip. **Narrowed 2026-06-25 (ticker-load-experience GATE S, system-7):**
  a **display-only live last-trade readout** is now ALSO surfaced on the SSE payload beside the mid
  (broker reconciliation; Webull shows last-trade, hence small benign differences). Last-trade is a READOUT
  — it drives nothing on the anchor/levels/flip path. Was: "Keep mid; do not add last-trade." Letting
  last-trade drive the anchor is a GATE-Z reversal. (Prose single-sourced in PROJECT_CONTEXT §5.)
- **Gamma sourcing** — vendor gamma for walls/profile, analytic BS for the flip; the divergence
  is immaterial. Don't "fix" it via interpolation or borrow-rate calibration.
- **Dark pool** — context only, capped confluence, toggleable; never a directional "smart money"
  signal (off-exchange includes internalized retail; prints have no reliable side).

### Standing build invariants (promoted from the Decision Ledger 2026-06-22 — do NOT revisit)
> Graduated by recurrence (`.claude/DECISION_LEDGER.md`); full prose single-sourced in
> `PROJECT_CONTEXT.md` §5. Reopen only via GATE Z.
- **`[best-effort-isolated-or-null]`** (5 features) — added computations fail to null/omitted, never an
  HTTP error; bundle + SSE intact.
- **`[additive-keeps-score-byte-identical]`** (4 features) — additive features keep gate /
  `opportunity_score` / `opportunity_tier` / `state_fingerprint` byte-identical; never a scoring input.
- **`[live-vs-static-isolation]`** (4 features) — live-derived UI degrades on SSE drop; static reads
  keep rendering the last bundle.
- **`[operator-vs-trader-path-separation]`** (promoted 2026-06-23, 2 binding) — operator/diagnostic
  surfaces stay off every trader/bundle route + unlinked from the trader UI; read-only + side-effect-
  free (no vendor fetch / recompute / cache mutation / trader-route call). See PROJECT_CONTEXT §5.
- **`[no-real-order-path]`** (promoted 2026-06-24, 2 binding) — "action" never reaches a real broker/
  order path: a simulated feature stays `SIMULATED` (paper) + confirm; a not-yet-built real surface
  (e.g. a "Live" tab) ships as a non-functional placeholder (no broker / order path / real-position
  source). Reopen only via a deliberate owner + vendor decision (GATE Z). See PROJECT_CONTEXT §5.
- **`[server-side-gate-enforcement]`** (promoted 2026-06-29, 2 binding) — an access gate on a state/
  cost-bearing action is enforced **server-side** (boundary of record), never FE-only; a bypassed/absent
  client check must still be rejected by the server. (user-accounts AC-E7 catch; byo-ai-key credential +
  AI-rec gating.) See PROJECT_CONTEXT §5.
- **`[secret-encrypted-at-rest]`** (promoted 2026-06-29, 2 binding) — a stored recoverable secret is
  encrypted at rest (symmetric, server-side key, not hashed), persisted ciphertext-only (crypto before the
  store), never logged/returned/browser; write-only + rotate/delete; decrypt-fail ⇒ no-usable-secret, no
  leak. (byo-ai-key encrypted AI key; persistent-db held the ciphertext boundary into Postgres.) See
  PROJECT_CONTEXT §5.
- **`[no-secrets-in-image]`** (promoted 2026-06-29, 3 binding) — a build/deploy artifact carries no secret;
  all config/secrets injected at runtime via env (host Variables / Pages env), never committed/baked/
  hardcoded; images run non-root. (containerize-apps Dockerfiles+.dockerignore; persistent-db `DATABASE_URL`;
  deploy real Railway push + Pages Function `API_ORIGIN`.) See PROJECT_CONTEXT §5.
