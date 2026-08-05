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
**Deferred seams (specified, not built** — *audited 2026-07-28; one has since shipped, marked inline*
**):** ~~BYO-key / per-user credentials (provider-port-like seam)~~ **→ BUILT: shipped as §7h
`byo-ai-key` (2026-06-29)**;
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
(chose stack); closed-position pruning/archive policy; ~~multi-leg strategy grouping beyond
long-call/put~~ **→ BUILT: shipped as §7x `positions-legs` (2026-07-28) — the 22-member `StructureKind`
plus grouping on the Structure axis. Audited 2026-07-28.**

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
flips on, config-only) + the account-linking **explicit-confirm** consent UX; ~~the **persistent-DB
adapter** (behind the existing ports — replaces the reset-on-restart in-memory store; set
`AUTH_SESSION_SIGNING_KEY` for cross-restart cookies)~~ **→ BUILT: shipped as §7j `persistent-db`
(2026-06-29), and exercised for real on Railway at §7k. Audited 2026-07-28.**;
**password-reset / email-verification** (Future — needs durable store + email
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
proxy is same-origin so CORS isn't hit, but lock it per the security review); CI/CD; custom domain;
prerender/SEO (BACKLOG §B); provision Google OAuth creds to enable "Continue with Google".
**✅ THE 6 MED/LOW SECURITY FAST-FOLLOWS ARE ALL RESOLVED (2026-07-28).** `b136a77` — CORS now **fails
closed** (unset `ALLOWED_ORIGINS` was defaulting to the *localhost dev list* in prod, i.e. failing open;
it is now deny-all + a startup warning, so the Railway step above matters more, not less), `/docs`
`/redoc` `/openapi.json` are **opt-in** behind `ENABLE_API_DOCS`, and the CORS method/header wildcards
are narrowed. `86adf3b` — **S5c live-hub ceilings** (`MAX_LIVE_SESSIONS` 50 / `MAX_LIVE_SUBSCRIBERS` 500,
503 + `Retry-After`; sessions and subscribers capped **separately** so many viewers on ONE ticker — one
socket — are never refused while enumeration across many tickers is). S4b was an ops-doc gap, now in
`.env.example`; S6h needs no action while Google OAuth is config-gated off.
**⚠ AND A HIGH-SEVERITY BYPASS THE WORK SURFACED (`41a4c96`):** the go-live per-IP rate limiter guarded
only `/api/ticker` and `/api/stream`, while **`/api/market-data`, `/api/strike-profile`, `/api/signals`
and the friendly `/{ticker}`** all called the same `_serve` and hit the vendor **uncounted** — `/TSLA`
being both the cheapest enumeration route and where every stray crawler probe (`/health`, `/login`, …)
lands, since those are all valid 1–6-letter "tickers". All **6 of 6** vendor-cost routes now share one
per-IP budget; an audit script in the commit walks every route and proves it.
**Framing correction worth keeping:** the review (and my own summaries) called this a risk to the
"Massive bill". Massive is **flat-rate** (§1), so the real exposure was **vendor rate-limit exhaustion**
— which breaks the app for real users while it happens — not a metered invoice. Same fix, different why.

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

## 7m. Ticker UX-polish program + ai-rec structured display (SHIPPED + ARCHIVED — FE-only, catch-up QA)
Contract archived at `.claude/contracts/_archive/ticker-microinteractions/` (the only folder; `ticker-widgets`
+ `ticker-command-deck` were GATE-V fast-paths with no folder of their own). A post-`convexa-redesign` **Ticker
UX-polish program** — three stacked FE branches, developed as owner-approved GATE-V passes, fast-forwarded to
`main` (the planned pre-merge consolidation QA was skipped), **plus** one post-merge external-pipeline commit.
**Shipped:**
- **`ticker-microinteractions` (418315a):** live motion — value flash-on-tick (LiveTape + header, gated
  `isLive && !streamOffline`), pulsing live dot, one-time **staggered section reveal**, StatTile hover-lift, GEX
  mount-only bar-grow; shared `useReducedMotion` + `useFlashOnChange` hooks. (GEX live-line "glide" deferred —
  SVG x-attr animation unreliable.)
- **`ticker-widgets` (9c66d2e→75b967e):** shared `<Widget>` shell + `WidgetSelectionContext` → all 8 data
  sections wrapped into a bento board; feature-detected/reduced-motion-guarded/token-only cutting-edge CSS
  (container queries, `:has()`, `color-mix()`, `@property` selected-ring, View-Transition expand-peek,
  content-visibility); grip/⋮/add are **affordance-only coming-soon** (only expand functional) — the explicit
  seam for future real widget functionality.
- **`ticker-command-deck` (c481c38):** `CommandDeck.tsx` unifies toolbar + header + freshness into one chrome
  deck + a scroll-condensed sticky bar (shared `connectionChip()` keeps the sticky price/chip live-correct).
- **`c93dddc` (ai-rec structured display + dev seed, FE + additive BE):** structured AI-rec render (verdict hero
  + bundle-sourced "levels in play" + Why bullets + re-engage list) off additive `summary`/`key_points`/
  `reengage_when` LLM-schema fields (bounded/nullable in `_coerce_strategy`); availability fix (a BYO-key user on
  a keyless deployment is no longer blocked); `anthropic` SDK added to requirements; a **gated dev demo-account
  seed** (`SEED_TEST_ACCOUNT` default-off, **refuses postgres**, idempotent, `demo_seed` in who-am-i for login
  pre-fill — null in prod); a cosmetic `personas.assemble()` `sections`→`widgets` dead-key rename (no wire
  impact); the `ticker/sections/`→`ticker/widgets/` folder rename.
**Catch-up QA (GATE Q)** on a fresh de-correlated qa-verify (Sonnet): 15 PASS / **1 FAIL** — FRONTEND_EXECUTION_
CONTRACT §3's **staggered section reveal had silently regressed** (shipped in 418315a, dropped by 9c66d2e's bento
restructure; **zero test covered it**, so it passed a green suite). **GATE Z bounce → conductor inline fix**
(`Widget` `revealIndex` → inline `--widget-reveal-delay` → `widgetRise` `animation-delay`; removed the displacing
`@supports (animation-timeline: view())` scroll override; board feeds 0..7; **4 new guarding tests**) → **GATE Q
RE-RUN PASS 16/16** (nx test dashboard 486/486, tsc/lint/build green, render pass confirmed the 0→385ms cascade
in Chromium; runtime conformance 11/11; score/tier/`state_fingerprint` byte-identity re-proven cold==warm).
Commit `11e8ec3`, pushed to `main`. **GATE S:** no new graduation (all touched keys already canon; each gained
an instance); the AC↔test-traceability lesson (system-10) reinforced — a visual/motion AC with no named test is
where a later refactor silently regresses.
**Deferred seams (named, not built):**
- **Real widget functionality** — drag-reorder + resize + add/remove + per-widget config + persistence, hung on
  the `<Widget>` shell + `WidgetSelectionContext` seam (affordances exist; wire them). Owner-framed as the seam.
- **Deferred Ticker UX quick wins** (BACKLOG §B): distance-to-level tiles (highest value), recent-ticker
  quick-pick chips, sticky-header refinements, input ergonomics. (Big-number formatting + freshness line already
  shipped in the redesign.)
- **AI-rec "Accept" → tracked position — full build-out** (BACKLOG §B, raised 2026-07-01): Accept currently opens
  a pre-filled entry dialog; the full read→track loop (map rec structure/strikes/expiry/stop/target into a
  tracked `Position`, mandatory confirm, decision-record linkage, no_trade/absent-Accept rules) is its own
  feature. Held OUT of the structured-display change by owner.

## 7n. Owner 5-item product program — items 1–4 (SHIPPED + ARCHIVED; item 5 `scanner` queued)
Owner directive 2026-07-01 (BACKLOG "Last GATE I — 2026-07-01"). Items 1–4 shipped to `main`:
- **1 `light-mode-parity`** (`8abae03`, GATE V, no folder): mode-aware `extras` via `extrasFor(theme)`,
  ONE shared hatch, mode-aware ticker chrome; dark byte-identical.
- **2+3 `sim-entry-unification`** (`d704193`, archived): ONE shared `app/trading/TradeEntryDialog` on both
  pages; ghost-trade/positions dialogs + `GhostTradePanel` deleted (zero-importer proven); `app/README.md`
  map. Origin of the promoted `[single-shared-sim-entry-dialog]`.
