# Convexa — Project Context (handoff)

> Self-contained ground truth for fresh, role-scoped sessions (Architect → PM →
> UX/Tech-Writer → Backend/Frontend Executioners). Assume no chat history. Grounded
> against the repo; re-generate from code if it drifts.

## 1. Purpose & scope
<!-- shard: tags=overview,purpose,scope -->
> **Repositioning in progress (2026-06-24): rebrand → "Convexa", a positions-centric, multi-page app.**
> The product is shifting from a single-ticker dashboard to: **connect your positions → get AI
> recommendations built on the GEX profile + heuristics we compute per ticker.** User-facing brand is
> **Convexa** — now the brand across the **product, code, and repo** (full rebrand 2026-06-28, feature
> `rebrand-convexa`; reverses the earlier "UI-only" scope; durable localStorage keys migrated
> `gammaflow.*`→`convexa.*` loss-free). The reusable delivery framework it's built with stays the separate,
> project-neutral kit. The app is multi-page —
> **Landing** (`/`, the Convexa splash) · **Ticker viewer** (`/ticker/:symbol`, the GEX dashboard below)
> · **Positions** (`/positions`, the sim portfolio) · **Scanner** (`/scanner`, a coming-soon stub). Real
> **brokerage connection** (read-only positions, Webull-first) is a gated later track — see BACKLOG "Last
> GATE I — OWNER PIVOT" + the narrowed `no-real-order-path` (read positions OK; **no real order
> execution**). The analysis engine below is unchanged — it is now the **Ticker viewer** page.

The core engine: turns an equity's option chain into dealer **gamma-exposure (GEX)** structure —
call/put walls, the gamma flip, the magnet — then layers volatility context, real-time order flow, and a
rule-based read of the current setup. It answers: *given dealer positioning, where is price
attracted/repelled, is the regime mean-reverting or trending, and is there an edge now?*
Built for **longer-dated (≈7–45 DTE) swing trading with optional intraday timing**. The
computed bundle also feeds an **external** downstream AI that produces risk-first trade calls.

## 2. Architecture
<!-- shard: tags=architecture,backend,frontend,api,engine,signals,live,sse,providers,observability,ui -->
**Backend** (FastAPI, `apps/api/` + `apps/api/src/`):
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
- `src/core/personas.py` — trader-persona **prompt projection** (read-only data, post-FREEZE): the
  decomposed FIXED/PERSONA hand-off template + the 7 built-in `PersonaDefinition`s + the A1 disposition
  map, served at `GET /api/personas`. A **non-input to scoring by construction** — imports only
  `logging`/`os`; never touches signals/score/gate/fingerprint/engine. No LLM call.
- `src/core/ai_recommendation.py` — the **in-app AI-recommendation** proxy + state-export serializer:
  an isolated, best-effort, **one-way leaf** (`signals`/`engine`/`live`/`darkpool` do NOT import it —
  the structural guarantee of score byte-identity). An `LLMProvider` seam (`AnthropicLLMProvider` via
  forced tool-use structured output; `StubLLMProvider` for keyless/no-cost verification), the
  read+serialize context exporter (no recompute), process-local cooldown/daily-cap, and `ai_eval`-derived
  gating. Imports only `personas`/stdlib/lazy `anthropic`; reads `ANTHROPIC_API_KEY` only here. Served by
  the three `/api/recommendation/*` endpoints in `main.py`.
- `src/models/market_data.py` — `MarketState` Pydantic response model.
- `src/auth/` — **user accounts subpackage** (the project's first stateful surface + credential store; a
  **one-way leaf** the engine/signals/live/darkpool/bundle/SSE path NEVER imports — `main.py` is the sole
  orchestration boundary that mounts it). `ports.py` = three storage ports (`UserStore`/`SessionStore`/
  `UserSettingsStore`) + normalized record dataclasses, mirroring the `MarketDataProvider` port pattern;
  `sqlite_store.py` = the ONLY adapter this phase — a single shared `:memory:` sqlite3 connection
  (`check_same_thread=False`, lock-guarded; persists across requests for the process lifetime, **resets on
  restart**), with the persistent adapter registered as a seam but not built; `__init__.py` = env-selected
  store factory (`ACCOUNT_STORE`, default `memory`, like `get_provider()`/`DATA_PROVIDER`); `passwords.py`
  = argon2 hashing (always-hash dummy-verify → non-enumerating timing); `cookies.py` = HMAC-signed opaque
  session-id cookie; `service.py` = signup/login/logout/session-resolution (idle+absolute expiry,
  server-authoritative revocation) + settings (server-wins) + Google identity mapping (known-sub→login /
  verified-email→auto-link / else create); `google_oauth.py` = server-side Authorization-Code flow,
  **config-gated OFF when creds absent** (no crash; `available()` False); `errors.py` = the auth error
  class; `router.py` = the `/api/auth/*` endpoints (signed HTTP-only Secure SameSite cookie). `main.py`
  also wires the auth gate as the **outermost** precondition on `POST /api/recommendation/{ticker}` and adds
  `POST /api/positions/sim-trade/gate` (the session-resolving gate the FE Positions write actions call).

