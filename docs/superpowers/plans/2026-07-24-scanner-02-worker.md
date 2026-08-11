# Scanner v1 — Plan 2 of 4: The sweep worker + multi-ticker snapshot

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the **sweep worker** — a second, HTTP-less process (same `apps/api` image, different start command) that polls a multi-ticker price snapshot on a fast lane and runs the owner-curated universe through the **UNCHANGED `compute_ticker`** on a concurrency-bounded slow lane, projecting one `ScanRow` per ticker into the Plan-1 `ScanStore`, writing a heartbeat every tick, and caching each full bundle as a freshness-stamped blob for Plan 3's warm-click.

**Architecture:** Approach C, the producer half. A net-new subpackage `apps/api/src/scanner/` holds pure, injectable pieces — a **universe-config loader**, a **tiering/promotion pure-logic module with an injected clock** (the highest-risk algorithm), a **row projection** (consume-never-re-derive), and a **two-speed async loop** — plus a thin entrypoint `apps/api/worker.py`. The worker **reuses** `main.compute_ticker` / `main._acquire_vendor_inputs` / `main.data_provider` verbatim (the sole transform stays byte-identical); it adds one **net-new multi-ticker snapshot method** to the `MarketDataProvider` port + Massive adapter, and one **bundle-blob method** to the Plan-1 store. Nothing in `scanner/` is ever imported by the scoring path.

**Tech Stack:** Python 3.12, stdlib `asyncio` + `json`, the Massive REST SDK's `get_snapshot_all` (already-present grouped-snapshot endpoint), the Plan-1 `scanstore` leaf, FastAPI backend under `apps/api`. No new pip dependency. Nx `run-commands` for the new `serve-worker` target.

## Global Constraints

Every task's requirements implicitly include these (copied verbatim from `ARCHITECTURE_CONTRACT.md` §3.1/§4.3/§6/§7, `PRODUCT_CONTRACT.md` D3/D4, and `BACKEND_EXECUTION_CONTRACT.md` §3):

- **`[additive-keeps-score-byte-identical]` (HARD — the load-bearing boundary).** The worker **CALLS** `compute_ticker` unchanged and **CONSUMES** its output; it does **NOT** edit `engine.py` / `signals.py` / `live.py` / `darkpool.py` / `chain_store.py` or fork/modify `compute_ticker`. The new `apps/api/src/scanner/` subpackage + the worker entrypoint are **orchestration/provider code, not scoring code**, and are **NEVER imported by** any scoring module. `scanstore` stays a one-way leaf (scoring modules never import it). Score / tier / `state_fingerprint` / the entry gate stay **byte-identical** with the worker present or absent. The only edits to shared files are **additive**: a new method on the `MarketDataProvider` ABC + Massive adapter (widening the port, not changing existing methods), new methods on the `scanstore` port + both adapters, and one **env-flag-guarded, default-off** startup hook in `main.py` (§Task 7) that does not touch the transform.
- **`[best-effort-isolated-or-null]`.** A per-ticker vendor/compute failure degrades **that row alone** (`error`/`stale`) and the sweep continues; a failed snapshot poll **freezes prices WITH their stamps** (never fabricates a price); a store outage makes the worker **skip writes** and keep looping; pool throttling backs off. **Nothing crashes the loop.** Every store call in the loop is wrapped best-effort.
- **`[no-secrets-in-image]`.** All worker config (cadences, thresholds, the PG/vendor connection strings) is **runtime env only**. The universe JSON is **not a secret** (D3) and is **checked in** — real tickers, git-reviewed provenance.
- **`[live-vs-static-isolation]`.** The worker produces **poll snapshots** only. **No SSE, no per-row streams, no WebSocket.** (The Massive `stream_stock` method is not used by the worker.)
- **`[model-read-carries-its-assumptions]` / `[digested-labels-not-raw-dump]`.** Each `ScanRow` carries its own `as_of` + `status` (closed `SCAN_STATUSES` vocabulary); closed enums + scalars only, **no raw series** ride a row.
- **`[no-real-order-path]`.** The worker is a display-data producer; no broker/order/execution path anywhere.
- **The two-speed cadence defaults (D4, operator-configurable):** move threshold **X = 0.75 %**, fast-lane poll **≈ 30 s**, slow-lane full pass **≈ 2–3 min at N=100**, promotion queue **capped with round-robin fairness** so a market-wide move degrades to base cadence, never a herd. The **fairness guarantee is binding**; the exact cap is an ops tunable.
- **The universe is D3 config:** an owner-curated **checked-in JSON file** (50–100 ceiling) read at worker **start**; "edit + restart worker" is the v1 operational story (no hot-reload).
- **Test convention:** `apps/api` has **no pytest suite** (CLAUDE.md). Every task is verified by a **runnable assert-based `_selftest` module** run with `apps/api/.venv/Scripts/python.exe`, RED→GREEN like a test — **not** pytest. The **tiering pure-logic `_selftest` is the centerpiece** (deterministic, injected clock). The loop is verified by an **embedded short run against a stub provider + a canned bundle** so no live vendor key is needed. Adopting pytest stays a separate owner decision (see `## Open decisions`).
- **Python idioms:** every module opens `from __future__ import annotations`; logger is `logging.getLogger("Convexa")`; the venv Python is `apps/api/.venv/Scripts/python.exe`; module runs use `cwd = apps/api` so `src` / `main` resolve.

## Open decisions (surface to the owner; do not block this plan)

1. **pytest for the backend.** Unchanged from Plan 1: this plan uses runnable `_selftest` modules (convention-compatible). Adopting pytest is a one-task toolchain add — recommend raising it at review, not deciding it mid-plan.
2. **Multi-ticker snapshot endpoint (RESOLVED here, confirm live at execution).** The Massive SDK **does** expose the grouped endpoint `RESTClient.get_snapshot_all(market_type, tickers=[...])` (verified present in `apps/api/.venv/Lib/site-packages/massive/rest/snapshot.py`; its single-ticker sibling `get_snapshot_ticker("stocks", …)` is already used in `massive.py`). The plan builds on `get_snapshot_all("stocks", tickers=<list>)`. **Task 1 Step 1 is a vendor-endpoint confirmation** (a one-line live/offline check); the **fallback** (a per-ticker `get_snapshot_ticker` loop) is written into the adapter behind the same normalized return, so a confirmation failure is a one-line switch, not a redesign.
3. **Tier consumption nuance (flagged — a possible GATE-Z clarification).** `compute_ticker`'s bundle does **not** carry `opportunity_tier`: the tier is a **serve-time overlay** computed in `main._wrap` via `src.core.signals.compute_opportunity_tier(score, ai_eval.ready, watch=…, actionable=…, prime=…)`. To keep AC-10 (scanner tier == Ticker-page tier) true, the worker **calls the same `compute_opportunity_tier` helper with the same env-config bands and the same `ai_eval.ready`** — this is **consuming the same transform**, not re-deriving math. Likewise, `dist_to_flip_pct` / `dist_to_wall_pct` are **not** in the bundle; the worker computes them as **pure display transport** (signed % of price vs the consumed level), exactly as the Ticker page renders them — **no engine/greeks math**. Both are called out explicitly in Task 5 so a reviewer confirms they are transport, not a new scoring input.

## File Structure

```
apps/api/
  worker.py                          # NET-NEW entrypoint (2nd process). start/stop/backoff, env-injected
                                     #   config, SCANNER_EMBEDDED wiring seam. No HTTP surface.
  src/scanner/
    __init__.py                      # package marker + re-exports (UniverseConfig, run, LoopDeps, ...)
    universe.py                      # D3 loader: reads the checked-in JSON, canonicalizes, validates
    config/universe.json             # the checked-in owner-curated universe + default-view (real tickers)
    tiering.py                       # PURE move-detection + promotion + round-robin (injected clock) — crux (c)
    tiering_selftest.py              # the CENTERPIECE runnable selftest (RED→GREEN, deterministic)
    projection.py                    # consume bundle -> ScanRow (tier via compute_opportunity_tier; distances = transport)
    projection_selftest.py           # runnable projection selftest
    loop.py                          # the two-speed async loop (fast + slow lanes, heartbeat, blob writes); injectable deps
    loop_selftest.py                 # embedded short run vs a stub provider + canned bundle (no live key)
  src/providers/base.py              # +StockSnapshot TypedDict + fetch_stock_snapshots ABC method (ADDITIVE)
  src/providers/massive.py           # +fetch_stock_snapshots (get_snapshot_all; per-ticker fallback)
  src/scanstore/ports.py             # +BundleBlob record + write_bundle_blob/read_bundle_blob on the ABC (ADDITIVE)
  src/scanstore/sqlite_store.py      # +scan_bundles table + the two methods (latest-wins ON CONFLICT DO UPDATE)
  src/scanstore/postgres_store.py    # +scan_bundles table + the two methods (parity mirror)
  src/scanstore/_selftest.py         # EXTEND the P1 contract with the bundle-blob round-trip
  main.py                            # +env-flag-guarded (SCANNER_EMBEDDED) startup hook (ADDITIVE, default-off)
  project.json                       # +serve-worker nx target (alongside serve)
  .env.example / Dockerfile          # +worker env doc block (value-less; never a baked secret)
```

Each file has one responsibility. `universe` / `tiering` / `projection` are **pure and I/O-free** (unit-testable without vendor or store); `loop` orchestrates them over **injected** deps; `worker` wires the real deps. The split mirrors how `main.py` separates `_acquire_vendor_inputs` (I/O) from `compute_ticker` (transform).

---

### Task 1: The net-new multi-ticker snapshot provider method (`base.py` + `massive.py`)

> Crux **(a)** — widens the vendor-agnostic port. **Do this first** (architecture §6a: "P2's first task must read `massive.py::fetch_options_market_state` and mirror its request/auth/parse/error idiom"). Independently testable: a stub subclass proves the ABC + a Massive import-safety + shape check proves the adapter, with **no live key**.

**Files:**
- Modify: `apps/api/src/providers/base.py` (add `StockSnapshot` TypedDict + the abstract method)
- Modify: `apps/api/src/providers/massive.py` (implement it)
- Create: `apps/api/src/providers/_snapshot_selftest.py`

**Interfaces:**
- Produces (Task 6 + Plan 3 rely on these EXACT names/types):
  - `StockSnapshot` TypedDict — `symbol: str`, `price: Optional[float]`, `chg_pct: Optional[float]`, `as_of_ns: int`.
  - `MarketDataProvider.fetch_stock_snapshots(self, tickers: list[str]) -> dict[str, StockSnapshot]` — keyed by canonical UPPER symbol; **best-effort** (returns `{}` on total failure; a symbol absent from the vendor response is simply **absent** from the dict → the caller freezes that price).

- [ ] **Step 1: CONFIRM the vendor endpoint (the crux-first check; ~10s)**

Run (from `apps/api`) to confirm `get_snapshot_all` exists on the installed SDK client (offline — inspects the class, no key/network):
```bash
cd apps/api && .venv/Scripts/python.exe -c "from massive import RESTClient; print('get_snapshot_all', hasattr(RESTClient,'get_snapshot_all')); print('get_snapshot_ticker', hasattr(RESTClient,'get_snapshot_ticker'))"
```
Expected: `get_snapshot_all True` then `get_snapshot_ticker True`. If (and only if) the first is `False`, the adapter's Step 3 fallback branch (`_snapshots_per_ticker`) becomes the primary path — flip the `_USE_GROUPED` flag written in Step 3 to `False` and note it in the commit. (At authoring time both are `True`.)

- [ ] **Step 2: Add the `StockSnapshot` contract + the abstract method to the port**

In `apps/api/src/providers/base.py`, add the TypedDict directly after the existing `StreamEvent` class (before `class MarketDataProvider`):

```python
class StockSnapshot(TypedDict):
    """One underlying's fast-lane snapshot: last price + session % change, normalized across
    vendors. Feeds the scanner's fast lane (prices + move detection). `price` / `chg_pct` are
    Optional — a vendor that momentarily has no trade for a symbol yields None (the scanner then
    FREEZES that symbol's last price with its stamp, never fabricates). `as_of_ns` is the vendor's
    snapshot-update time in nanoseconds (0 when the vendor omits it)."""
    symbol: str                 # canonical UPPER-case
    price: Optional[float]
    chg_pct: Optional[float]    # session % change (already a percent, e.g. 1.34 == +1.34%)
    as_of_ns: int
```