- **4 `ai-rec-backtest-orders`** (`5391517`, archived — see CONTEXT §6 for the full shape): the scripted
  scenario harness (`ai_scenarios.py`, `AI_REC_SCENARIOS_ENABLED` default OFF, keyless + meter-bypassing,
  auth/readiness real) + FE-local simulated orders (`convexa.orders.v1`, pure live-cross engine, Orders
  widget/panel, Act via the order variant of the shared dialog, rec→order→position provenance). Full
  pipeline (architect → PM → UX split → parallel lanes → GATE Q). **QA PASS 48/48** (fresh de-correlated
  Sonnet; conformance new spec + 5-spec sweep; AC↔test traceability). GATE Z ×2 accepted
  (`provenance.scenario_name` into arch §2; `RecStatus.scenarios` optional-typing note). **One post-QA
  conductor render-pass catch** (fixed inline + named test `run_scenario_not_blocked_by_no_key_availability`):
  the keyless-deployment availability state disabled "Run scenario" — the mocked test boundary hardcoded
  `in_app_enabled:true`, so the green suite never rendered that world (system-10 lesson, again).
  **Subsumed** the §B "AI-rec Accept → tracked position — full build-out" item (Act ⊃ Accept-into-order).
**Deferred seams (named, not built):** server-side/headless order evaluation + account-scoped order sync
(client-store→server migration seam first); trigger grammar v2 (the arch §3 exclusion list: confluence,
hold/confirm qualifiers, non-price conditions, option-price triggers, OCO/bracket, short/multi-leg);
stop/target automation (plan data only today); recorded-state replay backtesting (BundleFeed/clock seam —
the provider's determinism + the engine's purity were preserved FOR it); named backtest "run" entity;
scenario-registry extension beyond the 9. **Next:** item 5 `scanner` (BRIEF at
`.claude/contracts/scanner/BRIEF.md`; architect must re-justify the locked single-ticker decision with a
perf design).

## 7o. Projected dealer flow (SHIPPED + ARCHIVED — both lanes done)
Contracts archived at `.claude/contracts/_archive/dealer-flow-projection/`. First item of the owner
"enrich the downstream-AI's inputs" GATE I (2026-07-02; BACKLOG "Last GATE I — 2026-07-02"). A
forward-looking **dealer-hedging-flow projection** over the already-computed window-scoped net charm/vanna,
surfaced as the additive nested nullable `market_state.dealer_flow_projection` (charm limb = net_charm·days-
to-next-monthly-OPEX linear; vanna limb at +1 and pre-scaled +5 IV-pt). Full pipeline (architect → PM → UX
split → both lanes). **Backend** (`apps/api`, commit `ca6abae`): 3 nested Pydantic sub-models +
`_build_dealer_flow_projection` in `engine.py` + the `math.fsum` higher-order-greek **determinism fix**
(retires the latent BACKLOG §B item; scoped away from every scoring sum) + `main.py` wiring +
`market_state_glossary.md` AC-15 entry; `signals.py` 0 changes. **Frontend** (`apps/dashboard` + `libs/api`):
new static-family `DealerFlowProjection` widget after `DealerPositioning`, `MarketState` type field, copy
helpers; +22 tests incl. the static-vs-live-drop contrast centerpiece. **STATIC** (gex_spot basis, never
SSE), **advisory CONTEXT** (never scored — score/tier/`state_fingerprint` byte-identical with/without AND
before/after the fix), assumptions surfaced visible. **QA (GATE Q)** de-correlated Sonnet: **PASS 17/17**
(conformance new standalone spec + 5-spec sweep; byte-identity independently re-derived; null-family + horizon
exercised live, incl. a naturally-occurring whole-null case). **Render-pass catch** (fixed inline): a
container-query mis-written as a responsive-value key (Emotion didn't pass it through → warned + never
applied) → the `auto-fit`/`minmax` idiom; render-verified two-column + console clean, suite 617/617. **GATE
S:** no new graduation (4 touched keys already canon, each gained an instance); new watch-list candidate
`model-read-carries-its-assumptions`.
**Deferred seams (named, not built):** path-accurate charm re-integration (the linear `net_charm·H` is v1);
a `net_volga` vol-convexity read (volga stays display-only, only shared the determinism fix); a larger/UI-
selectable vanna vol-move magnitude; a named backtest "run" grouping. **Queued behind it (same GATE I):**
`iv-rank` (runner-up; blocked-on IV-history persistence), `market-backdrop` SPY/VIX (vendor-coverage verify),
the AI context-scalars pack + volume-profile/CVD + TI regime bundle (parked), news/sentiment (owner-future).

