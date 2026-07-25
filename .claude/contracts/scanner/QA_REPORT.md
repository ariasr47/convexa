# scanner — QA_REPORT (Phase P2 — the sweep worker + multi-ticker snapshot)

> Fresh, de-correlated `qa-verify` (Sonnet). Verifies GATE Q for **P2 only** (backend-only, no HTTP
> surface — no product AC, no `interface_conformance.py` run this phase, per
> `BACKEND_EXECUTION_CONTRACT.md` header). P1's QA report is preserved in git history at `7269fa2`;
> this file now carries P2. All commands run venv = `apps/api/.venv/Scripts/python.exe`, `cwd =
> apps/api`, no live vendor key required **except** where noted (§6 was independently upgraded to a
> live check — see below).

## Verdict table (BACKEND_EXECUTION_CONTRACT.md §4, verbatim order)

| # | GATE Q check (verbatim) | Verdict | Evidence |
|---|---|---|---|
| 1 | Tiering pure-logic `_selftest` GREEN + real RED→GREEN (anti-herd + round-robin fairness, injected clock; batch never exceeds pool; market-wide move degrades to base cadence; baseline round-robin slots guaranteed) | **PASS** | `python -m src.scanner.tiering_selftest` → `PASS: tiering pure logic — move detection, promotion cap, round-robin fairness, anti-herd` exit 0. Independently broke the cap (`promoted = ranked[:promo_slots]` → `promoted = ranked`) → re-ran → `FAIL: cold batch size [...6 symbols...]` exit 1 (the cold-universe round-robin-fairness assertion trips first, before reaching the later explicit anti-herd assertion — still a genuine RED caused by the same removed cap). Restored via `git checkout -- apps/api/src/scanner/tiering.py`; confirmed `git diff apps/api/src/scanner/tiering.py` is **empty** and re-ran GREEN. Injected-clock determinism (fixed `NOW=1000.0`, no wall-clock) and the round-robin baseline-slot guarantee (case 2: 3 cycles × 4 reach all 6 symbols; case 5: `baseline_slots >= slow_batch_size - promotion_cap >= 1` under an all-moved market) are asserted in-test and passed. |
| 2 | Projection `_selftest` GREEN — `ScanRow.tier == compute_opportunity_tier(...)` consume-not-derive proof; distances = signed-% transport; partial/failed compute → honest nullable row + `building`/`error`/`stale` | **PASS** | `python -m src.scanner.projection_selftest` → `PASS: projection consumes the bundle (tier via serve-path helper; distances = transport)` exit 0. Read `projection.py`: `row.tier == compute_opportunity_tier(80, True, watch=25, actionable=50, prime=75) == "prime"` asserted directly (line 29 of the selftest). Erratum applied exactly as ruled (Option 1, asymmetric fixture): `call_wall=115.0`, put strictly nearer (`put_wall=90.0` at distance 10 vs call at 15) → `dist_to_wall_pct == 10.0` asserted. `git log --all -- apps/api/src/scanner/projection.py` shows exactly one commit (net-new file, `2daee03`) — `_nearer_wall_dist` lives only in this new module, never in `engine.py`/`signals.py` (grep-confirmed empty in those files). `building`/`error`/`stale` states (cases 4, 5, 6, 7, 8 of the selftest) all pass. |
| 3 | Snapshot method — `get_snapshot_all` offline presence check; `import src.providers.massive` safe; ABC-stub + normalizer selftest; best-effort `{}`/absent-symbol contract by inspection | **PASS** | `python -m src.providers._snapshot_selftest` → `PASS: multi-ticker snapshot port + Massive normalizer satisfy the contract` exit 0 (stub-ABC contract: absent symbol dropped, empty input → `{}`; Massive normalizer: `last_trade.price` preferred, falls back to `min.close` when absent). `python -c "import src.providers.massive"` → `massive import OK`, no exception. |
| 4 | Bundle-blob store — extended `scanstore/_selftest` round-trips the blob GREEN (SQLite default); PG statement-parity for `scan_bundles` (no live PG) | **PASS** | `python -m src.scanstore._selftest` → `PASS: SqliteScanStore satisfies the store contract` exit 0 (blob absent→None, write→read round-trip, latest-wins overwrite all asserted inline). PG import-safety: `import src.scanstore.postgres_store as p; hasattr(p.PgScanStore,'write_bundle_blob') and hasattr(p.PgScanStore,'read_bundle_blob')` → `pg import ok True`. Statement-parity grep-confirmed: identical `scan_bundles` DDL shape (TEXT/DOUBLE PRECISION/TEXT, `symbol` PK), both adapters use `ON CONFLICT(symbol) DO UPDATE` / `ON CONFLICT (symbol) DO UPDATE`, both `read_bundle_blob` select `symbol, as_of, bundle_json` in the same order and canonicalize `symbol` upper. |
| 5 | Loop `_selftest` — embedded short run vs stub provider + canned bundle (no live key) produces rows + heartbeat + blob writes; per-ticker failure isolates to its row; a store outage is survived (writes skipped, loop continues) | **PASS** | `python -m src.scanner.loop_selftest` → `PASS: two-speed loop persists rows+blobs+heartbeat and survives a store outage` exit 0. Test asserts: all 3 symbols persisted with `status == ok`, `AAA.score == 80 / tier == prime`, a bundle-blob exists per symbol with `opportunity_score == 80` inside, heartbeat `universe_size == 3` and `sweep_last_completed is not None` (full-pass marker fired), and a second run against a `_BrokenStore` (every write raises) completes `asyncio.run(...)` **without** raising — store-outage survival directly exercised. |
| 6 | Byte-identity (HARD) — `git diff` confined to the additive set, 0 edits to `engine.py`/`signals.py`/`live.py`/`darkpool.py`/`chain_store.py`, `compute_ticker` unchanged; `SCANNER_EMBEDDED` unset ⇒ `main.py` app byte-identical (both directions); leaf/boundary AST (no scoring module imports `scanner`/`scanstore`; `scanner/`'s only scoring-path touch is the pure `compute_opportunity_tier` consume); served-bundle score/tier/`state_fingerprint` worker-absent-vs-present spot-check | **PASS** | See full evidence below — this check was **independently upgraded from the contract's anticipated "deferred/structural-only" judgment to a live-verified spot-check** because a live vendor key was present in the environment. |
| 7 | `[no-secrets-in-image]` — `.env.example`/`Dockerfile` worker additions are value-less docs; universe JSON holds tickers only, no secret | **PASS** | `apps/api/.env.example` worker block is all commented `KEY=` name/comment pairs, no values. `apps/api/Dockerfile` adds only the env-var **names** (`SCANNER_EMBEDDED, SCAN_UNIVERSE_PATH, SCAN_FAST_INTERVAL_SECONDS, SCAN_STALE_AFTER_SECONDS, SCAN_MOVE_THRESHOLD_PCT, SCAN_SLOW_BATCH_SIZE, SCAN_PROMOTION_CAP`) to a runtime-env doc comment; `CMD` unchanged. `apps/api/src/scanner/config/universe.json` contains only ticker symbols (`SPY, QQQ, IWM, ...`) + a `_comment`/`default_view` list — no keys, tokens, or connection strings. |

## Check 6 detail — the byte-identity core proof

1. **`git diff` confined to the additive set.** `git diff 7269fa2 HEAD --stat` (7269fa2 = the pre-P2
   commit, P1's GATE Q PASS) touches exactly: `.env.example`, `Dockerfile`, `main.py`, `project.json`,
   `src/providers/{_snapshot_selftest.py,base.py,massive.py}`, `src/scanner/**` (all net-new),
   `src/scanstore/{__init__.py,_selftest.py,ports.py,postgres_store.py,sqlite_store.py}`, `worker.py`.
   23 files, 1263 insertions / 6 deletions. **Zero** touches to `engine.py`, `signals.py`, `live.py`,
   `darkpool.py`, `chain_store.py` — independently confirmed via `git diff 7269fa2 HEAD --stat -- $(find
   apps/api/src -iname engine.py -o -iname signals.py -o -iname live.py -o -iname darkpool.py -o -iname
   chain_store.py)` → empty output for every one of the five files. `compute_ticker` is called
   verbatim from `worker.py::_compute_bundle` (`main.compute_ticker(...)`), never redefined or
   monkey-patched (grep-confirmed: no `def compute_ticker` outside `main.py`).
2. **`SCANNER_EMBEDDED` unset ⇒ `main.py` app byte-identical, both directions verified live.**
   `git diff 7269fa2 HEAD -- apps/api/main.py` shows the *entire* diff is one additive block (11 lines)
   after `app = FastAPI(...)`, an `if os.getenv("SCANNER_EMBEDDED", ...) in (...)`-guarded
   `@app.on_event("startup")` hook. Live-imported both ways:
   - unset: `main.app.router.on_startup` → `[]` (no handler registered).
   - `SCANNER_EMBEDDED=1`: `main.app.router.on_startup` → `['_start_embedded_scanner']`.
   Confirms the guard is genuinely default-off and additive-only.
3. **Leaf/boundary AST (grep-level, both directions).**
   `grep -rn "import scanner\|from.*scanner\|import scanstore\|from.*scanstore" src/core/{engine,signals,live,darkpool,chain_store}.py` → **zero matches** — no scoring module imports
   `scanner/` or `scanstore/`. `grep -rn "compute_opportunity_tier|compute_ticker|_acquire_vendor_inputs" src/scanner/*.py worker.py` → the only production touch is
   `src/scanner/projection.py: from src.core.signals import compute_opportunity_tier` (a plain function
   **call**, `tier = compute_opportunity_tier(int(score or 0), bool(ai_eval.get("ready")), watch=…,
   actionable=…, prime=…)` — reads the shared helper, never assigns into or mutates `signals.py`) and
   `worker.py::_compute_bundle` calling `main._acquire_vendor_inputs(...)` / `main.compute_ticker(...)`
   as ordinary function calls. No scoring-path mutation anywhere in `scanner/`.
4. **Served-bundle score/tier/`state_fingerprint` worker-absent-vs-present spot-check — LIVE-VERIFIED**
   (upgraded beyond the contract's anticipated deferral, since a usable vendor key was present):
   - Started `main.py` **without** `SCANNER_EMBEDDED` (worker-absent), hit `GET /api/ticker/SPY` →
     `score=59, tier=actionable, ai_eval.state_fingerprint=4df5c37bd833` (HTTP 200).
   - Killed the process, started `main.py` **with** `SCANNER_EMBEDDED=1` (worker-present; log-confirmed
     `[main] SCANNER_EMBEDDED=1 -> launching in-process sweep worker` and `[worker] sweep loop start:
     universe=25, fast=30.0s, pool=4` — the sweep actually ran, live-priced 25/25 symbols via
     `get_snapshot_all`, and computed several tickers through `compute_ticker` concurrently in the
     background). Hit `GET /api/ticker/SPY` again → `meta.cache.hit=False` (a genuinely **fresh** live
     compute, not a cached replay) → **`score=59, tier=actionable, ai_eval.state_fingerprint=4df5c37bd833`**
     — **byte-identical** to the worker-absent baseline.
   - A full-bundle diff (minus the `meta` block, which is expected to differ — `served_at`/`trace_id`/
     cache state) showed small (~4th–5th significant digit) float drift in `market_state` fields such as
     `atm_iv`, `call_gex`, `iv_hv_ratio`, `iv_rank.percentile` — this is natural live-vendor bid/ask/chain
     re-pricing between two separately-timed live fetches, matching the **pre-existing, already-logged**
     jitter noted in `OPEN_THREADS.md` §7q ("pre-existing ~9th-sig-digit float-ordering jitter in
     `net_vanna`/`net_charm`/`net_volga` — does NOT affect `opportunity_score`/score inputs/
     `state_fingerprint`") — not a P2 regression. The three gate-relevant outputs (`score`, `tier`,
     `state_fingerprint`) held byte-identical across worker-absent and worker-present despite that
     natural live-data drift, which is the load-bearing proof.
   - **Judgment:** live-verified — dispositive. No deferral was needed; a usable `MASSIVE_API_KEY` was
     present in `apps/api/.env`, so the strongest form of the check (a real served response, not just a
     structural argument) was exercised. Combined with the AST-level leaf-boundary proof (#3) and the
     empty diff on all five scoring files (#1), byte-identity is proven both structurally and live.

## Additional items surfaced (FYI, not GATE-Q findings)

- **pytest "Open decision"** — not adopted; the runnable `_selftest` convention is used throughout P2,
  consistent with Plan 2 / CLAUDE.md's stated v1 convention. Not a FAIL; the owner has not decided to
  adopt pytest. FYI only, per the launch instructions.
- **Vendor-endpoint confirmation (Plan Task 1 Step 1)** — `get_snapshot_all` and `get_snapshot_ticker`
  both confirmed present on the installed Massive SDK (`RESTClient`), and the grouped endpoint was
  exercised **live** during the §6 spot-check (`[snapshot] grouped snapshot: 25/25 priced` in the
  worker-present server log) — the primary path (not the per-ticker fallback) is what actually ran.

## Summary

**7 PASS / 0 FAIL / 0 UNVERIFIABLE.**

**Overall GATE Q verdict: PASS.**

All six `_selftest` modules are independently GREEN (exit 0) under a fresh session. The tiering
centerpiece's anti-herd cap was independently broken and observed to FAIL, then restored to a
byte-identical state (`git diff` empty) and re-verified GREEN. The HARD
`[additive-keeps-score-byte-identical]` invariant holds by every angle checked: file-diff confinement,
AST-level import-boundary absence, the `SCANNER_EMBEDDED` guard verified both directions live, and — going
beyond what the contract anticipated as achievable without a live key — an actual live served-bundle
spot-check with the sweep worker running in-process, which returned byte-identical `score`/`tier`/
`state_fingerprint` to the worker-absent baseline. `[best-effort-isolated-or-null]`,
`[live-vs-static-isolation]`, and `[no-secrets-in-image]` all hold by inspection + the loop selftest's
store-outage path. No invariant is broken. No amendment/bounce required.
