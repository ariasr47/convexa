# Convexa — Project Context (handoff)

> Self-contained ground truth for fresh, role-scoped sessions (Architect → PM →
> UX/Tech-Writer → Backend/Frontend Executioners). Assume no chat history. Grounded
> against the repo; re-generate from code if it drifts.

## 2. Backend architecture
<!-- shard: tags=architecture,backend,api,engine,signals,live,sse,providers,observability -->
> **Repaired 2026-08-20 (`project-context-s2-is-python-era`).** The live server is **Axum / Tokio**,
> crate **`api-rust`**, tree `apps/api/src/`. Quant compute is **`libs/quant-engine`** (pure; no I/O).
> Python FastAPI (`main.py`, `src/core/*.py`, `src/providers/*.py`) is **archived** at
> `archive/api-python/` and is **not** ground truth. Do not cite it.

**Serve / process:** `main.rs` + `server.rs` — clap: `serve` (HTTP) plus research CLIs
(`join-outcomes`, `score-lab`, `batch-backtest`, `replay-outcome-join`). Bind/port from
`project.json` / env. `config.rs` + `state.rs` hold `AppState` (gex cache, Massive client,
scanner/warmer/ensure workers, snapshot + session-archive stores).

**Vendor + hermetic port:** `infrastructure/massive/` (REST + WebSocket). Optional
`infrastructure/redis/` price cache. `services/market_data/` — `MarketDataPort::{Live, Fixture}`
→ `VendorBundle`. Fixture arm is how research/CI avoids the network. Adapter swap stays in
infrastructure; `quant-engine` never imports a vendor SDK.

**Compute path:** `services/analytics.rs` — `compute_analytics_from_vendor` is the one Path-B
entry (live and replay). Scanner / ticker **cold** compute may `spawn_capture` into the 48/14d
ring; `refresh_analytics` (warmer) does **not**. `load_or_compute` **cache-hit** returns without
capture — SPY/QQQ/IWM session books are filled by the off-path
`session_chain_archive/ensure_worker` instead. Opportunity score / tier / fingerprint come from
`quant-engine::signals` (`generate_signals`, `compute_opportunity_tier`) — **not** from a Python
`signals.py`.

**Pure engine (`libs/quant-engine`):** dollar GEX (vendor gamma), walls, peak, **analytic** gamma
flip, DEX, Vol/OI, IV skew/term, HV, VWAP, dark-pool/off-exchange, IV rank, market-context pack,
rule-based setups + `state_fingerprint`. Math invariants stay in §3. This crate has **no** HTTP,
auth, or Massive client.

**Live / SSE:** `services/price_stream.rs` + `domain/` (`MarketPhase`, spots). Live NBBO mid is
the structure anchor; last-trade is display-only. SSE is trader-page scoped on the client.

**Capture / research stores:** `services/chain_snapshot/` — append-only paid `VendorBundle` ring
(48/symbol **and** 14d). `services/session_chain_archive/` — prune-proof `(symbol, et_date)`
session books; **bodies** on `SESSION_CHAIN_ARCHIVE_BODY_ROOT` (not app-Postgres BYTEA). Research
list/load: `GET /api/_research/chain-snapshots/*` and `GET /api/_research/session-books/*` (zero
Massive; Pages trader origin **404s** `/api/_research` like `/api/_metrics`).

**Scanner:** `services/scanner/` — bounded **off-request-path** universe sweep writing
`scan_structure_history` / board cache. The trading/serve **request path** still computes exactly
the one ticker asked for (`single-ticker-on-demand` narrowed form).

**AI rec (one-way leaf):** `services/recommendation.rs` + `llm.rs` + `rec_inputs/` +
`llm_catalog.rs`. Score/tier/fingerprint modules do not import it. Multi-provider BYO keys;
Grok subscription arm is present-but-unavailable until OAuth is buildable. `GET /api/personas`
is a non-scoring prompt projection (`routes/market.rs`).

**Auth / book / broker:** `services/auth/` — sessions, settings, encrypted credentials (argon2;
ciphertext-only secrets). Real HTTP statuses (401/403/409); trading path degrades to anonymous.
`routes/book.rs` — durable user book blob. `services/broker/` — read-only brokerage port
(**no order/execution path**). `POST /api/positions/sim-trade/gate` remains server-side.

**Observability:** `GET /api/_metrics` (token-gated when `METRICS_SECRET_TOKEN` is set) —
read-only, off trader routes. `quant-engine` does not import it.

**Persistence:** `db/` Postgres migrations when `DATABASE_URL` + `--features postgres`; else
JSON/sqlite under `data/`. Research CLIs in `services/research/` **Authorizes: nothing** on
the live score.

**Production profile:** Railway/release startup requires explicit `APP_ENV`, Postgres schema
preflight, a writable/flushed archive-body root, addressed signing/encryption key rings, a valid
operator metrics token, exact HTTPS browser origins, and secure cookie policy before any listener or
worker starts. Production metrics are operator-token gated; CORS is an exact-origin allowlist. The
API runs as UID `10001`, one startup owner/replica applies embedded migrations, and archive bodies use
the mounted `/data/session-chain-archive` root. The release gate retains same-SHA Postgres CI,
startup-owner, live conformance, and volume-replacement receipts.

