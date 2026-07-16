# outcome-ledger — pipeline manifest
Entry:        architect-first
Stage:        GATE I — brief written; entry role NOT yet launched (pre-pipeline)
Repos:        both (expected — a capture extension + likely a persistent store; the architect confirms the
              storage locus, which may make it FE-only + export-only)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (not yet authored — next artifact, GATE A·X)
  - PRODUCT_CONTRACT.md        n/a
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
Last gateway:  GATE I @ 2026-07-16 (conductor-run inline, per ORCHESTRATOR §3 GATE I)
