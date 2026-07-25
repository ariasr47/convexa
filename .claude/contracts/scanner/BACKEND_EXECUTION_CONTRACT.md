# scanner — BACKEND_EXECUTION_CONTRACT (Phase P1 — the ScanStore persistence leaf)

> **Scope: PHASE P1 ONLY.** This is the first of the feature's four sequenced execution phases
> (P1 ScanStore → P2 worker+snapshot → P3 read API+conformance+warm-click+view → P4 frontend), each
> its own execution contract + GATE Q, like the redesign stages. This contract binds the **backend
> lane** for P1 and is overwritten for P2/P3 as each phase opens.
>
> **INTERFACE_CONTRACT.md — n/a for P1.** P1 is a **backend-internal store leaf**: it exposes **no
> HTTP surface, no endpoint, no FE↔BE wire**. The sweep worker (P2) writes it; the read API (P3) reads
> it. The row's `to_wire()` dict shape is defined here for the DOWNSTREAM P3 endpoint but is **not an
> endpoint in P1** — the standalone `.claude/tools/conformance/scanner.json` is authored at P3's GATE
> U·X (after the system-12 conformance-doc reconciliation). No `INTERFACE_CONTRACT` binding is required
> because there is no FE↔BE surface in this phase.

---

## 1. The build authority — Plan 1 (already complete, no-placeholder)

The **authoritative, task-by-task build spec is**
`docs/superpowers/plans/2026-07-23-scanner-01-scanstore.md` — a complete, no-placeholder plan with
the full module source, exact run commands, and expected outputs for all four tasks. **Build it
exactly as written**, task-by-task (Task 1 port+records → Task 2 SQLite adapter+`_selftest` →
Task 3 Postgres adapter → Task 4 env factory). This contract does **not** restate the code; it
**ratifies Plan 1 as the binding spec** and pins the invariants + the GATE-Q surface the phase is
verified against.

Use `superpowers:subagent-driven-development` (or `superpowers:executing-plans`) to work the plan's
checkboxes. Follow the plan's RED→GREEN discipline on the `_selftest` (Task 2 Step 3 deliberately
breaks `ON CONFLICT DO UPDATE` → observe FAIL → restore → observe PASS).

## 2. What P1 delivers (the deliverable set — from Plan 1)

`apps/api/src/scanstore/` — a **new one-way-leaf subpackage, 1:1 structural sibling of
`apps/api/src/marketdata/`** (the iv-rank store family):
- `ports.py` — `ScanRow` + `SweepHeartbeat` dataclasses (each with `.to_wire()`) + the `ScanStore`
  ABC (4 methods: `upsert_row` / `read_rows` / `write_heartbeat` / `read_heartbeat`) + the
  `SCAN_STATUSES` closed vocabulary (`ok`/`stale`/`error`/`building`).
- `sqlite_store.py` — the **on-disk SQLite adapter (the DEFAULT)**: one shared connection + lock +
  WAL; **latest-wins `ON CONFLICT(symbol) DO UPDATE`** (the one deliberate divergence from iv-rank's
  insert-if-absent — rows are CURRENT STATE, not an accumulating series).
- `_selftest.py` — the runnable assert-based store-contract check (the backend's no-pytest
  convention; RED→GREEN, exits non-zero on failure).
- `postgres_store.py` — the prod drop-in behind the **same port** (psycopg3 sync + pool; boot-safe:
  an unreachable DB defers the fault to first use, never crashes). **Parity-reviewed, not
  live-verified** (no local Postgres — the iv-rank / persistent-db precedent).
- `__init__.py` — the env-selected factory `get_store()` (`SCAN_STORE`, default `disk`; Postgres URL
  from `SCAN_DATABASE_URL` → `DATABASE_URL`).
- `apps/api/.env.example` + the `apps/api/Dockerfile` env-header comment gain the value-less
  `SCAN_STORE` / `SCAN_DATABASE_URL` / `SCAN_STORE_PATH` doc block (docs, **never** a baked secret).

**Deliberately deferred out of P1 (do NOT build here):** the **bundle-blob** store method (the
warm-click payload) is a **P2** addition to this same store, added when the P3 reader needs it
(Plan 1 Self-Review notes this). Multi-ticker snapshot, the worker, any endpoint, any UI — later
phases.

## 3. Binding invariants (restate + honor — from PROJECT_CONTEXT §5 + the BRIEF)

