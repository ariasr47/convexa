# Convexa — Project Context (handoff)

> Self-contained ground truth for fresh, role-scoped sessions (Architect → PM →
> UX/Tech-Writer → Backend/Frontend Executioners). Assume no chat history. Grounded
> against the repo; re-generate from code if it drifts.

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

# BACKLOG — idea pool + roadmap discovery (standing reference)

> The divergent half of roadmap-advancement. The Orchestrator's **GATE I** (see
> `.claude/ORCHESTRATOR.md` §3) grooms this pool, culls to ONE next feature, and emits that as a
> per-feature `BRIEF.md` that seeds the pipeline. This file holds the candidates; it is NOT a
> commitment — promotion to a feature folder happens only through GATE I.
>
> Seeded from the deferred/open items already in `OPEN_THREADS.md`. Keep it current: when a thread
> ships, migrate its "deferred seams" here; when an item is promoted, mark it `→ promoted`.

## How an item earns promotion (the cull, from GATE I)
1. **Decision-impact test** — name the *trading decision* it improves and *how you'd observe* the
   improvement. No answer ⇒ parked, not promoted. (Mirrors the "AC observable without code" rule
   and the AI over-trading gate — we resist shiny features the same way we resist over-trading.)
2. **Feasibility gate** — data coverage + math invariants. Blocked items name their blocker.
3. **Score** — Value (H/M/L to the trading edge) × Effort (S/M/L); flag any locked invariant touched.

## Standing harvest sources (where the next wave comes from)
- **Deferred items** — `OPEN_THREADS.md` §7 + the "deferred seams" line inside each shipped thread.
- **Open strategic questions** — `OPEN_THREADS.md` §1/§9 (vendor + overnight).
- **Usage friction** — what's painful in your own daily trading use (capture as you hit it).
- **Downstream-AI quality** — does the `strategy_prompt` / `reassessment_prompt` hand-off produce
  better calls? Gaps here are first-class features.
- **Lifted constraints** — when a data/vendor limit lifts (e.g. overnight coverage), the features it
  was blocking become buildable.
- **Nx workspace graph** *(project-specific harvest source)* — the Nx MCP (`nx_workspace` / `nx affected`)
  surfaces what projects/targets exist and what's changed; use it during GATE I to spot structural gaps
  or affected-but-untouched areas worth a feature. (Conductor-side at Discovery only — kept here in the
  project-owned backlog, NOT in the generic `ORCHESTRATOR.md`.)

---

## Program — keep-paid-books (owner-directed 2026-08-19)
<!-- atlas: theme=prove-the-edge horizon=now -->
Grouping only — **not** a pipeline feature. Owner said put all seven briefing
recommendations in the pool and work them **one by one**. Each build still
earns its own `BRIEF.md` via GATE I. Theme: `prove-the-edge`.
Outcome: the $199 Options book we already fetch survives as a dated research
corpus, then we measure it; do **not** buy hist-chain to paper over prune.

| # | Item | Shape | Status |
|---|---|---|---|
| 1 | `session-chain-archive` — 1 book / symbol / ET day prune cannot delete | pipeline feature | **SHIPPED 2026-08-20** |
| 2 | `liquid-names-session-capture` — SPY/QQQ/IWM session book even if gex-cache is warm | pipeline feature | **SHIPPED 2026-08-20** |
| 3 | `paid-book-join-smoke` — run `batch-backtest` then `replay-outcome-join` on a real corpus | chore (no BRIEF) | **DONE 2026-08-20** |
| 4 | `weekly-digest-lab-ritual` — `join-outcomes` → `score-lab --horizon 1d` on SPY/QQQ/IWM | habit (runbook exists) | **RAN 2026-08-20** (keep weekly) |
| 5 | `session-corpus-wait` — 4–6 ET weeks of archived session books before a real time-split | wait / gate, not a build | **clock started 2026-08-20** |
| 6 | `ai-rec-lab-p4` — frozen AI export packs / multi-model lab | pipeline feature (later) | blocked-on boring P2–P3 + #5 |
| 7 | `chain-archive-object-store` — session bodies off app-Postgres BYTEA | pipeline feature (later) | **SHIPPED 2026-08-20** |

Do **not** bundle remaining items into one BRIEF. Do **not** start P7 vendor hist-chain.

## Program — production-maturity (owner-directed 2026-08-21)
<!-- atlas: theme=the-machine horizon=now -->
Grouping only — **not** a pipeline feature. Owner approved the production-maturity
recommendations as a program and asked to implement all of them. Deliver one independently
verifiable slice per `BRIEF.md`; do not introduce Kubernetes, Kafka, a service mesh, GraphQL,
or microservices without a measured bottleneck and a separate owner decision.

| # | Item | Shape | Status |
|---|---|---|---|
| 1 | `production-runtime-guardrails` — fail-closed prod config, restricted CORS, stable/versioned secret keys | backend/infra feature | **SHIPPED + ARCHIVED 2026-08-22** |
| 2 | `postgres-release-safety` — real Postgres CI, migration serialization/atomicity, release migration command | backend/infra feature | **NEXT — unblocked by #1** |
| 3 | `api-contract-generation` — generated OpenAPI plus checked TypeScript client/types | both-lane tooling feature | queued after #2 |
| 4 | `supply-chain-automation` — dependency updates, review, Rust audit/deny, CodeQL-supported surfaces, image scan, SBOM | CI/security feature | queued after #3 |
| 5 | `capacity-baseline` — API/SSE load and soak harness with checked thresholds and mocked vendors | backend/test feature | queued after #4 |
| 6 | `remote-archive-body-store` — S3-compatible immutable body store behind the shipped body-store port | backend/infra feature | queued after #5; existing filesystem store remains fallback |
| 7 | `telemetry-slos` — trace correlation/export, service-level objectives, dashboards and alert runbook | backend/infra feature | queued after #6 |
| 8 | `replica-safe-workers` — API/worker process split, singleton/job coordination, distributed rate limiting | backend/infra feature | queued after #7 |
| 9 | `recovery-deployment-maturity` — backup/restore drill, staging/migration/smoke/rollback gates, declarative host config | ops feature | queued after #8; migrate `railway.json` watch paths to Railway IaC before 2026-12-01 once the translator preserves them |
| 10 | `resilience-and-quant-assurance` — standardized upstream resilience plus property/fuzz/benchmark regression gates | backend/quant feature | queued after #9 |

Current-state corrections folded into the program: CI/CD and production smoke already exist;
session bodies already sit outside app Postgres on a filesystem body-store. Their successors
harden those capabilities rather than rebuilding them.

## Last GATE S — 2026-08-22 (`production-runtime-guardrails` — fail-closed production profile)
> [discovery: 6 lines elided — closed history; read context/BACKLOG.md for the full section, or memory_query]
## Last GATE I — 2026-08-20 (canon repair → `project-context-s2-is-python-era`)
<!-- atlas: theme=the-machine horizon=now -->
Owner picked Architecture canon after keep-paid-books builds drained.
**Chosen → `project-context-s2-is-python-era`.** Inline conductor repair (no council —
the file being repaired is what a council would read). `PROJECT_CONTEXT.md` §2 backend
rewritten against `api-rust` + `quant-engine`; Python named only as archived. §2 split
into `## 2` backend (~60 lines) + `## 2b` frontend (~131) for shard size.
**No product code.** Push still deploy.

## Last GATE S — 2026-08-20 (`chain-archive-object-store` — session bodies off OLTP)
> [discovery: 6 lines elided — closed history; read context/BACKLOG.md for the full section, or memory_query]
## Last GATE S — 2026-08-20 (`liquid-names-session-capture` — SPY/QQQ/IWM despite warm cache)
<!-- atlas: theme=prove-the-edge horizon=now -->
Full pipeline: GATE I (keep-paid-books #2) → council (D1=A same-day retry) → PLAN (B1–B8 · F1–F2)
→ both lanes → **GATE Q PASS 25/0/0**. Archived to `_archive/liquid-names-session-capture/`.
Conformance re-pin promoted. **No new canon graduation expected.** Working tree uncommitted;
push is deploy. **Next in program → `paid-book-join-smoke` (chore).**

## Last GATE S — 2026-08-20 (`session-chain-archive` — prune-proof session books)
> [discovery: 7 lines elided — closed history; read context/BACKLOG.md for the full section, or memory_query]
## Last GATE I — 2026-08-20 (keep-paid-books #2 → `liquid-names-session-capture`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Owner `ship it and continue`. **Chosen → `liquid-names-session-capture`.** Brief at
`.spire/clusters/tech/contracts/liquid-names-session-capture/BRIEF.md`.
**Backend / research; trader UI out of scope.**
**Why it won:** #1 shipped a prune-proof archive, but a warm gex-cache never hands a
`VendorBundle` to capture — QA observed QQQ as honest `no session book`. The names
score-lab already uses are the ones missing paid session books. Do not bundle object-store
or hist-chain. Cite live Rust.

## Last GATE I — 2026-08-19 (keep-paid-books program → `session-chain-archive`)
> [discovery: 10 lines elided — closed history; read context/BACKLOG.md for the full section, or memory_query]
## Last GATE I — 2026-08-18 (d) (after back-test eval → `replay-outcome-join`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Owner said `go` (next **build**, not a docs runbook) after the P0–P3 evaluation.
**Chosen → `replay-outcome-join`.** **SHIPPED 2026-08-19** (see Last GATE S below).
Brief archived at `_archive/replay-outcome-join/BRIEF.md`.

## Last GATE S — 2026-08-19 (`replay-outcome-join` — labels on replayed paid books)
<!-- atlas: theme=prove-the-edge horizon=now -->
Full pipeline: GATE I (`go` after back-test eval) → council (D1=A capture-time `p0`) →
PLAN (B1–B10 · F1) → crash-recovery GATE R → both lanes → **GATE Q PASS 35/0/0**.
Archived to `_archive/replay-outcome-join/`. Conformance re-pin of `_research` routes
promoted. **No new canon graduation expected** (tally next). Working tree still
uncommitted; push is deploy. Pipeline drained; next move is GATE I (`go`).

## Last GATE S — 2026-08-18 (`batch-backtest-cli` — P3 replay of stored books)
<!-- atlas: theme=prove-the-edge horizon=now -->
Full pipeline: GATE I (`go` after capture) → council (D1=A refuse hollow split) → PLAN
(B1–B9 · F1) → both lanes → **GATE Q PASS 28/0/0**. Archived to
`_archive/batch-backtest-cli/`. Conformance re-pin of `_research` routes promoted.
**No new canon graduation.** Working tree still uncommitted; push is deploy.
Pipeline drained; next move is GATE I (`go`).

## Last GATE I — 2026-08-18 (c) (queue-drain after capture ship → `batch-backtest-cli`)
<!-- atlas: theme=prove-the-edge horizon=now -->
Pipeline drained after `chain-snapshot-capture` GATE S. Owner said `go`.
**Chosen → `batch-backtest-cli`.**
**✓ SHIPPED + ARCHIVED 2026-08-18** → `_archive/batch-backtest-cli/`. Brief at
`.spire/clusters/tech/contracts/_archive/batch-backtest-cli/BRIEF.md`.
**Backend / research; trader UI out of scope.**
**Why it won:** capture exists so the $199+$199 subscriptions can be measured, not only
served live. P2 `score-lab` still ranks digested samples; it never reloads a stored chain.
P3 is now feasible. Do **not** buy hist-chain. `project-context-s2-is-python-era` still
unpaid — this BRIEF cites live Rust; do not bundle.

## Last GATE S — 2026-08-18 (`chain-snapshot-capture` — keep paid Massive snapshots)
<!-- atlas: theme=trust-the-signal horizon=now -->
Full pipeline: GATE I (owner-named) → council (D1=A every paid fetch; dual retention 14d+48) →
PLAN (B1–B9 · F1–F2) → both lanes → **GATE Q PASS 28/0/0**. Archived to
`_archive/chain-snapshot-capture/`. Conformance JSON promoted. **No new canon graduation.**
P3 batch-backtest CLI is now unblocked. Working tree still uncommitted; push is deploy.
Pipeline drained; next move is GATE I (`go`).

## Last GATE I — 2026-08-18 (owner: keep paid Massive snapshots → `chain-snapshot-capture`)
<!-- atlas: theme=trust-the-signal horizon=now -->
Owner-directed after `ai-providers` ship. **Chosen → `chain-snapshot-capture`.**
**✓ SHIPPED + ARCHIVED 2026-08-18** → `_archive/chain-snapshot-capture/`. Brief at
`.spire/clusters/tech/contracts/_archive/chain-snapshot-capture/BRIEF.md`.
**Backend / research; trader UI out of scope.**
**Why it won:** Stocks $199 + Options $199/mo is not sustainable without keeping what those
calls already return. P0 already saves a digested structure row and a latest-wins
`scan_bundles` cache; the live `VendorBundle` is discarded. Batch replay (P3) is blocked
on this. Do **not** buy a new Massive product; do **not** invent hist-chain endpoints.

## Last GATE S — 2026-08-18 (`ai-providers` — multi-provider keys + named model)
<!-- atlas: theme=trust-the-signal horizon=now -->
Full pipeline: GATE I (owner-named) → council (D1–D7; D7 = user's Grok subscription) → PLAN
(B1–B10 · F1–F9) → both lanes (FE crashed once at ~249k, resumed) → **GATE Q PASS 26/0/4**.
Archived to `_archive/ai-providers/`. Conformance JSON promoted. **No new canon graduation.**
New watch-list key `user-subscription-not-operator-pool`. AC-9/10/14/15 remain blocked-on
AC-27. Working tree still uncommitted; push is deploy — owner call. Pipeline drained;
next move is GATE I (`go`).

## Last GATE I — 2026-08-17 (b) (owner request: multi-provider keys + Grok pool + model choice → `ai-providers`)
<!-- atlas: theme=trust-the-signal horizon=now -->
Owner-directed after `rec-plan-scope-caption` ship. **Chosen → `ai-providers`.**
**✓ SHIPPED + ARCHIVED 2026-08-18** → `_archive/ai-providers/`. Brief at
`.spire/clusters/tech/contracts/_archive/ai-providers/BRIEF.md`. **Both lanes.**
**Why it won:** owner named it. Settings is still Anthropic-only; the server already
accepts `provider` on the key PUT and can call four vendors, but the trader cannot pick a
model and there is no Grok OAuth / Convexa sub-pool path. Decision-impact: which model's
read they act on, and whether they pay BYO when a cheaper pool was intended.
**Do not invent** an xAI SuperGrok-subscription protocol — the asked path is "log in with
Grok to use Convexa's cheaper pool." Architect names a buildable mechanism or blocks that
arm. `project-context-s2-is-python-era` still unpaid; this BRIEF cites live Rust paths.

## Hygiene 2026-08-20 (Vercel React review batch — not a pipeline feature)
<!-- atlas: theme=the-machine horizon=now -->
Owner asked for the hygiene batch after a Vite/React skill review. **Not GATE I.**
Paid in this pass: (1) Vite analogue of `optimizePackageImports` for `@mui/material`
(`tools/vite-mui-path-imports.mjs`); (2) `cargo fmt -p api-rust -p quant-engine` so
`--check` is green; (3) `ports:free` IPv6 (`netstat -ano` both families; never :8001);
(4) `ci-standing-red` retired — local `npm run ci` analogue + e2e 52/52 + cargo test
green 2026-08-20; origin Frontend job already green 2026-08-16.
**Follow-on four, owner-named same day:** `mui-dev-eslint-path-imports` (source rewrite
+ ESLint lock + VS Code auto-import exclude; Vite plugin stays out of `vite.config.mts`
because `tools/` is outside the dashboard module boundary) · `god-module-split-trade-entry-portfolio`
(FE only: `openTypes` / `useContractLive` / `FillModeToggle` / `AiRecPanelBlocks`) ·
`widget-variant-not-boolean` (`bodyPad` + `bodyVariant`, no `noBodyPad`) ·
`toSorted-on-new-sorts` (production sorts + `tsconfig` `lib: es2023`) ·
`light-theme-first-paint` (blocking `data-theme` + paper canvas) ·
`eslint-warning-hygiene` (dashboard lint 0 warnings). Remaining review
findings stay in §B (`hygiene-review-2026-08-20` cluster) so GATE I can resurface
them. `project-context-s2-is-python-era` was repaired the same calendar day (canon
§2 Axum/`api-rust`).

## Last GATE S — 2026-08-17 (b) (`rec-plan-scope-caption` — §9.5 half two closed)
> [discovery: 8 lines elided — closed history; read context/BACKLOG.md for the full section, or memory_query]
## Last GATE S — 2026-08-17 (owner-directed archive of two live FE folders)
> [discovery: 8 lines elided — closed history; read context/BACKLOG.md for the full section, or memory_query]
## Last GATE I — 2026-08-17 (queue-drain cull → `rec-plan-scope-caption`; four stale alarms cleared)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline drained (`contracts/` held only `_archive/` + `_discovery-pack.md`; `IN_FLIGHT` empty;
`main` @ `593f601` = `origin/main`). Owner-directed archive of `ticker-visual-collisions` +
`ai-rec-decision-card` had just closed. Discovery pack again elided the BACKLOG **Pool (1173
lines)** and the **Ledger (601 lines)** as over-budget — escape hatch used; both read directly.
**Chosen → `rec-plan-scope-caption`.** **✓ SHIPPED + ARCHIVED 2026-08-17 (b)** →
`_archive/rec-plan-scope-caption/` (FE-only; GATE Q 19/19). Brief at
`.spire/clusters/tech/contracts/_archive/rec-plan-scope-caption/BRIEF.md` (full `Considered:`).
**Frontend-only expected (`NO_BACKEND_CHANGE`).**
**Why it won:** it is the only survivor whose failure mode is a **wrong trade**. Half one of
§9.5 (false `—` on absent plan fields) closed at `rec-absence-literals-hole`; half two — a
reader inferring *"no clause means checked"* onto **stated** structure / trigger / horizon /
conviction — was future-dated when that council cut the caption on line-budget. The
decision-card ship moved long-form into a drawer, which is new **placement** evidence; it did
**not** remove the always-on condition: `recommendation.rs:841-849` still emits `trade` with
empty strikes and a stated structure/trigger whenever a setup exists. That constraint binds
the design — the caption must not become standing chrome on `local_rules`.
**Queue honesty (code-verified this gate — do not re-open as stale):**
1. **S5c is NOT resolved on the live backend.** `docs/TECH_DEBT.md` ticks it at `86adf3b`,
   which patched Python `main.py` / `live.py`. Rust `config.rs` never reads
   `MAX_LIVE_SESSIONS` / `MAX_LIVE_SUBSCRIBERS` (decoy lines in `.env.example`).
   `routes/stream.rs` caps **symbols per request** (120), not concurrent subscribers.
   Strongest N/A-class runner-up; do not start it until `project-context-s2-is-python-era`
   is its own reviewable diff.
2. **`signed-out-refused-affordances` SHIPPED 2026-08-10** (IMPROVEMENT_BACKLOG 5.1,
   `shared/ui/Refused`). The §A "displaced to L4" row is stale.
3. **`split-decision-log` CLOSED.** `features/trading/model/store.ts` is a read-only
   legacy harvest source; write paths were deleted at the v3 cutover.
4. **The DTE `?` / containment caption is CLOSED** in `ai-rec-decision-card`
   (`dteWindowCaption` requires both finite bounds; wording is a request property).
**Flagged RISING for a FOURTH consecutive gate, still not chosen:**
`degradation-visibility` (decision-impact N/A). Do not re-derive a fifth time — it needs
an owner override if it is ever to run.
**Hygiene batch 2026-08-20:** `ci-standing-red` retired · `ports-free-is-ipv4-only` closed
· `cargo-fmt-whole-crate-drift` closed. The :8000 *access-denied orphan* can still outlive
`taskkill` (Windows file lock) — see §B `ports-orphan-access-denied`.
**X4 (ledger checkpoint) still blocked** on N≥20 closed outcomes.
**`project-context-s2-is-python-era` repaired 2026-08-20** (canon §2).

## Last GATE I — 2026-08-14 (pre-registered successor re-tested and CONFIRMED → `rec-absence-literals-hole`; scope revised UP to six fields + both lanes)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline drained (`contracts/` held only `_archive/`; `IN_FLIGHT.md` one row, `main` @ GATE S, no
overlap). **First gate run on spire-os 3.13.0** (the prior ship ran the 3.3.0 driver; the RESUME
overlay directed this gate to re-derive the catalog from the installed files rather than assume).
The prior gate and the 2026-08-13 RESUME both pre-registered **`rec-absence-literals-hole`** and
directed **re-test rather than inherit**. Re-tested and **CONFIRMED — with its scope revised UP.**
**Chosen → `rec-absence-literals-hole`.** **✓ SHIPPED + ARCHIVED 2026-08-14** →
`_archive/rec-absence-literals-hole/` (full pipeline both lanes; council 28 conflicts / 28 quotes
machine-verified / 9 self-revisions / 1 owner ruling + 1 at the review cap; S2 ×2 → R4 ×3; **GATE Q
PASS 47/47, 0 FAIL** with zero code defects — the one bounce was a canon row the conductor owed).
Conformance spec promoted to `state/conformance/rec-absence-literals-hole.json` (2 endpoints).
**GATE S graduated `ai-asserted-numbers-are-traceable`** (2 binding) — the key logged at 0 instances
2026-07-16 as aspirational; it reached the bar on ordinary recurrence, so the queued severity-path
question dissolved unasked. Canon folded: OPEN_THREADS §7af + PROJECT_CONTEXT §5/§6 + DESIGN_SYSTEM
Amendments (`unrecognized`). **⚠ §9.5 closes in HALF ONE ONLY** — half two survives until the
future-dated plan-row caption ships, and no report may record it closed before then.
*(original entry:)* Brief at `_archive/rec-absence-literals-hole/BRIEF.md`
(carries the full `Considered:` cull set). **Both lanes expected.**
**Why it won:** it is the only survivor whose failure mode is a **wrong trade** rather than a
degraded, slower or unmeasured one. `ai-rec-grounding` closed the numbers the AI **asserts**; this
closes the ones it **omits** — the other half of the same hole, and the residual that feature named
in its own SPEC §9.5. Every other candidate is decision-impact **N/A** by the cull's own test.
**Queue honesty (code-verified this gate — do not re-open as stale):**
1. **The entry's line numbers and lane are BOTH wrong** — the third time the "backlog code
   references go stale" rule has bitten. The file moved to `pages/ticker/widgets/ai-rec/AiRecPanel.tsx`;
   the bare `?? '—'` sites are **`:1081, :1084, :1090, :1100`**, not `753/1044/1053/1063`.