Then add the abstract method to `class MarketDataProvider`, immediately after `fetch_recent_trades` (keep `stream_stock` last):

```python
    @abstractmethod
    def fetch_stock_snapshots(self, tickers: list[str]) -> dict[str, "StockSnapshot"]:
        """Multi-ticker fast-lane snapshot: last price + session % change for MANY underlyings in
        as few requests as the vendor allows. Returns a dict keyed by canonical UPPER symbol.
        BEST-EFFORT and NON-RAISING: a total failure returns {}; a symbol the vendor did not price
        is simply ABSENT from the dict (the caller freezes its last price). This is a fast, cheap
        stock-snapshot call — NOT the option-chain fetch — so the whole universe costs ~1 request."""
```

- [ ] **Step 3: Implement it on the Massive adapter (mirror `fetch_options_market_state`'s idiom)**

In `apps/api/src/providers/massive.py`, first extend the `base` import line to include `StockSnapshot`:

```python
from .base import (
    MarketDataProvider, OptionsMarketState, UnderlyingBar, IntradayBar,
    TradePrint, StreamEvent, StockSnapshot,
)
```

Then add these methods to `class MassiveProvider` (place them after `fetch_recent_trades`, before `stream_stock`). This mirrors the adapter's existing `extract`/try-except/logging idiom and reuses `get_snapshot_ticker("stocks", …)` (already used at line ~292) as the per-ticker fallback:

```python
    # Fast-lane snapshot chunk size. get_snapshot_all takes a comma-joined ticker list; keep chunks
    # modest so a URL stays sane and one bad chunk can't lose the whole poll.
    _SNAPSHOT_CHUNK = 50
    # Prefer the grouped endpoint (one request per chunk). Flipped to False only if the vendor-
    # endpoint confirmation (Plan Task 1 Step 1) fails on a given deployment.
    _USE_GROUPED = True

    def _snapshot_price(self, snap) -> "float | None":
        """Best last price from a snapshot: last trade, then this-minute close, then day close,
        then prior-session close. None only when the vendor priced none of them."""
        for path in (("last_trade", "price"), ("min", "close"),
                     ("day", "close"), ("prev_day", "close")):
            val = extract(extract(snap, path[0], {}), path[1], None)
            if val is not None and float(val) > 0.0:
                return float(val)
        return None

    def _one_snapshot(self, snap) -> "StockSnapshot | None":
        sym = (extract(snap, "ticker", "") or "").upper()
        if not sym:
            return None
        price = self._snapshot_price(snap)
        chg = extract(snap, "todays_change_percent", None)
        return StockSnapshot(
            symbol=sym,
            price=price,
            chg_pct=float(chg) if chg is not None else None,
            as_of_ns=int(extract(snap, "updated", 0) or 0),
        )

    def fetch_stock_snapshots(self, tickers: list[str]) -> "dict[str, StockSnapshot]":
        """Grouped stock snapshot for the universe. One get_snapshot_all request per <=50-ticker
        chunk; per-chunk best-effort so one failed chunk can't drop the whole poll. Falls back to a
        per-ticker get_snapshot_ticker loop when the grouped endpoint is unavailable."""
        wanted = [(t or "").upper() for t in tickers if t]
        if not wanted:
            return {}
        out: dict[str, StockSnapshot] = {}
        if self._USE_GROUPED:
            for i in range(0, len(wanted), self._SNAPSHOT_CHUNK):
                chunk = wanted[i:i + self._SNAPSHOT_CHUNK]
                try:
                    snaps = self.client.get_snapshot_all("stocks", tickers=chunk)
                    for snap in (snaps or []):
                        one = self._one_snapshot(snap)
                        if one is not None and one["symbol"] in set(chunk):
                            out[one["symbol"]] = one
                except Exception as e:
                    logger.warning(f"[snapshot] get_snapshot_all chunk failed ({len(chunk)} tickers): {e}")
            if out:
                logger.info(f"[snapshot] grouped snapshot: {len(out)}/{len(wanted)} priced")
                return out
            logger.warning("[snapshot] grouped snapshot returned nothing; trying per-ticker fallback")
        return self._snapshots_per_ticker(wanted)

    def _snapshots_per_ticker(self, wanted: list[str]) -> "dict[str, StockSnapshot]":
        """Fallback: one get_snapshot_ticker per symbol (already used for the session-close lookup).
        Slower but keeps the fast lane alive if the grouped endpoint is unavailable."""
        out: dict[str, StockSnapshot] = {}
        for sym in wanted:
            try:
                snap = self.client.get_snapshot_ticker("stocks", sym)
                one = self._one_snapshot(snap)
                if one is not None:
                    out[one["symbol"]] = one
            except Exception as e:
                logger.debug(f"[snapshot] per-ticker snapshot failed for {sym}: {e}")
        logger.info(f"[snapshot] per-ticker snapshot: {len(out)}/{len(wanted)} priced")
        return out
```

- [ ] **Step 4: Write the runnable provider selftest (ABC contract + stub, no live key)**

Create `apps/api/src/providers/_snapshot_selftest.py`:

```python
"""Runnable check for the multi-ticker snapshot port (Scanner v1 Plan 2 Task 1). No pytest, no live
key: a stub subclass proves the ABC + return contract; the Massive adapter's normalizer is proven on
a canned SDK-shaped snapshot object. Run: apps/api/.venv/Scripts/python.exe -m src.providers._snapshot_selftest
(cwd = apps/api). Exits 0 = pass, 1 = fail."""
from __future__ import annotations

from types import SimpleNamespace

from .base import MarketDataProvider, StockSnapshot


class _StubProvider(MarketDataProvider):
    name = "stub"

    def fetch_options_market_state(self, ticker): return {}
    def fetch_daily_bars(self, ticker): return []
    def fetch_intraday_bars(self, ticker): return []
    def fetch_recent_trades(self, ticker, lookback_seconds): return []
    async def stream_stock(self, ticker):  # pragma: no cover
        raise NotImplementedError
        yield

    def fetch_stock_snapshots(self, tickers):
        # Emulate a vendor that prices two of three requested symbols (AAA, BBB) and drops CCC.
        table = {"AAA": (100.0, 1.5, 111), "BBB": (50.0, -2.0, 222)}
        out: dict[str, StockSnapshot] = {}
        for t in tickers:
            u = (t or "").upper()
            if u in table:
                p, c, ns = table[u]
                out[u] = StockSnapshot(symbol=u, price=p, chg_pct=c, as_of_ns=ns)
        return out


def _check_abc_contract() -> None:
    p = _StubProvider()
    res = p.fetch_stock_snapshots(["aaa", "BBB", "CCC"])
    assert set(res) == {"AAA", "BBB"}, f"absent symbol must be dropped, got {set(res)}"
    assert res["AAA"]["price"] == 100.0 and res["AAA"]["chg_pct"] == 1.5, res["AAA"]
    assert res["AAA"]["as_of_ns"] == 111 and res["AAA"]["symbol"] == "AAA", res["AAA"]
    assert p.fetch_stock_snapshots([]) == {}, "empty input -> {}"


def _check_massive_normalizer() -> None:
    # Prove the Massive adapter's _one_snapshot / _snapshot_price mapping on a canned SDK-shaped
    # object WITHOUT constructing a live client (call the unbound methods on a dummy self).
    from .massive import MassiveProvider
    snap = SimpleNamespace(
        ticker="spy",
        todays_change_percent=0.83,
        updated=1700000000000000000,
        last_trade=SimpleNamespace(price=512.34),
        min=SimpleNamespace(close=512.0),
        day=SimpleNamespace(close=510.0),
        prev_day=SimpleNamespace(close=508.0),
    )
    one = MassiveProvider._one_snapshot(MassiveProvider.__new__(MassiveProvider), snap)
    assert one["symbol"] == "SPY", one
    assert one["price"] == 512.34, "must prefer last_trade.price"
    assert one["chg_pct"] == 0.83 and one["as_of_ns"] == 1700000000000000000, one
    # Price fallback: no last_trade -> min.close.
    snap2 = SimpleNamespace(ticker="qqq", todays_change_percent=None, updated=0,
                            last_trade=None, min=SimpleNamespace(close=440.0),
                            day=None, prev_day=None)
    two = MassiveProvider._one_snapshot(MassiveProvider.__new__(MassiveProvider), snap2)
    assert two["price"] == 440.0 and two["chg_pct"] is None, two


def main() -> int:
    try:
        _check_abc_contract()
        _check_massive_normalizer()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: multi-ticker snapshot port + Massive normalizer satisfy the contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: Run it (GREEN)**

```bash
cd apps/api && .venv/Scripts/python.exe -m src.providers._snapshot_selftest
```
Expected: `PASS: multi-ticker snapshot port + Massive normalizer satisfy the contract` (exit 0).
Also confirm the adapter still imports cleanly:
```bash
cd apps/api && .venv/Scripts/python.exe -c "from src.providers import get_provider; p=get_provider(); print('has method', hasattr(p,'fetch_stock_snapshots'))"
```
Expected: `Market-data provider: massive` (log) then `has method True`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/providers/base.py apps/api/src/providers/massive.py apps/api/src/providers/_snapshot_selftest.py
git commit -m "feat(scanner): net-new multi-ticker stock-snapshot provider method (port + Massive; grouped w/ per-ticker fallback)"
```

---

### Task 2: The bundle-blob ScanStore method (§4.3) — the deferred-from-P1 addition

> Item **7** + crux **(d)** (parity-reviewed Postgres). Adds a **third** table to the Plan-1 store: each computed full bundle stored as a freshness-stamped JSON blob keyed by symbol, latest-wins — Plan 3's warm-click read-through source. Verified by **extending the P1 `_selftest`** RED→GREEN.

**Files:**
- Modify: `apps/api/src/scanstore/ports.py` (add `BundleBlob` + two ABC methods)
- Modify: `apps/api/src/scanstore/sqlite_store.py` (add table + methods)
- Modify: `apps/api/src/scanstore/postgres_store.py` (add table + methods — parity mirror)
- Modify: `apps/api/src/scanstore/_selftest.py` (extend the store contract)

**Interfaces:**
- Consumes: `ScanStore` (P1).
- Produces (Task 6 writes these; Plan 3 reads them):
  - `BundleBlob` dataclass — `symbol: str`, `as_of: float`, `bundle_json: str`.
  - `ScanStore.write_bundle_blob(blob: BundleBlob) -> None` — latest-wins overwrite by symbol.
  - `ScanStore.read_bundle_blob(symbol: str) -> Optional[BundleBlob]` — the current blob or None.

- [ ] **Step 1: Add the record + the two abstract methods to `ports.py`**

Append `BundleBlob` after the `SweepHeartbeat` dataclass (before `class ScanStore`):

```python
@dataclass
class BundleBlob:
    """The full computed bundle for a tracked symbol, serialized (json) + freshness-stamped
    (§4.3). Latest-wins by symbol. It is a freshness-GATED cache blob for Plan 3's warm-click
    read-through — NOT re-shaped or re-scored on read: the web app either serves it (fresh) or
    ignores it (stale/miss → normal vendor fetch). `compute_ticker` stays the sole transform."""
    symbol: str            # canonical UPPER-case
    as_of: float           # epoch-seconds of the compute that produced the bundle
    bundle_json: str       # json.dumps(bundle) — the same object the ticker endpoint serves

    def to_wire(self) -> dict:
        return {"symbol": self.symbol, "as_of": self.as_of, "bundle_json": self.bundle_json}
```

Then add the two abstract methods to `class ScanStore` (after `read_heartbeat`):

```python
    @abstractmethod
    def write_bundle_blob(self, blob: BundleBlob) -> None:
        """Insert or OVERWRITE the bundle blob for `blob.symbol` (latest-wins)."""

    @abstractmethod
    def read_bundle_blob(self, symbol: str) -> Optional[BundleBlob]:
        """The current bundle blob for `symbol`, or None if absent. Freshness is the caller's to
        judge (the blob carries `as_of`); the store returns whatever it last stored."""
```

Finally, export it from the package init — in `apps/api/src/scanstore/__init__.py`, extend the import + `__all__`:

```python
from .ports import ScanRow, ScanStore, SweepHeartbeat, BundleBlob, SCAN_STATUSES
```
```python
__all__ = ["get_store", "available_stores", "ScanRow", "ScanStore", "SweepHeartbeat",
           "BundleBlob", "SCAN_STATUSES"]
```

- [ ] **Step 2: Add the SQLite table + methods (latest-wins, mirroring `upsert_row`)**

In `apps/api/src/scanstore/sqlite_store.py`: import `BundleBlob` from the port —

```python
from .ports import BundleBlob, ScanRow, ScanStore, SweepHeartbeat
```

Add the third table inside `_SharedDB._init_schema` (after the `scan_heartbeat` block, still inside the `with self._conn:`):

```python
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS scan_bundles (
                    symbol      TEXT PRIMARY KEY,
                    as_of       REAL NOT NULL,
                    bundle_json TEXT NOT NULL
                )
                """
            )
```

Add the two methods to `class SqliteScanStore` (after `read_heartbeat`):

```python
    def write_bundle_blob(self, blob: BundleBlob) -> None:
        symbol = (blob.symbol or "").upper()
        with self._db._lock:
            with self._db._conn:
                self._db._conn.execute(
                    "INSERT INTO scan_bundles (symbol, as_of, bundle_json) VALUES (?,?,?) "
                    "ON CONFLICT(symbol) DO UPDATE SET as_of=excluded.as_of, "
                    " bundle_json=excluded.bundle_json",
                    (symbol, blob.as_of, blob.bundle_json),
                )

    def read_bundle_blob(self, symbol: str) -> Optional[BundleBlob]:
        sym = (symbol or "").upper()
        with self._db._lock:
            r = self._db._conn.execute(
                "SELECT symbol, as_of, bundle_json FROM scan_bundles WHERE symbol = ?",
                (sym,)).fetchone()
        if r is None:
            return None
        return BundleBlob(symbol=r["symbol"], as_of=r["as_of"], bundle_json=r["bundle_json"])
```

- [ ] **Step 3: Add the Postgres table + methods (parity mirror — statement-level, no live DB)**

In `apps/api/src/scanstore/postgres_store.py`: import `BundleBlob` —

```python
from .ports import BundleBlob, ScanRow, ScanStore, SweepHeartbeat
```

Add the DDL in `_SharedPool._init_schema_best_effort` (after `ddl_hb`, and execute it in the same try block):

```python
        ddl_bundles = (
            "CREATE TABLE IF NOT EXISTS scan_bundles ("
            " symbol TEXT PRIMARY KEY, as_of DOUBLE PRECISION NOT NULL, bundle_json TEXT NOT NULL)"
        )
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(ddl_rows)
                    cur.execute(ddl_hb)
                    cur.execute(ddl_bundles)
                conn.commit()
        except Exception:
            logger.exception("Scan Postgres schema init deferred (will retry at first use)")
```
(Replace the existing `try:`/`with self._pool.connection()` block with the one above — it just adds the `cur.execute(ddl_bundles)` line.)

Add the two methods to `class PgScanStore` (after `read_heartbeat`):

```python
    def write_bundle_blob(self, blob: BundleBlob) -> None:
        symbol = (blob.symbol or "").upper()
        with self._pool._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO scan_bundles (symbol, as_of, bundle_json) VALUES (%s,%s,%s) "
                    "ON CONFLICT (symbol) DO UPDATE SET as_of=EXCLUDED.as_of,"
                    " bundle_json=EXCLUDED.bundle_json",
                    (symbol, blob.as_of, blob.bundle_json))
            conn.commit()

    def read_bundle_blob(self, symbol: str) -> Optional[BundleBlob]:
        sym = (symbol or "").upper()
        with self._pool._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT symbol, as_of, bundle_json FROM scan_bundles WHERE symbol = %s",
                            (sym,))
                r = cur.fetchone()
        if r is None:
            return None
        return BundleBlob(symbol=r[0], as_of=r[1], bundle_json=r[2])
```

- [ ] **Step 4: Extend the store-contract `_selftest` with the bundle-blob round-trip**

In `apps/api/src/scanstore/_selftest.py`, extend the import and append a section to `run_store_contract` (after the existing heartbeat block, before the `to_wire` block):

```python
from .ports import BundleBlob, ScanRow, SweepHeartbeat
```
```python
    # 7. bundle-blob: absent -> None, write -> read round-trip, latest-wins overwrite.
    assert store.read_bundle_blob("SPY") is None, "absent blob must be None"
    store.write_bundle_blob(BundleBlob(symbol="spy", as_of=5.0, bundle_json='{"v":1}'))
    b = store.read_bundle_blob("SPY")   # lower-case in -> canonical read
    assert b is not None and b.symbol == "SPY" and b.as_of == 5.0 and b.bundle_json == '{"v":1}', f"blob rt {b}"
    store.write_bundle_blob(BundleBlob(symbol="SPY", as_of=6.0, bundle_json='{"v":2}'))
    b = store.read_bundle_blob("SPY")
    assert b.as_of == 6.0 and b.bundle_json == '{"v":2}', f"blob latest-wins failed: {b}"
```

- [ ] **Step 5: RED — break latest-wins, observe FAIL**

Temporarily change the SQLite `write_bundle_blob` `ON CONFLICT(symbol) DO UPDATE SET …` to `ON CONFLICT(symbol) DO NOTHING`, then run:
```bash
cd apps/api && .venv/Scripts/python.exe -m src.scanstore._selftest
```
Expected: `FAIL (sqlite): blob latest-wins failed: …` (exit 1). Restore `DO UPDATE SET as_of=excluded.as_of, bundle_json=excluded.bundle_json`.

- [ ] **Step 6: GREEN — full contract passes; Postgres import-safety**

```bash
cd apps/api && .venv/Scripts/python.exe -m src.scanstore._selftest
```
Expected: `PASS: SqliteScanStore satisfies the store contract` (exit 0).
```bash
cd apps/api && .venv/Scripts/python.exe -c "import src.scanstore.postgres_store as p; print('pg import ok', hasattr(p.PgScanStore,'write_bundle_blob') and hasattr(p.PgScanStore,'read_bundle_blob'))"
```
Expected: `pg import ok True`.

Parity-review checklist (record in the commit body — crux (d), no live PG): `scan_bundles` DDL identical shape (TEXT/DOUBLE PRECISION/TEXT, `symbol` PK); `write_bundle_blob` uses `ON CONFLICT (symbol) DO UPDATE` on both adapters; `read_bundle_blob` selects the same three columns in the same order and canonicalizes `symbol` upper.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/scanstore/ports.py apps/api/src/scanstore/sqlite_store.py apps/api/src/scanstore/postgres_store.py apps/api/src/scanstore/__init__.py apps/api/src/scanstore/_selftest.py
git commit -m "feat(scanstore): bundle-blob method (freshness-stamped, latest-wins) for P3 warm-click — deferred-from-P1 addition"
```

---

### Task 3: The universe-config loader + the checked-in JSON (D3)

> Item **2**. Reads the owner-curated checked-in JSON at worker start: the 50–100 universe + the D2 default-view list. Pure file read + validation; verified by a runnable selftest over a temp file.

**Files:**
- Create: `apps/api/src/scanner/__init__.py`
- Create: `apps/api/src/scanner/config/universe.json`
- Create: `apps/api/src/scanner/universe.py`
- Create: `apps/api/src/scanner/universe_selftest.py`

**Interfaces:**
- Produces: `UniverseConfig` dataclass — `universe: list[str]` (canonical UPPER, de-duped, order-preserving), `default_view: list[str]` (⊆ universe, order-preserving); `load_universe(path: Optional[str] = None) -> UniverseConfig` (default path = the checked-in JSON; env `SCAN_UNIVERSE_PATH` override).

- [ ] **Step 1: Create the package marker**

Create `apps/api/src/scanner/__init__.py`:

```python
"""The scanner subpackage — the Scanner sweep worker's producer-side logic (Scanner v1 Plan 2).
A NET-NEW orchestration/provider subpackage: pure, injectable pieces (universe loader, tiering
pure-logic, row projection, the two-speed loop). It CALLS the unchanged compute_ticker and CONSUMES
its output; it is NEVER imported by engine/signals/live/darkpool/chain_store/the bundle-compute path
(the score-byte-identity boundary). The worker entrypoint is apps/api/worker.py."""
from __future__ import annotations
```

- [ ] **Step 2: Create the checked-in universe config (real tickers — not a secret; D3)**

Create `apps/api/src/scanner/config/universe.json` (a representative committed sample; the owner grows it toward the 50–100 ceiling by editing + restarting the worker):

```json
{
  "_comment": "Owner-curated tracked universe (Scanner v1, D3). NOT a secret — checked in for git-reviewed provenance. Edit + restart the worker to change it (no hot-reload in v1). Ceiling: 50-100 symbols. 'default_view' is the anonymous/new-user view (D2); when empty, the read API falls back to top-20-by-score.",
  "universe": [
    "SPY", "QQQ", "IWM", "DIA", "SMH",
    "AAPL", "MSFT", "NVDA", "AMZN", "META",
    "GOOGL", "TSLA", "AMD", "NFLX", "AVGO",
    "JPM", "BAC", "XLF", "XLE", "XLK",
    "GLD", "TLT", "COIN", "PLTR", "MSTR"
  ],
  "default_view": [
    "SPY", "QQQ", "IWM", "NVDA", "TSLA", "AAPL", "AMD", "META"
  ]
}
```

- [ ] **Step 3: Write the loader**

Create `apps/api/src/scanner/universe.py`:

```python
"""D3 universe-config loader. Reads the owner-curated CHECKED-IN JSON at worker start: the tracked
universe (50-100) + the D2 default-view list. Canonicalizes to UPPER, de-dupes preserving order, and
constrains default_view to the universe (unknown default-view symbols are dropped with a warning —
the config is git-reviewed, so this is a guard, not a feature). A missing/malformed file or an empty
universe is an operator config error surfaced at worker START (fail-fast at start, NOT a per-row
degrade). The universe is NOT a secret; the path is a checked-in file, env-overridable for tests/ops."""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass

logger = logging.getLogger("Convexa")

_DEFAULT_CONFIG = os.path.join(os.path.dirname(__file__), "config", "universe.json")


@dataclass(frozen=True)
class UniverseConfig:
    universe: list[str]       # canonical UPPER, de-duped, order-preserving
    default_view: list[str]   # subset of universe, order-preserving


def _canon_list(raw) -> list[str]:
    """UPPER + strip + de-dupe preserving first-seen order. Non-str / empty entries dropped."""
    out: list[str] = []
    seen: set[str] = set()
    for item in (raw or []):
        if not isinstance(item, str):
            continue
        sym = item.strip().upper()
        if sym and sym not in seen:
            seen.add(sym)
            out.append(sym)
    return out


def load_universe(path: str | None = None) -> UniverseConfig:
    """Load + validate the universe config. Raises ValueError on a missing/malformed file or an empty
    universe (an operator error surfaced at worker start)."""
    cfg_path = path or os.getenv("SCAN_UNIVERSE_PATH", "").strip() or _DEFAULT_CONFIG
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError as e:
        raise ValueError(f"Scanner universe config not found at {cfg_path}. Set SCAN_UNIVERSE_PATH "
                         f"or add the checked-in config file.") from e
    except json.JSONDecodeError as e:
        raise ValueError(f"Scanner universe config at {cfg_path} is not valid JSON: {e}") from e

    universe = _canon_list(data.get("universe"))
    if not universe:
        raise ValueError(f"Scanner universe config at {cfg_path} has an empty 'universe' list.")

    universe_set = set(universe)
    default_view: list[str] = []
    for sym in _canon_list(data.get("default_view")):
        if sym in universe_set:
            default_view.append(sym)
        else:
            logger.warning(f"[universe] default_view symbol {sym} is not in the universe; dropped.")

    logger.info(f"[universe] loaded {len(universe)} symbols, default_view={len(default_view)} "
                f"from {cfg_path}")
    return UniverseConfig(universe=universe, default_view=default_view)
```

Re-export it from the package init — append to `apps/api/src/scanner/__init__.py`:

```python
from .universe import UniverseConfig, load_universe  # noqa: E402

__all__ = ["UniverseConfig", "load_universe"]
```

- [ ] **Step 4: Write the loader selftest**

Create `apps/api/src/scanner/universe_selftest.py`:

```python
"""Runnable universe-loader check (Scanner v1 Plan 2 Task 3). No pytest.
Run: apps/api/.venv/Scripts/python.exe -m src.scanner.universe_selftest  (cwd = apps/api)."""
from __future__ import annotations

import json
import os
import tempfile

from .universe import load_universe


def _write(tmp: dict) -> str:
    fd, path = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(tmp, f)
    return path


def main() -> int:
    try:
        # 1. canon (UPPER) + de-dupe (order-preserving) + default_view subset-filtering.
        p = _write({"universe": ["spy", "QQQ", "spy", "iwm"],
                    "default_view": ["qqq", "NOPE", "spy"]})
        cfg = load_universe(p)
        os.remove(p)
        assert cfg.universe == ["SPY", "QQQ", "IWM"], cfg.universe
        assert cfg.default_view == ["QQQ", "SPY"], cfg.default_view  # NOPE dropped (not in universe)

        # 2. empty universe -> ValueError.
        p = _write({"universe": [], "default_view": []})
        try:
            load_universe(p); assert False, "empty universe must raise"
        except ValueError:
            pass
        finally:
            os.remove(p)

        # 3. missing file -> ValueError.
        try:
            load_universe(os.path.join(tempfile.gettempdir(), "definitely-missing-xyz.json"))
            assert False, "missing file must raise"
        except ValueError:
            pass

        # 4. the CHECKED-IN config loads and is coherent (default_view ⊆ universe).
        cfg = load_universe()  # default path
        assert len(cfg.universe) >= 8, f"checked-in universe too small: {len(cfg.universe)}"
        assert set(cfg.default_view).issubset(set(cfg.universe)), "default_view must be a subset"
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: universe loader canonicalizes, validates, and loads the checked-in config")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: Run it (GREEN)**

```bash
cd apps/api && .venv/Scripts/python.exe -m src.scanner.universe_selftest
```
Expected: `PASS: universe loader canonicalizes, validates, and loads the checked-in config` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/scanner/__init__.py apps/api/src/scanner/universe.py apps/api/src/scanner/config/universe.json apps/api/src/scanner/universe_selftest.py
git commit -m "feat(scanner): D3 universe-config loader + checked-in universe.json (canon/dedupe/subset-validate)"
```

---

### Task 4: The tiering/promotion PURE LOGIC with an injected clock (crux c — the centerpiece)

> Item **5** + crux **(c)** — the highest-risk logic in the feature. Move-detection thresholding, promotion-queue capping, and round-robin fairness as **pure functions with an injected `now`**, isolated from all I/O. The `tiering_selftest` is the plan's centerpiece; it proves the **anti-herd guarantee** RED→GREEN.

**Files:**
- Create: `apps/api/src/scanner/tiering.py`
- Create: `apps/api/src/scanner/tiering_selftest.py`

**Interfaces:**
- Produces (Task 6 consumes these):
  - `SweepConfig` dataclass — `move_threshold_pct: float = 0.75`, `slow_batch_size: int = 4`, `promotion_cap: int = 2`.
  - `SymbolSched` dataclass — `symbol: str`, `last_compute_at: Optional[float]` (None = never computed / `building`), `last_compute_price: Optional[float]`.
  - `CyclePlan` dataclass — `batch: list[str]`, `next_cursor: int`, `promoted: list[str]`.
  - `pct_move(old, new) -> Optional[float]`; `detect_moves(universe, scheds, prices, threshold_pct) -> list[str]`; `plan_cycle(universe, scheds, prices, rr_cursor, cfg, now, moved=None) -> CyclePlan`.

- [ ] **Step 1: Write the pure logic**

Create `apps/api/src/scanner/tiering.py`:

```python
"""Tiering / promotion PURE LOGIC (crux c — the one algorithm that would silently rot). Move-detection
thresholding, promotion-queue capping, and round-robin fairness as PURE functions with an INJECTED
clock (`now`), isolated from the vendor and the store so they are unit-testable without either.

The binding property (D4) is the FAIRNESS / ANTI-HERD guarantee: a cycle NEVER computes more than
`slow_batch_size` symbols regardless of how many moved, and at most `min(promotion_cap, slow_batch_size)`
slots go to promotions — so at least `slow_batch_size - promotion_cap` baseline round-robin slots are
guaranteed every cycle, meaning a market-wide move degrades to base cadence (the round-robin still
advances) rather than a thundering herd. Priority within promotions: never-computed ('building') first,
then moved symbols by most-overdue (now - last_compute_at) desc."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class SweepConfig:
    move_threshold_pct: float = 0.75    # D4: > this % move since last compute -> promotion candidate
    slow_batch_size: int = 4            # pool ~4 (the concurrency bound = symbols computed per cycle)
    promotion_cap: int = 2              # max promotion slots per cycle (anti-herd; < slow_batch_size)


@dataclass(frozen=True)
class SymbolSched:
    symbol: str
    last_compute_at: Optional[float]    # None = never computed (a 'building' symbol)
    last_compute_price: Optional[float]


@dataclass(frozen=True)
class CyclePlan:
    batch: list[str]        # the symbols to compute this cycle (<= slow_batch_size)
    next_cursor: int        # advanced round-robin cursor
    promoted: list[str]     # the subset of `batch` that jumped the queue (building + moved)


def pct_move(old: Optional[float], new: Optional[float]) -> Optional[float]:
    """Absolute % move from `old` to `new`. None when `old` is missing/non-positive or `new` is
    missing (we never fabricate a move on a symbol we couldn't price)."""
    if old is None or old <= 0 or new is None:
        return None
    return abs(new - old) / old * 100.0


def detect_moves(universe: list[str], scheds: dict, prices: dict,
                 threshold_pct: float) -> list[str]:
    """Universe symbols (already computed at least once) whose live price moved STRICTLY MORE than
    `threshold_pct` since their last compute. Order-preserving over `universe`."""
    moved: list[str] = []
    for sym in universe:
        sched = scheds.get(sym)
        if sched is None or sched.last_compute_at is None:
            continue  # never computed -> handled as 'building', not a move
        mv = pct_move(sched.last_compute_price, prices.get(sym))
        if mv is not None and mv > threshold_pct:
            moved.append(sym)
    return moved


def _round_robin(universe: list[str], cursor: int, n: int, exclude: set) -> "tuple[list[str], int]":
    """Collect up to `n` symbols walking `universe` from `cursor`, skipping `exclude`, wrapping AT
    MOST once (so it terminates even when n > available). Returns (picked, next_cursor)."""
    out: list[str] = []
    total = len(universe)
    if total == 0 or n <= 0:
        return out, (cursor % total) if total else 0
    i = cursor % total
    steps = 0
    while len(out) < n and steps < total:
        sym = universe[i]
        if sym not in exclude:
            out.append(sym)
        i = (i + 1) % total
        steps += 1
    return out, i


def plan_cycle(universe: list[str], scheds: dict, prices: dict, rr_cursor: int,
               cfg: SweepConfig, now: float, moved: Optional[list] = None) -> CyclePlan:
    """Plan ONE slow-lane cycle. `moved` may be precomputed (the fast lane's running set); when None
    it is derived here via detect_moves. Deterministic given `now`."""
    building = [s for s in universe
                if s in scheds and scheds[s].last_compute_at is None]
    if moved is None:
        moved_list = detect_moves(universe, scheds, prices, cfg.move_threshold_pct)
    else:
        moved_list = [s for s in universe
                      if s in set(moved) and s in scheds and scheds[s].last_compute_at is not None]

    # Rank promotions: building first (order-preserving), then moved by most-overdue desc.
    moved_ranked = sorted(
        moved_list, key=lambda s: now - (scheds[s].last_compute_at or now), reverse=True)
    ranked = building + moved_ranked

    promo_slots = min(cfg.promotion_cap, cfg.slow_batch_size)
    promoted = ranked[:promo_slots]
    remaining = cfg.slow_batch_size - len(promoted)
    baseline, next_cursor = _round_robin(universe, rr_cursor, remaining, exclude=set(promoted))
    return CyclePlan(batch=promoted + baseline, next_cursor=next_cursor, promoted=promoted)
```

- [ ] **Step 2: Write the centerpiece selftest**

Create `apps/api/src/scanner/tiering_selftest.py`:

```python
"""CENTERPIECE runnable selftest for the tiering/promotion PURE LOGIC (crux c). Deterministic, with
an INJECTED clock — no vendor, no store, no wall-clock. Proves move-detection, building-first
priority, most-overdue ordering, round-robin fairness, and (the load-bearing assertion) the ANTI-HERD
guarantee: a market-wide move never computes more than slow_batch_size symbols per cycle.
Run: apps/api/.venv/Scripts/python.exe -m src.scanner.tiering_selftest  (cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

from .tiering import (CyclePlan, SweepConfig, SymbolSched, detect_moves, pct_move, plan_cycle)

UNIV = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF"]


def _scheds(computed_at: dict, prices_at: dict) -> dict:
    """Build a scheds map; symbols absent from `computed_at` are 'building' (last_compute_at=None)."""
    return {s: SymbolSched(s, computed_at.get(s), prices_at.get(s)) for s in UNIV}


def run() -> None:
    cfg = SweepConfig(move_threshold_pct=0.75, slow_batch_size=4, promotion_cap=2)
    NOW = 1000.0

    # 1. pct_move: None on bad old; correct otherwise; strict threshold boundary.
    assert pct_move(None, 10.0) is None and pct_move(0.0, 10.0) is None and pct_move(10.0, None) is None
    assert abs(pct_move(100.0, 101.0) - 1.0) < 1e-9, "1% move"
    assert pct_move(100.0, 100.75) == 0.75, "exact-threshold move value"

    # 2. cold universe (all building), no prices: one cycle computes exactly slow_batch_size, and
    #    round-robin over consecutive cycles reaches EVERY symbol (fairness).
    scheds = _scheds({}, {})
    cursor, seen = 0, set()
    for _ in range(3):  # 3 cycles * 4 >= 6 symbols
        plan = plan_cycle(UNIV, scheds, {}, cursor, cfg, NOW)
        assert len(plan.batch) == cfg.slow_batch_size, f"cold batch size {plan.batch}"
        cursor = plan.next_cursor
        seen.update(plan.batch)
    assert seen == set(UNIV), f"round-robin must reach every symbol, missed {set(UNIV) - seen}"

    # 3. all computed, one symbol moves > threshold -> it is PROMOTED (appears; is in `promoted`).
    computed = {s: 900.0 for s in UNIV}
    px = {s: 100.0 for s in UNIV}          # last_compute_price
    scheds = {s: SymbolSched(s, 900.0, 100.0) for s in UNIV}
    live = dict(px); live["EEE"] = 101.0   # +1.0% > 0.75%
    moved = detect_moves(UNIV, scheds, live, cfg.move_threshold_pct)
    assert moved == ["EEE"], f"only EEE moved, got {moved}"
    plan = plan_cycle(UNIV, scheds, live, rr_cursor=0, cfg=cfg, now=NOW, moved=moved)
    assert "EEE" in plan.promoted and "EEE" in plan.batch, f"EEE must be promoted: {plan}"

    # 4. most-overdue ordering among moved (injected clock): FFF last-computed earlier -> ranks first.
    scheds2 = {s: SymbolSched(s, 500.0, 100.0) for s in UNIV}
    scheds2["EEE"] = SymbolSched("EEE", 990.0, 100.0)   # computed recently
    scheds2["FFF"] = SymbolSched("FFF", 100.0, 100.0)   # computed long ago (more overdue)
    live2 = {s: 100.0 for s in UNIV}; live2["EEE"] = 101.0; live2["FFF"] = 101.0
    moved2 = detect_moves(UNIV, scheds2, live2, cfg.move_threshold_pct)
    plan2 = plan_cycle(UNIV, scheds2, live2, 0, cfg, NOW, moved=moved2)
    assert plan2.promoted[0] == "FFF", f"most-overdue moved symbol ranks first: {plan2.promoted}"

    # 5. THE ANTI-HERD GUARANTEE: a MARKET-WIDE move (every symbol moved) still computes only
    #    slow_batch_size, with at most promotion_cap promotions and >=1 baseline slot (fairness).
    scheds3 = {s: SymbolSched(s, 900.0, 100.0) for s in UNIV}
    live3 = {s: 105.0 for s in UNIV}       # every symbol +5% -> all moved
    moved3 = detect_moves(UNIV, scheds3, live3, cfg.move_threshold_pct)
    assert set(moved3) == set(UNIV), "sanity: all moved"
    plan3 = plan_cycle(UNIV, scheds3, live3, 0, cfg, NOW, moved=moved3)
    assert len(plan3.batch) == cfg.slow_batch_size, f"ANTI-HERD: batch must stay <= pool, got {len(plan3.batch)}"
    assert len(plan3.promoted) <= cfg.promotion_cap, f"promotions must be capped, got {plan3.promoted}"
    baseline_slots = len(plan3.batch) - len(plan3.promoted)
    assert baseline_slots >= cfg.slow_batch_size - cfg.promotion_cap >= 1, \
        f"fairness: baseline round-robin slots guaranteed, got {baseline_slots}"


def main() -> int:
    try:
        run()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: tiering pure logic — move detection, promotion cap, round-robin fairness, anti-herd")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 3: RED — break the anti-herd cap, observe FAIL**

Temporarily change `plan_cycle`'s `promoted = ranked[:promo_slots]` to `promoted = ranked` (uncapped), then run:
```bash
cd apps/api && .venv/Scripts/python.exe -m src.scanner.tiering_selftest
```
Expected: `FAIL: ANTI-HERD: batch must stay <= pool, got 6` (exit 1). Restore `promoted = ranked[:promo_slots]`.

- [ ] **Step 4: GREEN**

```bash
cd apps/api && .venv/Scripts/python.exe -m src.scanner.tiering_selftest
```
Expected: `PASS: tiering pure logic — move detection, promotion cap, round-robin fairness, anti-herd` (exit 0).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/scanner/tiering.py apps/api/src/scanner/tiering_selftest.py
git commit -m "feat(scanner): tiering/promotion pure logic (injected clock) — move-detect + cap + round-robin fairness (crux c)"
```

---

### Task 5: The row projection — consume the bundle into a `ScanRow`

> Part of item **4** ("project ONE `ScanRow` per ticker, CONSUMING score/tier/regime/vol_regime/flip/walls/distances off the bundle, never re-deriving"). Pure (no I/O). **Tier is consumed via the same `compute_opportunity_tier` the serve path uses** (Open decision 3); distances are pure display transport.

**Files:**
- Create: `apps/api/src/scanner/projection.py`
- Create: `apps/api/src/scanner/projection_selftest.py`

**Interfaces:**
- Consumes: `scanstore.ScanRow`, `src.core.signals.compute_opportunity_tier`.
- Produces (Task 6 consumes):
  - `TierBands` dataclass — `watch: int`, `actionable: int`, `prime: int`.
  - `project_row(symbol, bundle, now, bands, price=None, chg_pct=None) -> ScanRow` (status `ok`).
  - `project_building(symbol) -> ScanRow` (status `building`, all numerics None, `as_of=0.0`).
  - `project_error(symbol, prev, now) -> ScanRow` (status `error`, keeps prior structure if any).
  - `project_price_only(symbol, prev, price, chg_pct, now, stale_after) -> ScanRow` (fast-lane price merge onto prior structure; recomputes `ok`/`stale`).
  - `refresh_status(row, now, stale_after) -> ScanRow` (recompute status by structure age only).

- [ ] **Step 1: Write the projection**

Create `apps/api/src/scanner/projection.py`:

```python
"""Project a computed bundle into ONE ScanRow — CONSUME, never re-derive. score/regime/vol_regime/
flip/walls are read straight off the bundle compute_ticker produced. `tier` is consumed via the SAME
helper the serve path uses (src.core.signals.compute_opportunity_tier), with the same env-config bands
and the same ai_eval.ready — so a scanner row's tier equals the Ticker page's tier for the same
compute (AC-10); this is consuming the transform, not re-deriving math. `dist_to_flip_pct` /
`dist_to_wall_pct` are pure DISPLAY TRANSPORT (signed % of price vs the consumed level), exactly as the
Ticker page renders them — no engine/greeks math. Every numeric field is nullable: a partial/failed
compute still yields an honest row. as_of = the STRUCTURE compute time; a fast-lane price update keeps
as_of and only refreshes price/status (two-speed honesty)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from src.core.signals import compute_opportunity_tier
from src.scanstore import ScanRow


@dataclass(frozen=True)
class TierBands:
    watch: int
    actionable: int
    prime: int


def _signed_dist_pct(price: Optional[float], level: Optional[float]) -> Optional[float]:
    """Signed % of `price` relative to `level` (+ above the level, - below). Pure transport."""
    if price is None or price <= 0 or level is None:
        return None
    return round((price - level) / price * 100.0, 2)


def _nearer_wall_dist(price: Optional[float], call_wall: Optional[float],
                      put_wall: Optional[float]) -> Optional[float]:
    walls = [w for w in (call_wall, put_wall) if w is not None]
    if price is None or price <= 0 or not walls:
        return None
    nearer = min(walls, key=lambda w: abs(price - w))
    return round((price - nearer) / price * 100.0, 2)


def _status_for(as_of: float, now: float, stale_after: float, base: str = "ok") -> str:
    return "stale" if (as_of > 0 and (now - as_of) > stale_after) else base


def project_row(symbol: str, bundle: dict, now: float, bands: TierBands,
                price: Optional[float] = None, chg_pct: Optional[float] = None) -> ScanRow:
    """Full projection from a fresh compute. `price`/`chg_pct` override the display spot with the
    fast-lane poll value when provided (fresher); else the bundle's display price is used."""
    state = bundle.get("market_state", {}) or {}
    sig = bundle.get("signals", {}) or {}
    ai_eval = bundle.get("ai_eval", {}) or {}

    score = sig.get("opportunity_score")
    try:
        tier = compute_opportunity_tier(
            int(score or 0), bool(ai_eval.get("ready")),
            watch=bands.watch, actionable=bands.actionable, prime=bands.prime)
    except Exception:
        tier = None

    display_price = price if price is not None else state.get("price")
    flip = state.get("gamma_flip")
    call_wall = state.get("call_wall")
    put_wall = state.get("put_wall")

    return ScanRow(
        symbol=symbol.upper(),
        price=display_price,
        chg_pct=chg_pct,
        score=score,
        tier=tier,
        regime=sig.get("regime"),
        vol_regime=sig.get("vol_regime"),
        flip=flip,
        dist_to_flip_pct=_signed_dist_pct(display_price, flip),
        call_wall=call_wall,
        put_wall=put_wall,
        dist_to_wall_pct=_nearer_wall_dist(display_price, call_wall, put_wall),
        as_of=now,
        status="ok",
    )


def project_building(symbol: str) -> ScanRow:
    """A tracked-but-never-computed symbol: present, honestly not-yet-scored (as_of=0.0)."""
    return ScanRow(symbol=symbol.upper(), price=None, chg_pct=None, score=None, tier=None,
                   regime=None, vol_regime=None, flip=None, dist_to_flip_pct=None,
                   call_wall=None, put_wall=None, dist_to_wall_pct=None, as_of=0.0, status="building")


def project_error(symbol: str, prev: Optional[ScanRow], now: float) -> ScanRow:
    """This symbol's last compute failed: degrade THIS row to `error`, keeping any prior structure
    (frozen) so the table still shows the last-known values with an honest status."""
    if prev is None:
        r = project_building(symbol)
        return ScanRow(**{**r.__dict__, "status": "error"})
    return ScanRow(**{**prev.__dict__, "status": "error"})


def project_price_only(symbol: str, prev: Optional[ScanRow], price: Optional[float],
                       chg_pct: Optional[float], now: float, stale_after: float) -> ScanRow:
    """Fast-lane price update: merge the poll price/chg onto the prior STRUCTURE row, keep as_of at
    the structure compute time, and recompute status by structure age (ok<->stale). A `building` row
    stays building (still no structure) but shows the price. Never fabricates a structure."""
    if prev is None:
        prev = project_building(symbol)
    dist_flip = _signed_dist_pct(price, prev.flip)
    dist_wall = _nearer_wall_dist(price, prev.call_wall, prev.put_wall)
    if prev.status == "building":
        status = "building"
    else:
        status = _status_for(prev.as_of, now, stale_after, base="ok")
    return ScanRow(**{**prev.__dict__, "price": price, "chg_pct": chg_pct,
                      "dist_to_flip_pct": dist_flip, "dist_to_wall_pct": dist_wall,
                      "status": status})


def refresh_status(row: ScanRow, now: float, stale_after: float) -> ScanRow:
    """Recompute a row's status by structure age only (used when a poll had no price for a symbol —
    freeze everything, just age the status). `building` stays building."""
    if row.status == "building":
        return row
    return ScanRow(**{**row.__dict__, "status": _status_for(row.as_of, now, stale_after,
                                                             base="ok" if row.status == "ok" else row.status)})
```

- [ ] **Step 2: Write the projection selftest**

Create `apps/api/src/scanner/projection_selftest.py`:

```python
"""Runnable projection check (Scanner v1 Plan 2 Task 5). No pytest. Uses a CANNED bundle (no vendor).
Run: apps/api/.venv/Scripts/python.exe -m src.scanner.projection_selftest  (cwd = apps/api)."""
from __future__ import annotations

from src.core.signals import compute_opportunity_tier
from .projection import (TierBands, project_building, project_error, project_price_only,
                         project_row, refresh_status)

BANDS = TierBands(watch=25, actionable=50, prime=75)


def _bundle(score, ready, price=100.0, flip=95.0, call_wall=115.0, put_wall=90.0):
    return {
        "market_state": {"price": price, "gamma_flip": flip,
                         "call_wall": call_wall, "put_wall": put_wall, "timestamp": 0},
        "signals": {"opportunity_score": score, "regime": "positive_gamma", "vol_regime": "iv_rich"},
        "ai_eval": {"ready": ready},
    }


def run() -> None:
    # 1. Full projection consumes score/regime/vol_regime/flip/walls; tier via the SAME helper.
    b = _bundle(score=80, ready=True)
    row = project_row("spy", b, now=1000.0, bands=BANDS)
    assert row.symbol == "SPY" and row.status == "ok" and row.as_of == 1000.0
    assert row.score == 80 and row.regime == "positive_gamma" and row.vol_regime == "iv_rich"
    assert row.flip == 95.0 and row.call_wall == 115.0 and row.put_wall == 90.0
    # tier must EQUAL what the serve path computes for the same inputs (AC-10 consumption fidelity).
    assert row.tier == compute_opportunity_tier(80, True, watch=25, actionable=50, prime=75) == "prime", row.tier
    # distances are pure transport: price 100 vs flip 95 -> +5.0%; nearer wall = put 90 (10 away,
    # strictly nearer than call 115 at 15 away) -> +10.0%. (Fixture is asymmetric on purpose: an EXACT
    # equidistant tie has an undefined nearer-wall sign and never occurs in real data — see erratum below.)
    assert row.dist_to_flip_pct == 5.0, row.dist_to_flip_pct
    assert row.dist_to_wall_pct == 10.0, row.dist_to_wall_pct

    # 2. Prime requires ai_ready: same score, ready=False -> actionable (mirrors serve-path rule).
    row2 = project_row("qqq", _bundle(score=80, ready=False), 1000.0, BANDS)
    assert row2.tier == "actionable", row2.tier

    # 3. Fast-lane price override: price/chg come from the poll, structure from the bundle.
    row3 = project_row("iwm", _bundle(score=30, ready=False), 1000.0, BANDS, price=201.0, chg_pct=1.2)
    assert row3.price == 201.0 and row3.chg_pct == 1.2 and row3.tier == "watch"

    # 4. building: present, not-yet-scored, honest.
    bld = project_building("nvda")
    assert bld.status == "building" and bld.score is None and bld.as_of == 0.0 and bld.price is None

    # 5. price-only merge onto structure: keeps as_of, ages status to stale past the budget.
    fresh = project_row("amd", _bundle(score=60, ready=True), now=1000.0, bands=BANDS)
    merged = project_price_only("amd", fresh, price=105.0, chg_pct=0.4, now=1000.0 + 999.0,
                                stale_after=180.0)
    assert merged.price == 105.0 and merged.chg_pct == 0.4 and merged.as_of == 1000.0
    assert merged.status == "stale", f"structure aged past budget -> stale, got {merged.status}"
    # within budget stays ok.
    ok_merge = project_price_only("amd", fresh, 106.0, 0.5, now=1000.0 + 10.0, stale_after=180.0)
    assert ok_merge.status == "ok", ok_merge.status

    # 6. error keeps prior structure but flips status; a building->error keeps building numerics.
    err = project_error("amd", fresh, now=2000.0)
    assert err.status == "error" and err.flip == fresh.flip, err
    err2 = project_error("meta", None, now=2000.0)
    assert err2.status == "error" and err2.score is None, err2

    # 7. price-only on a building row stays building (never fabricates structure).
    bld_priced = project_price_only("nvda", bld, price=500.0, chg_pct=2.0, now=1000.0, stale_after=180.0)
    assert bld_priced.status == "building" and bld_priced.price == 500.0, bld_priced

    # 8. refresh_status ages a stranded ok row without touching values.
    aged = refresh_status(fresh, now=1000.0 + 500.0, stale_after=180.0)
    assert aged.status == "stale" and aged.price == fresh.price, aged


def main() -> int:
    try:
        run()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: projection consumes the bundle (tier via serve-path helper; distances = transport)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 3: Run it (GREEN)**

```bash
cd apps/api && .venv/Scripts/python.exe -m src.scanner.projection_selftest
```
Expected: `PASS: projection consumes the bundle (tier via serve-path helper; distances = transport)` (exit 0).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/scanner/projection.py apps/api/src/scanner/projection_selftest.py
git commit -m "feat(scanner): row projection — consume bundle -> ScanRow (tier via serve-path helper; distances = transport)"
```

---

### Task 6: The two-speed loop (fast lane + slow lane + heartbeat + bundle-blob writes)

> Items **4** (loop), **6** (heartbeat), **7** (blob writes wired). The loop is fully **injectable** (universe / store / snapshot fn / compute fn / clock / sleep), so an **embedded short run against a stub provider + a canned bundle** verifies it with no live vendor key. All store calls are best-effort.

**Files:**
- Create: `apps/api/src/scanner/loop.py`
- Create: `apps/api/src/scanner/loop_selftest.py`

**Interfaces:**
- Consumes: `scanstore` (`ScanStore`, `ScanRow`, `SweepHeartbeat`, `BundleBlob`), `tiering` (`SweepConfig`, `SymbolSched`, `plan_cycle`, `pct_move`), `projection` (`TierBands`, `project_*`).
- Produces (Task 7 wires):
  - `LoopConfig` dataclass — `fast_interval: float = 30.0`, `stale_after: float = 180.0`, `sweep: SweepConfig`.
  - `LoopDeps` dataclass — `universe`, `store`, `bands`, `fetch_snapshots` (sync), `compute_bundle` (async `str -> dict|None`), `clock`, `sleep`, `config`.
  - `async def run(deps, *, stop_event=None, max_slow_cycles=None) -> None`.
  - `async def fast_tick(deps, state) -> None`, `async def slow_cycle(deps, state) -> None`, `class SweepState`.

- [ ] **Step 1: Write the loop**

Create `apps/api/src/scanner/loop.py`:

```python
"""The two-speed sweep loop (Scanner v1 Plan 2). FAST lane: one multi-ticker snapshot poll (~30s) ->
prices + move detection (feeds the promotion set). SLOW lane: a concurrency-bounded chain sweep
(pool == slow_batch_size) through the UNCHANGED compute_ticker -> one ScanRow per ticker, latest-wins
into the store, plus the bundle-blob for the warm-click. HEARTBEAT every tick + last-completed-pass.

All I/O is INJECTED (fetch_snapshots / compute_bundle / store / clock / sleep) so the loop is testable
against a stub with no live key. Both lanes run as cooperative asyncio tasks on ONE event loop, so the
shared SweepState needs no lock (single-threaded). Every store call is best-effort: a store outage
skips the write and the loop keeps running ([best-effort-isolated-or-null]); a per-ticker compute
failure degrades that row to `error` and the sweep continues."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Optional

from src.scanstore import BundleBlob, ScanRow, ScanStore, SweepHeartbeat

from .projection import (TierBands, project_building, project_error, project_price_only,
                         project_row, refresh_status)
from .tiering import SweepConfig, SymbolSched, plan_cycle, pct_move

logger = logging.getLogger("Convexa")


@dataclass
class LoopConfig:
    fast_interval: float = 30.0     # D4 fast-lane poll cadence (seconds)
    stale_after: float = 180.0      # structure freshness budget (~3 min) -> `stale`
    sweep: SweepConfig = field(default_factory=SweepConfig)


@dataclass
class LoopDeps:
    universe: list[str]
    store: ScanStore
    bands: TierBands
    fetch_snapshots: Callable[[list[str]], dict]                 # sync -> {symbol: StockSnapshot}
    compute_bundle: Callable[[str], Awaitable[Optional[dict]]]   # async -> bundle | None
    clock: Callable[[], float]
    sleep: Callable[[float], Awaitable[None]]
    config: LoopConfig = field(default_factory=LoopConfig)


class SweepState:
    """Mutable per-run state (single event loop; no lock)."""
    def __init__(self, universe: list[str]):
        self.universe = universe
        self.scheds: dict[str, SymbolSched] = {s: SymbolSched(s, None, None) for s in universe}
        self.rows: dict[str, ScanRow] = {s: project_building(s) for s in universe}
        self.prices: dict[str, tuple] = {}          # symbol -> (price, chg_pct)
        self.moved: set = set()                     # symbols flagged by the fast lane
        self.rr_cursor: int = 0
        self.swept_since_pass: set = set()          # symbols computed since the last full-pass marker
        self.sweep_last_completed: Optional[float] = None


# --- best-effort store wrappers (a store outage must never break the loop) ---
def _safe_upsert(store: ScanStore, row: ScanRow) -> None:
    try:
        store.upsert_row(row)
    except Exception:
        logger.debug("scan loop: upsert_row skipped (store outage)", exc_info=True)


def _safe_heartbeat(store: ScanStore, hb: SweepHeartbeat) -> None:
    try:
        store.write_heartbeat(hb)
    except Exception:
        logger.debug("scan loop: write_heartbeat skipped (store outage)", exc_info=True)


def _safe_blob(store: ScanStore, symbol: str, bundle: dict, as_of: float) -> None:
    try:
        import json
        store.write_bundle_blob(BundleBlob(symbol=symbol.upper(), as_of=as_of,
                                           bundle_json=json.dumps(bundle, default=str)))
    except Exception:
        logger.debug("scan loop: write_bundle_blob skipped", exc_info=True)


async def fast_tick(deps: LoopDeps, st: SweepState) -> None:
    """One fast-lane poll: update prices + move flags for the whole universe, upsert each row, beat."""
    now = deps.clock()
    try:
        snaps = await asyncio.to_thread(deps.fetch_snapshots, deps.universe)
    except Exception:
        logger.warning("scan loop: snapshot poll failed; freezing prices", exc_info=True)
        snaps = {}
    for sym in deps.universe:
        snap = snaps.get(sym)
        prev = st.rows.get(sym)
        if snap is not None and snap.get("price") is not None:
            price, chg = snap["price"], snap.get("chg_pct")
            st.prices[sym] = (price, chg)
            sched = st.scheds[sym]
            mv = pct_move(sched.last_compute_price, price)
            if mv is not None and mv > deps.config.sweep.move_threshold_pct:
                st.moved.add(sym)
            st.rows[sym] = project_price_only(sym, prev, price, chg, now, deps.config.stale_after)
        else:
            # No price this poll -> freeze the row, just age the status ([best-effort-...]).
            st.rows[sym] = refresh_status(prev, now, deps.config.stale_after)
        _safe_upsert(deps.store, st.rows[sym])
    _safe_heartbeat(deps.store, SweepHeartbeat(updated_at=now,
                    sweep_last_completed=st.sweep_last_completed, universe_size=len(deps.universe)))


async def slow_cycle(deps: LoopDeps, st: SweepState) -> None:
    """One slow-lane cycle: plan the batch (promotions + round-robin), compute it concurrently through
    the UNCHANGED compute_bundle, project + persist each row + its bundle-blob."""
    now = deps.clock()
    prices = {s: st.prices.get(s, (None, None))[0] for s in deps.universe}
    plan = plan_cycle(deps.universe, st.scheds, prices, st.rr_cursor,
                      deps.config.sweep, now, moved=list(st.moved))
    st.rr_cursor = plan.next_cursor

    async def _compute_one(sym: str) -> None:
        try:
            bundle = await deps.compute_bundle(sym)
        except Exception:
            logger.warning(f"[{sym}] scan compute failed; row -> error", exc_info=True)
            bundle = None
        cnow = deps.clock()
        if bundle is None:
            st.rows[sym] = project_error(sym, st.rows.get(sym), cnow)
        else:
            price, chg = st.prices.get(sym, (None, None))
            st.rows[sym] = project_row(sym, bundle, cnow, deps.bands, price=price, chg_pct=chg)
            anchor = (bundle.get("market_state", {}) or {}).get("price")
            st.scheds[sym] = SymbolSched(sym, cnow, anchor)
            st.moved.discard(sym)
            _safe_blob(deps.store, sym, bundle, cnow)
        _safe_upsert(deps.store, st.rows[sym])
        st.swept_since_pass.add(sym)

    # Bounded concurrency == the batch size (== pool). gather is fine: the batch is already capped.
    await asyncio.gather(*[_compute_one(s) for s in plan.batch])

    # Full-pass completion: every universe symbol computed at least once since the last marker.
    if set(deps.universe).issubset(st.swept_since_pass):
        st.sweep_last_completed = deps.clock()
        st.swept_since_pass = set()
        _safe_heartbeat(deps.store, SweepHeartbeat(updated_at=deps.clock(),
                        sweep_last_completed=st.sweep_last_completed, universe_size=len(deps.universe)))


async def _fast_lane(deps: LoopDeps, st: SweepState, stop: asyncio.Event) -> None:
    while not stop.is_set():
        await fast_tick(deps, st)
        await deps.sleep(deps.config.fast_interval)


async def _slow_lane(deps: LoopDeps, st: SweepState, stop: asyncio.Event,
                     max_slow_cycles: Optional[int]) -> None:
    cycles = 0
    while not stop.is_set():
        await slow_cycle(deps, st)
        cycles += 1
        if max_slow_cycles is not None and cycles >= max_slow_cycles:
            return
        await deps.sleep(0)   # yield; the slow lane runs compute-bound, back-to-back


async def run(deps: LoopDeps, *, stop_event: Optional[asyncio.Event] = None,
              max_slow_cycles: Optional[int] = None) -> None:
    """Run the two-speed loop. Seeds `building` rows + an initial heartbeat immediately so the store
    is populated before the first compute. `max_slow_cycles` bounds the slow lane for tests (and runs
    a deterministic fast_tick first so move detection + prices are exercised)."""
    st = SweepState(deps.universe)
    now0 = deps.clock()
    for sym in deps.universe:
        _safe_upsert(deps.store, st.rows[sym])
    _safe_heartbeat(deps.store, SweepHeartbeat(updated_at=now0, sweep_last_completed=None,
                                               universe_size=len(deps.universe)))
    stop = stop_event or asyncio.Event()

    if max_slow_cycles is not None:
        # Deterministic bounded run (tests): one fast poll, then the slow lane to completion.
        await fast_tick(deps, st)
        await _slow_lane(deps, st, stop, max_slow_cycles)
        stop.set()
        return

    logger.info(f"[worker] sweep loop start: universe={len(deps.universe)}, "
                f"fast={deps.config.fast_interval}s, pool={deps.config.sweep.slow_batch_size}")
    tasks = [asyncio.create_task(_fast_lane(deps, st, stop)),
             asyncio.create_task(_slow_lane(deps, st, stop, None))]
    try:
        await asyncio.gather(*tasks)
    finally:
        stop.set()
        for t in tasks:
            t.cancel()
```

- [ ] **Step 2: Write the embedded-mode loop selftest (stub provider + canned bundle; no live key)**

Create `apps/api/src/scanner/loop_selftest.py`:

```python
"""Embedded-mode runnable check for the two-speed loop (Scanner v1 Plan 2 Task 6). No pytest, NO live
vendor key: a stub snapshot fn + a canned async compute fn drive a bounded run against a REAL
SqliteScanStore (temp file). Proves rows land (ok), the bundle-blob is written, the heartbeat carries
the universe size + a completed full pass, and a store outage does NOT crash the loop.
Run: apps/api/.venv/Scripts/python.exe -m src.scanner.loop_selftest  (cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

import asyncio
import json
import os
import tempfile

from src.scanstore.sqlite_store import SqliteScanStore, _SharedDB

from .loop import LoopConfig, LoopDeps, run
from .projection import TierBands
from .tiering import SweepConfig

UNIV = ["AAA", "BBB", "CCC"]
BANDS = TierBands(watch=25, actionable=50, prime=75)


def _canned_bundle(sym: str) -> dict:
    return {
        "market_state": {"price": 100.0, "gamma_flip": 95.0, "call_wall": 110.0,
                         "put_wall": 90.0, "timestamp": 0},
        "signals": {"opportunity_score": 80, "regime": "positive_gamma", "vol_regime": "iv_rich"},
        "ai_eval": {"ready": True},
        "_snapshot": {"ticker": sym, "synchronized_spot": 100.0},
    }


def _stub_snapshots(tickers):
    # Price every symbol; BBB moved far vs a would-be last-compute price (exercises move flag path).
    return {t.upper(): {"symbol": t.upper(),
                        "price": 100.0 if t.upper() != "BBB" else 130.0,
                        "chg_pct": 1.0, "as_of_ns": 1}
            for t in tickers}


async def _compute(sym: str) -> dict:
    return _canned_bundle(sym)


def _make_store():
    fd, path = tempfile.mkstemp(suffix=".sqlite3")
    os.close(fd)
    return SqliteScanStore(_SharedDB(path)), path


def _fake_clock():
    t = {"v": 1000.0}
    def clock():
        t["v"] += 1.0
        return t["v"]
    return clock


async def _noop_sleep(_):  # deterministic: no real waiting
    return None


async def _run_ok(store) -> None:
    deps = LoopDeps(universe=UNIV, store=store, bands=BANDS,
                    fetch_snapshots=_stub_snapshots, compute_bundle=_compute,
                    clock=_fake_clock(), sleep=_noop_sleep,
                    config=LoopConfig(fast_interval=30.0, stale_after=180.0,
                                      sweep=SweepConfig(slow_batch_size=2, promotion_cap=1)))
    # batch size 2 over 3 symbols -> 2 cycles guarantees a full pass.
    await run(deps, max_slow_cycles=2)


class _BrokenStore(SqliteScanStore):
    def upsert_row(self, row):  # simulate a store outage on writes
        raise RuntimeError("store down")
    def write_heartbeat(self, hb):
        raise RuntimeError("store down")
    def write_bundle_blob(self, blob):
        raise RuntimeError("store down")


async def _run_store_outage(path2) -> None:
    broken = _BrokenStore(_SharedDB(path2))
    deps = LoopDeps(universe=UNIV, store=broken, bands=BANDS,
                    fetch_snapshots=_stub_snapshots, compute_bundle=_compute,
                    clock=_fake_clock(), sleep=_noop_sleep,
                    config=LoopConfig(sweep=SweepConfig(slow_batch_size=2, promotion_cap=1)))
    await run(deps, max_slow_cycles=2)   # must NOT raise despite every write failing


def run_all() -> None:
    store, path = _make_store()
    _, path2 = _make_store()
    try:
        asyncio.run(_run_ok(store))
        rows = {r.symbol: r for r in store.read_rows()}
        assert set(rows) == set(UNIV), f"all symbols persisted, got {set(rows)}"
        assert all(r.status == "ok" for r in rows.values()), \
            f"all rows computed ok, got {[(s, r.status) for s, r in rows.items()]}"
        assert rows["AAA"].score == 80 and rows["AAA"].tier == "prime", rows["AAA"]
        # bundle-blob written for every symbol (warm-click source).
        for s in UNIV:
            blob = store.read_bundle_blob(s)
            assert blob is not None, f"missing bundle-blob for {s}"
            assert json.loads(blob.bundle_json)["signals"]["opportunity_score"] == 80, s
        hb = store.read_heartbeat()
        assert hb is not None and hb.universe_size == 3, hb
        assert hb.sweep_last_completed is not None, "a full pass must mark sweep_last_completed"

        # store outage: the loop must survive every write failing (best-effort isolation).
        asyncio.run(_run_store_outage(path2))
    finally:
        for p in (path, path + "-wal", path + "-shm", path2, path2 + "-wal", path2 + "-shm"):
            try:
                os.remove(p)
            except OSError:
                pass


def main() -> int:
    try:
        run_all()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: two-speed loop persists rows+blobs+heartbeat and survives a store outage")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 3: RED — prove the full-pass marker is real**

Temporarily change `slow_cycle`'s completion guard `if set(deps.universe).issubset(st.swept_since_pass):` to `if False:`, then run:
```bash
cd apps/api && .venv/Scripts/python.exe -m src.scanner.loop_selftest
```
Expected: `FAIL: a full pass must mark sweep_last_completed` (exit 1). Restore the guard.

- [ ] **Step 4: GREEN**

```bash
cd apps/api && .venv/Scripts/python.exe -m src.scanner.loop_selftest
```
Expected: `PASS: two-speed loop persists rows+blobs+heartbeat and survives a store outage` (exit 0).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/scanner/loop.py apps/api/src/scanner/loop_selftest.py
git commit -m "feat(scanner): two-speed sweep loop (fast poll + bounded slow sweep) + heartbeat + bundle-blob writes"
```

---

### Task 7: The worker entrypoint + embedded flag + nx `serve-worker` target

> Item **1**. The 2nd-process entrypoint (`apps/api/worker.py`): the loop lifecycle (start/stop/backoff), no HTTP surface, all config env-injected. The `SCANNER_EMBEDDED` dev flag runs the same loop inside the dev-server process (one terminal); production is a standalone 2nd process (same image, different start command — the Railway 2nd-service shape). The new nx `serve-worker` target + env docs.

**Files:**
- Create: `apps/api/worker.py`
- Modify: `apps/api/main.py` (add ONE env-flag-guarded, default-off startup hook)
- Modify: `apps/api/project.json` (add the `serve-worker` target)
- Modify: `apps/api/.env.example` + `apps/api/Dockerfile` (worker env doc block)

**Interfaces:**
- Consumes: `main` (`compute_ticker`, `_acquire_vendor_inputs`, `data_provider`, `INCLUDE_DARK_POOL`, the `TIER_*` bands), `scanstore.get_store`, `scanner.universe.load_universe`, `scanner.projection.TierBands`, `scanner.tiering.SweepConfig`, `scanner.loop`.
- Produces: `build_deps() -> LoopDeps`, `async def run_worker(stop_event=None, max_slow_cycles=None)`, `def main_entry()`; the `serve-worker` nx target.

- [ ] **Step 1: Write the worker entrypoint**

Create `apps/api/worker.py`:

```python
"""Scanner sweep WORKER — the NET-NEW 2nd process (Scanner v1 Plan 2, crux b). Built from the SAME
apps/api image with a DIFFERENT start command (the Railway 2nd-service shape). It exposes NO HTTP
surface; its only outputs are writes to the ScanStore. All config is RUNTIME env-injected
([no-secrets-in-image]).

It REUSES the web module verbatim — main.compute_ticker (the UNCHANGED sole transform),
main._acquire_vendor_inputs (the concurrent + pre-warm-aware vendor acquisition), main.data_provider,
and main's tier bands — so a scanner row is byte-identical to what the Ticker page would compute. The
worker adds NO scoring math.

Run modes:
  - STANDALONE (production): `python worker.py`  (nx: `nx run api:serve-worker`).
  - EMBEDDED (one-terminal dev): set SCANNER_EMBEDDED=1 and run the normal dev server; main.py's
    guarded startup hook (Task 7 Step 2) launches run_worker() inside the API process.

Lifecycle: the loop runs until cancelled; main_entry() adds a restart-with-backoff guard so a fatal
error (e.g. a bad universe config surfaced at start) is logged and retried rather than crash-looping
hot. In production, Railway's restart policy is the outer supervisor."""
from __future__ import annotations

import asyncio
import logging
import os
import sys
import time

import main  # the UNCHANGED web module (imports it; does NOT start uvicorn — that's under __main__)
from src import scanstore
from src.scanner import loop as sweep_loop
from src.scanner.loop import LoopConfig, LoopDeps
from src.scanner.projection import TierBands
from src.scanner.tiering import SweepConfig
from src.scanner.universe import load_universe

logger = logging.getLogger("Convexa")


def _loop_config() -> LoopConfig:
    """All cadence/threshold tunables from RUNTIME env, D4 defaults."""
    return LoopConfig(
        fast_interval=float(os.getenv("SCAN_FAST_INTERVAL_SECONDS", "30")),
        stale_after=float(os.getenv("SCAN_STALE_AFTER_SECONDS", "180")),
        sweep=SweepConfig(
            move_threshold_pct=float(os.getenv("SCAN_MOVE_THRESHOLD_PCT", "0.75")),
            slow_batch_size=int(os.getenv("SCAN_SLOW_BATCH_SIZE", "4")),
            promotion_cap=int(os.getenv("SCAN_PROMOTION_CAP", "2")),
        ),
    )


def _fetch_snapshots(symbols: list[str]) -> dict:
    """Fast-lane poll via the injected provider's net-new multi-ticker snapshot method."""
    return main.data_provider.fetch_stock_snapshots(symbols)


async def _compute_bundle(ticker: str) -> "dict | None":
    """The slow-lane compute: EXACTLY the web serve path — concurrent vendor acquisition, then the
    unchanged compute_ticker in a worker thread. Same inputs in -> byte-identical bundle out."""
    market_data, underlying_history, intraday_bars, _src = await main._acquire_vendor_inputs(
        ticker, dark_pool=main.INCLUDE_DARK_POOL)
    return await asyncio.to_thread(
        main.compute_ticker, ticker, market_data, underlying_history, intraday_bars,
        dark_pool=main.INCLUDE_DARK_POOL)


def build_deps() -> LoopDeps:
    """Wire the real deps: the checked-in universe, the env-selected store, the live provider, and
    main's tier bands."""
    cfg = load_universe()
    store = scanstore.get_store()
    bands = TierBands(watch=main.TIER_WATCH_SCORE, actionable=main.TIER_ACTIONABLE_SCORE,
                      prime=main.TIER_PRIME_SCORE)
    return LoopDeps(universe=cfg.universe, store=store, bands=bands,
                    fetch_snapshots=_fetch_snapshots, compute_bundle=_compute_bundle,
                    clock=time.time, sleep=asyncio.sleep, config=_loop_config())


async def run_worker(stop_event: "asyncio.Event | None" = None,
                     max_slow_cycles: "int | None" = None) -> None:
    """Build deps once (universe read at start — D3) and run the two-speed loop."""
    deps = build_deps()
    await sweep_loop.run(deps, stop_event=stop_event, max_slow_cycles=max_slow_cycles)


def main_entry() -> None:
    """Standalone-process entry with a restart-with-backoff guard (fatal errors retried, not hot-
    looped). In production Railway's restart policy is the outer supervisor."""
    logger.info("[worker] Scanner sweep worker starting (standalone)")
    backoff = 2.0
    while True:
        try:
            asyncio.run(run_worker())
            return  # normal completion (only happens if the loop returns; it runs forever otherwise)
        except KeyboardInterrupt:
            logger.info("[worker] interrupted; shutting down")
            return
        except Exception:
            logger.exception(f"[worker] fatal error; restarting in {backoff:.0f}s")
            time.sleep(backoff)
            backoff = min(backoff * 2, 60.0)


if __name__ == "__main__":
    sys.exit(main_entry())
```

- [ ] **Step 2: Add the embedded-mode startup hook to `main.py` (additive, default-off)**

`main.py` has **no** existing startup/lifespan hook (verified). Add this block **after** the `app = FastAPI(...)` construction (it is the orchestration boundary that may mount the worker — §3.5; it does not touch `compute_ticker` or any scoring code, and with the flag unset the app is byte-identical):

```python
# --- Scanner embedded-worker seam (Scanner v1 P2, default OFF). When SCANNER_EMBEDDED=1, run the
# sweep loop INSIDE this API process (one-terminal dev). Production runs the worker as a SEPARATE
# process (worker.py / nx serve-worker). This is orchestration-only: it imports worker lazily and
# spawns a background task; it NEVER touches compute_ticker/scoring, and unset => byte-identical app.
if os.getenv("SCANNER_EMBEDDED", "").strip() in ("1", "true", "True"):
    @app.on_event("startup")
    async def _start_embedded_scanner():   # pragma: no cover - dev convenience seam
        import worker
        logger.info("[main] SCANNER_EMBEDDED=1 -> launching in-process sweep worker")
        app.state._scanner_task = asyncio.create_task(worker.run_worker())
```

- [ ] **Step 3: Verify the worker imports + builds deps against the disk store (no live key needed)**

`build_deps()` calls `get_provider()` (constructs the Massive client — tolerates a missing key, only logs) and `load_universe()` (reads the checked-in JSON) and `scanstore.get_store()` (disk default). Run:
```bash
cd apps/api && SCAN_STORE_PATH="$(python -c 'import tempfile,os;print(os.path.join(tempfile.mkdtemp(),"scan.sqlite3"))')" .venv/Scripts/python.exe -c "import worker; d=worker.build_deps(); print('universe', len(d.universe)); print('pool', d.config.sweep.slow_batch_size); print('has fetch', callable(d.fetch_snapshots))"
```
Expected: logs (`Market-data provider: massive`, `[universe] loaded …`, `Scan store (sqlite-disk): …`) then `universe 25`, `pool 4`, `has fetch True`. (If Git Bash does not export the inline var, `export SCAN_STORE_PATH=...` first so no real `data/` file is written.)

- [ ] **Step 4: Verify the embedded seam boots the worker in-process (bounded, stub-free smoke)**

This proves the `main.py` hook wiring parses and imports cleanly (it does NOT run a live sweep — no key):
```bash
cd apps/api && .venv/Scripts/python.exe -c "import os; os.environ['SCANNER_EMBEDDED']='1'; import main; print('embedded hook registered:', hasattr(main.app, 'router')); print('worker importable:', __import__('worker') is not None)"
```
Expected: prints `embedded hook registered: True` then `worker importable: True` (module imports without starting uvicorn or a live sweep).

- [ ] **Step 5: Add the `serve-worker` nx target**

Replace `apps/api/project.json` with (adds `serve-worker` alongside `serve`, mirroring `serve`'s cwd + venv-python shape):

```json
{
  "name": "api",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "apps/api",
  "tags": ["scope:backend", "type:app"],
  "targets": {
    "serve": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "apps/api",
        "command": ".venv\\Scripts\\python.exe main.py"
      },
      "cache": false
    },
    "serve-worker": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "apps/api",
        "command": ".venv\\Scripts\\python.exe worker.py"
      },
      "cache": false
    },
    "conformance": {
      "executor": "nx:run-commands",
      "options": {
        "command": "apps\\api\\.venv\\Scripts\\python.exe .claude\\tools\\interface_conformance.py --spec .claude\\tools\\conformance\\ai_recommendations.json --url http://127.0.0.1:8000"
      },
      "inputs": [
        "{projectRoot}/main.py",
        "{projectRoot}/src/**/*",
        "{workspaceRoot}/.claude/tools/interface_conformance.py",
        "{workspaceRoot}/.spire/clusters/tech/state/conformance/ai_recommendations.json"
      ],
      "cache": false
    }
  }
}
```

Verify nx sees the target (read-only; do not start it):
```bash
cd C:/Dev/convexa && npx nx show project api --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('serve-worker' in JSON.parse(s).targets))"
```
Expected: `true`. (If node/nvm is not on PATH in this shell, instead confirm via `git diff apps/api/project.json` that the `serve-worker` block is present and well-formed JSON — `python -c "import json;json.load(open('apps/api/project.json'))"` prints nothing on success.)

- [ ] **Step 6: Document the worker env vars (docs, not secrets)**

Append to `apps/api/.env.example` after the existing `# --- Scanner sweep store` block:
```
# --- Scanner sweep worker (Scanner v1 P2). All optional; D4 defaults shown. ---
# SCANNER_EMBEDDED=       # 1 => run the sweep loop inside the dev API process (one terminal). Prod uses the 2nd process.
# SCAN_UNIVERSE_PATH=     # override the checked-in universe JSON (default src/scanner/config/universe.json)
# SCAN_FAST_INTERVAL_SECONDS=30    # fast-lane snapshot poll cadence
# SCAN_STALE_AFTER_SECONDS=180     # structure freshness budget -> `stale`
# SCAN_MOVE_THRESHOLD_PCT=0.75     # move that promotes a symbol in the sweep queue
# SCAN_SLOW_BATCH_SIZE=4           # slow-lane concurrency (pool) = symbols computed per cycle
# SCAN_PROMOTION_CAP=2             # max promotions per cycle (anti-herd; < SCAN_SLOW_BATCH_SIZE)
```