- **`[additive-keeps-score-byte-identical]` (HARD — the load-bearing structural guarantee).** The
  `scanstore/` leaf imports **ONLY stdlib** (+ `psycopg` lazily inside the Postgres adapter only). It
  is **NEVER imported by** `engine.py` / `signals.py` / `live.py` / `darkpool.py` / `chain_store.py`
  / `main.py` / the bundle-compute path. This import boundary — not discipline — is what makes score
  byte-identity hold: no scan row can become a scoring input because the scoring modules cannot import
  the leaf. **P1 touches no scoring/engine/bundle code at all** (`apps/api` diff is confined to the
  new `scanstore/` subpackage + the `.env.example`/`Dockerfile` doc lines).
- **`[best-effort-isolated-or-null]`.** A store fault is a caught, logged degradation, never a crash.
  An **unreachable Postgres at boot must NOT crash the process** — defer the fault to first use
  (mirror `marketdata/postgres_store.py`: pool opens `wait=False` inside try/except).
- **`[no-secrets-in-image]`.** The Postgres connection string is **runtime env only**
  (`SCAN_DATABASE_URL` → `DATABASE_URL`) — never baked, never committed. The `.env.example` entries
  are value-less docs.
- **The "trading path stays stateless" narrowing (extended).** This is the first persistent SCAN
  store; like iv-rank's market-data side-store, it is a **best-effort compute cache** outside the
  trading path — a wiped store re-sweeps, never an error. On-disk (not `:memory:`) so a locally-run
  worker's rows survive a dev restart.

## 4. GATE Q surface (how P1 is verified — the phase's own gate)

P1 is a backend-internal store with no product AC and no HTTP surface, so its GATE Q is **mechanical +
structural** (the containerize-apps / persistent-db infra-fast-path precedent), run by a fresh
`qa-verify` after the lane reports done:
1. **`_selftest` GREEN** — `cd apps/api && .venv/Scripts/python.exe -m src.scanstore._selftest` prints
   `PASS` (exit 0); and the RED→GREEN was demonstrated (the latest-wins break FAILs as Plan 1 Task 2
   Step 3 specifies).
2. **Factory selects disk by default** and round-trips through the public surface (Plan 1 Task 4
   Step 2 command → `SqliteScanStore` + `['disk','postgres']`).
3. **Postgres parity review** — statement-level parity against the SQLite SQL (same columns, `ON
   CONFLICT … DO UPDATE` on both `upsert_row` and `write_heartbeat`, `ORDER BY symbol ASC`, `= ANY(%s)`
   mirrors the SQLite `IN (…)`, `_ROW_COLS` reconstruction order) + import-safety (`import
   src.scanstore.postgres_store` succeeds without a live DB) + the boot-safe `wait=False` try/except.
   **No live-PG run** (no local Postgres — deferred like iv-rank/persistent-db).
4. **Leaf-import boundary (structural, the byte-identity proof)** — confirm no scoring/engine/bundle
   module imports `scanstore` and `scanstore` imports none of them (grep/AST, the AST-check precedent
   from iv-rank/ai-context-pack). Score/tier/`state_fingerprint` are **unreachable by construction** in
   P1 — the `apps/api` diff is confined to the new leaf + doc lines.
5. **Latest-wins divergence honored** — a re-`upsert_row` for a symbol OVERWRITES (not insert-if-absent);
   asserted in `_selftest`.

## 5. Lane rules

- Backend lane only: writes land under `apps/api/` (the workspace fence covers it). Touch **no** UI,
  **no** `libs/api`, **no** engine/signals/scoring code.
- **Commit** per Plan 1's per-task commit steps (local, on `main`). **Do NOT push** — the conductor
  pushes after P1's GATE Q passes (the "push after gates" owner pattern). **Do NOT run `nx` folder
  renames** (P1 creates files only; the nx-daemon tree-lock gotcha does not apply).
- If Plan 1 proves wrong or under-specified in any step (it should not — it is complete), do **not**
  invent around it: stop and report the exact step + the conflict for a GATE-Z bounce.
- **Surface, don't decide, the pytest question** — Plan 1's "Open decision" flags that the backend has
  no pytest runner and P1 uses the runnable `_selftest` convention. That is the correct v1 choice;
  adopting pytest is a separate owner decision. Note it in your return summary; do not adopt pytest.
