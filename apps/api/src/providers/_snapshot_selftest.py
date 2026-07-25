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