## 2b. Frontend architecture
<!-- shard: tags=frontend,ui -->
**Frontend** (`apps/dashboard/` in the Nx monorepo, React 19 + Vite + MUI/Emotion):
- **Multi-page shell (Convexa, 2026-06-24):** `src/app/app.tsx` is the **route table** (a single
  `BrowserRouter`; the MUI theme is **mode-aware dark + light** — `features/auth/ThemeProvider` over
  `shared/theme/`, NOT the dark-only theme this bullet originally described; see `light-mode-parity`,
  2026-07-01): `/` → `pages/landing/` (the full-bleed Convexa splash, outside the shell) · a persistent
  `shell/AppShell.tsx` (`<Outlet/>` nav — Convexa wordmark + Ticker/Positions/Scanner, mounts once)
  wrapping `/ticker/:symbol` (→ `pages/ticker/TickerDashboard.tsx`, the relocated GEX dashboard; bare
  `/ticker`→**SPY** via `index-first-defaults`) + `/positions` (→ `pages/positions/PositionsPage.tsx`, the route shell over
  `features/trading/positions/`) + `/scanner` (→ `pages/scanner/`, **shipped** multi-ticker surface) ·
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
- `libs/api/src/lib/convexa.ts` (renamed from `gammaflow.ts` at the rebrand; consumed via `@convexa/api`, so
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
  **NARROWED 2026-07-26 at `scanner` GATE S (system-7 — a descriptive narrowing, NOT a demotion):** the
  rule was written against an *unbounded, per-request market sweep* — that remains forbidden. It is now
  stated precisely as: **the trading/serve REQUEST PATH computes exactly the one ticker asked for;
  multi-ticker computation happens ONLY in a separate, bounded, off-request-path sweep worker writing a
  side-store.** The Ticker page's latency budget is unchanged (the request path is still
  single-ticker-on-demand); the scanner is a budgeted background producer feeding a cache. What moved is
  the *bound*: the original constraint was the vendor's per-ticker options budget colliding with a
  synchronous request; the current plan removes the vendor as the constraint, leaving our own engine CPU,
  held by the worker's pool off the request path. Re-opening this further (e.g. an in-request market
  sweep) is a GATE-Z reversal. *(Precedent for the shape: the auth "stateless server → stateless
  **trading path**" narrowing.)*
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
- **`[dark-pool-context-only]`** (promoted 2026-08-11, 2 binding — mechanical tally at
  `distance-to-level-tiles` GATE S; prose already long-standing) — dark-pool / off-exchange is
  **context only, capped, toggleable**; never a directional "smart money" signal (prints include
  internalized retail and have no reliable side). Small capped confluence bonus only; omitted from
  bundle AND score when `dark_pool=false`. **Block prints** (`blocks[]`) are **display-only** — they
  do not feed `opportunity_score` or `dark_pool_confluence`. Green/red stay reserved for signed
  direction; a no-side off-exchange proximity chip must not render as success green. The whole
  off-exchange computation is **best-effort + isolated** — any failure yields `off_exchange = None`
  (object omitted, not an HTTP error), leaving `market_state`/`strike_profile` and the SSE path
  untouched. *(dark-pool-stream-isolation; redesign-stage-3 latent green-on-no-side fix.)*
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
- **`[dark-pool-context-only]`** (promoted 2026-08-11, 2 binding) — off-exchange is **context only**
  (capped, toggleable, never directional smart-money); block prints display-only/unscored; no-side
  chips must not render success green. *(dark-pool-stream-isolation; redesign-stage-3.)*
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
- **`[production-fails-closed]`** (promoted 2026-08-22, 2 binding) — a production process proves every
  required durable and configuration prerequisite **before** workers or a network listener start.
  Missing, stale, divergent, unavailable, or unverifiable state is a startup refusal, never a silent
  development fallback. Production runtime configuration and schema readiness are explicit typed
  boundaries; release migrations run in a separate serialized command, while normal serve remains
  read-only. *(production-runtime-guardrails; postgres-release-safety.)*
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
- **`[absent-is-not-none]`** (promoted 2026-07-28, 3 binding) — a surface that can be **uncurated,
  unattempted or inapplicable** must distinguish **"we do not know"** from **"we checked and there is
  nothing"**, and must carry that distinction **all the way to the consumer** rather than collapsing it at
  a boundary. Enforce it in the **type or the closed vocabulary**, not in prose: a caller must not be able
  to treat unknown as empty without handling it. The failure this prevents is a **fabricated claim** — the
  app asserting "no earnings scheduled" for a ticker nobody ever checked, or "not applicable" about a fact
  that *is* applicable and simply was never recorded. *(bundle-events — the loader's `None` vs `[]` plus
  the closed `state` enum as the sole disambiguator, since both states carry an empty list;
  expiration-events — carried one level down, an empty `expirations` array under `state: unknown` must
  never read as "no expiry is affected"; positions-legs — carried into the **client render**, where **four**
  distinct not-a-number literals are each independently assertable: `—` not applicable · `unavailable`
  failed this cycle · `not recorded` the saved record never held this fact · `no basis` the denominator is
  about zero while the dollar figure beside it renders fine. Never `undefined`/`null`/`NaN`, which are
  indistinguishable from an interpolation bug in a screenshot. 3 binding.)*
- **`[structural-over-prose-enforcement]`** (promoted 2026-08-06, 3 features — **held back three times
  until it earned a statable violation test, which `broker-option-grouping` supplied**) — an invariant a
  feature must hold is enforced by **construction** — a type, a module boundary, an empty diff, a
  mutation-tested source scan, a build-breaking lint rule — rather than by **prose an implementer must
  remember**. Where both are available, prefer the shape that makes the violation **impossible or
  build-breaking**. **The bar this key waited for, now statable in one sentence: *poison the thing the rule
  forbids, and the build must go red* — and the poison test itself must be proven non-vacuous, so a guard
  that cannot demonstrate it bites is not enforcement.** The reason prose is insufficient is not
  forgetfulness: in `broker-option-grouping`, `structure.ts:153` returns `custom` **only** because
  strike/expiry/right are null on today's feed, so the day a vendor starts supplying them the forbidden
  structure name would have appeared **by itself, with nobody deciding it**. No amount of remembering
  catches that; a render regression run against a simulated future feed does.
  *(outcome-ledger — empty `apps/api` diff, integers-only roll-up, type-level decline map, mutation-tested
  `?raw` scan; scanner — leaf boundary, pure-logic-with-injected-clock, pins re-pointed not deleted;
  positions-legs — max-loss eligibility as membership in a closed set rather than a detection heuristic,
  a branded `NetLimitDollars` no numeric literal can inhabit; broker-option-grouping — the three-layer
  no-naming stack: an ESLint import allow/deny-list probed live, a recursive two-arm source scan with an
  anti-vacuity assertion + an every-EXEMPT-path-still-exists assertion + four mutation guards including
  one proving arm B fires while arm A stays silent, and a render regression under a future-feed fixture.
  4 features.)*
- **`[single-motion-moment]`** (promoted 2026-08-06, 2 binding — **crossed at `redesign-stage-3`
  2026-07-22 and was missed at that GATE S; graduated here on the tally**) — the app has **ONE orchestrated
  motion moment**, and the app-wide keyframe inventory is **set-equality pinned** so a new animation family
  is **build-breaking** rather than merely discouraged. Motion that survives is either that one moment or a
  **data signal** by recorded decision — never decoration. Every motion respects a shared
  `useReducedMotion`, degrading to a static frame. *(redesign-stage-2 — the hero curve-draw became the one
  moment, dash-offset/opacity-only keyframes under a property-set pin, the generic radial blob and
  ValueCard light-bleed deleted with zero-reference proof; redesign-stage-3 — the consolidation itself,
  5 families dispositioned and the inventory set-equality pinned to {liveDotPulse, widgetLivePulse,
  ordersWatchPulse} + the hero draw + flash, with the live-browser inventory verified equal to the KEEP
  set. 2 binding.)*
- **`[ai-asserted-numbers-are-traceable]`** (promoted 2026-08-14, 2 binding — logged at **0 instances**
  2026-07-16 as deliberately aspirational, moved to 1 by `ai-rec-grounding`, graduated on the mechanical
  tally) — every number or field the in-app AI **asserts** is traceable to a computed bundle field, and
  every field it **omits** says so in a **closed vocabulary** rather than rendering a mark that means
  something else. `[best-effort-isolated-or-null]` covers the AI *failing*; this covers it **fabricating**
  and — added by the second instance — it covers it **going silent**. An untraceable figure is never
  rendered as fact. An absent one is never rendered as a **reserved literal belonging to another state**,
  and never **pre-typed into an input**: a value the read did not name must not reach a tradeable field by
  default, inference, or a chain-derived fallback. **Measured, not asserted** — 44.4% of the AI's asserted
  numbers did not trace at the first instance's ship, and the second instance's own defect was a
  guaranteed output of a shipped code path, not a rare model slip. A third instance
  (`rec-plan-scope-caption`) closed the remaining **inference** half: a reader must not be able to
  treat an unchecked plan field as checked merely because a sibling field carries a clause.
  *(ai-rec-grounding — per-figure grounding of asserted numbers; rec-absence-literals-hole — the
  absence half: six fields, one new closed-vocabulary member, and the Accept seam;
  rec-plan-scope-caption — one section-level scope caption on the pinned DecisionCard plan row.
  3 instances.)*
- **`[cited-code-is-verified-not-assumed]`** (promoted 2026-08-17, 2 binding) — a design or plan
  artifact must not assert a fact about **existing code** it will reuse unless that fact was **read
  at source**. Unverifiable claims carry a `[lane-check]` mark instead of being asserted. The
  failure this prevents is a spec that cannot compile or a plan that attaches to a file that is
  no longer the surface. *(rec-absence-literals-hole — three false citations in one council, none
  caught by the authoring voice; rec-plan-scope-caption — PLAN locked the caption as a sibling
  after the live `DecisionMetadata` row Stack after reading `DecisionCard.tsx`, refusing
  Python-era `AiRecPanel` line numbers. 2 binding.)*

## 6. Current feature state (works end-to-end)
<!-- shard: tags=features,state,observability,darkpool,ghost-trade,dex,personas,metrics -->
- **Generated API contract (`api-contract-generation`, BE + shared client, shipped 2026-08-22)** —
  the source-derived 52-operation Axum graph deterministically exports OpenAPI 3.1 and checked
  `@convexa/api` TypeScript schema/client bytes. Immutable pre-cutover and generated-artifact
  manifests reject drift/co-omission; schema-v2 evidence executes 181 response conversions and 87
  direct HTTP outcomes. Native EventSource remains the SSE lifecycle boundary. No new docs route,
  endpoint, auth, scoring, or trader-visible behavior. QA PASS 42/0/0; conformance 4/4.
- **Session body store (`chain-archive-object-store`, BE + structural FE, shipped 2026-08-20)** —
  session-archive bodies live on `SESSION_CHAIN_ARCHIVE_BODY_ROOT` (unique-per-put files); the app
  DB keeps identity + locator only. Missing object is `session book unreadable`. Ring BYTEA
  unchanged. `NO_UI_CHANGE`. QA PASS 25/0/0; independent conformance 4/4.
- **Liquid-name session ensure (`liquid-names-session-capture`, BE + structural FE, shipped 2026-08-20)** —
  off-path worker guarantees a weekday session-archive book for **SPY, QQQ, IWM** even when
  gex-cache is warm (promote same-ET ring row, else one in-flight paid fetch with ≥300s retries).
  No Massive on the trader request path. Reuses `/api/_research/session-books`. `NO_UI_CHANGE`.
  QA PASS 25/0/0; independent conformance 6/6.
- **Session chain archive (`session-chain-archive`, BE + structural FE, shipped 2026-08-20)** —
  one paid options book per symbol per ET calendar day in a sibling store the 48/14d ring prune
  **cannot delete**. Identity `(symbol, et_date)` America/New_York; first-wins; `source_as_of`
  mandatory on successful research load. List/load `/api/_research/session-books` zero Massive;
  `authorizes: nothing`. Pages trader origin 404s `_research`. `NO_UI_CHANGE`. QA PASS 27/0/0;
  independent conformance 4/4. Does **not** force-capture cache-warm SPY/QQQ/IWM (program #2).
- **Replay-outcome join (`replay-outcome-join`, BE + structural FE, shipped 2026-08-19)** — research
  command `replay-outcome-join` joins `batch-backtest` replayed scores to forward `1d`/`5d` stock-bar
  labels (`large_abs_move`, median-once). Third CLI — does **not** replace `score-lab` or
  `batch-backtest`. Zero Options calls. Report standing: **Authorizes: nothing**. Capture-time
  `display_spot` is `p0`; a `replayed` row without a positive finite spot is first-class `no_p0`,
  never a silent session-close. `NO_UI_CHANGE`. QA PASS 35/0/0; capture `_research` conformance
  re-pin 4/4.
- **Batch back-test CLI (`batch-backtest-cli`, BE + structural FE, shipped 2026-08-18)** — research
  command `batch-backtest` replays stored `ChainSnapshotStore` books through
  `compute_analytics_from_vendor` with **zero Massive calls**. Empty corpus writes **no**
  measurement artifact. A train/holdout split that cannot produce two sides with ≥1 `replayed`
  row is **refused**. Report standing block: **Authorizes: nothing** (does not change live
  score). `NO_UI_CHANGE`. QA PASS 28/0/0; capture `_research` conformance re-pin 4/4.
- **Paid-feed snapshot capture (`chain-snapshot-capture`, BE + Pages 404, shipped 2026-08-18)** —
  every successful paid Massive options book from the **scanner slow-lane** and a **ticker cold
  compute** is appended as a dated research snapshot (`ChainSnapshotStore`, not latest-wins
  `scan_bundles`). Dual retention: **14 days** and **48 per symbol**. Research list/load under
  `/api/_research/chain-snapshots` makes **zero** vendor calls; Pages trader origin **404s** that
  prefix like `/api/_metrics`. Warmer / 25s refresh is **excluded**. Score/tier/fingerprint
  unchanged. QA PASS 28/0/0; independent conformance 4/4. Unblocks P3 batch-backtest CLI.
- **AI providers (`ai-providers`, FE+BE, shipped 2026-08-18)** — Settings "AI providers" replaces the
  Anthropic-only key panel. A signed-in trader stores **one BYO ciphertext per** closed provider
  (Anthropic / OpenAI / Gemini / Grok), always sees a **named model** from a closed catalog, and
  Settings + Ask-AI share one standing preference. Free-uses / `shared_admin` / silent env-key
  fallthrough are **deleted**. Preferred Grok **subscription** OAuth (`grok_subscription` = the
  trader's own SuperGrok / Grok plan, never a Convexa-billed pool) ships **present-but-unavailable**
  (no fake Connect; start → 409) until xAI user-OAuth docs verify (AC-9/10/14/15 open/blocked-on).
  Score/tier/`state_fingerprint` byte-identical. QA PASS 26/0/4; independent conformance 5/5.
  New watch-list key `user-subscription-not-operator-pool`.
- **Index-first defaults (`index-first-defaults`, FE-only, shipped 2026-08-01)** — the edge-first
  roadmap's first feature (`docs/ROADMAP_2026-08.md`): bare `/ticker` falls back to **SPY** via a
  pref-wins `DefaultTickerRedirect` (a stored `default_ticker` ALWAYS wins; auth fault ⇒ anonymous,
  never a hang; deep links unaffected); the scanner zero-state leads with an **"Indexes & megacaps"**
  group (closed lookup `INDEX_MEGACAP_SYMBOLS` — a hand-mirrored copy of `universe.json`'s ETF+megacap
  lines, see OPEN_THREADS §7y seams; saved views render as saved); non-universe tickers show a
  one-line muted single-name honesty caption whose rule honors `[absent-is-not-none]` (universe
  unknown/failed/empty ⇒ NO caption). `NO_BACKEND_CHANGE`; QA PASS 6/6; suite 1104/99.
- **Real brokerage positions, READ-ONLY (`broker-connect`, FE+BE, shipped 2026-08-05)** — the owner
  pivot's Track B. `src/broker/` is a one-way leaf behind a `PositionsProvider` port
  (`POSITIONS_PROVIDER`: `webull` default · `stub` · `snaptrade` reserved) with **no write method —
  nonexistent, not disabled** — and **no order/trade SDK module on disk at all**: the structural
  form of `[no-real-order-path]`, whose narrowing (read positions OK, execution never) this feature
  formalizes. Five endpoints: `GET/PUT/DELETE /api/broker/credential` (byo-ai-key pattern — Fernet,
  ciphertext-only, masked last-4, **per-user, never an env var**) + `GET /api/broker/book` +
  `POST /api/broker/book/refresh` (force-fetch, server-throttled on ATTEMPTS not successes). The
  `BrokerBook` envelope makes honesty typed: closed `state: ok|empty|unknown` as the SOLE
  disambiguator, `as_of`/`basis`/`stale_after_seconds`, and `last_attempt_at`/`last_attempt_outcome`
  over one shared six-value failure vocabulary — **stale and degraded are independent derived
  predicates**, never wire booleans. v1 is **on-demand + TTL cache, no poller, nothing on SSE**; the
  trader-visible tab reads **"Broker"**, never "Live". **Webull supplies NO option contract detail**
  (no strike/expiry/right/multiplier; `symbol` is the bare underlying), so an option is an honest
  single-leg `partial` position naming what is missing — never a guessed structure — per
  INTERFACE_CONTRACT **Amendment 1** (presence-rules only); the ×100 multiplier is **reconstructed
  from Webull's own `total_cost` under four guards**, else withheld. P/L is **Convexa-modeled,
  live, dual-basis-labeled** (owner ruling); Webull's own figure is carried verbatim but **not
  rendered** — it is ~100× wrong for options (it nets a ×100 cost against a non-×100 market value).
  Score/tier/`state_fingerprint` byte-identical with and without a broker connected. system-6
  security review fired and closed here. QA PASS after one GATE Z cycle; owner live-verified.
- **Broker option legs grouped by underlying (`broker-option-grouping`, FE-only, shipped 2026-08-06)** —
  a ticker's broker option legs collapse into ONE expandable row carrying a **leg count** and a **netted
  entry cost** (`Σ member.net_entry_cost`); expanding reveals the per-leg rows **unchanged**. A ticker with
  one option leg stays a plain row reading `1 option leg · as Webull reports it`; **equities never group**.
  **The group is NEVER named a structure** — not "vertical", not "spread", **not even `Custom`** — because
  grouping by underlying is a fact the feed supports while naming the shape is a guess it does not. This is
  enforced **structurally, not by prose**: an import allow/deny-list keeping the grouping module clear of
  `positions/*` (all four entry points to the naming machine take a `SimPosition`, so banning the
  constructor closes all four), a recursive two-arm mutation-guarded source scan, and a **render regression
  under a simulated future feed** — the layer that fails on the day a vendor starts supplying contract
  detail and `structure.ts:153`'s `custom` fallback stops firing. Withheld figures use the **one shared
  permanence-first cascade** at both group and leg level, so a group's literal is always **derived from its
  members', never chosen beside them** — the GATE Q catch that made this explicit. The netted cost carries
  its basis label and a provenance clause **gated on a derived boolean**, never hardcoded prose. Also
  repaired here as an owner-ruled in-scope defect: the mobile card previously **omitted** the modeled-P/L
  slot for an `unrecognized` entry while desktop rendered a withheld literal. Score/tier/`state_fingerprint`
  untouched — empty `apps/api` diff. Graduated `[structural-over-prose-enforcement]` (§5).
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
- **Event calendar on the bundle (`bundle-events`, BE-only, shipped 2026-07-27)** — an owner-curated
  **event calendar** rides the bundle as an additive, always-present, nullable
  **`market_state.event_calendar`**, so the downstream AI can see whether a scheduled event sits inside
  the horizon it is reasoning about (previously it had to web-search for it). Data is a **checked-in JSON**
  (`apps/api/src/scanner/config/events.json`, loader `src/scanner/events.py`) in the same shape and
  operational story as `universe.json` — edit + restart, no hot-reload. **It is config rather than a vendor
  call by necessity:** Massive's earnings feed (`list_benzinga_earnings`) is a **separate add-on this plan
  is not entitled to** (probed 2026-07-27; `list_dividends` IS in-tier), and scheduled macro events are not
  a Massive product at all — so curation both fills the gap and decouples the calendar from the vendor.
  Populated for the 69-ticker scanner universe: **18 ETFs verified no-earnings · 35 company-IR-confirmed ·
  12 cadence-projected · 4 deliberately uncurated** (TSLA/MU/CSCO/UNH — sources disagreed by up to 18 days,
  and a wrong earnings date is worse than a missing one).
  **The load-bearing rule is `absent-is-not-none`, carried from the loader onto the wire:** a closed
  `state` enum — **`unknown`** (never curated) · **`none`** (checked, nothing scheduled *within
  `covers`*) · **`scheduled`**. `unknown` and `none` BOTH carry `events: []`, so **`state` is the only
  disambiguator** and is authoritative (the FE/AI renders it via closed lookup, never re-deriving from
  `events.length`). An uncurated ticker must never read as "no earnings scheduled". The block is
  self-describing (`calendar_as_of`/`horizon_end`/`covers`/`expired`), **an expired horizon forces
  `unknown`** (a stale calendar cannot support a claim), events are **upcoming-only** with `days_until`,
  and each carries `confirmed` + `source` + `note` so a projection is visibly not a company announcement
  and a recorded source disagreement survives to the wire. A missing/corrupt config ⇒ `event_calendar:
  null` with the bundle still 200. **STATIC — the SSE payload gains no field.** Attached AFTER
  `generate_signals`; score/tier/`state_fingerprint` **byte-identical** (QA proved it three ways incl. a
  live A/B: NVDA 79/prime/`984e75f48e50` with and without). QA PASS 11/11 (de-correlated Sonnet).
  Realizes the wire half of BACKLOG §C `tradeable-rec-inputs` item 4 and unblocks item 15. See
  OPEN_THREADS §7w.
  **Extended same-day by `expiration-events` (BE-only, shipped 2026-07-27)** with
  **`event_calendar.expirations[]`** — one entry per tenor on the bundle's existing full-chain curve
  (`{expiration, dte, contains_event, event_count, event_types[], first_event_date}`, ascending by DTE),
  answering the question that actually changes a trade: **does the option I am considering live through
  the event?** An Aug 21 and a Sep 18 contract on the same ticker are different instruments when earnings
  land Aug 26. **Containment rule (stated exactly, because the edge case is a real trap):**
  `serving_day <= event.date <= expiration`, **EXCEPT an `amc` event ON the expiration date, which is NOT
  contained** — the contract dies at the close, hours before an after-close report; while an event with
  **`session: null` on the expiration date IS contained** (an unknown session must not be silently assumed
  to land after the close — flag conservatively). Per-entry payload is a **summary**, never a repeat of the
  event objects. **`state` still governs:** `expirations` is `[]` for BOTH `none` and `unknown`, so it
  cannot self-disambiguate — an empty list under `unknown` means *we don't know*, never *no expiry is
  affected* (`absent-is-not-none`, one level down). No usable tenor curve ⇒ `[]` + 200. Derived from the
  computed bundle **after scoring** — `engine.py` untouched, `compute_term_structure` provably unmodified
  (the obvious implementation, decorating the curve at source, would have been an engine edit). QA PASS
  11/11; byte-identity independently re-proved by QA via a git worktree at the pre-change commit.
- **Scanner — the multi-ticker surface (`scanner`, FE+BE, shipped 2026-07-26)** — replaces the `/scanner`
  stub with the product's **breadth** surface: one dense honest table answering *"which ticker deserves the
  deep-dive now?"* over an **owner-curated tracked universe** (50–100), swept **with all tabs closed**.
  **Approach C, delivered in 4 sequenced phases, each with its own execution contract + GATE Q.**
  **P1 `apps/api/src/scanstore/`** — a persistent one-way-leaf store (structural sibling of `marketdata/`):
  `ScanRow` (latest-wins, one CURRENT row per symbol — the deliberate divergence from iv-rank's
  insert-if-absent) + `SweepHeartbeat` + a bundle-blob, behind one port with an on-disk **SQLite default**
  and a **parity-reviewed Postgres** drop-in (`SCAN_STORE`, default `disk`).
  **P2 the sweep worker** — a **2nd process** off the same image (`worker.py`, nx `serve-worker`, plus a
  default-OFF `SCANNER_EMBEDDED` one-terminal dev seam). A **two-speed loop**: a fast multi-ticker snapshot
  poll (~30s → prices + move detection, via the **net-new `fetch_stock_snapshots`** method added to the
  `MarketDataProvider` port + Massive adapter) and a concurrency-bounded slow sweep through the
  **UNCHANGED `compute_ticker`**, projecting one `ScanRow` per ticker. **Move-triggered promotion is capped
  with round-robin fairness** (pure logic + injected clock — a market-wide move degrades to base cadence,
  never a herd). Defaults (operator-tunable): move X **0.75%** · fast **~30s** · full pass **~2–3 min at
  N=100**.
  **P3 the read API** — `GET /api/scan` · `/api/scan/universe` · `GET+PUT /api/scan/view`, all reads
  **anonymous-open + best-effort 200 (never a 5xx for scan trouble)**; the **PUT is server-gated** (real
  401/403, 422 off-universe) with the per-account view stored as a field on the existing settings record.
  Plus the **ticker warm-click read-through**: a tracked symbol's Ticker page is served from the worker's
  freshness-gated bundle-blob before the vendor (the `chain_store` pre-warm precedent extended across the
  process boundary) — measured **0.0016s warm vs ~9.5s cold**, byte-identical either way.
  **P4 the `/scanner` page** — the dense terminal table (11 columns, score-desc, compact, sticky
  symbol+header), a universe-constrained **view editor** whose save awaits the server gate, the **four
  honest states** (skeleton / empty / worker-down banner over intact last-known rows / per-row
  `ok`·`stale`·`error`·`building`) rendered via **closed lookup**, and a `<sm` card collapse joining the
  **393px no-overflow e2e set**.
  **Honesty is structural:** rows are **poll-based, never "live"** (the word is absolutely forbidden on the
  table — the design authority was amended at P4 when it contradicted its own rule); each row carries its
  own `as_of` + status; a synthesized `building` row's non-null `as_of` is **not** a freshness claim (the FE
  branches on status first); a stale row keeps its **frozen** price with its stamp; **green/red is reserved
  for price direction only**. **The scanner CONSUMES score/tier and can never feed them** — enforced by the
  leaf-import boundary, an empty `apps/api` diff in P4, and a live proof that a served bundle is
  byte-identical worker-absent vs worker-present (SPY `59`/`actionable`/`4df5c37bd833`). **v1 has NO AI**
  (AI-seeded views + batch recs are v2), no alerts, no universe admin UI, no SSE, no order path.
  **Formally narrowed the locked "single-ticker, on-demand" decision** (§5). QA PASS all four phases
  (de-correlated Sonnet) — **13/13 ACs, 0 FAIL, 0 UNVERIFIABLE**; `nx test @convexa/dashboard` 645; e2e 15/15;
  conformance 2/2 live via the standalone `.spire/clusters/tech/state/conformance/scanner.json`. See OPEN_THREADS §7v.
- **Outcome ledger — the track record (`outcome-ledger`, FE-only, shipped 2026-07-16)** — the project's
  **first loop for TRADING wisdom** (it already had `DECISION_LEDGER.md` for BUILD wisdom). Harvests the
  append-only `DecisionRecord[]` the app already writes and answers, honestly: **is the `opportunity_score`
  any good?** Hit rate + mean per-trade return + dispersion by **tier · AI-rec · setup · IV-rank band ·
  persona**, on `/positions` as its own in-page view (a **TRADER** surface — explicitly not `/_ops/metrics`),
  anonymous + ungated. `features/trading/outcomes/` (`ledger.ts` · `sources.ts` · `archive.ts` · `copy.ts` ·
  `TrackRecordSection` · `ArchiveBlock`); `personaLabel` is **injected as a prop** (the leaf may not import
  `features/personas`). Capture = an **additive optional** `entry_context` digest on `DecisionRecord`
  written by the **existing** recorders (`captureDigest.ts` — best-effort, cannot throw, no fetch); **no
  `SCHEMA_VERSION` bump, no backfill — digest presence IS the epoch marker** (absent = pre-capture;
  present-with-null = unavailable that cycle), so "by tier" works on **existing** data while
  score/setup/persona accumulate from ship (the iv-rank "building history" shape).
  **`NO_BACKEND_CHANGE` — and the empty `apps/api` diff IS the structural no-auto-tuning guarantee** (a
  statistic that never leaves the browser cannot reach `signals.py`). Four boundaries: zero backend surface ·
  one-way leaf (mutation-proven `?raw` source-scan) · **zero write functions** · off the AI prompt in v1.
  It **ENABLES** `[score-change-is-deliberate-and-measured]` and is structurally incapable of exercising it.
  **Honesty is the product:** `N_min = 20` + a **Wilson 95%** interval on every rate; cells never pooled;
  **all-time non-rolling** window (a selector would let the trader shop for the flattering window — the
  exact failure this feature exists to fix); `building` shows a count and **nothing numeric** (a 3-for-3
  cell must never render "100%"; **no meter**); a rate **never** appears without its mean return +
  dispersion; **no dollar figures, no semantic tint, Ns never summed, no include/exclude toggle**;
  **DecisionRecord is the spine** (no record ⇒ not an outcome), **closed-only**, **only `quoted` fills
  count**; nothing excluded silently (`M == counted + Σ excluded_by_reason`, deterministic precedence,
  M spanning **both** position stores de-duped). **A roll is a close, not a category:** the rolled-OUT leg
  counts plain (no marker); the rolled-INTO leg is excluded under the no-entry-record reason; **no roll
  count in either direction** — the basis rides `TR_HIT_DEF`, the one string permitted to name a roll.
  Score/tier/`state_fingerprint` untouched. QA PASS (Sonnet, de-correlated — 46/46 ACs, 0 FAIL, 0
  UNVERIFIABLE; `nx test dashboard` 804/804). Conformance **n/a and correctly absent** (consumes no
  endpoint ⇒ no FE↔BE surface). See OPEN_THREADS §7t.
- **Positions portfolio (sim, FE-only)** — evolves the ghost-trade tracker from a single open position
  into a multi-position **portfolio** (`features/trading/positions/`, route shell `pages/positions/`). A central all-positions view
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
  **⚠ SUPERSEDED IN PART by `positions-legs` (2026-07-28) — read the next entry.** The single-contract
  `Position`, the two-member `Strategy`, the split `GhostTrade`/`Position` stores and the
  `strategy`/`expiry` group axes described above no longer exist.
- **Multi-leg positions — one book (`positions-legs`, FE-only, shipped 2026-07-28)** — the model rebuild
  that makes a **spread a first-class thing the app understands**, sequenced deliberately **ahead** of the
  broker importer so the importer is never built against a model that cannot represent what it imports.
  **A position is `Leg[]`.** `GhostTrade` and `Position` merge into ONE `SimPosition`; the two
  `appendDecision` definitions collapse to one (resolves DECISION_QUEUE **Q2**); the ×100 multiplier moves
  **onto the leg**, so equity legs finally work (it was hardcoded, making 100 shares wrong by 100×).
  **`Strategy` → `StructureKind`, DERIVED from leg shape and NEVER STORED** — 22 members, produced by a
  **total exact-match recogniser with no confidence measure, which must never acquire one**: any leg set
  that is not an exact match renders `Custom`, *the residue of an exact match, never a judgement*. The
  recogniser **never reads `entry_price`** (debit/credit comes from strike geometry), so a mistyped price
  cannot flip a label. `cash_secured_put` is deliberately **not** a member — its legs are identical to a
  naked short put, and the adopted rule is *"if the thing that makes a name true is a **leg** it can be
  named; a fact about the **account** cannot."*
  **Durable:** ONE union migration `convexa.positions.v2` + `.ghost-trade.v1` → **`convexa.positions.v3`**,
  executed **once** (a repeat resurrects deleted records), **aborting entirely** if any source is
  unreadable rather than freezing a partial history behind a key claiming completeness, counting **distinct
  ids** (collisions between the two stores are the *expected* case), counting a **logical** source once
  even though `resolveDurable` leaves the same bytes under both brand keys, and carrying
  `provenance{migrated_at,source_counts,merge_notice_dismissed}` in the single promote-write — where
  **corrupt or absent provenance must NEVER re-arm the migration.** The v1 writer died in the same release.
  **Max loss** ships for a **closed 15-member eligible set** — eligibility is *membership in a closed set,
  not a detection heuristic*, so an under-detected unbounded shape is ineligible **by construction**;
  everything else renders one of exactly three stated reasons (`unlimited risk` · `mixed expiries` ·
  `unnamed shape`) and carries its at-expiration assumption. Rendered in the card footer always, and in a
  `max_loss` table column **at `lg` and above only**.
  **`store-faulted` is a first-class product state:** a persistent non-dismissible banner (**NOTHING was
  deleted** · new positions will not be saved until resolved · Export), fault determined **synchronously at
  store init**, scoped to the **store not the route** (the Ticker page opens the same dialog), and refusals
  that are `aria-disabled` **and still focusable** **and visibly quiet** — never the HTML `disabled`
  attribute, which swallows pointer events and makes the reason unreachable. Faulted dims **no data**.
  `position_eval` is **suppressed** for a multi-leg position *and* for a ticker holding **more than one**
  open position — the app does not evaluate a subject it cannot faithfully represent — while the `pos_*`
  request stays unconditional and byte-identical (suppression is a **render** decision at both levels).
  **Two live data-loss defects were repaired here:** `positions/store.ts` had **no fault latch** (an
  unparseable blob was destroyed by the next write), and `liftLegacyRecord` was **not idempotent**, so
  re-importing your own v2 archive replaced every position's `opened_time` with the pending sentinel.
  `NO_BACKEND_CHANGE` — `apps/api` diff empty; positions remain **never an input** to
  `signals`/score/tier/`state_fingerprint`; `SIMULATED` everywhere, Live tab still a zero-import
  placeholder. Multi-leg **orders** are deliberately OUT (a resting composite limit inherits the
  every-leg-live rule — a second feature), and the durable `limit_price` stays **per-unit and
  single-leg-only**, with `netLimitDollarsFor` returning `null` for multi-leg so nothing fills off a number
  whose meaning is undefined. Graduated **`[absent-is-not-none]`** (§5). *(QA_REPORT PASS 83/83,
  de-correlated model, after one GATE Z bounce.)*
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
  (`gammaflow.ts`→`convexa.ts`, consumed via `@convexa/api` so zero export churn), backend logger/FastAPI
  title/ContextVar, docs/README/CLAUDE.md, `project.json` `project_name`, and the GitHub repo
  (`gammaflow`→`convexa`). The 4 **durable localStorage keys** were migrated `gammaflow.*`→`convexa.*`
  **loss-free** via a reusable `resolveDurable(new,old)` migrate-on-read helper (read-new-else-old,
  promote-forward, never-delete, idempotent, never-throw) composing with the existing positions v1→v2
  chain. **STAYS unrenamed (non-goals):** the `@org/*` package scope, `DATA_DIR`, the local working folder,
  and archived-contract/ledger history (provenance). Reverses the app-shell-landing "UI-only" decision.
  Cosmetic to the engine — score/tier/`state_fingerprint` byte-identical, conformance unchanged. QA PASS
  (Sonnet, de-correlated — 23/23 ACs, dashboard 283/283 + `@convexa/api` 7/7). *(2026-06-28.)*
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
  246/246 + `@convexa/api` 7/7). *(2026-06-25.)*
- **Hybrid bring-your-own AI key (`byo-ai-key`, FE+BE)** — **NARROWED 2026-08-18 by `ai-providers`:**
  admin/shared free-uses and the Anthropic-only slot are gone; current powering is the multi-provider
  panel + named model (see the `ai-providers` bullet). Original ship: per-user Anthropic keys for the in-app AI rec.
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
  fixed → re-run 26/26; security floor + byte-identity clean; dashboard 313/313 + `@convexa/api` 13/13).
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
- **Convexa redesign (FE-only, shipped 2026-06-30 → `main`)** — a full presentation re-skin to the Figma
  dark-fintech DS across every surface (Landing · shell/nav · Settings/Auth modal · Scanner · Positions ·
  Ticker viewer + its `ticker/sections/*` split (**since restructured → `pages/ticker/widgets/`**, folder-
  per-widget) + vertical-diverging GEX chart · AI-rec panel ·
  `StateExportDrawer` · `TradeEntryDialog` with a Manual/Market/Limit fill mode), a `theme.ts`/`tokens.ts`
  token bridge, and an app-wide contained-button treatment (deep `#1d6fe0`+white on filled primary; the
  `#4f9cff` accent unchanged). `NO_BACKEND_CHANGE` — score/tier/`state_fingerprint` byte-identical; QA PASS
  (nx test 425/425, `nx build` green). The full-page `/auth` route was owner-dropped (modal stays). See
  OPEN_THREADS §7l.