Add the worker var NAMES to the `apps/api/Dockerfile` runtime-env header comment (names only, never values), extending the existing list after the `SCAN_STORE, SCAN_DATABASE_URL, SCAN_STORE_PATH` line:
```
#   SCANNER_EMBEDDED, SCAN_UNIVERSE_PATH, SCAN_FAST_INTERVAL_SECONDS,
#   SCAN_STALE_AFTER_SECONDS, SCAN_MOVE_THRESHOLD_PCT, SCAN_SLOW_BATCH_SIZE,
#   SCAN_PROMOTION_CAP
```
(The Dockerfile's `CMD` stays `uvicorn main:app …` — the web image is unchanged; the worker is the SAME image started with `python worker.py` as a second Railway service, so no Dockerfile CMD change is needed.)

- [ ] **Step 7: Re-run every selftest (full P2 surface intact) + commit**

```bash
cd apps/api && .venv/Scripts/python.exe -m src.providers._snapshot_selftest && .venv/Scripts/python.exe -m src.scanstore._selftest && .venv/Scripts/python.exe -m src.scanner.universe_selftest && .venv/Scripts/python.exe -m src.scanner.tiering_selftest && .venv/Scripts/python.exe -m src.scanner.projection_selftest && .venv/Scripts/python.exe -m src.scanner.loop_selftest
```
Expected: six `PASS: …` lines, exit 0.

```bash
git add apps/api/worker.py apps/api/main.py apps/api/project.json apps/api/.env.example apps/api/Dockerfile
git commit -m "feat(scanner): sweep worker entrypoint + SCANNER_EMBEDDED seam + nx serve-worker target + env docs"
```

---

## Self-Review

- **Spec coverage (the 7 items the plan MUST cover):**
  1. **Worker entrypoint + embedded flag + nx target** → Task 7 (`worker.py` lifecycle/backoff, `SCANNER_EMBEDDED` guarded `main.py` hook, `serve-worker` target). ✓
  2. **Universe config loader + checked-in JSON** → Task 3 (`universe.py` + `config/universe.json`, canon/dedupe/subset-validate, `SCAN_UNIVERSE_PATH`). ✓
  3. **Net-new multi-ticker snapshot method** → Task 1 (`StockSnapshot` + `fetch_stock_snapshots` on the ABC + Massive `get_snapshot_all` with per-ticker fallback; best-effort freeze). ✓
  4. **Two-speed loop → ScanRow via unchanged `compute_ticker`** → Task 5 (projection, consume-not-re-derive) + Task 6 (loop, slow lane calls `main.compute_ticker` via Task 7's `_compute_bundle`). ✓
  5. **Tiering/promotion pure logic + injected clock** → Task 4 (centerpiece `tiering.py` + `tiering_selftest.py`, anti-herd RED→GREEN). ✓
  6. **Heartbeat writes** → Task 6 (`_safe_heartbeat` every fast tick + on full-pass completion; `universe_size` + `sweep_last_completed`). ✓
  7. **Bundle-blob ScanStore method** → Task 2 (`BundleBlob` + `write/read_bundle_blob` on port + both adapters + `_selftest`), wired in Task 6 (`_safe_blob`). ✓
- **Invariants structurally preserved:** `[additive-keeps-score-byte-identical]` — the worker CALLS the unchanged `compute_ticker`/`_acquire_vendor_inputs` and CONSUMES the bundle; the only edits to shared files are additive (a new ABC method, new store methods, a default-off `main.py` hook); `scanner/` and `scanstore/` are never imported by scoring modules. `[best-effort-isolated-or-null]` — per-row `error`/`stale` degrade, frozen prices on a failed poll, best-effort store wrappers, restart backoff; proven by the loop selftest's store-outage path. `[no-secrets-in-image]` — all tunables + connection strings are runtime env; universe JSON is checked-in non-secret. `[live-vs-static-isolation]` — poll-only, no SSE. `[model-read-carries-its-assumptions]`/`[digested-labels-not-raw-dump]` — per-row `as_of` + closed `status`, closed enums, no raw series.
- **Placeholder scan:** no TBD/TODO; every step has runnable code + an exact command (cwd noted) + expected output. Three RED→GREEN disciplines (Task 2 blob latest-wins, Task 4 anti-herd cap, Task 6 full-pass marker).
- **Type consistency:** `StockSnapshot`/`ScanRow`/`SweepHeartbeat`/`BundleBlob` field names + `_ROW_COLS` order match P1; `SweepConfig`/`SymbolSched`/`CyclePlan`/`TierBands`/`LoopConfig`/`LoopDeps` names identical across `tiering`/`projection`/`loop`/`worker`; `compute_opportunity_tier(score, ai_ready, *, watch, actionable, prime)` called with the exact serve-path signature; `main.compute_ticker`/`main._acquire_vendor_inputs` invoked with their real signatures.
- **Grounded in real code:** mirrors `apps/api/src/providers/massive.py::fetch_options_market_state` (idiom) + `get_snapshot_all`/`get_snapshot_ticker` (confirmed on the installed SDK); `apps/api/main.py::_acquire_vendor_inputs`/`compute_ticker` (the `asyncio.gather`-over-`to_thread` precedent, reused verbatim) + the `bundle["market_state"|"signals"|"ai_eval"]` shape + the serve-time tier overlay in `_wrap`; `apps/api/src/core/chain_store.py` (best-effort side-store precedent); `apps/api/src/marketdata/__init__.py` (factory pattern) + the P1 `scanstore` files; `apps/api/project.json` (the `serve` target shape).

## The rest of Scanner v1 — Plans 3–4 (roadmap; write each when its predecessor lands)

- **Plan 3 — Read API + conformance + warm-click + per-account view.** `GET /api/scan` (rows + heartbeat metadata, anonymous-open best-effort 200), `GET /api/scan/universe`, `GET/PUT /api/scan/view` (the per-account view on the existing `SettingsRecord` per D1, server-gated via the auth ports — real 401/403 on WRITES only); the standalone `.spire/clusters/tech/state/conformance/scanner.json` (after the **system-12** conformance-doc reconciliation — hard, precedes GATE U·X); the ticker endpoint's best-effort **warm-click read-through** of Plan 2's `read_bundle_blob` (freshness-gated, falls straight through to the vendor on a miss — the `chain_store` precedent extended across the process boundary). Routes register under `/api/` **before** any `/{ticker}` catch-all. Default view = D2 (owner list; top-20-by-score fallback, N=20). Consumes Plan 1 + Plan 2.
- **Plan 4 — Frontend `/scanner` page.** Swap the stub (`pages/scanner/Scanner.tsx`); the dense terminal table + view editor + the four states (skeleton / empty / worker-down banner / per-row degrade) + mobile card collapse + the `libs/api` fetchers. References `docs/design/DESIGN_SYSTEM.md` (StatTile / TintChip[emphasis for tier] / useFlashOnChange for the sanctioned price-cell flash / Widget); green/red for **price direction only**; `/scanner` joins the 393px no-overflow e2e set. Consumes Plan 3's API.
