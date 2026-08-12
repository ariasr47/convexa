# RESUME — branch `main` — written 2026-08-12 (second snapshot of the day)

Conductor snapshot at a clean gateway boundary: **GATE S closed and pushed; GATE I not yet run.**
Read this as an overlay on the canon, reconcile against disk. Self-contained against `PROJECT_CONTEXT.md`.

## Where we are

**Nothing is in flight.** `contracts/` holds only `_archive/`. Working tree clean except three untracked
scratch items (`.tmp/`, `.tmp-api-serve.log`, `.tmp-dash-serve.log`). `origin/main` is **0 ahead** —
everything from 2026-08-12 is pushed (`d16c32d..0b2b21c`).

`score-lab-signal-comparison` **SHIPPED + ARCHIVED** this session. GATE Q PASS 77/78 (1 UNVERIFIABLE:
AC-62 needs Postgres, absent here). 4 backend passes, 3 QA passes, 29 commits. Conformance spec promoted
to `state/conformance/score-lab-signal-comparison.json`. Canon folded: `OPEN_THREADS` §7y +
`PROJECT_CONTEXT` §6. Ledger got 3 GATE Q rows; `ledger_tally` → **no graduations** (all 11 of the
feature's rows landed on already-promoted keys — reinforcement, not promotion). Watch list still 3.

## The next concrete step — GATE I, and why it wants a fresh session

The owner said **"go"**, which opens **GATE I (Discovery)**. GATE I is the one gate the conductor runs
**inline**, and it is the one that needs the whole planning surface loaded:
`BACKLOG.md` **1,720 lines** + `OPEN_THREADS.md` **1,403** + `DECISION_LEDGER.md` **774** ≈ **4,000 lines
(~416 KB)**. That load is why this snapshot exists — it is a measured file size, not a guess about
remaining context.

**Run GATE I first thing in the fresh session, before anything else consumes room.**

## What GATE I already has, pre-registered — do NOT rediscover it

- **The previous gate named the next pick explicitly.** `BACKLOG.md` "Last GATE I — 2026-08-11 (b)" ends:
  *"Runner-up: `tradeable-rec-inputs` Tier 1 (items 1+2+3) — the strongest **product** candidate, passes
  the cull emphatically, deferred on **sequencing not merit**. **Pick it next.**"*
- **But re-test that sequencing rather than inheriting it.** The stated reason for deferring it was that
  it *"enriches inputs to a headline judgment whose ranking value was just measured as unestablished."*
  Shipping the score lab built the **instrument**, but has **not yet answered** the question — the lab
  needs weeks of accumulated diary data, and `slice_current` still has no outcomes (B0b). So the original
  objection may still stand. That judgement is the gate's real work.
- **Roadmap `docs/ROADMAP_2026-08.md`:** X1/X2/X3 shipped or shipped-in-code; **X4 blocked** on owner
  habit N2 (N≥20 closed outcomes); N4 deferred by owner 2026-08-01. **N3 — index-first defaults (SPY
  default ticker, scanner pinned to indexes+megacaps, a thin-single-name honesty caveat) — is still
  `Not started` and is GATE-V-shaped.** It is the only unstarted roadmap *build* item and was NOT culled
  against `tradeable-rec-inputs` at the last gate. Put both in the cull set.
- **N1 (deploy) is a chore, not a pipeline feature** — see "Standing" below.
- New `BACKLOG` §B entries added at this GATE S: `score-lab-b0b-outcomes`, `score-lab-symbols-dedup`, the
  `:8000` orphan note. New §E entries: the `contract_lint` `R2_JSON_RE` disagreement (**kit-owned**), the
  overstated PLAN V5 claim.

## Standing facts — verified this session, do not re-derive

1. **The backend is Rust** (`apps/api`, Axum/Tokio, crate `api-rust`). Much of `BACKLOG` §B/§C still cites
   retired Python paths (`signals.py`, `engine.py`); that tree is archived at `archive/api-python/`.
   **Re-ground any feasibility claim resting on a `.py` path before trusting it.**
2. **`convexa.pages.dev` still serves the 2026-06-29 build**, so the 2026-08-06 signups-closed lockdown is
   **not live** — sign-ups remain open in production. Owner habit **N1** (`docs/DEPLOY_RUNBOOK.md`).
   Flagged at three consecutive gates now; it is not a pipeline item and will not fix itself.
3. **An orphaned `api-rust` (PID 58588) holds :8000 and `taskkill /F` is access-denied.** It rewrites
   `data/scan.json` several times a minute. Two QA passes had to work around it; one got past the locked
   binary by **renaming the running exe** (`target/debug/api-rust-orphan-locked.exe`), rebuilding, and
   serving on its own port. **Never point a conformance run at :8000** — it serves stale code, and any
   naive before/after byte check on `data/scan.json` will false-fail.
4. `npm run ports:free` is **IPv4-only**; IPv6 orphans hold `[::1]:4200/4300`. Use `localhost:`.
5. **`cargo test` never compiles `pg_scan.rs`** (it is behind `--features postgres`).
   `cargo check -p api-rust --features postgres` is a separate, mandatory step.
6. **Check exit codes, not printed summaries.**

## The lesson worth carrying into the next feature's gates

Both GATE Q bounces were **invisible to source review** and only visible in output:
- the artifact **fabricated chance-level statistics** onto label-less rows (`[absent-is-not-none]`,
  breached in the emitted file while the source read fine);
- a guard **satisfied its required NAME without its required BEHAVIOUR** (scanned one module's own source,
  not the module where the copy is assembled), and a sibling asserted literals **in isolation** rather
  than at the rendered-cell scope, so a later fix broke 6 of 75 cells with nothing going red.

So: **verify absence-vocabulary invariants on emitted bytes, and require every new guard to be
poison-proved red before it counts as enforcement.** Three ledger rows record this.

## Owner-facing, unanswered

None blocking. The escalation trigger (two GATE Z bounces on one feature) **fired and was declined** with
reasons recorded in the archived `_MANIFEST.md`; the owner did not override.
