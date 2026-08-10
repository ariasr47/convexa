"""
Capture golden GEX fixtures for the Rust `quant-engine` crate.

WHY: Phase 0/1 of the Rust rewrite needs byte-stable parity against the live Python
`QuantEngine.process_gex_profile`. These fixtures pin the exact chain input + Python
output at a frozen `as_of`, so the Rust scalar path can be regression-tested offline.

USAGE (from repo root; needs MASSIVE_API_KEY in apps/api/.env):

    # Canonical exact-parity set (SPY, QQQ, NVDA) at a fixed clock:
    apps/api/.venv/Scripts/python.exe apps/api/tests/capture_gex_fixtures.py \\
        --as-of 2026-08-09T23:00:00Z SPY QQQ NVDA

    # Optional DTE window (+ full chain):
    apps/api/.venv/Scripts/python.exe apps/api/tests/capture_gex_fixtures.py \\
        --as-of 2026-08-09T23:00:00Z --dte 0 45 --also-full SPY

Writes:
    libs/quant-engine/tests/fixtures/gex_<TICKER>.json
    libs/quant-engine/tests/fixtures/gex_<TICKER>_dte<min>-<max>.json  (with --dte)

Each file holds:
  - as_of          frozen UTC clock used for DTE / today filtering
  - spot           synchronized_spot (gex_spot)
  - options        dividend_yield, risk_free_rate, optional DTE window
  - contracts      normalized OptionContract list (Massive shape)
  - expected       full process_gex_profile return (+ derived regime)
  - parity         {"mode": "exact"} when --as-of is supplied

Nothing here runs during the test suite.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

# Bootstrap: apps/api on sys.path + load .env before provider import
API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parents[1]
sys.path.insert(0, str(API_ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(API_ROOT / ".env")

from src.core.engine import QuantEngine  # noqa: E402
from src.providers.massive import MassiveProvider  # noqa: E402

# Canonical exact-parity set for the Rust rewrite.
DEFAULT_TICKERS = ["SPY", "QQQ", "NVDA"]
# Fixed clock used when --as-of is omitted but we still want a stable default for the
# canonical set. Prefer an explicit --as-of for re-baselines.
DEFAULT_AS_OF = "2026-08-09T23:00:00Z"
OUT_DIR = REPO_ROOT / "libs" / "quant-engine" / "tests" / "fixtures"
RISK_FREE = 0.045
DIVIDEND_YIELD = 0.0


def _regime_from_net_gex(net_gex: float) -> str:
    if net_gex > 0:
        return "positive"
    if net_gex < 0:
        return "negative"
    return "neutral"


def _parse_as_of(s: str) -> datetime:
    """Parse ISO-8601 UTC (`...Z` or offset). Store fixtures as `...Z`."""
    raw = s.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(microsecond=0)


def _normalize_contracts(raw: list) -> list[dict]:
    """Strip non-engine fields (quote) and ensure JSON-stable types for Rust serde."""
    out = []
    for c in raw:
        g = c.get("greeks") or {}
        out.append(
            {
                "strike_price": float(c["strike_price"]),
                "contract_type": str(c["contract_type"]).lower(),
                "open_interest": float(c.get("open_interest") or 0),
                "expiration_date": str(c.get("expiration_date") or "")[:10],
                "implied_volatility": float(c.get("implied_volatility") or 0.0),
                "volume": (
                    float(c["volume"]) if c.get("volume") is not None else None
                ),
                "greeks": {
                    "gamma": (
                        float(g["gamma"]) if g.get("gamma") is not None else None
                    ),
                    "delta": (
                        float(g["delta"]) if g.get("delta") is not None else None
                    ),
                    "theta": (
                        float(g["theta"]) if g.get("theta") is not None else None
                    ),
                    "vega": (
                        float(g["vega"]) if g.get("vega") is not None else None
                    ),
                },
            }
        )
    return out


def _freeze_engine_clock(as_of: datetime):
    """
    Patch `src.core.engine.datetime` so now() is frozen while strptime/other still work.

    process_gex_profile uses datetime.now for "today" and time-to-expiry. Golden
    fixtures must pin that clock so Rust (as_of) and Python agree.
    """
    import src.core.engine as engine_mod

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            if tz is None:
                return as_of.replace(tzinfo=None) if as_of.tzinfo else as_of
            return as_of.astimezone(tz) if as_of.tzinfo else as_of.replace(tzinfo=tz)

    return patch.object(engine_mod, "datetime", FrozenDateTime)


def run_gex(
    market_data: dict,
    *,
    as_of: datetime,
    min_dte: float | None,
    max_dte: float | None,
    dividend_yield: float,
    risk_free: float,
) -> dict:
    engine = QuantEngine(risk_free_rate=risk_free, dividend_yield=dividend_yield)
    with _freeze_engine_clock(as_of):
        return engine.process_gex_profile(
            market_data,
            max_days_to_expiry=max_dte,
            min_days_to_expiry=min_dte,
            dividend_yield=dividend_yield,
        )


def build_fixture(
    ticker: str,
    market_data: dict,
    *,
    as_of: datetime,
    min_dte: float | None,
    max_dte: float | None,
    dividend_yield: float = DIVIDEND_YIELD,
    risk_free: float = RISK_FREE,
    exact: bool = True,
) -> dict:
    contracts = _normalize_contracts(market_data.get("contracts") or [])
    spot = float(market_data["synchronized_spot"])
    # Re-run on the normalized contracts so the fixture is self-contained
    # (same bytes the Rust side will load).
    md = {
        "ticker": ticker,
        "synchronized_spot": spot,
        "contracts": contracts,
    }
    expected = run_gex(
        md,
        as_of=as_of,
        min_dte=min_dte,
        max_dte=max_dte,
        dividend_yield=dividend_yield,
        risk_free=risk_free,
    )
    expected = dict(expected)
    expected["regime"] = _regime_from_net_gex(float(expected.get("net_gex") or 0.0))

    return {
        "_note": (
            "Golden GEX fixture captured from Python QuantEngine.process_gex_profile "
            "with a frozen as_of. Inputs are the normalized Massive chain; expected is "
            "exactly the Python return dict (+ derived regime). Regenerate with "
            "apps/api/tests/capture_gex_fixtures.py --as-of <ISO> SPY QQQ NVDA."
        ),
        "ticker": ticker,
        "as_of": as_of.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "spot": spot,
        "options": {
            "min_days_to_expiry": min_dte,
            "max_days_to_expiry": max_dte,
            "dividend_yield": dividend_yield,
            "risk_free_rate": risk_free,
        },
        "parity": {
            "mode": "exact" if exact else "tolerant",
            # Wire values are already rounded to 2dp in Python; Rust matches that.
            "aggregate_abs": 0.0 if exact else 0.02,
            "flip_abs": 0.0 if exact else 0.05,
            "strike_abs": 0.0,
        },
        "meta": {
            "contract_count": len(contracts),
            "priced_count": sum(
                1 for c in contracts if (c.get("greeks") or {}).get("gamma") is not None
            ),
            "vendor_timestamp_ns": market_data.get("timestamp"),
            "atm_iv": market_data.get("atm_iv"),
        },
        "contracts": contracts,
        "expected": expected,
    }


def fixture_filename(ticker: str, min_dte: float | None, max_dte: float | None) -> str:
    if min_dte is None and max_dte is None:
        return f"gex_{ticker}.json"
    lo = "0" if min_dte is None else str(int(min_dte) if min_dte == int(min_dte) else min_dte)
    hi = "inf" if max_dte is None else str(int(max_dte) if max_dte == int(max_dte) else max_dte)
    return f"gex_{ticker}_dte{lo}-{hi}.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "tickers",
        nargs="*",
        default=DEFAULT_TICKERS,
        help=f"Tickers to capture (default: {' '.join(DEFAULT_TICKERS)})",
    )
    parser.add_argument(
        "--as-of",
        default=DEFAULT_AS_OF,
        metavar="ISO",
        help=(
            f"Frozen UTC evaluation clock (ISO-8601). Default: {DEFAULT_AS_OF}. "
            "Required for exact Rust/Python DTE parity."
        ),
    )
    parser.add_argument(
        "--dte",
        nargs=2,
        type=float,
        metavar=("MIN", "MAX"),
        help="Optional min/max DTE window for gamma structure (e.g. --dte 0 45)",
    )
    parser.add_argument(
        "--also-full",
        action="store_true",
        help="With --dte, also write a full-chain fixture for each ticker",
    )
    parser.add_argument(
        "--tolerant",
        action="store_true",
        help="Mark fixture for tolerant (not exact) parity checks",
    )
    args = parser.parse_args(argv)

    if not os.getenv("MASSIVE_API_KEY"):
        print("ERROR: MASSIVE_API_KEY not set (load apps/api/.env)", file=sys.stderr)
        return 2

    as_of = _parse_as_of(args.as_of)
    min_dte = args.dte[0] if args.dte else None
    max_dte = args.dte[1] if args.dte else None
    exact = not args.tolerant

    print(f"Output: {OUT_DIR}")
    print(f"as_of:  {as_of.strftime('%Y-%m-%dT%H:%M:%SZ')} (parity={'exact' if exact else 'tolerant'})")
    print(f"Tickers: {', '.join(t.upper() for t in args.tickers)}")
    if min_dte is not None or max_dte is not None:
        print(f"DTE window: [{min_dte}, {max_dte}]")

    provider = MassiveProvider()
    written = 0

    for raw in args.tickers:
        ticker = raw.upper().strip()
        if not ticker:
            continue

        windows: list[tuple[float | None, float | None]] = []
        if args.also_full or (min_dte is None and max_dte is None):
            windows.append((None, None))
        if min_dte is not None or max_dte is not None:
            windows.append((min_dte, max_dte))
        seen: set[tuple[float | None, float | None]] = set()
        uniq = []
        for w in windows:
            if w not in seen:
                seen.add(w)
                uniq.append(w)

        print(f"  {ticker}: fetching chain…", flush=True)
        try:
            market_data = provider.fetch_options_market_state(ticker)
        except Exception as exc:  # noqa: BLE001
            print(f"  {ticker}: SKIPPED (fetch failed: {exc})")
            continue
        if not market_data or float(market_data.get("synchronized_spot") or 0) <= 0:
            print(f"  {ticker}: SKIPPED (empty / no spot)")
            continue

        n = len(market_data.get("contracts") or [])
        spot = market_data["synchronized_spot"]
        print(
            f"  {ticker}: {n} contracts @ ${spot:.2f}; computing at as_of={as_of.isoformat()}",
            flush=True,
        )

        for wmin, wmax in uniq:
            fixture = build_fixture(
                ticker,
                market_data,
                as_of=as_of,
                min_dte=wmin,
                max_dte=wmax,
                exact=exact,
            )
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            path = OUT_DIR / fixture_filename(ticker, wmin, wmax)
            path.write_text(
                json.dumps(fixture, indent=2, allow_nan=False) + "\n",
                encoding="utf-8",
            )
            exp = fixture["expected"]
            size_mb = path.stat().st_size / (1024 * 1024)
            tag = "full" if wmin is None and wmax is None else f"dte[{wmin},{wmax}]"
            print(
                f"  {ticker} ({tag}): net_gex={exp.get('net_gex')} "
                f"regime={exp.get('regime')} flip={exp.get('gamma_flip')} "
                f"-> {path.name} ({size_mb:.1f} MB)"
            )
            written += 1

    print(f"\n{written} fixture(s) written to {OUT_DIR}")
    return 0 if written else 1


if __name__ == "__main__":
    sys.exit(main())
