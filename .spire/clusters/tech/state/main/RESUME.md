# RESUME — branch `main` — written 2026-08-13 (post-ship snapshot)

Conductor snapshot at a clean gateway boundary: **`ai-rec-grounding` GATE S closed; GATE I not yet
run.** Overlay on the canon — reconcile against disk.

## Where we are

**Nothing is in flight.** `contracts/` holds only `_archive/`. `ai-rec-grounding` SHIPPED + ARCHIVED
2026-08-13 (commit `efb6d58`, pushed → deployed): GATE I → council (28 conflicts, 28/28 quotes
machine-verified, 5 self-revisions, 19/19 technical settled by the voices, 1 owner ruling → S2 FAIL →
fix → PASS) → PLAN 48 items → both lanes parallel → GATE Q **65/3 FAIL → GATE Z → PASS 68/68**.
Conformance spec promoted to `state/conformance/ai-rec-grounding.json` (2 endpoints). Canon folded:
OPEN_THREADS §7ae + PROJECT_CONTEXT §6 + BACKLOG + DESIGN_SYSTEM Amendments. Ledger: **11 rows**
(7 C + 3 Q + 1 S).

**The headline number: 44.4% of the numbers the AI asserts do not trace** to anything Convexa
computed — every one of which rendered as fact before this ship.

## Next concrete step

**GATE I (Discovery) on "go".** Plus one queued non-blocking decision (below).

Pre-registered candidates, re-test rather than inherit:
- **`rec-absence-literals-hole`** — BACKLOG §B, NEW this ship. Four AI-rec fields print an out-of-set
  bare `—`. **Closing it also closes SPEC §9.5's halo residual.** Value M–H · Effort S.
- **`score-lab-b0b-outcomes`** — S-sized backend fast-path, unchanged from two gates ago; needs
  `MASSIVE_API_KEY` at run time; **never synthesize outcomes**.
- **`degradation-visibility`** — flagged RISING two gates running; grew again this ship (more nullable
  best-effort fields, still no null-rate aggregation).
- **S5c SSE connection ceiling** — the last genuine MEDIUM from the security review; it stopped being
  theoretical when the app went live and can take the single container down.
- **Hygiene batch (one pass, three items):** `ci-standing-red` + `ports-free-is-ipv4-only` +
  `cargo-fmt-whole-crate-drift`. All three cost this session or the last one real time.

## Owner-facing, unanswered

- **QUEUED, non-blocking (batched per OPERATOR_REPORTS §4.3 — surface at the next gateway close):**
  should **`ai-asserted-numbers-are-traceable`** be promoted to canon via the **severity path** at 1
  instance? `ledger_tally` says NO on recurrence (1 feature; the bar is ≥2 if binding) and it stays on
  the watch list. The severity-path argument: a fabricated number the app presents as fact is a wrong
  trade with real money, and 44.4% is measured, not hypothetical. The counter-argument: severity was
  reserved for *catastrophic and irreversible* (the `loss-free-durable-migration` precedent was total
  silent loss of the user's entire trading history), and this feature now prevents the harm
  structurally, so the rule may simply promote normally at its 2nd instance. **Precedent: the severity
  path was itself added by owner canon review, and promotion is contestable via GATE Z.**
- **AI key rotation still advised** (carried forward — a shell one-liner echoed the key into a local
  tool log during the previous feature's V10; never committed, sweep clean).

## Standing facts (verified this session — do not re-derive)

1. **Backlog code references go stale, and it has now bitten twice.** The BRIEF's evidence path cited
   `ScenarioLLMProvider` / `AI_REC_SCENARIOS_ENABLED`; those **do not exist in the Rust backend**
   (`recommendation.rs:358` hardcodes them off, the FE picker is dead code) — inherited from the
   **Python-era** 2026-07-16 entry. R1 caught it in round one, cost zero build time. **Re-ground a
   feasibility claim in code before trusting it.**
2. **`AI_REC_LOCAL_ONLY=1` DOES require a usable key** — `recommendation.rs:655` gates on
   `resolved.usable()` before the flag is read. An R1 claim to the contrary was withdrawn.
3. **:8000 orphan** (PID 58588, `taskkill /F` access-denied) serves stale code and rewrites
   `data/scan.json` several times a minute — **verify on :8010+**; a naive before/after byte check on
   that file gives a false failure. `ports:free` is **IPv4-only**; Vite binds IPv6 (`localhost:`).
4. **`core.autocrlf = true` and no `.gitattributes`** — a source-scan guard matching a literal `\n`
   fails on any fresh Windows clone. Normalize before matching; **never weaken the assertion to make
   it pass.** (Found as GATE Q finding F-2 on the 8c pin.)
5. **Dashboard suite baseline: 1700 passing + 5 accepted pre-existing red files** (`readonly.spec.tsx`,
   `positions.risk.spec.tsx`, `grouping.integration.spec.tsx`, `stage3-amber.spec.ts`,
   `orders.risk.spec.tsx`). A 6th is a new regression. `app.risk.spec.tsx` is a **load-sensitive flake,
   proven pre-existing** across 5 full-suite runs (3 in a clean-HEAD worktree, 2 on branch).
6. **A green `nx test` does NOT mean the types are sound**; `nx typecheck` and
   `cargo check -p api-rust --features postgres` are separate mandatory steps. **Exit codes, not
   printed summaries.** **NEVER `git stash`** — use a worktree.
7. **CI/CD exists and push = deploy** (Railway auto-deploy + CF Pages + `deploy-smoke.yml`).
   `efb6d58` is pushed; **prod not yet probed this session** — worth a check.

## The lessons this ship added (ledger rows exist — apply, don't rediscover)

- **A guard the builder itself could not catch.** Guard 8c had **no in-process test that could fail** —
  the fixtures called `envelope_extras` directly with a self-built move, bypassing the real wiring.
  Found only by *attempting the poison*, never by reading the guard. **Poison-proving is not a
  formality; it is the only thing that finds a guard which cannot fail.**
- **The tempting fix for a broken guard is usually the wrong one.** The CRLF failure's easy fix would
  have weakened the only assertion covering the 8c poison arm — satisfying the guard's NAME while
  destroying its BEHAVIOUR.
- **An artifact about measurement integrity must name its own weakest link.** The D7 artifact now
  states what is corroborated and what is not: the ≥50% bar is **not** in SPEC §7, exists only in that
  file, and sits exactly between the two measured rates (57.1% / 44.4%). Stated as what happened, never
  as what a timestamp proves — new watch key `measurement-states-its-own-provenance`.
- **"Not mine" is the one claim a lane has an incentive to reach for.** Seven uncovered `test`-marked
  ACs: backend said none touched `apps/api` (true), frontend covered six — **AC-34 fell between the
  lanes** and was only caught by checking the SPEC directly.
- **The owner's D7 ruling worked as designed.** Pass 1 came in at 57.1%, tripped the pre-committed bar,
  earned exactly one prompt revision and one re-run, and landed at 44.4%. A ship gate would have made
  tolerance-widening and scope-cutting the paths of least resistance instead.
