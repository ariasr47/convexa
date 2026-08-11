# Convexa — Project Context (handoff)

> Self-contained ground truth for fresh, role-scoped sessions (Architect → PM →
> UX/Tech-Writer → Backend/Frontend Executioners). Assume no chat history. Grounded
> against the repo; re-generate from code if it drifts.

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
- **Multi-page shell (Convexa, 2026-06-24):** `src/app/app.tsx` is the **route table** (a single
  `BrowserRouter`; the MUI theme is **mode-aware dark + light** — `features/auth/ThemeProvider` over
  `shared/theme/`, NOT the dark-only theme this bullet originally described; see `light-mode-parity`,
  2026-07-01): `/` → `pages/landing/` (the full-bleed Convexa splash, outside the shell) · a persistent
  `shell/AppShell.tsx` (`<Outlet/>` nav — Convexa wordmark + Ticker/Positions/Scanner, mounts once)
  wrapping `/ticker/:symbol` (→ `pages/ticker/TickerDashboard.tsx`, the relocated GEX dashboard; bare
  `/ticker`→TSLA) + `/positions` (→ `pages/positions/PositionsPage.tsx`, the route shell over
  `features/trading/positions/`) + `/scanner` (→ `pages/scanner/`, a static coming-soon stub) ·
  `/settings` (→ `features/auth/SettingsPage.tsx`) · `/_ops/metrics` (→ `pages/operator-metrics/`)
  stays OFF the shell + unlinked. **Live SSE is page-scoped to the Ticker page** (opens on mount, closes
  on nav-away, reopens on return, never double-subscribes); the positions store is a localStorage
  singleton so it persists across nav. Brand was UI-only at the time (durable keys / packages / identifiers
  unchanged) — **superseded 2026-06-28 by `rebrand-convexa`: full GammaFlow→Convexa rename incl. a loss-free
  migration of the durable keys to `convexa.*`.**
  The relocated `TickerDashboard` body is byte-identical to the old single-page dashboard described next.