2. **It is SIX fields, not four.** `Time horizon` (`:1153`) and `confidence` (`:1158`) carry the same
   bare `?? '—'` and the 2026-08-13 entry named neither.
3. **It is NOT FE-only.** `apps/api/src/services/rec_inputs/field_reasons.rs:5` defines
   `RecField { MaxRisk | PositionSize | ExitTarget | ExitStop | InvalidationLevel }` — the risk/exit
   fields only. **No reason token exists on the wire for any of the six**, so the frontend cannot
   distinguish an omission from anything else without a backend addition. Backend lane required.
4. **The defect is sharper than the entry states.** All six sit in the **trade** branch
   (`AiRecPanel.tsx:997`), while `—` is defined at `:958` as the `no_trade` branch's *"No entry, so
   there is nothing to size."* So a card headed **`Trade · long`** can print `Strike(s): —` — the
   reserved no-entry literal on a card that just told you to enter. The fix mechanism already ships
   **in the same file**: `fieldLiteral` (`literals.ts:50`), a closed `FieldLiteral` union with a
   spec'd, tested five-member vocabulary.
**Runner-up:** the **S5c SSE connection ceiling** — the last genuine MEDIUM from the security review,
and the one that can take the **current single container** down now that the app is live. Pick it
next if an availability/backend fast-path is wanted.
**Flagged RISING for a THIRD consecutive gate, still not chosen:** **`degradation-visibility`**
(decision-impact N/A, so the cull cannot promote it) — it grew again this ship, since
`ai-rec-grounding` added more nullable best-effort fields to a system that still aggregates no null
rates. A rule that keeps rising and can never win the cull is worth an owner decision rather than a
fourth re-derivation.
**`project-context-shard-sizes` escalated by this gate's own evidence** (it was already superseded
by the 3.13.0 doctor's 100KB budget flags): the discovery pack elided the BACKLOG **Pool (1123
lines)** and the **Ledger (575 lines)** as over-budget — **discovery's own pack dropped the primary
discovery surface**, and both had to be read directly by targeted Read. The escape hatch worked as
designed and is recorded here as the signal to fix the pack, per ORCHESTRATOR §3 GATE I.
**Hygiene batch still unpaid** (`ci-standing-red` + `ports-free-is-ipv4-only` +
`cargo-fmt-whole-crate-drift` + the :8000 orphan) — carried from the prior gate, unchanged.

## Last GATE I — 2026-08-13 (pre-registered successor re-tested and CONFIRMED → `ai-rec-grounding`; its feasibility re-grounded UP)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline drained (`contracts/` held only `_archive/`; IN_FLIGHT showed no overlap). The prior gate and
the 2026-08-13 RESUME overlay both pre-registered **`ai-rec-grounding`** as the strongest successor and
directed this gate to **re-test rather than inherit** it. Re-tested and **CONFIRMED**.
**Chosen → `ai-rec-grounding`.** **✓ SHIPPED + ARCHIVED 2026-08-13** →
`_archive/ai-rec-grounding/` (full pipeline both lanes; GATE Q **PASS 68/68** after one GATE Z bounce
cycle; conformance spec promoted to `state/conformance/ai-rec-grounding.json`; see OPEN_THREADS §7ae).
**The number that justifies the feature: 44.4% of the AI's asserted numbers do not trace** to anything
Convexa computed — all of them rendered as fact before this ship. The prompt fix took `max_risk`
cap-checkability from **0 of 4 to 4 of 4**. *(original entry:)* Brief was at
`contracts/ai-rec-grounding/BRIEF.md` (carries the full `Considered:` cull set). Both lanes expected.
**Why it won:** it is the only survivor whose failure mode is a **wrong trade** rather than a degraded,
slower or unmeasured one. `[best-effort-isolated-or-null]` covers the AI *failing*; **nothing covers it
fabricating**, and `tradeable-rec-inputs` (shipped the day before) made the rec assert strictly MORE
numbers. It also promotes `ai-asserted-numbers-are-traceable` — a watch-list key deliberately parked at
**0 instances** since 2026-07-16 as aspirational — on real evidence rather than intention.
**Queue honesty (code-verified this gate — do not re-open as greenfield):**
1. **`ai-rec-grounding` is NOT greenfield — the verification seam SHIPPED last week and the §B entry
   (written 2026-07-16) predates it.** `apps/api/src/services/rec_inputs/` already contains
   `cited.rs` (a private-field `CitedKey` with **no partial constructor**, matching the rec's named
   contract against the candidate set under a closed `CitedState`), `cap_check.rs`, `max_risk.rs` (ONE
   parse for ONE consumer) and `field_reasons.rs` — whose `RecField { MaxRisk | PositionSize |
   ExitTarget | ExitStop }` already enumerates the exact four fields this feature must cover.
   **The precise gap:** `field_reasons` explains **absence** (`NotGiven`/`Unavailable`) and nothing
   verifies **presence** — `exit_plan.stop`, `exit_plan.target` and any price the prose names are
   rendered verbatim from the model. So this is an **extension of a live module**, not a new subsystem.
   Feasibility revised **M**, not the entry's implied larger build. FE precedent likewise exists,
   un-generalized: `ai-rec.risk.spec.tsx` §1 already guards "Levels in play is bundle-sourced".
2. **`rec-prompt-single-figure-max-risk` is FOLDED IN, not separately scheduled.** `max_risk.rs`
   returns `NotParseable` when the prose names two *different* dollar figures in one sentence — which
   the V10 harness measured on **4 of 4** after-arm trades, so the cap check ships delivering nothing on
   its headline path. Same surface, same session; splitting it means touching the rec twice.
   **The parser is correct and is NOT reopened** — the fix is the prompt, never a parser loosening.
**Runner-up:** `score-lab-b0b-outcomes` — S-sized backend fast-path, unchanged from the prior gate;
needs `MASSIVE_API_KEY` at run time and **never synthesizes outcomes** (if the key is unavailable it
waits). Pick it next if a backend fast-path is wanted.
**Two items flagged RISING, not chosen** (both decision-impact **N/A**, so the cull cannot promote them —
recorded so a later gate does not re-derive the judgement): **`degradation-visibility`**, which grew more
valuable *this ship* because tradeable-rec-inputs added several nullable best-effort fields to a system
that still aggregates no null rates; and the **S5c SSE connection ceiling** (§C Stage 3 / `docs/TECH_DEBT.md`),
which stopped being theoretical when the app went live — it is the one remaining MEDIUM that can take the
**current single container** down. **Hygiene batch worth one pass:** `ci-standing-red` +
`ports-free-is-ipv4-only` + the :8000 orphan — the last feature lost time to all three, one QA pass having
to **rename a running binary** to get a trustworthy measurement.

## Last GATE I — 2026-08-12 (runner-up promoted; sequencing deferral re-tested and overturned → `tradeable-rec-inputs`)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline drained (`contracts/` held only `_archive/`). The prior gate pre-registered its runner-up —
*"`tradeable-rec-inputs` Tier 1 (items 1+2+3) … deferred on **sequencing not merit**. Pick it next."*
— and the RESUME overlay directed this gate to **re-test that sequencing rather than inherit it**.
Re-tested and **OVERTURNED**. **Chosen → `tradeable-rec-inputs` (Tier 1: items 1+2+3).**
**✓ SHIPPED + ARCHIVED 2026-08-13** → `_archive/tradeable-rec-inputs/` (full pipeline both lanes;
QA PASS 100/100 after one GATE Z bounce cycle; see OPEN_THREADS §7ad).
**Why the deferral no longer held:** the stated objection — "enriches inputs to a headline judgment
whose ranking value was just measured as unestablished" — conflated the composite `opportunity_score`
(what the score lab measures) with the **AI recommendation** (what Tier 1 feeds — a different
judgment, measured by the outcome ledger, not the lab). The lab's own question needs weeks of diary
accumulation regardless (B0b open), so holding the strongest product candidate behind it idled
product progress for nothing. Both source caveats carried as binding framing and were **borne out at
ship**: the real before/after run produced 0/5 no_trade→trade flips and 1/5 trade→no_trade with a
stated reason — better-argued, not more trades.
**Queue honesty (disk-verified this gate — do not re-derive):**
1. **N3 `index-first-defaults` is NOT "Not started" — it SHIPPED + ARCHIVED 2026-08-01** (verified:
   `_archive/index-first-defaults/_MANIFEST.md`, QA PASS 6/6). The 2026-08-12 RESUME overlay inherited
   the stale label from `docs/ROADMAP_2026-08.md`; it was removed from this cull set. Correct the
   roadmap doc's label when next touched.
2. ~~**N1 (deploy) still outstanding — 5th consecutive gate flag.**~~ **WRONG — RETIRED 2026-08-13.**
   The owner challenged this and was right: full CI/CD exists (built in Grok CLI sessions) and
   **push = deploy** — Railway auto-deploys the backend, Cloudflare Pages builds the frontend from git.
   Verified by live probes: this very feature was serving on `convexa.pages.dev` within the hour of its
   push, front and back. The "June 29 build / applied by hand" claim had survived multiple "verified"
   RESUME notes — a stale-canon lesson: **a standing flag repeated across gates is a claim to re-probe,
   not a fact to inherit.** See OPEN_THREADS §8's superseded CI/CD bullet for the full correction.
