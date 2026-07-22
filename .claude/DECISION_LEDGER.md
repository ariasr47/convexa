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

> Pre-existing canon (recorded by the ledger, already a rule before it existed — not re-promoted):
> `dark-pool-context-only` (THREADS §9) · `gamma-sourcing-split` (CONTEXT §3 / THREADS §9).
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
- **`structural-over-prose-enforcement`** (**1 instance — outcome-ledger, 2026-07-16; NOT promoted**) — an
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
- **`ai-asserted-numbers-are-traceable`** (**0 instances — PROPOSED 2026-07-16, owner canon review; NOT
  promoted**) — every number the in-app AI **asserts** (strike, stop, target, level, price) must be
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
| key | feature | gate | statement (as locked) | binding |
|-----|---------|------|-----------------------|---------|
| `best-effort-isolated-or-null` | dark-pool-stream-isolation | S | any off-exchange failure → `off_exchange=None` (object omitted, not an HTTP error); bundle + SSE intact | yes |
| `live-vs-static-isolation` | dark-pool-stream-isolation | S | live tiles dim + `⏸ offline` on payload-gap watchdog; GEX chart/stats/blocks persist from last bundle | yes |
| `dark-pool-context-only` | dark-pool-stream-isolation | S | block prints display-only, unscored, no side (already canon THREADS §9) | yes |
| `additive-keeps-score-byte-identical` | dex-voloi-skew-term | S | `signals.py` untouched; score + `state_fingerprint` byte-identical with/without the four metrics | yes |
| `best-effort-isolated-or-null` | dex-voloi-skew-term | S | the four metrics each independently nullable → own "unavailable this cycle" | yes |
| `live-vs-static-isolation` | dex-voloi-skew-term | S | the four are static reads — excluded from the live-offline treatment (stay un-dimmed on SSE drop) | yes |
| `additive-keeps-score-byte-identical` | trade-tracker-sim | S | entry gate + `opportunity_score` + `state_fingerprint` byte-identical to pre-feature | yes |
| `best-effort-isolated-or-null` | trade-tracker-sim | S | all ghost-trade backend surface best-effort/isolated; missing→404, no-NBBO→null, never breaks bundle | yes |
| `ai-external-no-llm` | trade-tracker-sim | S | stateless server, no order path, **no LLM call** (already canon CONTEXT §8) | yes |
| `live-vs-static-isolation` | trade-tracker-sim | S | SSE drop degrades only P/L + current mark (⏸ last known); record/stats/history persist | yes |
| `additive-keeps-score-byte-identical` | backend-observability | S | `OBSERVABILITY_ENABLED` OFF ⇒ byte-identical bundle; computed values frozen; trader path unchanged | yes |
| `best-effort-isolated-or-null` | backend-observability | S | instrumentation best-effort — a forced span exception still yields 200 + identical values (never a non-200) | yes |
| `operator-vs-trader-path-separation` | backend-observability | S | metrics readout off the trader routes; SSE uninstrumented; trader dashboard ignores `trace_id`/`timings` | yes |
| `additive-keeps-score-byte-identical` | trader-personas | S | persona = A vs B vs none → byte-identical `market_state`/`signals`/`ai_eval`; persona never a scoring input | yes |
| `best-effort-isolated-or-null` | trader-personas | S | persona assembly failure → default one-size prompt, never an HTTP error, never blocks bundle/gate/hand-off | yes |
| `ai-external-no-llm` | trader-personas | S | persona assembles text only; AI external, **no LLM call** (already canon CONTEXT §8) | yes |
| `live-vs-static-isolation` | trader-personas | S | persona is presentation-only — fully usable from last bundle, never marked offline | yes |
| `operator-vs-trader-path-separation` | latency-visualizer | S | trend on `/_ops/metrics` only, never linked from a trader route; the page's sole network call stays `GET /api/_metrics`; no control triggers a vendor fetch / recompute / cache mutation / trader-route call | yes |
| `best-effort-isolated-or-null` | latency-visualizer | S | a failed poll keeps the last series behind a soft notice + self-heals (no retry storm, no error page); never affects the page, snapshot tables, or any other surface; the in-browser series is ephemeral (only Export persists, to the operator's machine) | yes |
| `additive-keeps-score-byte-identical` | ai-recommendations | S | the in-app LLM rec is a pure CONSUMER in a one-way-leaf module `signals`/`engine`/`live`/`darkpool` do NOT import; `opportunity_score`/`opportunity_tier`/`state_fingerprint` byte-identical with vs without a rec (verified live + via the E3 test) | yes |
| `best-effort-isolated-or-null` | ai-recommendations | S | LLM timeout/error/over-cap/no-key → HTTP 200 + a `status` field (never 5xx); the rec surface degrades ALONE; bundle/SSE/chart/tiles/tracker intact; manual export floor always works | yes |
| `live-vs-static-isolation` | ai-recommendations | S | a rec is a static artifact pinned to its snapshot — stale on a newer bundle, UNTOUCHED on an SSE drop, never silently refreshes/re-runs | yes |
| `no-real-order-path` | ai-recommendations | S | "action" = Accept into the paper-sim ghost-trade tracker + mandatory confirm; `SIMULATED`; advisory; no broker/order path (watch-list key) | yes |
| `ai-external-no-llm` | ai-recommendations | S | **DEMOTION trigger** — GammaFlow now CALLS an LLM (isolated/gated/advisory consumer); narrows the rule, see Demoted table | yes |
| `no-real-order-path` | positions-portfolio | S | multi-position sim portfolio: every entry `SIMULATED` (manual/market/limit are sim bookkeeping vs the existing mark stream); the **Live tab is a zero-import lock** — no broker, no order/execution path, no real position; no real order anywhere | yes |
| `additive-keeps-score-byte-identical` | positions-portfolio | S | the portfolio issues NO `/api/ticker` call + never feeds `signals`/`opportunity_score`/`opportunity_tier`/`state_fingerprint`; the tier read is display-only; AC-41 asserts byte-identical with/without the portfolio | yes |
| `best-effort-isolated-or-null` | positions-portfolio | S | a per-row mark/contract-lookup failure degrades only that row (excluded+flagged from the subtotal, never zeroed); a corrupt store degrades to an empty portfolio without throwing, leaving the readable v1 blob intact | yes |
| `live-vs-static-isolation` | positions-portfolio | S | on an SSE drop live cells dim + `⏸` last-known (never blank/0), the P/L trend = a broken line; position records / history / customization / saved views persist from the durable store | yes |
| `additive-keeps-score-byte-identical` | app-shell-landing | S | multi-page restructure (router + AppShell + Convexa landing); `apps/api` diff empty, the relocated Ticker renders the bundle score verbatim — score/tier/`state_fingerprint` untouched | yes |
| `best-effort-isolated-or-null` | app-shell-landing | S | relocated features keep best-effort degradation; standalone `/positions` per-row mark failure (404/null/refresh-fail) degrades that cell to last-known, never blanks/drops the row | yes |
| `live-vs-static-isolation` | app-shell-landing | S | Ticker live-degrade survives the route move (⏸ offline, static persists); live SSE is **page-scoped** — opens on `/ticker`, closes on nav-away, reopens on return, never double-subscribes | yes |
| `operator-vs-trader-path-separation` | app-shell-landing | S | `/_ops/metrics` stays OFF the new nav shell and unlinked from the trader UI (verified) | yes |
| `no-real-order-path` | app-shell-landing | S | all SIMULATED; positions "Live" tab stays the zero-import LOCKED placeholder; the landing's brokerage block is an honest non-navigating "coming soon" (no order/broker path) | yes |
| `additive-keeps-score-byte-identical` | ticker-load-experience | S | pre-warm/concurrency/coalescing change only WHEN/HOW inputs are obtained — same `market_data` in → byte-identical bundle out; `opportunity_score`/`tier`/`state_fingerprint` identical cold==warm (QA re-proven: score 44, fp `b5c70f93c2d5`) | yes |
| `best-effort-isolated-or-null` | ticker-load-experience | S | chain pre-warm + 3-fetch concurrency are best-effort: any miss/stale/malformed/fetch-exception falls back to a normal vendor fetch with no new error surface; `last_trade` nullable between prints/overnight | yes |
| `live-vs-static-isolation` | ticker-load-experience | S | SSE `last_trade` is live-derived (dims with mid/spread/flow on a stream drop); cold-load skeleton is a DISTINCT state from offline-degrade and from "unavailable this cycle" | yes |
| `live-spot=NBBO-mid` | ticker-load-experience | S | **NARROWING (system-7)** — `last_trade` ADDED as a display-only SSE readout; the NBBO mid stays the anchor for headline/levels/flip (`_levels_for_filter` keeps `self.mid`). Narrows THREADS §9 "do not add last-trade." | yes |
| `additive-keeps-score-byte-identical` | user-accounts | S | auth/sessions/settings = a one-way leaf the scoring path never imports (0/12 modules); anonymous vs signed-in bundle byte-identical (score 24, fp `79373ef9194e`); no user setting is a scoring input; bundle/SSE gained NO required header/query param | yes |
| `best-effort-isolated-or-null` | user-accounts | S | **CARVE-OUT (the auth error class):** auth endpoints return real HTTP statuses by design (401 non-enumerating bad-creds / 403 gated / 409 dup email) — the null-not-error rule governs added BUNDLE computations, NOT the auth surface; an auth-subsystem failure still degrades the trader path to anonymous (bundle/SSE intact) | yes |
| `no-real-order-path` | user-accounts | S | gating the Positions sim-trade WRITE actions + the "ask AI" call behind a session is ACCESS CONTROL; Positions stays `SIMULATED` (client-local localStorage); no broker/order/execution path; the "Live" tab stays zero-import LOCKED | yes |
| `additive-keeps-score-byte-identical` | rebrand-convexa | S | full GammaFlow→Convexa rename is cosmetic to the engine — logger/title/identifier/key renames only; `opportunity_score`/`tier`/`state_fingerprint` byte-identical (score 2, fp `8fa0e1e62a11`), conformance 8/8, no interface/wire change | yes |
| `best-effort-isolated-or-null` | rebrand-convexa | S | the migrate-on-read helper never throws — a corrupt/absent legacy blob degrades to empty in-memory with the source blob preserved (rollback-safe); a failed promote-write is swallowed and the value still surfaces | yes |
| `loss-free-durable-migration` | rebrand-convexa | S | renaming a durable localStorage key carries existing data forward LOSS-FREE: read-new-else-old, promote-forward-once (idempotent), never delete the old key, never throw; composes with the existing positions v1→v2 chain so every legacy user lands whole | yes |
| `additive-keeps-score-byte-identical` | byo-ai-key | S | per-user key resolution / credential store / crypto / metering / admin allowlist stay OUT of scoring; score 24 / tier actionable / fp `79373ef9194e` byte-identical across all 6 key states (anon/regular-no-key/admin-allowance/exhausted/shared-unconfigured/own-key); 0/5 scoring modules import the credential store or crypto leaf | yes |
| `best-effort-isolated-or-null` | byo-ai-key | S | key lookup / decrypt-fail / LLM error / over-limit / missing-encryption-secret all degrade the rec surface ALONE to a `status` (no_key/over_limit/shared_key_unconfigured/unavailable), always-200 never 5xx; bundle/SSE/chart/tracker + the keyless export floor intact | yes |
| `server-side-gate-enforcement` | byo-ai-key | S | the credential endpoints (`/api/auth/ai-key`) + the AI-rec call are gated SERVER-SIDE (403 anonymous; key resolution + the admin-allowance decision are server-authoritative); the FE only renders the server's resolved state — not an FE-only gate | yes |
| `secret-encrypted-at-rest` | byo-ai-key | S | a stored third-party secret (the user's Anthropic key) is ENCRYPTED (Fernet, server-side `AI_KEY_ENCRYPTION_KEY`), NOT hashed (must be recoverable to call); never logged / returned / sent to the browser; write-only + masked last4 + rotate/delete; decrypt-fail ⇒ treated as no usable key (no leak) | yes |
| `additive-keeps-score-byte-identical` | persistent-db | S | storage-backend swap only — the auth stores stay a one-way leaf the scoring path never imports (AST 0/5); trading/bundle/SSE path is stateless + untouched; score/tier/`state_fingerprint` byte-identical (in-memory default path conformance PASS, no regression) | yes |
| `best-effort-isolated-or-null` | persistent-db | S | a Postgres outage degrades the AUTH subsystem only — the adapter raises (never false-success) → existing machinery yields 503 `auth_unavailable` / treat-as-anonymous; the anonymous bundle/SSE/trader path never touches the DB and stays fully up. Auth fails CLOSED | yes |
| `secret-encrypted-at-rest` | persistent-db | S | the per-user AI key moves into Postgres as **ciphertext ONLY** (+ masked last4); the adapter never imports `crypto`, never reads `AI_KEY_ENCRYPTION_KEY`, never en/decrypts — the encryption boundary (crypto leaf, before the store) is preserved across the new store | yes |
| `no-secrets-in-image` | persistent-db | S | `DATABASE_URL` / DB credentials injected at RUNTIME via env, never committed/baked; `.dockerignore` already excludes `.env*` so the new config holds the image-hygiene line | yes |
| `no-secrets-in-image` | deploy | S | the image is **pushed to a registry for real** (Railway) — every secret (`DATABASE_URL`, `API_ORIGIN`, `MASSIVE/ANTHROPIC` keys, `AI_KEY_ENCRYPTION_KEY`/`AUTH_SESSION_SIGNING_KEY`, `METRICS_SECRET_TOKEN`) lives only in Railway Variables / Pages env, never in the repo/image; the Pages Function reads `API_ORIGIN` from env (no hardcoded URL); secret-scan clean. **3rd instance → GRADUATES** | yes |
| `additive-keeps-score-byte-identical` | deploy | S | deploy config + the 3 HIGH security guards (metrics token-gate, the fail-open public rate-limit leaf, the startup stable-key warning) change no scoring/engine/`state_fingerprint`; the limiter is a leaf outside the scoring path; in-memory conformance PASS, no regression | yes |
| `single-shared-sim-entry-dialog` | sim-entry-unification | S | ONE shared `app/trading/TradeEntryDialog` on both pages; ghost-trade + positions dialogs AND GhostTradePanel deleted with zero-importer proof; durable stores untouched | yes |
| `theme-token-discipline` | light-mode-parity | S | mode-aware `extras` via `extrasFor(theme)` (bare `extras.` = dark-only); ONE shared hatch; dark byte-identical; zero hardcoded hex | yes |
| `additive-keeps-score-byte-identical` | ai-rec-backtest-orders | S | scenario machinery confined to the ai-rec leaf (`ai_scenarios` imported only by `ai_recommendation`; AST: 0 scoring modules); orders are FE-local + add no request param (AC-44 structural test); score 78 / tier prime / fp `86bcafd6bc22` byte-identical flag ON==OFF; served triple identical before/after a scenario POST | yes |
| `best-effort-isolated-or-null` | ai-rec-backtest-orders | S | every scenario fault a contained 200 `status` (`scenario_unavailable`/`scenario_error`/`timeout`/`llm_error`), never 5xx; an orders-store fault degrades to an honest unavailable block without touching positions/bundle/SSE; per-order lookup failures + per-tick throws isolated | yes |
| `live-vs-static-isolation` | ai-rec-backtest-orders | S | triggers evaluate ONLY the live NBBO mid (`last_trade` structurally excluded from `tickFromLive`); fills only on live-resolvable marks (never frozen/stale/last_known); no transition while offline; no retro-fill on reconnect; clock expiry the only off-stream transition; live order cells dim + last-known on an SSE drop while durable rows persist | yes |
| `no-real-order-path` | ai-rec-backtest-orders | S | `SimOrder` = client-local paper bookkeeping behind a mandatory confirm; NO order endpoint / broker / execution path (orders never ride the wire); the Live tab stays zero-import LOCKED; scenario output is always marked SCRIPTED end-to-end (rec → order → export) | yes |
| `server-side-gate-enforcement` | ai-rec-backtest-orders | S | order creation awaits `POST /api/positions/sim-trade/gate` BEFORE any local write (403 ⇒ abort, zero order — proven even when the FE believed it was signed in); the rec POST keeps auth outermost in scenario mode (anonymous ⇒ 403 before any scenario logic) | yes |
| `single-shared-sim-entry-dialog` | ai-rec-backtest-orders | S | Act = an additive ORDER VARIANT (`orderPlan`/`onConfirmOrder` props) of the shared dialog — contract-mandated "do not fork"; the dialog renders byte-identically without the seam (guarded test) | yes |
| `theme-token-discipline` | ai-rec-backtest-orders | S | the entire `orders/` module + panel additions token-only + `extrasFor(theme)`; zero new hex (lint + conductor review) | yes |
| `additive-keeps-score-byte-identical` | dealer-flow-projection | S | the projection rides `market_state` as AI-context/display; `signals.py` 0 changes (grep-verified: reads no charm/vanna/dealer_flow_projection); score/tier/`state_fingerprint` byte-identical with-vs-without AND before-vs-after the `math.fsum` determinism fix (QA independently re-derived — field present/absent/garbage-mutated never moved the triple) | yes |
| `best-effort-isolated-or-null` | dealer-flow-projection | S | per-limb + whole-object null → null field, never a 5xx / fabricated 0 / fabricated date; a forced internal exception → `dealer_flow_projection: null` with the bundle still 200; a naturally-occurring whole-null case found in the wild (`min_dte=500`); the two limbs independently nullable | yes |
| `live-vs-static-isolation` | dealer-flow-projection | S | declared STATIC (`spot_basis = gex_spot`, never the live spot; never on SSE); on a stream drop the widget stays visible + un-dimmed + no `⏸` chip (FE contrast test vs a dimming LiveTape tile); excluded from the live-offline treatment like the four positioning tiles | yes |
| `theme-token-discipline` | dealer-flow-projection | S | the new `DealerFlowProjection` widget + copy are token-only via the MUI theme; dark/light parity render-verified; zero hardcoded hex | yes |
| `additive-keeps-score-byte-identical` | ai-context-pack | S | new one-way leaf `context_pack.py` (`signals`/`engine`/`live`/`darkpool` don't import it); attached AFTER `generate_signals` returns; `signals.py` **0 diff**; score/tier/`state_fingerprint` byte-identical (SPY 87/prime/`bb82718bcf1e`) with/without/forced-fault AND before/after the 60→400d daily-bar fetch extension (QA independently re-derived; HV unaffected — fixed 31-close tail) | yes |
| `best-effort-isolated-or-null` | ai-context-pack | S | four reads each INDEPENDENTLY nullable (per-label / per-horizon / per-sub-component / per-read); whole-pack null only when all four unavailable or the wrapper raised; a forced whole-pack fault → `market_context: null` with the bundle still 200; the `market_context` KEY is always emitted (`object|null`) | yes |
| `live-vs-static-isolation` | ai-context-pack | S | all four reads declared STATIC (bar/profile-derived; flow basis = the chain snapshot's cumulative volume, NEVER the SSE net flow); nothing rides SSE; the widget stays visible + UN-DIMMED on a stream drop (contrast with the dimming LiveTape) | yes |
| `theme-token-discipline` | ai-context-pack | S | the `MarketContext` widget + copy are token-only via the MUI theme; dark/light parity verified; zero hardcoded hex (structural source-scan test) | yes |
| `model-read-carries-its-assumptions` | ai-context-pack | S | every trend/shape/flow/ATR label + scalar carries its window / threshold / basis descriptor in-payload (self-describing export); the UI frames the pack "advisory context — not a forecast, not a scored signal, not a guarantee"; **2nd binding instance → GRADUATES** | yes |
| `digested-labels-not-raw-dump` | ai-context-pack | S | the TI read is a SMALL orthogonal set pre-digested into regime LABELS (direction/strength/momentum/concentration/balance/location/composition enums), not raw indicator values; the wire enum is authoritative (FE never re-derives a label from the scalar); no raw indicator/OHLC series in the UI (watch-list key) | yes |
| `additive-keeps-score-byte-identical` | iv-rank | S | new one-way leaf `apps/api/src/marketdata/` (`signals`/`engine`/`live`/`darkpool`/`chain_store` 0 diff + import none of it — grep/AST verified); `market_state.iv_rank` attached AFTER `generate_signals`; score/tier/`state_fingerprint` byte-identical (SPY served 83 / prime / `0e8884cc0a03`) with iv_rank present/null/absent — QA independently re-derived incl. a forced whole-store outage | yes |
| `best-effort-isolated-or-null` | iv-rank | S | store outage / insufficient history / write failure / no-current-IV → `iv_rank: null` or the honest `building` state, never a 5xx; the KEY always emitted (`object|null`); the write-through is best-effort (swallowed, never perturbs the bundle/cache/SSE); forced `IV_STORE=postgres`→unreachable-DB served 200 + null, `strike_profile` intact, boot survived (defer-fault-to-first-use) | yes |
| `live-vs-static-isolation` | iv-rank | S | STATIC daily read — nothing rides SSE (the SSE payload gains no field); the widget stays visible + UN-DIMMED on a stream drop (deterministic flow-spec contrast vs a dimming LiveTape) | yes |
| `model-read-carries-its-assumptions` | iv-rank | S | the rank read is self-describing — carries its window (sessions used) + total sample-count + IV-basis (`interpolated_30d`/`nearest_tenor` + `basis_dte`) in-payload + the advisory framing; never a bare number (FE guards it); the honest "building history — N of 20" state before the floor; degenerate-flat → `rank:null`+`flat_window`, never a fabricated "50"; **3rd instance** | yes |
| `digested-labels-not-raw-dump` | iv-rank | S | the rich/cheap `band` (`premium_rich`≥70 / `neutral` / `premium_cheap`<30) is a single digested closed-enum token cut server-side from the rank; the FE renders it via a closed lookup, never re-derives it from the scalar; NO raw IV history series on the wire or in the UI; **2nd binding instance → GRADUATES** | yes |
| `theme-token-discipline` | iv-rank | S | the `IvRank` widget + copy are token-only via the MUI theme; dark/light parity render-verified; zero hardcoded hex (structural `?raw` source-scan test) | yes |
| `additive-keeps-score-byte-identical` | outcome-ledger | S | the track record READS outcomes and is **never** a scoring input; enforced STRUCTURALLY, not by prose — 4 boundaries: **zero backend surface** (`apps/api` diff empty, conductor- + QA-verified: a statistic that never leaves the browser cannot reach `signals.py`) · the outcomes module is a **one-way leaf** with an enumerated forbidden-importer list, pinned by a `?raw` source-scan that **provably bites** (mutation-tested) · the ledger has **zero write functions** · its output is kept off the AI export/prompt in v1 | yes |
| `score-change-is-deliberate-and-measured` | outcome-ledger | S | **1st instance — as the rule's ENABLER, never its exerciser.** The feature measures whether the score is any good (the only honest input to a deliberate score change) and is **structurally incapable of making one**: no auto-tuning, no feedback loop, zero write functions. Promoted 2026-07-16 by owner canon review; this ship is what makes it actionable | yes |
| `loss-free-durable-migration` | outcome-ledger | S | **2nd instance** (1st = rebrand-convexa) — the archive import is **merge-only, idempotent, never-destructive**; a corrupt/unreadable blob degrades to empty **WITHOUT destroying the original**; and the feature **REFUSES to import into a store it cannot fully read** rather than let the store APIs rewrite (destroy) that blob — the refusal IS the invariant, surfaced as UX §5.9's class-B decline ("your existing data is the problem, and we will not touch it"). Promoted 2026-07-16 via the SEVERITY path at 1 instance; recurrence has now caught up to severity | yes |
| `best-effort-isolated-or-null` | outcome-ledger | S | a failed store read ⇒ `sources_complete:false` ⇒ a **partial** roll-up that says so — never a throw, never a silently-smaller M. The balance identities (`M == counted + Σ excluded_by_reason`) are **CI assertions, never runtime throws**. A corrupt blob ⇒ empty readout, never an error; bundle/SSE untouched | yes |
| `model-read-carries-its-assumptions` | outcome-ledger | S | **4th instance.** Every rate carries its sample count + basis + `N_min=20` floor + a **Wilson 95% interval**, cells never pooled, all-time non-rolling window (a selector would let the trader **shop for the flattering window** — the exact meta-decision failure the feature exists to fix); `building` shows a count and **nothing numeric** (AC-E3: a 3-for-3 cell must never render "100%"); a hit rate may **never** appear without its mean per-trade return + dispersion. The coverage counts are themselves a model read and carry their own basis (stores spanned, de-dupe identity, `sources_complete`, **derived** epoch) | yes |
| `digested-labels-not-raw-dump` | outcome-ledger | S | **3rd instance.** The capture digest is a **small closed set** (score · setups name+conviction capped 5 · persona · IV-rank **band** · regime · vol-regime · fingerprint) — **ATR excluded by decision** (a raw scalar with no digested band; this rule is what stops that slide). Wire labels render via a **closed lookup**, never re-derived from a scalar | yes |
| `no-real-order-path` | outcome-ledger | S | SIMULATED outcomes only; the read carries the **six named sim facts** (no slippage / partial fills / queue / assignment / fees; instant unlimited limit fills) **as part of the read, not a footnote** — sim P&L is not real fills, and the copy does not let the reader forget it | yes |
| `single-shared-sim-entry-dialog` | outcome-ledger | S | **HONORED (sim-only, as narrowed 2026-07-16).** The AI-rec attribution seam was threaded via **the host remembering what it prefilled** — the shared `TradeEntryDialog` is **untouched and unforked**; no second dialog, no variant added | yes |
| `server-side-gate-enforcement` | outcome-ledger | S | **HONORED by NOT building a gate.** With no server surface, an FE-only gate on the archive import would be **decorative** — enforcement theatre, which this rule forbids — so the import is deliberately **ungated** (AC-25) rather than wearing a check that enforces nothing | yes |
| `operator-vs-trader-path-separation` | outcome-ledger | S | **HONORED.** The track record is a **TRADER** surface (it informs trading decisions) and lives on `/positions` as its own in-page view — explicitly **NOT** `/_ops/metrics`. The rule keeps operator surfaces off trader routes; it does not make an analytics-shaped read operator-facing | yes |
| `live-vs-static-isolation` | outcome-ledger | S | the track record is a **STATIC historical** read: closed-only, so it does **NOT** dim on `streamOffline` (static reads keep rendering). The closed-only honesty rule and the isolation rule are **the same decision**. Verified non-vacuously — the live Net P/L's class flips on a real stream drop while the track record's `innerHTML` stays byte-identical | yes |
| `theme-token-discipline` | outcome-ledger | S | token-only via the MUI theme; zero hardcoded hex; **no semantic tint on any rate** (AC-14) — green/red on a hit rate manufactures a verdict the sample cannot support. Verified non-vacuously: a 90% cell and a 10% cell assert **identical `className`** (MUI `sx` compiles to classes, so `getAttribute('style')` is always empty — the vacuous-assertion trap the lane caught in its own tests) | yes |
| `theme-token-discipline` | redesign-stage-0 | S | every floor fix binds to CURRENT tokens (Stage 0 = correctness, not identity — zero new hex, QA diff-audited); the focus ring + 44px coarse-pointer floor land at the THEME layer (one authored rule), never per-component | yes |
| `additive-keeps-score-byte-identical` | redesign-stage-0 | S | FE-only; `git diff main -- apps/api` AND `-- libs/api` both EMPTY (QA re-verified) — the structural proof; score/tier/`state_fingerprint` unreachable by construction | yes |
| `live-vs-static-isolation` | redesign-stage-0 | S | the 3 distinct degraded states SURVIVED the mobile relayout — verified on a REAL stream kill at 393px ("⚠ Live offline — reconnecting…", live tiles → "⏸ offline", static chart + 19 stat reads persist un-blanked, scrollWidth 378 held while degraded); zero degraded-spec deletions/weakenings | yes |
| `single-shared-sim-entry-dialog` | redesign-stage-0 | S | mobile full-screen = 5 lines of breakpoint props on THE shared `TradeEntryDialog` — restyled, NOT forked (QA diff-audited) | yes |
| `no-real-order-path` | redesign-stage-0 | S | the landing hero reframed HONEST ("See the dealer positioning behind the price.") — no longer sells the unbuilt brokerage connect; coming-soon blocks stay non-navigating | yes |
| `theme-token-discipline` | redesign-stage-1 | S | **the rule's biggest exercise to date** — the ENTIRE identity swapped at `tokens.ts`/`theme.ts` with component edits confined to a closed 6-site rebind list; the mechanism IS what made it safe (QA: all 32 changed files in the permitted set, zero scope creep); the retired hexes (GitHub neutrals, old blues, violet, blog cream, old ink) added to a mutation-guarded BAN-LIST scan spanning app + index.html + blog OUTPUT — the banned tells are now build-breaking, not prose | yes |
| `additive-keeps-score-byte-identical` | redesign-stage-1 | S | FE-only; empty `apps/api` + `libs/api` diffs (QA re-verified); P/L success/error hexes BYTE-LOCKED by pin test — the identity swap structurally cannot touch direction semantics or scoring | yes |
| `live-vs-static-isolation` | redesign-stage-1 | S | degraded-state semantics survived the re-tint — true-drop walk on the NEW palette in LIGHT mode (complements Stage 0's dark walk): "⚠ Live offline" in the new icon-paired warning `#A65526`, ⏸ markers legible, static reads persist, 378px held | yes |
| `model-read-carries-its-assumptions` | redesign-stage-1 | S | **5th instance, applied to the DESIGN process itself** — every light-mode color pairing shipped with a MEASURED WCAG ratio (19 pairings recorded; QA independently recomputed all 19); the one failing §3 value was bounced minimally (`#C9821A`→`#C57F19`) and recorded in 3 places, never silently shipped or silently obeyed | yes |

> Note (GATE S, iv-rank, 2026-07-07): the THIRD item of the owner "enrich the downstream-AI's inputs" GATE I
> (owner pick 2026-07-06 (b); the 2026-07-02 runner-up, chosen after market-backdrop's index feed verified
> NOT_AUTHORIZED). IV Rank / IV Percentile — where a ticker's current IV sits within its own recent history
> (option premium rich vs cheap) — surfaced as the additive nested nullable `market_state.iv_rank`, AI-context
> + a Ticker static-family widget, NEVER a scoring input. **The crux:** the vendor has no historical IV → the
> feature accumulates its own, establishing the project's **FIRST persistent market-data store** — a new
> one-way leaf `apps/api/src/marketdata/` (port + `IvSample` record + on-disk-SQLite default [`IV_STORE=disk`,
> under `DATA_DIR`, survives restart] + a Postgres prod adapter behind the same port [runtime-env only,
> defer-fault-to-first-use; live-verify deferred like persistent-db — no local Postgres]), a best-effort
> write-through-on-serve accumulation (idempotent once-per-(ticker, UTC-day), no backfill) attached AFTER
> scoring, and the CM30 (~30d interpolated ATM IV off the already-computed term structure, no new vendor call)
> rank/percentile compute (≤252-session window, `N_min=20` floor, degenerate-flat handled honestly). Full
> pipeline (architect → PM → UX split → both lanes → GATE Q). **GRADUATION:** `digested-labels-not-raw-dump`
> reached its **2nd binding instance** (ai-context-pack + iv-rank's rich/cheap band) → promoted into CONTEXT §5
> + THREADS §9; removed from the watch list. `model-read-carries-its-assumptions` gained a 3rd instance; the
> four other touched keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`, `theme-token-discipline`) each gained an instance — no other graduation.
> **QA (GATE Q)** fresh de-correlated **Sonnet**: **PASS 19/19** (0 FAIL / 0 UNVERIFIABLE; conformance new
> standalone spec `iv_rank.json` PASS live [warmed URL] + offline [null-fault `--sample`]; byte-identity
> independently re-derived three ways incl. a forced whole-store outage; the computed + degenerate-flat states
> force-observed by seeding the disk store directly; AC↔test traceability non-vacuous; `nx test dashboard`
> 685/685 [+27] + `@org/api` 13/13, `tsc -b --force` clean, `nx build` green). **No FAIL → no GATE Z bounce**
> (both lanes' first-pass builds held under independent verification — a clean run, unlike the recent
> lane-interruption ships). **New descriptive property:** the "trading/bundle path stays stateless" narrowing
> now explicitly extends to a **market-data side-store** (the `chain_store` best-effort precedent made
> persistent) — the compute reads nothing from it; an empty/wiped store degrades to "building history," never
> an error. No demotion.

> Note (GATE S, ai-context-pack, 2026-07-06): the SECOND item of the owner "enrich the downstream-AI's
> inputs" GATE I (owner pick 2026-07-06) — **bundled** the two parked scored items (AI context-scalars pack
> + TI regime bundle) into one feature: the additive nested nullable `market_state.market_context` with four
> independently-nullable STATIC children (trend/momentum digested LABELS off Wilder ADX-14/RSI-14 + EMA
> stack; GEX-profile shape scalars off the already-computed profile; flow-vs-positioning divergence off
> today's UNSIGNED cumulative volume vs OI; multi-horizon ATR). New one-way leaf `context_pack.py`, attached
> AFTER scoring; daily-bars fetch 60→400d (no new env) + additive `UnderlyingBar` high/low/session; AI-context
> (rides the unchanged wholesale `serialize_context`) + a Ticker "Market context" widget; NEVER a scoring
> input. Full pipeline (architect → PM → UX split → both lanes → GATE Q). **GRADUATION:**
> `model-read-carries-its-assumptions` reached its **2nd binding instance** (dealer-flow-projection +
> ai-context-pack) → promoted into CONTEXT §5 + THREADS §9; removed from the watch list. New watch-list key
> `digested-labels-not-raw-dump` (1 instance — the TI-labels-not-raw-values design rule the 2026-07-02 GATE I
> named). The four already-canon keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`, `theme-token-discipline`) each gained an instance — no other graduation.
> **QA (GATE Q)** fresh de-correlated **Sonnet**: **PASS 26/26** (0 FAIL / 0 UNVERIFIABLE; conformance new
> standalone spec `ai_context_pack.json` + 8-spec no-regression sweep; byte-identity independently re-derived
> against the live feed; AC↔test traceability non-vacuous; `nx test dashboard` 658/658 + `@org/api` 13/13,
> `tsc -b` clean, `nx build` green). **Lane-interruption methodology note (system-10 kin):** BOTH executioner
> lanes were cut off by an API session limit **before self-reporting** — the "completed" notifications
> carried a session-limit banner, not a build report. The conductor treated them as UNVERIFIED and re-ran
> every gate, catching **3 FE test-ONLY defects** the cut-off lanes never ran into (component code correct):
> (1) two structural source-scans used `fileURLToPath(new URL(..., import.meta.url))` which throws in this
> Vitest env → Vite-native `?raw` import; (2) `toHaveLength(20)` vs the genuine **23** pinned enum values
> (7 label families, not 6); (3) an over-broad negative auth regex `/session/i` collided with the feature's
> own copy ("today's **session** cumulative option volume") + `queryByText` throwing on a legitimate multiple
> → narrowed to auth-CTA phrases + `queryAllByText`. Also a **stale `libs/api/dist`** (pre-rebrand
> `gammaflow.d.ts`) produced FALSE `@org/api` type errors under `tsc -p tsconfig.app.json` — cleaned +
> regenerated. **Lessons:** (a) a subagent "completed" whose result is a limit/quota banner is UNVERIFIED —
> re-run the gates, never trust it; (b) `tsc -b --force` (build-mode, regenerates referenced lib decls) is
> the reliable typecheck when `libs/api/dist` is stale — a bare `tsc -p tsconfig.app.json` resolves `@org/api`
> through the stale built `.d.ts`. **Latent finding logged (NOT this feature's regression):**
> `off_exchange.blocks[].age_seconds` drifts ~1s between identical-input runs (a pre-existing WALL-CLOCK
> display field, display-only + unscored → never touches score/tier/`state_fingerprint`); it only trips the
> byte-identity proof's stronger-than-needed "entire-bundle-identical" control, not the binding invariant.

> Note (GATE S, dealer-flow-projection, 2026-07-02): the first item of the owner "enrich the
> downstream-AI's inputs" GATE I — a projected dealer-hedging-flow read (charm limb = net_charm·days-to-
> next-monthly-OPEX; vanna limb = net_vanna at +1 and pre-scaled +5 IV-pt) built over the ALREADY-computed
> window-scoped higher-order greeks, surfaced as an additive nested nullable `market_state.dealer_flow_
> projection` — AI-context + a static-family ticker widget, NEVER a scoring input. Full pipeline
> (architect → PM → UX split → both lanes). Folded in the BACKLOG §B higher-order-greek **determinism fix**
> (`math.fsum` over charm/vanna/volga, scoped away from every scoring sum) — the pull that finally retired
> that latent item. **No new graduation** — the four touched keys are all already Promoted canon and each
> gained an instance: `additive-keeps-score-byte-identical` (signals.py 0 changes; byte-identity re-proven
> with/without AND before/after the fix), `best-effort-isolated-or-null` (per-limb + whole-object null,
> forced-exception → null, wild whole-null case), `live-vs-static-isolation` (STATIC, gex_spot basis, no
> `⏸` on SSE drop — FE contrast test), `theme-token-discipline` (token-only widget). QA (GATE Q) fresh
> de-correlated **Sonnet**: **PASS 17/17** (0 FAIL / 0 UNVERIFIABLE; conformance new standalone spec +
> 5-spec sweep; AC↔test traceability non-vacuous; AC-11/12/16/15 correctly BE-verified per the contracts,
> independently re-confirmed). **One post-QA conductor render-pass catch** (jsdom can't evaluate it, so the
> green suite couldn't): the two-limb grid wrote a container query as a responsive-VALUE key
> (`gridTemplateColumns: { xs, '@container (min-width:440px)': ... }`) — this Emotion version doesn't pass
> `@container` through, so it warned 12× AND never applied the 2-col layout. Fixed inline to the
> `repeat(auto-fit, minmax(210px,1fr))` idiom the sibling `DealerPositioning` already uses (render-verified
> two-column + console clean; suite held 617/617). **Lesson (methodology): a container-query / layout CSS
> path is invisible to jsdom — the real-browser render pass is the only gate that catches it** (kin to the
> system-10 mock-default lesson: the green suite vouches only for what the test environment can execute).
> New watch-list candidate `model-read-carries-its-assumptions` logged.

> Note (GATE S, owner 5-item program items 1–4: light-mode-parity + sim-entry-unification +
> ai-rec-backtest-orders, 2026-07-02): items shipped `8abae03` / `d704193` / `5391517` (all pushed to
> `main`); folders archived. **TWO GRADUATIONS:** `single-shared-sim-entry-dialog` (2 binding — the
> unification created it, the order variant honored it) and `theme-token-discipline` (≥3 features
> since watch-listed at convexa-redesign) → both promoted into CONTEXT §5 + THREADS §9.
> The five already-canon keys each gained an ai-rec-backtest-orders instance — no other graduation.
> ai-rec-backtest-orders: QA (GATE Q) fresh de-correlated Sonnet — **PASS 48/48** (0 FAIL, 0
> UNVERIFIABLE; conformance new standalone spec + 5-spec no-regression sweep; AC↔test traceability
> non-vacuous; all 5 invariants verified live + at source). GATE Z ×2 accepted (FE-flagged):
> `provenance.scenario_name` added to arch §2; `RecStatus.scenarios` optional-typing resilience
> noted on the interface. **One post-QA conductor render-pass catch (system-10 recurrence):** the
> AiRecPanel `!inAppEnabled` branch lacked the `!scenarioSelected` exemption — on a keyless
> deployment (the harness's PRIMARY environment) "Run scenario" was disabled; the mocked test
> boundary hardcoded `in_app_enabled:true`, so a green 594-test suite hid it. Conductor inline fix
> (mirrors the cap/cooldown bypass; precedent: the 7m stagger catch) + a harness override + named
> test `run_scenario_not_blocked_by_no_key_availability` → 595/595; the fixed path then
> render-proven live end-to-end (9-entry picker → real gate honored via Ask-anyway → scripted rec →
> Act → Waiting order watching live → Positions panel → two-step cancel → History; light theme via
> server-wins flip). **Lesson (system-10, again):** a hardcoded mock default is an untested
> integration STATE — when a wire field gains semantics, the test harness must expose it as a
> configurable axis, or the green suite silently vouches for one world only.
> already-merged ticker FE branches (`ticker-microinteractions` 418315a, `ticker-widgets` 9c66d2e→75b967e,
> `ticker-command-deck` c481c38) **plus** the post-merge external-pipeline commit `c93dddc` (ai-rec
> structured recommendation display + gated dev demo-account seed). The consolidation QA the prior session
> named as the pre-merge gate had been skipped (the stack fast-forwarded to `main`); this pass ran it
> retroactively on a **fresh de-correlated qa-verify (Sonnet)**. **No new graduation** — every touched key is
> already Promoted canon and gained an instance: `additive-keeps-score-byte-identical` (the ticker stack is
> `apps/api`-diff-empty; `c93dddc`'s backend delta never touches the scoring modules — AST 0/4, live cold==warm
> byte-identity re-proven), `best-effort-isolated-or-null` (the gated `SEED_TEST_ACCOUNT` dev seed is
> off-by-default + refuses postgres + never crashes boot; the additive AI-rec `summary`/`key_points`/
> `reengage_when` fields are bounded/nullable), `live-vs-static-isolation` (the new live motion/flash freezes
> on an SSE drop; reduced-motion honored), `no-real-order-path` (widget grip/⋮/add are affordance-only
> coming-soon; the dev seed's positions are client-local sim), `operator-vs-trader-path-separation` (untouched).
> Runtime interface conformance **11/11** across 4 specs; the `personas.assemble()` `sections`→`widgets` rename
> confirmed **dead-key/cosmetic** (no endpoint returns it, no FE consumer reads it); `demo_seed` additive +
> null-safe. **The one QA FAIL was a real regression, not a doc nit:** FRONTEND_EXECUTION_CONTRACT §3's
> staggered section reveal shipped in 418315a and was **silently dropped by 9c66d2e** when the sections were
> restructured into the bento/`Widget` grid — with **zero test covering the stagger**, so it regressed through
> a green suite. Bounced (GATE Z) + fixed inline by the conductor (`revealIndex` → inline `--widget-reveal-delay`
> → `widgetRise` delay; removed the displacing scroll-timeline override; 4 new guarding tests) → **GATE Q
> RE-RUN PASS 16/16** (nx test dashboard 486/486, tsc/lint/build green, render pass confirms the 0→385ms
> cascade in Chromium, commit `11e8ec3` pushed to `main`). **Lesson reinforced (system-10, AC↔test
> traceability):** a motion/visual AC with no named test is exactly where a later refactor silently regresses
> — the render pass caught it, and the fix adds the missing test. `theme-token-discipline` (watch list) held
> again (zero hardcoded hex across the changed ticker scope).

> Note (GATE S, redesign-stage-1, 2026-07-22): Stage 1 — the Curvature Terminal lands at the token layer.
> Ink `#0B0F17`/panel/phosphor/steel, **gammaAmber `#F2A93B` dominant** (ink contrastText), signal-blue
> links (slot-level `MuiLink` default), warnings → burnt orange + icon-always; Archivo (real wdth-axis
> `font-stretch`, no faux) + IBM Plex Sans/Mono self-hosted (OFL verified, swap, preloads, zero external
> URL); light parity DERIVED under a **measured 19-pairing contrast gate** — one pre-authorized bounce
> (`#C9821A` 2.90:1 FAIL → `#C57F19` 3.02/3.27 PASS, recorded ×3); theme-audit gaps closed (explicit
> secondary kills the MUI purple leak, contrastText, light text.primary, dark shadows ladder); blog
> re-skinned VIA THE GENERATOR (both outputs regenerated); `sync-figma-tokens.mjs` **DELETED** (conductor
> override of §10-9 — inverted authority post-§6a-3); the old one-amber-three-meanings trap resolved by a
> CLOSED forced-rebind list (flip→amber the one amber line, spot→steel, live→signal — computed strokes
> verified). **No graduation** — 4 keys, all canon, each gained an instance (rows above; note
> `model-read-carries-its-assumptions` now applied to the design process itself). QA (GATE Q) fresh
> de-correlated **Sonnet: PASS** — battery re-run, all 19 ratios INDEPENDENTLY recomputed (matched incl.
> the bounce), 5 new specs read+run+mutation-verified (30/30), diff confinement 32/32 files in the
> permitted set, §10 rulings 9/9 honored; caught 1 of 29 lint warnings as NEW-not-pre-existing (under the
> 0-errors bar; honest). Suite 63/523. Conductor render pass: computed identity values + chart strokes +
> both-mode theme-color + the light-mode true-drop degrade walk. **Named residual (accepted, not hidden):**
> the blog articles' inline SVG ILLUSTRATIONS still carry cream/terracotta artwork styling (out of
> template-only scope) → follow-up "regenerate blog artwork onto the system" (§7u seam). Twice-evidenced
> methodology gotcha now standing: uvicorn survives a PID kill (respawn/wrapper) — kill by IMAGE and
> `curl`-confirm dead before trusting any degrade observation.

> Note (GATE S, redesign-stage-0, 2026-07-22): Stage 0 of the Q4(a) "Curvature Terminal" program — the
> quality-floor repair (correctness, not identity): 393px overflow killed (580→378, root causes the bento
> track `1fr`→`minmax(0,1fr)` + toolbar wrap + an sr-only `width:1`=100% MUI bug), hamburger/drawer nav
> (folded the parked `feat/responsive-layout`, one mechanical conflict — `app.spec.tsx` deleted on main by
> the test migration, intent re-expressed in `app.risk.spec.tsx`), theme-layer `:focus-visible` rings,
> semantic repair (29 `<h6>` stat values → 0 + `<main>`), 11px/44px floors (+5 sub-floor rem sites swept
> beyond the contract's enumeration), honest copy (hero/settings/"last last" — the typo was the FE
> double-prefixing a wire field), theme-color-follows-mode. **NO new graduation** — the five touched keys
> all already canon, each gained an instance (rows above). GATE V fast-path (UX → FE), first program run
> under the `convexa-design` skill as rule-of-record + the v0.6.1 FE identity opener. QA (GATE Q) fresh
> de-correlated **Sonnet: PASS 6/6 scope items · 15/15 §8 matrix** (battery independently re-run; Cypress
> 12/12 mobile enforcement — the §8.1 first run FAILED and caught 3 real offenders before passing; §10's 5
> pre-ruled questions honored 5/5; conformance n/a-and-correctly-absent). Conductor render pass (Playwright)
> incl. a TRUE-drop offline walk at 393 — first probe showed no degradation because **3 orphan uvicorn
> processes were still serving :8000** (the Windows orphan-server gotcha; methodology note in
> RENDER_PASS.md), a clean kill fired the watchdog exactly to spec. Post-merge battery re-run green
> (58/493 — main had just received the LatencyTrend spin-off PR #1). Two recorded judgment calls:
> Cypress-for-Playwright substitution (repo's e2e runner — enforcement intent met) and the
> `pointer: coarse`-gated touch floor. Stages 1–3 pending, each its own folder.

> Note (GATE S, convexa-redesign, 2026-06-30): the full **presentation-only** FE re-skin to the Figma DS
> (all surfaces + theme/token bridge + app-wide contained-button treatment), merged to `main`. **No new
> graduation** — it is FE-only (`apps/api` diff vs main EMPTY), so `additive-keeps-score-byte-identical` is
> structural (score/tier/`state_fingerprint` byte-identical, verified by the passing byte-identity test +
> the empty backend diff); `no-real-order-path` reaffirmed (sim dialogs + locked Live tab, no order path);
> `live-vs-static-isolation` preserved through the re-lay-out. All three are already Promoted canon → each
> gained an instance, no new promotion. **Token discipline** ("reskinned components bind to the MUI
> theme/`tokens.ts`, never hardcoded hex") recurred hard across this program (drawer rebind + button
> treatment + dialog) — logged to the watch list as `theme-token-discipline` (candidate; FE-redesign-class,
> judge on cohesion not trading edge). QA (GATE Q) fresh de-correlated: PASS (425/425, `nx build` green,
> tsc clean). A pre-existing TS17001 build blocker (duplicate `sx`, `SettingsPage.tsx`) was caught by the
> pre-merge typecheck/build gate that Vitest doesn't run — reinforces "run `tsc`/`nx build` at GATE Q, not
> just the test suite." Owner-dropped the `/auth` full-page route (feature scope, not a canon change).

> Note (GATE S, deploy, 2026-06-29): step 3 of the infra program — the deploy ARTIFACTS + security
> hardening (the live deploy itself is the owner applying the runbook). Railway (backend container +
> Postgres) + Cloudflare Pages (frontend) wired via a streaming Pages Function proxy (`/api/*`→Railway,
> SSE-safe; client uses relative `/api`, so zero client change). Repo changes R1–R4: `$PORT`-honoring CMD,
> env-gated CORS (`ALLOWED_ORIGINS`), the Pages Function, edge-block of `/api/_metrics`. **system-6
> Security/red-team ACTIVATED for the first time** (the deferred role, triggered by going public; run on a
> different model) → verdict **GO-WITH-REQUIRED-FIXES**: 3 HIGH closed before ship — HIGH-1 token-gate
> `/api/_metrics` (`METRICS_SECRET_TOKEN`), HIGH-2 per-IP rate-limit on the anon cost-bearing
> `/api/ticker`+`/api/stream` (`PUBLIC_RATE_LIMIT_PER_MIN`, owner-chosen; fail-open leaf, 429-before-vendor),
> HIGH-3 startup WARNING when `ACCOUNT_STORE=postgres` + a stable key is missing; +3 MED/+3 LOW logged as
> fast-follows (SECURITY_REVIEW.md). **GRADUATION:** `no-secrets-in-image` hit its 3rd binding instance
> (real registry push) → promoted into CONTEXT §5 + THREADS §9. `additive-keeps-score-byte-identical` gained
> an instance (already canon). **Pending owner action:** apply the runbook (create the Railway service +
> Postgres, set the env/secrets incl. the new `METRICS_SECRET_TOKEN`/`PUBLIC_RATE_LIMIT_PER_MIN` + stable
> keys, set the Cloudflare build + `API_ORIGIN`) → then the live smoke test. Not yet live.

> Note (GATE S, persistent-db, 2026-06-29): the in-memory→Postgres persistence swap (psycopg3 sync raw-SQL
> adapter behind the existing 4 auth ports; `ACCOUNT_STORE=postgres`+`DATABASE_URL`; in-memory stays default;
> DB-outage fail-closed for auth / trader path stays up). Infra fast-path (architect → backend build →
> conductor static review; PM/UX skipped). **Live-Postgres verify DEFERRED** (no Postgres in the dev box) —
> verified by the in-memory-default conformance (no regression) + statement-level SQL parity review + the
> ciphertext-only/leaf-boundary AST checks. **GRADUATION:** `secret-encrypted-at-rest` reached its 2nd
> binding instance (byo-ai-key → persistent-db held the ciphertext-only boundary across a NEW store) →
> promoted into CONTEXT §5 + THREADS §9. `additive-keeps-score-byte-identical` + `best-effort-isolated-or-null`
> each gained an instance (already canon). `no-secrets-in-image` hit 2 instances but is **deliberately held**
> to the `deploy` feature (it governs *published* artifacts; nothing's been pushed yet). **Deferred seam
> named:** the per-admin AI metering counters are process-local (NOT behind the stores) → not shared across
> replicas; centralizing them is a future item, out of scope here. system-6 (adversarial review of the
> persistence/deploy + credential surface) still lands at go-live.

> Note (GATE S, byo-ai-key, 2026-06-29): the hybrid bring-your-own AI-key feature — per-user encrypted
> Anthropic keys (own-key-first), admin-only free allowance (default 3/day) on the shared key, the 5-state
> resolution incl. `shared_key_unconfigured`. **GRADUATION:** `server-side-gate-enforcement` reached its
> **2nd binding instance** (user-accounts AC-E7 catch → byo-ai-key's server-authoritative credential/rec
> gating) → promoted into CONTEXT §5 + THREADS §9 (Promoted canon above); removed from the watch list. A
> satisfying loop closure: a key the QA role *surfaced from a failure* (AC-E7) recurred and graduated. The
> two already-canon keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`) each gained
> an instance — no new graduation from them. New watch-list key `secret-encrypted-at-rest` (1 instance;
> will recur on broker-connect). QA (GATE Q) on Sonnet, de-correlated: initial FAIL on AC-19 (uncovered by a
> named test though the behavior worked) → bounced → FE added the test → **RE-RUN PASS 26/26**, security
> floor + score byte-identity + conformance all clean. `system-6` (Security/red-team) stays DEFERRED
> (encrypt+hygiene floor enforced) — but credential custody (encrypted user keys) makes byo-ai-key its
> eventual first client at the go-live trigger.

> Note (GATE S, rebrand-convexa, 2026-06-28): the GammaFlow→Convexa rebrand was **completed** — extended
> from UI-only to the whole codebase (134 refs / 51 files): identifiers, the `gammaflow.ts`→`convexa.ts`
> client, logger/title/ContextVar, docs/README/CLAUDE.md, `project.json` `project_name`, and a **loss-free
> migration of the 4 durable localStorage keys** `gammaflow.*`→`convexa.*`. **REVERSES the earlier
> "Convexa = UI-only / don't rename code/keys" decision** (app-shell-landing GATE-S note above; CONTEXT
> §1/§6, THREADS §7d) by deliberate owner choice (2026-06-28). It was a **feature decision, not a
> Promoted-canon key**, so it is **updated in place** (CONTEXT §1 brand line + the feature-state UI-only
> notes annotated "superseded"; THREADS §7d/§7g) — **NOT** moved to the Demoted table. New watch-list key
> `loss-free-durable-migration`. The three logged keys (`additive-keeps-score-byte-identical`,
> `best-effort-isolated-or-null`, + the new migration key) — the two canon keys gained an instance, no new
> graduation. QA (GATE Q) on Sonnet, de-correlated: **23/23 ACs PASS**, conformance unchanged, dashboard
> 283/283 + @org/api 7/7. STAYS unrenamed (non-goals): `@org/*` scope, `DATA_DIR`, the local working
> folder, and archived-contract/ledger history (provenance).

> Note (GATE S, user-accounts, 2026-06-25): the project's **first stateful backend surface + first
> credential store** (email/username+password auth, server-side sessions, per-user light prefs, Google
> OAuth wired-but-config-gated-OFF, in-memory SQLite behind a swap seam; hybrid access — anonymous
> browsing open, the sim Positions write actions + the "ask AI" call require a session). The three touched
> promoted keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `no-real-order-path`) each gained an instance → **no new graduation** (all already canon);
> `no-real-order-path` is now at **3 binding instances**. The `best-effort-isolated-or-null` instance
> carries an explicit **CARVE-OUT** (auth endpoints legitimately return real HTTP statuses — a NEW class,
> not the bundle null-rule), documented in CONTEXT §5 and the row above; this refines the rule's scope
> without demoting it (the trading-path guarantee is untouched and reaffirmed). **Descriptive-property
> narrowing (NOT a promoted-canon demotion):** the informal "stateless server" property is narrowed in
> CONTEXT §2/§5 to "the **trading/bundle path** stays stateless; auth introduces a contained, swappable
> state store outside that path." It was never a Promoted-canon key (no Demoted-table move). New watch-list
> key `server-side-gate-enforcement` logged (the AC-E7 GATE Q catch). QA (GATE Q) on Sonnet, de-correlated:
> initial FAIL on AC-E7 (FE-only gate) → bounced (GATE Z) → FE wired the server gate → **GATE Q RE-RUN
> PASS** 30/30, conformance 2/2, `dashboard` 246/246 + `@org/api` 7/7.

> Note (GATE S, ticker-load-experience, 2026-06-25): perf + UX refinement of the ticker page (chain
> pre-warm 7.8s→1.2s, fetch concurrency, request-coalescing, skeleton-first load, live last-trade). The
> three already-canon keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`) each gained an instance → **no new graduation**. The notable decision is a
> **system-7 NARROWING** of the THREADS §9 resolved decision "Live spot = NBBO mid — do not add
> last-trade": by explicit owner decision (2026-06-25) the rule is narrowed to "the **mid stays the
> anchor** for headline/levels/flip; a **display-only last-trade readout MAY be added** beside it." Not a
> promoted-canon key (it lived in THREADS §9 "Resolved", not the Promoted table), so it is narrowed in
> place in THREADS §9 + PROJECT_CONTEXT §5 rather than moved to the Demoted table; the anchor decision
> itself stands. Letting last-trade drive the anchor/levels/flip remains a GATE-Z reversal.

> Note (GATE S, app-shell-landing, 2026-06-24): pure FE restructure + rebrand (Convexa, **UI-only** — no
> code/package/store-key rename). The five binding keys above each gained an instance but are all already
> canon → **no new graduation**. `operator-vs-trader-path-separation` is now at 3 instances
> (backend-observability, latency-visualizer, app-shell-landing).

> Note (GATE S, positions-portfolio, 2026-06-24): `no-real-order-path` reached **2 binding:yes instances**
> (ai-recommendations, positions-portfolio) → crossed the "≥2 if all binding" threshold → **GRADUATED** by
> the Orchestrator into CONTEXT §5 + THREADS §9 (Promoted canon above); removed from the watch list. The
> three already-canon keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`) each gained an instance but are already canon → no new graduation this ship.

> Note (GATE S, latency-visualizer): `operator-vs-trader-path-separation` reached **2 binding:yes
> instances** (backend-observability, latency-visualizer) → crossed the "≥2 if all binding" threshold.
> **RESOLVED — GRADUATED by the Orchestrator 2026-06-23** into CONTEXT §5 + THREADS §9 (see Promoted
> canon above). The executioner detected/flagged; the Orchestrator held the promotion pen.

> Note (GATE S, ai-recommendations, 2026-06-23): first **DEMOTION** (system-7). `ai-external-no-llm`
> ("GammaFlow does not call an LLM") is contradicted by `ai-recommendations` — by explicit owner decision,
> GammaFlow now calls an LLM as an isolated/gated/advisory consumer. The rule is **NARROWED** (not erased)
> in CONTEXT §8 and moved to the Demoted table; provenance rows retained. DETECT tally: the three
> promoted keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`) each gained an instance but are already canon → **no new graduations** this
> ship; `no-real-order-path` logged to the watch list (1 instance).

> **GATE S tally — outcome-ledger (2026-07-16).** **NO new graduations:** all 12 keys this feature logged
> are **already promoted canon**. Instance counts moved: **`loss-free-durable-migration` 1 → 2** ·
> **`model-read-carries-its-assumptions` 3 → 4** · **`digested-labels-not-raw-dump` 2 → 3** ·
> **`score-change-is-deliberate-and-measured` 0 → 1** (its first instance — as the rule's *enabler*, never
> its exerciser). New watch-list key: **`structural-over-prose-enforcement`** (1 instance, not promoted).
> **Worth recording — the severity path validated itself:** `loss-free-durable-migration` was promoted
> **2026-07-16 at 1 instance on SEVERITY**, over the objection that recurrence had not been met. The very
> next feature became its **2nd binding instance** — and did so in the sharpest possible way: it had to
> **REFUSE an import** rather than let the store APIs rewrite an unreadable blob. Under the old
> recurrence-only rule the key would still have been on the watch list **while the feature that needed it
> was being built**. Recurrence has now caught up to severity; the call did not depend on that, and would
> have been right regardless.
> **Also of note:** this ship exercised the amendment loop **four times** (A1, A2, A3, PM §11.6) plus two UX
> copy rulings — every one of them raised by a *downstream* lane refusing to decide out of its own lane, and
> every one of them a real defect. See `OPEN_THREADS.md` §7t.

> Seeded retroactively 2026-06-22 from the five archived features (`OPEN_THREADS.md` §3–§7). Going
> forward, the Orchestrator appends a row per binding decision at each gateway (ORCHESTRATOR §0 step 7).