**Frontend** (`apps/dashboard/` in the Nx monorepo, React 19 + Vite + MUI/Emotion):
- **Multi-page shell (Convexa, 2026-06-24):** `app/app.tsx` is now the **route table** (single
  `BrowserRouter` + single dark MUI theme at `main.tsx`): `/` → `app/landing/` (the full-bleed Convexa
  splash, outside the shell) · a persistent `app/shell/AppShell.tsx` (`<Outlet/>` nav — Convexa wordmark
  + Ticker/Positions/Scanner, mounts once) wrapping `/ticker/:symbol` (→ `app/ticker/TickerDashboard.tsx`,
  the relocated GEX dashboard; bare `/ticker`→TSLA) + `/positions` (→ `app/positions/PositionsPage.tsx`,
  the relocated portfolio) + `/scanner` (→ `app/scanner/`, a static coming-soon stub) · `/_ops/metrics`
  stays OFF the shell + unlinked. **Live SSE is page-scoped to the Ticker page** (opens on mount, closes
  on nav-away, reopens on return, never double-subscribes); the positions store is a localStorage
  singleton so it persists across nav. Brand was UI-only at the time (durable keys / packages / identifiers
  unchanged) — **superseded 2026-06-28 by `rebrand-convexa`: full GammaFlow→Convexa rename incl. a loss-free
  migration of the durable keys to `convexa.*`.**
  The relocated `TickerDashboard` body is byte-identical to the old single-page dashboard described next.