- **Recent ticker chips (`recent-ticker-chips`, FE-only, shipped 2026-08-11)** — Command Deck **QUICK**
  row under Ticker / Expirations / Persona: closed pins **SPY · QQQ · NVDA** + durable client-local
  recents (`convexa.recent-tickers.v1`, ≤8 MRU); click navigates `/ticker/{SYMBOL}`; current route
  symbol selected (theme tokens only). Empty/corrupt recents still show pins (`[absent-is-not-none]`).
  Sticky bar / TopNav / widgets / API untouched. **`NO_BACKEND_CHANGE`**. GATE Q PASS 8/8 (30 feature
  tests). Contract archived at `.spire/clusters/tech/contracts/_archive/recent-ticker-chips/`.
- **Distance-to-level tiles (`distance-to-level-tiles`, FE-only, shipped 2026-08-11 `74df555`)** —
  Call wall / Put wall / Max pain / Gamma flip `StatTile`s show a secondary caption: signed $ gap · % ·
  above/below (or `at spot`) from `gex_spot`/`price`. Pure client projection (`distanceToLevel` +
  `levelSpot`); omitted when spot cannot be anchored (`[absent-is-not-none]`); theme `text.secondary` +
  mono only — no success/error tint (`[theme-token-discipline]`). **`NO_BACKEND_CHANGE`** — empty
  `apps/api` diff; score/tier/`state_fingerprint` untouched. GATE Q PASS 5/5 (feature-scoped 22/22).
  Contract archived at `.spire/clusters/tech/contracts/_archive/distance-to-level-tiles/`.