**Runner-up:** `score-lab-b0b-outcomes` — S-sized, unlocks V3b + the lab's full-power cells; needs
`MASSIVE_API_KEY` at run time; fits a quick backend fast-path whenever the owner wants it.
**Also close:** `ai-rec-grounding` — Value H, and now strictly MORE valuable post-ship (the rec
asserts more numbers to trace); natural successor.

## Last GATE I — 2026-08-11 (b) (roadmap queue drained → `score-lab-signal-comparison`; two more stale alarms cleared)
<!-- atlas: theme=prove-the-edge horizon=now -->
Pipeline drained again (`contracts/` held only `_archive/`), and this time **the 2026-08-01 roadmap
queue itself is exhausted**: X1/X3-adjacent items shipped, X2 + `alerts` are shipped-in-code, and
**X4 (ledger checkpoint) is blocked** on N≥20 closed outcomes via owner habit N2 — deferred by the
owner 2026-08-01. So this gate chose what comes AFTER the standing order rather than executing it.
**Chosen → `score-lab-signal-comparison`.** Brief at
`.spire/clusters/tech/contracts/score-lab-signal-comparison/BRIEF.md` (carries the full `Considered:`).
Backend-only expected (research CLI + report; no UI, no trader route). Make the weekly score-lab
**comparative and per-symbol by default** — rank vol-norm GEX and level geometry beside
`opportunity_score` on the same KPI — so the accumulating diary answers *which* signal ranks
magnitude, not just whether the composite one does.
**Why it won:** the freshest evidence in the repo (`docs/research/SCORE_LAB_DEEP_DIVE_2026-08-11.md`,
dated this day) measured the app's headline judgment as **worse than chance** at ranking large moves
on its first slice (AUC 0.467, lift@top10 0.17, Pearson ≈ −0.02) while `structure_event` scored
AUC 0.932 — and the two most decision-relevant findings in that document (the per-symbol inversion
SPY +0.51 / QQQ −0.31, and the structure-event contrast) were produced **by hand for the write-up**,
not by the tool. It is also the only survivor whose value **decays weekly**: the diary accumulates
daily, and each week the lab runs non-comparatively answers a question already answered.
**Queue honesty (code-verified this gate — do not re-open as greenfield):**
1. **The deep dive's "autonomous follow-up (code)" is ALREADY SATISFIED.** It asks that the slow-lane
   append copy `row.score_drivers` into structure history. That path is complete in current code —
   `projection.rs:126` populates drivers from signals, `store.rs:129` (`from_row`) copies them,
   `pg_scan.rs:426` persists them, and `store.rs:944` tests it — **all landed 2026-08-10 in
   `13656ad`**, before the doc was written. The `n = 0` attribution cells are **older captures**, which
   the doc itself hedged and which must not be repaired ("do not invent drivers for past null rows").
   **Genuine residual is one S-sized piece:** nothing logs when an ok row yields null drivers, so a
   live regression would look identical to a pre-fix row. Folded into the chosen feature.
2. **The backlog's code references are STALE — the backend is Rust, not Python.** Many §B/§C entries
   cite `main.py` / `signals.py` / `engine.py` / `live.py` / `interface_conformance.py`; `apps/api` is
   **Axum/Tokio Rust** (crate `api-rust`) and the Python tree is retired under `archive/api-python/`
   (`RETIRED.md`). Feasibility notes resting on those paths must be re-grounded before they are
   trusted — this gate re-grounded only the chosen feature's.
3. **`sources.ts` NUL bytes — CLEARED.** §8 flags literal NULs making the file binary to grep; byte
   scan at this gate returns **0**. Stale; do not re-schedule.
**Runner-up:** `tradeable-rec-inputs` Tier 1 (items 1+2+3) — the strongest **product** candidate,
passes the cull emphatically, deferred on **sequencing not merit** (it enriches inputs to a headline
judgment whose ranking value was just measured as unestablished). Pick it next.
**Also flagged, not a pipeline feature:** the live site `convexa.pages.dev` is still the
**2026-06-29 build**, so the 2026-08-06 private-testing lockdown (§7ac — signups closed, scan routes
gated) **is not live**; sign-ups remain open in production. Owner habit N1 (deploy runbook).

## Last GATE I — 2026-08-11 (queue honesty after drain → `recent-ticker-chips`; X2/X3/split-log no longer greenfield)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline drained after `distance-to-level-tiles` SHIPPED + ARCHIVED + prod deploy. Owner chose
track **A** (next product feature). Full harvest against standing queue + code reality (not the
stale roadmap labels alone).
**Chosen → `recent-ticker-chips`.** Brief at
`.spire/clusters/tech/contracts/recent-ticker-chips/BRIEF.md` (carries full `Considered:`). FE-only
expected (`NO_BACKEND_CHANGE`). Highest remaining Ticker UX quick win after distance-to-level tiles.
**Queue honesty (code-verified this gate — do not re-open as greenfield):**
1. **`vol-normalized-gex` (X2) — already in production code.** `libs/quant-engine` vol_gex + Path B
   analytics + `MarketState.vol_normalized_gex?` + DealerPositioning “Vol-norm GEX” tile +
   methodology copy. Status note: `docs/research/X2_VOL_NORMALIZED_GEX_STATUS.md`. Residual =
   score-lab coupling / hist A/B research — **not** a rebuild. Mark X2 **shipped in code** in the
   standing queue; thin Spire archive optional later.
2. **`alerts` (X3) — already in production code.** `/alerts` route + TopNav, client durable rules,
   pure evaluate + vitest, ticker evaluate-on-snap, optional browser Notification. Webhook delivery
   remains deferred optional. IMPROVEMENT_BACKLOG 5.5 checked 2026-08-10.
3. **`split-decision-log` — RESOLVED** at positions v3 cutover: ghost `appendDecision` / write path
   deleted; `model/store` is read-only harvest; single positions decision log. BACKLOG §B entry is
   **stale alarm** — leave for cleanup, do not re-schedule as emergency.
**Runner-up:** sticky condensed header (still deferred Ticker UX). **Blocked:** ledger checkpoint
X4 on N≥20 closed outcomes (habit N2). **Not chosen:** re-implementing X2/X3.

## Last GATE I — 2026-08-06 (queue-drain cull → `broker-option-grouping`; the owner pick held, one entry re-assessed DOWN)
<!-- atlas: theme=trust-the-signal horizon=now -->
Pipeline was **drained** (`.spire/clusters/tech/contracts/` held only `_archive/`); ran the full harvest → cull
rather than rubber-stamping the queue. **Chosen → `broker-option-grouping`** (roadmap queue item 3,
owner-chosen 2026-08-05 off the live broker verify). Brief at
`.spire/clusters/tech/contracts/broker-option-grouping/BRIEF.md` — it carries the full `Considered:` cull set;
not restated here. FE-only expected (empty `apps/api` diff); the seam is `brokerView.ts`, already a
pure `BrokerBook → PositionView[]` projection, so grouping is a pure layer over its output.
**The cull did not just confirm the queue — it changed two things:**
1. **`split-decision-log` RE-ASSESSED DOWN (§B).** Its entry reads as an evidence-leak emergency
   ("half the decision records written to a dead-letter key"), which would outrank a UI feature
   outright given the roadmap's edge test depends on ledger N. But the entry's own interim note
   settles it: **outcome-ledger's reader unions both durable logs and de-dupes**, so the ledger is
   **not losing evidence today**. Remaining harm = store-split integrity + a migration hazard
   (`[loss-free-durable-migration]` is binding when it IS fixed). **Value M–H → M.** Recorded here
   so the next GATE I does not re-derive the alarm from the entry's framing.
2. **`responsive-layout`'s data-loss alarm is STALE — cleared, not acted on.** §B still warns the
   branch "exists ONLY on this machine — never pushed" and recommends pushing it. **Verified at this
   gate:** `origin/feat/responsive-layout` exists at `a7b92eb`, identical to local, 0 ahead / 0
   behind. The chore is done; §B corrected in place. What actually remains is the owner **device
   review** (notch safe-areas, fluid type, <375px polish) — a real parked item, not a risk.
**Runner-up if a different shape is wanted:** `vol-normalized-gex` (X2 — strongest decision impact
in the pool, heavier GATE-M math track, the roadmap's own next-in-line). §B **distance-to-spot level
tiles** **SHIPPED + ARCHIVED 2026-08-11** as `distance-to-level-tiles`.
**Non-blocking, folded into the BRIEF rather than asked here:** §7z's UNRULED `Build reassessment`
on `partial` option rows carrying `position: null` sits on exactly the rows this feature
restructures → routed as a council R3 **product** conflict so the surface is touched once.

## Last GATE I — 2026-08-01 (OWNER ROADMAP ADOPTION: edge-first — `docs/ROADMAP_2026-08.md` is the standing order)
<!-- atlas: theme=prove-the-edge horizon=now -->
**Owner-directed, off the deep-research cycle** (evidence: `docs/MARKET_REALITY_REPORT_2026-08-01.html`,
4 sourced research tracks + canon; frame locked by owner Q&A 2026-08-01: *my edge first, business later* ·
10–25 h/wk · owner will be the public face · minimize spend, ~$1k/mo ceiling). **The roadmap doc is the
standing order for sequencing** — this entry records the queue + what it displaces; the doc carries the
rationale, budget variants, and the pre-committed kill/continue gates.
**Strategy in one line:** prove the edge on the owner's own trading first (the outcome ledger is the
judge); commercialization (L3/L4) is **gated on ledger evidence + licensing-in-writing** — never before.
**Queue (in order):**
1. **`index-first-defaults` (N3) — ✓ SHIPPED + ARCHIVED same day (2026-08-01, `832f0a7`).** GATE V
   fast-path; QA PASS 6/6 (de-correlated Sonnet); suite 1104/99 the new baseline; empty `apps/api`
   diff; no new ledger rows (all touched keys already canon). Seams → OPEN_THREADS §7y (the
   hand-mirrored `INDEX_MEGACAP_SYMBOLS` maintenance contract). *(original entry:)* default ticker →
   SPY (pref wins), scanner zero-state leads indexes+megacaps, single-name honesty caption.
2. **`broker-connect` (X1) — ✓ SHIPPED + ARCHIVED (2026-08-05).** Read-only real Webull positions;
   owner live-verified against their actual 13-position book. QA PASS after one GATE Z security
   cycle; **system-6 fired and closed** (1C+3H+2M fixed, each with a regression test).
   `[no-real-order-path]` narrowing FORMALIZED and made structural. Seams → OPEN_THREADS §7z.
   New ledger candidate `vendor-contract-verified-not-faked` (3 instances in one feature).
   *(original entry:)* **⏭ was NEXT — `broker-connect` (X1)** — READ-ONLY real positions behind the **`PositionsProvider` port**,
   two candidate adapters the council must weigh (CORRECTED 2026-08-01 after owner question): (a)
   **Webull-direct via the owner's own Individual OpenAPI keys** (free; 1–2 day individual application;
   account+positions endpoints + official Python SDK; no intermediary; BYO-credential pattern = byo-ai-key
   precedent; verify options/multi-leg payload shape at application time) — likely v1 for the edge-first
   personal phase; (b) **SnapTrade** (free ≤5 connections, then ~$1–2/user/mo; OAuth UX; multi-broker;
   Webull officially partnered 2025-12-16) — the named adapter for the later external-users phase. The
   earlier "Webull-direct is dead" verdict applied only to third-party/platform access, NOT self-use.
   Full council. **Fires the deferred system-6 security review** (first real-account connection — the
   long-standing trigger; broker App Secret ⇒ `[secret-encrypted-at-rest]`).
   `[no-real-order-path]` narrowing (read OK, no execution) formalizes at its GATE S as planned.