- `apps/dashboard/src/app/ticker/TickerDashboard.tsx` (was `app.tsx`) — dashboard (toolbar, stat tiles, setups, **Off-exchange
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
- `apps/dashboard/src/app/positions/` — **paper-sim positions portfolio** (multi-position evolution of
  the ghost-trade tracker). Flat id-keyed durable collection (loss-free v1→v2 migration) + the entry/fill
  resolver (manual / market / **limit** that fills only on a live cross at the limit price, `pending →
  filled/cancelled`); `derive.ts` (filter/sort/group + P/L subtotals); `useTrends` (ephemeral per-position
  P/L trend ring buffer, reusing the latency-trend pattern); `usePortfolio` (the brain). UI:
  `PortfolioPanel` (Simulated/Live tabs), `PositionsView` (table↔card + density), `PositionRow`,
  `PositionEntryDialog`, `CustomizationToolbar`, `PlSparkline`, `LiveTabPanel` (**zero-import LOCKED**
  placeholder — no broker/order/data). Reuses `ghost-trade/mark.ts` for P/L; durable customization + named
  saved views. `NO_BACKEND_CHANGE` (consumes `GET /api/contract` + SSE); never a scoring input; `SIMULATED`.
- `apps/dashboard/src/app/operator-metrics.tsx` — **operator-only** metrics readout on route
  `/_ops/metrics` (its own AppBar, OFF the trader routes, not linked from the trader UI). Read-only +
  side-effect-free (`fetchMetrics` → `GET /api/_metrics` only): global + per-ticker stage tables
  (I/O|CPU from `kind`, p50/p95/max/count/ok-err-skip), total/cache/vendor lines, recent-traces with
  warm/cold inspect. Honest: empty → `—`, `skipped` shown, headroom `null` → `unknown`, non-alerting.
  The **trader dashboard ignores** the new `meta.trace_id`/`meta.timings` (renders neither). Tops the
  page with a **`LatencyTrend`** card (`operator-metrics/`): a local, in-browser, **ephemeral** trend
  of the windowed snapshots. `useLatencyTrend` is the page's **single fetcher** — one stable poll loop
  (still only `GET /api/_metrics`, once per cadence) feeding both the trend and the snapshot tables;
  a bounded serializable ring buffer stores raw per-scope snapshots so metric/percentile/scope/stage
  switches re-derive with no refetch. Gaps = broken line (`connectNulls=false`, never 0/interpolated),
  restart = broken line + `Service restarted` marker (never stitched), stale-repeat distinct, headroom
  `unknown`, failed poll keeps the last series + self-heals (no retry storm), local JSON Export (no
  server state), auto-pause when hidden; non-semantic palette, no thresholds/alerts. Clears on
  reload (expected). NO_BACKEND_CHANGE — `/api/_metrics` consumed unchanged.
- `apps/dashboard/src/app/personas/` — **trader personas**: a prompt-layer presentation overlay,
  assembled **FE-side** (locus PINNED FE-rendered). A faithful **embedded** decomposed hand-off
  template (Default renders today's prompt byte-identical; A1 disposition slot relocated) + 7 built-in
  presets + client-local custom personas + `active_persona_id` (persisted). `usePersona` +
  `PersonaPicker`/`HandoffDialog` (Entry/Reassessment tabs, FIXED/PERSONA badges, invariance readout
  "Unchanged by persona…", Copy)/`PersonaCustomizeForm`. **Switching persona is pure presentation —
  no getTicker/streamTicker, no recompute; score/tier/gate/fingerprint are invariant.** A visible/
  overridable DTE pre-fill chip (one-shot on explicit navigation, never recomputes). NOTE: the FE
  embeds the template/presets rather than consuming the backend's `GET /api/personas` — correct
  output, but dual-sourced (see OPEN_THREADS thread 7 reconciliation flag).
- `apps/dashboard/src/app/auth/` — **user-accounts UI** (hybrid access; anonymous browsing unchanged).
  `AuthContext` (non-blocking who-am-I read; **degrade-to-anonymous** on failure; server-wins settings),
  `AuthDialog`/`AuthDialogProvider`/`AccountControl` (login by **email** / signup; username optional
  display-only; non-enumerating 401), `GoogleButton` (first-class **present-but-disabled-when-unconfigured**,
  driven by `google_available` — config-flip, no rebuild), `useGate`/`SignInPrompt` (the shared gated-action
  helper — awaits a **server gate** before any local write; 403→prompt+abort), `SettingsPage`/`useSettings`/
  `localPrefs`/`ThemeProvider`/`copy`/`validation` (the 3 light prefs — active persona / default ticker /
  theme; server-wins signed-in, client-local anonymous, **per-account isolated**, score-neutral). Gating is
  wired into `positions/PortfolioPanel` + `CustomizationToolbar` (open-position / save-view / accept-rec
  writes call `POST /api/positions/sim-trade/gate`; D6d "stored in this browser, not tied to your account
  yet" disclosure) and `ai-rec/AiRecPanel` (ask-AI **auth-outermost** — a logged-out call shows "sign in",
  never ai-rec cooldown/cap/no_key; manual export floor stays anonymous).
- `libs/api/src/lib/gammaflow.ts` — typed API client (`@org/api`): `getTicker`, `streamTicker`,
  `fetchTrackedContract`, `fetchMetrics`; `Meta` tolerates optional `trace_id?`/`timings?`;
  `PersonaDefinition`/`Handoff` persona types; **auth surface** (`getSession`, `signup`, `login`, `logout`,
  `saveSettings`, `simTradeGate`; `SessionStatus`/`AuthUser`/`UserSettings`/`AuthError` types — bundle/SSE
  fetchers gained no header/param).
- Vite dev proxy `/api → 127.0.0.1:8000` (no CORS); SSE via `EventSource`.

**Transport:** heavy bundle over REST (polled ~60s, cached); light live payload over **SSE**.

## 3. Core math constraints
<!-- shard: tags=math,gamma,greeks,flip,dte,vanna; always -->
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
<!-- shard: tags=data,vendor,coverage,overnight,massive,options -->
- **Massive = Polygon.io rebrand** (hostnames `*.massive.com`). REST + WebSocket.
- **Stock coverage 4 AM–8 PM ET** (pre-market + RTH + after-hours). **NO overnight (8 PM–4 AM)** —
  the overnight ATS (Blue Ocean) price seen on Webull is NOT sourceable here.
- Options chain snapshot supplies **OI + greeks (Δ/Γ/Θ/V) + IV** (big convenience).
- Daily bars (~60d) → HV; 1-min bars (~4d) → VWAP; stock snapshot → session close spot.
- **Live:** WebSocket `Q.{tkr}` (NBBO) + `T.{tkr}` (trades). REST `list_trades` backfills flow.
- Trades carry **`trf_id`** → non-null = off-exchange ("dark pool"/internalized) print.

## 5. Key decisions & rationale
<!-- shard: tags=decisions,invariants,isolation,darkpool; always -->
- **Single-ticker, on-demand** (dropped the watchlist scan) — bulk per-cycle calc was too slow.
- **Selectable DTE/expiration window** (`min_dte/max_dte/expirations`) — stabler swing levels,
  free of 0DTE noise; shapes gamma structure only.
- **60s cache + freshness/`stale` flag** — pollable without hammering; honest data age.
- **AI gate** (`ai_eval.ready/changed/state_fingerprint`) — escalate to the AI only when
  actionable AND changed; keeps it off a firehose (user is prone to over-trading).
- **Live spot anchor = NBBO mid** — smoother, always-current, better for anchoring; the mid stays the
  sole anchor for the headline price, the levels (walls/flip/peak/max-pain), and the live flip reprice.
  **(Narrowed 2026-06-25, ticker-load-experience GATE S — system-7):** a **display-only live last-trade
  readout** is now ALSO surfaced on the SSE payload beside the mid (so the page reconciles with a
  broker's last-trade; Webull shows last-trade, hence small benign differences). The last-trade is a
  READOUT only — it feeds nothing on the anchor/levels/flip/net-flow path. Was: "do not add last-trade."
  Letting last-trade drive the anchor is a GATE-Z reversal.
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
- **User accounts = a contained state store outside the trading path** (user-accounts, 2026-06-25). The
  project's first stateful backend surface + credential store. **The "stateless server" property is narrowed
  to the TRADING/BUNDLE path** (bundle, SSE, ghost-trade math stay stateless / recompute-from-vendor /
  client-local); auth/sessions/settings live in a **one-way-leaf** `src/auth/` subpackage behind three
  swappable ports (`UserStore`/`SessionStore`/`UserSettingsStore`), in-memory SQLite the only adapter this
  phase (**resets on restart** — accepted prototype). **Auth has its OWN error class** — endpoints return
  real HTTP statuses (401 non-enumerating bad-creds / 403 gated / 409 dup email), an explicit **carve-out**
  on `[best-effort-isolated-or-null]` (the null-not-error rule governs added BUNDLE computations; an
  auth-subsystem failure still degrades the trader path to anonymous, bundle/SSE intact). Passwords are
  argon2-hashed (never plaintext/never logged); Google secret + session-signing key are server-side only.
  **Access is hybrid:** anonymous browsing (Landing/Ticker/Scanner) is unchanged; only the sim Positions
  WRITE actions + the "ask AI" call require a session, **enforced server-side** (not FE-only — see the
  `server-side-gate-enforcement` watch-list key). Score/tier/`state_fingerprint` byte-identical
  anonymous-vs-signed-in; no setting is ever a scoring input.

### Standing build invariants (promoted from the Decision Ledger — apply to EVERY new feature)
> Graduated via the recurrence rule in `.claude/DECISION_LEDGER.md`. A new feature's `BRIEF.md` cites
> these by key in "Invariant watch"; each role restates the ones it touches. Reopen only via GATE Z.
- **`[best-effort-isolated-or-null]`** — an optional or added computation is best-effort: any failure
  yields a **null/omitted field, never an HTTP error**, leaving `market_state`/`strike_profile` and the
  SSE path intact. *(dark-pool, the four metrics, ghost-trade, observability, trader-personas — 5.)*
- **`[additive-keeps-score-byte-identical]`** — an additive feature leaves the entry gate,
  `opportunity_score`, `opportunity_tier`, and `state_fingerprint` **byte-identical**; it is **never an
  input** to `signals`/scoring/the fingerprint (that module boundary is the enforcement). *(dex-voloi-
  skew-term, ghost-trade, observability, trader-personas — 4.)*
- **`[live-vs-static-isolation]`** — every new datum declares **live-derived vs static**: live-derived
  UI degrades on an SSE drop (dim + offline, never blank) while static reads keep rendering the last
  bundle. *(dark-pool, the four metrics, ghost-trade, trader-personas — 4.)*
- **`[operator-vs-trader-path-separation]`** — an operator/diagnostic surface stays on its own route
  (e.g. `/_ops/metrics`), **OFF every trader/bundle route and unlinked from the trader UI**; it is
  **read-only + side-effect-free** (no vendor fetch, recompute, cache mutation, or trader-route call)
  and leaves the trader path + SSE untouched. *(backend-observability, latency-visualizer — 2 binding.)*
- **`[no-real-order-path]`** — "action" **never reaches a real broker or order/execution path.** A
  simulated feature stays `SIMULATED` (paper) behind a mandatory confirm; a not-yet-built *real* surface
  (e.g. a "Live positions" tab) ships as a **non-functional placeholder** — no broker, no order/execution
  path, no real-position data source (enforce structurally, e.g. a zero-import lock). Reopening this is a
  deliberate owner decision + a vendor/broker dependency, via GATE Z. *(ai-recommendations,
  positions-portfolio — 2 binding.)*
- **`[server-side-gate-enforcement]`** (promoted 2026-06-29, 2 binding) — an access gate on a
  state/cost-bearing action is enforced **server-side** (the server is the boundary of record), **never
  FE-only**: a bypassed/absent client check must still be rejected at the server. The FE check exists for
  UX, not enforcement. *(user-accounts — the GATE-Q AC-E7 catch where a sim-trade write gate was FE-only;
  byo-ai-key — server-authoritative credential endpoints + AI-rec key resolution. 2 binding.)*
- **`[secret-encrypted-at-rest]`** (promoted 2026-06-29, 2 binding) — a stored **recoverable** secret (a
  user/third-party API key, a broker token, etc.) is **encrypted at rest** (symmetric, server-side key —
  NOT hashed, since it must be usable), **persisted as ciphertext only** (the crypto boundary sits *before*
  the store, so no store/DB ever sees plaintext), and **never logged, returned in a response, or sent to
  the browser** — write-only from the client (masked hint only) + rotate/delete; a decrypt failure is
  treated as no-usable-secret, never a leak. *(byo-ai-key — the encrypted per-user Anthropic key;
  persistent-db — the ciphertext-only boundary held when the key moved to Postgres. 2 binding.)*
- **`[no-secrets-in-image]`** (promoted 2026-06-29, 3 binding) — a build/deploy artifact (container image,
  pushed repo) carries **no secret**: `.dockerignore` excludes `.env*`/`.venv`/credential files, no
  `COPY .env`, no secret literal, no hardcoded backend URL; **all config + secrets are injected at runtime
  via env** (host Variables / Pages env), values owner-entered; images run **non-root**. *(containerize-apps
  — the Dockerfiles + `.dockerignore`; persistent-db — `DATABASE_URL` via env; deploy — the real Railway
  registry push + the Pages Function reading `API_ORIGIN` from env. 3 binding.)*

## 6. Current feature state (works end-to-end)
<!-- shard: tags=features,state,observability,darkpool,ghost-trade,dex,personas,metrics -->
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
- **Positions portfolio (sim, FE-only)** — evolves the ghost-trade tracker from a single open position
  into a multi-position **portfolio** (`apps/dashboard/src/app/positions/`). A central all-positions view
  + a per-ticker filter; each position shows P/L + Δ-since-entry + an ephemeral session delta + a small
  P/L **trend sparkline**; grouping (ticker / strategy = long-call vs long-put / expiry) with P/L
  subtotals; full customization (columns/sort/filter, table↔card, density) + **durable named saved views**
  (restore on reload); a closed/history view. Two tabs: **Simulated** (functional paper-sim) + **Live** (a
  zero-import **LOCKED** "coming soon / not connected" placeholder — no broker, no order path). The entry
  simulator adds 3 fill modes (manual price / market / limit); a resting **limit** fills only on a **live
  cross at the limit price** (never off a frozen mark), with a `pending → filled/cancelled` lifecycle.
  `NO_BACKEND_CHANGE` — reuses `GET /api/contract` + SSE `mid`, `ghost-trade/mark.ts` (P/L) + the
  latency-trend ring buffer. Client-local durable store (loss-free v1→v2 migration); positions are **never
  an input** to `signals`/score/tier/`state_fingerprint`; `SIMULATED` everywhere. *(2026-06-24.)*
- **Convexa multi-page shell + landing (FE-only)** — the rebrand + IA restructure (feature 1 of the
  owner pivot). Single `BrowserRouter`/dark-MUI theme: `/` Convexa landing (dark-fintech splash —
  hero hook "See the AI read on your real positioning", convexity-curve motif, value cards for the
  today-working surfaces, honest non-navigating "coming soon" brokerage + Scanner), a persistent
  `AppShell` nav (Ticker/Positions/Scanner; `/_ops/metrics` off-shell + unlinked), the relocated
  `/ticker/:symbol` GEX viewer + `/positions` portfolio (relocate-don't-change — internals byte-identical),
  and a static `/scanner` stub. Live SSE page-scoped to the Ticker page (open/close/reopen, no
  double-subscribe); positions store persists across nav. Brand was **UI-only** then (no code/package/
  store-key rename) — **superseded 2026-06-28 by `rebrand-convexa` (full rename + key migration).**
  `NO_BACKEND_CHANGE`. Scoring path untouched. *(2026-06-24.)*
- **Full Convexa rebrand (`rebrand-convexa`, FE+BE, cosmetic)** — completed the GammaFlow→Convexa rebrand
  from UI-only to the **whole codebase** (134 refs / 51 files): identifiers, the `libs/api` client file
  (`gammaflow.ts`→`convexa.ts`, consumed via `@org/api` so zero export churn), backend logger/FastAPI
  title/ContextVar, docs/README/CLAUDE.md, `project.json` `project_name`, and the GitHub repo
  (`gammaflow`→`convexa`). The 4 **durable localStorage keys** were migrated `gammaflow.*`→`convexa.*`
  **loss-free** via a reusable `resolveDurable(new,old)` migrate-on-read helper (read-new-else-old,
  promote-forward, never-delete, idempotent, never-throw) composing with the existing positions v1→v2
  chain. **STAYS unrenamed (non-goals):** the `@org/*` package scope, `DATA_DIR`, the local working folder,
  and archived-contract/ledger history (provenance). Reverses the app-shell-landing "UI-only" decision.
  Cosmetic to the engine — score/tier/`state_fingerprint` byte-identical, conformance unchanged. QA PASS
  (Sonnet, de-correlated — 23/23 ACs, dashboard 283/283 + `@org/api` 7/7). *(2026-06-28.)*
- **Ticker-page load experience (both lanes, additive)** — the ticker viewer (`/ticker/:symbol`) loads fast
  and feels instant. **Backend:** new `src/core/chain_store.py`, a process-local, ticker-keyed, timestamped
  shared **chain-INPUT** store — `LiveSession._refresh_chain` (already re-fetching the full chain every
  120s) stashes the FULL unfiltered `market_data`; the REST cold-miss path short-circuits ONLY the chain
  fetch to it (freshness-gated ≤ `CHAIN_PREWARM_MAX_AGE_SECONDS`, best-effort fallback, read-only, no
  behavior change when no live session is active). The 3 independent vendor fetches (chain/daily/intraday)
  now run **concurrently** (per-stage best-effort isolation preserved); `_serve` gained **request-coalescing**
  (concurrent misses on one filter key share a single `compute_ticker`). The chain stays **full-chain**
  (max-pain/PCR/Vol-OI/term need it). `compute_ticker` is unchanged as the sole transform: same `market_data`
  in → **byte-identical bundle out** (score/tier/`state_fingerprint` proven identical cold==warm). Measured
  cold load **7.8s → 1.2s** on an active session. The SSE payload now emits a live **`last_trade`** (the
  trade-tape print, display-only — the mid stays the anchor; see §5 narrowing). A pre-warmed chain is
  recorded honestly as a `shared_hit` (0ms) in observability. **Frontend:** the monolithic full-page spinner
  is replaced by **skeleton-first load** — per-source skeletons (REST bundle / SSE / async AI-rec) fill
  independently; cold-load skeleton is visually distinct from offline-degrade and from "unavailable this
  cycle." A secondary **"Last trade"** readout sits beside the anchor (4 honest states; degrades with the
  live fields on an SSE drop); the previously-mislabeled chip `· last $X` (actually the mid) is relabeled
  `· mid $X`. QA PASS (Sonnet, de-correlated — 26/26 ACs, conformance 2/2, `nx test dashboard` 196/196).
  *(2026-06-25.)*
- **User accounts (auth + sessions + per-user settings)** — the project's first stateful backend surface.
  Email/username+password **signup & login** + **logout**, a persisted **server-side session** (signed
  HTTP-only cookie over a session table; survives reload, clears on logout, stale cookie ⇒ anonymous),
  **"Continue with Google"** wired end-to-end but **config-gated OFF** (no Google client provisioned →
  present-but-disabled, no crash; enable later via env, no rebuild), and **per-user light prefs** (active
  persona / default ticker / theme — server-wins signed-in, anonymous unchanged, per-account isolated).
  Backed by **in-memory SQLite** behind a three-port swap seam (`src/auth/`, a one-way leaf; resets on
  restart — accepted prototype). **Hybrid access:** anonymous browsing (Landing/Ticker/Scanner) unchanged;
  the **sim Positions WRITE actions + the "ask AI" call require a session, enforced server-side** (the
  auth gate is outermost over ai-rec's existing cap/gate). Passwords argon2-hashed (never plaintext/logged);
  Google secret + session key server-side only. Additive — `opportunity_score`/`opportunity_tier`/
  `state_fingerprint` byte-identical anonymous-vs-signed-in (score 24, fp `79373ef9194e`); no setting is a
  scoring input; `no-real-order-path` untouched (Positions stays `SIMULATED`). QA PASS (Sonnet,
  de-correlated; AC-E7 server-gate FAIL bounced+fixed, GATE Q re-run 30/30, conformance 2/2, `dashboard`
  246/246 + `@org/api` 7/7). *(2026-06-25.)*
- **Hybrid bring-your-own AI key (`byo-ai-key`, FE+BE)** — per-user Anthropic keys for the in-app AI rec.
  A signed-in user stores their own key (Settings "AI key" section, write-only — masked `····last4`, Replace/
  Remove, **no reveal**) and the rec calls Anthropic with **their** key (their cost, no shared cap). The
  shared `ANTHROPIC_API_KEY` gives a free allowance **only to ADMIN users** (`AI_REC_ADMIN_EMAILS` allowlist;
  default 3/day per admin, `AI_REC_ADMIN_FREE_DAILY`); **regular users get 0** (must BYO). **Own-key-first
  even for admins.** Five resolution states (regular-no-key / admin-with-allowance+counter / admin-exhausted
  / own-key / **admin-but-shared-key-unconfigured**), all best-effort always-200 + `status`. Keys are
  **encrypted at rest** (Fernet, server-side `AI_KEY_ENCRYPTION_KEY`, ephemeral fallback; new
  `UserCredentialStore` port + `src/auth/crypto.py` leaf), **never logged/returned/sent to the browser**;
  decrypt-fail ⇒ treated as no usable key. Per-request resolution at the `main.py` boundary; the AI rec
  stays a one-way leaf — score/tier/`state_fingerprint` byte-identical across all 5 states (24 / actionable /
  `79373ef9194e`). New dep `cryptography`. QA PASS (Sonnet, de-correlated — AC-19 named-test gap caught &
  fixed → re-run 26/26; security floor + byte-identity clean; dashboard 313/313 + `@org/api` 13/13).
  Realizes the deferred ai-rec BYO-key seam. *(2026-06-29.)*
- **Backend observability** (operator-facing; trader path unchanged): the six bundle stages
  (`vendor_fetch` io_vendor, `engine_build`/`off_exchange` cpu_engine, `signals` cpu_signals,
  `persist` io_disk, `serialize_wrap` serialize) are timed into a per-request trace; `meta.trace_id`
  (always when enabled) + `meta.timings` (only with `?debug=1`); read-only `GET /api/_metrics`
  rolling readout (p50/p95/max/count per stage+total, cache hit/miss/ratio/age, vendor count/latency/
  min rate-limit headroom→null="unknown" for Massive, per-ticker→global, recent traces w/ lineage);
  additive structured `trace request` log lines. Best-effort (never a non-200), **SSE uninstrumented**,
  ephemeral (resets on restart), computed values frozen.
- **Trader personas** (prompt-layer projection): `GET /api/personas` ships the decomposed
  FIXED/PERSONA hand-off template (both prompts) + the 7 built-in `PersonaDefinition`s + the A1
  disposition map as read-only data; the **FE assembles** the persona-parametrized prompt client-side.
  Default renders today's prompt **byte-identically**; persona reframes only the AI briefing — never
  `market_state`/`signals`/`opportunity_score`/`opportunity_tier`/`ai_eval`/`state_fingerprint` (all
  byte-identical across personas), **no recompute** on switch, **no `meta.handoff`, no `?persona=`**.
  A1: the "prone to greed…" disposition is lifted out of the universal risk floor into the disposition
  slot (Default + conservative only). No LLM call; SSE untouched.
- **In-app AI recommendations** (GammaFlow's first LLM call — isolated/gated/advisory): on demand for the
  current ticker, the dashboard queries a downstream LLM (latest Claude) for a **risk-first ENTRY rec**,
  framed by the active **persona** and fed a **JSON export** of the already-computed state. New isolated
  one-way-leaf module `src/core/ai_recommendation.py` (`signals`/`engine`/`live`/`darkpool` don't import
  it); `POST /api/recommendation/{ticker}` (best-effort, always-200 + `status` produced/unavailable/
  gated_off), `GET /api/recommendation/export/{ticker}` (no-LLM export floor, 404 if un-fetched), `GET
  /api/recommendation/status/{ticker}` (gating/cap/availability). Server-side `ANTHROPIC_API_KEY` (never
  in the browser); `ai_eval`-derived gating + 60s cooldown + 50/day cap (operator-configurable). The rec
  is a **static artifact** pinned to its snapshot (stale on a newer bundle, untouched on SSE drop). The FE
  renders it risk-first and lets the trader **Accept** it into the **paper-sim ghost-trade tracker** (a
  pre-filled, editable, mandatory-confirm entry — `SIMULATED`, no real-order path). The manual hand-off
  stays as the always-available floor. Score/tier/`state_fingerprint` byte-identical with/without it.
  Persona single-sourced from `GET /api/personas`. No real order, ever.
- Explanatory hover tooltips on every jargon stat/chip/chart.

## 7. Conventions
<!-- shard: tags=conventions,env,run,config,vendor -->
- **Env (`.env`):** `MASSIVE_API_KEY`, `DATA_FEED` (realtime|delayed), `CACHE_TTL_SECONDS` (60),
  `STALE_AFTER_SECONDS` (**120** default since ticker-load-experience — the real-time tier; was 1200),
  `CHAIN_PREWARM_MAX_AGE_SECONDS` (chain-pre-warm freshness budget, clamped ≤ `min(CHAIN_REFRESH_SECONDS,
  STALE_AFTER_SECONDS)`), `GATE_SCORE` (50),
  `FLOW_WINDOW_SECONDS` (300), `LIVE_THROTTLE_SECONDS` (1.5), `CHAIN_REFRESH_SECONDS` (120),
  `INCLUDE_DARK_POOL` (true), `DARKPOOL_LOOKBACK_SECONDS` (3600), `BLOCK_MIN_SHARES` (5000;
  fixed institutional-size threshold for an off-exchange block print), `VOL_OI_UNUSUAL_THRESHOLD`
  (1.0; cutoff above which a strike's vol/OI reads "unusual", echoed as `vol_oi_unusual_threshold`),
  `TIER_WATCH_SCORE` (25) / `TIER_ACTIONABLE_SCORE` (=`GATE_SCORE`) / `TIER_PRIME_SCORE` (75;
  opportunity-tier bands — Prime also requires `ai_eval.ready`), `OBSERVABILITY_ENABLED` (true;
  off ⇒ no `meta.trace_id`/`timings`, no metrics, bundle identical), `METRICS_WINDOW_SIZE` (500;
  rolling-window request count), `METRICS_RECENT_TRACES` (25). Per-request verbose switch: `?debug=1`.
  **AI recommendations:** `ANTHROPIC_API_KEY` (server-side only, never in the browser; absent ⇒ in-app
  rec `unavailable:no_key`, manual export floor still works), `AI_REC_MODEL` (latest Claude),
  `AI_REC_COOLDOWN_SECONDS` (60), `AI_REC_DAILY_CAP` (50), `AI_REC_TIMEOUT_SECONDS` (60),
  `AI_REC_IN_APP_ENABLED` (true), `AI_REC_STUB` (off; stub LLM provider for keyless/no-cost verification).
  **Auth (user accounts):** `ACCOUNT_STORE` (store backend selector, default `memory` = in-memory SQLite
  that resets on restart; **`postgres` = the persistent adapter shipped in `persistent-db`** — reads
  `DATABASE_URL` (+ `DATABASE_POOL_MAX`, default 10) at runtime, never baked; `src/auth/postgres_store.py`,
  psycopg3 sync, ciphertext-only, idempotent schema bootstrap; a Postgres outage fails auth closed (503/
  anonymous) while the anonymous bundle/SSE path stays up. **In persistent mode `AUTH_SESSION_SIGNING_KEY` +
  `AI_KEY_ENCRYPTION_KEY` MUST be set to STABLE values** or durable cookies/encrypted keys break on restart),
  `AUTH_SESSION_SIGNING_KEY`
  (server-side HMAC key for the session cookie; absent ⇒ an **ephemeral per-process key** so cookies also
  reset on restart — set it once a persistent store lands), session-lifetime knobs (idle + absolute expiry),
  and the **Google OAuth** creds `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`
  (server-side only, gitignored; **absent ⇒ "Continue with Google" present-but-disabled**, no crash —
  mirrors the `ANTHROPIC_API_KEY`-absent ⇒ ai-rec `no_key` pattern; provision to enable, no rebuild). New
  backend deps: **`argon2-cffi`** (password hashing) + **`authlib`** (OAuth) in `apps/api/requirements.txt`
  (re-run the venv `pip install -r requirements.txt`). A raw password / hash / signing key / Google secret
  never appears in a response or a log line.
  **AI key (byo-ai-key):** `AI_KEY_ENCRYPTION_KEY` (server-side Fernet key encrypting stored per-user
  Anthropic keys; gitignored; absent ⇒ an **ephemeral per-process key** so stored keys reset on restart —
  set a stable one once a persistent store lands or saved keys become unreadable after restart),
  `AI_REC_ADMIN_EMAILS` (comma-separated allowlist of admin emails that get the shared-key free allowance;
  matched case-insensitively against the session email; everyone else gets 0 free + must BYO),
  `AI_REC_ADMIN_FREE_DAILY` (per-admin daily free allowance on the shared key, default 3 — distinct from the
  global `AI_REC_DAILY_CAP`). New backend dep **`cryptography`**. A raw user API key / its ciphertext never
  appears in a response, log line, or the browser.
- **Add a vendor:** implement `MarketDataProvider` in `apps/api/src/providers/<name>.py`, register in
  `_PROVIDERS`, set `DATA_PROVIDER`. Nothing else changes.
- **Run:** backend `npx nx serve api` (uvicorn :8000, i.e. `apps/api/.venv/Scripts/python.exe
  main.py`); frontend `npx nx serve dashboard` (Vite :4200, proxies /api). Node via nvm-windows.
  Backend venv: `cd apps/api && py -m venv .venv && .venv/Scripts/python.exe -m pip install -r
  requirements.txt`.
- **Containerized (`containerize-apps`, 2026-06-29):** `apps/api/Dockerfile` (python:3.12-slim, non-root,
  uvicorn :8000) + `apps/dashboard/Dockerfile` (multi-stage Nx/Vite build at **repo-root context** →
  unprivileged nginx :8080 serving `dist` + SSE-safe `/api`→`api:8000` proxy) + root `docker-compose.yml`.
  Local full stack: `docker compose up --build` → http://localhost:8080. **Secrets injected at RUNTIME via
  env (`env_file: ./apps/api/.env`), NEVER baked into an image** (`.dockerignore`s + explicit COPYs enforce
  it); images run non-root. `apps/api/.env.example` is the value-less template. **Containers are stateless /
  restart-resettable** — the in-memory SQLite resets accounts/sessions/AI-keys (set stable
  `AUTH_SESSION_SIGNING_KEY`/`AI_KEY_ENCRYPTION_KEY` to survive restarts); the persistent store is the
  pending `persistent-db` feature. (Build/run requires Docker Desktop — not installed in the dev box where
  the files were authored.)
- **✅ DEPLOYED & LIVE (`deploy`, 2026-06-29):** **https://convexa.pages.dev** (Cloudflare Pages) → Pages
  Function proxy → **https://convexa-production.up.railway.app** (Railway, app on `$PORT`=8080) + managed
  Postgres. Verified end-to-end (SPA 200; proxied `/api` returns real Postgres-backed backend JSON). Config: backend →
  **Railway** (builds `apps/api/Dockerfile`, root dir `apps/api`; CMD honors Railway's `$PORT`; managed
  Postgres plugin → `DATABASE_URL`; `ACCOUNT_STORE=postgres`). Frontend → **Cloudflare Pages** (build
  `npx nx build @org/dashboard` → `apps/dashboard/dist`). Cross-origin `/api` is a **streaming Cloudflare
  Pages Function** (`apps/dashboard/functions/api/[[path]].ts`) proxying `/api/*`→Railway (SSE-safe; reads
  the backend URL from the Pages env `API_ORIGIN`; 404-blocks `/api/_metrics` at the edge). **New prod env
  (owner-set in Railway, never committed):** `ALLOWED_ORIGINS` (the `*.pages.dev` origin), `METRICS_SECRET_TOKEN`
  (gates `/api/_metrics` on the direct Railway origin — `Authorization: Bearer` / `X-Metrics-Token`),
  `PUBLIC_RATE_LIMIT_PER_MIN` (per-IP throttle on `/api/ticker`+`/api/stream`; 429 before any vendor call;
  fail-open; IP via `CF-Connecting-IP`/`X-Forwarded-For`), and **mandatory stable** `AUTH_SESSION_SIGNING_KEY`
  + `AI_KEY_ENCRYPTION_KEY` (a startup WARNING fires if absent under postgres). system-6 review =
  GO-WITH-REQUIRED-FIXES (3 HIGH closed; 3 MED + 3 LOW fast-follows in the archived `deploy/SECURITY_REVIEW.md`).
- **Frontend tests (standing rule — part of every FE feature):** `npx nx test dashboard`
  (and `nx test api` for `libs/api`) — Vitest + jsdom + Testing Library (+ `@testing-library/user-event`
  + `jest-dom`) + v8 coverage, wired via `@nx/vite`; colocated `*.spec.tsx`/`*.spec.ts`. The FE
  executioner writes unit + component + **flow-integration** tests for each feature; the
  flow-integration test is the centerpiece — it drives the actual user flow end-to-end through every
  edge case, mocking only the network boundary (never a live backend). Assert the contract's component
  states + degraded paths + promoted invariants, not a coverage %. **The FE does not decide the
  requirement set:** required tests are specified by the contract chain — the PM's ACs (each AC = a
  required behavioral test) + the UX-authored FRONTEND_EXECUTION_CONTRACT "Tests to write" matrix +
  the promoted invariants. The FE implements that set (a floor) and may add its own unit tests (a
  ceiling), but never silently drops a required case (untestable → GATE Z bounce). QA enforces
  **AC↔test traceability** at GATE Q: every AC maps to ≥1 named passing test (an uncovered AC is a FAIL
  even if the suite is green). **E2E = Playwright** (`@nx/playwright`), adopted nearer go-live for the
  critical flow; optional before then (the BE↔FE seam is already verified by `interface_conformance.py`).
- One Nx monorepo: backend `apps/api`, frontend `apps/dashboard`, shared TS client `libs/api`
  (`@org/api`), contracts `.claude/contracts/`; no remote. (Was two repos pre-merge; the archived
  `C:\Dev\GammaFlow` is history only.)

## 8. Downstream-AI contract
<!-- shard: tags=ai,prompt,strategy,reassessment,glossary,personas -->
- `market_state_glossary.md` = field-level reference (reliability order, regimes, envelope,
  off_exchange, ghost-trade tracker). `prompts/strategy_prompt.md` = when to invoke (gate + dedupe) +
  required risk-first output schema (entry). `prompts/reassessment_prompt.md` = the position-aware
  sibling: an OPEN trade + current `market_state` + decision digest → risk-first verdict ∈
  {Hold,Trim,Add,Exit,Roll}. Both prompts are **decomposed** into FIXED vs PERSONA sections (trader
  personas; A1): the FIXED floor/schema/cap carry no trader characterization, and the disposition +
  framing are persona-variable slots. `src/core/personas.py` / `GET /api/personas` ship the
  decomposed template + 7 `PersonaDefinition`s; the FE assembles per-persona text.
- **AI-call boundary (narrowed 2026-06-23 — `ai-external-no-llm` demoted, system-7):** GammaFlow **MAY
  now call an LLM**, but **only** as a best-effort, isolated, gated, **advisory consumer** of
  already-computed state — the `ai-recommendations` in-app rec (`POST /api/recommendation/{ticker}` +
  `/export` + `/status`) via an isolated one-way-leaf proxy with a **server-side** key. The LLM **never**
  feeds `signals`/score/tier/gate/`state_fingerprint`, **never** recomputes or fetches, **never** rides
  the SSE path, **never** auto-acts (Accept = paper-sim ghost trade + confirm), and the key **never**
  reaches the browser. Otherwise the AI remains **external** — GammaFlow defines the contract + gate —
  and the manual copy-paste hand-off **remains valid**, now augmented by the same structured JSON export.
  (Was: "does not call an LLM." See DECISION_LEDGER "Demoted.")

## 9. Open items / under consideration
<!-- shard: tags=open,roadmap,vendor,overnight -->
- **Vendor evaluation:** Massive (cheap ~$400/mo flat, greeks included, no overnight) vs
  **Databento** (overnight via Blue Ocean + full OPRA + fidelity, but live-overnight likely
  Plus tier ~$1,500/mo + separate OPRA + build own greeks) vs **Webull data API** (cheap
  overnight underlying but no options, 3 msg/s/conn throttle, broker-gated). Overnight coverage
  is the core gap driving this.
- **Dark pool is a bounded recent-window view** (not multi-session block accumulation — that
  needs a heavier batched pull).
- **Gamma-flip model divergence** (vendor vs analytic) judged immaterial; measure before any
  calibration. The bigger latent modeling choice is fixed-IV-under-spot-move in the flip search.