## 7p. Latent hygiene finding — the `:typecheck` Nx target (RESOLVED 2026-07-16 — hygiene batch)
> **RESOLVED:** the "~960 errors" had gone stale (the spec-tsconfig fix landed in `8637435`); one
> remaining `as never` cast was fixed 2026-07-16 and `npx nx run @org/dashboard:typecheck` is GREEN —
> now part of the standing gate battery. Original finding retained below as provenance.
Surfaced 2026-07-02 during dealer-flow-projection GATE Q. `npx nx run @org/dashboard:typecheck` fails
project-wide with **~960 pre-existing errors** — a `tsconfig.spec.json` gap (missing `jest-dom` / DOM lib
types: `RequestInfo`, `querySelector`, `toBeInTheDocument` unresolved in `*.spec.tsx`). Confirmed
pre-existing + unrelated to this feature (an UNTOUCHED spec, e.g. `ai-rec/ai-rec.spec.tsx`, fails
identically; the first failures are outside the feature diff). **The feature's real gate — `tsc -p
apps/dashboard/tsconfig.app.json --noEmit` (app/production code, excludes specs) — passes clean**, which is
why the pipeline is green; the `:typecheck` target (specs included, broken spec-tsconfig) is what's red and
nobody runs it. Logged to BACKLOG §B as a tooling-hygiene fix (wire `jest-dom`/DOM types into
`tsconfig.spec.json` so `:typecheck` is usable, then it can join the gate battery). Not blocking.

## 7q. AI context pack — "Market context" (SHIPPED + ARCHIVED — both lanes done)
Contracts archived at `.claude/contracts/_archive/ai-context-pack/`. **Second** item of the owner
"enrich the downstream-AI's inputs" GATE I (owner pick 2026-07-06; BACKLOG "Last GATE I — 2026-07-06") —
**bundles** the two parked scored items (AI context-scalars pack + TI regime bundle) into one feature.
A bundle of four derived reads, all from data already in hand (no new vendor dependency), surfaced as
the additive nested nullable `market_state.market_context` (AI-context via the wholesale
`serialize_context` forward + a Ticker "Market context" widget), **never a scoring input**.
**Backend** (`apps/api`): new one-way leaf `src/core/context_pack.py` (`signals`/`engine`/`live`/
`darkpool` do NOT import it) computing four **independently-nullable STATIC** children — **trend_momentum**
(digested labels: direction `uptrend|downtrend|mixed` [close vs EMA20 vs EMA50], strength `weak|moderate|
strong` [Wilder ADX-14], momentum 5-state [Wilder RSI-14]), **gex_profile_shape** (normalized-HHI
concentration + above/below balance + center-of-mass over the window-scoped net-GEX profile — READS the
already-computed profile, `gamma-sourcing-split` untouched), **flow_vs_positioning** (locational
`distribution_shift` + compositional `tilt_ratio` = today's UNSIGNED cumulative option volume vs standing
OI — basis pinned in-payload, never the SSE net flow), **atr** (5/14/30-bar simple-mean true range).
Attached in `main.py` **after** `generate_signals` returns (fields don't exist at scoring time);
daily-bars lookback extended **60→400 calendar days** (same single provider call, no new env) + additive
`UnderlyingBar` `high`/`low`/`session`; every label/scalar carries its window/threshold/basis descriptor
(self-describing export). `signals.py` **0 diff**. **Frontend** (`apps/dashboard` + `libs/api`): ONE bento
`MarketContext` widget (four sub-cards, all headline labels visible without expanding) after
`DealerFlowProjection`; the wire enum is authoritative (1:1 display map, never FE-re-derived); five
distinct null levels each its own muted "unavailable this cycle"; STATIC-family (un-dimmed on an SSE drop);
token-only, zero hex. **Additive** — score/tier/`state_fingerprint` byte-identical (SPY 87 / prime /
`bb82718bcf1e`) with/without/forced-fault AND before/after the fetch extension; nothing on SSE; no auth
gate (anonymous includes the pack). **QA (GATE Q)** fresh de-correlated **Sonnet**: **PASS 26/26** (0 FAIL /
0 UNVERIFIABLE; conformance new standalone spec `ai_context_pack.json` + 8-spec no-regression sweep;
byte-identity independently re-derived against the live feed; AC↔test traceability non-vacuous;
`nx test dashboard` 658/658 + `@org/api` 13/13, `tsc -b` clean, `nx build` green).
**Lane-interruption note (methodology):** both executioner lanes were cut off by an API session limit
**before self-reporting**; the conductor re-ran every gate and found **3 FE test-ONLY defects** the cut-off
lanes never ran into (component code correct): (1) two structural source-scans used
`fileURLToPath(new URL(..., import.meta.url))` which throws in this Vitest env → Vite-native `?raw` import;
(2) a `toHaveLength(20)` assertion vs the genuine **23** pinned enum values (7 label families, not 6);
(3) an over-broad negative auth regex `/session/i` colliding with the feature's own copy ("today's
**session** cumulative option volume") + `queryByText` throwing on multiple → narrowed to auth-CTA phrases.
Also a **stale `libs/api/dist`** (pre-rebrand `gammaflow.d.ts`) caused false `@org/api` type errors under
`tsc -p` — cleaned + regenerated (`tsc -b --force` is the reliable typecheck when the lib dist is stale).
All fixed inline; QA then independently re-verified green. **Lesson:** a "completed" subagent notification
that carries a session-limit banner instead of a build report is UNVERIFIED — re-run the gates.
**GATE S:** **GRADUATED `model-read-carries-its-assumptions`** (2 binding: dealer-flow-projection +
ai-context-pack) → Promoted canon (CONTEXT §5 + §9). New watch-list key `digested-labels-not-raw-dump`
(1 instance — the TI-label-not-raw-value design rule). The four already-canon keys each gained an instance.
**Deferred seams (named, not built):** the **distance-to-level tiles** (BACKLOG §B Ticker UX quick wins —
ATR now unblocks them; seam only) · Wilder-smoothed ATR / richer label families / a volatility-of-flow read ·
volume-profile POC+CVD, `iv-rank`, `market-backdrop` still queued in the enrichment pool · surfacing the
self-describing descriptor strings in the UI (today FE renders its own pinned copy). **Latent finding
(logged, NOT this feature's regression):** `off_exchange.blocks[].age_seconds` drifts ~1s between identical
runs (a pre-existing WALL-CLOCK display field, **display-only + unscored** — never touches score/tier/
`state_fingerprint`); surfaced by the byte-identity proof's stronger-than-needed "entire-bundle-identical"
control. Candidate cleanup: derive block age from a per-request captured clock.

## 7r. IV Rank / IV Percentile (SHIPPED + ARCHIVED — both lanes done)
Contracts archived at `.claude/contracts/_archive/iv-rank/`. **Third** item of the owner "enrich the
downstream-AI's inputs" GATE I (owner pick 2026-07-06 (b); the 2026-07-02 runner-up, chosen after the
market-backdrop index feed verified NOT_AUTHORIZED). Where a ticker's *current* IV sits within its *own
recent history* → is option premium **rich or cheap** — surfaced as the additive nested nullable
`market_state.iv_rank` (AI-context via the wholesale `serialize_context` forward + a Ticker static-family
widget after `MarketContext`), **never a scoring input**. Full pipeline (architect → PM → UX split → both
lanes → GATE Q).
**The crux (why architect-first):** the vendor provides **no historical IV** (probe-confirmed) → the feature
**accumulates its own** — the project's **first persistent MARKET-DATA store**.
**Backend** (`apps/api`): new one-way leaf `src/marketdata/` (`ports.py` port ABC + `IvSample` record;
`sqlite_store.py` on-disk WAL default; `postgres_store.py` prod adapter behind the same port; `compute.py`
CM30 derivation + rank/percentile read; `__init__.py` env factory `IV_STORE` default `disk`, `IV_DATABASE_URL`
→`DATABASE_URL` runtime-only + defer-fault-to-first-use); `main.py` best-effort **write-through-then-read**
attached **after** `generate_signals` (idempotent once-per-(ticker, UTC-day) upsert, no backfill);
`src/models/market_data.py` `IvRankRead` + `MarketState.iv_rank`. IV sampled = **CM30** (~30-day interpolated
ATM IV off the already-computed term-structure curve, no new vendor call; nearest-tenor fallback recorded in
`iv_basis`/`basis_dte`). Read: **IV Rank** (0–100 range-position, headline) + **IV Percentile** (outlier-robust,
secondary) over a rolling ≤**252**-session window ("since-inception" ramp); **`N_min=20`** floor → honest
`building` state (no number); degenerate-flat → `rank:null`+`rank_unavailable_reason:'flat_window'`, percentile
still defined, **never a fabricated "50"**; digested `band` (`premium_rich`≥70/`neutral`/`premium_cheap`<30)
cut server-side. `signals.py` **0 diff**.
**Frontend** (`apps/dashboard` + `libs/api`): `IvRankRead`/`IvRankState`/`IvRankBand`/`IvBasis` types +
`MarketState.iv_rank?`; a static-family **`IvRank`** widget (four body states — Computed / degenerate-flat /
Building / Unavailable — selected purely from the wire `state` discriminant; band via a **closed lookup**,
never FE-re-derived; **never a bare number**; own pinned copy, never the wire `*_descriptor` strings),
`span={1}` after `MarketContext`; +27 tests (component suite + a flow-integration centerpiece incl. the
un-dimmed-on-SSE-drop contrast). STATIC-family (un-dimmed on a stream drop); token-only, zero hex; no auth gate.
**Additive** — score/tier/`state_fingerprint` byte-identical (SPY served 83 / prime / `0e8884cc0a03`) with
iv_rank present/null/absent; nothing on SSE.
**QA (GATE Q)** fresh de-correlated **Sonnet**: **PASS 19/19** (0 FAIL / 0 UNVERIFIABLE; conformance new
standalone spec `iv_rank.json` PASS live+offline; byte-identity independently re-derived — incl. a forced
whole-store outage via `IV_STORE=postgres`→unreachable-DB → 200 + `iv_rank:null`, `strike_profile` intact,
boot survives; the degenerate-flat + computed states force-observed by seeding the disk store; AC↔test
traceability non-vacuous; `nx test dashboard` 685/685 + `@org/api` 13/13, `tsc -b --force` clean, `nx build`
green). No FAIL → no GATE Z bounce.
**GATE S:** **GRADUATED `[digested-labels-not-raw-dump]`** (2 binding: ai-context-pack + iv-rank) → Promoted
canon (CONTEXT §5 + §9). `[model-read-carries-its-assumptions]` gained a 3rd instance; the three other touched
keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`, `live-vs-static-isolation`,
`theme-token-discipline`) each gained an instance — no other graduation.
**New property established:** the project's **first persistent market-data store** — a best-effort side-store
read/write around the stateless compute (the `chain_store` precedent made persistent + market-data); the
"trading/bundle path stays stateless" narrowing extends to it (the compute reads nothing from it).
**Deferred seams (named, not built):** a **curated warm-list** to pre-accumulate popular tickers (organic-only
today — thinly-viewed tickers build history slowly); **per-tenor / per-strategy** IV rank (one CM30 read per
ticker today); a **rank-of-the-rank trend/sparkline**; **cross-ticker IV-rank** / a scanner column (waits on
the scanner surface); Postgres **live runtime-verify** (deferred like persistent-db — no local Postgres; the
disk default is verified, Postgres is parity-reviewed behind the port). ATR (ai-context-pack) still unblocks
the deferred distance-to-level tiles.