- `pages/ticker/TickerDashboard.tsx` (was `app.tsx`) — dashboard (toolbar, stat tiles, setups, **Off-exchange
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
- **FE structure — LANDED on `main` (2026-07-16, `b194bdc`):** the dashboard `src/app/` is organized by
  **kind**: `pages/` (one folder per route) · `features/` (cross-cutting **domains** — `trading/`
  {`TradeEntryDialog`, `model/`, `orders/`, `positions/`}, `auth/`, `personas/`) · `shared/` (the app kernel —
  `theme/`/`ui/`/`hooks/`/`lib/`) · `shell/` (the layout frame), with a `@/*`→`src/app/*` import alias and
  **folder-per-widget** under `pages/ticker/widgets/` (+ `_kit/` = ticker-local widget infra, `chrome/` = the
  page frame, not bento widgets).
  **`apps/dashboard/src/app/README.md` is the AUTHORITATIVE map — read it; do not duplicate it here.**
  **Structural rules (binding on new FE work):** dependency direction is **downward only** (`pages`/`features`
  → `shared`); **pages NEVER import sibling pages** — that is the whole reason `features/` exists (a surface
  used by ≥2 pages moves to `features/`; a single-page consumer stays on that page); `shared/` is populated on
  the **2nd consumer**, never preemptively. Naming note: `features/` holds **domains** (nouns), not delivery
  features — delivery features live in `.spire/clusters/tech/contracts/`. Presentation-only refactor — score/tier/
  `state_fingerprint` untouched; **674/674 tests green on `main`**. **Every path in this §2 Frontend section
  is post-move** (reconciled 2026-07-16); paths are relative to `apps/dashboard/src/app/`.
- `pages/ticker/widgets/gex-profile-chart/` (`chart.tsx` + `GexStrikeProfile.tsx`) — recharts **vertical
  diverging** net-GEX-by-strike: strikes on the category X-axis, net GEX on Y, a zero `ReferenceLine`, and
  de-collided spot / flip / live-flip reference labels. **`net_gex` is the ONLY bar series** — the former
  per-strike Net DEX series was dropped at the redesign; **Net DEX · Vol/OI · volume now appear in the
  TOOLTIP only** (each independently nullable). Vertical is a deliberate owner UX call — a documented
  intentional Figma deviation (do NOT "fix" it back to horizontal).
- `features/trading/model/` (was `app/ghost-trade/`) — **the foundational trade/decision model + P&L engine
  the WHOLE trading domain depends on** (`positions/` + `orders/` import from it). NOT "the old dialog" —
  `types.ts` (trade/decision types) · `mark.ts` (the mark ladder + P/L) · `store.ts` (the durable store) ·
  `useGhostTrade.ts` · `OpportunityTier.tsx`. No real order anywhere. Client-local durable store
  (`localStorage`, versioned, exportable) for the open `GhostTrade` + append-only `DecisionRecord[]`
  (survive reload + SSE drop). `useGhostTrade` owns the honest **mark ladder** (snapshot anchor → modeled
  between snapshots off the live underlying × cached greeks → theoretical BS → last-known offline → frozen
  overnight/closed), P/L = (mark−entry)×100×qty, edge-detected **reassessment alerts** (once per event;
  suppressed while stale/offline/closed), the operator-mediated **reassessment boundary** (build request →
  paste verdict → Accept maps Exit/Trim/Add-capped/Roll/Hold), and the **opportunity tier** read
  (`signals.opportunity_tier`). **`GhostTradePanel` was DELETED** (sim-entry-unification, 2026-07-01 — zero
  importers); the entry surface is the ONE shared `features/trading/TradeEntryDialog.tsx` (see the
  `[single-shared-sim-entry-dialog]` invariant). `OpportunityTier` (tier emphasis + Prime banner) is
  consumed by `pages/ticker` — a named deferral is to relocate it into a ticker widget. Tracked contract
  stats come from `GET /api/contract` (filter-independent; 404 → tracking-unavailable, `option_quote:null`
  → theoretical mark). Isolation: an SSE drop degrades only P/L + current mark (⏸ last known); the trade
  record/stats/history + GEX chart + all tiles persist.
- `features/trading/positions/` (was `app/positions/`; route shell = `pages/positions/PositionsPage.tsx`) —
  **paper-sim positions portfolio** (multi-position evolution of the ghost-trade tracker). Flat id-keyed
  durable collection (loss-free v1→v2 migration) + the entry/fill resolver `entry.ts` (manual / market /
  **limit** that fills only on a live cross at the limit price, `pending → filled/cancelled`); `derive.ts`
  (filter/sort/group + P/L subtotals); `useTrends` (ephemeral per-position P/L trend ring buffer, reusing
  the latency-trend pattern); `usePortfolio` (the brain). UI: `PortfolioPanel` (Simulated/Live tabs),
  `PositionsView` (table↔card + density), `PositionRow` / `PositionCard`, `PositionsPanel`,
  `CustomizationToolbar`, `PlSparkline`, `LiveTabPanel` (**zero-import LOCKED** placeholder — no
  broker/order/data). **`PositionEntryDialog` was DELETED** (sim-entry-unification, 2026-07-01) — entry goes
  through the ONE shared `features/trading/TradeEntryDialog.tsx`. Reuses `features/trading/model/mark.ts`
  for P/L; durable customization + named saved views. `NO_BACKEND_CHANGE` (consumes `GET /api/contract` +
  SSE); never a scoring input; `SIMULATED`.
- `pages/operator-metrics/` (`operator-metrics.tsx` + `LatencyTrend.tsx` + `useLatencyTrend.ts`) —
  **operator-only** metrics readout on route
  `/_ops/metrics` (its own AppBar, OFF the trader routes, not linked from the trader UI). Read-only +
  side-effect-free (`fetchMetrics` → `GET /api/_metrics` only): global + per-ticker stage tables
  (I/O|CPU from `kind`, p50/p95/max/count/ok-err-skip), total/cache/vendor lines, recent-traces with
  warm/cold inspect. Honest: empty → `—`, `skipped` shown, headroom `null` → `unknown`, non-alerting.
  The **trader dashboard ignores** the new `meta.trace_id`/`meta.timings` (renders neither). Tops the
  page with a **`LatencyTrend`** card: a local, in-browser, **ephemeral** trend
  of the windowed snapshots. `useLatencyTrend` is the page's **single fetcher** — one stable poll loop
  (still only `GET /api/_metrics`, once per cadence) feeding both the trend and the snapshot tables;
  a bounded serializable ring buffer stores raw per-scope snapshots so metric/percentile/scope/stage
  switches re-derive with no refetch. Gaps = broken line (`connectNulls=false`, never 0/interpolated),
  restart = broken line + `Service restarted` marker (never stitched), stale-repeat distinct, headroom
  `unknown`, failed poll keeps the last series + self-heals (no retry storm), local JSON Export (no
  server state), auto-pause when hidden; non-semantic palette, no thresholds/alerts. Clears on
  reload (expected). NO_BACKEND_CHANGE — `/api/_metrics` consumed unchanged.
- `features/personas/` (was `app/personas/`) — **trader personas**: a prompt-layer presentation overlay,
  assembled **FE-side** (locus PINNED FE-rendered). A faithful **embedded** decomposed hand-off
  template (`template.ts`; Default renders today's prompt byte-identical; A1 disposition slot relocated) +
  7 built-in `presets.ts` + client-local custom personas + `active_persona_id` (persisted, `store.ts`).
  `usePersona` + `components.tsx` (`PersonaPicker`, `PersonaCustomizeForm`). **`HandoffDialog` was REMOVED**
  (convexa-redesign GATE-V cleanup, 2026-06-30 — the owner dropped the hand-off viewer; AI-rec no longer
  opens it), so the Entry/Reassessment-tab viewer no longer exists in the UI. **Switching persona is pure
  presentation — no getTicker/streamTicker, no recompute; score/tier/gate/fingerprint are invariant.** A visible/
  overridable DTE pre-fill chip (one-shot on explicit navigation, never recomputes). NOTE: the FE
  embeds the template/presets rather than consuming the backend's `GET /api/personas` — correct
  output, but dual-sourced (see OPEN_THREADS thread 7 reconciliation flag).
- `features/auth/` (was `app/auth/`; also owns the `/settings` route shell — `SettingsPage.tsx`, kept with
  the domain because they are tightly coupled) — **user-accounts UI** (hybrid access; anonymous browsing
  unchanged).
  `AuthContext` (non-blocking who-am-I read; **degrade-to-anonymous** on failure; server-wins settings),
  `AuthDialog`/`AuthDialogProvider`/`AccountControl` (login by **email** / signup; username optional
  display-only; non-enumerating 401), `GoogleButton` (first-class **present-but-disabled-when-unconfigured**,
  driven by `google_available` — config-flip, no rebuild), `useGate`/`SignInPrompt` (the shared gated-action
  helper — awaits a **server gate** before any local write; 403→prompt+abort), `SettingsPage`/`useSettings`/
  `localPrefs`/`ThemeProvider`/`copy`/`validation` (the 3 light prefs — active persona / default ticker /
  theme; server-wins signed-in, client-local anonymous, **per-account isolated**, score-neutral). Also
  `AiKeySection.tsx` (the BYO-key surface). Gating is wired into
  `features/trading/positions/PortfolioPanel` + `CustomizationToolbar` (open-position / save-view /
  accept-rec writes call `POST /api/positions/sim-trade/gate`; D6d "stored in this browser, not tied to your
  account yet" disclosure) and `pages/ticker/widgets/ai-rec/AiRecPanel` (ask-AI **auth-outermost** — a
  logged-out call shows "sign in", never ai-rec cooldown/cap/no_key; manual export floor stays anonymous).
- `libs/api/src/lib/convexa.ts` (renamed from `gammaflow.ts` at the rebrand; consumed via `@org/api`, so
  zero export churn) — typed API client: `getTicker`, `streamTicker`,
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
> Graduated via the recurrence rule in `.spire/clusters/tech/context/DECISION_LEDGER.md`. A new feature's `BRIEF.md` cites
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
- **`[single-shared-sim-entry-dialog]`** (promoted 2026-07-02, 2 binding; **NARROWED to SIM-ONLY
  2026-07-16**) — every **simulated** entry flow (ghost trade, positions, act-on-rec/orders) launches **THE
  one shared `app/features/trading/TradeEntryDialog`**. A new **sim** entry shape is an additive **variant**
  of it (props/modes — e.g. the fill-mode control, the order variant), **never a forked second dialog**; a
  superseded fork is deleted with zero-importer proof.
  **⚠ SCOPE (the narrowing): this rule governs SIMULATED entry ONLY. A real-money / broker entry surface
  MUST be a structurally SEPARATE component — never a mode, prop, or variant of the sim dialog.** The one
  place a fork is a *feature, not a smell* is the boundary between "this is pretend" and "this moves real
  money"; a shared component there invites the most expensive confusion the app can produce, and
  `[no-real-order-path]` exists to keep that boundary hard. Un-narrowed, this key would have pushed
  `broker-connect`'s real entry into the sim dialog as an "additive variant" — backwards. Reopening the
  narrowing is a deliberate GATE-Z reversal.
  *(sim-entry-unification — created it + deleted the forks; ai-rec-backtest-orders — the contract-mandated
  order variant. 2 binding. Narrowed by owner canon review 2026-07-16 — see DECISION_LEDGER "Narrowing
  note"; `apps/dashboard/src/app/README.md` corrected the same day.)*
- **`[loss-free-durable-migration]`** (**promoted 2026-07-16 via the SEVERITY path, 1 instance**) — when a
  durable **client** store's key or shape changes, existing user data is carried forward **loss-free**:
  **read-new-else-old, promote-forward, never-delete, idempotent, never-throw**, composing with any prior
  version chain (the `resolveDurable(new, old)` helper + the positions `v1→v2` chain are the reference
  implementation). A corrupt or unreadable blob **degrades to empty WITHOUT destroying the original**.
  **Why this is canon at 1 instance, not 3:** ~5 durable localStorage stores (`convexa.positions.v2`,
  `.ghost-trade.v1`, `.orders.v1`, `.personas.v1`, `.uiprefs.v1`) hold the user's **entire trading history
  and decision record, with NO server backup and no automatic export** — so a single migration bug is a
  **silent, total, irreversible** loss. Severity, not recurrence, earned this. Any feature touching a
  durable key/shape (the broker + persistent-DB tracks will) restates it.
  *(rebrand-convexa — the loss-free `gammaflow.*`→`convexa.*` key migration. Promoted by owner canon review
  2026-07-16 on the severity path added to DECISION_LEDGER the same day.)*
- **`[score-change-is-deliberate-and-measured]`** (**promoted 2026-07-16, owner canon review**) — the
  companion `[additive-keeps-score-byte-identical]` lacked. The `opportunity_score` / `opportunity_tier` /
  entry gate **MAY** evolve — they are not frozen — but **only deliberately**: via an **explicit
  score-changing feature** that (a) states its rationale, (b) records a **before/after on real tickers**,
  and (c) **version-bumps the fingerprint basis** so the change is legible downstream. A score change is
  **never a side effect** of an additive feature (that remains forbidden), and **never lands unmeasured**.
  **Why this exists:** the additive rule correctly stopped *accidental* score drift, but — with no
  counterpart — it hardened into a de-facto **freeze**. Evidence at promotion: `_opportunity_score(dist,
  ivhv, setups, near_flip)` (+ a capped dark-pool bonus) was **unchanged for 210 commits** (last
  substantive edit `d3aeb4f`, 2026-06-22) while **eight** enrichment features shipped — dex/vol-oi/skew/
  term, dealer-flow-projection, ai-context-pack, iv-rank, ATR — **none of which can reach it**. The score
  rewards vol *extremity* via `abs(IV/HV − 1.0)`, so **rich and cheap premium score identically**, while
  `iv_rank.band` (`premium_rich|premium_cheap`) sits in the payload unable to inform it. The hand-tuned
  constants (`40/25/25/10`, `8.0`/setup, `DEFAULT_GATE_SCORE = 50`) have **never been validated against an
  outcome**. This rule does not weaken the additive invariant — it opens the *intentional* door the
  additive rule was never meant to close. **Prerequisite in practice:** you cannot improve a score you
  cannot measure — see the `outcome-ledger` feature.
- **`[theme-token-discipline]`** (promoted 2026-07-02, 4 programs) — a new or re-skinned FE component binds
  to the **MUI theme / `tokens.ts`** — mode-aware values go through **`extrasFor(theme)`** inside sx
  callbacks (bare `extras.` is dark-only) — and carries **zero hardcoded hex**; dark/light parity is part
  of done. *(convexa-redesign — watch-listed; ticker-ux-polish — held; light-mode-parity +
  sim-entry-unification — the `extrasFor` mechanism; ai-rec-backtest-orders — the token-only orders module.)*
- **`[model-read-carries-its-assumptions]`** (promoted 2026-07-06, 2 binding) — a forward-looking or
  **model-dependent** read (a projection, a model-derived level, a threshold-bucketed regime label or
  scalar) is surfaced **self-describing**: it carries its own **horizon / window / assumption / basis /
  threshold** and is framed as **advisory context — never a guarantee, a price forecast, or a scored
  signal**. Generalizes the analytic gamma-flip's measure-before-calibrate honesty. *(dealer-flow-projection
  — the assumption-explicit charm/vanna projection; ai-context-pack — every trend/shape/flow/ATR read
  carries its window+threshold+basis descriptor + the "not a forecast, not a scored signal" framing;
  iv-rank — the rank carries its window / sample-count / IV-basis in-payload + the "building history"
  honest state. 3 instances.)*
- **`[digested-labels-not-raw-dump]`** (promoted 2026-07-07, 2 binding) — a derived-signal set fed to the
  downstream AI (and displayed) is a **SMALL orthogonal set pre-digested into regime/band LABELS**, not a
  raw indicator/OHLC/series dump — signal overload degrades the AI and the UI. The **wire enum/token is
  authoritative** (the FE renders it via a closed lookup, **never re-derives** a label from the underlying
  scalar); the raw series stays out of the wire and the UI. *(ai-context-pack — the TI regime labels
  [direction/strength/momentum/…] off ADX/RSI/EMA, no raw indicator series; iv-rank — the rich/cheap
  `band` [premium_rich|neutral|premium_cheap] cut server-side from the rank, no raw IV history on the wire
  or in the UI. 2 binding.)*

## 7. Conventions
<!-- shard: tags=conventions,env,run,config,vendor -->
- **The Feature Atlas (`docs/atlas/atlas.html`) is GENERATED — never edit it by hand.** It is the owner's
  living map of the product (journey · catalog · invariants · roadmap), emitted by
  `py docs/atlas/build_atlas.py` from the canon (OPEN_THREADS + archived manifests + DECISION_LEDGER +
  BACKLOG). **Regenerate it at every GATE S** (and after any BACKLOG grooming) — the script is the sync
  step, so the atlas can never drift from the canon it renders. Roadmap items carry
  `<!-- atlas: theme=… horizon=… -->` annotations IN BACKLOG (the single source; themes:
  trust-the-signal · breadth · reach · go-live · the-machine; horizons: now/next/later).
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
  (`@org/api`), contracts `.spire/clusters/tech/contracts/`; no remote. (Was two repos pre-merge; the archived
  `C:\Dev\GammaFlow` is history only.)