- **Ticker UX-polish program (FE-only, shipped 2026-07-01 → `main`)** — three stacked GATE-V passes on the
  Ticker page, plus one post-merge ai-rec commit, all now on `main`. **`ticker-microinteractions`:** tasteful
  live motion — value flash-on-tick (LiveTape + header, gated `isLive && !streamOffline`), pulsing live dot,
  StatTile hover-lift, GEX mount-only bar-grow, and the **one-time staggered section reveal** (shared
  `useReducedMotion`/`useFlashOnChange` hooks). **`ticker-widgets`:** the shared `<Widget>` shell +
  `WidgetSelectionContext` wraps all 8 data sections into a bento board (feature-detected container queries /
  `:has()` / `color-mix()` / View-Transition expand-peek, all reduced-motion-guarded + token-only); the
  grip/⋮/add controls are **affordance-only coming-soon** (only expand is functional) — the declared seam for
  future real widget functionality (drag/resize/add/persist). **`ticker-command-deck`:** `CommandDeck.tsx`
  unifies the toolbar + header + freshness line into one chrome deck with a scroll-condensed sticky bar.
  **`c93dddc` (ai-rec, FE + additive BE):** the AI-rec panel now renders a structured read (verdict hero +
  bundle-sourced "levels in play" + Why bullets + re-engage list) off additive `summary`/`key_points`/
  `reengage_when` LLM-schema fields; an availability fix so a BYO-key user on a keyless deployment isn't
  blocked; the `anthropic` SDK added to requirements; and a **gated dev demo-account seed** (`SEED_TEST_ACCOUNT`,
  default off, **refuses postgres**, `demo_seed` advertised in who-am-i for login pre-fill — null in prod).
  `NO_BACKEND_CHANGE` for the ticker stack; `c93dddc`'s backend delta never touches scoring — score/tier/
  `state_fingerprint` byte-identical, conformance 11/11. **Catch-up QA PASS** (fresh de-correlated Sonnet;
  one §3 stagger regression caught + fixed → GATE Q re-run 16/16, nx test 486/486, commit `11e8ec3`). See
  OPEN_THREADS §7m.
