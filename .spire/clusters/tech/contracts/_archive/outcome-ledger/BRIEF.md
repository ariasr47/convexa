# outcome-ledger — brief
Goal:            Close the **trading-outcome loop**: the project has a superb compounding memory for how it
                 BUILDS (`DECISION_LEDGER.md`) and **none for whether what it built WORKS**. Harvest the
                 append-only `DecisionRecord[]` + closed positions/orders the app ALREADY writes, join each
                 entry to what actually happened, and surface an honest **hit-rate / expectancy readout by
                 tier** (and, once captured, by setup / persona / AI-rec / IV-rank band) with **explicit
                 sample counts**. Answers the question nothing in the app can answer today: *is the
                 opportunity score any good?* The `DecisionRecord` docstring already reads "exportable (for
                 a future back-test of AI-assisted edge)" — this realizes the seam its author designed for.
Decision impact: Improves the **meta-decision that conditions every other decision**: which of our own
                 signals deserve trust. Concretely — should the trader act on a Prime tier? Is an AI rec
                 worth taking? Does a "pin confluence" setup pay? Today all of these are asserted, never
                 measured: `DEFAULT_GATE_SCORE = 50`, the `40/25/25/10` score weights and `8.0`/setup were
                 hand-tuned at the start and **have never been checked against a single outcome**.
                 *Observed via:* a readout showing e.g. "prime: 58% · +0.4R over 24 closed trades · watch:
                 41% over 61" — with the sample count always visible, and an honest "insufficient sample"
                 state instead of a fake number. Also the ONLY honest input to a future score change
                 (`score-change-is-deliberate-and-measured` requires a measured before/after — you cannot
                 improve a score you cannot measure).
Feasibility:     **pass, with ONE crux the architect must resolve (ground-truthed against the code):**
                 **(a) Retroactively analyzable TODAY** — `DecisionRecord` (append-only, versioned) already
                 carries per event: `tier`, `position_fingerprint`, `pl_dollar`/`pl_pct`, `mark_price` +
                 `mark_basis` (so modeled/theoretical fills can be excluded or flagged), `underlying_spot`,
                 `ai_verdict`/`verdict_id`/`user_choice` (accept vs reject!), and `position_id` on
                 `order_filled` (the order→position join). `GhostTrade` carries `entry_mark`/`entry_time`/
                 `realized_pl_*`/`close_time`; `Position.origin_order_id` backlinks the order.
                 **(b) NOT captured — needs accumulation from ship (the iv-rank shape):** the
                 `opportunity_score` **scalar** at entry (only the bucketed `tier` is recorded), the
                 **setups** that fired, the active **persona**, and any enrichment read (IV-rank band,
                 regime, ATR). So "by tier" works on existing data; "by score / setup / persona / IV band"
                 requires an **additive capture extension** and starts empty with an honest **"building
                 history"** state — exactly iv-rank's precedent. The architect decides the capture set (keep
                 it SMALL — `digested-labels-not-raw-dump` applies) and the schema-version bump.
                 **(c) THE CRUX — storage locus.** The outcome data lives in localStorage, which
                 `[loss-free-durable-migration]` was just promoted (2026-07-16, severity path) to protect
                 precisely because it has **no server backup**. An outcome ledger built on that store
                 inherits that fragility — and outcome history is the one dataset that gets more valuable
                 the longer it lives, so losing it is worse than losing a position. The architect must
                 choose: client-local (consistent with the sim path + privacy, but fragile + per-browser)
                 vs the **persistent store** precedent (`apps/api/src/marketdata/`, disk-SQLite default +
                 Postgres behind one port — established by iv-rank) vs export-only. **A per-user server
                 store also crosses `server-side-gate-enforcement`.** Sample size is thin (personal sim
                 use) — the honest-state design matters more than the math.
Effort:          L
Invariant watch: **`additive-keeps-score-byte-identical` (HARD)** — the ledger READS outcomes; it is
                 **never a scoring input**. ⚠ **No auto-tuning / no feedback loop into the score in v1** — a
                 measured outcome informs a *deliberate human* score change via
                 **`score-change-is-deliberate-and-measured`** (promoted 2026-07-16); this feature is that
                 rule's **enabler, not its exerciser**, and must not close the loop automatically. ·
                 **`loss-free-durable-migration`** (promoted 2026-07-16, SEVERITY — directly in scope: this
                 feature touches durable stores and may bump their schema; **never-delete, promote-forward,
                 never-throw**) · **`model-read-carries-its-assumptions`** (a hit-rate over 12 trades is a
                 model read — it MUST carry its sample count / window / basis and be framed advisory, never
                 a guarantee; an underpowered stat presented as fact is the main way this feature could do
                 harm) · `best-effort-isolated-or-null` (a corrupt/absent history → empty readout, never an
                 error, never breaks bundle/SSE) · `digested-labels-not-raw-dump` (if fed to the AI: a small
                 digested set, not a trade dump) · `no-real-order-path` (SIMULATED outcomes only — and be
                 explicit that sim P&L ≠ real fills; `mark_basis` is how you stay honest) ·
                 `server-side-gate-enforcement` (if it persists per-user server-side) ·
                 `live-vs-static-isolation` (a STATIC historical read) · `theme-token-discipline` ·
                 `operator-vs-trader-path-separation` (architect calls it: this is a **trader** surface, not
                 a diagnostic — do not park it on `/_ops/metrics`).
Context tags:    architecture,features,decisions,ai,data,ghost-trade,personas
Entry point:     **architect-first** — the storage locus (crux c), the capture-extension set (crux b), and
                 the join/attribution model bound the whole feature; PM/UX follow on that skeleton. The
                 honest small-sample presentation is the main product risk and should be shaped by PM/UX
                 AFTER the architect fixes what is measurable.
Source:          Conductor canon review 2026-07-16 (owner agreed on every point). Realizes the OPEN_THREADS
                 §D seam "per-persona acceptance analytics (decision-history harvest)" and the
                 `DecisionRecord` docstring's own "future back-test of AI-assisted edge". **Displaces
                 `scanner` a 6th time — deliberately, and reversibly:** scanner makes us a *faster* picker
                 using a score nobody has validated (it scales an unmeasured judgment across N tickers);
                 this measures whether the judgment is worth scaling. If the score is good, scanner is
                 worth more afterward; if it is not, scanner would have multiplied the error. `scanner`
                 stays queued with its BRIEF + manifest intact — **not dropped**.