## 7s. Dashboard restructure + Cypress swap + kit sync (SHIPPED on `main` — owner-directed maintenance)
**Not a conductor pipeline feature** — no BRIEF, no contracts, no GATE Q. Logged because it moved
canon-relevant structure. `main` @ `b194bdc`. Presentation/tooling only — score/tier/`state_fingerprint`
untouched; **674/674 tests green on `main`**.
**Shipped:** (1) **Cypress replaces Playwright** (`e38328e`) — `@nx/cypress/plugin` in `nx.json` (same `e2e`
target name), `cypress.config.ts` auto-serves `@org/dashboard`, smoke → `src/e2e/app-loads.cy.ts`; Playwright
removed. Component/integration stays Vitest. (2) **Folder restructure** (`e5ce5fb`→`b194bdc`, 7 commits) —
`src/app/` by KIND: `pages/` · `features/` · `shared/` · `shell/`, folder-per-widget, `@/*`→`src/app/*` alias.
(3) **Delivery-kit sync** — risk-based QA rule mirrored to `C:/Dev/delivery-kit` (kit_lint clean), **v0.3.2**
(`d661250`) pushed to `origin/master`.
**Structure model (established — binding on new FE work):** `pages/` = routes · `features/` = cross-cutting
**domains** (test: *imported by ≥2 pages?* one page consumer ⇒ it lives on that page) · `shared/` =
app-agnostic kernel (populate on the **2nd consumer**, never preemptively) · widgets = ticker surfaces.
**Pages must NEVER import sibling pages** — that is the whole reason `features/` exists.
**`apps/dashboard/src/app/README.md` is the authoritative map**; PROJECT_CONTEXT §2 was reconciled to it
2026-07-16 (it had gone stale: "pending merge", pre-move paths, a horizontal GEX chart, and three deleted
components — `GhostTradePanel` / `PositionEntryDialog` / `HandoffDialog` — still listed as live).
**Decisions recorded (not built):** **Redux recommended AGAINST** (state is already domain-partitioned with
single owners — 3 narrow Contexts, ~5 durable stores; no prop-drilling pain; the genuinely complex part —
bundle poll + SSE — is *server state*, which Redux fits badly). **TanStack Query is the real candidate** for
that layer; scoped Context/Zustand for cross-widget page state. If ever added: store wiring at the composition
root (`src/store/`), slices colocated with their domain. **Persona picker (decided, not built):** ONE
component — `PersonaPicker` + logic in `features/personas`; the **ticker-dashboard** picker wires **page-level**
state at `pages/ticker` (governing widget visibility + per-widget settings, e.g. gex expiration); the
**ai-rec** picker is **widget-local**. `features/personas` must NOT know about ticker widgets — the
persona→widget mapping lives at the ticker page.
**Deferred seams (named, not built) → BACKLOG §B:** `OpportunityTier` → a ticker widget · `/settings` as its
own page · rename `features/` → `domains/` (endorsed option — "features" is a misnomer; it holds domains, not
scrum features) · flatten `app/` → `src/` · the dead-code sweep (~13 unused exports in the trading cluster,
~80 across the dashboard via `ts-prune`; **excludes specs ⇒ test-only helpers are false positives**) · the
risk-based test-migration (feature-by-feature, owner-gated — **only Landing done, 15→4**).
**Parked branch:** `feat/responsive-layout` — 2 commits, **local-only, NEVER PUSHED** (see BACKLOG §B).