- **AI-rec backtest orders (`ai-rec-backtest-orders`, FE+BE, additive, shipped 2026-07-02 `5391517`)** —
  two halves. **(a) Scripted scenario harness** behind the ai-rec `LLMProvider` seam: new
  `src/core/ai_scenarios.py` (`ScenarioLLMProvider` + a 9-entry registry — 7 producing shapes incl.
  conditional-entry / prose-trigger / already-met / `no_trade`, + 2 fault entries riding the REAL degraded
  path), env **`AI_REC_SCENARIOS_ENABLED`** (default OFF — OFF ⇒ byte-identical shipped behavior +
  `scenario_unavailable` refusal; catalog never enumerable while off). Purely-additive wire delta on the 2
  existing rec endpoints: request `scenario_id?`, response `scenario{id,name}|null` (the ONLY scripted
  marker), always-present `RecStatus.scenarios{enabled,catalog}`. Scenario runs are **keyless** (key
  resolution skipped server-side, incl. on keyless deployments) and **meter-bypassing** (cooldown / daily
  cap / admin allowance neither checked nor consumed), while **auth stays outermost** and the real
  `ai_eval` readiness gate + override behave identically; deterministic per (scenario_id, context).
  **(b) Simulated orders (FE-local state — NO order endpoints, orders never ride the wire):**
  `features/trading/orders/` (was `app/orders/`) — durable **`convexa.orders.v1`** store
  (waiting→triggered→filled/cancelled/expired + mandatory good-til), a PURE live-cross trigger engine (v1
  trigger = `underlying_above|below` on the live NBBO mid ONLY — `last_trade` structurally excluded; fills
  via the shipped mark ladder accepted only live; no retro-fill; clock expiry the only off-stream
  transition; idempotent forward-only transitions), the Orders widget (Ticker bento, after AI-rec) +
  OrdersPanel (Positions, Open/History + local JSON export), and **"Act as sim order"** on a produced trade
  rec via an additive ORDER VARIANT of the shared `trading/TradeEntryDialog` (server sim-trade gate before
  any local write; SIMULATED end-to-end). Full rec→order→position provenance (fingerprint / persona /
  scenario id+name / verbatim trigger words) + append-only decision records; a fill creates exactly ONE
  Position (`origin_order_id` backlink, `trigger_fill` entry basis, two-way navigation). Score / tier /
  `state_fingerprint` byte-identical (flag ON==OFF, scenario-vs-not). QA PASS (Sonnet, de-correlated —
  48/48 ACs; conformance new standalone spec + 5-spec sweep; +103 tests → dashboard 595/595). Post-QA
  render catch fixed inline + guarded by a named test: a scenario run is NOT blocked by
  keyless-deployment availability. Backtest v1 = FORWARD-test (recorded-replay is a named deferred seam).