3. **`broker-option-grouping` — ✓ SHIPPED + ARCHIVED (2026-08-06)** → `_archive/broker-option-grouping/`.
   Full pipeline, single-lane (FE-only, `NO_BACKEND_CHANGE`, empty `apps/api` diff): GATE I → C (council
   R1–R3, 25 conflicts / 25 quotes verified / 0 technical unresolved / 2 owner rulings; R4 ×3, S2 ×2) →
   PLAN → FE ×3 phases → **Q FAIL → Z → Q PASS**. Final **49 PASS / 0 FAIL / 1 UNVERIFIABLE**
   (AC-1b owner-only); conformance backend PASS · QA PASS agreeing; dashboard **122 files / 1439 tests**
   (from 116/1291), e2e **41** (from 37), api 272 unchanged, lint 0/0, typecheck 0.
   **GATE S graduated TWO keys:** `structural-over-prose-enforcement` (4 features — held back three times
   for lacking a statable violation test; this ship supplied it) and `single-motion-moment` (2 binding —
   **crossed at redesign-stage-3 2026-07-22 and was missed at that GATE S**, surfaced by `ledger_tally`).
   **Two canon errors corrected at this ship:** the captured book is 14 holdings / 3 groups + 2 lone legs,
   not "13 positions / 4 verticals + 1 lone" (and TSLA's +10/−4/+4 makes the rejected pairing heuristic
   wrong on the owner's *actual* book today); and the rendered group nets are Convexa's composition
   (META 3,805.00 / NVDA 7,890.00), **not** Webull's raw `total_cost` (3,802.00 / 7,889.00) which the app
   never displays. Seams → OPEN_THREADS §7ab. *(original entry:)* **⏭ was NEXT — `broker-option-grouping`** (owner-chosen 2026-08-05, straight off the live verify).
   Collapse a ticker's option legs into ONE expandable row with the NETTED entry cost, and
   **never name the structure** — Webull supplies no strike/expiry/right, so the app cannot prove
   which legs pair; grouping by underlying is a FACT, calling it a vertical is a GUESS. Rejected
   alternatives (recorded so they aren't re-litigated): inferring spreads from matching qty +
   opposite side (works on today's book, silently merges the wrong legs the day two same-sized
   spreads exist on one ticker) and manual user pairing (never wrong, but manual forever).
   Upgrades automatically to real structures if a contract-detail lookup ever lands (see §7z's R7
   probe: `/trade/instrument` is LIVE but echoes — a parameter/entitlement question for Webull).
   **Invariant watch:** `absent-is-not-none` (a group is a count + a net, never an unearned label) ·
   `model-read-carries-its-assumptions` · `theme-token-discipline`. FE-only expected.
4. **`vol-normalized-gex` (X2) — ✓ SHIPPED IN CODE** (verified GATE I 2026-08-11; see
   `docs/research/X2_VOL_NORMALIZED_GEX_STATUS.md`). Math + wire + UI + methodology present; residual
   research/score-lab coupling only.
5. **`alerts` v1 (X3) — ✓ SHIPPED IN CODE** (IMPROVEMENT_BACKLOG 5.5, 2026-08-10; re-verified GATE I
   2026-08-11). In-app rules + browser Notification; webhook optional later.
6. **Ledger checkpoint (X4)** at N≥20 closed outcomes → first deliberate score change only if justified,
   under `[score-change-is-deliberate-and-measured]`. **Still the next edge-program gate once N is real.**
7. **`recent-ticker-chips` — ✓ SHIPPED + ARCHIVED 2026-08-11** → `_archive/recent-ticker-chips/`
   (GATE V + PLAN + FE; QA PASS 8/8; `NO_BACKEND_CHANGE`).
**Owner habits (not pipeline features, tracked in the roadmap):** N1 deploy (runbook, `ALLOWED_ORIGINS`) ·
N2 mirror every real trade · N4 daily public read on X — **DEFERRED by owner 2026-08-01 until personal
testing shakes out the quirks** (business-path gates slide with it; edge test unaffected).
**Displaced (not dropped):** `signed-out-refused-affordances` — it only matters when strangers use the
app; revisit at L4 (first external users). **Explicitly cut:** 0DTE arms race, breadth chasing, direct
broker APIs, real-time quote display to others, real order execution (invariant stands).
<!-- atlas: theme=trust-the-signal horizon=now -->
**Chosen → the redesign program (Q4 decided (a), full direction)** — owner-directed off the decision
queue, not a harvest cull. Evidence chain: `DESIGN_REVIEW_2026-07-22.md` (structural) →
`verification-2026-07-22/` (eyes-on, every hard-floor finding CONFIRMED: scrollWidth 580 vs 393, no
mobile nav, near-zero `:focus-visible`, 29 `<h6>` stat values, 9px deltas) →
`BRAND_TOKENS_PROPOSAL_2026-07-22.md` (the direction + §6a canon pre-flight rulings). **Four stages,
each its own GATE V program** (FE-only, `NO_BACKEND_CHANGE` throughout): **Stage 0** floor repair
(fold in `feat/responsive-layout` — needs rebase; focus rings; semantics; touch/type floors; copy
fixes) → **Stage 1** token swap (new palette/type into `tokens.ts`/`theme.ts` + theme-audit gaps +
blog re-skin via the GENERATOR) → **Stage 2** signature (mark, hero curve-draw, arc dividers; SEO
prerender re-derives AFTER) → **Stage 3** surface sweep (+ motion consolidation superseding the
stagger, tests REPLACED not deleted). **Rule-of-record for every lane: the `convexa-design` skill**
(+ frontend-design, web-design-guidelines, vercel-react-best-practices, composition-patterns,
webapp-testing per the owner's skill-stack directive). **Invariant watch:** theme-token-discipline
(the migration rail) · additive-keeps-score-byte-identical (presentation-only; empty `apps/api` diff
per stage) · live-vs-static-isolation (3 distinct degraded states survive the re-skin) ·
model-read-carries-its-assumptions + digested-labels (contract copy, not decor) ·
single-shared-sim-entry-dialog (restyle, never fork) · no-real-order-path (honest landing copy) ·
loss-free-durable-migration (if any durable pref key/shape moves). **Stage 3 (surface sweep) -> SHIPPED + ARCHIVED same day** (`0cd0901`; QA PASS 36/36; suite 73/606
the new baseline; motion set-equality pinned; the proximity-chip green-reservation latent fix) —
**PROGRAM COMPLETE: all 4 stages shipped 2026-07-22.** **Stage 2 (the signature) -> SHIPPED + ARCHIVED same day** (`51b9d7e`; QA PASS de-correlated Sonnet;
arc-in-exactly-3-places set-equality enforced; suite 69/563 the new baseline; QA also caught the
conductor's under-spec render pass - closed with Web-Animations-API draw proof). **Stage 1 (token swap) → ✓ SHIPPED + ARCHIVED same day** (`5846864`; QA PASS de-correlated Sonnet,
all 19 contrast ratios independently recomputed; suite 63/523 — the new baseline; blog-artwork residual
→ §7u seam). **Stage 0 → ✓ SHIPPED + ARCHIVED same day** (`35fef23`; QA PASS 6/6 + 15/15 de-correlated Sonnet;
393px 580→378 + drawer nav + focus rings + 0 h6 stat values + floors + honest copy; suite 58/493;
see OPEN_THREADS §7u). **NEXT in program: Stage 1** (token swap). **`scanner` displaced a 7th time —
owner-directed, never dropped** (system-12 doc reconciliation still precedes its eventual GATE U·X).

## Last GATE I — 2026-07-16 (CANON REVIEW: the score is frozen + unvalidated → `outcome-ledger`)
**Chosen → `outcome-ledger` — ✓ SHIPPED + ARCHIVED (2026-07-16)** → `_archive/outcome-ledger/`. Full
pipeline, **single-lane fan-out** (`NO_BACKEND_CHANGE` ⇒ no backend lane): GATE I → A·X → P·X → **Z×4** →
U·X → FE → **Q**. **QA PASS 46/46 ACs, 0 FAIL, 0 UNVERIFIABLE** (fresh de-correlated Sonnet, every gate
re-run independently; conductor cross-checked the AC coverage 1:1 against the contract and caught a `52`
arithmetic slip in the QA headline — corrected, coverage was always complete). `nx test dashboard`
**804/804** (674 baseline + 130) · `tsc -b --force` clean · lint 0 · `apps/api` diff **empty** (conductor-
and QA-verified). Conformance **n/a and correctly absent** (consumes **no endpoint** ⇒ no FE↔BE surface;
**system-12 does not bite this feature — it still lands on `scanner`**).
**GATE S tally: NO new graduations** — all 12 keys are already canon. `loss-free-durable-migration` **1→2**
· `model-read-carries-its-assumptions` **3→4** · `digested-labels-not-raw-dump` **2→3** ·
`score-change-is-deliberate-and-measured` **0→1** (its first instance, as the rule's *enabler*). New
watch-list key **`structural-over-prose-enforcement`** (1 instance, not promoted).
**The severity path validated itself:** `loss-free-durable-migration` was promoted **at 1 instance on
severity** this same day, over the objection that recurrence was unmet — and the very next feature became
its **2nd binding instance**, in the sharpest way possible (it had to **REFUSE an import** rather than let
the store APIs rewrite an unreadable blob). Under recurrence-only it would still have been on the watch
list *while the feature that needed it was being built*.
**The amendment loop fired 4× (A1/A2/A3/§11.6) + 2 UX copy rulings — every one a real defect, every one
raised by a DOWNSTREAM lane refusing to decide out of its own lane.** Sharpest: **A3** — the naive widen of
the close-bearing event set is *verifiably wrong* (`:342` gates the roll close on `rec.replacement_contract`,
so a **replacement-less Roll writes `accept` + `ai_verdict:'Roll'` WITHOUT closing**). Seams →
OPEN_THREADS §7t; the **`split-decision-log` live bug** stays open in §B. *(original cull entry:)*
Not a harvest-and-cull discovery — a **canon review** the owner requested
("are any invariants not well conceived? what am I missing?"), which surfaced a structural gap the ordinary
GATE-I sources could not: **the project compounds BUILD wisdom (`DECISION_LEDGER.md`) and has NO loop for
TRADING wisdom.** Owner agreed on every point and directed all of it.

**The finding (ground-truthed in code + git, not impression):** `_opportunity_score(dist, ivhv, setups,
near_flip)` + a capped dark-pool bonus is the app's entire headline judgment — it drives the tier, the Prime
banner, and `DEFAULT_GATE_SCORE = 50` (the gate deciding when the AI may speak). It was last substantively
changed at `d3aeb4f` on **2026-06-22 — 210 commits ago**. Since then **eight** enrichment features shipped
(dex/vol-oi/skew/term · dealer-flow-projection · ai-context-pack · iv-rank · ATR) and **not one can reach
it** — every one was routed around the score into the LLM prompt. Sharpest instance: the score rewards vol
*extremity* via `abs(IV/HV − 1.0)`, so **rich and cheap premium score identically**, while `iv_rank.band`
(`premium_rich|premium_cheap`) — the metric we shipped *because* it "drives strategy selection" — sits in the
payload structurally unable to inform it. The weights (`40/25/25/10`, `8.0`/setup) and the gate threshold are
hand-tuned constants **never validated against a single outcome**. `additive-keeps-score-byte-identical` was
well-conceived for its job (stop *accidental* drift) but, lacking a counterpart, hardened into a **de-facto
freeze**.

**Canon changes made this review (see DECISION_LEDGER):**
1. **NEW `score-change-is-deliberate-and-measured`** (owner canon review) — the score MAY evolve, but only
   deliberately: explicit feature + stated rationale + **before/after on real tickers** + fingerprint-basis
   version bump. Never a side effect; never unmeasured. Fills the gap; does not weaken the additive rule.
2. **NEW severity promotion path** — recurrence is a *proxy* for importance and was mis-ranking: it had made
   a **dialog** constitutional law at 2 instances while `loss-free-durable-migration` waited at 1, guarding
   the user's entire trading history. A catastrophic+irreversible key now promotes at 1 (or 0 by owner
   decision). ⚠ Framework divergence logged — `ORCHESTRATOR.md` is a kit file; flows back via KIT_BACKLOG.
3. **PROMOTED `loss-free-durable-migration`** via that path (severity, 1 instance).
4. **NARROWED `single-shared-sim-entry-dialog` → SIM-ONLY** — un-narrowed it was on a collision course with
   `no-real-order-path`: the README literally said "the ONE shared **sim/live** entry surface", which would
   have pushed `broker-connect`'s real-money entry into the paper-trade dialog as an "additive variant".
   Real entry MUST be a separate component. README corrected; no code change (broker-connect is unbuilt —
   which is exactly why this was free to fix now).
5. **PROPOSED `ai-asserted-numbers-are-traceable`** (watch list, **0 instances — deliberately not promoted**;
   an aspirational rule is not canon).

**Decision impact (the cull):** passes strongly — it improves the meta-decision conditioning every other
decision (*which of our own signals deserve trust*), and it is the **only honest input** to (1) above: you
cannot improve a score you cannot measure. Feasibility **pass with 3 architect cruxes** (storage locus /
capture extension / small-sample honesty) — see the BRIEF; "by tier" is **retroactively analyzable on
existing data** (`DecisionRecord.tier` is already recorded), while by-score/setup/persona needs accumulation
(the iv-rank shape). Effort **L** · entry = **architect-first**.
**Displaces `scanner` a 6th time — deliberate + reversible:** scanner scales an unmeasured judgment across N
tickers; this measures whether it is worth scaling. `scanner` keeps its BRIEF + manifest, stays queued, **not
dropped**. Brief at `.spire/clusters/tech/contracts/outcome-ledger/BRIEF.md`; routing to the Architect (GATE A·X).

## Last GATE I — 2026-07-06 (b) (owner pick: iv-rank; market-backdrop parked blocked-on plan upgrade)
**Chosen → `iv-rank` — ✓ SHIPPED + ARCHIVED (2026-07-07)** → `_archive/iv-rank/`. Full pipeline both lanes
(architect → PM → UX split → parallel lanes → GATE Q); QA PASS 19/19 (de-correlated Sonnet); conformance new
standalone spec `iv_rank.json` (live + offline); `nx test dashboard` 685/685. **GRADUATED
`digested-labels-not-raw-dump`** (2 binding: ai-context-pack + iv-rank's rich/cheap band); `model-read-carries-
its-assumptions` → 3rd instance. Established the project's **first persistent market-data store**
(`apps/api/src/marketdata/`: on-disk-SQLite default `IV_STORE=disk` + Postgres prod adapter behind the same
port). Score/tier/fp byte-identical (SPY 83/prime/`0e8884cc0a03`). Seams → OPEN_THREADS §7r. No GATE Z bounce
(clean first-pass builds). *(original cull entry:)* **Chosen → `iv-rank`** (IV Rank / IV Percentile) — owner
pick off the enrichment pool after `ai-context-pack` shipped. THE options metric the app lacks; drives **strategy selection** (rich→sell /
cheap→buy premium). Rides `market_state` as additive AI-context + a Ticker display, **never a scoring
input**. **The crux (architect-first):** the vendor provides **no historical IV**, so IV Rank's compelling
form is **blocked-on accumulation** — the feature must **accumulate a daily IV sample into a persistent
store** and rank over the accumulated window, with an honest "building history" state until enough days.
Architect must resolve: what IV to sample (existing `atm_iv` vs constant-maturity ~30d), the accumulation
mechanism (write-through-on-serve w/ a once-per-session guard vs a job; no backfill possible), the
**storage** (a NEW market-data time-series store/port — NOT the `src/auth/` leaf — with an in-memory/SQLite
default for local + Postgres for prod behind the same port; **dev box has no local Postgres**, so build+verify
on the non-Postgres default), and rank-vs-percentile + window + minimum-sample floor. Effort **M–L** ·
Value **H**. **Invariant watch:** `additive-keeps-score-byte-identical` (HARD), `best-effort-isolated-or-
null` (store outage / insufficient history → null/"building", never an HTTP error; writes best-effort),
`live-vs-static-isolation` (STATIC daily read), `theme-token-discipline`, **`model-read-carries-its-
assumptions`** (now promoted — the rank carries its window / sample-size / IV-basis visibly),
`digested-labels-not-raw-dump` (rich/cheap band = a digested label). First **persistent market-data** store
(distinct from the auth state store) — architect states its relation to the "stateless trading path"
narrowing. Entry = **architect-first**. Brief at `.spire/clusters/tech/contracts/iv-rank/BRIEF.md`; routing to the
Architect (GATE A·X).

**`market-backdrop` → PARKED, blocked-on a Massive plan upgrade (feasibility RESOLVED 2026-07-06).** The
GATE-I vendor probe found the account is **`NOT_AUTHORIZED` for ALL index data** (`I:VIX`/`I:VIX9D`/`I:VIX3M`/
`I:SPX`/`I:NDX` → "upgrade your plan"); equity ETF snapshots (SPY/QQQ) + options chains ARE in-tier. So the
CBOE-VIX-+-SPX form is blocked-on a plan upgrade. **Reshape available (owner-deferred, not chosen now):** a
SPY/QQQ ETF proxy + SPY options-derived ATM-IV level & IV term-structure regime (via the existing
`compute_term_structure`/`compute_iv_skew`) delivers the same "calm-contango vs stressed-backwardated tape"
read fully in-tier. Owner chose iv-rank first; market-backdrop stays queued (build the reshape, or wait for
the index-data plan upgrade to get the real VIX). Do NOT re-probe — the entitlement result is recorded here.

## Last GATE I — 2026-07-06 (owner pick: TI regime bundle + AI context-scalars pack, bundled)
**Chosen → `ai-context-pack` — ✓ SHIPPED + ARCHIVED (2026-07-06)** → `_archive/ai-context-pack/`. Full
pipeline both lanes; QA PASS 26/26 (de-correlated Sonnet); conformance new spec + 8-spec sweep; `nx test
dashboard` 658/658. GRADUATED `model-read-carries-its-assumptions` (2 binding); new watch-list
`digested-labels-not-raw-dump`. Both lanes were cut off by an API session limit before self-reporting →
conductor re-ran the gates + fixed 3 FE test-only defects (`?raw` idiom / 20→23 count / over-broad auth
regex) + cleaned a stale `libs/api/dist`. Latent seam → OPEN_THREADS §7q. *(original cull entry:)*
Owner-directed pick off the standing 2026-07-02 AI-enrichment pool
(no fresh harvest needed; the pool's cull verdicts stand). **Bundles the two parked S-effort items**
— the **AI context-scalars pack** (GEX shape scalars · flow-vs-positioning divergence · multi-horizon
ATR) + the **technical-indicator regime bundle** (EMA stack + ADX + RSI → DIGESTED regime labels) —
into one feature, exactly the "later AI context pack" fold the 2026-07-02 verdict anticipated. Same
shape throughout: derive from data already in hand (daily bars / the computed GEX profile / existing
flow+OI) → additive nullable `market_state` fields → AI state-export CONTEXT + Ticker display, never
a scoring input. *Decision improved:* entry/exit confluence (trend-vs-chop conditions the
mean-reversion read) + realistic ATR-based stop/target sizing + conviction on flow-vs-positioning
disagreement; observed when the AI rec cites regime/ATR/shape/divergence and the labels render on the
ticker page. Feasibility **pass** — one named architect constraint: daily-bar history is ~60d
(CONTEXT §4), so the EMA stack must fit the window or the daily-bars fetch extends (a parameter
decision, not a new vendor dependency). Effort **S–M** (bundled) · Value **M–H** combined.
**Invariant watch:** `additive-keeps-score-byte-identical` (HARD), `best-effort-isolated-or-null`,
`live-vs-static-isolation` (the divergence read must declare its flow basis),
`theme-token-discipline`, `model-read-carries-its-assumptions` (candidate), the binding
**digested-labels-not-raw-dump** design rule (SMALL orthogonal set, labels not raw values, OUT of the
score), `gamma-sourcing-split` NOT touched. ATR is also the enabler for the deferred distance-to-level
tiles (§B Ticker UX quick wins — stays out of scope here, seam only). Entry = **architect-first**.
Brief at `.spire/clusters/tech/contracts/ai-context-pack/BRIEF.md`; routing to the Architect (GATE A·X).
`iv-rank` / `market-backdrop` / `scanner` stay queued (displaced, not dropped).

## Last GATE I — 2026-07-02 (owner: enrich the downstream-AI's inputs — derived data, TIs)
**Chosen → `dealer-flow-projection`** (charm/vanna projected dealer hedging flow). Owner-directed
discovery off the "what other derived data helps the AI?" conversation. Harvest source =
**downstream-AI quality** (a first-class feature source). All candidates share one binding frame:
they enrich the AI's **state export + display as CONTEXT**, never a scoring input
(`additive-keeps-score-byte-identical`) — the AI is an advisory consumer of already-computed state.

**Scored pool (Value × Effort; explicit cull verdicts for later audit — the conductor holds both the
choose + route pens, so verdicts are written down):**
- **`dealer-flow-projection` (charm/vanna flow) — ✓ SHIPPED + ARCHIVED (2026-07-02, `ca6abae`).** Full
  pipeline both lanes; QA PASS 17/17 (Sonnet); folded in the BACKLOG §B determinism fix; render-pass catch
  fixed inline. Seams → OPEN_THREADS §7o. *(original cull entry:)* Turns the net charm + net vanna we
  ALREADY compute (currently display-only, CONTEXT §3) into a forward-looking, assumption-explicit
  "expected dealer hedging flow into the next OPEX / on a vol move" read. *Decision improved:*
  entry/exit TIMING + conviction around dealer-flow catalysts (OPEX charm bleed, vanna-on-vol) —
  distinct from the static GEX levels (where price is pulled); this is WHEN/WHY dealers push.
  *Observed:* the AI cites "charm flow supports drift into Friday's OPEX"; a projected-flow read shows
  on the ticker page. Value **H** · Effort **M** · data risk **low** (reuses computed greeks; no new
  vendor dependency). Most on-brand + lowest-risk of the pool → picked first.
- **`iv-rank` (IV Rank / IV Percentile) — QUEUED (runner-up).** THE options metric we lack; drives
  strategy selection (long vs short premium). Value **H** but the compelling 52-week form is
  **blocked-on IV-history**: we don't persist IV. Options — accumulate IV daily into the now-shipped
  Postgres store (rank improves over time), OR a weak 60d-window percentile now (likely re-done). A
  data-accumulation design, not a rush → sequenced right after / bundled with a small persistence step.
- **`market-backdrop` (SPY/QQQ + VIX level & term structure) — QUEUED, feasibility-gated.** Conditions
  EVERY read (calm-contango vs stressed-backwardated tape). Value **H** · Effort **S–M** · **blocked-on
  verifying Massive index/VIX coverage** (a vendor-capability check; one extra fetch if present).
- **AI context-scalars pack (GEX shape scalars · flow-vs-positioning divergence · multi-horizon ATR)
  — PARKED as a cheap bundle.** Each Value **M** · Effort **S**; ATR also unblocks the deferred
  distance-to-level tiles (an enabler, not a standalone). Fold into a later "AI context pack."
- **Volume profile (POC / value area) + CVD — PARKED.** Non-gamma horizontal S/R = independent
  confluence + an order-flow read from the tape we already consume. Value **M–H** · Effort **M–L**.
- **Technical-indicator regime bundle (EMA stack + ADX + RSI → DIGESTED labels) — PARKED (confluence
  tier).** Owner-framed correctly as confluence, not the edge. Value **M** · Effort **S** (all from
  bars we pull). Binding design rule if built: a SMALL orthogonal set, pre-digested into regime labels
  (not raw values), kept OUT of the score — else signal overload degrades the AI.
- **News / sentiment — PARKED (owner: future).** Slots in as another isolated one-way-leaf context
  stream, same "context not score" discipline; sentiment scoring likely a separate provider/classifier.

**Cull rationale (why `dealer-flow-projection` over the owner's co-favourite `iv-rank`):** both are
Value-H; charm/vanna is **buildable now, lowest data/math risk, reuses computation in hand, and is the
most differentiated** (no retail tool surfaces dealer charm/vanna flow) — while IV Rank's compelling
form is blocked on an IV-history strategy that deserves deliberate sequencing, not a rushed weak
version. So: charm/vanna first, IV Rank next (with the persistence step). **Invariant watch** (see the
BRIEF): `additive-keeps-score-byte-identical` (HARD — AI-context/display only), `best-effort-isolated-
or-null`, `live-vs-static-isolation`; **`gamma-sourcing-split` NOT touched** (a new derived read over
the analytic greeks we already run — does NOT reopen the walls/flip gamma source). Ties BACKLOG §B
"Engine higher-order-greek determinism" (elevating net_charm/net_vanna is the pull to fix the float
jitter). Entry = **architect-first**. Brief at `.spire/clusters/tech/contracts/dealer-flow-projection/BRIEF.md`;
routing to the Architect (GATE A·X). **Note:** `scanner` (the prior NEXT) is **displaced, not dropped**
— queued behind this owner redirect, as it was behind the 2026-06-25 ticker-load redirect.

## Last GATE I — 2026-07-01 (OWNER DIRECTIVE: 5-item product program)
Owner handed the conductor five sequenced items (screenshots of broken light-mode attached to the ask):
1. **`light-mode-parity`** — ✓ SHIPPED same session (`8abae03`, GATE V fast-path): mode-aware `extras`
   (`extrasFor(theme)`), ONE shared hatch, mode-aware ticker chrome; dark byte-identical; render-verified
   both modes; 486/486 + tsc/lint/build green.
2+3. **`sim-entry-unification`** — ✓ SHIPPED + ARCHIVED (2026-07-01, `d704193`) →
   `_archive/sim-entry-unification/`: one shared `app/trading/TradeEntryDialog` on both pages; old
   dialogs + `GhostTradePanel` deleted (zero-importer proven); `app/README.md` map. Conductor gates +
   render pass green. **GATE S graduated `single-shared-sim-entry-dialog`** (with item 4's variant).
4. **`ai-rec-backtest-orders`** — ✓ SHIPPED + ARCHIVED (2026-07-02, `5391517`) →
   `_archive/ai-rec-backtest-orders/`. Full pipeline, both lanes in parallel: the scripted scenario
   harness (`src/core/ai_scenarios.py`, 9-entry registry behind the `LLMProvider` seam,
   `AI_REC_SCENARIOS_ENABLED` default OFF, keyless + meter-bypassing, auth/readiness-gate real) +
   FE-local simulated orders (`convexa.orders.v1`, pure live-cross engine on the NBBO mid, Orders
   widget/panel on both pages, Act via the order variant of the shared dialog, rec→order→position
   provenance + decision records). Score/tier/fp byte-identical. QA PASS 48/48 (de-correlated Sonnet);
   +103 tests → 595. **SUBSUMED** the §B "AI-rec Accept → tracked position" item. One post-QA render
   catch fixed inline + guarded (keyless-deployment scenario run). Seams → OPEN_THREADS §7n.
5. **`scanner`** — **✓ SHIPPED + ARCHIVED (2026-07-26)** → `_archive/scanner/`. Full pipeline, both lanes,
   delivered as **4 sequenced phases each with its own execution contract + GATE Q** (P1 store `7269fa2` ·
   P2 worker `9d92fed` · P3 read API `eb478df` · P4 page `e094bd1`). **QA PASS all four (de-correlated
   Sonnet) — 13/13 ACs, 0 FAIL, 0 UNVERIFIABLE**; `nx test @convexa/dashboard` 645; e2e 15/15; conformance 2/2
   live. **GATE S formally NARROWED "single-ticker, on-demand"** (request path stays single-ticker; the
   sweep is the bounded off-request-path worker) — descriptive narrowing, not a demotion. **No new ledger
   graduations** (all 8 touched keys already canon); `structural-over-prose-enforcement` → 2 instances,
   held on the watch list. v1 ships **NO AI** (v2 seam). Seams → OPEN_THREADS §7v. *(original entry:)*
   Promotes the long-queued Track-A item
  <!-- atlas: theme=breadth horizon=now -->
   WITH the owner's expanded scope: durable custom watchlist, simplified per-ticker read (score/tier),
   AI-seeded watchlists, multiple views, ticker-page links, batch AI recs on all/selected. **Invariant
   watch:** revisits the locked "single-ticker, on-demand" decision — the architect must re-justify
   with a perf design (batch/throttle/cache; the ticker-load-experience chain-store + coalescing are
   the building blocks); AI batch respects the existing cooldown/cap + key-resolution.
   Brief at `.spire/clusters/tech/contracts/scanner/BRIEF.md`.

## Last GATE I — 2026-06-29 (infra program, step 2: persistent datastore)
**Chosen → `persistent-db`** (step 2 of the infra/deploy program). Swap the in-memory SQLite auth stores
for **persistent Postgres** behind the existing ports (`UserStore`/`SessionStore`/`UserSettingsStore`/
`UserCredentialStore`) so accounts/sessions/settings/encrypted-AI-keys **survive restarts + span replicas**
— the must-do-before-deploy step (the §4 "externalize your state" lesson). New adapter selected by the
existing env factory (`ACCOUNT_STORE=postgres` + `DATABASE_URL`); in-memory stays the local/test default.
Decision-impact cull **N/A** (deploy-readiness). Feasibility **pass to BUILD** — the ports + env-factory
already exist (provider pattern), so it's a contained adapter + schema/migrations; **runtime-verify needs a
Postgres instance** (dev box has none) → deferred like Docker. Effort **L** · entry = **architect-first**
(adapter shape raw-SQL-vs-ORM + async/sync, schema + migrations, pooling, the **DB-outage fail mode** — auth
fails closed, trader/bundle path stays up, the best-effort carve-out, ciphertext-only AI-key boundary).
**Invariant watch:** `additive-keeps-score-byte-identical` (storage-only, trading path untouched),
`best-effort-isolated-or-null` (DB outage degrades auth, not the anonymous bundle/SSE), `secret-encrypted-at-
rest` (ciphertext-only in the DB), `no-secrets-in-image` (`DATABASE_URL` via runtime env). No interface/UI/
scoring change. **Recommended target: Postgres** (deploy-ready; SQLite-file is a single-instance dead-end).
Brief at `.spire/clusters/tech/contracts/persistent-db/BRIEF.md`; routing to the Architect (GATE A·X). **Then:** `deploy`
→ Security/red-team (system-6) at go-live.

**HOST DECISION (owner, 2026-06-29) — scopes the `deploy` feature:** backend → **Railway** (container +
managed Postgres → `DATABASE_URL`; long-running/SSE; runtime env for all secrets); frontend → **Cloudflare
Pages** (static Vite build; generous/commercial-OK, no egress fees). This is a **SPLIT-host** deploy, so the
`deploy` feature must wire the **cross-origin `/api`**: the Cloudflare-served SPA calls the Railway backend
on a different origin → either **CORS** on FastAPI (allow the Pages origin) OR a **Cloudflare Pages proxy/
rewrite** of `/api/*` → the Railway URL (preferred — keeps same-origin + no CORS), plus the frontend build
needs the backend base URL (build-time env / rewrite). Note: the shipped `apps/dashboard/Dockerfile` +
nginx-proxy is now the **local-`docker compose` + optional single-host** path; for the Cloudflare path,
Pages builds the static output directly (the container isn't used). All deferred to the `deploy` feature.

## Last GATE I — 2026-06-29 (owner request: infrastructure — containerize, then deploy)
**Chosen → `containerize-apps`** (step 1 of the infra/deploy program) — owner-directed. Author Docker
artifacts: a `Dockerfile` for the FastAPI backend (non-root, env-injected config) + a multi-stage
`Dockerfile` for the dashboard (Nx/Vite build → static-serve) + a root `docker-compose.yml` (one-command
local full-stack) + `.dockerignore`s. Promotes the standing §B "Containerize each app" candidate. Decision-
impact cull **N/A** (deploy-readiness/infra). Feasibility **pass to AUTHOR** — **Docker is NOT installed
here**, so artifacts are written correct-by-construction + reviewed; runtime build-verify (`docker build`/
`compose up`) is **deferred to a Docker Desktop install** (owner). Effort **M** · entry = **architect-first,
GATE-M-style infra fast-path** (skip PM/UX, no interface change). **Invariant watch:** additive/no app
change; **image-hygiene floor** (no secrets baked — `.dockerignore` excludes `.env`/`.venv`/`token.txt`/
`node_modules`/`data/`; env at runtime; non-root). **Known follow-on:** in-memory state resets per container
→ the `persistent-db` swap is the NEXT feature; deploy + host-pick follow that. Brief at
`.spire/clusters/tech/contracts/containerize-apps/BRIEF.md`; routing to the Architect (GATE A·X).
**Program sequence:** `containerize-apps` → `persistent-db` (in-memory → managed Postgres behind the
existing store ports; set a stable `AI_KEY_ENCRYPTION_KEY`) → `deploy` (host pick: backend on Railway/Fly,
frontend on Cloudflare/Vercel, Postgres on Neon; CI/CD) → **activate Security/red-team (system-6)** at
go-live.

## Last GATE I — 2026-06-28 (owner request: hybrid bring-your-own AI key)
**Chosen → `byo-ai-key`** — owner-directed. **Hybrid** AI-key model: each signed-in user stores their own
Anthropic key (encrypted at rest) and the in-app AI rec calls with THEIR key; the shared `ANTHROPIC_API_KEY`
gives a free allowance **only to ADMIN users (3/day) — regular users get 0** (must BYO). Introduces a
**minimal admin concept** (no roles today) + **per-user metering** (today's cap is process-global) + **4
distinct gated states** (no-key-no-allowance / admin-with-uses-left / admin-exhausted / has-own-key).
Decision-impact cull **N/A** (enabler/cost-control — serve AI to many users without the owner bearing
per-user LLM cost). Feasibility **pass** (builds on the isolated `ai_recommendation.py` `LLMProvider` seam +
the shipped accounts system + a new encrypted `UserCredentialStore`; realizes the deferred BYO-key seam,
THREADS §7b). Effort **L** · entry = **architect-first** (per-request key-resolution seam, encryption-at-rest
seam + write-only/masked-reveal, admin mechanism, per-identity metering, the 4-state machine). **Invariant
watch:** `additive-keeps-score-byte-identical` (AI rec stays an isolated leaf), `best-effort-isolated-or-null`
(key/decrypt/LLM/over-limit failure → rec-surface-only `status`, never breaks bundle), `no-real-order-path`,
**security floor** (user keys ENCRYPTED not hashed — recoverable; server-side encryption key; never
logged/returned/in-browser; masked-reveal + rotate + delete), new `minimal-admin-not-RBAC`. **system-6
(Security/red-team) DEFERRED** by owner (encrypt+hygiene now); re-fires at the persistent/multi-user/public
trigger — BYO-key is its eventual first client. Brief at `.spire/clusters/tech/contracts/byo-ai-key/BRIEF.md`; routing to
the Architect (GATE A·X).

## Last GATE I — 2026-06-28 (owner request: complete the Convexa rebrand)
**Chosen → `rebrand-convexa`** — owner-directed. Extend the rebrand from **UI-only to the whole codebase**:
rename ~71 `gammaflow` refs (apps/api comments/log-prefixes/title, apps/dashboard, libs/api incl. the
`gammaflow.ts` client + identifiers, docs, CLAUDE.md/AGENTS.md) → Convexa/convexa, set `project.json`
`project_name`, rename the GitHub repo `gammaflow → convexa`, and **migrate the 4 durable localStorage keys**
(`gammaflow.{positions.v2,ghost-trade.v1,personas.v1,uiprefs.v1}`) → `convexa.*` **loss-free**. **REVERSES
the locked "Convexa = UI-only" decision** (app-shell-landing GATE S; CONTEXT §1/§5, THREADS §7d) — a
deliberate owner GATE-Z reversal, formalized in canon at this feature's GATE S. Decision-impact cull **N/A**
(brand/infra class). Feasibility **pass** (no package renames — scope is `@org/*`; repo rename = `gh repo
rename` w/ redirect; storage migration reuses the proven positions v1→v2 pattern; backend refs look
cosmetic/no-interface-change). Effort **M** · entry = **architect-first** (rename map, the loss-free
migration seam, NO_BACKEND_CHANGE confirmation, non-goals — local working-folder NOT renamed; archived
contracts/ledger keep historical "GammaFlow" as record). **Invariant watch:** `[loss-free durable
migration]` (HARD — no saved data lost), `additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`.
Brief at `.spire/clusters/tech/contracts/rebrand-convexa/BRIEF.md`; routing to the Architect (GATE A·X).

## Last GATE I — 2026-06-25 (owner request: user accounts / login / sessions / settings)
**Chosen → `user-accounts`** — owner-directed (not a queue-drain cull): add **email/username+password
signup & login + "Continue with Google" (OAuth) + a persisted server-side session**, backed by an
**in-memory SQLite** credential/settings store (prototype — resets on restart; designed with a
persistent-DB swap seam). Store **per-user settings — basics + light prefs only** (active persona /
default ticker / theme). **Hybrid access model (owner clarification):** the app stays usable
anonymously for browsing (Landing / Ticker-GEX viewer / Scanner stub), but **the sim Positions tracker
+ the in-app AI-rec "ask AI" call require a signed-in session.** Passwords **hashed (bcrypt/argon2),
never plaintext/never logged**; Google client secret + session key **server-side only** (env, like
`ANTHROPIC_API_KEY`). Decision-impact cull: **N/A** (enabler/infra class — judged on product value:
unlocks per-user persistence + gating + the **Track B `broker-connect` prerequisite**). Feasibility:
**pass**, config-gated for Google (needs a Google Cloud OAuth client; new backend deps → `requirements.txt`
+ `.venv`). Effort **L** · entry = **architect-first** (session mechanism, in-memory-SQLite + swap seam,
OAuth Authorization-Code flow, auth↔bundle isolation + auth's own real-HTTP-error class, per-user settings
store, the gated-surface enforcement boundary). **Invariant watch:** `additive-keeps-score-byte-identical`
(auth never touches scoring/SSE; no setting is a scoring input), `best-effort-isolated-or-null` (CARVE-OUT:
bundle path stays best-effort/None; **auth endpoints legitimately return 401/403/409** — the null-not-error
rule governs added *bundle computations*, not an auth surface), `no-real-order-path` (HONORED — accounts add
no broker/order path; Positions stays `SIMULATED`), `operator-vs-trader-path-separation` (kinship: auth must
not gate/perturb the anonymous trader path). **NEW note:** first stateful backend surface + first credential
store → narrows the "stateless server" property to the *trading path*; likely a GATE S ledger note, not a
GATE Z reversal. **Security:** red-team (**system-6**) DEFERRED by owner (in-memory = pre-live); re-activates
on real persistence / public exposure — the hygiene floor above is mandatory regardless. Brief at
`.spire/clusters/tech/contracts/user-accounts/BRIEF.md`; routing to the Architect (GATE A·X). *(Note: `scanner` +
`gamma-unification` stay queued behind this owner redirect — not dropped.)*

## Last GATE I — 2026-06-25 (owner request: ticker-page load UX + latency; gamma question raised)
**Chosen → `ticker-load-experience`** — owner-directed redirect (displaces `scanner` as the next Track-A
item; scanner stays queued, not dropped). Make `/ticker/:symbol` load fast + feel instant + show a trusted
price. Three additive moves: (1) **skeleton-first load** (replace the single full-page spinner —
`TickerDashboard.tsx:497,512` — with per-component skeletons that render independently); (2) **latency**
— parallelize the 3–4 **sequential** vendor fetches (`main.py:261-267` + `off_exchange`; vendor I/O is the
dominant cold-miss cost) + trim on-path `persist`, measured against `/_ops/metrics` p50/p95; (3) **live
last-trade** readout alongside the mid (surface `live.py:160`'s already-tracked `last_trade_price`, never
broadcast today) + reflect the **real-time options tier** in freshness/cache config. Decision-impact cull:
passes (speed + trust of the primary surface; observable via TTFMP + a measured `vendor_fetch` drop + a
visible broker-matching last-trade). Feasibility pass (skeletons = MUI; parallelize = `asyncio.gather` over
existing `to_thread`; last-trade = surface one field; config = env — magnitude needs a live key, the
architecture doesn't). Effort M · entry = **architect-first** (skeleton-vs-split [split is a trap w/o
request-coalescing — `_serve` has no in-flight dedup], fetch-parallelization shape, last-trade as a
display-only sibling of the mid). **Invariant watch:** `additive-keeps-score-byte-identical`,
`best-effort-isolated-or-null`, `live-vs-static-isolation`; **`live-spot=NBBO-mid` HONORED** (last-trade is
additive display — mid stays the levels anchor; carve-out, not a reversal); **`gamma-sourcing-split` NOT
touched** (→ Track 2). Brief at `.spire/clusters/tech/contracts/ticker-load-experience/BRIEF.md`; routing to the
Architect (GATE A·X).

**New parked track → `gamma-unification` (measure-first; see §C below).** Owner asked: with the advanced
real-time tier + full chain, compute our OWN analytic gamma for the walls so they're consistent with the
flip. Finding: the engine **already** computes analytic BS gamma (`engine.py:_calc_gamma`/`_gex_curve`) for
the flip + vanna/charm/volga; only the walls/net-GEX use **vendor** gamma (`engine.py:316`). Unifying =
point the walls at the math we already run. **Owner decision (2026-06-25): MEASURE FIRST** — spike that
computes analytic gamma alongside vendor gamma and quantifies wall/flip divergence on real tickers, BEFORE
any canon change. Honors the standing "measure the divergence before calibrating" rule (§9). Only after the
numbers: a GATE Z reopen/demotion of the locked **`gamma-sourcing-split`** rule, then a GATE M
implementation. Not bundled into `ticker-load-experience` (different risk class — core math).

## Last GATE I — 2026-06-24 (OWNER PIVOT: positions-centric, brokerage-connected, multi-page) — PROGRAM
**Strategic repositioning.** GammaFlow shifts from a single-ticker GEX dashboard into a **multi-page
product**: connect your brokerage positions → get **AI recommendations** built on the GEX profile +
heuristics we compute per ticker. Surfaces: a **landing/splash** page (brand/hooks), a **Ticker viewer**
(today's GEX dashboard, relocated), a **Scanner** (multi-ticker), and a **Positions** page (the shipped
sim portfolio, expanded, + AI-recs-on-positions + open-sim-trade), eventually fed by **real broker
positions**.

**Owner decisions (this GATE I):**
1. **Order boundary — narrowed, not full.** Connect a broker to **read real positions** (+ AI recs on
   them); **trades stay simulated — no real order execution.** This **narrows the promoted
   `no-real-order-path` canon** to "no real order *execution*" (reading real positions is now permitted).
   *Pending formal demotion at the broker feature's GATE S* (precedent: `ai-external-no-llm`); Track A does
   NOT exercise it (stays fully simulated/sim-only).
2. **Broker integration — direct per-broker, Webull first** (not an aggregator). Feasibility-gated:
   Webull third-party positions access is uncertain/region-gated → the broker feature is **blocked-on**
   verifying Webull API access; design a **`PositionsProvider` port** (mirroring the market-data provider
   port) so the broker is a contained adapter.
3. **Sequence — Track A first.**

**Security / going-live (system-6 activation):** connecting a real account is the **"going live" trigger**
the roadmap waited for → re-promote the deferred **Security/red-team role (system-6)** + first-class
credential handling when **Track B** starts. Track A (no real account) does not trigger it.

**Decomposition (groom + run ONE at a time through the pipeline):**
- **Track A — buildable now, NO broker, mostly FE:**
  - `app-shell-landing` ← **CHOSEN FIRST**: multi-page routing shell + nav/layout + **landing/splash**
    page; relocate the existing GEX dashboard → `/ticker` and the positions portfolio → `/positions`
    unchanged; `/scanner` nav stub. FE-only restructure + one new page; reuses every shipped feature.
  - `scanner`: multi-ticker scan page. **Invariant watch:** revisits the locked "single-ticker,
    on-demand" decision (the watchlist scan was dropped for being too slow) — must re-justify + design for
    perf (batch/throttle/cache). Promotes the parked §D multi-ticker-scanner item.
  - `positions-page-expansion`: expand the sim portfolio into the full Positions page + **AI recs on
    positions** (reuse `ai-recommendations` + the deferred position-aware `reassessment_prompt` seam) +
    open-sim-trade.
- **Track B — gated on decisions 2 + security:**
  - `broker-connect`: Webull-direct, **read-only** real positions via the `PositionsProvider` port; lands
    in the shipped positions "Live" tab seam; triggers the `no-real-order-path` narrowing + system-6.

Brief for the chosen first feature at `.spire/clusters/tech/contracts/app-shell-landing/BRIEF.md`; routing to the
Architect (GATE A·X).

## Last GATE I — 2026-06-24 (owner request: positions portfolio)
**Chosen → `positions-portfolio`** — owner-directed: evolve the shipped ghost-trade tracker from a single
open sim position into a **multi-position portfolio** — a central all-positions view + per-ticker filtered
view, each position tracking its own P/L **and the change in it**, modern/organized/customizable
(columns/sort/filter, grouping, layout+density, durable saved views). Two view tabs: **Simulated**
(functional paper-sim) and **Live** (a present-but-**LOCKED** real-broker placeholder — no broker, no
order path, reflected in the UI but not implemented). Options contracts; the simulator fills at a
user-input price OR via market/limit on the live price. Decision-impact cull: passes (improves
hold/trim/exit position management). Feasibility pass (reuses mark/store/`TradeEntryDialog`/`GET
/api/contract`; Live is a stub ⇒ no vendor dependency). Effort L · entry = architect-first. **Invariant
watch:** `no-real-order-path` HONORED (Live is non-functional, no order path), `additive-keeps-score-
byte-identical`, `best-effort-isolated-or-null`, `live-vs-static-isolation`. Brief at
`.spire/clusters/tech/contracts/positions-portfolio/BRIEF.md`; routing to the Architect (GATE A·X).

## Last GATE I — 2026-06-23 (owner request: in-app AI recommendations)
**Chosen → `ai-recommendations`** — owner-directed (not a queue-drain cull): an in-app query to a
downstream LLM (latest Claude) for a **risk-first ENTRY recommendation**, fed the active persona's
assembled prompt + a **JSON export of the ticker's computed state**, rendered in the dashboard; the
manual hand-off is retained + augmented by the same JSON export; on-demand with `ai_eval` guardrails.
**Reverses promoted canon `ai-external-no-llm` by explicit owner decision** (GammaFlow may now call an
LLM via an isolated, gated, consumer-only path) → pending formal demotion at GATE S. Trading-decision
cull: passes (improves the entry decision). Effort L · entry = architect-first. Brief at
`.spire/clusters/tech/contracts/ai-recommendations/BRIEF.md`; routed to the Architect (GATE A·X).

## Last GATE I — 2026-06-23 (pull: local latency visualization)
**Chosen → `latency-visualizer`** — carve the *visualization* slice out of §D "Observability
extensions," pulled by a concrete need (watch the already-measured bundle-stage latency locally +
free, pre-live). Brief at `.spire/clusters/tech/contracts/latency-visualizer/BRIEF.md`; entry = architect-first
(stateless-client vs persisted-history is the pivotal call). Trading-decision cull N/A (operator
tooling — judged on operational value). The export/alerting/persistence rest of §D stays parked.

## Last GATE I — 2026-06-22 (pipeline had drained; 4 features archived)
> [discovery: 12 lines elided — closed history; read context/BACKLOG.md for the full section, or memory_query]
## Pool
> [discovery: 1355 lines elided — over the discovery byte budget; read context/BACKLOG.md for the full section, or memory_query]
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
> [discovery: 19 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 4. DEX · Vol/OI · IV skew · Term structure (SHIPPED + ARCHIVED — closed)
> [discovery: 23 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 5. Ghost-trade tracker / sim (SHIPPED + ARCHIVED — both lanes done)
> [discovery: 35 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 6. Backend observability (SHIPPED + ARCHIVED — both lanes done)
> [discovery: 46 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7. Trader personas (SHIPPED + ARCHIVED — both lanes done)
> [discovery: 42 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7b. In-app AI recommendations (SHIPPED + ARCHIVED — both lanes done)
> [discovery: 29 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7c. Positions portfolio (SHIPPED + ARCHIVED — both lanes done)
> [discovery: 19 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7d. Convexa multi-page shell + landing (SHIPPED + ARCHIVED — FE-only)
> [discovery: 18 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7e. Ticker-page load experience (SHIPPED + ARCHIVED — both lanes done)
> [discovery: 23 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7f. User accounts — auth + sessions + per-user settings (SHIPPED + ARCHIVED — both lanes done)
> [discovery: 40 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7g. Full Convexa rebrand (SHIPPED + ARCHIVED — both lanes + conductor doc sweep)
> [discovery: 26 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7h. Hybrid bring-your-own AI key (SHIPPED + ARCHIVED — both lanes done)
> [discovery: 27 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7i. Containerize the apps (SHIPPED + ARCHIVED — infra fast-path, author-only)
> [discovery: 27 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7j. Persistent datastore — in-memory → Postgres (SHIPPED + ARCHIVED — backend infra fast-path)
> [discovery: 31 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7k. Deploy — Railway + Cloudflare Pages + system-6 go-live review (SHIPPED artifacts; live-deploy owner-applied)
> [discovery: 58 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7l. Convexa redesign — full FE re-skin to the Figma DS (SHIPPED + ARCHIVED — merged to main)
> [discovery: 25 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7m. Ticker UX-polish program + ai-rec structured display (SHIPPED + ARCHIVED — FE-only, catch-up QA)
> [discovery: 45 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7n. Owner 5-item product program — items 1–4 (SHIPPED + ARCHIVED; item 5 `scanner` queued)
> [discovery: 26 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7o. Projected dealer flow (SHIPPED + ARCHIVED — both lanes done)
> [discovery: 25 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7p. Latent hygiene finding — the `:typecheck` Nx target (RESOLVED 2026-07-16 — hygiene batch)
> [discovery: 13 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7q. AI context pack — "Market context" (SHIPPED + ARCHIVED — both lanes done)
> [discovery: 50 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7r. IV Rank / IV Percentile (SHIPPED + ARCHIVED — both lanes done)
> [discovery: 49 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7s. Dashboard restructure + Cypress swap + kit sync (SHIPPED on `main` — owner-directed maintenance)
> [discovery: 32 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7t. Outcome ledger — the track record (SHIPPED + ARCHIVED — FE-only)
> [discovery: 71 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7u. Redesign program — "The Curvature Terminal" (Q4(a) 2026-07-22; ALL 4 STAGES SHIPPED — COMPLETE)
> [discovery: 34 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7v. Scanner — the multi-ticker surface (SHIPPED + ARCHIVED — 4 phases, both lanes)
> [discovery: 36 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7w. Event calendar on the bundle (SHIPPED + ARCHIVED — GATE M backend fast-path)
> [discovery: 39 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7x. Multi-leg positions — one book (SHIPPED + ARCHIVED — FE-only, 5-phase build)
> [discovery: 217 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7y. Score lab — comparative + per-symbol signal comparison (SHIPPED + ARCHIVED — backend-only, `NO_UI_CHANGE`)
> [discovery: 32 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7ad. Tradeable rec inputs — real numbers for the AI rec (SHIPPED + ARCHIVED 2026-08-13 — both lanes)
> [discovery: 39 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7ae. ai-rec-grounding — per-figure grounding for the AI rec (SHIPPED + ARCHIVED 2026-08-13 — both lanes)
> [discovery: 51 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7af. rec-absence-literals-hole — the absence half of AI grounding (SHIPPED + ARCHIVED 2026-08-14 — both lanes)
> [discovery: 39 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7ag. ticker-visual-collisions — Quick hairline + GEX label lanes (SHIPPED + ARCHIVED 2026-08-17 — FE-only)
> [discovery: 16 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7ah. ai-rec-decision-card — decision-first card + analysis surface (SHIPPED + ARCHIVED 2026-08-17 — FE-only)
> [discovery: 16 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7al. batch-backtest-cli — P3 replay of stored books (SHIPPED + ARCHIVED 2026-08-18)
> [discovery: 13 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7ak. chain-snapshot-capture — keep paid Massive snapshots (SHIPPED + ARCHIVED 2026-08-18)
> [discovery: 14 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7aj. ai-providers — multi-provider keys + named model (SHIPPED + ARCHIVED 2026-08-18 — both lanes)
> [discovery: 18 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7ai. rec-plan-scope-caption — plan-row scope caption (SHIPPED + ARCHIVED 2026-08-17 — FE-only)
> [discovery: 25 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7ap. chain-archive-object-store — session bodies off app OLTP (SHIPPED + ARCHIVED 2026-08-20)
> [discovery: 17 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7ao. liquid-names-session-capture — SPY/QQQ/IWM session books despite warm cache (SHIPPED + ARCHIVED 2026-08-20)
> [discovery: 17 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7an. session-chain-archive — one paid book per ET day, prune-proof (SHIPPED + ARCHIVED 2026-08-20)
> [discovery: 17 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
## 7am. replay-outcome-join — labels on replayed paid books (SHIPPED + ARCHIVED 2026-08-19)
> [discovery: 16 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
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
- **~~CI/CD not wired~~ → SUPERSEDED 2026-08-13: FULL CI/CD EXISTS — push = deploy. Verified against
  reality after the owner challenged the stale claim** (live probes + workflow files + `gh run list`),
  which had survived TWO prior "verified" notes. Three workflows: `ci.yml` (frontend
  lint·typecheck·test·build·e2e + backend cargo test·release+postgres), `conformance.yml` (a **prod
  public-surface sweep** — the conformance-in-CI gap below is CLOSED — plus a local auth-gated leg),
  `deploy-smoke.yml`. **CD is real:** Railway auto-deploys the backend from GitHub pushes and Cloudflare
  Pages builds the frontend from git — the `tradeable-rec-inputs` push (`47a8961`) was serving live on
  `convexa.pages.dev` within the hour, front AND back (probed: `/api/candidates/SPY` 200; the served
  `TickerDashboard` chunk carries the feature's literals). Built by the owner in Grok CLI sessions
  (commits `c852ab9`, `188f e21`, `c917466`, `4633656`, `64058c4`, `ace8a0a`). **Update 2026-08-17:**
  HEAD `593f601` CI Frontend job **succeeded** (lint · typecheck · test · build · e2e) and Conformance
  + Deploy smoke succeeded — the 2026-08-13/14 "frontend job is standing-red" claim is **stale as of
  that run**. BACKLOG §B `ci-standing-red` **retired 2026-08-20** (hygiene batch; local full
  frontend+backend analogue green the same day). Do not treat one green HEAD as proof the
  five-file baseline can never regress. Historical (both red
  BEFORE the 08-13 push): (a) lint warnings policy + 5 accepted pre-existing red specs; (b)
  conformance **local auth-gated leg** exits 2 at signup bootstrap. The 2026-07-28 wording below is history:
  *(a) conformance sweep not in CI; (b) push ≠ deploy, applied by hand — both now false.*
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
> [discovery: 125 lines elided — closed history; read context/OPEN_THREADS.md for the full section, or memory_query]
# DECISION LEDGER — compounding memory (standing reference)

> How the system gets wiser per feature. The conveyor between a one-off decision and the shared
> rulebook, triggered by **recurrence**.
>
> **CAPTURE** — at every gateway the Orchestrator appends each *binding* decision it locked as a row
> below (stable `key` · feature · gate · statement · binding). **DETECT** — at **GATE S** it tallies
> the rows. **GRADUATE** — any key crossing the threshold is promoted into the canonical rulebook.
> **REUSE** — a feature's `BRIEF.md` cites promoted keys in "Invariant watch"; each role restates the
> ones it touches; ORCHESTRATOR §6 forbids reopening them. So each ship can only *add* to the
> constraint envelope the next feature inherits.

## Promotion rule
- **Threshold (recurrence path):** a key present in **≥3 distinct shipped features**, OR **≥2 if every
  instance is `binding:yes`**, graduates at the next GATE S.
- **Threshold (SEVERITY path — added 2026-07-16, owner canon review):** a key whose violation is
  **catastrophic AND irreversible** (silent, unrecoverable loss of user data; a real-money or
  security boundary breached) graduates on **1 instance** — or on **0**, by explicit owner decision at a
  canon review — **without waiting for recurrence**.
  **Why this exists (the flaw it fixes):** recurrence is a *proxy* for importance, and it was mis-ranking.
  It had promoted `single-shared-sim-entry-dialog` — a **dialog** — to constitutional law at 2 instances,
  while `loss-free-durable-migration` sat at 1 on the watch list, guarding ~5 durable localStorage stores
  that hold the user's **entire trading history with no server backup** — where a single migration bug is a
  silent, total, unrecoverable loss. **When the importance is already known, do not wait for the proxy.**
  Recurrence still governs the ordinary case; severity is the override, and the promoting session must
  **write down the catastrophic+irreversible justification** (the bar — not merely "important").
- **Binding-only intake:** only a decision a *future feature could violate* enters the ledger (same
  bar as the GATE I decision-impact cull). Incidental implementation choices are not logged.
- **Owner canon review is a legitimate source of canon** (2026-07-16): a rule may also be promoted or
  narrowed by explicit owner decision at a review, recorded with its rationale in the `earned by` column —
  distinct from, and not a substitute for, recurrence-graduation at GATE S.
- **⚠ Kit divergence (logged, not resolved):** the framework's `ORCHESTRATOR.md` §3a/§6 still states the
  recurrence-only rule. `ORCHESTRATOR.md` is a **delivery-kit framework file** (byte-identical across
  consumers — system-13), so this project must NOT edit it in place; the severity path is a framework
  improvement that flows back via `KIT_BACKLOG.md` + `extract.mjs`. Until then the ledger (project-owned)
  is ahead of the framework prose. See BACKLOG §E system-13.
- **Single-source:** a promoted rule's **prose lives once** in `PROJECT_CONTEXT.md` §5 (+ a locked
  pointer in `OPEN_THREADS.md` §9). This ledger only **indexes** it — never a second copy (drift risk).
- **Contestable:** a promoted rule is a default, not a cage — reopen via **GATE Z**; the Orchestrator
  then updates/demotes it here and in the canon. Provenance (the earning rows) is retained.

## Promoted canon (key index → where the rule lives)
| key | rule (one line) | lives in | promoted | earned by |
|-----|-----------------|----------|----------|-----------|
| `best-effort-isolated-or-null` | an optional/added computation fails to a null/omitted field, **never an HTTP error**; `market_state`/`strike_profile` + SSE stay intact | CONTEXT §5 · THREADS §9 | 2026-06-22 | dark-pool, dex-voloi-skew-term, trade-tracker-sim, backend-observability, trader-personas (5) |
| `additive-keeps-score-byte-identical` | an additive feature leaves gate / `opportunity_score` / `opportunity_tier` / `state_fingerprint` **byte-identical**; never a scoring input | CONTEXT §5 · THREADS §9 | 2026-06-22 | dex-voloi-skew-term, trade-tracker-sim, backend-observability, trader-personas (4) |
| `live-vs-static-isolation` | every datum declares live-derived vs static; live UI degrades on SSE drop (dim+offline, never blank) while static reads keep rendering | CONTEXT §5 · THREADS §9 | 2026-06-22 | dark-pool, dex-voloi-skew-term, trade-tracker-sim, trader-personas (4) |
| `operator-vs-trader-path-separation` | an operator/diagnostic surface stays off every trader/bundle route + unlinked from the trader UI; read-only + side-effect-free (no vendor fetch / recompute / cache mutation / trader-route call); trader path + SSE untouched | CONTEXT §5 · THREADS §9 | 2026-06-23 | backend-observability, latency-visualizer (2 binding) |
| `no-real-order-path` | "action" never reaches a real broker/order path: a simulated feature stays `SIMULATED` (paper) + mandatory-confirm; a not-yet-built real surface (e.g. a "Live" tab) ships as a **non-functional placeholder** with no broker, no order/execution path, no real-position data source | CONTEXT §5 · THREADS §9 | 2026-06-24 | ai-recommendations, positions-portfolio (2 binding) |
| `server-side-gate-enforcement` | an access gate on a state/cost-bearing action is enforced **server-side** (the server is the boundary of record), never FE-only; the FE check is for UX, not enforcement — a bypassed client check must still be rejected by the server | CONTEXT §5 · THREADS §9 | 2026-06-29 | user-accounts (AC-E7 catch), byo-ai-key (2 binding) |
| `secret-encrypted-at-rest` | a stored recoverable secret (a user/third-party API key, broker token, etc.) is **ENCRYPTED at rest** (symmetric, server-side key — NOT hashed), and **never logged / returned in a response / sent to the browser**; write-only from the client (masked hint only) + rotate/delete; persisted as **ciphertext only** (the crypto boundary sits before the store); a decrypt-fail is treated as no-usable-secret, never a leak | CONTEXT §5 · THREADS §9 | 2026-06-29 | byo-ai-key, persistent-db (2 binding) |
| `no-secrets-in-image` | a build/deploy artifact (container image, pushed repo) carries **NO secret**: `.dockerignore` excludes `.env*`/`.venv`/credential files, no `COPY .env`, no secret literal, no hardcoded backend URL; ALL config + secrets injected at **runtime via env** (host Variables / Pages env), values owner-entered; images run **non-root** | CONTEXT §5 · THREADS §9 | 2026-06-29 | containerize-apps, persistent-db, deploy (3 binding) |
| `single-shared-sim-entry-dialog` | **SIM-ONLY (narrowed 2026-07-16).** Every **simulated** entry flow (ghost trade, positions, act-on-rec/orders) launches THE one shared `app/features/trading/TradeEntryDialog`; a new **sim** entry shape is an additive VARIANT of it (props/modes), never a forked second dialog; dead forks are deleted with zero-importer proof. **A REAL-money entry surface is explicitly OUT of scope and MUST be a separate component** — see the narrowing note under the table | CONTEXT §5 · THREADS §9 | 2026-07-02 · narrowed 2026-07-16 | sim-entry-unification, ai-rec-backtest-orders (2 binding); narrowed by owner canon review |
| `loss-free-durable-migration` | when a durable client store's key/shape changes, existing user data is carried forward **loss-free** — read-new-else-old, promote-forward, **never-delete**, idempotent, never-throw — composing with any prior version chain; a corrupt/unreadable blob degrades to empty **without destroying the original** | CONTEXT §5 · THREADS §9 | **2026-07-16 (SEVERITY path, 1 instance)** | rebrand-convexa (the `resolveDurable` helper + the positions v1→v2 chain). Promoted by owner canon review on severity, not recurrence: ~5 durable localStorage stores hold the user's entire trading history with **no server backup**; violation = silent, total, irreversible loss. |
| `score-change-is-deliberate-and-measured` | the `opportunity_score`/`tier`/gate **MAY** evolve — but **only deliberately**: via an explicit score-changing feature that states its rationale, records a **before/after on real tickers**, and **version-bumps** the fingerprint basis. A score change is **never** a side effect of an additive feature (that is `additive-keeps-score-byte-identical`), and never lands unmeasured | CONTEXT §5 · THREADS §9 | **2026-07-16 (owner canon review)** | The counterpart `additive-keeps-score-byte-identical` lacked: 8 enrichment features shipped (dex-voloi-skew-term, dealer-flow-projection, ai-context-pack, iv-rank, …) and **none could reach the score**, which went unchanged for 210 commits. Fills the gap; does not weaken the additive rule. |
| `theme-token-discipline` | a new or re-skinned FE component binds to the MUI theme / `tokens.ts` — mode-aware values via `extrasFor(theme)` inside sx callbacks — **never hardcoded hex**; dark/light parity verified | CONTEXT §5 · THREADS §9 | 2026-07-02 | convexa-redesign, ticker-ux-polish, light-mode-parity + sim-entry-unification, ai-rec-backtest-orders (4 programs) |
| `model-read-carries-its-assumptions` | a forward-looking / model-dependent read (a projection, a model-derived level, a threshold-bucketed regime label/scalar) is surfaced **self-describing** — it carries its own horizon / window / assumption / basis / threshold — and is framed as **advisory context, never a guarantee / price forecast / scored signal** | CONTEXT §5 · THREADS §9 | 2026-07-06 | dealer-flow-projection, ai-context-pack, iv-rank (3) |
| `digested-labels-not-raw-dump` | a derived-signal set fed to the downstream AI (and displayed) is a **SMALL orthogonal set pre-digested into regime/band LABELS**, not a raw indicator/OHLC/series dump; the **wire enum/token is authoritative** (FE renders via a closed lookup, **never re-derives** a label from the scalar); no raw series on the wire or in the UI | CONTEXT §5 · THREADS §9 | 2026-07-07 | ai-context-pack, iv-rank (2 binding) |
| `absent-is-not-none` | a surface that can be **uncurated, unattempted or inapplicable** distinguishes **"we do not know"** from **"we checked and there is nothing"**, and carries that distinction **to the consumer** rather than collapsing it at a boundary; enforced in the **type or the closed vocabulary**, never in prose. Prevents a **fabricated claim**, not merely a gap | CONTEXT §5 · THREADS §9 | **2026-07-28** | bundle-events, expiration-events, positions-legs (3 binding). Held at 2 on 2026-07-27 because both instances came from **the same feature family on the same day**; the watch-list entry said *"re-assess when an unrelated feature needs it."* `positions-legs` is that feature — the rule carried out of backend wire-config into the **client render** with four independently-assertable not-a-number literals. Generality demonstrated, not assumed |

| `structural-over-prose-enforcement` | an invariant is enforced by **construction** — type, module boundary, empty diff, mutation-tested scan, build-breaking lint — not by **prose an implementer must remember**; where both exist, prefer the shape that makes the violation **impossible or build-breaking**. **The bar: poison what the rule forbids and the build must go red, and the poison test must itself be proven non-vacuous** | CONTEXT §5 · THREADS §9 | **2026-08-06** | outcome-ledger, scanner, positions-legs, broker-option-grouping (4 features). **Held back THREE times** on the stated objection that it was "a design heuristic without a crisp violation test" — the entry each time said volume was not the missing piece, a statable bar was. `broker-option-grouping` supplied it, and supplied the argument for why prose could never have sufficed: `structure.ts:153` falls back to `custom` **only** because a vendor field is null today, so the forbidden name would appear **by itself, with nobody deciding it**, the day the field arrives. Promoted on the bar, not on the count |
| `single-motion-moment` | the app has **ONE orchestrated motion moment**; the app-wide keyframe inventory is **set-equality pinned** so a new family is **build-breaking**; surviving motion is that moment or a **data signal** by recorded decision, never decoration; all of it respects a shared `useReducedMotion` | CONTEXT §5 · THREADS §9 | **2026-08-06** | redesign-stage-2, redesign-stage-3 (2 binding). **Crossed the threshold at redesign-stage-3 on 2026-07-22 and was MISSED at that GATE S** — surfaced by `ledger_tally` at the `broker-option-grouping` ship and graduated then. Exactly the miss the mechanical tally exists to prevent; the counting was already code, but the tally was not run at that ship |
| `dark-pool-context-only` | off-exchange / dark-pool is **context only** — capped confluence, toggleable, never a directional smart-money signal; block prints display-only and unscored; no-side chips must not render success green | CONTEXT §5 · THREADS §9 | **2026-08-11** | dark-pool-stream-isolation, redesign-stage-3 (2 binding). Long-standing prose in §5/§9; formal key graduation via `ledger_tally` at `distance-to-level-tiles` GATE S (the prior "pre-existing canon" note was not in this table, so the tally kept marking GRADUATES) |
| `ai-asserted-numbers-are-traceable` | every number or field the in-app AI **asserts** is traceable to a computed bundle field, and every field it **omits** says so in a **closed vocabulary** rather than a mark meaning something else; an untraceable figure is never rendered as fact, an absent one never as a **reserved literal of another state** and never **pre-typed into a tradeable input** by default, inference or chain-derived fallback | CONTEXT §5 · THREADS §9 | **2026-08-14** | ai-rec-grounding (per-figure grounding; **44.4% of asserted numbers measured untraceable**), rec-absence-literals-hole (the absence half — six fields, one new vocabulary member, the Accept seam) — **2 binding**. Logged at **0 instances** 2026-07-16 as explicitly aspirational ("an aspirational rule is not canon"); the queued severity-path question dissolved when the 2nd instance arrived, so it graduated on **ordinary recurrence** exactly as the rule intends |
| `cited-code-is-verified-not-assumed` | a design or plan artifact must not assert a fact about **existing code** it will reuse unless that fact was **read at source**; unverifiable claims carry a `[lane-check]` mark instead of being asserted | CONTEXT §5 · THREADS §9 | **2026-08-17** | rec-absence-literals-hole (1st instance — 3 false citations inside one council), rec-plan-scope-caption (2nd — PLAN locked attachment against live `DecisionCard.tsx`, not Python-era `AiRecPanel`) — **2 binding**. Graduated by `ledger_tally` at this GATE S |

> Pre-existing canon (recorded by the ledger, already a rule before it existed — not re-promoted):
> `gamma-sourcing-split` (CONTEXT §3 / THREADS §9).
> (`ai-external-no-llm` was here until **2026-06-23** — now **DEMOTED / narrowed** by `ai-recommendations`;
> see the Demoted table.)

### Narrowing note — `single-shared-sim-entry-dialog` (2026-07-16, owner canon review)
**Narrowed in place, NOT demoted** (precedent: the `live-spot=NBBO-mid` narrowing — the rule still fully
holds for everything it was earned on; only its *scope* is made explicit before it is misapplied).
**Why:** the key was promoted on 2 instances of what is really a good local refactor, and — uniquely among
the promoted set — it names a **file** rather than stating a **principle**. Left un-narrowed it was on a
collision course with `no-real-order-path`: `apps/dashboard/src/app/README.md` already described
`TradeEntryDialog` as *"the ONE shared **sim/live** entry surface"*, so at `broker-connect` the rule would
have pushed **real-money entry into the same component as paper trades, as an "additive variant."** That is
backwards. The one place a fork is a **feature, not a smell**, is the boundary between "this is pretend" and
"this moves real money" — a shared component there invites the single most expensive confusion the app can
produce, and `no-real-order-path` exists precisely to keep that boundary hard.
**The narrowed rule:** sim-entry flows share the ONE dialog (unchanged). **A real-money/broker entry surface
MUST be a structurally separate component** — never a mode, prop, or variant of the sim dialog. Deciding
otherwise is a deliberate GATE-Z reversal, not a default.
**Follow-through:** the README line was corrected 2026-07-16. No code change — `broker-connect` is unbuilt,
which is exactly why this was cheap to fix now.

## Demoted (contradicted by reality — system-7)
> The inverse of graduation: memory must track **truth**, not just recurrence. A promoted invariant that
> reality contradicts — an **accepted GATE Z amendment**, or a **GATE Q QA/conformance FAIL** proving it
> false or over-general — is demoted: its prose is **removed (or narrowed)** in `PROJECT_CONTEXT.md` §5
> + `OPEN_THREADS.md` §9, its key moves out of "Promoted canon" into the table below, and its earning
> rows stay in the Ledger as provenance. **Bar (mirrors promotion):** demote only when the *rule itself*
> is shown wrong/over-general — a single feature's legitimate carve-out is an **exception** noted on that
> feature, NOT a demotion. (`contract_lint.py`'s canon check follows automatically — a demoted key leaves
> the Promoted-canon table, so it is no longer expected in canon prose.)

| key | demoted | contradicting evidence (feature · gate) | disposition |
|-----|---------|------------------------------------------|-------------|
| `ai-external-no-llm` | 2026-06-23 | `ai-recommendations` · GATE S — owner decision (2026-06-23): GammaFlow now CALLS an LLM in-app for a risk-first entry rec. Contradicts the absolute "does not call an LLM." | **NARROWED, not erased.** New rule: GammaFlow MAY call an LLM **only** as a best-effort, isolated, gated, **advisory consumer** of already-computed state (never a scoring/gate/fingerprint input, no recompute, off the SSE path, server-side key, no auto-act, no real order); the AI is otherwise external + the manual hand-off remains valid. Prose narrowed in CONTEXT §8. Earning rows (trade-tracker-sim, trader-personas — "no LLM call") retained as provenance: they still comply (they made no call). |

### Candidate — `vendor-contract-verified-not-faked` (broker-connect, 2026-08-05; SEVERITY path argued)
**The rule:** where our code meets a THIRD-PARTY SDK's return contract, at least one test must
exercise that contract with a **vendor-shaped object**, not a hand-made fake. A fake transport that
returns tidy dicts tests our mapping and nothing else — it structurally cannot see what the vendor
actually hands back.
**Earned the hard way, twice in one feature, both live-only failures behind a fully green suite:**
1. **S-1 (Critical).** `_shim_sdk_compat()` restored `six`/`cgi` but not the vendored `ssl` names
   Python ≥3.12 removed, so the shipped adapter **could not complete a single HTTPS request** —
   surfaced as a generic `adapter_fault`, indistinguishable from a broker outage. The *capture tool*
   had the shim; the product's copy had silently diverged. A third casualty (`HAS_SNI`) would have
   produced SNI-less TLS — intermittent, and worse than the total failure.
2. **The Response-object bug.** `ApiClient.get_response()` returns the transport OBJECT, not parsed
   JSON. The adapter passed it to the mappers, which correctly answered "nothing here" — so a
   healthy 13-position book read as `adapter_fault` + "no account id". **The identical defect had
   already been found and fixed in the capture tool** (`3416ef3`); the product carried its own copy.
**Both were product/tool divergences of code that was supposed to be one implementation** — which is
why the fix in both cases was to make it literally one (`_shim_sdk_compat` now lives in the product
and the tools import it; `_parsed` is the single decode point). The R8 cross-ticker bug the same week
was a THIRD instance of the same shape: two "deliberate mirrors" that drifted, fixed by extracting a
shared resolver.
**Severity argument:** the failure mode is a feature that is 100% dead in production while every
gate reports green, and it degrades into a *plausible* error state rather than a loud one — the
operator cannot tell "broken build" from "broker is down". Not yet promoted: it has 1 shipped
feature (3 instances within it). **Re-assess at the next vendor-SDK integration** — SnapTrade would
be exactly it.

## Watch list (keys logged, not yet at threshold)
- _(`single-shared-sim-entry-dialog` GRADUATED 2026-07-02 — 2 binding (sim-entry-unification created
  the single dialog + deleted the forks; ai-rec-backtest-orders honored it via the additive order
  variant, contract-mandated "do not fork"). Now in Promoted canon above.)_
- _(`theme-token-discipline` GRADUATED 2026-07-02 — held across convexa-redesign (logged), the
  ticker-ux-polish program ("held again"), light-mode-parity/sim-entry-unification (the `extrasFor`
  mechanism itself), and ai-rec-backtest-orders (token-only orders module). ≥3 shipped features →
  Promoted canon above.)_
- _(`model-read-carries-its-assumptions` GRADUATED 2026-07-06 — 2 binding (dealer-flow-projection — the
  assumption-explicit charm/vanna projection; ai-context-pack — every trend/shape/flow/ATR read carries its
  window+threshold+basis + the "not a forecast, not a scored signal" framing). Crossed the "≥2 if binding"
  threshold → Promoted canon above (CONTEXT §5 + THREADS §9); removed from the watch list.)_
- _(`digested-labels-not-raw-dump` GRADUATED 2026-07-07 — 2 binding (ai-context-pack — the TI regime labels
  off ADX/RSI/EMA, no raw indicator series; iv-rank — the rich/cheap `band` [premium_rich|neutral|premium_cheap]
  cut server-side from the rank, no raw IV history on the wire or in the UI). Crossed the "≥2 if binding"
  threshold → Promoted canon above (CONTEXT §5 + THREADS §9); removed from the watch list. Future indicator
  bundles — volume-profile/CVD, the news/sentiment classifier — will reaffirm it.)_
- _(**`loss-free-durable-migration`** GRADUATED **2026-07-16** via the new **SEVERITY path** at 1 instance
  (rebrand-convexa) — owner canon review. Violation = silent, total, irreversible loss of the user's entire
  trading history (~5 durable localStorage stores, **no server backup**). Recurrence would have kept it
  waiting behind a dialog; severity does not wait. Now in Promoted canon above.)_
- **`structural-over-prose-enforcement`** (**3 instances — outcome-ledger 2026-07-16 + scanner 2026-07-26 +
  positions-legs 2026-07-28; STILL NOT promoted**) — the 3rd instance is the strongest evidence yet
  (max-loss eligibility as **membership in a closed set** rather than a detection heuristic, so an
  under-detected unbounded shape is ineligible *by construction*; the recogniser's no-confidence-measure
  rule; a branded `NetLimitDollars` no numeric literal can inhabit, pinned by a `@ts-expect-error` that
  fails typecheck if the brand weakens) — **and the judgement is still unchanged.** Three instances now say
  the same thing two did: volume is not the missing piece, a **statable violation test** is. Compare
  `absent-is-not-none`, which graduated the same day on *fewer* instances because its third one proved
  **generality** rather than repeating the evidence. Original entry: (2 instances) — see the scanner ledger row for that ship's evidence (leaf boundary · empty
  `apps/api` diff · pure-logic-with-injected-clock · mutation-guarded scans · pins re-pointed not deleted).
  **The judgment is unchanged by the second instance:** volume of evidence is not the missing piece — a
  *statable violation test* is. It stays a design heuristic until someone can write the bar that makes
  "enforced by prose" mechanically detectable. Recorded here so a later canon review can weigh it with the
  full provenance rather than re-deriving it. Original entry: — an
  invariant a feature must hold is enforced by **construction** (a type, a module boundary, an empty diff, a
  mutation-tested source-scan) rather than by **prose an implementer must remember**. Where the two are
  available, prefer the shape that makes the violation **impossible or build-breaking**. *Evidence in this
  one ship:* no-auto-tuning = a literally **empty `apps/api` diff** (a statistic that never leaves the
  browser cannot reach `signals.py`) · the coverage roll-up is **integers-only**, so the demo seed's
  fabricated `realized_pl_dollar: 196` is **unreachable by construction** · the counted read is **ONE string
  in ONE `<Typography>`**, so "no hero number" is unbreakable **in the DOM** rather than in the type spec ·
  the decline class-A map is `Record<Exclude<DeclineReason,'store_unreadable'>,…>`, so re-composing class B
  through class A's inverted template is a **TYPE ERROR** · the `?raw` source-scan **provably bites**
  (mutation-tested: renaming a `via` literal FAILED with a message naming §2/Q3.5). *Kin already in the
  project:* `contract_lint.py`, `path_guard.js`, `kit_lint.mjs`, `interface_conformance.py` — all the same
  move ("mechanize the trusted invariant"). **Deliberately NOT promoted at 1 instance:** it is closer to a
  *design heuristic* than a rule with a crisp violation test, and the severity path does not apply (relying
  on prose is not catastrophic-and-irreversible). Log recurrence; promote only if it earns a statable bar.
  *binding:yes (weakly — a future feature could violate it by shipping a rule enforced only by a comment).*
- _(**`absent-is-not-none`** **GRADUATED 2026-07-28** at `positions-legs` — 3 binding, and the 3rd instance
  is the one this entry was explicitly waiting for: an **unrelated feature family**, carrying the rule out
  of backend wire-config and into the **client render** (four independently-assertable not-a-number
  literals: `—` / `unavailable` / `not recorded` / `no basis`; `undefined`/`null`/`NaN` banned outright).
  The "specialisation of `model-read-carries-its-assumptions`?" doubt below is answered by that instance —
  a self-describing *model read* has nothing to say about a **saved record that never held a fact**, which
  is a different failure with a different fix. Now in Promoted canon above.)_ Original entry, kept for
  provenance: (**2 instances — bundle-events + expiration-events, both 2026-07-27; NOT promoted at the
  time**) — the 2nd instance carried the rule **down a level** (an empty `expirations` array under
  `state: unknown` must not read as "no expiry is affected"), which is genuine reinforcement but from the
  *same feature family on the same day* — weak evidence of generality, not the ≥2-distinct-features the
  binding threshold intends. Re-assess when an unrelated feature needs it. Original entry: — a store or config
  that can be *uncurated* must distinguish **"we do not know"** from **"we checked and there is nothing"**,
  and must carry that distinction to the wire rather than collapsing it at a boundary. *Evidence:* the
  events loader returns `None` (unknown) vs `[]` (verified none) so the **type signature** stops a caller
  from conflating them, and the wire's closed `state` enum is the sole disambiguator because both states
  carry an empty list. *Kin already shipped:* the scanner's `building` vs `error`, iv-rank's "building
  history — N of 20", the outcome-ledger's `building` cells that render **nothing numeric**. **Not promoted
  at 1 instance:** the severity path does not obviously apply (it produces a wrong *claim*, not
  irreversible data loss), and the kin above suggest this may be a **specialisation of
  `model-read-carries-its-assumptions`** rather than a separate rule — the honest read is that a
  self-describing read already implies "say when you don't know." Log recurrence; promote only if it earns
  a bar distinct from its parent. *binding:yes.*
- _(**`ai-asserted-numbers-are-traceable`** **GRADUATED 2026-08-14** — 2 binding (ai-rec-grounding, rec-absence-literals-hole);
  now in Promoted canon above. It reached the bar on **ordinary recurrence**, which is why the queued
  severity-path question was never put to the owner. Original entry retained below for provenance.)_
  (**0 instances at proposal — 2026-07-16, owner canon review; NOT promoted then**) — every number the in-app AI **asserts** (strike, stop, target, level, price) must be
  **traceable to a computed bundle field**; an untraceable number is not rendered as fact. Rationale:
  `best-effort-isolated-or-null` covers the AI **failing**, nothing covers it **fabricating** —
  `model-read-carries-its-assumptions` disciplines *our* model reads, not the LLM's output. The
  ai-rec-backtest-orders "levels in play" being **bundle-sourced** is the partial precedent that shows the
  instinct was already there. Given the BACKLOG §C securities-counsel item, an ungrounded number is a
  **liability** question, not only a bug. **Logged at 0 instances deliberately** — an aspirational rule is
  not canon; it applies to the next AI-touching feature and promotes on its first real instance (or on the
  severity path if a fabrication is ever observed live). *binding:yes.* Build item → BACKLOG §B.
- _(`no-secrets-in-image` GRADUATED 2026-06-29 at `deploy` — 3 binding (containerize-apps, persistent-db,
  deploy); the held-until-published rule fired when the image is pushed to Railway for real. Now in Promoted
  canon above.)_
- _(`server-side-gate-enforcement` GRADUATED 2026-06-29 — 2 binding (user-accounts AC-E7, byo-ai-key).)_
- _(`secret-encrypted-at-rest` GRADUATED 2026-06-29 — reached 2 binding instances (byo-ai-key, persistent-db);
  now in Promoted canon above.)_
- _(`no-real-order-path` graduated 2026-06-24; reaffirmed again by user-accounts → 3 binding instances,
  already in Promoted canon.)_

## Ledger (append-only — one row per binding decision instance)
> [discovery: 711 lines elided — over the discovery byte budget; read context/DECISION_LEDGER.md for the full section, or memory_query]