## 7t. Outcome ledger — the track record (SHIPPED + ARCHIVED — FE-only)
**Closes the loop the project was missing.** It compounded **BUILD** wisdom (`DECISION_LEDGER.md`) and had
**none for TRADING** wisdom. This harvests the append-only decision records the app already writes and
answers, honestly: **is the `opportunity_score` any good?** — hit rate + mean per-trade return + dispersion
by **tier · AI-rec · setup · IV-rank band · persona**, with explicit sample counts.
**Origin:** the 2026-07-16 owner-requested **canon review**, not an ordinary GATE-I harvest. The finding that
produced it: `_opportunity_score(dist, ivhv, setups, near_flip)` + a capped dark-pool bonus is the entire
headline judgment (drives tier, Prime, `DEFAULT_GATE_SCORE = 50`) and had been **unchanged since `d3aeb4f`,
2026-06-22 — 210 commits** — while **8 enrichment features shipped that cannot reach it**. The score rewards
vol *extremity* via `abs(IV/HV − 1.0)`, so **rich and cheap premium score identically**, while
`iv_rank.band` sits in the payload unable to inform it. The weights and the gate threshold had **never been
validated against a single outcome**.
**Isolation: `NO_BACKEND_CHANGE`** — client-local derived read, **zero new durable keys**, empty `apps/api`
diff. **That empty diff IS the structural no-auto-tuning guarantee** (a statistic that never leaves the
browser cannot reach `signals.py`). Four boundaries: zero backend surface · one-way leaf (mutation-tested
`?raw` source-scan) · **zero write functions** · off the AI prompt in v1. The feature **ENABLES**
`[score-change-is-deliberate-and-measured]`; it is structurally incapable of **exercising** it.
**Shape:** `features/trading/outcomes/` (`ledger.ts` · `sources.ts` · `archive.ts` · `copy.ts` ·
`TrackRecordSection` · `ArchiveBlock`), hosted from `pages/positions/PositionsPage.tsx` with `personaLabel`
**injected as a prop** (the leaf may not import `features/personas`). Capture = an **additive optional**
`entry_context` digest on `DecisionRecord` written by the **existing recorders** (`captureDigest.ts`,
best-effort, cannot throw, triggers no fetch). **No `SCHEMA_VERSION` bump, no backfill — digest presence IS
the epoch marker** (absent = pre-capture; present-with-null = unavailable that cycle).
**Honesty is the whole product:** `N_min = 20` + a **Wilson 95%** interval on every rate · cells never
pooled · **all-time non-rolling** window (a selector would let the trader **shop for the flattering
window** — the exact meta-decision failure the feature exists to fix) · `building` shows a count and
**nothing numeric** (AC-E3: a 3-for-3 cell must never render "100%"; **no meter** — a meter beside a
hit-rate-shaped cell reads as a rate) · a hit rate **never** appears without its mean return + dispersion ·
**no dollar figures**, **no semantic tint**, **Ns never summed**, **no include/exclude toggle** (non-goal
15) · **DecisionRecord is the spine** (no record ⇒ not an outcome), closed-only, **only `quoted` fills
count** · nothing excluded silently (`M == counted + Σ excluded_by_reason`, deterministic precedence).
**A roll is a close, not a category** (PM GATE Z §11.6): the rolled-OUT leg **counts plain, no marker**;
the rolled-INTO leg is excluded under the no-entry-record reason. *"It's a continuation, not a loss"* is the
most common self-flattering story in options trading — and since leg B cannot be counted, excluding leg A
would make the trade **vanish entirely, selectively, in the losing direction**. **No roll count in either
direction** — a count beside a rate hands the reader the mental subtraction ("58%, but 5 were rolls, so
really…") that non-goal 15 forbids; the basis rides **`TR_HIT_DEF`**, the **one** string permitted to name a
roll (pinned by AC-E21's scan).
**QA PASS — 46/46 ACs, 0 FAIL, 0 UNVERIFIABLE** (fresh de-correlated **Sonnet**, every gate re-run
independently). `nx test dashboard` **804/804** (674 baseline + 130) · `tsc -b --force` clean · lint 0 ·
`apps/api` diff empty (conductor- **and** QA-verified). Conformance **n/a and correctly absent** — the
feature consumes **no endpoint at all**, so there is no FE↔BE surface and system-1 does not apply
(**system-12 therefore does not bite this feature; it still lands on `scanner`**).
**⚠ The pipeline's amendment loop fired FOUR times, every one a real defect, every one raised by a
DOWNSTREAM lane refusing to decide out of its own lane:** **A1** — the per-cohort exclusion ledger was
**deleted, not supplemented** (every reason is decided *before* an outcome reaches a cell, so the original
§3.4 placed a structure where it can never populate: a **contract defect**, not PM scope creep). **A2** —
the pre-capture **count**, not just the epoch date (a date cannot distinguish a *new* cell from a
*permanently starved* one). **A3** — the exit-basis join: `close` is not the only close-bearing event, **and
the naive widen is verifiably wrong** — `:342` gates the roll close on `rec.replacement_contract`, so a
**replacement-less Roll falls through to `:404` and writes `accept` + `ai_verdict:'Roll'` WITHOUT
closing**; the ruled predicate is `close | roll | (accept AND ai_verdict === 'Exit')`, a verified
biconditional. **§11.6** — the roll's product meaning. Plus **`TR_HIT_DEF`**, which made AC-13
unsatisfiable. A **fresh** architect (not the authoring session) resolved A1–A3 — and went *further* than
asked, which a session defending its own work plausibly would not have.
**Two vacuous-test classes caught by the builders on themselves:** MUI `sx` compiles to classes, so
`getAttribute('style')` is **always empty** and jsdom won't resolve emotion classes — three style
assertions could not have failed. Rewritten to `className` identity (a 90% vs a 10% cell must be
byte-identical) and `innerHTML` comparison on a real stream drop. **The `?raw` guard was mutation-proven**
(renaming a `via` literal FAILED naming §2/Q3.5).
**Deferred seams (named, not built) → BACKLOG:** the **`split-decision-log`** live bug (`appendDecision` is
defined twice; the Ticker's `useGhostTrade` is LIVE and still writes `convexa.ghost-trade.v1` while
positions reads `.v2` and only falls back when no v2 blob exists ⇒ stranded records — the ledger **unions
both + de-dupes**, so it is correct either way, but the split remains; **`convexa.ghost-trade.v1` LOOKS
legacy but is ACTIVELY WRITTEN — document it as LIVE before some cleanup deletes it**) · **`roll` as a
capture event** (would let leg B be counted — priced: it must not corrupt `pre_capture`, since
absent-digest = pre-capture is A2's epoch marker) · **modeled-fill cohort** (deliberately not a secondary
cohort in v1 — a weaker number that looks identical to the headline is the confusion this feature exists to
prevent) · **the first deliberate score change will silently mix two scoring bases inside the all-time tier
cells** (PRODUCT §7.4) — the future score-changing feature **must partition or reset them**; v1 must not
invent a version to paper over it.

## 7u. Redesign program — "The Curvature Terminal" (Q4(a) 2026-07-22; ALL 4 STAGES SHIPPED — COMPLETE)
**Stage 0 (quality-floor repair) SHIPPED 2026-07-22** (`35fef23` on main; folder →
`_archive/redesign-stage-0/`). The deployed app is now mobile-usable (393px: 580→378, hamburger/drawer),
keyboard-accessible (theme-layer focus rings), semantically sound (0 `<h6>` stat values, `<main>`), floor-
compliant (11px/44px), and honest (hero no longer sells the unbuilt brokerage). QA PASS 6/6 + 15/15
(de-correlated Sonnet); real-drop offline walk verified at 393. Suite 58/493. **Push ≠ deploy — the live
`convexa.pages.dev` gets this only when the owner runs the deploy runbook.**
**Stage 1 (token swap) SHIPPED 2026-07-22** (`5846864`; folder → `_archive/redesign-stage-1/`). The
Curvature Terminal is LIVE at the token layer: ink/phosphor/gammaAmber-dominant + Archivo/Plex
(self-hosted OFL), light parity under a measured 19-pairing contrast gate (one recorded bounce
`#C9821A`→`#C57F19`), purple leak dead, blog template re-skinned via generator, retired hexes
ban-list-scanned (build-breaking). QA PASS (de-correlated Sonnet — all ratios independently recomputed).
Suite **63/523** (the new baseline).
**Stage 2 (the signature) SHIPPED 2026-07-22** (`51b9d7e`; folder → `_archive/redesign-stage-2/`).
The arc-cut CONVEXA mark + favicons + og-image; the hero payoff-curve draw-in (THE motion moment;
glow blob deleted); ArcDivider at the 2 real seams; landing `<main>` + heading walk. Arc in EXACTLY
3 places — set-equality enforced. QA PASS (de-correlated Sonnet — and it correctly flagged the
conductor's own render pass as under-spec; closed post-QA with Web-Animations-API draw proof). Suite
**69/563** (the new baseline). SEO-prerender is now UNBLOCKED (§6a-5: re-derive on the new landing).
**Stage 3 (surface sweep) SHIPPED 2026-07-22** (`0cd0901`; folder → `_archive/redesign-stage-3/`) —
**THE PROGRAM IS COMPLETE.** Motion consolidated (keyframe inventory set-equality pinned); amber
spent-not-sprinkled per surface; every accumulated flag dispositioned (brandGradient deleted ·
textAmber measured · TintChip emphasis + the proximity-chip green-reservation fix · ArcDivider
deepened · blog SVGs on-system · heading repairs); closing floor re-audit green after the B2 GATE Z
(light focus ring → textAmber, ≥4.78 everywhere). QA PASS 36/36 (de-correlated Sonnet). Suite
**73/606 = the baseline**. The app is fully the Curvature Terminal: floor · clothes · signature ·
sweep. **Post-deploy eyeballs:** real-tab favicon · OS reduced-motion · coarse-pointer 44px.
**Deploy pending owner runbook** (the live site wears the OLD brand until then).
**New seam (Stage 1, accepted residual):** the blog articles' inline SVG ILLUSTRATIONS keep their own
cream/terracotta styling on the now-dark template (artwork, not template — regenerate onto the system;
no banned hex inside them, so the scan doesn't bite).
**Deferred seams (named):** Landing `<main>` (Stage 2) · MUI `subtitle1/2` → `<h6>` in transient ai-rec
states (default render clean — future pass) · the touch-floor live pixel spot-check needs coarse-pointer
emulation · chart-tick 10px exemption stands until the owner reads the floor otherwise.

## 7v. Scanner — the multi-ticker surface (SHIPPED + ARCHIVED — 4 phases, both lanes)
Contracts archived at `.claude/contracts/_archive/scanner/`. Owner-directed 2026-07-01 (item 5), brainstormed
+ owner-approved as a v1 design 2026-07-23, delivered 2026-07-24→26. **Displaced 7× since 2026-06-25 — never
dropped.** The product's **breadth** surface; capability + phase detail in CONTEXT §6, not restated here.
**Shape:** approach C — a 2nd-process sweep worker + a shared persistent `ScanStore` + a best-effort
warm-click read-through — run as **4 sequenced phases, each its own execution contract + GATE Q**
(P1 store `7269fa2` · P2 worker `9d92fed` · P3 read API `eb478df` · P4 page `e094bd1`), the redesign-stages
pattern applied to a both-lanes feature.
**QA:** PASS on all four phases, every one a fresh **de-correlated Sonnet** — **13/13 PRODUCT ACs closed
feature-wide, 0 FAIL, 0 UNVERIFIABLE.** Conformance 2/2 live against the standalone
`.claude/tools/conformance/scanner.json`; `nx test @org/dashboard` **645**; e2e **15/15**; lint at the exact
29-warning baseline.
**GATE S — canon:** formally **NARROWED "single-ticker, on-demand"** (CONTEXT §5 + §9 below) — the request
path stays single-ticker; multi-ticker compute is the bounded off-request-path worker. A **descriptive
narrowing, not a demotion** (precedent: the auth "stateless → stateless *trading path*" narrowing).
**GATE S — ledger:** no NEW graduations (all 8 touched keys were already canon; each gained an instance).
`structural-over-prose-enforcement` reached its **2nd instance** but **stays on the watch list** — the
original objection (a design heuristic without a crisp violation test) is unchanged by volume of evidence.
**system-12 handling (owner decision A, 2026-07-24):** scanner authored the canonical **standalone**
conformance spec directly (the `iv_rank.json` precedent) rather than blocking on the kit-doc fix; the
kit-doc/tool reconciliation remains a deliberate framework task in delivery-kit `KIT_BACKLOG.md §B`.
**Two contract defects were caught by DOWNSTREAM lanes refusing to invent around them** — the system working
as designed: (1) the P2 projection selftest asserted a nearer-wall sign for a price sitting **exactly**
equidistant between both walls (an undefined tie) — ruled to an asymmetric fixture, production untouched;
(2) the `UX_BLUEPRINT` **forbade the word "live" on the table and then used it twice in its own copy**,
making the AC-9 negative-space scan unenforceable — the rule stands, both strings reworded ("not a
**real-time** feed"), and the scan is now absolute.
**Deferred seams (named, not built):** **AI-seeded views + batch/small-batch recs (v2** — the whole AI half
of the original scope) · in-app "request tracking" + a universe admin UI (the universe is owner-curated
config; edit + restart worker, no hot-reload) · alerts/thresholds/notifications · WS-based prices (only if
the poll cadence disappoints) · **multi-replica worker coordination** (v1 is a single worker; the store
interface is the seam — no leader election) · multiple **named** per-account views (v1 is one view per
account; a dedicated gated store leaf becomes right then) · live-Postgres verification of the new
`scan_bundles`/`scan_view` SQL (parity-reviewed only — no local Postgres) · **`auth-schema-migrations`**
(BACKLOG §B — the auth Postgres schema-evolution seam fired here and was deliberately deferred).
**Not deployed:** on `main`, but the live site won't show `/scanner` until the owner runs the deploy runbook.

## 7w. Event calendar on the bundle (SHIPPED + ARCHIVED — GATE M backend fast-path)
Contracts archived at `.claude/contracts/_archive/bundle-events/`. Owner-directed 2026-07-27, straight off
the `tradeable-rec-inputs` analysis. Capability detail in CONTEXT §6, not restated here.
**Shape:** GATE M (no UI implication ⇒ PM/UX skipped). Config + loader shipped first
(`events.json` + `events.py`, `725cf09`/`eac9118`), then the wire (`98ee24a`) + contracts/QA (`12a0d21`).
**QA PASS 11/11** (de-correlated Sonnet), byte-identity proved **three** ways — structural (`state_fingerprint`
computed strictly before the attach and a pure function of `sig`), grep/diff (0 diff + 0 imports across
signals/engine/live/darkpool), and a **live A/B** against an isolated instance with the calendar disabled
(NVDA 79/prime/`984e75f48e50` both sides during live tape). AC-3 (the unknown-vs-none distinction) was
independently RED-mutated and reverted.
**Why the data is config, not a fetch:** Massive's earnings feed is a **separate add-on we are not entitled
to** (probed 2026-07-27 — `list_benzinga_earnings` rejected, `list_dividends` OK) and macro events are not a
Massive product. **This is NOT a "tier upgrade" question** — the owner already holds the top personal Stocks
+ Options plans; indices and Benzinga are *different product lines*. Curation is both the cheaper and the
more robust answer (see BACKLOG §C).
**Named for the next curator:** the calendar has a **short shelf life by construction** — `as_of 2026-07-27`,
`horizon_end 2026-10-31`, with several mega-caps reporting within days of curation, and **12 projected dates
that firm up ~2–3 weeks before they land**. The 4 uncurated tickers (TSLA/MU/CSCO/UNH) should be re-checked
then too. An expired horizon degrades safely (forces `unknown`), so a forgotten refresh is honest, not wrong.
**✓ SECOND HALF SHIPPED SAME DAY — `expiration-events`** (contracts archived at
`_archive/expiration-events/`, commit `fa87e67`, QA PASS 11/11). `event_calendar.expirations[]` flags which
tenors contain an event; capability + the containment rule in CONTEXT §6. Two things worth carrying:
(a) **the `amc`-on-expiry exclusion and the `session:null`-on-expiry inclusion do not occur naturally in the
shipped config** — they exist only as constructed fixtures, and both were mutation-tested in each direction
by the lane AND independently by QA; if the projection is ever refactored, those fixtures are the guard.
(b) **The obvious implementation was a trap:** decorating `compute_term_structure` at source would have been
an `engine.py` edit and a byte-identity breach; the curve is read off the computed bundle after scoring
instead. QA re-proved byte-identity independently via a **git worktree at the pre-change commit** — the
right method, since live bundles drift mid-session and cannot prove it.
**Deferred seams (named, not built):** the FE surface (nothing renders it yet — when it does, the closed
`state` lookup is binding, `unknown` must never render as "no earnings", and `expirations: []` must never
render as "no expiry affected") ·
`ex_div` auto-population from Massive `list_dividends` (in-tier, free, no entitlement question) ·
`avg_abs_move_pct` (deliberately loader-internal — the interface pins 7 wire fields) · **item 15**
event-adjusted forward IV, now unblocked.
**Tooling finding, logged not fixed:** the conformance runner has **no enum matcher**, so `state`'s
three-value vocabulary is pinned only as `string?` on the wire spec and verified off-harness (mutation-tested
selftest + live three-state reads). QA judged that the accurate ceiling of the harness, not a defect. See
also the kit v1.0.0 `contract_lint` regression in BACKLOG §E system-12.

## 7x. Multi-leg positions — one book (SHIPPED + ARCHIVED — FE-only, 5-phase build)
Contracts archived at `.claude/contracts/_archive/positions-legs/`. Owner-directed 2026-07-27, sequenced
**ahead of the Webull importer deliberately** — the importer must not be built against a model that cannot
represent what it imports. Capability detail in CONTEXT §6, not restated here.
**Shape:** GATE I → the full **council** (18 conflicts: 10 settled by the voices, 4 owner-ruled, 1
conductor default-with-veto, 1 moot) → R4 synthesis → **S2 skeptic PASS, 0 Critical** → a narrow **R5 UX
copy pass** for four strings no council artifact carried → GATE PLAN (28 tasks) → **five sequenced build
phases**, each a fresh lane told to stop at the boundary and report → GATE Q → GATE Z bounce → re-verify.
**QA PASS 83/83** (de-correlated Sonnet against Opus builders). test 1087/97 · lint 0 errors · typecheck 0 ·
e2e 19/19 · conformance 1/1 · `apps/api` + `libs/api` diffs **empty** — all exit codes checked explicitly.
**Two LIVE data-loss defects were found and repaired here, neither of them the feature's own doing:**
(a) `positions/store.ts` had **no fault latch** — `read()` caught an unparseable blob to empty and the next
`write()` **destroyed it**; reproduced against the old code before fixing (one corrupt character replaced
the whole book with a single position). (b) `liftLegacyRecord` was **not idempotent**, and its second
production caller is `importArchive` — so a trader re-importing their own v2 archive had every position's
`opened_time` silently replaced by the pending-limit sentinel. A loss-free migration losing a fact on the
way back **in**. Also fixed in passing: `formatExpiry` crashed `/positions` to a white screen on any record
with no expiration — latent until records could lack one, so the equity-leg work would have exposed it live.
**What the process caught, worth keeping:** **21 plan/spec defects** were found by lanes **refusing to
invent around a bad instruction** — the two highest-value being an instruction that would have compared a
**dollar** net against a **per-unit** `limit_price` (silently stopping every shipped resting limit from ever
filling, with no error and no test), and a step that would have **flattened a spread into flat fields**,
destroying three legs of every four-leg position at write time. Two **GATE Z fit bounces** were raised
rather than squeezed (the `max_loss` column at `md`; then the condor row overdrawing the 10px budget at
`lg`), and a fixture was caught that **could not reach the state it existed to seed** — `long_call` was
still a live enum member, so AC-54 was green and proving nothing. **Two lane self-reports were wrong about
checks they claimed clean** (a non-zero exit code behind a "1004 passed" summary; a `tsc`-clean claim while
`nx typecheck` exited 1), both caught downstream — the concrete argument for a de-correlated GATE Q over
builder self-verification.
**GATE S — canon:** graduated **`[absent-is-not-none]`** (3 binding, and the first instance from an
*unrelated* feature family — the ledger had explicitly held it at 2 pending exactly that).
`structural-over-prose-enforcement` reached its **3rd** instance and **stays on the watch list** — the
objection was never volume, it is the absence of a statable violation test.
**Deferred seams (named, not built):** the **Webull/broker importer** and `BrokerPosition` (a NEW type
later needs no further migration — `PositionView` is the seam) · **multi-leg orders** (a resting composite
limit inherits the every-leg-live rule) · breakeven + max gain (zero migration cost to add) · **an in-app
repair/re-import path for a faulted store** (today's recourse is export-only — the accepted cost of the
STRICT ruling) · a **per-ticker position picker** (the honest way to restore `position_eval` for a trader
holding >1 position on a ticker — belongs with the deferred alert surface) · the **alert surface** itself
(`useGhostTrade` returned `alerts` that nothing rendered; the five `POSITION_EVAL_NONE_*` strings ship
defined-but-unwired, pending that consumer) · a table column for max loss at `md` (blocked on the
pre-existing `md` page overflow, §8).

### 7y. index-first-defaults (SHIPPED + ARCHIVED 2026-08-01 — the roadmap's first feature)
First feature of the owner-adopted edge-first roadmap (`docs/ROADMAP_2026-08.md`; BACKLOG GATE I
2026-08-01). GATE V fast-path, FE-only, `NO_BACKEND_CHANGE` (QA-proved empty `apps/api` diff).
Shipped (`832f0a7`): bare `/ticker` fallback TSLA→SPY via a new pref-wins `DefaultTickerRedirect`
(user `default_ticker` always wins — server-wins signed-in, local anonymous; a who-am-I fault
degrades to anonymous, never hangs; deep links never wait); the scanner zero-state leads with an
**"Indexes & megacaps"** group (closed lookup, saved views untouched); the one-line single-name
honesty caption on non-universe tickers (`[model-read-carries-its-assumptions]` applied to the
surface; muted token-only). `[absent-is-not-none]` carried into the caption rule: universe
fetch failed/pending/EMPTY ⇒ `unknown` ⇒ NO caption — the app never claims "thin name" from
"we don't know". QA PASS 6/6 (de-correlated Sonnet, all gates independently re-run; suite
**1104/99 the new baseline**, e2e 33/33). Ledger: no new rows — every touched key already canon.
**Deferred seams:** `INDEX_MEGACAP_SYMBOLS` in `pages/scanner/labels.ts` is a HAND-MIRRORED copy
of `universe.json`'s ETF+megacap lines (documented in its docblock) — re-mirror on any universe
re-curation, or later derive a marker server-side; the caveat's membership rule could graduate
from universe-membership to a real options-liquidity floor if one ever ships on the bundle.

### 7z. broker-connect — REAL brokerage positions, read-only (SHIPPED + ARCHIVED 2026-08-05)
The 2026-06-24 OWNER PIVOT's **Track B**, finally unblocked, and roadmap X1. Convexa reads the
owner's REAL Webull book (read-only) behind a `PositionsProvider` port; adapter #1 is
**Webull-direct via the owner's own Individual OpenAPI keys** (SnapTrade remains the named
external-users adapter, designed-for/not-built). **Live-verified by the owner 2026-08-05** against
their actual book — 13 positions, every net-entry figure arithmetically confirmed.
**Formalizes the `[no-real-order-path]` narrowing** the pivot anticipated: reading real positions
is permitted; real order EXECUTION is not — and here it is STRUCTURAL, not policy: the port has no
write method, and **no order/trade SDK module exists on disk at all** (the trade package is
deliberately uninstalled; it would also drag an unbuildable `grpcio`).
**Credentials** are per-user via Settings (Fernet, ciphertext-only, masked last-4, rotate/delete) —
never an env var; the owner corrected an early conductor default to env and was right.
**The capture forced a design the council did not anticipate:** Webull's `/account/positions`
returns **zero contract-identifying detail for options** — no strike/expiry/right/multiplier, and
`symbol` is the bare underlying. So an option renders as an honest single-leg `partial` position
naming exactly what is missing, never a guessed structure (**AC-6b's flat arm is a settled fact**).
`INTERFACE_CONTRACT` **Amendment 1** (GATE Z, presence-rules only) permits omitting those facts.
The **×100 multiplier is RECONSTRUCTED** from Webull's own `total_cost` under four guards (owner
ruling; all 9 captured option rows resolved exactly 100, none near a threshold) — otherwise
withheld, never defaulted.
**R7 probe (owner-run) settled the lookup question:** `/trade/instrument` is LIVE and accepts
`instrument_id` but returns a bare ECHO; the sibling paths 404 and alternate spellings 500. Outcome
B *in effect* — but NOT `endpoint_absent`, so the notes keep capture-scoped wording and the gap
stays a parameter/entitlement question for Webull, not a proven ceiling.
**system-6 security review FIRED here** (the standing "going live" trigger): 1 Critical + 3 High +
M-1/M-3 found and fixed, each with a test that would have caught it. See `SECURITY_REVIEW_BROKER.md`.
**Two live defects escaped every green suite for the SAME reason** — every test injects a fake
transport, so nothing exercised the real SDK contract: **S-1** (the shipped adapter could not
complete ONE HTTPS request on py≥3.12 — a missing vendored-`ssl` shim the *capture tool* had but
the product didn't) and the **Response-object bug** (`get_response()` returns the transport object,
not parsed JSON — the identical defect already fixed once in the capture tool). Both were
product/tool divergences of code that was supposed to be the same. Now ONE shared shim + one shared
parse, with contract-level tests.
**Also fixed here, pre-existing and shipped:** the cross-ticker mark bug — equity legs priced off
the FOCUSED ticker instead of their own symbol, in BOTH the broker view and the **already-shipped
sim book** (`R8`). Contamination of durable history was audited and found **zero** (the book was
empty). `docs/diagnostics/` carries both audit tools.
**Deferred seams (named, not built):** option-leg **grouping by underlying** (owner-chosen shape:
collapse by ticker with an expand, netted cost, **never named a "vertical"** — Webull cannot prove
which legs pair; upgrades automatically if contract detail ever appears) → **the next feature** ·
SnapTrade adapter for external users · a background refresh poller (v1 is on-demand + TTL) ·
M-2 (SDK's vendored **2018 CA bundle**) and M-5 remain OPEN, transport-layer · the AC-3
GET-vs-DELETE in-flight race (real, ~32% in a tight synthetic loop, needs overlapping requests) ·
`ModeledPl` renders on desktop rows but not mobile cards for `unrecognized` · `Build reassessment`
renders on `partial` option rows carrying `position: null` (owner has not ruled) · the owner's real
book is committed in `positions_raw.json` (repo is PRIVATE — verified; revisit before any open-source).

## 8. Smaller deferred items (proposed, not implemented)
- **Toast → an app-root `ToastProvider`** (owner idea, 2026-07-16): belongs at `app.tsx` providers, **NOT**
  `AppShell` (the landing page is outside the shell, so a shell-mounted provider can't serve it).
- **~~Theme audit gaps~~ → LARGELY CLOSED, verified 2026-07-28** (`docs/THEME_AUDIT.md`). The headline
  gap is **gone**: `palette.secondary` is now explicitly set for **both** modes
  (`shared/theme/theme.ts:146` dark, `:167` light), so the **MUI purple no longer leaks**. `shadows` and
  `contrastText` both appear in the theme. This closed exactly as its own fold-in note predicted — via
  redesign Stage 1 (owner ruling 2026-07-22). **Left open:** re-walk `docs/THEME_AUDIT.md` against the
  shipped theme and retire the document, or record what genuinely remains — it is currently the only
  reason this bullet still exists. Ties `[theme-token-discipline]`.
- **~~CI/CD not wired~~ → CORRECTED 2026-07-28: CI *is* wired; only conformance-in-CI and CD are missing.**
  `.github/workflows/ci.yml` has existed since **2026-07-22** and runs, on every push to `main` and every
  PR: `nx format:check --base=remotes/origin/main`, then `nx run-many -t lint test build typecheck` across
  all projects, then `dashboard-e2e:e2e` as its own step (deliberately separate so the dev server + browser
  don't contend with the vitest workers — that contention flaked the unit tests). **It runs `typecheck`**,
  so the `nx typecheck` failure that failed GATE Q on `positions-legs` would have been caught on push too.
  **What is genuinely still missing:** (a) the **conformance sweep** (`interface_conformance.py`) is NOT in
  CI — it runs only inside gates; (b) **CD** — push still ≠ deploy, and `convexa.pages.dev` is applied by
  hand from `docs/DEPLOY_RUNBOOK.md`. The old wording under-described the safety net, which invites someone
  to rebuild what already exists. See `docs/TECH_DEBT.md` #4/#5/#7.
- **Cold-run suite flakiness:** 2 timing-based positions/settings specs occasionally fail on a cold run; a
  clean `--skip-nx-cache` run is green. Not chased yet — flag if it worsens.
- **~~`/positions` overflows horizontally at the `md` boundary~~ → ✅ FIXED 2026-07-28 (`bb821d6`).**
  Root cause was **one element**, found by walking the DOM rather than reading the summary figure:
  `CustomizationToolbar`'s control row carried `flexWrap: { xs: 'wrap', sm: 'nowrap' }`, so wrapping
  switched **off at 600px** while the row's content measures ~934px — the **entire 600–1199px band**
  could not wrap and pushed the `open-entry` CTA off-screen (right edge 958 in a 900 viewport). Every
  other element the sweep flagged was an ancestor relaying that child's overflow. Now
  `{ xs: 'wrap', lg: 'nowrap' }` — `lg` is the first breakpoint whose content box (~1137px) fits it.
  **The blind spot is closed too:** the e2e asserted at 393px and nothing else (one `cy.viewport` call
  in the whole project). It now gates **md (900) + lg (1280)** across all five trader routes with
  `/positions` seeded — **29/29, up from 19**. The earlier phase-2/phase-3 measurements are kept in the
  spec file as the diagnosis trail.
- **⚠ `nx run-many -t lint` FAILS LOCALLY on a machine that has git worktrees** (found 2026-07-28,
  during the Playwright migration; **pre-existing, verified by stashing every change and re-running**).
  The `.claude` project's lint walks `.claude/worktrees/**`, which are **gitignored** — so they are
  absent from a CI checkout and **CI is unaffected**, but locally it reports **157 errors** from
  worktree copies of `libs/api` etc. The trap is that `nx run-many -t lint` (the exact command CI
  runs) is therefore unreliable on the owner's machine and looks like a real regression. Fix is an
  eslint ignore for `.claude/worktrees/**`. Small, unscheduled.
- **E2E RUNNER: Playwright again as of 2026-07-28** (`8c1c2b8` port + `ff2e849` cutover). Cypress is
  fully removed — config, specs, `src/support/`, the `@nx/cypress` plugin and all three packages.
  Ported assertion-for-assertion at **equal coverage** (chromium only, same 29 tests) and proved
  equivalent three ways: same count, same `--list` inventory, and a **mutation check** that failed
  exactly one test with the real overflow number. **29/29 in ~4s vs ~16s.** CI gained
  `npx playwright install --with-deps chromium`. **WebKit/Firefox were deliberately NOT added** —
  widening coverage is a separate decision, and mixing it into a port makes a translation bug
  indistinguishable from a real one. That remains the open follow-on if Safari coverage matters.
- **⚠ TOOLING HAZARD — `nx format:write` is REPO-WIDE and destructive** (found `positions-legs` phase 5,
  2026-07-28): a bare `nx format:write` ran an organize-imports pass over **92 unrelated files** — blog
  HTML, READMEs, auth modules. The lane caught it and reverted everything outside its change set.
  **Always use `--files=`; never bare `format:write`.** Worth a line in `CLAUDE.md`/`AGENTS.md` if it
  bites twice.
- **⚠ `apps/dashboard/src/app/features/trading/outcomes/sources.ts` contains literal NUL bytes**
  (pre-existing — confirmed via `git show HEAD`), in `decisionIdentity`'s composite key template
  (`k:${trade_id}\x00${event_type}\x00${clock_time}`). It makes the file register as **binary** to
  `grep`/`ripgrep`, so it is **silently invisible to source sweeps** — including the boundary/negative-space
  greps this delivery system relies on. A guard that cannot see a file is not a guard. Replace the raw
  NULs with an escaped separator (or `\0` in source) so the file is text again. Small, unscheduled.
- **Fixed in passing (`positions-legs` phase 3), worth knowing it was ever broken:** the shipped
  `formatExpiry` **crashed the `/positions` page to a white screen** on any record with no
  `expiration` (`p.expiration.split` on `undefined`) — found because a pre-phase-3 build white-screened
  on a seeded book. Superseded by the three-way expiry cell. No durable data was at risk, but it is a
  reminder that the positions surface had **no negative-space coverage for a malformed record** before
  this feature; that coverage now exists (the four not-a-number literals).
- **Phase 2 SEO prerendering — CHECKPOINTED** (Phase 1 — meta/OG/robots/sitemap — already shipped). Plan at
  `~/.claude/plans/we-are-concerned-with-shiny-pnueli.md`; needs a router restructure to `RouteRecord[]` + a
  hand-written Emotion SSR collector. **Do on a branch.** See BACKLOG §B "Prerender public pages (SSG)".
  **→ ~~SEQUENCED BEHIND redesign Stage 2~~ — BLOCKER CLEARED 2026-07-28.** Stage 2 shipped
  **2026-07-22** (`51b9d7e`) and §7u records **all four redesign stages COMPLETE**. The instruction "do
  not start it in parallel" no longer applies: the landing/router it was waiting on now exists, so the
  plan should be **re-derived against the shipped landing** and the item is **actionable, not blocked**.
  It has been sitting mislabelled as blocked for six days.
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
- **Single-ticker, on-demand** (the watchlist scan was dropped — bulk per-cycle calc was too slow).
  **NARROWED 2026-07-26 (`scanner` GATE S, system-7 — descriptive narrowing, NOT a demotion):** the
  **trading/serve REQUEST PATH computes exactly the one ticker asked for**; multi-ticker computation
  happens **only** in a separate, bounded, off-request-path **sweep worker writing a side-store**. An
  unbounded in-request market sweep — what the original decision actually forbade — stays forbidden and
  reopening it is a GATE-Z reversal. (Prose single-sourced in PROJECT_CONTEXT §5.)
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
- **`[single-shared-sim-entry-dialog]`** (promoted 2026-07-02, 2 binding; **NARROWED to SIM-ONLY
  2026-07-16**) — every **simulated** entry flow launches THE one shared
  `app/features/trading/TradeEntryDialog`; a new **sim** entry shape is an additive variant, never a forked
  dialog. **⚠ A real-money / broker entry surface MUST be a structurally SEPARATE component** — never a
  mode/prop/variant of the sim dialog (the pretend↔real boundary is the one place a fork is a *feature*).
  Un-narrowed it would have collided with `[no-real-order-path]` at `broker-connect`. See PROJECT_CONTEXT §5.
- **`[server-side-gate-enforcement]`** (promoted 2026-06-29, 2 binding) — an access gate on a state/
  cost-bearing action is enforced **server-side** (boundary of record), never FE-only; a bypassed/absent
  client check must still be rejected by the server. (user-accounts AC-E7 catch; byo-ai-key credential +
  AI-rec gating.) See PROJECT_CONTEXT §5.
- **`[loss-free-durable-migration]`** (**promoted 2026-07-16 — SEVERITY path, 1 instance**) — a durable
  **client** store's key/shape change carries existing user data forward **loss-free** (read-new-else-old,
  promote-forward, **never-delete**, idempotent, never-throw); a corrupt blob degrades to empty **without
  destroying the original**. Canon at 1 instance because ~5 localStorage stores hold the user's entire
  trading history with **no server backup** — violation is silent, total, irreversible. (rebrand-convexa's
  `resolveDurable` + the positions v1→v2 chain.) See PROJECT_CONTEXT §5.
- **`[score-change-is-deliberate-and-measured]`** (**promoted 2026-07-16, owner canon review**) — the score/
  tier/gate **may** evolve, but only via an explicit score-changing feature with a stated rationale, a
  recorded **before/after on real tickers**, and a **fingerprint-basis version bump** — never as a side
  effect of an additive feature, never unmeasured. Companion to `[additive-keeps-score-byte-identical]`,
  which had hardened into a de-facto freeze (scoring unchanged for 210 commits while 8 enrichment features
  shipped that cannot reach it). See PROJECT_CONTEXT §5.
- **`[secret-encrypted-at-rest]`** (promoted 2026-06-29, 2 binding) — a stored recoverable secret is
  encrypted at rest (symmetric, server-side key, not hashed), persisted ciphertext-only (crypto before the
  store), never logged/returned/browser; write-only + rotate/delete; decrypt-fail ⇒ no-usable-secret, no
  leak. (byo-ai-key encrypted AI key; persistent-db held the ciphertext boundary into Postgres.) See
  PROJECT_CONTEXT §5.
- **`[no-secrets-in-image]`** (promoted 2026-06-29, 3 binding) — a build/deploy artifact carries no secret;
  all config/secrets injected at runtime via env (host Variables / Pages env), never committed/baked/
  hardcoded; images run non-root. (containerize-apps Dockerfiles+.dockerignore; persistent-db `DATABASE_URL`;
  deploy real Railway push + Pages Function `API_ORIGIN`.) See PROJECT_CONTEXT §5.
- **`[single-shared-sim-entry-dialog]`** (promoted 2026-07-02, 2 binding) — every sim-entry flow launches
  THE one shared `app/features/trading/TradeEntryDialog`; new entry shapes are additive variants (props/modes),
  never a forked second dialog; dead forks deleted with zero-importer proof. (sim-entry-unification;
  ai-rec-backtest-orders order variant.) See PROJECT_CONTEXT §5.
- **`[theme-token-discipline]`** (promoted 2026-07-02, 4 programs) — new/re-skinned FE components bind to
  the MUI theme / `tokens.ts` (mode-aware via `extrasFor(theme)`), zero hardcoded hex; dark/light parity
  part of done. (convexa-redesign → ticker-ux-polish → light-mode-parity/sim-entry-unification →
  ai-rec-backtest-orders.) See PROJECT_CONTEXT §5.
- **`[model-read-carries-its-assumptions]`** (promoted 2026-07-06, 2 binding) — a forward-looking or
  model-dependent read (a projection, a model-derived level, a threshold-bucketed label/scalar) is
  surfaced **self-describing** — it carries its own horizon / window / assumption / basis / threshold —
  and is framed as **advisory context, never a guarantee or a scored signal**. (dealer-flow-projection —
  the assumption-explicit charm/vanna projection; ai-context-pack — every TI/shape/flow/ATR read carries
  its window+threshold+basis + the "not a forecast, not a scored signal" framing; iv-rank — the rank carries
  its window/sample-count/IV-basis + the honest "building history" state. 3 instances.) See PROJECT_CONTEXT §5.
- **`[digested-labels-not-raw-dump]`** (promoted 2026-07-07, 2 binding) — a derived-signal set fed to the
  downstream AI / displayed is a SMALL orthogonal set pre-digested into regime/band LABELS, not a raw
  indicator/OHLC/series dump; the wire enum/token is authoritative (FE renders via a closed lookup, never
  re-derives from the scalar); no raw series on the wire or in the UI. (ai-context-pack — the TI regime
  labels; iv-rank — the rich/cheap `band` cut server-side, no raw IV history.) See PROJECT_CONTEXT §5.
- **`[absent-is-not-none]`** (promoted 2026-07-28, 3 binding) — a surface that can be uncurated,
  unattempted or inapplicable must distinguish **"we do not know"** from **"we checked and there is
  nothing"**, and carry that distinction all the way to the consumer rather than collapsing it at a
  boundary; enforce it in the type or the closed vocabulary, never in prose. Prevents a **fabricated
  claim** — "no earnings scheduled" for a ticker nobody checked, or "not applicable" about a fact that is
  applicable and was simply never recorded. (bundle-events — `None` vs `[]` + the closed `state` enum as
  sole disambiguator; expiration-events — the same rule one level down; positions-legs — carried into the
  client render as **four** independently-assertable not-a-number literals, `—` / `unavailable` /
  `not recorded` / `no basis`, never `undefined`/`null`/`NaN`.) See PROJECT_CONTEXT §5.