- **Sim-entry unification (`sim-entry-unification`, FE-only refactor, shipped 2026-07-01 `d704193`)** —
  ONE shared `TradeEntryDialog` on both pages (Ticker + Positions) — created at `app/trading/`, now
  `features/trading/TradeEntryDialog.tsx`; the old
  `ghost-trade/TradeEntryDialog`, `positions/PositionEntryDialog`, and `GhostTradePanel` deleted with
  zero-importer proof; `app/README.md` directory map added. Origin of the promoted
  `[single-shared-sim-entry-dialog]` invariant.
- **Projected dealer flow (`dealer-flow-projection`, FE+BE, additive, shipped 2026-07-02 `ca6abae`)** — a
  forward-looking **dealer-hedging-flow projection** built over the ALREADY-computed, window-scoped net
  charm + net vanna (previously display-only). New additive nested nullable field
  `market_state.dealer_flow_projection`: a **charm limb** (`projected_delta = net_charm · horizon_days`
  linear/first-order; `per_day_base`; `horizon_days` = calendar days to the next monthly OPEX, clamped
  ≥1; `opex_date`) and a **vanna limb** (`projected_delta` at a base +1 IV-pt move plus the pre-scaled
  `illustrative_projected_delta` at +5 IV-pt; `reference_direction="increase"`, a decrease being the
  negation) plus `spot_basis`. The two limbs are **independently nullable**; the object is null only when
  both are unavailable or the compute raised. **STATIC** (computed at `synchronized_spot`/`gex_spot`, never
  live, never on SSE — excluded from the live-offline treatment like the four positioning tiles) and
  **advisory CONTEXT only** — it rides the AI state export (`serialize_context` forwards `market_state`
  wholesale, no serializer change) + a new static-family ticker widget after `DealerPositioning`, and is
  **never a scoring input** (score/tier/`state_fingerprint` byte-identical — `signals` reads none of it).
  Folded in the higher-order-greek **determinism fix** (`math.fsum` over charm/vanna/volga, scoped away
  from every scoring sum; byte-identity re-proven before/after). Surfaced with its assumptions visible
  ("dealer-flow context — not a price forecast, not a scored signal, not a guarantee"). QA PASS (Sonnet,
  de-correlated — 17/17 ACs, conformance new spec + 5-spec sweep, `nx test dashboard` 617/617). One
  post-QA render-pass catch fixed inline (a container-query written as a responsive-value key → the
  `auto-fit`/`minmax` idiom). First feature of the "enrich the downstream-AI's inputs" GATE I. `net_volga`
  NOT elevated; `gamma-sourcing-split` untouched.
