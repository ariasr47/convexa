# scanner — BACKEND_EXECUTION_CONTRACT (Phase P2 — the sweep worker + multi-ticker snapshot)

> **Scope: PHASE P2 ONLY** (2nd of the four sequenced phases). Overwrites the P1 contract (P1 shipped
> + GATE Q PASS 8/8; see git history + `QA_REPORT.md`). Binds the **backend lane** for P2.
>
> **INTERFACE_CONTRACT.md — still n/a in P2.** The worker exposes **no HTTP surface**; the read API +
> the FE↔BE wire + `scanner.json` conformance are **P3** (after the system-12 conformance-doc
> reconciliation). P2's new provider-port method + store methods are backend-internal. No
> `INTERFACE_CONTRACT` binding required.

---

## 1. The build authority — Plan 2 (complete, no-placeholder)

`docs/superpowers/plans/2026-07-24-scanner-02-worker.md` — a complete, no-placeholder, task-by-task
plan (7 tasks, full module source, exact `cwd=apps/api` commands + expected outputs, three RED→GREEN
disciplines), authored to Plan 1's standard and grounded in the real repo symbols
(`get_snapshot_all`, `fetch_options_market_state`, `compute_ticker`/`_acquire_vendor_inputs`,
`compute_opportunity_tier`, the P1 `scanstore`). **Build it exactly as written**, task-by-task, via
`superpowers:subagent-driven-development`. This contract ratifies Plan 2 as the binding spec + pins
the invariants and the GATE-Q surface; it does not restate the code.

## 2. What P2 delivers (from Plan 2)

New pure subpackage `apps/api/src/scanner/` (`universe.py` loader · `tiering.py` **pure move-detection
+ promotion + round-robin, injected clock** · `projection.py` bundle→`ScanRow` · `loop.py` two-speed
async loop) + their runnable `_selftest`s; the thin `apps/api/worker.py` entrypoint; a checked-in
`src/scanner/config/universe.json` (real tickers, ≤100). **Additive edits to shared files only:**
- `src/providers/base.py` + `massive.py` — the **NET-NEW multi-ticker `fetch_stock_snapshots`** method
  (`StockSnapshot` TypedDict; ABC-level so any vendor implements it; best-effort `{}`/absent-symbol
  freezes price; `get_snapshot_all` with a per-ticker fallback behind the same return).
- `src/scanstore/` port + both adapters + `_selftest` — the **NET-NEW bundle-blob method** (§4.3;
  freshness-stamped blob keyed by symbol, latest-wins, parity-reviewed PG).
- `main.py` — **one env-flag-guarded, default-OFF `SCANNER_EMBEDDED` startup hook** (the one-terminal
  dev seam; unset ⇒ byte-identical app).
- `project.json` — a new `serve-worker` nx target; `.env.example`/`Dockerfile` — value-less worker env docs.

## 3. Binding invariants (restate + honor)

- **`[additive-keeps-score-byte-identical]` (HARD — the load-bearing boundary).** The worker **CALLS**
  `compute_ticker` **unchanged** (the sole transform) and **CONSUMES** its output. It does **NOT** edit
  or fork `engine.py`/`signals.py`/`live.py`/`darkpool.py`/`chain_store.py`/`compute_ticker`. `scanner/`
  + `worker.py` are orchestration/provider code **never imported by any scoring module**; `scanstore`
  stays a one-way leaf. Score/tier/`state_fingerprint`/gate stay **byte-identical** with the worker
  present or absent, and with `SCANNER_EMBEDDED` unset. The only shared-file edits are **additive** (a
  new port method, new store methods, the guarded main hook, the nx target, env docs).
  **Two resolved clarifications the plan makes explicit (Plan 2 Open-decision 3) — verify as
  consume-not-derive, NOT re-derive:**
  1. **Tier** is a serve-time overlay, not a bundle field: the worker calls the **same
     `compute_opportunity_tier(score, ai_eval.ready, watch, actionable, prime)`** helper `main._wrap`
     uses, with the **same env bands** → the scanner tier equals the Ticker-page tier (AC-10). This is
     consuming the shared transform, not new math.
  2. **`dist_to_flip_pct` / `dist_to_wall_pct`** are **pure display transport** (signed % of price vs
     the consumed flip/wall level), exactly as the Ticker FE renders — **no engine/greeks math**, never
     a scoring input.
