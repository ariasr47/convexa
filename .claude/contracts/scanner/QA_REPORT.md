# scanner — QA_REPORT (Phase P1 — the ScanStore persistence leaf)

**Verifier:** fresh `qa-verify` session, independent of the P1 builder.
**Scope:** `apps/api/src/scanstore/` (backend-internal leaf, no HTTP surface). Per the
BACKEND_EXECUTION_CONTRACT, P1 has **no product AC and no `INTERFACE_CONTRACT` binding** — GATE Q
here is the mechanical + structural surface defined in §4 of that contract. No PRODUCT_CONTRACT
table applies to this phase (n/a by contract).

## GATE-Q surface — point by point

| # | Check (verbatim from §4) | Verdict | Evidence |
|---|---|---|---|
| 1 | `_selftest` GREEN — `cd apps/api && .venv/Scripts/python.exe -m src.scanstore._selftest` prints `PASS` (exit 0) | **PASS** | Ran it: stdout `PASS: SqliteScanStore satisfies the store contract`, exit code `0`. |
| 2 | `_selftest` RED→GREEN demonstrated (latest-wins break FAILs, then restored) | **PASS** | Independently mutated `sqlite_store.py`: replaced `ON CONFLICT(symbol) DO UPDATE SET` with `ON CONFLICT(symbol) DO NOTHING -- MUTATED` (SQL comment truncates the trailing `SET …` clause cleanly). Re-ran selftest → `FAIL (sqlite): latest-wins failed: [ScanRow(symbol='SPY', … score=80.0 … status='ok')]`, exit `1` — the row was NOT overwritten, exactly the expected divergence-catch. Restored via `git checkout -- apps/api/src/scanstore/sqlite_store.py`; confirmed `git diff apps/api/src/scanstore/sqlite_store.py` is **0 lines** (byte-identical). Re-ran selftest → GREEN again (`PASS`, exit 0). Tree left exactly as found. |
| 3 | Factory selects disk by default, round-trips through public surface (Plan 1 Task 4 Step 2 command) | **PASS** | Ran the exact command with a temp `SCAN_STORE_PATH`. Output: `SqliteScanStore` then `['disk', 'postgres']` — matches expected exactly. |
| 4 | Postgres parity review (no live PG) + import-safety | **PASS** | Statement-level review of `postgres_store.py` vs `sqlite_store.py`: identical `_ROW_COLS` order (`symbol, price, chg_pct, score, tier, regime, vol_regime, flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct, as_of, status`) used in both INSERT column lists and SELECT/reconstruction in both adapters; `ON CONFLICT … DO UPDATE` present on **both** `upsert_row` and `write_heartbeat` in both adapters (SQLite: `ON CONFLICT(symbol)`/`ON CONFLICT(id)`; PG: `ON CONFLICT (symbol)`/`ON CONFLICT (id)`); `ORDER BY symbol ASC` in both `read_rows` paths; PG `WHERE symbol = ANY(%s)` mirrors SQLite `WHERE symbol IN (?,?,…)`; heartbeat singleton `WHERE id = 1` in both. Boot-safety: `_SharedPool.__init__` calls `self._pool.open(wait=False)` inside `try/except Exception` (never crashes), and `_init_schema_best_effort` is separately wrapped in `try/except`. Ran `.venv/Scripts/python.exe -c "import src.scanstore.postgres_store as p; print('import ok', hasattr(p,'make_store'))"` → `import ok True` (no live DB, module imports cleanly; `psycopg`/`psycopg_pool` are installed in the venv). |
| 5 | Leaf-import boundary (structural, byte-identity proof) — no scoring/engine/bundle module imports `scanstore`; `scanstore` imports none of them | **PASS** | `Grep "scanstore"` over `apps/api` excluding `**/scanstore/**` → **0 files found** (nothing outside the leaf references it, including `apps/api/main.py` and `apps/api/src/core/engine.py`, individually re-checked — no match). Inside `scanstore/`: import lines of all 5 files reviewed — `ports.py` stdlib only (`abc`, `dataclasses`, `typing`); `sqlite_store.py` stdlib only (`logging`, `os`, `sqlite3`, `threading`, `typing`) + `.ports`; `postgres_store.py` stdlib (`logging`, `os`, `typing`) + `psycopg`/`psycopg_pool` (confined to this file only) + `.ports`; `__init__.py` stdlib + `.ports` + lazy intra-package imports of `.sqlite_store`/`.postgres_store`; `_selftest.py` stdlib + `.ports` + lazy `.sqlite_store`. No import of `engine`, `signals`, `live`, `darkpool`, `chain_store`, or `main` anywhere in the leaf. Score/tier/`state_fingerprint` are unreachable from `scanstore` by construction, and `scanstore` is unreachable from the scoring/engine/bundle path. |
| 6 | Diff scope confined to the new leaf + doc lines; 0 scoring/engine/bundle files touched; working tree clean | **PASS** | `git diff 87caa9b HEAD --stat -- apps/api/` → exactly 7 files: `apps/api/.env.example` (+5), `apps/api/Dockerfile` (+1), and the 5 new `apps/api/src/scanstore/{__init__,_selftest,ports,postgres_store,sqlite_store}.py` files (522 insertions total, 0 deletions). No `engine.py`/`signals.py`/`live.py`/`darkpool.py`/`chain_store.py`/`main.py`/bundle file touched. `git status --porcelain` before and after my verification run is identical (only pre-existing unrelated `.claude/contracts/scanner/*` doc changes from this pipeline's own docs; no scanstore-related residue). |
| 7 | `[no-secrets-in-image]` — `.env.example`/`Dockerfile` additions are value-less doc placeholders | **PASS** | `git show d8d7d95 -- apps/api/.env.example apps/api/Dockerfile` reviewed line-by-line: `.env.example` adds `SCAN_STORE=disk` (a mode name, not a secret) plus two **commented-out** doc lines `# SCAN_DATABASE_URL=` / `# SCAN_STORE_PATH=` with no values; `Dockerfile` adds one line to an existing comment block listing env var **names** only (`SCAN_STORE, SCAN_DATABASE_URL, SCAN_STORE_PATH`), no values, no baked secret. |
| 8 | `[best-effort-isolated-or-null]` — unreachable Postgres at boot cannot crash | **PASS** | Confirmed by inspection (no live PG available to exercise): `_SharedPool.__init__` (`postgres_store.py` lines 26-33) opens the pool with `open=False` then calls `self._pool.open(wait=False)` wrapped in `try/except Exception: logger.exception(...)` (never raises past `__init__`), and `_init_schema_best_effort` (lines 35-56) wraps its DDL execution in its own `try/except Exception: logger.exception(...)`. This mirrors the described `marketdata/postgres_store.py` boot-safety shape. |

## Additional structural review (from the read of Plan 1 + built source)

- All 5 files (`ports.py`, `sqlite_store.py`, `postgres_store.py`, `__init__.py`, `_selftest.py`) match Plan 1's exact-code specification verbatim (dataclass fields, `to_wire()` key sets, ABC method signatures, `_ROW_COLS` tuples, factory names `get_store`/`available_stores`, env var names `SCAN_STORE`/`SCAN_DATABASE_URL`/`SCAN_STORE_PATH`).
- **Latest-wins divergence honored** — asserted directly inside `_selftest.run_store_contract` step 3 (`store.upsert_row(_row("SPY", 42.0, status="stale", as_of=2.0))` then asserting the row was overwritten, not accumulated) and independently reproduced RED via the mutation test above (check 2).
- `to_wire()` key set is asserted stable inside `_selftest` step 6 and matches the `ports.py` `ScanRow.to_wire()` dict exactly.

## FYI (not a FAIL) — the pytest "Open decision"

Plan 1 flags that `apps/api` has no pytest runner and that this plan uses the runnable `_selftest.py` assert-based convention instead. Per the BACKEND_EXECUTION_CONTRACT §5 instruction, this is noted as a surfaced-but-not-decided open item for the owner — **not** a gate failure. The `_selftest` convention was correctly followed and independently verified GREEN/RED/GREEN above.

## Summary

**8 / 8 checks PASS. 0 FAIL. 0 UNVERIFIABLE.**

No PRODUCT_CONTRACT AC table applies to P1 (backend-internal leaf, no HTTP surface — n/a by the
contract's own scope note). No `interface_conformance.py` run applies to P1 for the same reason. No
frontend test suite applies to P1 (backend-only phase).

## Overall GATE Q verdict: **PASS**

All invariants hold: `[additive-keeps-score-byte-identical]` (leaf-import boundary, both directions,
confirmed by grep + line-by-line import review), `[best-effort-isolated-or-null]` (boot-safe
`wait=False` + try/except, confirmed by inspection), `[no-secrets-in-image]` (value-less doc
placeholders, confirmed by diff review), and the latest-wins divergence (confirmed by independent
RED→GREEN mutation test). Working tree is clean and byte-identical to its pre-verification state
(the one deliberate mutation was fully reverted and confirmed via `git diff` = 0 lines).

No amendments to bounce — GATE Q PASS routes to GATE S per the standing rule.