- **AI context pack — "Market context" (`ai-context-pack`, FE+BE, additive, shipped 2026-07-06)** — a
  bundle of four derived reads, all from data already fetched (no new vendor dependency), surfaced as the
  additive nested nullable `market_state.market_context` — **AI-context** (rides the AI state export via the
  unchanged wholesale `serialize_context` forward) + a Ticker **"Market context"** widget, **never a scoring
  input**. New one-way leaf `src/core/context_pack.py` (`signals`/`engine`/`live`/`darkpool` do NOT import
  it), attached in `main.py` **after** `generate_signals` returns (the fields don't exist at scoring time —
  the structural byte-identity guarantee). Four **independently-nullable STATIC** children: **`trend_momentum`**
  (digested regime **labels**, not raw values — direction `uptrend|downtrend|mixed` off close-vs-EMA20-vs-EMA50,
  strength `weak|moderate|strong` off Wilder ADX-14, momentum 5-state off Wilder RSI-14; each label carries its
  window+thresholds), **`gex_profile_shape`** (normalized-HHI concentration + above/below `balance` +
  center-of-mass distance over the window-scoped net-GEX profile — **reads** the already-computed profile;
  `gamma-sourcing-split` untouched), **`flow_vs_positioning`** (locational `distribution_shift` + compositional
  `tilt_ratio` — today's **UNSIGNED** cumulative option volume vs standing OI; basis pinned in-payload, **never**
  the SSE net flow, no aggressor-side claim), **`atr`** (5/14/30-bar simple-mean true range for stop/target
  sizing CONTEXT). The daily-bars fetch was extended **60→400 calendar days** (same single provider call, no new
  env) + additive `UnderlyingBar` `high`/`low`/`session`; HV provably unaffected (fixed 31-close tail).
  `signals.py` **0 diff**; score/tier/`state_fingerprint` byte-identical (SPY 87 / prime / `bb82718bcf1e`) with/
  without/forced-fault AND before/after the fetch extension. **FE:** ONE bento `MarketContext` widget (four
  sub-cards, all headline labels visible without expanding) after `DealerFlowProjection`; the wire enum is
  authoritative (1:1 display map, never FE-re-derived); five distinct null levels each its own muted "unavailable
  this cycle"; STATIC-family (un-dimmed on an SSE drop); token-only; no auth gate (anonymous includes the pack).
  Every read is **self-describing** (`model-read-carries-its-assumptions`) and advisory ("not a forecast, not a
  scored signal, not a guarantee"). QA PASS (Sonnet, de-correlated — 26/26 ACs, conformance new spec +
  8-spec sweep, `nx test dashboard` 658/658). Second feature of the "enrich the downstream-AI's inputs" GATE I
  (bundled the AI context-scalars pack + the TI regime bundle). *(2026-07-06.)*
- **IV Rank / IV Percentile (`iv-rank`, FE+BE, additive, shipped 2026-07-07)** — where a ticker's *current*
  IV sits within its *own recent history* → is option premium **rich or cheap** (strategy selection: sell vs
  buy premium). THE options metric the app lacked. Surfaced as the additive nested nullable
  `market_state.iv_rank` (AI-context via the unchanged wholesale `serialize_context` forward + a Ticker
  static-family widget after `MarketContext`), **never a scoring input**. **The crux:** the vendor provides
  **no historical IV**, so the feature **accumulates its own** — the project's **first persistent market-data
  store**: a new one-way leaf `apps/api/src/marketdata/` (port + `IvSample` record + adapters), env `IV_STORE`
  **default `disk`** (on-disk SQLite/WAL under `DATA_DIR`, so history survives restart) + a **Postgres** prod
  adapter behind the same port (`IV_DATABASE_URL`→`DATABASE_URL`, runtime-env only, defer-fault-to-first-use;
  the no-local-Postgres constraint met by building/verifying on the disk default). The IV sampled is a
  **constant-maturity ~30-day interpolated ATM IV (CM30)** off the already-computed term-structure curve (no
  new vendor call), with a nearest-tenor fallback recorded in the sample's `basis`/`basis_dte`.
  **Accumulation** = best-effort **write-through on bundle serve**, idempotent once-per-(ticker, UTC-day)
  upsert, no backfill, attached in `main.py` **after** `generate_signals` (fields don't exist at scoring
  time). The read computes **IV Rank** (range-position 0–100, headline) + **IV Percentile** (outlier-robust,
  secondary) over a rolling ≤**252**-session window with a "since-inception" ramp; below the **`N_min=20`**
  floor it's the honest **"building history — N of 20"** state (no number); a degenerate-flat window →
  `rank:null`, `rank_unavailable_reason:'flat_window'`, percentile still defined, **never a fabricated "50"**;
  a store/read fault → `iv_rank:null` (bundle still 200). A digested **`band`** (`premium_rich` ≥70 /
  `neutral` / `premium_cheap` <30) is cut server-side from the rank (`digested-labels-not-raw-dump` — no raw
  IV series on the wire or UI). Self-describing envelope (window/sample-count/basis) + advisory framing on
  every non-null read (`model-read-carries-its-assumptions`); **STATIC** (nothing on SSE, un-dimmed on a
  stream drop); anonymous-visible (no auth gate). `signals.py` **0 diff**; score/tier/`state_fingerprint`
  byte-identical (SPY served 83 / prime / `0e8884cc0a03`) with iv_rank present/null/absent. QA PASS (Sonnet,
  de-correlated — 19/19 ACs, conformance new standalone spec `iv_rank.json`, `nx test dashboard` 685/685).
  Third feature of the "enrich the downstream-AI's inputs" GATE I; graduated `[digested-labels-not-raw-dump]`.
- **Score lab — comparative + per-symbol signal comparison (`score-lab-signal-comparison`, BE-only,
  `NO_UI_CHANGE`, shipped 2026-08-12)** — the weekly research CLI now ranks **five candidate signals**
  (`opportunity_score` · `net_gex_vol_norm_abs` · `net_gex_abs_raw` (control) · `proximity_to_flip` ·
  `proximity_to_nearer_wall`) against **three labels**, **per symbol as well as pooled**, so the accumulating
  diary answers *which* signal ranks magnitude rather than only whether the composite one does. Motivated by
  the 2026-08-11 deep dive measuring `opportunity_score` at **AUC 0.467** (worse than chance) on its first
  slice while the `structure_event` label scored 0.932 — a figure that is substantially **definitional
  coupling**, since the score is largely built from proximity to walls and the flip and `structure_event`
  means price reached a wall or crossed the flip. That coupling is now **detected and marked**, not left for
  a reader to notice: from **declared transitive provenance over a closed `DerivationKey` enum**
  (`derived_from` required + non-empty), never from field-name intersection. Lives in a new one-way leaf
  `apps/api/src/services/research/` (pairing · candidates · labels · derivation · vocabulary · comparison ·
  artifact · render · run · fixtures · scan_guards). **It MEASURES only** — no weight, constant, gate
  threshold or fingerprint basis changes, and no lab result authorizes a score change on its own
  (`score-change-is-deliberate-and-measured`); the scoring path diff is **empty**. The CLI loads through a
  **strict read with no fallback** (hard error before any metric or artifact) while the trader-serving
  `GET /api/scan/{symbol}/history` keeps its degrading fallback — one shared reader, two deliberately
  different failure policies (`operator-vs-trader-path-separation`). Every not-a-number cause runs through
  **one closed vocabulary at three layers** (`Ineligible` row → `CellState` cell → exactly one rendering
  literal per key) plus a `MetricState` layer for metric-level absence inside a computed cell; a below-floor
  value renders **with** its marker in one literal and is never suppressed, and metrics live **inside**
  `Computed { metrics, power }` so a thin cell structurally cannot lack its numbers. Retention is
  **derived from the run's own rows** — only the cap (`STRUCTURE_HISTORY_MAX = 576`) is a constant — and the
  `Evidence:` block emits **facts only**, never a pass/fail verdict against the multi-week bar. Two diary
  slices are **frozen as committed fixtures** (`slice_2026-08-10`, 221 rows, the pre-capture-spine slice the
  deep dive measured; `slice_current`, 592 rows, fully populated), pinning the pre-feature oracle
  **bit-exactly**. QA PASS 77/78 across three passes (1 UNVERIFIABLE: the degraded-analytics path is
  Postgres-only). Prerequisite in practice for `[score-change-is-deliberate-and-measured]` — you cannot
  improve a score you cannot measure.
