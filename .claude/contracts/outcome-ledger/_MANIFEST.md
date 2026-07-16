# outcome-ledger — pipeline manifest
Entry:        architect-first
Stage:        GATE A·X — Architect exit; ARCHITECTURE_CONTRACT locked, routing to the PM
Repos:        **frontend ONLY** (architect resolved crux 1: `NO_BACKEND_CHANGE`, empty `apps/api` diff —
              client-local derived read, ZERO new durable keys, no server store. The empty backend diff is
              itself the structural no-auto-tuning guarantee: a statistic that never leaves the browser
              cannot reach `signals.py`.)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked (662 lines; compressor #2 applied — it IS the PM-targeted handoff)
  - PRODUCT_CONTRACT.md        n/a (next artifact — GATE P·X; 13 open questions enumerated for the PM)
  - UX_BLUEPRINT.md            n/a
  - INTERFACE_CONTRACT.md      n/a
  - BACKEND_EXECUTION_CONTRACT.md   n/a
  - FRONTEND_EXECUTION_CONTRACT.md  n/a
Conformance:  n/a until GATE U·X — and only if the architect puts state server-side. **system-12 applies if
              so:** the runnable convention is a standalone `.claude/tools/conformance/{feature}.json`
              (precedent `iv_rank.json`), NOT an embedded block. Reconcile the authoring docs first.
Open amendments: none
QA (GATE Q):  n/a
Invariant watch (from BRIEF): `additive-keeps-score-byte-identical` (HARD — reads outcomes, **never** a
              scoring input; **no auto-tuning / no automatic feedback loop into the score in v1**) ·
              **`score-change-is-deliberate-and-measured`** (NEW 2026-07-16 — this feature is that rule's
              **enabler, not its exerciser**) · **`loss-free-durable-migration`** (NEW 2026-07-16, SEVERITY
              path — directly in scope; may bump durable schema) · `model-read-carries-its-assumptions` (a
              small-sample hit-rate MUST carry its sample count/basis — the main way this feature could do
              harm) · `best-effort-isolated-or-null` · `digested-labels-not-raw-dump` · `no-real-order-path`
              (SIMULATED outcomes only; sim P&L != real fills) · `server-side-gate-enforcement` (if per-user
              server state) · `live-vs-static-isolation` (static historical read) · `theme-token-discipline` ·
              `operator-vs-trader-path-separation` (this is a TRADER surface — not `/_ops/metrics`)
Architect crux (3, from the BRIEF — ground-truthed against the code, not assumed):
  1. **Storage locus** — client-local (fragile, per-browser, no backup — the very risk
     `loss-free-durable-migration` was promoted for) vs the persistent store precedent
     (`apps/api/src/marketdata/`, disk-SQLite default + Postgres behind one port, established by iv-rank)
     vs export-only. Outcome history gets MORE valuable with age, so losing it is worse than losing a
     position.
  2. **Capture extension** — `DecisionRecord` already carries `tier` + `position_fingerprint` + P/L +
     `mark_basis` + `ai_verdict`/`user_choice` (so **"by tier" is retroactively analyzable on existing
     data**). NOT captured: the `opportunity_score` scalar, the setups that fired, the active persona, any
     enrichment read → those need an additive capture + start empty ("building history", the iv-rank shape).
     Keep the set SMALL.
  3. **Attribution/join + honest small samples** — sim volume is thin; an underpowered hit-rate shown as
     fact is the product risk. `mark_basis` (`modeled`/`theoretical`/`manual`) must be excluded or flagged,
     never silently counted as a real fill.
Notes:        **Displaces `scanner` a 6th time — deliberate + reversible** (owner-agreed at the 2026-07-16
              canon review). Rationale: scanner scales an unmeasured judgment across N tickers; this
              measures whether the judgment is worth scaling. `scanner` keeps its BRIEF + manifest and stays
              queued — NOT dropped. Effort L.
              Realizes the OPEN_THREADS §D "per-persona acceptance analytics" seam + the `DecisionRecord`
              docstring's own "exportable (for a future back-test of AI-assisted edge)".
Architect resolutions (GATE A·X, 2026-07-16 — the 3 cruxes, all closed):
  1. **Storage locus → client-local derived read; ZERO new durable keys; NO server store.**
     `apps/api/src/marketdata/` rejected as a **category error** (ticker-keyed, non-user,
     anonymous-readable market data vs per-user trading history, which belongs behind the auth leaf's port
     discipline or nowhere). A per-user server store crosses `[server-side-gate-enforcement]` and is the
     already-named §7f seam that must carry all ~5 stores together, not one. **The durability cost is paid
     in-scope instead:** a complete, versioned, round-trippable archive spanning all three stores (export +
     **merge-only, idempotent, never-destructive** import). Zero widenings of the stateless-trading-path
     narrowing.
  2. **Capture → a small OPTIONAL digest on 5 decision-point events; NO `SCHEMA_VERSION` bump; no backfill.**
     Score scalar · setups (name+conviction only, capped 5) · persona · IV-rank **band** (the wire label,
     never re-derived) · regime · vol-regime · `state_fingerprint`. **ATR excluded by decision** — a raw
     scalar with no digested band; `[digested-labels-not-raw-dump]` is what stops that slide.
     **Presence of the digest IS the epoch marker** (absent = pre-capture; present-with-null = unavailable
     that cycle) — no version arithmetic, matching the in-code `origin_order_id` "additive optional, NO
     version bump" precedent. Do NOT bump the shared `SCHEMA_VERSION` (coupled to `GhostTrade`, the `.v1`
     key, and the positions store's `GT_SCHEMA` write).
  3. **Join/honesty → the DecisionRecord is the SPINE** (no decision record ⇒ not an outcome).
     **Closed-only** (an unrealized mark drifts tick-by-tick and re-counts daily) — and closed-only is
     *exactly* what makes the ledger STATIC/un-dimmed under `[live-vs-static-isolation]`: the honesty rule
     and the isolation rule are the same decision. Three fill-quality classes off `mark_basis` (worse-of-
     two-legs): only `quoted` counts; `manual`/`user_entered`/`theoretical`/`last_known` never count;
     `ai_scenario`-sourced trades are scripted fixtures, excluded from every cohort. **Expectancy = mean
     `realized_pl_pct`, which IS the R-multiple** (long-single-leg-only ⇒ max loss = premium paid, so
     `pl_dollar/R` is arithmetically identical to `pl_pct`); **`stop` must NOT be the R basis** —
     `orders/types.ts` says it is *"plan data, never evaluated by this engine"*, so using an unenforced
     stop fabricates risk. `N_min = 20`/cell (iv-rank precedent), **Wilson 95% interval on every rate**,
     all-time non-rolling window, cells never pooled.
No-auto-tuning — STRUCTURAL, not prose (4 boundaries): (1) zero backend surface (`NO_BACKEND_CHANGE`);
     (2) the outcomes module is a **one-way leaf** with an enumerated forbidden-importer list, enforced by
     a source-scan test (use the `?raw` idiom — `fileURLToPath(new URL(...))` throws in this Vitest env,
     the ai-context-pack lesson); (3) the ledger has **zero write functions**; (4) its output must not ride
     the AI export/prompt in v1.
Architect pins flagged GATE-Z-bounceable: `N_min = 20` · hit `> 0` · the all-time window.
For the PM/UX (called explicitly in the contract): **this is a TRADER surface — NOT `/_ops/metrics`**
     (§5.3); an FE-only gate on the import is **forbidden as decorative** — a real server gate or none
     (§6.6). 14 non-goals + 13 PM open questions enumerated.
⚠ TWO PRE-EXISTING DEFECTS FOUND (conductor-verified in code — NOT this feature's regression; logged to
     BACKLOG §B as `split-decision-log`): (1) **the decision log is SPLIT across two durable stores** —
     `appendDecision` exists twice (`model/store.ts:59` → `convexa.ghost-trade.v1`; `positions/store.ts:171`
     → `convexa.positions.v2`), and `TickerDashboard.tsx:101` → `useGhostTrade` is **live code** still
     writing to v1 while the v1→v2 migration only runs when no v2 blob exists ⇒ Ticker ghost-trade decision
     records are **permanently stranded** from the Positions store. The harvest must **union BOTH logs**
     (and both position maps) and de-dupe by a defined identity (migration-copied records exist in both).
     (2) **`positions/testSeed.ts` writes a fabricated CLOSED position** (`realized_pl_dollar: 196`,
     `realized_pl_pct: 48.4`) via `putPosition` and **never calls `appendDecision`** — a naive "closed
     position = outcome" rule would inject a fabricated 48.4% winner into the hit-rate. The
     DecisionRecord-as-spine rule excludes it **structurally, for free**.
Last gateway:  GATE A·X @ 2026-07-16 (architect exit — contract locked, lint OK 0/0; → PM)
