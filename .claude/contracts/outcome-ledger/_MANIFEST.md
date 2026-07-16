# outcome-ledger — pipeline manifest
Entry:        architect-first
Stage:        GATE Z RESOLVED — both amendments ACCEPTED + amended into the ARCHITECTURE_CONTRACT (fresh
              architect, 2026-07-16). Contract re-LOCKED; **UX is UNBLOCKED**. Next: GATE U·X (the fan-out).
Repos:        **frontend ONLY** (architect resolved crux 1: `NO_BACKEND_CHANGE`, empty `apps/api` diff —
              client-local derived read, ZERO new durable keys, no server store. The empty backend diff is
              itself the structural no-auto-tuning guarantee: a statistic that never leaves the browser
              cannot reach `signals.py`.)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   **locked (re-locked at GATE Z, 2026-07-16)** — §3.4 rewritten in full; A1+A2
                               ACCEPTED; verdicts + reasoning in the new §11; §11.4 addresses UX directly
  - PRODUCT_CONTRACT.md        locked (450 lines; compressor #2 applied — it IS the UX-targeted handoff).
                               All 13 architect open questions resolved; all 3 bounceable pins ACCEPTED.
  - UX_BLUEPRINT.md            n/a (next artifact — GATE U·X, **blocked on the A1/A2 resolution**)
  - UX_BLUEPRINT.md            n/a
  - INTERFACE_CONTRACT.md      n/a
  - BACKEND_EXECUTION_CONTRACT.md   n/a
  - FRONTEND_EXECUTION_CONTRACT.md  n/a
Conformance:  n/a until GATE U·X — and only if the architect puts state server-side. **system-12 applies if
              so:** the runnable convention is a standalone `.claude/tools/conformance/{feature}.json`
              (precedent `iv_rank.json`), NOT an embedded block. Reconcile the authoring docs first.
Open amendments: **ARCHITECTURE_CONTRACT.md CONTESTED (owner: architect)** — 2 bounced at GATE P·X
              (2026-07-16). Both **additive to §3.4**; **neither reopens a pin** (the PM accepted all three
              GATE-Z-bounceable pins: `N_min = 20` §4.9 · hit `> 0` §4.10 · all-time window §4.11).
              **A1 — the exclusion ledger must also exist at the WHOLE-READOUT level, not only per cohort.**
                §3.4 puts the ledger "alongside every cohort", but the exclusions the product most needs to
                report (`no_decision_record` / `not_closed` / `never_filled` / `scenario_sourced`) belong to
                records that **never reach a cell**, so no per-cohort ledger can hold them ⇒ **AC-17 (the
                coverage statement) is unbuildable** and the demo-seed exclusion (AC-E10) unreportable.
                Requested: a ledger-level coverage roll-up (total recorded closed / total counted / counts
                by reason for pre-cell exclusions).
              **A2 — the read must carry the pre-capture COUNT per cell family, not only the epoch date.**
                §3.4 carries "the capture epoch"; a date alone cannot distinguish a **new** cell from a
                **permanently starved** one. "Of your 34 counted outcomes, 30 predate capture" is honest
                coverage; "we started capturing on Mar 4" is not. AC-19 + AC-E13 + §9.8 need the count.
                Requested: per cell family, count the counted outcomes carrying **no digest** (pre-capture),
                kept DISTINCT from digest-ran-but-field-null (unavailable-that-cycle).
              Conductor read: **both are structural gap-fills, not scope creep** — accept expected.
              **→ RESOLVED 2026-07-16 (GATE Z, fresh architect — deliberately NOT the authoring session, so
              it could not defend its own work; that call paid off):**
              **A1 ACCEPTED — shape adjusted FURTHER than requested.** The PM asked for a roll-up
                *alongside* the per-cohort ledgers; the architect accepted the roll-up and **DELETED the
                per-cohort ledger** — checking the pipeline, **every** reason (not just the PM's four) is
                decided before an outcome reaches a cell, so **no exclusion is cohort-specific**. The old
                §3.4 placed a structure at a level that can never populate it — **a contract defect, not PM
                scope creep**. Populations also **split** (§3.4.2): open positions + never-filled orders
                cannot sit inside the "M recorded closed positions" denominator (one isn't closed, the other
                isn't a position) — reported beside it, as AC-17's own "counted of recorded, **plus** open
                **plus** never-filled" wording already implied.
              **A2 ACCEPTED — with 4 sharpenings the PM's phrasing didn't carry**, each an implementer
                would get wrong: `pre_capture` is a property of the RECORD (identical across families —
                report per-family anyway; "optimizing" it to one number destroys AC-19) · **tier's
                `pre_capture` is structurally 0** (that IS AC-E13) · AI-rec needs a 4th count,
                **`not_attributable_by_path`** (a direct-Accept outcome is NOT `unavailable_at_capture`;
                collapsing them makes the PM's own "not available at entry" copy a lie — a wiring gap
                masquerading as market-data absence) · `attributed` derives from the outcome population,
                **never by summing cell Ns** (setup fans out ⇒ summing overstates coverage, breaks
                §4.14/AC-16).
              **Spine-rule tension resolved STRUCTURALLY** (§3.4.5) — admitting to a cohort is an act of
                *evidence*; counting for coverage is an act of *denominator honesty*. Four locks: the
                roll-up is **integers only** (so the demo seed's fabricated `realized_pl_dollar: 196` is
                **unreachable by construction**) · rates compute over the counted population only · **no
                include/exclude toggle/override/filter may exist** (new §8 non-goal 15) · the roll-up is a
                leaf. Plus a binding testable identity `M == counted + Σ excluded_by_reason` with a
                **stated precedence order** (without it, two implementers produce two different breakdowns
                that both balance).
              **⚠ The store split interacts with A1 — the sharpest failure mode, flagged 3× on purpose:**
                **M must span BOTH position sources, de-duped, from the SAME unioned index the counted N
                comes from.** An M read from `convexa.positions.v2` alone paired with a unioned numerator
                yields a coverage statement whose **numerator can exceed its denominator** — i.e. it lies,
                **in the direction of flattering the feature**. Related: the capture epoch must be
                **derived from the data, not a hardcoded ship date** (an archive import can carry records
                from a browser whose capture began earlier); the digest must be read from the **same entry
                record the join fixed**, never borrowed from an `accept` record for the same `trade_id`.
              **Nothing traded away** (§11.3, re-verified item by item): `NO_BACKEND_CHANGE` holds (empty
                `apps/api` diff), zero new durable keys, all 4 no-auto-tuning boundaries survive,
                `[loss-free-durable-migration]` untouched + mildly reinforced,
                `[model-read-carries-its-assumptions]` extended as it requires (coverage counts carry their
                basis: stores spanned, de-dupe identity, `sources_complete` partiality flag, derived epoch).
                Both amendments are derived in-memory integers — **had either needed a backend surface or a
                durable key, the verdict would have been REFUSE**. No pin reopened, no non-goal relaxed.
              Left for UX (§11.4, non-blocking): `malformed` vs `unreadable_records` are two counts that may
                share one plain phrasing (arithmetic, not editorial — flagged so nobody improvises mid-build);
                the **partial** state (`sources_complete: false`) is the data behind AC-E5's "(or partial)" —
                UX owns the copy, with one binding rule: **a partial roll-up must never present its smaller M
                as if it were the whole population.**
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
