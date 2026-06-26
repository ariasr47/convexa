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
- **Threshold:** a key present in **≥3 distinct shipped features**, OR **≥2 if every instance is
  `binding:yes`**, graduates at the next GATE S.
- **Binding-only intake:** only a decision a *future feature could violate* enters the ledger (same
  bar as the GATE I decision-impact cull). Incidental implementation choices are not logged.
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

> Pre-existing canon (recorded by the ledger, already a rule before it existed — not re-promoted):
> `dark-pool-context-only` (THREADS §9) · `gamma-sourcing-split` (CONTEXT §3 / THREADS §9).
> (`ai-external-no-llm` was here until **2026-06-23** — now **DEMOTED / narrowed** by `ai-recommendations`;
> see the Demoted table.)

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
- **`server-side-gate-enforcement`** (1 instance — user-accounts, 2026-06-25) — an access gate on a
  state/cost-bearing ACTION must be enforced **server-side**, not FE-only (a bypassed client check must
  still be rejected at the server boundary). Surfaced by the GATE Q catch on AC-E7 (the Positions
  sim-trade write gate was FE-only until the FE was bounced to call `POST /api/positions/sim-trade/gate`).
  Likely to recur on Track B `broker-connect` (real-account gates). Not promoted (1 instance); logged so
  recurrence is mechanical. *binding:yes.*
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

> Seeded retroactively 2026-06-22 from the five archived features (`OPEN_THREADS.md` §3–§7). Going
> forward, the Orchestrator appends a row per binding decision at each gateway (ORCHESTRATOR §0 step 7).