- **Tradeable rec inputs (2026-08-13, `tradeable-rec-inputs`)** — the AI recommendation's
  missing-input gap closed: its output schema (`max_risk` / `position_size` / `exit_plan.*`) is now
  fillable with real, bundle-traceable numbers. Four pieces: (1) **candidate option quotes/greeks**
  via the dedicated type-capped `GET /api/candidates/{ticker}` (from the chain snapshot already in
  hand — zero new vendor calls, warm-cache path pinned by test; NEVER on the bundle; drop-counts
  disclosed so a capped set never reads exhaustive); (2) **straddle-implied move** (named as a
  straddle price, not a probability; ≤3 tenors on the wire intersected with candidate tenors, ONE
  rendered; basis line carries expiration · DTE · mid · %-of-`gex_spot` visibly); (3) the
  **per-user risk block** (account size + `{value, unit $|%}` cap; egress disclosure ABOVE the
  fields, test-ordered; effective dollar cap derived ONCE server-side with closed not-derivable
  states; never a scoring input; account size excluded from every persisted client artifact by
  mutation-guarded scan); (4) the **stated non-blocking cap check** (5-member closed verdict
  vocabulary, pinned order `not_applicable → no_cap → not_checkable → within → above` — a no_trade
  card carries NO cap surface; ONE server-side `max_risk` parse; annotation persists at sim-entry
  confirm; never blocks/refuses). Plus the on-every-verdict digested "What the numbers said" line
  (owner-ruled) and the closed four-literal sizing-field vocabulary (`—`/`not set`/`unavailable`/
  `not given`). `position_size` is NEVER parsed (numeric pre-fill deliberately cut; entry dialog
  default qty 1); broker book explicitly future-dated. The rec envelope pins as-sent inputs
  (`sent.*` + digest) so the superseded-inputs strip compares against what the AI was actually told.
  Score/tier/`state_fingerprint` byte-identical (proved by builder pin + poison-proof + QA re-proof:
  `score=8 / dormant / ad81df2ba2c3`). Real before/after on 5 tickers: 0/5 no_trade→trade, 1/5
  trade→no_trade with stated reason, sizing now cites your cap. QA PASS 100/100.
- **AI-rec grounding (2026-08-13, `ai-rec-grounding`)** — the companion to the above: those inputs made
  the rec's numbers *fillable*; this makes them *checkable*. Generalizes the shipped `cited` mechanism
  from the one named contract to the model's other price-scale assertions. A sixth pure leaf
  `apps/api/src/services/rec_inputs/grounding.rs` resolves the **exit stop · exit target · invalidation
  level** server-side against a closed 11-member `anchor_kind` set, emitting a closed four-state wire
  vocabulary — `traced` · `untraced` · `not_checkable` · `not_applicable` — plus a three-member `basis`
  (`exact` / `near` / `inside_range`) and a **server-folded** six-member card verdict with four integer
  counts. `RecField` gained `InvalidationLevel`; the exhaustive `match` carries **no wildcard and no
  exemption**. `max_risk.rs`'s OUTPUT widened to `RiskRefusal { NoText | NoDollarFigure |
  MultipleDifferentFigures }` while **the accepted input set did not move by one** — the parser's
  ambiguity rule is not reopened; the fix was the prompt (single dollar amount), which took cap
  checkability from **0 of 4 to 4 of 4** on real trade verdicts.
  **The FE never re-derives a state, label or count** — every literal renders through a closed lookup;
  exactly one branch is client-selected (block absence). The word "verified", any check glyph, and the
  accusatory register are banned: traceable is not the same claim as correct. **Untraced figures render
  in place** with `the AI's own number` in visible text, distinguished by a **type register** split —
  mono means the figure is Convexa's, sans means the app could not trace it (`DESIGN_SYSTEM.md`
  Amendments 2026-08-13, narrowing "all data/figures mono"). **Nothing untraced ever seeds, pre-fills,
  defaults or is arithmetically derived into any quantity, price or limit** — including the one shared
  simulated entry dialog, where a withheld field opens empty carrying one of **three disjoint reason
  literals** (block-absent has its own, never `not_checkable`'s). Nine structural guards (SPEC §2.6),
  each poison-proved by the build lane **and independently by QA**. Additive: score/tier/
  `state_fingerprint` byte-identical, proved on both arms (goldens green **and** the pin file's own diff
  empty). **Measured on 10 live recs across 5 tickers: 44.4% of asserted numbers do not trace** — all of
  which rendered as fact before this ship. QA PASS 68/68.
- Explanatory hover tooltips on every jargon stat/chip/chart.

- **Honest absence on the AI rec (`rec-absence-literals-hole`, both lanes, shipped 2026-08-14)** — the
  six plan/context fields (`Structure`, `Strike(s)`, `Expiration`, `Entry trigger`, `Time horizon`,
  `confidence`) render a **closed-vocabulary literal** keyed on a wire reason token instead of a bare
  `—`, which stays reserved to the `no_trade` risk block. Backend emits `RecPlanField` →
  `FieldReason` on **every produced response including the local-rules and early-return branches**;
  `unrecognized` (new vocabulary member, one emit site) means *the read answered off Convexa's scale*.
  **Accept withholds:** a field the read never named is not seeded, defaulted or inferred into the
  simulated entry dialog — seam carries `null`, draft carries `''`, and the submit gate rejects it.
  The input-independent `"1–5 sessions"` time-horizon constant was deleted rather than asserted.
  Score/tier/`state_fingerprint` byte-identical; `grounding` byte-identical against a pre-feature
  baseline. Graduated `[ai-asserted-numbers-are-traceable]`. Seams → OPEN_THREADS §7af.
- **Ticker visual collisions (`ticker-visual-collisions`, FE-only, shipped 2026-08-17)** — Quick
  pins/recents separator is a 1px hairline; GEX strike-profile marker labels use a measured
  collision layout so clustered and edge `put`/`call`/`flip`/`spot`/`live`|`mid` boxes stay
  readable and inside the canvas. Words, colors, values, and live-vs-static meaning unchanged.
  `NO_BACKEND_CHANGE`. Product `a5a6955`. Seams → OPEN_THREADS §7ag.
- **AI recommendation decision card (`ai-rec-decision-card`, FE-only, shipped 2026-08-17)** — the
  produced read answers verdict → invalidation/risk → safe simulated next action on a compact
  card; long-form reasoning, grounding, provenance, and export live on a desktop drawer / mobile
  sheet. Actionability is one pure policy (`deriveAiRecPresentation`); analysis is a non-mutating
  view of the pinned read. Shared sim-entry dialog unchanged. `NO_BACKEND_CHANGE`. Seams →
  OPEN_THREADS §7ah.
- **Plan-scope caption (`rec-plan-scope-caption`, FE-only, shipped 2026-08-17)** — a produced
  non-`local_rules` trade rec shows exactly one quiet caption under the pinned DecisionCard plan
  row stating the six plan fields are not checked (only stop / target / invalidation are). Hide is
  affirmative `grounding.card === 'local_rules'` only (not `key_source`). Analysis gains no second
  instance. `NO_BACKEND_CHANGE`. Closes `ai-rec-grounding` SPEC §9.5 (both halves). Product
  `fc3bb8c`–`a944bd2`. Seams → OPEN_THREADS §7ai.

- **PostgreSQL release safety (`postgres-release-safety`, backend/infra, shipped 2026-08-22)** — the
  release image exposes one canonical non-root `api-rust` executable; Railway runs the serialized,
  advisory-lock-protected `postgres-migrate` command before replica startup. Each migration version is
  atomic with its ledger row, normal production serve is read-only and refuses every non-current or
  unverifiable schema before workers/listener, and closed JSONL/receipts exclude secrets. Real
  PostgreSQL 17, same-revision negative controls, immutable config validation, exact Railway terminal
  equality, one live replica, and independent health conformance all passed (QA 29/0/0). Standalone
  conformance: `state/conformance/postgres-release-safety.json`.

