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