- **`[best-effort-isolated-or-null]`.** A per-ticker vendor/compute failure degrades **that row alone**
  (`error`/`stale`), the sweep continues; a failed snapshot poll **freezes prices with their stamps**
  (never fabricates); a store outage → the worker **skips writes** and keeps looping; pool throttling
  backs off. **Nothing crashes the loop.**
- **`[live-vs-static-isolation]`.** Poll snapshots only — **no SSE, no per-row streams, no WebSocket**
  in the worker.
- **`[no-secrets-in-image]`.** All worker config (cadences, thresholds, PG/vendor connection strings)
  is **runtime env only**; the universe JSON is not a secret and is checked in.
- **`[model-read-carries-its-assumptions]` / `[digested-labels-not-raw-dump]`.** Each `ScanRow` carries
  its own `as_of` + `status` (closed `SCAN_STATUSES`); closed enums + scalars only, no raw series.
- **D4 defaults (operator-configurable):** move X=0.75% · fast ~30s · slow ~2–3min/N=100 · **capped
  round-robin promotion — the fairness guarantee is binding**, the exact cap is an ops tunable.

## 4. GATE Q surface (how P2 is verified — mechanical + structural, no live vendor key)

Run by a fresh de-correlated `qa-verify` after the lane reports done (venv =
`apps/api/.venv/Scripts/python.exe`, `cwd=apps/api`):
1. **Tiering pure-logic `_selftest` (the centerpiece) GREEN + a real RED→GREEN** — the anti-herd +
   round-robin fairness proof with the injected clock (batch never exceeds the pool; a market-wide move
   degrades to base cadence, never a herd; baseline round-robin slots guaranteed). Independently
   demonstrate the RED (break a threshold/cap) then restore byte-identical.
2. **Projection `_selftest` GREEN** — `ScanRow.tier == compute_opportunity_tier(...)` (the consume-not-
   derive proof) and distances = signed-% transport; partial/failed compute → honest nullable row +
   `building`/`error`/`stale`.
3. **Snapshot method** — `get_snapshot_all` offline presence check; `import src.providers.massive`
   safe; a stub `MarketDataProvider` subclass proves the ABC method; best-effort `{}`/absent-symbol
   contract.
4. **Bundle-blob store** — the extended `scanstore/_selftest` round-trips the blob GREEN on the SQLite
   default; PG statement-parity for the new `scan_bundles` table/methods (no live PG).
5. **Loop `_selftest`** — the embedded short run vs a **stub provider + canned bundle** (no live key)
   produces rows + heartbeat + blob writes; a per-ticker failure isolates to its row; a store outage is
   survived (writes skipped, loop continues).
6. **Byte-identity (HARD) — the core proof:**
   - `git diff` confined to the additive set above; **0 edits to `engine.py`/`signals.py`/`live.py`/
     `darkpool.py`/`chain_store.py` and `compute_ticker` unchanged**.
   - **`SCANNER_EMBEDDED` unset ⇒ `main.py` app byte-identical** (the hook is env-guarded, default-off,
     after `app = FastAPI(...)`; grep-confirm the guard).
   - Leaf/boundary AST: no scoring module imports `scanner/` or `scanstore/`; `scanner/` never imports
     into and mutates the scoring path.
   - Spot-check a served bundle's score/tier/`state_fingerprint` is byte-identical worker-absent vs
     worker-present (embedded), per the P1/iv-rank precedent.
7. **`[no-secrets-in-image]`** — `.env.example`/`Dockerfile` worker additions are value-less docs; the
   universe JSON holds tickers only, no secret.

## 5. Lane rules

- Backend lane only; writes under `apps/api/`. Touch **no** UI, **no** `libs/api`, **no** engine/signals/
  scoring code (the additive port/store/main-hook edits above are the ONLY shared-file changes).
- **Commit** per Plan 2's per-task steps (local, on `main`). **Do NOT push** — the conductor pushes after
  P2's GATE Q. **Do NOT run `nx` folder renames.** If any step needs `nx`, note the daemon tree-lock
  gotcha (stop the daemon before any contracts-folder rename — n/a here, files-only + one target add).
- If Plan 2 proves wrong/under-specified, STOP and report the exact step + conflict (GATE-Z candidate) —
  do not invent around it. The two Open-decision-3 clarifications are **already resolved** (consume-not-
  derive); do not re-litigate them.
- Surface the pytest "Open decision" (do not adopt pytest) and the vendor-endpoint confirmation result
  (`get_snapshot_all` present/fallback) in your return summary.
